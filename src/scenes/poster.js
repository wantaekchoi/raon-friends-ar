// 바닥 포스터(ArUco fiducial) 씬 — 대형 포스터 위에 캐릭터를 "딱 붙여" 세운다.
// NFT(MindAR)가 사선에서 교차 오인식하던 문제의 해법(스펙 2026-07-22-poster-fiducial-design.md):
// 모서리 ArUco 4점 각각의 POSIT 6DoF에서 포스터 중심을 역산 → 다중 평균 + 지수 스무딩.
// 검출 일시 누락 시 마지막 포즈를 그대로 유지(튀지 않음), 재검출 시 부드럽게 재스냅.
import * as THREE from 'three';
import { loadCharacter } from '../characters.js';
import { testParam } from '../app/test-params.js';
import { markerToCharacter, markerCornerPlanePoints } from './poster-detect.js';
import { poseFromPlanePoints, createPoseSmoother } from './poster-math.js';

// js-aruco2는 CJS 전역 스타일 모듈 — vite가 prebundle로 감싸준다.
import arucoPkg from 'js-aruco2';

const { AR } = arucoPkg;

const DETECT_W = 640; // 검출용 다운샘플 폭 — 성능/정확도 균형
const POSTER_ASPECT = 297 / 210; // A계열 세로 (floor-card SVG와 동일)
const CHARACTER_HEIGHT = 1.3; // 포스터 폭=1 단위 — "카드가 클수록 캐릭터도 크게"
const NORMALIZED_CHARACTER_HEIGHT = 1.2; // loadCharacter 정규화 키 (characters.js)

async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

// 비디오/캔버스를 컨테이너에 object-fit:cover와 같은 기하로 맞춘다 — 검출 좌표(원본 프레임)와
// 표시 좌표가 동일 변환을 타야 캐릭터가 화면상 포스터 위치에 정확히 겹친다.
function coverLayout(el, containerW, containerH, mediaW, mediaH) {
  const scale = Math.max(containerW / mediaW, containerH / mediaH);
  const w = mediaW * scale;
  const h = mediaH * scale;
  el.style.position = 'absolute';
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${(containerW - w) / 2}px`;
  el.style.top = `${(containerH - h) / 2}px`;
}

/**
 * @param {{ containerEl: HTMLElement, characterKey: string,
 *   onTrackChange?: (tracked: boolean) => void }} opts
 * @returns {Promise<{ stop(): void }>}
 */
export async function initPoster({ containerEl, characterKey, onTrackChange }) {
  containerEl.innerHTML = '';
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  containerEl.appendChild(video);
  const stream = await startCamera(video);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0); // 명시적 투명 클리어 — 헤드리스 합성에서 불투명 검정 방지
  containerEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // 스튜디오 조명 — marker.js와 동일 세트(레트로 툰 램프와 한 벌)
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x33405c, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(1.4, 3, 2.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.32);
  fillLight.position.set(-2.2, 1.0, -1.0);
  scene.add(fillLight);

  const character = await loadCharacter(characterKey);
  const standGroup = new THREE.Group();
  standGroup.add(character);
  standGroup.scale.setScalar(CHARACTER_HEIGHT / NORMALIZED_CHARACTER_HEIGHT);
  standGroup.visible = false;
  scene.add(standGroup);

  const detectCanvas = document.createElement('canvas');
  const detectCtx = detectCanvas.getContext('2d', { willReadFrequently: true });
  const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });

  let camera = null;
  function layout() {
    const cw = containerEl.clientWidth || window.innerWidth;
    const ch = containerEl.clientHeight || window.innerHeight;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    renderer.setSize(vw, vh, false);
    renderer.setPixelRatio(1);
    coverLayout(video, cw, ch, vw, vh);
    coverLayout(renderer.domElement, cw, ch, vw, vh);
    // 검출은 원본 프레임 비율 그대로 다운샘플 — 초점거리(f)=검출 폭은 POSIT 관례(js-aruco 데모)
    detectCanvas.width = DETECT_W;
    detectCanvas.height = Math.round((DETECT_W * vh) / vw);
    // three 카메라 fov를 같은 핀홀 모델로 맞춘다 — 검출 공간과 렌더 공간이 1:1로 겹치게
    const fovY = 2 * Math.atan(detectCanvas.height / 2 / DETECT_W) * (180 / Math.PI);
    camera = new THREE.PerspectiveCamera(fovY, vw / vh, 0.01, 100);
    scene.add(camera);
  }
  layout();
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  const smoother = createPoseSmoother(0.25);
  const debugEnabled = !!testParam('posterDebug');
  if (debugEnabled) window.__posterState = { tracked: false, detections: 0, upDot: null, samples: [] };

  let tracked = false;
  let frameToggle = false;
  const camUp = new THREE.Vector3(0, 1, 0);
  const clock = new THREE.Clock();
  let stopped = false;

  renderer.setAnimationLoop(() => {
    if (stopped) return;
    frameToggle = !frameToggle;
    if (frameToggle && video.readyState >= 2) {
      const dw = detectCanvas.width;
      const dh = detectCanvas.height;
      detectCtx.drawImage(video, 0, 0, dw, dh);
      const markers = detector.detect(detectCtx.getImageData(0, 0, dw, dh));
      // 보이는 마커 전부의 꼭짓점(4~16점)을 한 호모그래피에 넣는다 — 마커별 POSIT의 평면
      // 2중 해 모호성(계측: 같은 평면인데 마커끼리 다른 법선) 제거. 좌표: 중심 원점·y 위쪽.
      const imagePts = [];
      const planePts = [];
      for (const m of markers) {
        const info = markerToCharacter(m.id);
        if (!info || info.key !== characterKey) continue;
        const plane = markerCornerPlanePoints(info.corner, POSTER_ASPECT);
        m.corners.forEach((c, i) => {
          imagePts.push({ x: c.x - dw / 2, y: dh / 2 - c.y });
          planePts.push(plane[i]);
        });
      }

      const nowTracked = imagePts.length >= 4;
      if (nowTracked) {
        const pose = smoother.push(poseFromPlanePoints(imagePts, planePts, DETECT_W));
        standGroup.visible = true;
        standGroup.position.copy(pose.position);
        // 기립: 업 = 포스터 평면 법선(카메라 쪽), 정면 = 카메라 방향의 평면 투영 — "딱 서 있게"
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
        if (n.z < 0) n.negate(); // 법선은 항상 카메라 쪽(+z)으로
        const toCam = pose.position.clone().negate(); // 카메라(원점) 방향
        const facing = toCam.sub(n.clone().multiplyScalar(toCam.dot(n)));
        if (facing.lengthSq() < 1e-8) facing.set(0, 0, 1);
        facing.normalize();
        const right = new THREE.Vector3().crossVectors(n, facing).negate().normalize();
        const basis = new THREE.Matrix4().makeBasis(right, n, facing);
        standGroup.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(basis), 0.35);

        if (debugEnabled) {
          const upDot = n.dot(camUp);
          window.__posterState.upDot = upDot;
          window.__posterState.samples.push(upDot);
          if (window.__posterState.samples.length > 30) window.__posterState.samples.shift();
          window.__posterState.pos = pose.position.toArray().map((v) => +v.toFixed(3));
          const ndc = pose.position.clone().project(camera);
          window.__posterState.ndc = [+ndc.x.toFixed(3), +ndc.y.toFixed(3)];
        }
      }
      // 미검출 프레임: 마지막 포즈 그대로 유지(사라지거나 튀지 않음) — 재검출 시 스무딩이 재스냅
      if (nowTracked !== tracked) {
        tracked = nowTracked;
        onTrackChange?.(tracked);
      }
      if (debugEnabled) {
        window.__posterState.tracked = tracked;
        window.__posterState.detections = imagePts.length / 4;
      }
    }
    const t = clock.getElapsedTime();
    character.position.y = Math.sin(t * 2.2) * 0.02; // 숨쉬기 대기 모션 (marker.js와 동일)
    if (camera) renderer.render(scene, camera);
  });

  return {
    stop() {
      stopped = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      stream.getTracks().forEach((tr) => tr.stop());
      containerEl.innerHTML = '';
    },
  };
}
