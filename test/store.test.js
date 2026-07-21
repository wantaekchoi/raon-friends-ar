import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/app/store.js';

describe('createStore', () => {
  it('URL 파라미터를 초기 상태로 파싱한다', () => {
    const s = createStore('?kiosk=1&char=raoni&size=giant&camera=user');
    expect(s.get('kiosk')).toBe(true);
    expect(s.get('charParam')).toBe('raoni');
    expect(s.get('characterHeight')).toBe(3.2);
    expect(s.get('cameraFacing')).toBe('user');
    expect(s.get('lockedCharacter')).toBe(null);
  });
  it('알 수 없는 size·camera는 undefined', () => {
    const s = createStore('?size=xl&camera=rear');
    expect(s.get('characterHeight')).toBeUndefined();
    expect(s.get('cameraFacing')).toBeUndefined();
  });
  it('set은 구독자에게 (key, value)로 알린다 / unsubscribe 동작', () => {
    const s = createStore('');
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set('lockedCharacter', 'raona');
    expect(fn).toHaveBeenCalledWith('lockedCharacter', 'raona');
    off();
    s.set('lockedCharacter', null);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
