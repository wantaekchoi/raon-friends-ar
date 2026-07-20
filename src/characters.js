import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const BASE = import.meta.env.BASE_URL;

// 캐릭터별 fbx·텍스처 매핑. pickTexture(name)은 메시/머티리얼 이름으로 어떤 텍스처를
// 매칭할지 결정한다 (라옹은 얼굴/주사기 2장을 이름 패턴으로 구분, 라오니·라오나는 단일 텍스처).
const CHARACTER_ASSETS = {
  raong: {
    model: 'raong.fbx',
    textures: { face: 'raong_face.jpg', syringe: 'raong_syringe.jpg' },
    pickTexture: (name) => (/cylinder|syringe/i.test(name) ? 'syringe' : 'face'),
  },
  raoni: {
    model: 'raoni.fbx',
    textures: { main: 'raoni_tex.jpg' },
    pickTexture: () => 'main',
  },
  raona: {
    model: 'raona.fbx',
    textures: { main: 'raona_tex.jpg' },
    pickTexture: () => 'main',
    // raona_tex.jpg는 배경이 순백이라 깨진 스킨 머티리얼에 그대로 입히면 얼굴이 하얗게 뜬다.
    // 라오니 텍스처의 피부 배경색(#fdd6b9)을 순색으로 적용해 두 캐릭터 피부톤을 맞춘다.
    solidColorFor: { pattern: /skin/i, color: 0xfdd6b9 },
  },
};

export async function loadCharacter(key) {
  const assets = CHARACTER_ASSETS[key];
  if (!assets) {
    console.warn(`알 수 없는 캐릭터 키: ${key}`);
    return null;
  }

  try {
    const fbx = await new FBXLoader().loadAsync(`${BASE}models/${assets.model}`);

    const texLoader = new THREE.TextureLoader();
    const textures = {};
    Object.entries(assets.textures).forEach(([texKey, file]) => {
      const tex = texLoader.load(`${BASE}models/${file}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures[texKey] = tex;
    });

    fbx.traverse((child) => {
      if (!child.isMesh) return;
      const hasColorAttr = !!child.geometry.attributes.color;
      const isArrayMat = Array.isArray(child.material);
      const mats = isArrayMat ? child.material.slice() : [child.material];

      mats.forEach((orig, i) => {
        let m = orig;

        // 머티리얼이 vertexColors:true인데 지오메트리에 color 속성이 없으면
        // WebGL이 정점색 attribute 기본값(0,0,0)을 곱해 순백/주황 머티리얼도 검정으로 렌더된다.
        // (라옹의 head001/head 메시가 이 케이스 — body3/body3001은 동일 이름 머티리얼을 "공유"하지만
        // 실제 흰색 정점색 데이터를 갖고 있어 정상 렌더됨. 공유 인스턴스를 직접 끄면 그쪽까지
        // 바뀌므로 이 메시 전용 clone에만 적용한다.)
        if (m.vertexColors && !hasColorAttr) {
          m = m.clone();
          m.vertexColors = false;
          m.needsUpdate = true;
        }

        // fbx 내부에 맵 참조는 있으나 실제 이미지가 로드되지 않는(임베디드 깨짐) 경우에만
        // 외부 텍스처로 교체한다. 순색 머티리얼(맵 없음)은 건드리지 않는다.
        const isBrokenMap = m.map && !m.map.image;
        if (isBrokenMap) {
          if (m === orig) m = m.clone();
          const matchName = `${m.name} ${child.name}`;
          const solid = assets.solidColorFor;
          if (solid && solid.pattern.test(matchName)) {
            // 텍스처 대신 순색 — 배경색이 잘못 얹히는 머티리얼용 (예: 라오나 피부)
            m.map = null;
            m.color = new THREE.Color(solid.color);
          } else {
            m.map = textures[assets.pickTexture(matchName)];
          }
          m.needsUpdate = true;
        }

        // 광택 감소 — 동물 fur 무광 느낌 (라옹·라오니·라오나 3캐릭터 공통).
        // FBXLoader는 재질에 따라 MeshPhongMaterial(shininess/specular) 또는
        // MeshStandardMaterial(roughness/metalness)을 만들 수 있어 둘 다 처리한다.
        if ('shininess' in m) {
          if (m === orig) m = m.clone();
          m.shininess = Math.min(m.shininess, 8);
          if (m.specular) m.specular = new THREE.Color(0x111111);
          m.needsUpdate = true;
        } else if ('roughness' in m) {
          if (m === orig) m = m.clone();
          m.roughness = Math.max(m.roughness, 0.9);
          m.metalness = Math.min(m.metalness, 0.05);
          m.needsUpdate = true;
        }

        mats[i] = m;
      });

      child.material = isArrayMat ? mats : mats[0];
    });

    // 크기 정규화: 캐릭터 높이를 1.2 유닛으로, 발바닥을 y=0에
    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.2 / size.y;
    fbx.scale.setScalar(scale);
    box.setFromObject(fbx);
    fbx.position.y -= box.min.y;

    const group = new THREE.Group();
    group.add(fbx);
    return group;
  } catch (e) {
    console.warn(`${key} fbx 로드 실패 — 임시 캐릭터 유지`, e);
    return null;
  }
}

export async function loadRaong() {
  return loadCharacter('raong');
}
