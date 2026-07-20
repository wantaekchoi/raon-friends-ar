import * as THREE from 'three';

// 스프라이트 풀 크기 — burst()를 남발해도 새 스프라이트를 만들지 않고 라운드로빈으로 재사용한다.
const POOL_SIZE = 32;
const MIN_LIFE = 0.8; // 초
const MAX_LIFE = 1.2; // 초

// 이모지를 캔버스에 그려 스프라이트 텍스처로 쓴다 — 별도 이미지 에셋 없이 하트/별 파티클을 구현.
function makeEmojiTexture(emoji) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.font = `${Math.floor(size * 0.75)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

/**
 * scene에 재사용 스프라이트 풀을 붙이고 { burst, update } 제어 API를 반환한다.
 * burst(type, worldPos, count=8): worldPos 주변에서 count개의 파티클을 흩뿌린다.
 * update(elapsedSec): THREE.Clock 기준 경과 절대 시각을 매 프레임 넘겨 이동·페이드를 진행시킨다.
 */
export function createEffects(scene) {
  // F2 접근성: prefers-reduced-motion 선호 시 파티클 burst를 완전히 건너뛴다(no-op) —
  // 하트/별이 화면 위로 흩날리는 연출 자체가 모션에 민감한 사용자에게 불편할 수 있다.
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const textures = {
    heart: makeEmojiTexture('💗'),
    star: makeEmojiTexture('⭐'),
  };

  const pool = Array.from({ length: POOL_SIZE }, () => {
    const material = new THREE.SpriteMaterial({
      map: textures.heart,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    return {
      sprite,
      active: false,
      t0: 0,
      life: 0,
      start: new THREE.Vector3(),
      drift: new THREE.Vector3(),
      baseScale: 0.18,
    };
  });

  let cursor = 0;
  let lastElapsed = 0; // update()가 마지막으로 받은 경과 시각 — burst()가 프레임 밖에서 불려도 스폰 시각 기준으로 쓴다

  function spawnOne(type, worldPos) {
    const slot = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;

    slot.active = true;
    slot.t0 = lastElapsed;
    slot.life = MIN_LIFE + Math.random() * (MAX_LIFE - MIN_LIFE);
    slot.sprite.material.map = textures[type] || textures.heart;
    slot.sprite.material.needsUpdate = true;

    slot.start.set(
      worldPos.x + (Math.random() - 0.5) * 0.25,
      worldPos.y + (Math.random() - 0.5) * 0.1,
      worldPos.z + (Math.random() - 0.5) * 0.25,
    );
    slot.drift.set(
      (Math.random() - 0.5) * 0.4,
      0.4 + Math.random() * 0.35, // 위로 흩어짐
      (Math.random() - 0.5) * 0.4,
    );
    slot.baseScale = 0.14 + Math.random() * 0.08;

    slot.sprite.position.copy(slot.start);
    slot.sprite.scale.setScalar(slot.baseScale);
    slot.sprite.material.opacity = 1;
    slot.sprite.visible = true;
  }

  function burst(type, worldPos, count = 8) {
    if (prefersReducedMotion) return; // F2: reduced-motion — 파티클을 아예 스폰하지 않는다
    for (let i = 0; i < count; i += 1) {
      spawnOne(type, worldPos);
    }
  }

  function update(elapsedSec) {
    lastElapsed = elapsedSec;
    pool.forEach((slot) => {
      if (!slot.active) return;
      const age = elapsedSec - slot.t0;
      if (age >= slot.life) {
        slot.active = false;
        slot.sprite.visible = false;
        return;
      }
      const p = age / slot.life;
      slot.sprite.position.set(
        slot.start.x + slot.drift.x * p,
        slot.start.y + slot.drift.y * p,
        slot.start.z + slot.drift.z * p,
      );
      slot.sprite.material.opacity = 1 - p;
      slot.sprite.scale.setScalar(slot.baseScale * (1 + p * 0.5));
    });
  }

  return { burst, update };
}
