// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRouter } from '../src/app/router.js';

describe('createRouter', () => {
  it('show가 data-screen을 단독 소유한다', () => {
    const r = createRouter(document.body);
    r.show('guide');
    expect(document.body.dataset.screen).toBe('guide');
    expect(r.screen()).toBe('guide');
  });
  it('setMode(null)이 data-mode를 제거한다', () => {
    const r = createRouter(document.body);
    r.setMode('marker-flow');
    expect(document.body.dataset.mode).toBe('marker-flow');
    r.setMode(null);
    expect('mode' in document.body.dataset).toBe(false);
    expect(r.mode()).toBe(null);
  });
});
