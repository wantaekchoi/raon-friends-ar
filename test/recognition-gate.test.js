import { describe, it, expect } from 'vitest';
import { createRecognitionGate } from '../src/vision/recognition-gate.js';

describe('createRecognitionGate', () => {
  it('연속 requiredConsecutive회 미만이면 null을 반환한다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 3, threshold: 0.5 });
    expect(gate.push({ label: 'raong', score: 0.9 })).toBeNull();
    expect(gate.push({ label: 'raong', score: 0.9 })).toBeNull();
  });

  it('연속 requiredConsecutive회를 채우면 해당 label을 확정 반환한다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 3, threshold: 0.5 });
    gate.push({ label: 'raong', score: 0.9 });
    gate.push({ label: 'raong', score: 0.9 });
    expect(gate.push({ label: 'raong', score: 0.9 })).toBe('raong');
  });

  it('확정 이후에도 계속 push하면 다시 같은 label을 반환한다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 2, threshold: 0.5 });
    gate.push({ label: 'raoni', score: 0.9 });
    expect(gate.push({ label: 'raoni', score: 0.9 })).toBe('raoni');
    expect(gate.push({ label: 'raoni', score: 0.9 })).toBe('raoni');
  });

  it('중간에 다른 label이 섞이면 스트릭이 리셋된다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 3, threshold: 0.5 });
    gate.push({ label: 'raong', score: 0.9 });
    gate.push({ label: 'raong', score: 0.9 });
    gate.push({ label: 'raoni', score: 0.9 }); // 튐 — 리셋
    expect(gate.push({ label: 'raong', score: 0.9 })).toBeNull();
    expect(gate.progress).toEqual({ label: 'raong', count: 1 });
  });

  it('threshold 미달 score는 리셋된다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 2, threshold: 0.7 });
    gate.push({ label: 'raona', score: 0.9 });
    expect(gate.push({ label: 'raona', score: 0.5 })).toBeNull();
    expect(gate.progress.count).toBe(0);
  });

  it("label이 'unknown'이면 항상 리셋되고 확정되지 않는다", () => {
    const gate = createRecognitionGate({ requiredConsecutive: 1, threshold: 0.5 });
    expect(gate.push({ label: 'unknown', score: 0.99 })).toBeNull();
    expect(gate.progress).toEqual({ label: null, count: 0 });
  });

  it('label이나 score가 없는 프레임(null/undefined)도 안전하게 리셋으로 처리한다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 1, threshold: 0.5 });
    expect(gate.push(null)).toBeNull();
    expect(gate.push(undefined)).toBeNull();
    expect(gate.push({})).toBeNull();
  });

  it('reset()으로 스트릭을 수동 초기화할 수 있다', () => {
    const gate = createRecognitionGate({ requiredConsecutive: 3, threshold: 0.5 });
    gate.push({ label: 'raong', score: 0.9 });
    gate.push({ label: 'raong', score: 0.9 });
    gate.reset();
    expect(gate.progress).toEqual({ label: null, count: 0 });
    expect(gate.push({ label: 'raong', score: 0.9 })).toBeNull(); // 리셋 후 다시 1부터
  });

  it('기본 옵션(requiredConsecutive=5, threshold=0.7)이 적용된다', () => {
    const gate = createRecognitionGate();
    for (let i = 0; i < 4; i += 1) {
      expect(gate.push({ label: 'raona', score: 0.8 })).toBeNull();
    }
    expect(gate.push({ label: 'raona', score: 0.8 })).toBe('raona');
  });
});
