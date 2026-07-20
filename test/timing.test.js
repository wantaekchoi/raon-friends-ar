import { describe, it, expect } from 'vitest';
import { scaledMs } from '../src/app/timing.js';

describe('scaledMs', () => {
  it('파라미터 없으면 원값', () => expect(scaledMs(30000, '', 'localhost')).toBe(30000));
  it('timerScale 적용(localhost)', () => expect(scaledMs(30000, '?timerScale=0.1', 'localhost')).toBe(3000));
  it('하한 50ms', () => expect(scaledMs(100, '?timerScale=0.0001', 'localhost')).toBe(50));
  it('비정상 값은 무시', () => expect(scaledMs(30000, '?timerScale=abc', 'localhost')).toBe(30000));
  it('127.0.0.1에서도 적용', () => expect(scaledMs(30000, '?timerScale=0.1', '127.0.0.1')).toBe(3000));
  it('공개 배포 호스트에서는 timerScale이 무시된다(키오스크 리셋 타이머 조작 차단)', () => {
    expect(scaledMs(30000, '?timerScale=0.01', 'raon-friends.example.com')).toBe(30000);
  });
});
