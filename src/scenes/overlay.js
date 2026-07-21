import * as THREE from 'three';
import { createMotionEngine } from '../motion.js';
import { createEffects } from '../effects.js';

// 캐릭터가 서 있는 지면 위치 — 카메라(사용자) 1.8m 앞 바닥 (기본 characterHeight=1.2 기준)
export const CHAR_POS = new THREE.Vector3(0, 0, -2.7);

// characters.js가 모델을 항상 1.2유닛 높이로 정규화하므로, 이를 기준 삼아 characterHeight(m)를
// 그룹 스케일 배율로 환산한다. E1: 기본 1.2 · life 1.8 · giant 2.5.
const BASE_HEIGHT = 1.2;

// characterHeight(m) → 카메라와 캐릭터 사이 거리(m). 세 프리셋을 선형 보간하고, 범위 밖 값은
// 인접 구간의 기울기로 외삽한다.
// ⚠️ 거리 증가를 완만하게 유지할 것 — 원래 프로파일(2.7→3.5→4.5)은 커진 만큼 멀어져 화면상
// 각크기 차이가 27%뿐이라 "사이즈 옵션이 전혀 안 먹는다"는 실기기 피드백(2026-07-21 ⑤)이
// 나왔다. 1차 완화(2.7→3.0→3.2, 자이언트 1.75배)도 '거의 비슷하다'는 실기기 재피드백을 받아 거리를
// 사실상 고정하고 자이언트 키 자체를 3.2m로 올렸다(화면상 약 2.5배, 올려다봐야 얼굴이 보이는
// 연출이 의도).
function distanceForHeight(h) {
  const points = [
    { h: 1.2, d: 2.7 },
    { h: 1.8, d: 2.9 },
    { h: 3.2, d: 2.9 },
  ];
  if (h <= points[0].h) return points[0].d;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      return a.d + (b.d - a.d) * t;
    }
  }
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const slope = (b.d - a.d) / (b.h - a.h);
  return b.d + slope * (h - b.h);
}

async function startCamera(videoEl, facingMode = 'environment') {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return true;
  } catch {
    document.body.classList.add('no-camera');
    return false;
  }
}

// iOS 13+는 자이로 접근에 명시적 권한 필요 — 사용자 제스처 컨텍스트 안에서 호출해야 함
async function requestGyroPermission() {
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      return (await DeviceOrientationEvent.requestPermission()) === 'granted';
    }
    return 'DeviceOrientationEvent' in window;
  } catch {
    return false;
  }
}

// 부드러운 원형 접지 그림자 — "바닥에 서 있다"는 느낌의 핵심 단서
// pos: 그림자를 배치할 지면 좌표 (기본값은 자이로 오버레이의 고정 캐릭터 위치).
// WebXR hit-test 모드(webxr.js)는 감지된 임의의 바닥 좌표를 넘겨 재사용한다.
export function createGroundShadow(pos = CHAR_POS) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, 0.005, pos.z);
  return mesh;
}

export function createPlaceholderCharacter() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.45, 8, 16), white);
  body.position.y = 0.55;
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), white);
  earL.position.set(-0.22, 1.05, 0);
  const earR = earL.clone();
  earR.position.x = 0.22;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), orange);
  belly.position.set(0, 0.45, 0.3);

  g.add(body, earL, earR, belly);
  return g;
}

export async function initOverlay({
  videoEl,
  canvasEl,
  characterHeight = 1.2,
  cameraFacing = 'environment',
  gyroAllowed: gyroAllowedOpt,
  // 자이로 구독원 — 기본값은 실기기 window 이벤트. 헤드리스 E2E(S7)가 가짜 방향 이벤트를 주입할
  // 수 있도록 main.js/entry.js가 대체 provider(cb 노출형)를 넘길 수 있다(Task 11). 미지정 시
  // 동작은 기존과 완전히 동일하다.
  orientationProvider,
  // true면 camera.quaternion 참조를 window.__overlayCameraQuat로 노출한다 — 헤드리스 E2E 전용
  // 디버그 훅(Task 11 S7). 기본 false: 프로덕션 경로에는 아무 영향 없다.
  exposeCameraQuat = false,
  // 쇼케이스 모드(2026-07-21): 카메라·자이로 없이 고정 그라데이션 배경에서 캐릭터를 보여준다 —
  // 기존 no-camera 폴백 경로(검증됨)를 정식 경로로 승격. AR은 카드·Quick Look·WebXR가 담당.
  showcase = false,
}) {
  // iOS 자이로 권한은 사용자 제스처 안에서만 요청 가능 — 소환/인식 등 비제스처 경로로 진입할 땐
  // main.js가 첫 탭 순간에 미리 받아둔 결과(gyroAllowedOpt)를 넘겨준다. 없으면 여기서 직접 요청.
  const gyroAllowed = showcase
    ? false
    : (gyroAllowedOpt !== undefined ? gyroAllowedOpt : await requestGyroPermission());
  if (showcase) {
    document.body.classList.add('no-camera'); // 그라데이션 배경 (기존 폴백 스타일 재사용)
  } else {
    await startCamera(videoEl, cameraFacing);
  }

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);

  // E1 자이언트 스케일: characterHeight(m)에 맞춰 배치 거리·구도를 함께 조정한다.
  const heightScale = characterHeight / BASE_HEIGHT;
  const charPos = new THREE.Vector3(0, 0, -distanceForHeight(characterHeight));
  const lookAtY = characterHeight * (0.5 / BASE_HEIGHT); // 기존 1.2m 기준 lookAt(0.5) 비율 유지

  // 눈높이에서 캐릭터를 살짝 내려다보는 구도 (자이로 폴백용 기본 시점)
  camera.position.set(0, 1.4, 0);
  camera.lookAt(charPos.x, lookAtY, charPos.z);

  // 헤드리스 E2E 전용 디버그 훅(Task 11 S7) — fakeGyro 모드에서만 main.js/entry.js가 true로
  // 넘긴다. 실제 값이 아닌 Quaternion 참조를 노출해 이후 회전이 반영되는 대로 최신값을 읽는다.
  if (exposeCameraQuat) {
    window.__overlayCameraQuat = camera.quaternion;
  }

  // 자이로 시점: 기기 방향에 카메라를 고정해 캐릭터가 실제 공간에 붙어있는 느낌 (포켓몬GO식)
  if (gyroAllowed) {
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const qScreen = new THREE.Quaternion();
    const qWorld = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    let alphaOffset = null; // 첫 측정 방위를 "정면"으로 삼아 캐릭터가 항상 눈앞에서 시작

    function handleOrientation(e) {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const alpha = THREE.MathUtils.degToRad(e.alpha);
      if (alphaOffset === null) alphaOffset = alpha;
      const beta = THREE.MathUtils.degToRad(e.beta);
      const gamma = THREE.MathUtils.degToRad(e.gamma);
      const orient = THREE.MathUtils.degToRad(
        (screen.orientation && screen.orientation.angle) || 0,
      );
      euler.set(beta, alpha - alphaOffset, -gamma, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      camera.quaternion.multiply(qWorld);
      camera.quaternion.multiply(qScreen.setFromAxisAngle(zee, -orient));
    }

    (orientationProvider ?? ((cb) => window.addEventListener('deviceorientation', cb)))(handleOrientation);
  }

  // 스튜디오 조명(레트로 툰 시안 2026-07-21) — 평평한 Ambient(1.2)+Dir(1.6)이 톤 램프를 날려
  // 입체감이 죽던 것을, 반구광(따뜻한 위/차가운 아래)+키+쿨 필로 교체. 5단 램프와 세트다.
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x33405c, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(1.4, 3, 2.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.32);
  fillLight.position.set(-2.2, 1.0, -1.0);
  scene.add(fillLight);

  const shadow = createGroundShadow(charPos);
  scene.add(shadow);

  // charRoot: characterHeight 배율 전용 래퍼 — motion.js가 character 자체의 scale/rotation을
  // 절대값으로 덮어쓰기 때문에(예: idle의 scale.set(1,1,1)) 자이언트 배율은 반드시 이 바깥 그룹에
  // 둬야 모션 재생 중에도 크기가 유지된다. character는 항상 charRoot 기준 원점(unit scale)에 산다.
  const charRoot = new THREE.Group();
  charRoot.position.copy(charPos);
  charRoot.scale.setScalar(heightScale);
  scene.add(charRoot);

  let character = createPlaceholderCharacter();
  charRoot.add(character);

  const motion = createMotionEngine();
  motion.attach(character);

  const effects = createEffects(scene);

  // 캐릭터 로컬 좌표(대략 가슴 높이)를 charRoot의 현재 변환으로 월드 좌표화해 파티클을 터뜨린다.
  function burst(type) {
    const origin = new THREE.Vector3(0, 0.65, 0.15);
    charRoot.localToWorld(origin);
    effects.burst(type, origin);
  }

  // 캐릭터 쓰다듬기: canvas 탭 → 레이캐스트로 charRoot 히트 검사 → 히트 시 wiggle + 하트 burst.
  // 가이드 진행(다음 버튼)은 별도 DOM 버튼이라 간섭하지 않는다.
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  canvasEl.addEventListener('pointerdown', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(charRoot, true);
    if (hits.length) {
      motion.play('wiggle');
      burst('heart');
    }
  });

  let entranceT = null; // 등장 애니메이션 시작 시각(ms)
  const clock = new THREE.Clock();
  let running = true; // WebXR hit-test 모드 진입 시 pause()로 배경 렌더링을 멈춘다

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (entranceT !== null) {
      const p = Math.min((performance.now() - entranceT) / 700, 1);
      const bounce = 1 - Math.pow(1 - p, 3); // ease-out
      character.scale.setScalar(bounce);
      character.position.y = (1 - bounce) * 1.2; // 위에서 내려와 바닥에 착지
      shadow.material.opacity = p;
      shadow.scale.setScalar((0.3 + 0.7 * bounce) * heightScale);
      if (p >= 1) entranceT = null;
    } else {
      motion.update(t);
    }
    effects.update(t);
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    setCharacter(obj3d) {
      charRoot.remove(character);
      character = obj3d;
      character.position.set(0, 0, 0);
      charRoot.add(character);
      motion.attach(character);
    },
    playEntrance() {
      character.scale.setScalar(0);
      entranceT = performance.now();
    },
    // WebXR hit-test 모드 진입/복귀 시 배경 렌더 루프를 멈추고/재개한다 (GPU 절약, 캔버스 충돌 방지).
    pause() {
      running = false;
    },
    resume() {
      if (running) return;
      running = true;
      animate();
    },
    playMotion(name) {
      motion.play(name);
    },
    burst(type) {
      burst(type);
    },
    // 체험 종료 시 카메라 스트림을 해제한다 (getUserMedia track.stop()).
    stopCamera() {
      const stream = videoEl.srcObject;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach((track) => track.stop());
      }
      videoEl.srcObject = null;
    },
  };
}
