// S4: 카드 모드 — fake 카메라로는 인식 불가 → 30초(×0.1배속=3초) 폴백 버튼 노출 → 오버레이 폴백까지.
import { withPage, dismissOnboarding, readBubble, assertNoThreeDuplicate } from '../harness.mjs';

export const name = 'S4 카드 미인식 폴백';

export async function run() {
  await withPage(async (page, ctx) => {
    await dismissOnboarding(page);
    // #btn-marker는 targets/cards.mind HEAD 체크(비동기)가 끝나야 disabled가 풀린다 —
    // networkidle0로 goto가 끝난 뒤라 보통 이미 풀려 있지만, 방어적으로 대기한다.
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-marker');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    await page.click('#btn-marker');
    await page.waitForSelector('#btn-marker-fallback:not([hidden])', { timeout: 15000 }); // 30s × 0.1 = 3s + 여유
    await page.click('#btn-marker-fallback');
    const b = await readBubble(page);
    if (b.screen !== 'guide') throw new Error(`폴백 후 가이드 아님: ${b.screen}`);
    // mind-ar 청크(별도 청크라 마커 진입에서만 로드)가 three.js 사본을 따로 들고 오면 여기서 잡힌다 —
    // three 중복 인스턴스 회귀를 실제로 검증할 수 있는 유일한 시나리오다.
    assertNoThreeDuplicate(ctx);
  }, { params: '?timerScale=0.1' });
}
