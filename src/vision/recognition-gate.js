// Vision AI 인식 판정 게이트 — 순수 로직 (DOM·카메라·모델 의존 없음, vitest로 직접 테스트).
//
// 매 프레임 classifier 결과({ label, score })를 push()에 흘려보내면, 동일 label이 threshold
// 이상의 신뢰도로 requiredConsecutive회 "연속" 인식됐을 때만 확정 label을 반환한다. 다른 label이
// 섞이거나(오인식 튐), score가 threshold 미달이거나, label이 'unknown'이면 스트릭이 리셋된다 —
// 한 프레임의 우연한 오인식으로 엉뚱한 캐릭터가 확정되는 것을 막기 위함이다.
//
// 사용 예 (vision.js):
//   const gate = createRecognitionGate({ requiredConsecutive: 5, threshold: 0.7 });
//   const confirmed = gate.push(await classifier.classify(videoEl));
//   if (confirmed) onRecognized(confirmed);

const UNKNOWN_LABEL = 'unknown';

/**
 * @param {{ requiredConsecutive?: number, threshold?: number }} opts
 */
export function createRecognitionGate({ requiredConsecutive = 5, threshold = 0.7 } = {}) {
  let streakLabel = null;
  let streakCount = 0;

  function reset() {
    streakLabel = null;
    streakCount = 0;
  }

  /**
   * 프레임 하나를 판정한다. 확정되면 확정된 label(string)을, 아직이면 null을 반환한다.
   * @param {{ label?: string, score?: number } | null | undefined} frame
   */
  function push(frame) {
    const label = frame?.label;
    const score = frame?.score ?? 0;

    if (!label || label === UNKNOWN_LABEL || score < threshold) {
      reset();
      return null;
    }

    if (label === streakLabel) {
      streakCount += 1;
    } else {
      streakLabel = label;
      streakCount = 1;
    }

    if (streakCount >= requiredConsecutive) {
      return streakLabel;
    }
    return null;
  }

  return {
    push,
    reset,
    // 디버깅·테스트용 현재 스트릭 상태 조회 (판정에는 영향 없음)
    get progress() {
      return { label: streakLabel, count: streakCount };
    },
  };
}
