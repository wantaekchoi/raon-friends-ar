// S7: 자이로 provider 주입 — 헤드리스에서 가짜 deviceorientation 이벤트를 주입해 오버레이
// 카메라 쿼터니언이 실제로 회전하는지 검증한다(Task 11).
//
// 실기기 자이로는 헤드리스 Chrome에서 재현할 수 없으므로, overlay.js의 구독부를 주입 가능한
// orientationProvider로 바꾸고(기본값은 기존과 동일한 window.addEventListener), 테스트 전용
// 파라미터 ?fakeGyro=1일 때만 entry.js가 window.__fakeOrientation(payload)를 노출하는 provider로
// 대체한다. 같은 조건에서 overlay.js는 camera.quaternion 참조를 window.__overlayCameraQuat로도
// 노출해(fakeGyro 미사용 시엔 노출 안 함 — 동작 완전 동일) 회전 반영 여부를 확인할 수 있게 한다.
import { withPage, dismissOnboarding } from '../harness.mjs';

export const name = 'S7 자이로 provider 주입(fakeGyro 헤드리스)';

async function readQuat(page) {
  return page.evaluate(() => {
    const q = window.__overlayCameraQuat;
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  });
}

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#btn-overlay');

    // fakeGyro 전용 디버그 훅이 준비될 때까지 대기 — initOverlay()가 비동기(getUserMedia 등)라
    // 클릭 직후엔 아직 없을 수 있다.
    await page.waitForFunction(() => typeof window.__overlayCameraQuat !== 'undefined', { timeout: 15000 });
    await page.waitForFunction(() => typeof window.__fakeOrientation === 'function', { timeout: 15000 });

    const initialQuat = await readQuat(page);

    // 실제 deviceorientation 이벤트와 동일한 형태(alpha/beta/gamma, 0~360/−180~180)로 수 회 주입.
    const samples = [
      { alpha: 10, beta: 45, gamma: 0 },
      { alpha: 40, beta: 20, gamma: 15 },
      { alpha: 90, beta: 60, gamma: -20 },
    ];
    for (const sample of samples) {
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate((s) => window.__fakeOrientation(s), sample);
    }

    const finalQuat = await readQuat(page);
    const changed = ['x', 'y', 'z', 'w'].some((k) => Math.abs(finalQuat[k] - initialQuat[k]) > 1e-6);
    if (!changed) {
      throw new Error(
        `가짜 방향 이벤트 주입 후에도 카메라 쿼터니언 불변: ${JSON.stringify(initialQuat)} → ${JSON.stringify(finalQuat)}`,
      );
    }
  }, { params: '?fakeGyro=1' });
}
