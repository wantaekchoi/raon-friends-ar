import { describe, it, expect } from 'vitest';
import { scaledMs } from '../src/app/timing.js';

describe('scaledMs', () => {
  it('파라미터 없으면 원값', () => expect(scaledMs(30000, '')).toBe(30000));
  it('timerScale 적용', () => expect(scaledMs(30000, '?timerScale=0.1')).toBe(3000));
  it('하한 50ms', () => expect(scaledMs(100, '?timerScale=0.0001')).toBe(50));
  it('비정상 값은 무시', () => expect(scaledMs(30000, '?timerScale=abc')).toBe(30000));
});
