// WebAudio 신스 기반 효과음 4종 — 오디오 파일 없이 oscillator/noise + envelope으로 즉석 생성한다.
// AudioContext는 첫 play() 호출 시점에 lazy 생성하고, 매 play()마다 resume()을 시도한다
// (iOS는 사용자 제스처 안에서 호출된 resume()만 허용 — 이미 running이면 비용 없이 즉시 반환).
//
// 사용 예 (조율 세션이 main.js에 배선할 때 참고 — main.js는 B팩 수정 금지 대상이라 여기 주석으로만 남김):
//
//   import { initSound } from './sound.js';
//   const sound = initSound();
//
//   document.getElementById('btn-sound').addEventListener('click', () => {
//     const muted = sound.toggle();
//     document.getElementById('btn-sound').textContent = muted ? '🔇' : '🔊';
//     document.getElementById('btn-sound').classList.toggle('is-muted', muted);
//   });
//   // 초기 아이콘도 sound.muted로 동일하게 맞춰준다.
//
//   sound.play('pop');      // 캐릭터 등장(ensureCharacter → playEntrance 직후)
//   sound.play('boing');    // 점프 모션(감사 인사·쓰다듬기 등)
//   sound.play('twinkle');  // 하트 리액션(별점 4~5점, 쓰다듬기 파티클)
//   sound.play('tap');      // 버튼 탭(다음/재시도/재시작 등)

import { STORAGE_KEYS } from './app/storage-keys.js';

const STORAGE_KEY = STORAGE_KEYS.soundMuted;

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // localStorage 접근 불가(사파리 프라이빗 모드 등) — 기본 ON(음소거 아님) 유지
  }
}

function writeMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // 저장 실패해도 현재 세션 동작에는 지장 없음 — 조용히 무시
  }
}

// start 시점 기준 0→peak(attack)→0(decay)로 부드럽게 오르내리는 게인 엔벨로프.
// exponentialRamp는 0으로는 못 가므로 0.0001을 사실상의 무음 바닥으로 사용한다.
function gainEnvelope(audioCtx, { peak, attack, decay, start }) {
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return gain;
}

// 등장(pop): 300→650Hz로 빠르게 스윕하는 사인파, 8ms 어택+70ms 디케이 — 비눗방울 터지는 느낌.
function playPop(audioCtx, start) {
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, start);
  osc.frequency.exponentialRampToValueAtTime(650, start + 0.08);

  const gain = gainEnvelope(audioCtx, { peak: 0.14, attack: 0.008, decay: 0.07, start });
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + 0.09);
}

// 점프(boing): 420→260→480→340Hz로 출렁이는 주파수 바운스, 총 200ms — 만화적 탄성 느낌.
function playBoing(audioCtx, start) {
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, start);
  osc.frequency.exponentialRampToValueAtTime(260, start + 0.08);
  osc.frequency.exponentialRampToValueAtTime(480, start + 0.16);
  osc.frequency.exponentialRampToValueAtTime(340, start + 0.2);

  const gain = gainEnvelope(audioCtx, { peak: 0.13, attack: 0.01, decay: 0.19, start });
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + 0.21);
}

// 하트(twinkle): C6-E6-G6-C7 상승 아르페지오 4음(각 50ms 간격, triangle) — 반짝이는 느낌, 총 250ms.
function playTwinkle(audioCtx, start) {
  const notes = [1046.5, 1318.5, 1568, 2093];
  const step = 0.05;
  notes.forEach((freq, i) => {
    const noteStart = start + i * step;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, noteStart);

    const gain = gainEnvelope(audioCtx, { peak: 0.1, attack: 0.005, decay: step * 1.4, start: noteStart });
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(noteStart);
    osc.stop(noteStart + step * 1.5);
  });
}

// 버튼(tap): 30ms 화이트노이즈를 밴드패스(2200Hz)로 걸러낸 짧은 "톡" 클릭음.
function playTap(audioCtx, start) {
  const duration = 0.03;
  const bufferSize = Math.max(1, Math.ceil(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 1.2;

  const gain = gainEnvelope(audioCtx, { peak: 0.1, attack: 0.002, decay: duration - 0.002, start });
  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start(start);
  noise.stop(start + duration);
}

const SYNTHS = { pop: playPop, boing: playBoing, twinkle: playTwinkle, tap: playTap };

export function initSound() {
  let ctx = null;
  let muted = readMuted();

  function ensureContext() {
    if (!ctx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContextCtor();
    }
    if (ctx.state === 'suspended') ctx.resume(); // iOS: 사용자 제스처 콜스택 안에서 호출해야 풀림
    return ctx;
  }

  function play(name) {
    if (muted) return;
    const synth = SYNTHS[name];
    if (!synth) return; // 정의되지 않은 이름은 조용히 무시 — 호출부 오타로 전체 흐름이 죽지 않도록
    const audioCtx = ensureContext();
    synth(audioCtx, audioCtx.currentTime);
  }

  function toggle() {
    muted = !muted;
    writeMuted(muted);
    return muted;
  }

  return {
    play,
    toggle,
    get muted() {
      return muted;
    },
  };
}
