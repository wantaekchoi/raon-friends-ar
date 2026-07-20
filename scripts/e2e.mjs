// E2E 러너 — 시나리오를 순차 실행하고 요약을 출력한다. 실패 1건이라도 있으면 exit 1.
// 사용법: npm run e2e  (사전 조건: npm run build — CI에서는 별도 스텝, 로컬은 아래에서 자동)
import { execSync } from 'child_process';
import { startApp, stopApp } from './e2e/harness.mjs';

const scenarioModules = [
  './e2e/scenarios/s0-start.mjs',
  './e2e/scenarios/s1-overlay-flow.mjs',
  './e2e/scenarios/s2-solo-identity.mjs',
  './e2e/scenarios/s3-vision-mock.mjs',
  './e2e/scenarios/s4-marker-fallback.mjs',
  './e2e/scenarios/s5-survey-submit.mjs',
  './e2e/scenarios/s6-params.mjs',
];

execSync('npm run build', { stdio: 'inherit' });
await startApp();
let failed = 0;
try {
  for (const path of scenarioModules) {
    const mod = await import(path);
    try {
      await mod.run();
      console.log(`✓ ${mod.name}`);
    } catch (e) {
      failed += 1;
      console.error(`✗ ${mod.name}\n  ${e.message}`);
    }
  }
} finally {
  await stopApp();
}
console.log(failed ? `실패 ${failed}건` : '전체 그린');
process.exit(failed ? 1 : 0);
