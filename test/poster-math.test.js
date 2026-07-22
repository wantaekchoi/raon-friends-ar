import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  positToThree,
  posterCenterFrom,
  averagePoses,
  createPoseSmoother,
} from '../src/scenes/poster-math.js';
import { MARKER_FRAC, MARGIN_FRAC } from '../src/scenes/poster-detect.js';
import { cornerOffset } from '../src/scenes/poster-detect.js';

const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

describe('positToThree', () => {
  it('항등 회전: three 카메라 공간에서 z만 부호 반전', () => {
    const { position, quaternion } = positToThree(I3, [1, 2, 10]);
    expect(position.x).toBeCloseTo(1);
    expect(position.y).toBeCloseTo(2);
    expect(position.z).toBeCloseTo(-10);
    expect(quaternion.w).toBeCloseTo(1);
  });

  it('평면 내(z축) 회전은 그대로 보존된다', () => {
    const c = Math.cos(Math.PI / 2);
    const s = Math.sin(Math.PI / 2);
    const rz90 = [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    const { quaternion } = positToThree(rz90, [0, 0, 5]);
    const v = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });
});

describe('posterCenterFrom', () => {
  const aspect = 297 / 210;
  const inset = MARGIN_FRAC + MARKER_FRAC / 2;

  it('항등 포즈의 좌상(0) 마커 → 포스터 중심은 마커에서 (+x, -y)쪽', () => {
    const pose = positToThree(I3, [0, 0, 10]); // 마커 중심이 (0,0,-10)
    const center = posterCenterFrom(pose, 0, aspect);
    expect(center.position.x).toBeCloseTo(0.5 - inset);
    expect(center.position.y).toBeCloseTo(-(aspect / 2 - inset));
    expect(center.position.z).toBeCloseTo(-10);
  });

  it('한 포스터의 네 마커 포즈에서 역산한 중심이 전부 일치한다', () => {
    // 포스터 중심 C에서 각 모서리 위치를 순방향 합성한 뒤 역산이 C로 돌아오는지 확인
    const C = new THREE.Vector3(3, -1, -8);
    const centers = [0, 1, 2, 3].map((corner) => {
      const o = cornerOffset(corner, aspect);
      const markerPose = {
        position: C.clone().add(new THREE.Vector3(o.x, o.y, 0)),
        quaternion: new THREE.Quaternion(),
      };
      return posterCenterFrom(markerPose, corner, aspect);
    });
    for (const c of centers) {
      expect(c.position.distanceTo(C)).toBeCloseTo(0);
    }
  });

  it('평면 내 회전된 마커에서도 중심 역산이 회전을 따른다', () => {
    const c = Math.cos(Math.PI / 2);
    const s = Math.sin(Math.PI / 2);
    const rz90 = [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    const pose = positToThree(rz90, [0, 0, 10]);
    const center = posterCenterFrom(pose, 0, aspect);
    // 로컬 (+x', -y') 오프셋이 z축 90° 회전을 타고 월드 (x=+y로, y=+x로) 매핑
    expect(center.position.x).toBeCloseTo(aspect / 2 - inset);
    expect(center.position.y).toBeCloseTo(0.5 - inset);
  });
});

describe('averagePoses', () => {
  it('동일 포즈 평균 = 그 포즈', () => {
    const a = positToThree(I3, [1, 1, 10]);
    const b = positToThree(I3, [3, 3, 10]);
    const avg = averagePoses([a, b]);
    expect(avg.position.x).toBeCloseTo(2);
    expect(avg.position.y).toBeCloseTo(2);
    expect(avg.quaternion.w).toBeCloseTo(1);
  });

  it('부호 반전된 쿼터니언(같은 회전)도 안전하게 평균낸다', () => {
    const a = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(0, 0, 0, 1) };
    const b = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(0, 0, 0, -1) };
    const avg = averagePoses([a, b]);
    expect(Math.abs(avg.quaternion.w)).toBeCloseTo(1);
  });
});

describe('createPoseSmoother', () => {
  it('alpha=1이면 즉시 추종한다', () => {
    const s = createPoseSmoother(1);
    const p = positToThree(I3, [5, 0, 10]);
    const out = s.push(p);
    expect(out.position.x).toBeCloseTo(5);
  });

  it('alpha=0.5면 절반씩 수렴한다', () => {
    const s = createPoseSmoother(0.5);
    s.push(positToThree(I3, [0, 0, 10]));
    const out = s.push(positToThree(I3, [4, 0, 10]));
    expect(out.position.x).toBeCloseTo(2);
  });
});

// ---------------------------------------------------------------------------
// 호모그래피 포즈 (poseFromPlanePoints) — 평면 POSIT의 2중 해 모호성을 없애는 근본 해법.
// 합성 투영으로 왕복 검증한다: 알려진 R·T로 평면점을 투영 → 복원 → 원본과 비교.
import { poseFromPlanePoints } from '../src/scenes/poster-math.js';
import { markerCornerPlanePoints } from '../src/scenes/poster-detect.js';

function projectPlanePoints(planePts, R, T, f) {
  return planePts.map(([X, Y]) => {
    const x = R[0][0] * X + R[0][1] * Y + T[0];
    const y = R[1][0] * X + R[1][1] * Y + T[1];
    const z = R[2][0] * X + R[2][1] * Y + T[2];
    return { x: (f * x) / z, y: (f * y) / z };
  });
}

// 바닥 틸트 50° — posit 프레임(x우 y상 z깊이)에서 법선이 (0, +0.64, -0.77)인 케이스
const th = (50 * Math.PI) / 180;
const R_FLOOR = [
  [1, 0, 0],
  [0, Math.cos(th), -Math.sin(th)],
  [0, Math.sin(th), Math.cos(th)],
];
const T_FLOOR = [0.2, -1.2, 5];
const ASPECT = 297 / 210;

describe('poseFromPlanePoints', () => {
  it('두 마커(8점) 왕복: three 공간 법선이 위(+y)를 향한다', () => {
    const plane = [...markerCornerPlanePoints(0, ASPECT), ...markerCornerPlanePoints(1, ASPECT)];
    const img = projectPlanePoints(plane, R_FLOOR, T_FLOOR, 640);
    const pose = poseFromPlanePoints(img, plane, 640);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
    if (n.z < 0) n.negate();
    expect(n.y).toBeGreaterThan(0.6); // 바닥 법선은 반드시 위쪽
    expect(Math.abs(n.x)).toBeLessThan(0.05);
  });

  it('원점(포스터 중심)의 위치를 three 공간으로 복원한다', () => {
    const plane = [...markerCornerPlanePoints(0, ASPECT), ...markerCornerPlanePoints(3, ASPECT)];
    const img = projectPlanePoints(plane, R_FLOOR, T_FLOOR, 640);
    const pose = poseFromPlanePoints(img, plane, 640);
    expect(pose.position.x).toBeCloseTo(T_FLOOR[0], 2);
    expect(pose.position.y).toBeCloseTo(T_FLOOR[1], 2);
    expect(pose.position.z).toBeCloseTo(-T_FLOOR[2], 2);
  });

  it('마커 1개(4점)만으로도 동일 포즈를 복원한다 (2중 해 모호성 없음)', () => {
    const plane = markerCornerPlanePoints(2, ASPECT);
    const img = projectPlanePoints(plane, R_FLOOR, T_FLOOR, 640);
    const pose = poseFromPlanePoints(img, plane, 640);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
    if (n.z < 0) n.negate();
    expect(n.y).toBeGreaterThan(0.6);
    expect(pose.position.z).toBeCloseTo(-5, 1);
  });
});

describe('markerCornerPlanePoints', () => {
  it('마커 중심 기준 ±s/2 정사각, TL→TR→BR→BL(y-up) 순서', () => {
    const pts = markerCornerPlanePoints(0, ASPECT);
    expect(pts).toHaveLength(4);
    const [tl, tr, br, bl] = pts;
    expect(tr[0] - tl[0]).toBeCloseTo(0.14); // MARKER_FRAC
    expect(tl[1] - bl[1]).toBeCloseTo(0.14);
    expect(tl[1]).toBeGreaterThan(br[1]);
  });
});
