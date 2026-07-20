// S3: Vision mock — ?visionMock=raong으로 진입해 인식 게이트 통과 후 라옹 단독 진행 확인.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S3 Vision mock 인식 → 단독 진행';

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#btn-vision');
    // 인식 게이트: classifyIntervalMs 400 × 연속 5회 ≈ 2초 + 전환 연출 여유
    const b = await readBubble(page, { settleMs: 6000 });
    if (b.name !== '라옹') throw new Error(`인식 후 화자가 라옹이 아님: ${b.name}`);
    if (!b.text.includes('라옹')) throw new Error(`자기소개에 라옹 없음: ${b.text}`);
  }, { params: '?visionMock=raong' });
}
