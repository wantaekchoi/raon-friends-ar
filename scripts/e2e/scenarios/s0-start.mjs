// S0: 시작 화면 — 타이틀·모드 버튼 3종·언어 토글이 렌더되고 콘솔 에러가 없다.
import { withPage, assertNoThreeDuplicate } from '../harness.mjs';

export const name = 'S0 시작 화면 렌더';

export async function run() {
  await withPage(async (page, ctx) => {
    const state = await page.evaluate(() => ({
      title: document.getElementById('start-title').textContent,
      overlay: document.getElementById('btn-overlay-label').textContent,
      marker: document.getElementById('btn-marker-label').textContent,
      vision: document.getElementById('btn-vision-label').textContent,
      langToggle: document.getElementById('btn-lang-toggle').textContent,
      screen: document.body.dataset.screen,
    }));
    if (!state.title.includes('라온 프렌즈')) throw new Error(`타이틀 이상: ${state.title}`);
    if (state.screen !== 'start') throw new Error(`시작 화면 아님: ${state.screen}`);
    for (const [k, v] of Object.entries(state)) if (!v) throw new Error(`${k} 라벨 비어있음`);
    // three 중복 인스턴스 경고는 메인 청크 범위만 여기서 검사한다 — mind-ar는 별도 청크라
    // 마커 진입(S4)에서만 로드되므로 그쪽 검사는 S4가 담당한다.
    assertNoThreeDuplicate(ctx);
    await ctx.shot('s0-start');
  });
}
