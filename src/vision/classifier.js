// Vision AI 이미지 분류기 — 1단계는 mock 구현만 제공한다 (실제 MediaPipe 모델은 2단계에서 교체).
//
// createClassifier()가 반환하는 형태 { ready, classify(videoEl), dispose() }는 2단계에서 내부를
// MediaPipe Tasks Vision ImageClassifier로 교체한 뒤에도 그대로 유지된다 — vision.js는 이 형태에만
// 의존하므로 교체 시 vision.js를 건드릴 필요가 없다.
//
// mock은 URL 파라미터 ?visionMock=<label>로 결정적 라벨을 지정할 수 있어(예: ?visionMock=raoni),
// 실제 모델·카메라 인식 정확도와 무관하게 헤드리스 E2E로 화면 흐름(스캔→인식→안내 진입)을
// 검증할 수 있다. 파라미터가 없으면 기본값 'raong'을 사용한다.

export const VISION_LABELS = ['raong', 'raoni', 'raona', 'unknown'];

/**
 * ?visionMock= 값을 읽는다. 유효한 라벨이 아니면 null(=파라미터 없음과 동일하게 처리).
 * 순수 함수로 테스트하려면 search를 명시적으로 넘긴다(i18n.js의 currentLang() 패턴과 동일).
 */
export function readMockLabelParam(search = (typeof location !== 'undefined' ? location.search : '')) {
  const params = new URLSearchParams(search || '');
  const label = params.get('visionMock');
  return VISION_LABELS.includes(label) ? label : null;
}

/**
 * Mock classifier — 실제 추론 없이 delayFrames번째 호출부터 지정된 label+score를 반환한다.
 * 그 이전엔 항상 'unknown'을 반환해, 실기기에서 "카메라를 비추고 잠시 기다리면 인식되는" 흐름을
 * 흉내낸다. label을 명시하지 않으면 ?visionMock= 파라미터 → 없으면 'raong' 순으로 결정한다.
 *
 * @param {{ label?: string, delayFrames?: number, score?: number }} opts
 */
export function createMockClassifier({
  label = readMockLabelParam() ?? 'raong',
  delayFrames = 3,
  score = 0.92,
} = {}) {
  let frame = 0;
  return {
    ready: Promise.resolve(),
    // eslint-disable-next-line no-unused-vars
    async classify(_videoEl) {
      frame += 1;
      if (frame < delayFrames) return { label: 'unknown', score: 0.3 };
      return { label, score };
    },
    dispose() {},
  };
}

/**
 * 실제 사용할 classifier를 생성한다. 1단계에서는 항상 mock을 반환하지만, 반환 형태
 * { ready, classify(videoEl), dispose() }는 2단계(MediaPipe 실제 구현)에서도 동일하게 유지된다.
 * @param {{ label?: string, delayFrames?: number, score?: number }} opts mock 세부 옵션(테스트용)
 */
export async function createClassifier(opts = {}) {
  return createMockClassifier(opts);
}
