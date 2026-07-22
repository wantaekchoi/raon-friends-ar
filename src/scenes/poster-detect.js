// 바닥 포스터 ArUco 인식의 순수 로직부 — ID 규약·모서리 오프셋·연속 검출 게이트.
// 브라우저 의존(js-aruco2 Detector·video 샘플링)은 poster.js/entry.js가 담당하고,
// 여기는 실기기 없이 유닛 테스트 가능한 결정 로직만 둔다 (검증 우선 설계).
//
// ID 규약 (스펙 2026-07-22-poster-fiducial-design.md):
//   십의 자리 = 캐릭터(1 라옹 · 2 라오니 · 3 라오나), 일의 자리 = 모서리(0 좌상 1 우상 2 좌하 3 우하).
//   규약 밖 ID는 무시 — NFT 교차 매칭 같은 "비슷해서 잘못 맞음"이 원천적으로 불가능한 지점.
export const MARKER_IDS = {
  raong: [10, 11, 12, 13],
  raoni: [20, 21, 22, 23],
  raona: [30, 31, 32, 33],
};

const KEY_BY_TENS = { 1: 'raong', 2: 'raoni', 3: 'raona' };

// 포스터 좌표 단위: 폭 = 1.0 (스펙 Global Constraints와 동일)
export const MARKER_FRAC = 0.14; // 마커 한 변
export const MARGIN_FRAC = 0.03; // 가장자리 여백

export function markerToCharacter(id) {
  if (!Number.isInteger(id) || id < 10) return null;
  const key = KEY_BY_TENS[Math.floor(id / 10)];
  const corner = id % 10;
  if (!key || corner > 3) return null;
  return { key, corner };
}

// 포스터 중심 원점(x 오른쪽·y 위쪽) 기준 마커 중심 위치. aspect = 높이/폭.
export function cornerOffset(corner, aspect) {
  const inset = MARGIN_FRAC + MARKER_FRAC / 2;
  const x = (corner % 2 === 0 ? -1 : 1) * (0.5 - inset);
  const y = (corner < 2 ? 1 : -1) * (aspect / 2 - inset);
  return { x, y };
}

// 마커(corner)의 네 꼭짓점 위치 — 포스터 평면 좌표(중심 원점·폭 1·y 위쪽), TL→TR→BR→BL 순.
// 검출기 corners와 같은 순서(인쇄 기준 좌상단 시작, 실측 확인 2026-07-22)라 그대로 대응된다.
export function markerCornerPlanePoints(corner, aspect) {
  const o = cornerOffset(corner, aspect);
  const h = MARKER_FRAC / 2;
  return [
    [o.x - h, o.y + h],
    [o.x + h, o.y + h],
    [o.x + h, o.y - h],
    [o.x - h, o.y - h],
  ];
}

// 같은 key가 n번 "연속" 잡혔을 때만 확정 — 한 프레임 오검출로 포스터 모드에 진입하는 것 방지.
// null(미검출)이나 다른 key가 끼면 처음부터 다시 센다.
export function createConsecutiveGate(n) {
  let currentKey = null;
  let count = 0;
  return {
    feed(key) {
      if (!key) {
        currentKey = null;
        count = 0;
        return null;
      }
      if (key === currentKey) count += 1;
      else {
        currentKey = key;
        count = 1;
      }
      return count >= n ? key : null;
    },
  };
}
