// localStorage 키 문자열 단일 소유 — 값은 기존 코드에서 grep으로 수집한 그대로다(변경 금지,
// 기존 사용자 localStorage와의 호환을 깨뜨리지 않기 위함). 새 키를 추가할 때만 이 파일에 더한다.
export const STORAGE_KEYS = {
  onboardingSeen: 'onboardingSeen', // main.js — 온보딩 1장을 본 적 있는지
  overlayLookHintSeen: 'overlayLookHintSeen', // main.js — 오버레이 "둘러보기" 힌트를 본 적 있는지
  soundMuted: 'soundMuted', // sound.js — 효과음 음소거 여부
  surveyQueue: 'pendingResponses', // queue.js — 오프라인 설문 응답 큐
};
