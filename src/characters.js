import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const BASE = import.meta.env.BASE_URL;

// fbx는 텍스처 경로를 "제작 PC의 절대경로"로 구워두는 일이 흔하다(raoni.fbx =
// `C:\Users\Administrator\raoni_texture-01.jpg`). FBXLoader는 그걸 모델 디렉토리 기준
// 상대경로로 이어붙여 요청하므로 배포본에서 항상 404가 난다(파일명만 남겨도 그 이름으로는
// 배포한 적이 없어 여전히 404다). 그래서 우리가 실제로 배포한 그 캐릭터의 텍스처로 돌린다 —
// 요청이 사라지고, 어차피 아래 머티리얼 규칙이 입히려던 것과 같은 이미지다.
export function rewriteBakedTexturePath(url, shippedTextureUrl) {
  const isAbsoluteOsPath = /(^|\/)[A-Za-z]:[\\/]/.test(url) || url.includes('\\');
  return isAbsoluteOsPath && shippedTextureUrl ? shippedTextureUrl : url;
}

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

// 3단 톤 그라데이션 (어두움→중간→밝음) — MeshToonMaterial 기본 2단보다 부드러운 경계
let toonGradient = null;
function getToonGradient() {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([140, 200, 255]), 3, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

// 기존 머티리얼의 색·텍스처·투명도만 승계해 무광 툰 머티리얼로 변환한다.
function toCuteToon(m) {
  const toon = new THREE.MeshToonMaterial({
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
    map: m.map ?? null,
    gradientMap: getToonGradient(),
    transparent: !!m.transparent,
    opacity: m.opacity ?? 1,
    side: m.side ?? THREE.FrontSide,
  });
  toon.vertexColors = !!m.vertexColors; // 정점색 보정 규칙(위)의 결과를 그대로 승계
  toon.name = m.name;
  return toon;
}

export async function loadCharacter(key) {
  const assets = CHARACTER_ASSETS[key];
  if (!assets) {
    console.warn(`알 수 없는 캐릭터 키: ${key}`);
    return null;
  }

  try {
    // fbx에 구워진 제작 PC 절대경로(예: raoni.fbx의 C:\Users\Administrator\raoni_texture-01.jpg)를
    // FBXLoader가 그대로 요청해 매번 404를 낸다 — 아래 머티리얼 규칙이 결과적으로 외부 텍스처로
    // 교체해 화면은 정상이지만, 요청 자체를 없애 프로덕션 콘솔 에러를 남기지 않는다.
    const manager = new THREE.LoadingManager();
    const shippedTexture = `${BASE}models/${Object.values(assets.textures)[0]}`;
    manager.setURLModifier((url) => rewriteBakedTexturePath(url, shippedTexture));
    const fbx = await new FBXLoader(manager).loadAsync(`${BASE}models/${assets.model}`);

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

        // 부드러운 셀 셰이딩(MeshToonMaterial) 변환 — 광택 하이라이트("번들거림")를 원천 제거하고
        // 만화풍의 귀여운 톤으로. 3단 그라데이션 맵으로 명암 경계를 부드럽게 한다.
        // (털 셰이더 같은 고부하 효과 없이 Phong보다 가벼움 — 2026-07-20 사용자 피드백)
        m = toCuteToon(m);

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
