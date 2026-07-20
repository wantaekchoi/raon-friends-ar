// 특정 캐릭터 1명이 안내 전체를 단독 진행하도록 guideScript의 화자를 고정하는 공통 로직.
//
// main.js의 ?char=<key> URL 파라미터(예: ?char=raoni)와 Vision AI 인식 결과(3단계: raong/raoni/
// raona 인식 성공)가 이 함수를 공유한다 — 텍스트 내용은 원본 guideScript 그대로 두고 speaker만
// charKey로 교체한다. 두 진입 경로 모두 "이후 사용자 입력 없이 이 캐릭터로 안내가 시작되기 전"에만
// 호출해야 한다(가이드가 이미 진행 중인 flow를 재구성하면 진행 상태가 끊긴다).

/**
 * @param {{ speaker: string, text: string }[]} guideScript 원본 안내 대본 (CONFIG.guideScript)
 * @param {string | null | undefined} charKey 고정할 캐릭터 키 (예: 'raoni'). 유효하지 않으면 무시.
 * @param {Record<string, unknown>} characters 유효한 캐릭터 키 목록 (CONFIG.characters)
 * @returns {{ speaker: string, text: string }[]} charKey가 유효하면 speaker가 전부 교체된 새 배열,
 *   그렇지 않으면(키 없음·미등록 키) 원본 guideScript를 그대로 반환한다.
 */
export function lockGuideScriptToCharacter(guideScript, charKey, characters) {
  if (!charKey || !characters?.[charKey]) return guideScript;
  return guideScript.map((line) => ({ ...line, speaker: charKey }));
}
