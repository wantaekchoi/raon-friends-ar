import { describe, it, expect } from 'vitest';
import { testParam } from '../src/app/test-params.js';

describe('testParam', () => {
  it('localhost면 값을 반환한다', () => {
    expect(testParam('timerScale', '?timerScale=0.1', 'localhost')).toBe('0.1');
  });

  it('127.0.0.1도 허용 호스트다', () => {
    expect(testParam('fakeGyro', '?fakeGyro=1', '127.0.0.1')).toBe('1');
  });

  it('공개 배포 호스트에서는 파라미터가 있어도 null(키오스크 무단 조작 차단)', () => {
    expect(testParam('timerScale', '?timerScale=0.01', 'raon-friends.example.com')).toBeNull();
    expect(testParam('fakeGyro', '?fakeGyro=1', 'raon-friends.example.com')).toBeNull();
  });

  it('허용 호스트라도 파라미터 자체가 없으면 null', () => {
    expect(testParam('timerScale', '', 'localhost')).toBeNull();
    expect(testParam('timerScale', '?other=1', 'localhost')).toBeNull();
  });

  it('markerMock도 동일하게 게이팅된다', () => {
    expect(testParam('markerMock', '?markerMock=raoni', 'localhost')).toBe('raoni');
    expect(testParam('markerMock', '?markerMock=raoni', 'example.com')).toBeNull();
  });
});
