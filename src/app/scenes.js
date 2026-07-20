// 씬 공통 계약 — overlay/marker/webxr가 부분적으로만 구현하는 API를 전 메서드 보장형으로
// 정규화한다. activeScene은 null이 될 수 없고(NullScene), 호출부의 `?.` 가드를 없앤다.
const noop = () => {};

export const SCENE_METHODS = [
  'setCharacter', 'playEntrance', 'playMotion', 'burst',
  'stopCamera', 'pause', 'resume', 'stop',
];

export function asScene(impl = {}) {
  const scene = {};
  for (const m of SCENE_METHODS) {
    scene[m] = typeof impl[m] === 'function' ? impl[m].bind(impl) : noop;
  }
  scene.raw = impl; // webxr 복귀 등 원본이 필요한 예외 경로용
  return scene;
}

export const NullScene = asScene();
