// S6: 파라미터 매트릭스 — ?lang=en 문구, ?kiosk=1 온보딩 생략, 크기 칩 상태.
//
// 크기 칩 셀렉터는 브리프의 후보(`[data-size="giant"]`, `.size-chip.active`,
// `[data-size].selected`)가 아니라 실제 소스 확인 결과로 확정했다:
// - `data-size` 속성 자체가 존재하지 않는다. 칩은 main.js의 IIFE(190~215줄)가
//   `document.createElement('button')`로 생성하며 부여하는 속성은 class(`size-chip`
//   [+ `selected`]), `role="radio"`, `aria-checked`뿐이다(main.js:199-204).
// - `#size-chips`(index.html:46)는 마크업상 빈 `<div>`이고, JS가 `sizes` 배열
//   `[['base',...], ['life',...], ['giant',...]]` 순서 그대로 `appendChild`한다
//   (main.js:196,198-214) — 그 외 자식 요소가 없으므로 `#size-chips .size-chip:last-child`가
//   항상 결정적으로 giant 칩을 가리킨다.
// - 활성 클래스는 `.size-chip.selected`이며(main.js:201,208) `.active`나
//   `[data-size].selected` 변형은 코드에 없다.
// - 기본(한국어, `?lang=` 없음) 라벨 텍스트는 `'🦖 자이언트'`다(src/i18n.js:130) —
//   S1/S2가 이미 같은 무-파라미터=한국어 가정을 쓰고 있어(harness 환경에서 검증됨) 동일하게 따른다.
import { withPage, dismissOnboarding } from '../harness.mjs';

export const name = 'S6 파라미터(en·kiosk·size)';

export async function run() {
  await withPage(async (page) => {
    const label = await page.evaluate(() => document.getElementById('btn-overlay-label').textContent);
    if (/만나러/.test(label)) throw new Error(`en인데 한국어 라벨: ${label}`);
    // #btn-lang-toggle 실제 클릭 → start-screen.js가 ?lang=을 반대 언어로 바꾸고
    // location.href를 재대입해 리로드한다(모듈 최상위에서 언어를 한 번만 평가하는 config.js
    // 구조상 reload가 유일한 전환 경로 — src/app/start-screen.js 참조).
    // 온보딩(최초 방문 오버레이)이 화면을 덮고 있으면 그 뒤의 버튼 클릭이 온보딩 배경에
    // 가로채여 아무 반응이 없다 — 먼저 닫아야 한다.
    await dismissOnboarding(page);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('#btn-lang-toggle'),
    ]);
    const toggled = await page.evaluate(() => ({
      label: document.getElementById('btn-overlay-label').textContent,
      lang: new URL(location.href).searchParams.get('lang'),
    }));
    if (!/만나러/.test(toggled.label)) throw new Error(`토글 후 한국어 라벨 아님: ${toggled.label}`);
    if (toggled.lang !== 'ko') throw new Error(`토글 후 URL lang 파라미터 미반영: ${toggled.lang}`);
  }, { params: '?lang=en' });

  await withPage(async (page) => {
    const onboardingShown = await page.evaluate(() => {
      const el = document.getElementById('onboarding');
      return el && !el.hidden;
    });
    if (onboardingShown) throw new Error('kiosk 모드에서 온보딩 노출');
  }, { params: '?kiosk=1' });

  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#size-chips .size-chip:last-child');
    const active = await page.evaluate(() => document.querySelector('.size-chip.selected')?.textContent ?? '');
    if (!active.includes('자이언트')) throw new Error(`자이언트 칩 미적용: ${active}`);
  });
}
