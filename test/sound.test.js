import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// sound.js는 브라우저 전역(window.AudioContext, localStorage)에 의존한다. 헤드리스 vitest는
// 기본 node 환경이라 이 전역이 없으므로, 실제 오디오 출력 검증(수동/실기기 몫)은 제외하고
// mute 상태 로직(초기값·토글·저장·재생 게이팅)만 최소 stub으로 검증한다.

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.resumeCalls = 0;
  }
  resume() {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() { return this; },
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() { return this; },
      start() {},
      stop() {},
    };
  }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { buffer: null, connect() { return this; }, start() {}, stop() {} };
  }
  createBiquadFilter() {
    return { type: 'bandpass', frequency: { value: 0 }, Q: { value: 0 }, connect() { return this; } };
  }
}

describe('initSound - mute 상태 로직', () => {
  let constructedCount;

  beforeEach(() => {
    constructedCount = 0;
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('window', {
      AudioContext: class extends FakeAudioContext {
        constructor() {
          super();
          constructedCount += 1;
        }
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('localStorage에 저장된 값이 없으면 기본 ON(muted=false)', async () => {
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    expect(sound.muted).toBe(false);
  });

  it('localStorage에 soundMuted=1이 저장돼 있으면 muted=true로 시작', async () => {
    localStorage.setItem('soundMuted', '1');
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    expect(sound.muted).toBe(true);
  });

  it('toggle()은 상태를 반전하고 localStorage에 저장한다', async () => {
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();

    expect(sound.toggle()).toBe(true);
    expect(sound.muted).toBe(true);
    expect(localStorage.getItem('soundMuted')).toBe('1');

    expect(sound.toggle()).toBe(false);
    expect(sound.muted).toBe(false);
    expect(localStorage.getItem('soundMuted')).toBe('0');
  });

  it('muted 상태에서는 play()가 AudioContext를 생성하지 않는다', async () => {
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    sound.toggle(); // muted=true
    sound.play('pop');
    expect(constructedCount).toBe(0);
  });

  it('muted 아닐 때 play()는 AudioContext를 lazy 생성하고 resume을 시도한다', async () => {
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    sound.play('pop');
    expect(constructedCount).toBe(1);

    sound.play('tap'); // 두 번째 호출부터는 기존 컨텍스트 재사용
    expect(constructedCount).toBe(1);
  });

  it('정의되지 않은 이름은 예외 없이 무시하고 AudioContext도 만들지 않는다', async () => {
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    expect(() => sound.play('does-not-exist')).not.toThrow();
    expect(constructedCount).toBe(0); // synth 조회가 ensureContext보다 먼저라 불필요한 컨텍스트 생성을 피한다
  });

  it('localStorage 접근이 실패해도(프라이빗 모드 등) 기본 ON으로 동작한다', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('접근 불가'); },
      setItem() { throw new Error('접근 불가'); },
    });
    const { initSound } = await import('../src/sound.js');
    const sound = initSound();
    expect(sound.muted).toBe(false);
    expect(() => sound.toggle()).not.toThrow();
  });
});
