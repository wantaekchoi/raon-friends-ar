// S8: 카드 소환 "성공 경로" — 셸 재작성(v1.4.0)이 실제로 바꾼 코드
// (startMarkerFlow → router.setMode('marker-flow') → guide.lockTo → 화면 조합)를 검증한다.
//
// S4는 fake 카메라로 실제 카드 인식이 원천 불가라 30초 폴백 경로만 밟는다 — 소환 성공 경로는
// 그동안 E2E가 한 번도 지나가지 않은 커버리지 구멍이었다. ?markerMock=<key>(testParam으로
// localhost 전용 게이트, entry.js)는 mind-ar 로드·카메라 세션 없이 실제 인식 성공과 동일한
// 후속 시퀀스(confirmTarget)를 짧은 지연 후 실행한다 — onTarget과 markerMock이 같은 함수를
// 호출하므로(entry.js 참고) 이 시나리오가 검증하는 코드 경로는 실기기 카드 인식 성공 시와
// 100% 동일하다.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S8 카드 소환 성공 경로(markerMock)';

// data-mode="marker-flow"에서 CSS로 숨겨야 하는 오버레이 전용 요소들 — getComputedStyle로
// 실제 렌더 결과(display:none)를 확인한다. hidden 속성이 아니라 CSS 규칙(style.css)이 담당하는
// 부분이라 elementIsHidden 같은 속성 체크가 아니라 computedStyle을 직접 봐야 의미가 있다.
async function computedDisplay(page, id) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el ? getComputedStyle(el).display : null;
  }, id);
}

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    // #btn-marker는 targets/cards.mind HEAD 체크(비동기)가 끝나야 disabled가 풀린다(S4와 동일 대기).
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-marker');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    await page.click('#btn-marker');

    // markerMock이 300ms 지연 후 confirmTarget → 1600ms 뒤 startMarkerFlow(key) — 넉넉히 대기.
    await page.waitForFunction(() => document.body.dataset.mode === 'marker-flow', { timeout: 10000 });

    // ① 소환 후 data-mode="marker-flow" + data-screen="guide"
    const screen1 = await page.evaluate(() => document.body.dataset.screen);
    if (screen1 !== 'guide') throw new Error(`소환 후 화면이 guide가 아님: ${screen1}`);

    // ② 말풍선 화자가 소환한 캐릭터(raoni)이고, 두 번째 대사도 같은 화자(정체성 고정).
    const first = await readBubble(page);
    if (first.name !== '라오니') throw new Error(`소환 후 화자가 라오니가 아님: ${first.name}`);
    await page.click('#btn-next');
    const second = await readBubble(page);
    if (second.name !== '라오니') throw new Error(`두 번째 대사 화자가 바뀜(정체성 고정 실패): ${second.name}`);

    // ③ 마커 플로우에서 숨겨져야 하는 요소가 실제로 보이지 않음(getComputedStyle).
    for (const id of ['btn-capture', 'btn-home']) {
      // eslint-disable-next-line no-await-in-loop
      const display = await computedDisplay(page, id);
      if (display !== 'none') throw new Error(`마커 플로우에서 #${id}가 숨겨지지 않음(display: ${display})`);
    }

    // ④ 가이드 완주 후 설문 화면 진입 — 단독 대본(soloIntro + soloGuideLines) 나머지를 소진한다.
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await page.evaluate(() => document.body.dataset.screen);
      if (screen !== 'guide') break;
      // eslint-disable-next-line no-await-in-loop
      const canNext = await page
        .waitForFunction(() => {
          const btn = document.getElementById('btn-next');
          return btn && !btn.hidden && !btn.disabled;
        }, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!canNext) throw new Error(`가이드 ${i}번째에서 다음 버튼 비활성`);
      // eslint-disable-next-line no-await-in-loop
      await page.click('#btn-next');
    }
    await page.waitForSelector('#survey-panel:not([hidden])', { timeout: 15000 });
    const finalScreen = await page.evaluate(() => document.body.dataset.screen);
    if (finalScreen !== 'survey') throw new Error(`가이드 완주 후 설문 화면이 아님: ${finalScreen}`);

    // ⑤ 콘솔 에러 0건은 harness.withPage가 암묵적으로 단언한다(finally에서 errors.length 체크).
  }, { params: '?markerMock=raoni' });
}
