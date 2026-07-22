// POSIT(js-aruco2) 포즈 → three.js 카메라 공간 변환과 포스터 중심 역산·평균·스무딩.
// 순수 수학만 — 렌더·검출 의존 없음 (실기기 없이 유닛 테스트, 검증 우선 설계).
//
// 좌표 규약: POSIT에 넣는 이미지 좌표는 중심 원점·y 위쪽(+)으로 뒤집어 넣는다(poster.js 책임).
// 그 프레임은 x 오른쪽·y 위쪽·z 전방(깊이+)의 왼손계 — three 카메라(오른손계, 전방 -z)로는
// F=diag(1,1,-1) 켤레 변환: R' = F·R·F, t' = F·t. 평면 내 회전은 보존되고 z만 반전된다.
import * as THREE from 'three';
import { cornerOffset } from './poster-detect.js';

// 대칭 행렬 고유분해(순환 야코비) — js-aruco2 svd.js는 1-기반 인덱스 루프 잔재가 있어
// 9×9 입력에서 범위를 벗어난다(실측). AᵀA는 대칭 PSD라 야코비가 단순·결정적·안정적이다.
function symmetricEigenJacobi(M) {
  const n = M.length;
  const a = M.map((row) => row.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: V }; // vectors: 열이 고유벡터
}

export function positToThree(rotation, translation) {
  const m = new THREE.Matrix4().set(
    rotation[0][0], rotation[0][1], -rotation[0][2], translation[0],
    rotation[1][0], rotation[1][1], -rotation[1][2], translation[1],
    -rotation[2][0], -rotation[2][1], rotation[2][2], -translation[2],
    0, 0, 0, 1,
  );
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(position, quaternion, scale);
  return { position, quaternion };
}

// 마커(corner) 포즈에서 포스터 중심 포즈 역산 — cornerOffset은 "포스터 중심 기준 마커 위치"이므로
// 마커 로컬에서 그 역벡터를 회전시켜 더한다. 단위는 POSIT modelSize와 동일(포스터 폭 = 1).
export function posterCenterFrom(pose, corner, aspect) {
  const o = cornerOffset(corner, aspect);
  const local = new THREE.Vector3(-o.x, -o.y, 0).applyQuaternion(pose.quaternion);
  return { position: pose.position.clone().add(local), quaternion: pose.quaternion.clone() };
}

// 다중 마커 평균 — 위치는 산술 평균, 쿼터니언은 첫 포즈 반구로 정렬 후 성분합 정규화(nlerp 평균).
export function averagePoses(poses) {
  const position = new THREE.Vector3();
  const q = { x: 0, y: 0, z: 0, w: 0 };
  const ref = poses[0].quaternion;
  for (const p of poses) {
    position.add(p.position);
    const d = p.quaternion.dot(ref) < 0 ? -1 : 1;
    q.x += p.quaternion.x * d;
    q.y += p.quaternion.y * d;
    q.z += p.quaternion.z * d;
    q.w += p.quaternion.w * d;
  }
  position.divideScalar(poses.length);
  const quaternion = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
  return { position, quaternion };
}

// 평면-이미지 대응점들로 호모그래피를 풀어 6DoF 포즈를 얻는다 (IPPE류 접근).
// 마커별 POSIT는 작은 정사각 하나에서 평면 포즈의 고전적 2중 해 모호성이 있어(계측: 같은 평면의
// 두 마커가 서로 다른 법선을 반환) 폐기 — 대응점이 포스터 전체에 퍼져 있으면 호모그래피 해는
// 유일하고 안정적이다. 입력: 이미지 좌표(중심 원점·y 위·픽셀), 평면 좌표(포스터 중심 원점·폭 1),
// focal(검출 캔버스 폭 기준 초점거리). 출력: three 카메라 공간 {position, quaternion}.
export function poseFromPlanePoints(imagePts, planePts, focal) {
  // DLT: A h = 0. A는 2N×9 — 정규화(초점거리로 나눔)로 K를 항등으로 만든 뒤 AᵀA(9×9)의
  // 최소 특이벡터를 SVD(js-aruco2 svd.js)로 구한다.
  const AtA = Array.from({ length: 9 }, () => new Array(9).fill(0));
  const addRow = (row) => {
    for (let i = 0; i < 9; i += 1) {
      for (let j = 0; j < 9; j += 1) AtA[i][j] += row[i] * row[j];
    }
  };
  for (let k = 0; k < imagePts.length; k += 1) {
    const [X, Y] = planePts[k];
    const u = imagePts[k].x / focal;
    const v = imagePts[k].y / focal;
    addRow([X, Y, 1, 0, 0, 0, -u * X, -u * Y, -u]);
    addRow([0, 0, 0, X, Y, 1, -v * X, -v * Y, -v]);
  }
  const { values, vectors } = symmetricEigenJacobi(AtA);
  let min = 0;
  for (let i = 1; i < 9; i += 1) if (values[i] < values[min]) min = i;
  const h = (i) => vectors[i][min];

  // H = [r1 r2 t]·λ. 부호는 깊이 tz(=λ·h8) 양수(카메라 앞) 조건으로 확정 — 모호성 없음.
  let lambda = 1 / Math.hypot(h(0), h(3), h(6));
  if (h(8) * lambda < 0) lambda = -lambda;
  const r1 = [h(0) * lambda, h(3) * lambda, h(6) * lambda];
  const r2 = [h(1) * lambda, h(4) * lambda, h(7) * lambda];
  const t = [h(2) * lambda, h(5) * lambda, h(8) * lambda];

  // 직교화(그람-슈미트) + r3 = r1×r2 로 오른손 회전 보장
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const q1 = norm(r1);
  const d = r2[0] * q1[0] + r2[1] * q1[1] + r2[2] * q1[2];
  const q2 = norm([r2[0] - d * q1[0], r2[1] - d * q1[1], r2[2] - d * q1[2]]);
  const q3 = [
    q1[1] * q2[2] - q1[2] * q2[1],
    q1[2] * q2[0] - q1[0] * q2[2],
    q1[0] * q2[1] - q1[1] * q2[0],
  ];
  const R = [
    [q1[0], q2[0], q3[0]],
    [q1[1], q2[1], q3[1]],
    [q1[2], q2[2], q3[2]],
  ];
  return positToThree(R, t);
}

// 지수 스무딩 — "딱 붙어있게": 검출 지터를 흡수하되 alpha만큼 새 포즈로 수렴.
export function createPoseSmoother(alpha) {
  let prev = null;
  return {
    push(pose) {
      if (!prev) {
        prev = { position: pose.position.clone(), quaternion: pose.quaternion.clone() };
      } else {
        prev.position.lerp(pose.position, alpha);
        prev.quaternion.slerp(pose.quaternion, alpha);
      }
      return { position: prev.position.clone(), quaternion: prev.quaternion.clone() };
    },
  };
}
