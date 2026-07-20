import { describe, it, expect } from 'vitest';
import {
  createMockClassifier,
  createClassifier,
  readMockLabelParam,
  resolveClassifierMode,
  VISION_LABELS,
} from '../src/vision/classifier.js';

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

describe('resolveClassifierMode (2단계: mock ↔ 실 모델 라우팅)', () => {
  it('?visionMock=<유효 라벨>이 있으면 mock', () => {
    expect(resolveClassifierMode('?visionMock=raoni')).toBe('mock');
  });

  it('?visionMock= 파라미터가 없으면 real', () => {
    expect(resolveClassifierMode('')).toBe('real');
  });

  it('?visionMock=값이 유효하지 않은 라벨이면 real(파라미터 없음과 동일 취급)', () => {
    expect(resolveClassifierMode('?visionMock=not-a-real-label')).toBe('real');
  });
});

describe('createClassifier — mock 라우팅', () => {
  it('?visionMock=이 있으면(search로 명시) mock classifier를 반환한다', async () => {
    const c = await createClassifier({ search: '?visionMock=raoni', delayFrames: 1 });
    expect(typeof c.classify).toBe('function');
    expect(typeof c.dispose).toBe('function');
    expect(await c.classify()).toEqual({ label: 'raoni', score: 0.92 });
  });

  it('search 없이 label을 명시적으로 넘겨도(테스트 편의) mock으로 라우팅된다', async () => {
    const c = await createClassifier({ label: 'raona', delayFrames: 1 });
    expect(await c.classify()).toEqual({ label: 'raona', score: 0.92 });
  });

  // 실 모델(MediaPipe) 경로는 네트워크·WASM·모델 파일에 의존해 vitest로 결정적으로 검증할 수
  // 없다(프로젝트 관례상 카메라·DOM 의존 씬은 헤드리스 E2E로 검증 — CLAUDE.md 참고). ?visionMock=
  // 없이 실 모델 경로를 타는 것은 vision.js가 onError로 받아 폴백 UI를 띄우는지를 헤드리스
  // Puppeteer로 별도 검증했다(모델 파일이 아직 없으므로 항상 폴백 경로를 실제로 타게 된다).
});
