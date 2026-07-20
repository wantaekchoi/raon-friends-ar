import * as THREE from 'three';

// F2 접근성: prefers-reduced-motion 선호 시 점프/신남(cheer) 리액션의 진폭만 줄인다.
// idle 숨쉬기·wave·sad·wiggle까지 완전히 멈추면 캐릭터가 "죽어 보여" 오히려 몰입을 깨므로,
// 완전 정지가 아니라 강도만 낮춘다(설계서 F2 지침).
const prefersReducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const REACTION_SCALE = prefersReducedMotion ? 0.4 : 1;

// 라옹(커스텀 리그: armNNNL/R)과 라오니·라오나(믹사모 리그: mixamorigLeft/RightArm 등)가
// 본 명명 규칙이 서로 달라 정규식 하나로 좌우와 부위를 함께 판별한다.
const WAVE_DURATION = 1.6; // 초
const JUMP_DURATION = 1.2; // 초
// 라옹의 arm007R bind 회전(z=1.78rad)이 이미 "한쪽 팔 든" 인사 포즈라서, 여기에 큰 각을
// 더하면 팔이 180도 가까이 돌아 반대편으로 넘어가 보인다(스크린샷으로 확인). 폭을 작게 잡아
// bind 자세를 축으로 좌우로 "흔드는" 느낌만 준다.
const WAVE_LIFT = 0.15; // 팔을 들어올리는 각(라디안)
const WAVE_WIGGLE = 0.3; // 흔드는 폭(라디안)
const WAVE_CYCLES = 2.5; // 흔드는 횟수
const JUMP_HEIGHT = 0.22; // 점프 높이(유닛) — 캐릭터 키 1.2유닛 기준

const CHEER_DURATION = 1.0; // 초 — 빠른 2회 점프 + 팔 흔들기
const CHEER_JUMPS = 2; // 점프 횟수
const CHEER_HEIGHT = 0.16; // 점프 높이(유닛)
const CHEER_ARM_LIFT = 0.28; // 팔을 들어올리는 각(라디안)
const CHEER_ARM_SPEED = 6; // 팔 흔드는 빠르기(주기/전체 구간)

const SAD_DURATION = 1.4; // 초 — 몸통 앞 숙임 + 느린 복귀
const SAD_BEND_PHASE = 0.3; // 전체 구간 중 숙이는 데 쓰는 비율(나머지는 느린 복귀)
const SAD_LEAN = 0.32; // 앞으로 숙이는 각(라디안)

const WIGGLE_DURATION = 0.6; // 초 — 좌우 갸우뚱
const WIGGLE_TILT = 0.22; // 기울이는 각(라디안)
const WIGGLE_CYCLES = 2; // 갸우뚱 왕복 횟수

function sideOf(name) {
  if (/right/i.test(name)) return 'R';
  if (/left/i.test(name)) return 'L';
  if (/R$/.test(name)) return 'R'; // 라옹: arm007R
  if (/L$/.test(name)) return 'L'; // 라옹: arm007L
  return null;
}

// 팔 체인에서 "상완"에 해당하는 본을 최우선으로 고른다 — 어깨(shoulder)는 가동 범위가
// 작고 손(hand)은 너무 말단이라, 팔 전체를 들어올리기엔 상완 본을 회전시키는 게 가장 자연스럽다.
function scoreOf(name) {
  const n = name.toLowerCase();
  if (n.includes('shoulder')) return 1;
  if (n.includes('forearm')) return 2;
  if (n.includes('hand')) return 0;
  if (/arm|팔/.test(n)) return 3;
  return -1;
}

function findMainArmBones(root) {
  const bones = [];
  root.traverse((child) => {
    if (child.isBone) bones.push(child);
  });
  if (bones.length) {
    console.debug('[motion] 본 목록:', bones.map((b) => b.name));
  }

  const candidates = { R: [], L: [] };
  bones.forEach((bone) => {
    const side = sideOf(bone.name);
    const score = scoreOf(bone.name);
    if (side && score >= 0) candidates[side].push({ bone, score });
  });

  // score 내림차순 정렬. Array.sort는 안정 정렬이라 동점(예: 라옹의 armNNNR 체인 전부가
  // score=3)이면 순회 순서(부모가 자식보다 먼저 방문됨)가 유지돼 자연히 최상위 본이 뽑힌다.
  const pick = (side) => {
    const list = candidates[side];
    if (!list.length) return null;
    list.sort((a, b) => b.score - a.score);
    return list[0].bone;
  };

  return { armR: pick('R'), armL: pick('L') };
}

export function createMotionEngine() {
  let character = null;
  let waveBone = null;
  let waveBoneBind = null; // 본의 bind(초기) 회전 — 매 프레임 이 값 기준으로 오프셋을 더한다
  let current = 'idle';
  let motionStartT = 0;
  let pendingStart = false;

  function attach(nextCharacter) {
    character = nextCharacter;
    character.rotation.z = 0;
    character.scale.set(1, 1, 1);

    const { armR, armL } = findMainArmBones(character);
    waveBone = armR || armL;
    waveBoneBind = waveBone ? waveBone.rotation.clone() : null;
    console.debug(
      waveBone ? `[motion] 흔들 본 선택: ${waveBone.name}` : '[motion] 팔 본 없음 — 몸통 기울이기 폴백',
    );

    current = 'idle';
    pendingStart = false;
  }

  function play(name) {
    current = name;
    pendingStart = true;
  }

  function applyIdle(t) {
    character.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02; // 바닥 아래로 꺼지지 않는 잔잔한 숨쉬기
    character.rotation.x = 0; // sad 모션이 남긴 앞숙임을 원위치
    character.rotation.y = Math.sin(t * 0.9) * 0.15;
    character.rotation.z = 0;
    character.scale.set(1, 1, 1);
    if (waveBone && waveBoneBind) waveBone.rotation.copy(waveBoneBind);
  }

  function applyWave(p) {
    const envelope = Math.sin(Math.min(p, 1) * Math.PI); // 0 → 1 → 0 부드러운 포락선
    const wiggle = Math.sin(p * Math.PI * 2 * WAVE_CYCLES);
    const delta = envelope * WAVE_LIFT + envelope * wiggle * WAVE_WIGGLE;

    if (waveBone && waveBoneBind) {
      // 리그마다 어깨의 bind 회전이 달라 "흔드는" 실제 스윙 축이 X/Z 중 무엇인지 리그마다 다르다
      // (라옹은 Z가 스윙축, 믹사모 계열은 어깨의 90도 프리로테이션 탓에 Z가 팔 길이축 "말림"이
      // 돼 버려 화면상 안 보인다 — 스크린샷으로 확인). 두 축에 동시에 더해 어느 쪽이 스윙축이든
      // 보이게 하고, 실제 롤 축 쪽은 원통형 팔이라 시각적으로 무해하다.
      waveBone.rotation.x = waveBoneBind.x + delta;
      waveBone.rotation.y = waveBoneBind.y;
      waveBone.rotation.z = waveBoneBind.z + delta;
    } else {
      // 폴백: 팔 본을 못 찾은 경우 — 몸통을 z축으로 2회 기울이고 살짝 점프
      character.rotation.z = envelope * 0.28 * Math.sin(p * Math.PI * 2 * 2);
      character.position.y = envelope * 0.06;
    }
  }

  function applyJump(p) {
    const cycle = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
    const height = Math.sin(cycle * Math.PI) * REACTION_SCALE; // 0(바닥) → 1(정점) → 0(바닥), 항상 0 이상

    character.position.y = height * JUMP_HEIGHT;
    // 공중에서 살짝 늘어나고(stretch) 착지 순간엔 눌리는(squash) 카툰풍 탄성
    character.scale.y = 1 + height * 0.12 - (1 - height) * 0.18;
    const xz = 1 - height * 0.06 + (1 - height) * 0.12;
    character.scale.x = xz;
    character.scale.z = xz;
  }

  // cheer: 별점 4~5점 리액션. 짧은 구간 안에 점프를 2회 압축해 넣고, 동시에 팔을 빠르게 흔든다.
  function applyCheer(p) {
    const cycleP = (p * CHEER_JUMPS) % 1;
    const height = Math.sin(cycleP * Math.PI) * REACTION_SCALE;
    character.position.y = height * CHEER_HEIGHT;
    character.scale.y = 1 + height * 0.1;
    const xz = 1 - height * 0.05;
    character.scale.x = xz;
    character.scale.z = xz;

    if (waveBone && waveBoneBind) {
      const wiggle = Math.sin(p * Math.PI * 2 * CHEER_ARM_SPEED) * REACTION_SCALE;
      const delta = (CHEER_ARM_LIFT + wiggle * CHEER_ARM_LIFT) * REACTION_SCALE;
      waveBone.rotation.x = waveBoneBind.x + delta;
      waveBone.rotation.z = waveBoneBind.z + delta;
    } else {
      // 폴백: 팔 본이 없으면 몸통을 좌우로 빠르게 흔들어 신남을 표현
      character.rotation.z = Math.sin(p * Math.PI * 2 * CHEER_ARM_SPEED) * 0.14 * REACTION_SCALE;
    }
  }

  // sad: 별점 1~2점 리액션. 앞쪽 구간에서 빠르게 숙이고 남은 구간 내내 느리게 복귀한다(ease-out).
  function applySad(p) {
    let lean;
    if (p < SAD_BEND_PHASE) {
      lean = p / SAD_BEND_PHASE;
    } else {
      const recoverP = (p - SAD_BEND_PHASE) / (1 - SAD_BEND_PHASE);
      lean = Math.pow(1 - recoverP, 1.5); // 뒷부분일수록 더 천천히 원위치
    }
    character.rotation.x = lean * SAD_LEAN;
    character.position.y = -lean * 0.03; // 풀 죽어 살짝 처지는 느낌
  }

  // wiggle: 쓰다듬기·중립(3점) 리액션. 좌우로 짧게 갸우뚱하고 자연히 사그라든다.
  function applyWiggle(p) {
    const envelope = Math.sin(Math.min(p, 1) * Math.PI);
    character.rotation.z = envelope * WIGGLE_TILT * Math.sin(p * Math.PI * 2 * WIGGLE_CYCLES);
  }

  function update(t) {
    if (!character) return;
    if (pendingStart) {
      motionStartT = t;
      pendingStart = false;
    }

    if (current === 'wave') {
      const p = Math.min((t - motionStartT) / WAVE_DURATION, 1);
      applyWave(p);
      if (p >= 1) current = 'idle';
    } else if (current === 'jump') {
      const p = Math.min((t - motionStartT) / JUMP_DURATION, 1);
      applyJump(p);
      if (p >= 1) {
        character.scale.set(1, 1, 1);
        current = 'idle';
      }
    } else if (current === 'cheer') {
      const p = Math.min((t - motionStartT) / CHEER_DURATION, 1);
      applyCheer(p);
      if (p >= 1) {
        character.scale.set(1, 1, 1);
        current = 'idle';
      }
    } else if (current === 'sad') {
      const p = Math.min((t - motionStartT) / SAD_DURATION, 1);
      applySad(p);
      if (p >= 1) {
        character.rotation.x = 0;
        current = 'idle';
      }
    } else if (current === 'wiggle') {
      const p = Math.min((t - motionStartT) / WIGGLE_DURATION, 1);
      applyWiggle(p);
      if (p >= 1) {
        character.rotation.z = 0;
        current = 'idle';
      }
    } else {
      applyIdle(t);
    }
  }

  return { attach, play, update };
}
