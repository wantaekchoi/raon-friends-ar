// 테스트·리허설용 타이머 배속 — ?timerScale=0.1이면 대기 시간이 1/10로 줄어든다.
// E2E가 30초 폴백·키오스크 리셋을 수 초 안에 검증하기 위한 장치로, 운영 문서(README)에는 싣지 않는다.
// localhost/127.0.0.1 전용 게이트(test-params.js) — 공개 배포 URL에서 ?timerScale=로 키오스크
// 리셋 타이머를 조작할 수 없게 한다.
import { testParam } from './test-params.js';

export function scaledMs(baseMs, search = location.search, hostname = location.hostname) {
  const raw = testParam('timerScale', search, hostname);
  const scale = Number(raw);
  if (!raw || !Number.isFinite(scale) || scale <= 0 || scale > 1) return baseMs;
  return Math.max(50, Math.round(baseMs * scale));
}
