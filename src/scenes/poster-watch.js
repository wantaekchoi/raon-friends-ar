// 포스터 감시 — 마커 모드(MindAR) 진입 후, MindAR가 켜 둔 <video>를 주기 샘플링해
// ArUco 모서리 마커를 찾는다. 같은 캐릭터가 3연속 잡히면 onConfirm(key) — 포스터 모드 확정.
// entry.js의 NFT confirm은 recentlyDetected()로 거부권(veto)을 행사한다: 포스터가 화면에 있는
// 동안 NFT 매칭은 신뢰할 수 없다는 게 계측 결론(사선 교차 오인식, debug-marker 프로브).
import { markerToCharacter, createConsecutiveGate } from './poster-detect.js';
import arucoPkg from 'js-aruco2';

const { AR } = arucoPkg;

const DETECT_W = 640;
const INTERVAL_MS = 150;
const CONSECUTIVE = 3;
const RECENT_MS = 600;

/**
 * @param {{ containerEl: HTMLElement, onConfirm: (key: string) => void }} opts
 * @returns {{ recentlyDetected(): boolean, stop(): void }}
 */
export function createPosterWatch({ containerEl, onConfirm }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
  const gate = createConsecutiveGate(CONSECUTIVE);
  let lastDetectionAt = 0;
  let stopped = false;

  const timer = setInterval(() => {
    if (stopped) return;
    const video = containerEl.querySelector('video'); // MindAR가 생성 — 뜰 때까지 조용히 대기
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    canvas.width = DETECT_W;
    canvas.height = Math.round((DETECT_W * video.videoHeight) / video.videoWidth);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const markers = detector.detect(ctx.getImageData(0, 0, canvas.width, canvas.height));

    // 이 프레임의 대표 key — 규약 밖 ID는 무시, 여러 마커면 다수결(같은 포스터면 어차피 동일 key)
    const counts = new Map();
    for (const m of markers) {
      const info = markerToCharacter(m.id);
      if (info) counts.set(info.key, (counts.get(info.key) ?? 0) + 1);
    }
    let frameKey = null;
    let best = 0;
    for (const [key, n] of counts) {
      if (n > best) { best = n; frameKey = key; }
    }
    if (frameKey) lastDetectionAt = Date.now();

    const confirmed = gate.feed(frameKey);
    if (confirmed) {
      stopped = true;
      clearInterval(timer);
      onConfirm(confirmed);
    }
  }, INTERVAL_MS);

  return {
    recentlyDetected: () => Date.now() - lastDetectionAt < RECENT_MS,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
