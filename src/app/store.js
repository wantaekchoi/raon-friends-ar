// 앱 상태 단일 소유 — URL 파라미터 파싱 규칙은 기존 main.js와 동일해야 한다(동작 보존).
const SIZE_HEIGHTS = { life: 1.8, giant: 2.5 };

export function createStore(search = location.search) {
  const params = new URLSearchParams(search);
  const state = {
    kiosk: params.get('kiosk') === '1',
    charParam: params.get('char'),
    characterHeight: SIZE_HEIGHTS[params.get('size')],
    cameraFacing: params.get('camera') === 'user' ? 'user' : undefined,
    lockedCharacter: null, // ?char= 검증 통과·카드 소환·Vision 인식이 설정
  };
  const listeners = new Set();
  return {
    params,
    get: (key) => state[key],
    set(key, value) {
      state[key] = value;
      listeners.forEach((fn) => fn(key, value));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
