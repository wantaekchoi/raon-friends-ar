// 특정 캐릭터 1명이 안내 전체를 단독 진행하는 대본을 조립하는 공통 로직.
//
// main.js의 ?char=<key> URL 파라미터, 카드 소환(마커), Vision AI 인식이 이 함수를 공유한다.
// 릴레이 대본(guideScript)은 캐릭터별 자기소개·역할 멘트가 하드코딩돼 있어 화자만 바꾸면
// "라오나가 '저는 라옹이에요'라고 말하는" 정체성 불일치가 생긴다(실기기 버그 2026-07-20).
// 그래서 단독 진행은 [해당 캐릭터의 soloIntro] + [정체성 중립 soloGuideLines]로 새로 조립한다.

/**
 * @param {string | null | undefined} charKey 고정할 캐릭터 키 (예: 'raoni'). 유효하지 않으면 무시.
 * @param {{ guideScript: {speaker: string, text: string}[], soloGuideLines?: string[],
 *   characters: Record<string, { soloIntro?: string }> }} config CONFIG (또는 동형 객체)
 * @returns {{ speaker: string, text: string }[]} charKey가 유효하면 단독 진행 대본,
 *   유효하지 않거나 조립 결과가 비면 원본 릴레이 guideScript를 그대로 반환한다.
 */
export function buildSoloGuideScript(charKey, { guideScript, soloGuideLines, characters }) {
  const character = charKey ? characters?.[charKey] : null;
  if (!character) return guideScript;
  const lines = [
    ...(character.soloIntro ? [{ speaker: charKey, text: character.soloIntro }] : []),
    ...(soloGuideLines ?? []).map((text) => ({ speaker: charKey, text })),
  ];
  return lines.length ? lines : guideScript;
}
