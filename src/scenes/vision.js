import { CONFIG } from '../config.js';
import { createClassifier } from '../vision/classifier.js';
import { createRecognitionGate } from '../vision/recognition-gate.js';

/**
 * Vision AI 인식 모드 초기화. 카드 마커 모드(scenes/marker.js)와 동일한 세션 인터페이스를 쓴다 —
 * { containerEl, onXxx } 콜백을 받아 { stop() }를 반환한다.
 *
 * 마커 모드와 달리 vision.js는 "어떤 캐릭터인지 카메라로 알아내는" 역할만 담당하고, 인식이
 * 확정되면 자신의 카메라·classifier를 정리한 뒤 onRecognized(key)만 호출한다 — 이후 실제 AR
 * 안내 화면은 main.js가 기존 오버레이 모드(overlay.js, 검증된 자이로·모션·리액션 파이프라인)로
 * 이어받는다. 그 결과 vision.js는 렌더링을 직접 하지 않아 중복 코드 없이 가볍게 유지된다.
 *
 * @param {{
 *   containerEl: HTMLElement,
 *   onRecognized: (key: string) => void,
 *   onError?: (err: Error) => void,
 *   onProgress?: (frame: { label: string, score: number }) => void,
 * }} opts
 * @returns {Promise<{ stop(): void }>}
 */
export async function initVision({ containerEl, onRecognized, onError, onProgress }) {
  containerEl.innerHTML = '';
  const videoEl = document.createElement('video');
  videoEl.className = 'vision-video';
  videoEl.autoplay = true;
  videoEl.muted = true;
  videoEl.playsInline = true;
  containerEl.appendChild(videoEl);

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) {
    onError?.(Object.assign(new Error('camera-permission-denied'), { cause: e }));
    return { stop() {} };
  }
  videoEl.srcObject = stream;
  try {
    await videoEl.play();
  } catch {
    // muted+playsinline 조합이면 대부분 허용되지만, 드물게 자동재생이 막혀도 흐름을 죽이지 않는다 —
    // 프레임이 갱신되지 않으면 classify 결과가 계속 unknown일 뿐 크래시하지 않는다.
  }

  let classifier;
  try {
    classifier = await createClassifier();
  } catch (e) {
    stream.getTracks().forEach((track) => track.stop());
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return { stop() {} };
  }

  const gate = createRecognitionGate({
    requiredConsecutive: CONFIG.vision.requiredConsecutive,
    threshold: CONFIG.vision.confidenceThreshold,
  });

  let stopped = false;
  let resolved = false; // 인식이 확정된 이후엔 추가 tick을 무시한다(중복 onRecognized 방지)

  async function tick() {
    if (stopped || resolved) return;
    try {
      const result = await classifier.classify(videoEl);
      if (stopped || resolved || !result) return;
      onProgress?.(result);
      const confirmedKey = gate.push(result);
      if (confirmedKey) {
        resolved = true;
        stop(); // 인식 성공 즉시 카메라 트랙·classifier 정리 (2단계 요구사항 선반영)
        onRecognized?.(confirmedKey);
      }
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  const timer = setInterval(tick, CONFIG.vision.classifyIntervalMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    classifier?.dispose?.();
    containerEl.innerHTML = '';
  }

  return { stop };
}
