// 오프라인 응답 큐 — 설문 전송이 실패하면(오프라인 등) localStorage에 보관해두고,
// 앱 재시작 시나 재시도 성공 시 다시 전송을 시도한다. 설계서 D2 참조.

const STORAGE_KEY = 'pendingResponses';

function readQueue() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return []; // localStorage 접근 불가(시크릿 모드 저장공간 제한 등) — 큐 없이 동작
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // 파손된 JSON은 무시하고 빈 큐로 취급
  }
}

function writeQueue(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 저장 실패(용량 초과 등) — 무시. 다음 시도에서 다시 채워질 수 있다.
  }
}

/** answers를 큐에 추가한다. */
export function enqueue(answers) {
  const list = readQueue();
  list.push(answers);
  writeQueue(list);
}

/** 현재 큐에 쌓여있는 응답 개수. */
export function pendingCount() {
  return readQueue().length;
}

/**
 * 큐에 쌓인 모든 answers를 submitFn(answers)로 재전송 시도한다.
 * 성공(res.ok)한 항목은 큐에서 제거하고, 실패했거나 예외가 발생한 항목은 그대로 남긴다.
 * @param {(answers: object) => Promise<{ ok: boolean }>} submitFn
 * @returns {Promise<number>} 이번 호출에서 성공적으로 전송된 개수
 */
// 동시 flush(앱 시작 자동 재전송 vs 설문 완료 직후)가 겹치면 서로의 스냅샷을 덮어써
// 중복 전송/유실이 가능하다 — 단일 실행으로 직렬화하고, 겹치면 진행 중인 promise를 공유한다.
let flushInFlight = null;

export function flush(submitFn) {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const list = readQueue();
    if (list.length === 0) return 0;

    const remaining = [];
    let successCount = 0;
    for (const answers of list) {
      // 큐 항목은 순서대로 하나씩 재전송한다 (구글 폼 동시 다발 POST로 인한 유실 방지).
      // eslint-disable-next-line no-await-in-loop
      const ok = await submitFn(answers).then((res) => !!(res && res.ok)).catch(() => false);
      if (ok) successCount += 1;
      else remaining.push(answers);
    }
    writeQueue(remaining);
    return successCount;
  })().finally(() => { flushInFlight = null; });
  return flushInFlight;
}
