// 테스트·리허설용 타이머 배속 — ?timerScale=0.1이면 대기 시간이 1/10로 줄어든다.
// E2E가 30초 폴백·키오스크 리셋을 수 초 안에 검증하기 위한 장치로, 운영 문서(README)에는 싣지 않는다.
export function scaledMs(baseMs, search = location.search) {
  const raw = new URLSearchParams(search).get('timerScale');
  const scale = Number(raw);
  if (!raw || !Number.isFinite(scale) || scale <= 0 || scale > 1) return baseMs;
  return Math.max(50, Math.round(baseMs * scale));
}
