import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = import.meta.env.BASE_URL;

// fbx에는 제작 PC에서 구워진 텍스처 경로가 남아 있다(raoni.fbx의 `C:\Users\Administrator\
// raoni_texture-01.jpg`, raona.fbx의 `\raoni_texture-01.jpg`). FBXLoader는 이 경로를 URL 수정자에
// 넘기기 **전에** 파일명만 남기도록 정규화하므로(FBXLoader.js: `split('\\').pop()`), 백슬래시·드라이브
// 문자를 검사하는 방식으로는 절대 걸러낼 수 없고 배포본에서 매번 404가 난다.
//
// 그렇다고 실존 파일로 돌리면 안 된다 — 아래 머티리얼 규칙이 "로드에 실패한 맵"을 보고 외부
// 텍스처·순색(라오나 피부)으로 교체하는데, 요청이 성공해버리면 그 규칙이 꺼져 외형이 깨진다.
// 그래서 배포 파일 목록(화이트리스트) 밖의 요청은 네트워크 대신 1×1 데이터 URI(센티널)로 보낸다:
// 404도 안 나고, 규칙은 센티널을 '깨진 맵'으로 간주해 이전과 동일하게 동작한다.
export const BROKEN_TEXTURE_SENTINEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// public/models/에 실제로 배포된 파일 전부 — 여기 없는 이름을 fbx가 요청하면 센티널로 보낸다.
// (파일을 추가·삭제하면 이 목록도 같이 갱신할 것.)
const SHIPPED_MODEL_FILES = new Set([
  'raong.fbx', 'raoni.fbx', 'raona.fbx',
  'raong_face.jpg', 'raong_syringe.jpg', 'raong_face_tail_texture-01-01.jpg',
  'raoni_tex.jpg', 'raona_tex.jpg',
]);

export function resolveModelAssetUrl(url, shippedFiles = SHIPPED_MODEL_FILES) {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url; // 임베디드 텍스처는 그대로
  const fileName = url.split(/[\\/]/).pop();
  return shippedFiles.has(fileName) ? url : BROKEN_TEXTURE_SENTINEL;
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
    // 5단 하프램버트식 램프(120~255) — 3단(140,200,255)은 밝은 조명에서 어두운 단이 아예 안 떠
    // 입체감이 죽었다("비닐 인형" 진단, 레트로 툰 시안 2026-07-21). 최저 단을 120으로 띄워
    // TF2 하프램버트처럼 어두운 면도 죽지 않게 한다.
    toonGradient = new THREE.DataTexture(new Uint8Array([120, 160, 195, 225, 255]), 5, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

// 인버티드 헐 외곽선(젤다 바람의 지휘봉·무쌍류) — 법선 방향으로 부풀린 뒷면 메시가 잉크 라인이
// 된다. 두께는 뷰 공간에서 거리(-mv.z)에 비례시켜 화면상 일정 굵기로 유지한다 — 오버레이(거리
// ~2.7유닛)와 마커(픽셀 단위, 거리 ~1300)처럼 월드 스케일이 전혀 다른 씬에서 같은 룩이 나온다.
// OUTLINE_THICKNESS는 시안 검증값 0.0075(거리 2.7 기준)를 거리 비례로 환산한 것.
const OUTLINE_THICKNESS = 0.0028;
let outlineMaterial = null;
function getOutlineMaterial() {
  if (!outlineMaterial) {
    outlineMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { thickness: { value: OUTLINE_THICKNESS }, oColor: { value: new THREE.Color(0x2a2018) } },
      vertexShader: `uniform float thickness;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          mv.xyz += n * thickness * max(-mv.z, 0.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 oColor; void main() { gl_FragColor = vec4(oColor, 1.0); }`,
    });
  }
  return outlineMaterial;
}

// 눈처럼 새까만 부위는 헐에서 제외한다 — 눈은 별도 메시가 아니라 얼굴 메시의 black(#020202)
// 머티리얼 그룹이라, 헐이 눈 돌출부까지 부풀리면 쩜눈 둘레에 검은 테가 생겨 눈이 커지고 뭉개져
// 보인다("눈이 징그럽다" 실기기 피드백 2026-07-21). 애초에 검정·네이비 면 위 잉크선은 대비가
// 없어 안 보이므로, 초저휘도 그룹을 빼도 실루엣 말고는 잃는 게 없다.
const OUTLINE_SKIP_LUMA = 0.08;
function isInkDark(material) {
  const c = material?.color;
  if (!c) return false;
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) < OUTLINE_SKIP_LUMA;
}

// 비인덱스드 FBX 지오메트리에서 특정 그룹 구간만 잘라낸다 (usdz-export.html의 sliceGeometry와 동일 기법)
function sliceGroupRange(src, start, count) {
  const geom = new THREE.BufferGeometry();
  Object.entries(src.attributes).forEach(([name, attr]) => {
    const arr = attr.array.slice(start * attr.itemSize, (start + count) * attr.itemSize);
    geom.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize, attr.normalized));
  });
  return geom;
}

// 캐릭터의 각 메시에 외곽선 헐을 자식으로 붙인다. 지오메트리는 정점 용접 후 법선 재계산 —
// FBX의 하드엣지 분할 정점 그대로면 외곽선이 모서리에서 갈라진다. 스킨 속성은 떼어내므로
// 스켈레탈 1본 변형(wave 등)은 못 따라가지만 두께가 얇아 어긋남이 경미하다(시안 노트).
function addToonOutline(group) {
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let g;
    if (Array.isArray(mesh.material) && mesh.geometry.groups?.length) {
      // 멀티 머티리얼: 잉크선을 그릴 그룹(밝은 면)만 이어붙여 헐 지오메트리를 만든다
      const parts = mesh.geometry.groups
        .filter((grp) => !isInkDark(mats[grp.materialIndex] ?? mats[0]))
        .map((grp) => sliceGroupRange(mesh.geometry, grp.start, grp.count));
      if (!parts.length) continue;
      g = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    } else {
      if (isInkDark(mats[0])) continue;
      g = mesh.geometry.clone();
    }
    ['skinIndex', 'skinWeight', 'color', 'uv', 'uv2'].forEach((a) => g.deleteAttribute(a));
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();
    const hull = new THREE.Mesh(g, getOutlineMaterial());
    hull.name = 'toonOutline'; // usdz 내보내기 등에서 외곽선 헐을 걸러낼 때 쓰는 식별자
    hull.frustumCulled = false;
    mesh.add(hull); // 부모 메시와 로컬 공간 동일 — 그룹 변환·모션을 그대로 따라간다
  }
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
    // 배포 목록 밖 텍스처 요청(fbx에 구워진 제작 PC 경로 등)을 센티널로 보낸다 — 위 상수 주석 참고.
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(resolveModelAssetUrl);
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
        // 센티널(배포 목록 밖 요청의 대체 이미지)은 로드 성공 여부와 무관하게 항상 '깨진 맵'이다 —
        // 데이터 URI는 traverse 시점에 이미 로드돼 있을 수 있어 !image 검사만으로는 놓친다.
        const isBrokenMap = m.map
          && (!m.map.image || m.map.image.src === BROKEN_TEXTURE_SENTINEL);
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

    addToonOutline(fbx); // 잉크 라인 — 레트로 툰 룩(시안 승인 2026-07-21)

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
