// S3: Vision mock — ?visionMock=raoni로 진입해 인식 게이트 통과 후 라오니 단독 진행 확인.
//
// 목 캐릭터로 raoni를 쓰는 이유: 릴레이 대본의 첫 화자는 라옹이고 그 대사에도 "라옹"이 들어 있어,
// raong으로 검사하면 "인식 성공(단독 대본)"과 "인식이 조용히 실패해 평범한 릴레이로 폴백"을
// 구분하지 못한다(단언이 양쪽 모두 통과 = 회귀를 못 잡는 테스트). 릴레이 첫 화자가 아닌
// 캐릭터를 쓰고, 두 번째 대사까지 같은 화자인지 확인해 "단독 고정"을 실제로 검증한다.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S3 Vision mock 인식 → 단독 진행';

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#btn-vision');
    // 인식 게이트: classifyIntervalMs 400 × 연속 5회 ≈ 2초 + 전환 연출 여유
    const first = await readBubble(page, { settleMs: 6000 });
    if (first.name !== '라오니') throw new Error(`인식 후 화자가 라오니가 아님: ${first.name}`);
    if (!first.text.includes('라오니')) throw new Error(`자기소개에 라오니 없음: ${first.text}`);

    // 릴레이 대본이었다면 진행할수록 화자가 바뀐다 — 단독 고정이면 끝까지 같은 화자다.
    await page.click('#btn-next');
    const second = await readBubble(page);
    if (second.name !== '라오니') throw new Error(`두 번째 대사 화자가 바뀜(릴레이 폴백 의심): ${second.name}`);
  }, { params: '?visionMock=raoni' });
}
