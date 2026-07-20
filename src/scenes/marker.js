import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { loadCharacter } from '../characters.js';

const BASE = import.meta.env.BASE_URL;
const TARGET_SRC = `${BASE}targets/cards.mind`;

// cards.mind 컴파일 순서 = 카드 디자인 배열 순서 그대로 (docs/marker-setup.md 참고).
// 인덱스가 바뀌면 반드시 이 매핑도 같이 바꿀 것.
const TARGET_INDEX = { raong: 0, raoni: 1, raona: 2 };

const CHARACTER_LOADERS = {
  raong: () => loadCharacter('raong'),
  raoni: () => loadCharacter('raoni'),
  raona: () => loadCharacter('raona'),
};

const PLACEHOLDER_COLORS = { raong: 0xff7a1a, raoni: 0x5b5bd6, raona: 0x159981 };

function createPlaceholderCharacter(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.2, 8, 16),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.22;
  g.add(body);
  return g;
}

/**
 * 카드 마커 모드 초기화. cards.mind의 타깃 3개(raong/raoni/raona)에 각각 캐릭터를 앵커로 붙이고,
 * 카드가 인식되면 onTarget(key)을 호출한다.
 *
 * @param {{ containerEl: HTMLElement, onTarget: (key: string) => void }} opts
 * @returns {Promise<{ stop(): void }>}
 */
export async function initMarker({ containerEl, onTarget }) {
  const mindarThree = new MindARThree({
    container: containerEl,
    imageTargetSrc: TARGET_SRC,
    maxTrack: 3,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });
  const { renderer, scene, camera } = mindarThree;

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  const entries = [];
  for (const [key, targetIndex] of Object.entries(TARGET_INDEX)) {
    const anchor = mindarThree.addAnchor(targetIndex);
    const loader = CHARACTER_LOADERS[key];
    let character = loader ? await loader() : null;
    if (!character) character = createPlaceholderCharacter(PLACEHOLDER_COLORS[key] ?? 0xffffff);
    anchor.group.add(character);
    anchor.onTargetFound = () => onTarget?.(key);
    entries.push({ key, character });
  }

  await mindarThree.start();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    for (const { character } of entries) {
      character.position.y = Math.sin(t * 2.2) * 0.02; // 카드 위에서 살짝 숨쉬듯 대기 모션
      character.rotation.y = Math.sin(t * 0.9) * 0.18;
    }
    renderer.render(scene, camera);
  });

  return {
    stop() {
      renderer.setAnimationLoop(null);
      mindarThree.stop();
    },
  };
}
