import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueue, flush, pendingCount } from '../src/queue.js';

// vitest 기본 환경(node)에는 localStorage가 없으므로 테스트용 메모리 구현을 stubGlobal한다.
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('pendingCount / enqueue', () => {
  it('초기 상태는 0', () => {
    expect(pendingCount()).toBe(0);
  });

  it('enqueue한 만큼 pendingCount가 늘어난다', () => {
    enqueue({ name: '홍길동' });
    enqueue({ name: '김철수' });
    expect(pendingCount()).toBe(2);
  });
});

describe('flush', () => {
  it('큐가 비어있으면 submitFn을 호출하지 않고 0을 반환한다', async () => {
    const submitFn = vi.fn();
    const count = await flush(submitFn);
    expect(count).toBe(0);
    expect(submitFn).not.toHaveBeenCalled();
  });

  it('전부 성공하면 큐를 비우고 성공 개수를 반환한다', async () => {
    enqueue({ name: 'a' });
    enqueue({ name: 'b' });
    const submitFn = vi.fn().mockResolvedValue({ ok: true });
    const count = await flush(submitFn);
    expect(count).toBe(2);
    expect(pendingCount()).toBe(0);
    expect(submitFn).toHaveBeenCalledTimes(2);
  });

  it('일부만 성공하면 실패한 항목만 큐에 남는다', async () => {
    enqueue({ name: 'a' });
    enqueue({ name: 'b' });
    const submitFn = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    const count = await flush(submitFn);
    expect(count).toBe(1);
    expect(pendingCount()).toBe(1);
  });

  it('submitFn이 예외를 던지면 실패로 간주해 큐에 남긴다', async () => {
    enqueue({ name: 'a' });
    const submitFn = vi.fn().mockRejectedValue(new Error('network'));
    const count = await flush(submitFn);
    expect(count).toBe(0);
    expect(pendingCount()).toBe(1);
  });
});

describe('파손 데이터 방어', () => {
  it('파손된 JSON은 무시하고 빈 큐로 취급한다', () => {
    localStorage.setItem('pendingResponses', '{not valid json');
    expect(pendingCount()).toBe(0);
    enqueue({ name: 'a' });
    expect(pendingCount()).toBe(1);
  });

  it('저장된 값이 배열이 아니면 빈 큐로 취급한다', () => {
    localStorage.setItem('pendingResponses', JSON.stringify({ not: 'array' }));
    expect(pendingCount()).toBe(0);
  });
});
