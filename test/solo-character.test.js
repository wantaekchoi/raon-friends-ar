import { describe, it, expect } from 'vitest';
import { lockGuideScriptToCharacter } from '../src/solo-character.js';

const script = [
  { speaker: 'raong', text: '안녕' },
  { speaker: 'raoni', text: '안내' },
  { speaker: 'raona', text: '설문' },
];
const characters = { raong: {}, raoni: {}, raona: {} };

describe('lockGuideScriptToCharacter', () => {
  it('유효한 charKey면 모든 라인의 speaker를 charKey로 교체한다', () => {
    const result = lockGuideScriptToCharacter(script, 'raoni', characters);
    expect(result).toEqual([
      { speaker: 'raoni', text: '안녕' },
      { speaker: 'raoni', text: '안내' },
      { speaker: 'raoni', text: '설문' },
    ]);
  });

  it('원본 text 내용은 그대로 유지된다(순서·글자 변경 없음)', () => {
    const result = lockGuideScriptToCharacter(script, 'raona', characters);
    expect(result.map((l) => l.text)).toEqual(['안녕', '안내', '설문']);
  });

  it('원본 guideScript 배열/객체는 변경하지 않는다(불변)', () => {
    const original = JSON.parse(JSON.stringify(script));
    lockGuideScriptToCharacter(script, 'raong', characters);
    expect(script).toEqual(original);
  });

  it('charKey가 없으면(null/undefined) 원본을 그대로 반환한다', () => {
    expect(lockGuideScriptToCharacter(script, null, characters)).toBe(script);
    expect(lockGuideScriptToCharacter(script, undefined, characters)).toBe(script);
  });

  it('charKey가 characters에 없는 키면(예: unknown) 원본을 그대로 반환한다', () => {
    expect(lockGuideScriptToCharacter(script, 'unknown', characters)).toBe(script);
    expect(lockGuideScriptToCharacter(script, 'not-a-character', characters)).toBe(script);
  });

  it('빈 문자열 charKey는 falsy로 취급해 원본을 그대로 반환한다', () => {
    expect(lockGuideScriptToCharacter(script, '', characters)).toBe(script);
  });
});
