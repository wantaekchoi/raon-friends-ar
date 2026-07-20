import { describe, it, expect } from 'vitest';
import { createMockClassifier, createClassifier, readMockLabelParam, VISION_LABELS } from '../src/vision/classifier.js';

describe('readMockLabelParam', () => {
  it('?visionMock=raoni처럼 유효한 라벨이면 그 값을 반환한다', () => {
    expect(readMockLabelParam('?visionMock=raoni')).toBe('raoni');
  });

  it('파라미터가 없으면 null', () => {
    expect(readMockLabelParam('')).toBeNull();
  });

  it('유효하지 않은 라벨 값이면 null(파라미터 없음과 동일 취급)', () => {
    expect(readMockLabelParam('?visionMock=not-a-real-label')).toBeNull();
  });

  it('VISION_LABELS는 raong/raoni/raona/unknown 4종을 포함한다', () => {
    expect(VISION_LABELS).toEqual(['raong', 'raoni', 'raona', 'unknown']);
  });
});

describe('createMockClassifier', () => {
  it('delayFrames 이전까지는 unknown을 반환한다', async () => {
    const c = createMockClassifier({ label: 'raona', delayFrames: 3, score: 0.9 });
    expect(await c.classify()).toEqual({ label: 'unknown', score: 0.3 });
    expect(await c.classify()).toEqual({ label: 'unknown', score: 0.3 });
  });

  it('delayFrames 시점부터 지정된 label과 score를 반환한다', async () => {
    const c = createMockClassifier({ label: 'raona', delayFrames: 3, score: 0.87 });
    await c.classify();
    await c.classify();
    expect(await c.classify()).toEqual({ label: 'raona', score: 0.87 });
    // 이후 계속 같은 값을 반환
    expect(await c.classify()).toEqual({ label: 'raona', score: 0.87 });
  });

  it('label을 생략하면 기본값 raong을 쓴다(URL 파라미터 없는 환경 가정)', async () => {
    const c = createMockClassifier({ delayFrames: 1 });
    expect(await c.classify()).toEqual({ label: 'raong', score: 0.92 });
  });

  it('dispose()는 예외를 던지지 않는다', () => {
    const c = createMockClassifier({ delayFrames: 1 });
    expect(() => c.dispose()).not.toThrow();
  });

  it('ready는 즉시 resolve되는 프로미스다', async () => {
    const c = createMockClassifier({ delayFrames: 1 });
    await expect(c.ready).resolves.toBeUndefined();
  });
});

describe('createClassifier (1단계: 항상 mock)', () => {
  it('{ ready, classify, dispose } 형태를 반환한다', async () => {
    const c = await createClassifier({ label: 'raoni', delayFrames: 1 });
    expect(typeof c.classify).toBe('function');
    expect(typeof c.dispose).toBe('function');
    expect(await c.classify()).toEqual({ label: 'raoni', score: 0.92 });
  });
});
