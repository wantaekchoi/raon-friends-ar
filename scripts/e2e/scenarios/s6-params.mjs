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
