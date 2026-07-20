import { describe, it, expect, vi } from 'vitest';
import { asScene, NullScene, SCENE_METHODS } from '../src/app/scenes.js';

describe('asScene', () => {
  it('NullScene은 전 메서드가 no-op으로 존재한다', () => {
    for (const m of SCENE_METHODS) expect(() => NullScene[m]()).not.toThrow();
  });
  it('구현이 있는 메서드는 위임, 없는 메서드는 no-op', () => {
    const impl = { playMotion: vi.fn() };
    const s = asScene(impl);
    s.playMotion('wave');
    expect(impl.playMotion).toHaveBeenCalledWith('wave');
    expect(() => s.burst('heart')).not.toThrow();
  });
});
