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
 * @param {{ containerEl: HTMLElement, onTarget: (key: string) => void,
 *   onHoldChange?: (tracked: boolean) => void }} opts
 * @returns {Promise<{ confirmSummon(key: string): void, stop(): void }>}
 */
export async function initMarker({ containerEl, onTarget, onHoldChange }) {
  const mindarThree = new MindARThree({
    container: containerEl,
    imageTargetSrc: TARGET_SRC,
    maxTrack: 3,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
    // 트래킹 지터 완화 — 기본값보다 강한 스무딩 (카드 위 미세 떨림 감소, 실기기 피드백 2026-07-20)
    filterMinCF: 0.0001,
    filterBeta: 0.001,
  });
  const { renderer, scene, camera } = mindarThree;

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  // 카드가 "세워져" 있으면(모니터에 띄우기 등) 카드 위쪽(Y)으로, "눕혀져" 있으면(바닥·테이블)
  // 카드 면에서 수직(Z)으로 일어서도록 자동 전환한다 — 바닥 카드에서 캐릭터가 누워 보이는
  // 문제(실기기 피드백 2026-07-20) 해결. 두 자세 사이는 slerp로 부드럽게 전환.
  const ZERO_VEC = new THREE.Vector3(0, 0, 0);
  const QUAT_UPRIGHT = new THREE.Quaternion(); // 카드 Y = 캐릭터 위 (세워진 카드)
  const QUAT_STANDING = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); // 카드 법선 = 캐릭터 위 (눕힌 카드)

  const entries = [];
  for (const [key, targetIndex] of Object.entries(TARGET_INDEX)) {
    const anchor = mindarThree.addAnchor(targetIndex);
    const loader = CHARACTER_LOADERS[key];
    let character = loader ? await loader() : null;
    if (!character) character = createPlaceholderCharacter(PLACEHOLDER_COLORS[key] ?? 0xffffff);
    const standGroup = new THREE.Group(); // 기립 방향 전용 래퍼 — 숨쉬기 모션(character 로컬)과 분리
    standGroup.add(character);
    anchor.group.add(standGroup);
    anchor.onTargetFound = () => onTarget?.(key);
    entries.push({ key, character, standGroup, anchor });
  }

  await mindarThree.start();

  // 소환 확정 상태 — confirmSummon(key) 이후: 해당 캐릭터는 트래킹 로스트에도 사라지지 않고
  // 카메라 앞에 유지되다가(Object3D.attach로 월드 변환 보존 재부모화) 카드 재인식 시 다시 붙는다.
  // 나머지 캐릭터는 앵커에서 제거해 "다른 카드 인식" 혼선을 차단한다. (부착감 계획 Task A)
  let confirmedKey = null;
  let lastTracked = true; // 확정 시점엔 카드가 방금 인식된 상태 — 첫 프레임 스퓨리어스 알림 방지
  const HOLD_POS = new THREE.Vector3(0, -0.35, -2.2); // 카메라 공간 유지 위치 (화면 하단 중앙쯤)

  const clock = new THREE.Clock();
  const worldQuat = new THREE.Quaternion();
  const cardUp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    for (const { key, character, standGroup, anchor } of entries) {
      if (confirmedKey && key !== confirmedKey) continue; // 소환 안 된 캐릭터는 확정 후 무시(제거됨)

      if (confirmedKey === key) {
        const tracked = anchor.group.visible;
        if (tracked !== lastTracked) {
          lastTracked = tracked;
          onHoldChange?.(tracked);
        }
        if (tracked && standGroup.parent !== anchor.group) {
          anchor.group.attach(standGroup); // 월드 변환 보존한 채 카드로 복귀 → 아래 lerp로 스냅
        } else if (!tracked && standGroup.parent !== camera) {
          camera.attach(standGroup); // 카드 놓침 → 화면(카메라 공간)에 유지
        }
        if (tracked) {
          standGroup.position.lerp(ZERO_VEC, 0.15); // 카드 원점으로 부드럽게 스냅
        } else {
          standGroup.position.lerp(HOLD_POS, 0.08);
          standGroup.quaternion.slerp(QUAT_UPRIGHT, 0.08); // 화면 유지 중엔 똑바로
        }
      }

      if (anchor.group.visible) {
        // 카드의 Y축(카드 위쪽)이 카메라 상향과 얼마나 정렬돼 있나 — 정렬(≈1)이면 세워진 카드,
        // 수직(≈0)이면 눕힌 카드. 0.55를 경계로 목표 자세를 정하고 부드럽게 수렴시킨다.
        anchor.group.getWorldQuaternion(worldQuat);
        cardUp.set(0, 1, 0).applyQuaternion(worldQuat);
        const uprightness = cardUp.y; // MindAR world = 카메라 공간 (카메라 up = +Y)
        standGroup.quaternion.slerp(uprightness > 0.55 ? QUAT_UPRIGHT : QUAT_STANDING, 0.12);
      }
      character.position.y = Math.sin(t * 2.2) * 0.02; // 카드 위에서 살짝 숨쉬듯 대기 모션
      character.rotation.y = Math.sin(t * 0.9) * 0.18;
    }
    renderer.render(scene, camera);
  });

  return {
    // 소환 확정 — key 캐릭터만 남기고, 이후 로스트/재인식 유지·스냅 동작 활성화
    confirmSummon(key) {
      confirmedKey = key;
      for (const e of entries) {
        if (e.key !== key) e.standGroup.removeFromParent();
      }
    },
    stop() {
      renderer.setAnimationLoop(null);
      mindarThree.stop();
    },
  };
}
