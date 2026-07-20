// Vision AI 이미지 분류기.
//
// createClassifier()가 반환하는 형태 { ready, classify(videoEl), dispose() }는 1단계(mock)와
// 2단계(MediaPipe 실 모델) 모두 동일하게 유지된다 — vision.js는 이 형태에만 의존하므로 내부
// 구현 교체가 vision.js에 영향을 주지 않는다.
//
// mock/real 선택: URL 파라미터 ?visionMock=<label>이 있으면 항상 mock을 쓴다(모델 파일 유무·
// 네트워크 상태와 무관하게 헤드리스 E2E로 "스캔→인식→안내 진입" 화면 흐름을 결정적으로 검증하기
// 위함). 파라미터가 없으면 실제 MediaPipe Tasks Vision ImageClassifier를 시도한다 — 모델 파일이
// 없거나(404) WASM/네트워크 로딩에 실패하면 createClassifier()가 reject하고, vision.js가 이를
// onError로 받아 오버레이 모드·설문 직행 폴백 UI를 보여준다(2단계 요구사항).

import { CONFIG } from '../config.js';

export const VISION_LABELS = ['raong', 'raoni', 'raona', 'unknown'];

// MediaPipe Tasks Vision의 WASM 런타임(SIMD 유무에 따라 최대 ~11MB)은 저장소에 커밋하지 않고
// jsDelivr CDN에서 필요할 때만 받는다 — 이 프로젝트는 대용량 바이너리를 git 이력에 남기지 않는
// 방침(48MB 원본 자산 제거 이력 참고)이며, CDN 로딩 실패도 이미 onError 폴백 경로로 안전하게
// 처리된다. 버전은 package.json의 @mediapipe/tasks-vision과 반드시 맞춰야 한다(업그레이드 시 함께 변경).
const MEDIAPIPE_VERSION = '0.10.35';
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

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
 * 'mock' | 'real' 중 어느 classifier를 쓸지 결정한다. ?visionMock=이 있으면 항상 mock.
 */
export function resolveClassifierMode(search = (typeof location !== 'undefined' ? location.search : '')) {
  return readMockLabelParam(search) ? 'mock' : 'real';
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
 * MediaPipe Tasks Vision ImageClassifier 기반 실제 classifier.
 * CONFIG.vision.modelPath(BASE_URL 기준 상대경로)의 tflite 모델을 로드한다. 모델이 없거나(404)
 * WASM 로딩이 실패하면 이 함수가 reject한다 — 호출부(vision.js)가 onError로 처리한다.
 */
async function createRealClassifier() {
  // 정적 import가 아니라 함수 내부 동적 import로 둔다 — mock만 쓰는 테스트/경로에서까지
  // MediaPipe JS 번들을 평가하지 않게 하기 위함(테스트 격리) + Vite가 vision 청크 안에서도
  // 별도 하위 청크로 분리할 수 있게 한다.
  const { FilesetResolver, ImageClassifier } = await import('@mediapipe/tasks-vision');

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const modelAssetPath = `${import.meta.env.BASE_URL}${CONFIG.vision.modelPath}`;
  const commonOptions = {
    baseOptions: { modelAssetPath },
    runningMode: 'VIDEO',
    maxResults: 1,
    scoreThreshold: 0, // 정렬·게이팅은 recognition-gate.js가 담당 — 여기서는 거르지 않고 최상위 1건만 받는다
  };

  // 4단계(저사양 기기 대비): GPU 델리게이트를 먼저 시도하고, WebGL 미지원 등으로 생성 자체가
  // 실패하면 CPU로 한 번 더 시도한다. 두 시도 모두 실패해야 진짜로 reject한다.
  let imageClassifier;
  try {
    imageClassifier = await ImageClassifier.createFromOptions(fileset, {
      ...commonOptions,
      baseOptions: { ...commonOptions.baseOptions, delegate: 'GPU' },
    });
  } catch (gpuErr) {
    console.warn('[vision] GPU 델리게이트 생성 실패 — CPU로 재시도', gpuErr);
    imageClassifier = await ImageClassifier.createFromOptions(fileset, {
      ...commonOptions,
      baseOptions: { ...commonOptions.baseOptions, delegate: 'CPU' },
    });
  }

  let lastVideoTime = -1;

  return {
    ready: Promise.resolve(),
    async classify(videoEl) {
      if (!videoEl || videoEl.readyState < 2) return null; // 아직 재생 가능한 프레임이 없음
      const currentTime = videoEl.currentTime;
      if (currentTime === lastVideoTime) return null; // 같은 프레임 중복 추론 방지(저사양 기기 대비)
      lastVideoTime = currentTime;

      const result = imageClassifier.classifyForVideo(videoEl, performance.now());
      const top = result.classifications?.[0]?.categories?.[0];
      if (!top) return { label: 'unknown', score: 0 };
      return { label: top.categoryName || 'unknown', score: top.score ?? 0 };
    },
    dispose() {
      imageClassifier.close();
    },
  };
}

/**
 * 실제 사용할 classifier를 생성한다. ?visionMock=(또는 opts.label 명시)가 있으면 mock을,
 * 없으면 MediaPipe 실 모델(2단계)을 시도한다. 반환 형태는 { ready, classify(videoEl), dispose() }
 * 로 항상 동일하다.
 * @param {{ search?: string, label?: string, delayFrames?: number, score?: number }} opts
 *   search: mode 판정에 쓸 location.search 대체값(테스트용). label/delayFrames/score: mock 세부 옵션.
 */
export async function createClassifier({ search, ...mockOpts } = {}) {
  const resolvedSearch = search ?? (typeof location !== 'undefined' ? location.search : '');
  const paramLabel = readMockLabelParam(resolvedSearch);

  // ?visionMock=이 있거나, 호출부가 label을 명시적으로 넘기면(테스트 등) mock을 쓴다.
  if (paramLabel || mockOpts.label) {
    return createMockClassifier({ ...mockOpts, label: mockOpts.label ?? paramLabel });
  }
  return createRealClassifier();
}
