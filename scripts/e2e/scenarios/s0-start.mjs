// S0: 시작 화면 — 타이틀·모드 버튼 3종·언어 토글이 렌더되고 콘솔 에러가 없다.
// + Vision 모델 게이팅(실사용 결함 회귀 방지) — public/models/vision/raon-mascot-classifier.tflite가
// 배포에 없는 현재 상태에서 #btn-vision이 실제로 비활성이고 배지가 마커와 동일한 "준비 중" 문구인지
// 확인한다. 전에는 이 버튼이 항상 활성 상태라 눌러도 100% 실패 폴백으로 이어졌다.
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

    // page.goto가 networkidle0까지 기다린 뒤에야 이 콜백이 실행되므로, 시작 화면 초기화 중
    // 동기적으로 발사된 vision 모델 HEAD 게이팅 fetch는 이미 완료돼 있다 — 별도 대기 불필요.
    const vision = await page.evaluate(() => ({
      disabled: document.getElementById('btn-vision').disabled,
      badge: document.getElementById('btn-vision-badge').textContent,
    }));
    if (!vision.disabled) throw new Error('모델 없는 배포인데 #btn-vision이 활성 상태 (실사용 100% 실패 회귀)');
    if (vision.badge !== '준비 중 🚧') throw new Error(`vision 배지가 "준비 중" 문구가 아님: ${vision.badge}`);
    // 게이팅이 실제로 그 자산을 향해 HEAD 요청을 보냈다는 흔적(404) — 우연히 기본값(disabled)과
    // 겹쳐서 통과하는 게 아니라 체크가 정말 실행됐음을 보장한다. harness.mjs가 이 정확한 404 1건은
    // EXPECTED_ERROR_PATTERNS로 실패 판정에서 걸러주므로 여기 남아 있어도 전체 그린을 막지 않는다.
    if (!ctx.errors.some((e) => e.includes('raon-mascot-classifier.tflite'))) {
      throw new Error('vision 모델 HEAD 체크 흔적이 없음 — 게이팅이 실행되지 않았을 가능성');
    }

    await ctx.shot('s0-start');
  });
}
