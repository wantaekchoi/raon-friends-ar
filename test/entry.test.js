import { describe, it, expect, vi } from 'vitest';
import { createOnceGuard } from '../src/app/entry.js';

describe('createOnceGuard', () => {
  it('두 번째 호출은 무시된다', async () => {
    const guard = createOnceGuard();
    const fn = vi.fn(async () => {});
    await guard(fn);
    await guard(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reset() 없이는 두 번째 호출이 무시된다', async () => {
    const guard = createOnceGuard();
    const fn = vi.fn(async () => {});
    await guard(fn);
    await guard(fn);
    await guard(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reset() 후에는 다시 실행된다 (실패 경로 재시도 허용)', async () => {
    const guard = createOnceGuard();
    const fn = vi.fn(async () => {});
    await guard(fn);
    guard.reset();
    await guard(fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reset()을 호출하지 않으면 세 번째 이후 호출도 계속 무시된다', async () => {
    const guard = createOnceGuard();
    const fn = vi.fn(async () => {});
    await guard(fn);
    guard.reset();
    await guard(fn); // 재무장 후 1회 재실행
    await guard(fn); // 다시 잠겼으므로 무시
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
