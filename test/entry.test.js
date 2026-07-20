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
});
