import { describe, it, expect } from 'vitest';
import {
  MARKER_IDS,
  MARKER_FRAC,
  MARGIN_FRAC,
  markerToCharacter,
  cornerOffset,
  createConsecutiveGate,
} from '../src/scenes/poster-detect.js';

describe('markerToCharacter', () => {
  it('ID 십의 자리 = 캐릭터, 일의 자리 = 모서리', () => {
    expect(markerToCharacter(10)).toEqual({ key: 'raong', corner: 0 });
    expect(markerToCharacter(13)).toEqual({ key: 'raong', corner: 3 });
    expect(markerToCharacter(23)).toEqual({ key: 'raoni', corner: 3 });
    expect(markerToCharacter(31)).toEqual({ key: 'raona', corner: 1 });
  });

  it('규약 밖 ID는 null (교차 오인식 원천 차단)', () => {
    expect(markerToCharacter(9)).toBeNull();
    expect(markerToCharacter(14)).toBeNull(); // corner는 0~3만
    expect(markerToCharacter(34)).toBeNull();
    expect(markerToCharacter(40)).toBeNull();
    expect(markerToCharacter(-1)).toBeNull();
  });

  it('MARKER_IDS 테이블과 일관된다', () => {
    for (const [key, ids] of Object.entries(MARKER_IDS)) {
      ids.forEach((id, corner) => {
        expect(markerToCharacter(id)).toEqual({ key, corner });
      });
    }
  });
});

describe('cornerOffset', () => {
  // 포스터 좌표: 폭=1, 높이=aspect, 원점=중심, x 오른쪽/y 위쪽.
  const aspect = 1.46;
  const inset = MARGIN_FRAC + MARKER_FRAC / 2; // 가장자리→마커 중심 거리

  it('좌상(0) 마커 중심', () => {
    const o = cornerOffset(0, aspect);
    expect(o.x).toBeCloseTo(-(0.5 - inset), 10);
    expect(o.y).toBeCloseTo(aspect / 2 - inset, 10);
  });

  it('우상(1)·좌하(2)·우하(3)은 부호 대칭', () => {
    expect(cornerOffset(1, aspect)).toEqual({ x: 0.5 - inset, y: aspect / 2 - inset });
    expect(cornerOffset(2, aspect)).toEqual({ x: -(0.5 - inset), y: -(aspect / 2 - inset) });
    expect(cornerOffset(3, aspect)).toEqual({ x: 0.5 - inset, y: -(aspect / 2 - inset) });
  });
});

describe('createConsecutiveGate', () => {
  it('같은 key n연속일 때만 그 key를 반환한다', () => {
    const gate = createConsecutiveGate(3);
    expect(gate.feed('raong')).toBeNull();
    expect(gate.feed('raong')).toBeNull();
    expect(gate.feed('raong')).toBe('raong');
  });

  it('미검출(null)이 끼면 카운트가 리셋된다', () => {
    const gate = createConsecutiveGate(3);
    gate.feed('raong');
    gate.feed('raong');
    expect(gate.feed(null)).toBeNull();
    gate.feed('raong');
    gate.feed('raong');
    expect(gate.feed('raong')).toBe('raong');
  });

  it('다른 key가 끼면 새 key 기준으로 다시 센다', () => {
    const gate = createConsecutiveGate(2);
    gate.feed('raong');
    expect(gate.feed('raoni')).toBeNull();
    expect(gate.feed('raoni')).toBe('raoni');
  });
});
