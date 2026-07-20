// S2: ?char= 단독 진행 — 3캐릭터 각각, 전 대사에서 "다른 캐릭터 이름 0회" 불변식.
// (v1.3.1 정체성 버그의 E2E 레벨 회귀 방지 — 유닛 불변식은 test/solo-character.test.js)
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S2 단독 진행 정체성 (?char= 3종)';
const NAMES = { raong: '라옹', raoni: '라오니', raona: '라오나' };

export async function run() {
  for (const [key, myName] of Object.entries(NAMES)) {
    await withPage(async (page) => {
      await dismissOnboarding(page);
      await page.click('#btn-overlay');
      for (let i = 0; i < 7; i++) {
        const b = await readBubble(page);
        const others = Object.values(NAMES).filter((n) => n !== myName);
        for (const other of others) {
          if ((b.name + b.text).includes(other)) {
            throw new Error(`[${key}] ${i}번째 대사에 ${other} 노출: ${b.name}: ${b.text}`);
          }
        }
        if (b.screen !== 'guide') break;
        if (b.name !== myName) throw new Error(`[${key}] 화자 불일치: ${b.name}`);
        await page.click('#btn-next');
      }
    }, { params: `?char=${key}` });
  }
}
