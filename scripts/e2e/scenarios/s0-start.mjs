// S0: 시작 화면 — 타이틀·모드 버튼 3종·언어 토글이 렌더되고 콘솔 에러가 없다.
import { withPage } from '../harness.mjs';

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
    // three dedupe 검증 — vite.config.js의 resolve.dedupe: ['three']가 깨지면 mind-ar/FBXLoader가
    // three.js 별도 인스턴스를 로드해 이 console.warn이 뜬다. harness의 errors 판정과는 별개로
    // ctx.warnings(console.warn 전수, 하네스가 임시 수집)를 이 시나리오에서 직접 검사한다.
    const threeDup = ctx.warnings.find((w) => w.includes('Multiple instances of Three.js'));
    if (threeDup) throw new Error(`three.js 중복 인스턴스 경고 발견: ${threeDup}`);
    await ctx.shot('s0-start');
  });
}
