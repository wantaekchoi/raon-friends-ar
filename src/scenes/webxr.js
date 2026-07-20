import * as THREE from 'three';
import { createGroundShadow, createPlaceholderCharacter } from './overlay.js';

// characters.js가 모델을 항상 1.2유닛 높이로 정규화하므로, 이를 기준 삼아 characterHeight(m)를
// 배치 스케일 배율로 환산한다 (overlay.js의 BASE_HEIGHT와 동일한 기준).
const BASE_HEIGHT = 1.2;

// navigator.xr가 아예 없거나 isSessionSupported가 거부하는 기기(iOS 등)는 즉시 false —
// 호출부는 이 결과로 진입 버튼 자체를 숨겨 프로그레시브 인핸스먼트를 유지한다.
export async function isXRSupported() {
  try {
    if (!navigator.xr) return false;
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

// 바닥 감지 지점을 표시하는 고리형 레티클. 배치 전/후 모두 계속 갱신해
// 사용자가 원하면 다른 위치를 다시 탭해 캐릭터를 옮길 수 있게 한다.
function createReticle() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.matrixAutoUpdate = false; // 위치는 hit-test pose 행렬을 매 프레임 직접 대입
  ring.visible = false;
  return ring;
}

// { character, overlayRoot, onPlaced, onEnd } — character는 이미 로드된 Object3D(Group).
// overlayRoot는 dom-overlay로 그대로 노출할 기존 DOM 루트(#screen-ar) — 말풍선/버튼이
// XR 패스스루 위에 그대로 보이게 한다. 지원되지 않거나 세션 시작에 실패하면 null을 반환한다.
export async function startXR({
  character,
  overlayRoot,
  onPlaced,
  onEnd,
  characterHeight = 1.2,
} = {}) {
  if (!(await isXRSupported())) return null;

  // E1 자이언트 스케일: 배치 시 캐릭터를 characterHeight(m)에 맞는 배율로 키운다.
  const heightScale = characterHeight / BASE_HEIGHT;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.id = 'xr-canvas';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  const reticle = createReticle();
  scene.add(reticle);

  let pendingCharacter = character || createPlaceholderCharacter();
  let placedCharacter = null;
  let shadow = null;
  let entranceT = null;
  const clock = new THREE.Clock();

  function placeAt(matrix) {
    if (placedCharacter) {
      scene.remove(placedCharacter);
      scene.remove(shadow);
      // 재배치 때마다 새 그림자를 만들므로 이전 것은 GPU 리소스까지 해제 (누수 방지)
      shadow.material.map?.dispose();
      shadow.material.dispose();
      shadow.geometry.dispose();
    }
    placedCharacter = pendingCharacter;

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    matrix.decompose(pos, quat, scl);

    placedCharacter.position.set(pos.x, pos.y, pos.z);
    placedCharacter.scale.setScalar(0);
    scene.add(placedCharacter);

    shadow = createGroundShadow(pos);
    scene.add(shadow);

    entranceT = performance.now();
    onPlaced?.();
  }

  function onSelect() {
    if (reticle.visible) placeAt(reticle.matrix);
  }

  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  let hitTestSource = null;
  let hitTestSourceRequested = false;

  function render(_time, frame) {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      // hit-test source는 세션당 한 번만 요청 (three.js 공식 webxr_ar_hittest 예제 패턴)
      if (!hitTestSourceRequested) {
        session.requestReferenceSpace('viewer').then((viewerSpace) => {
          session.requestHitTestSource({ space: viewerSpace }).then((source) => {
            hitTestSource = source;
          });
        });
        session.addEventListener('end', () => {
          hitTestSourceRequested = false;
          hitTestSource = null;
        });
        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const results = frame.getHitTestResults(hitTestSource);
        if (results.length) {
          const pose = results[0].getPose(referenceSpace);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          reticle.visible = false;
        }
      }
    }

    const t = clock.getElapsedTime();
    // 레티클 펄스 애니메이션 — 바닥 감지 중임을 알리는 시각 단서
    const pulse = 1 + Math.sin(t * 3.2) * 0.08;
    reticle.scale.setScalar(pulse);

    if (placedCharacter && entranceT !== null) {
      const p = Math.min((performance.now() - entranceT) / 700, 1);
      const bounce = 1 - Math.pow(1 - p, 3); // ease-out
      placedCharacter.scale.setScalar(bounce * heightScale);
      shadow.material.opacity = p;
      shadow.scale.setScalar((0.3 + 0.7 * bounce) * heightScale);
      if (p >= 1) entranceT = null;
    } else if (placedCharacter) {
      placedCharacter.rotation.y = Math.sin(t * 0.9) * 0.15;
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  let ended = false;
  function cleanup() {
    if (ended) return;
    ended = true;
    window.removeEventListener('resize', onResize);
    renderer.setAnimationLoop(null);
    renderer.domElement.remove();
    renderer.dispose();
    document.body.classList.remove('xr-active');
  }

  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlayRoot },
    });
  } catch (e) {
    console.warn('WebXR 세션 시작 실패 — 오버레이 모드로 유지', e);
    renderer.dispose();
    return null;
  }

  // 세션 종료(뒤로가기, 시스템 제스처 등) — 항상 오버레이 모드 복귀로 이어져야 하므로
  // cleanup 이후 onEnd를 호출한다.
  session.addEventListener('end', () => {
    cleanup();
    onEnd?.();
  });

  document.body.classList.add('xr-active'); // #camera-video 등 기존 오버레이 캔버스를 숨김
  document.getElementById('screen-ar').appendChild(renderer.domElement);

  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  renderer.setAnimationLoop(render);

  return {
    // 배턴터치(다음 화자)로 캐릭터가 바뀔 때: 이미 배치됐다면 같은 위치에서 교체 + 재등장,
    // 아직 배치 전이면 다음 탭 때 놓일 캐릭터만 갱신한다.
    setCharacter(obj3d) {
      pendingCharacter = obj3d;
      if (placedCharacter) {
        const pos = placedCharacter.position.clone();
        scene.remove(placedCharacter);
        placedCharacter = obj3d;
        placedCharacter.position.copy(pos);
        placedCharacter.scale.setScalar(heightScale); // 이미 배치된 상태로 교체 — 자이언트 배율 유지
        scene.add(placedCharacter);
      }
    },
    playEntrance() {
      if (!placedCharacter) return; // 아직 바닥에 놓기 전이면 재생할 등장 애니메이션이 없음
      entranceT = performance.now();
    },
    end() {
      session.end();
    },
  };
}
