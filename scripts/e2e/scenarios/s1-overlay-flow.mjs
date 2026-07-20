// S1: 기본 경로 — 온보딩 → 오버레이 → 릴레이 3캐릭터 배턴터치 → 설문 화면 진입.
// 릴레이 대본의 화자 순서(라옹→라옹→라오니→라오니→라오나)가 그대로 재생되는지 고정한다.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S1 오버레이 전체 플로우';

export async function run() {
  await withPage(async (page, ctx) => {
    await dismissOnboarding(page);
    await page.click('#btn-overlay');
    const speakers = [];
    for (let i = 0; i < 6; i++) {
      const b = await readBubble(page);
      if (b.screen !== 'guide') { speakers.push(`[${b.screen}]`); break; }
      speakers.push(b.name);
      // 캐릭터 전환 시 fbx 로딩(특히 라오나 5.3MB)이 readBubble의 settleMs(2.5s)를 넘길 수 있어,
      // 단순 1회 evaluate 대신 waitForFunction으로 btn-next가 풀릴 때까지 최대 15s 기다린다.
      // (브리프의 단발 evaluate를 이 부분만 현실에 맞춰 조정 — task-2-report.md 참조)
      const canNext = await page
        .waitForFunction(() => {
          const btn = document.getElementById('btn-next');
          return btn && !btn.hidden && !btn.disabled;
        }, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!canNext) throw new Error(`가이드 ${i}번째에서 다음 버튼 비활성`);
      await page.click('#btn-next');
    }
    const expected = ['라옹', '라옹', '라오니', '라오니', '라오나', '[survey]'];
    if (JSON.stringify(speakers) !== JSON.stringify(expected)) {
      throw new Error(`배턴터치 순서 불일치: ${speakers.join(',')} ≠ ${expected.join(',')}`);
    }
    const surveyVisible = await page.evaluate(() => !document.getElementById('survey-panel').hidden);
    if (!surveyVisible) throw new Error('설문 패널 미표시');
    await ctx.shot('s1-survey');
  });
}
