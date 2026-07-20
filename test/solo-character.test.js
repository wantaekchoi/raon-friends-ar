import { describe, it, expect } from 'vitest';
import { buildSoloGuideScript } from '../src/solo-character.js';
import { STRINGS } from '../src/i18n.js';

const relayScript = [
  { speaker: 'raong', text: '안녕' },
  { speaker: 'raoni', text: '안내' },
  { speaker: 'raona', text: '설문' },
];
const config = {
  guideScript: relayScript,
  soloGuideLines: ['환영해요', '설문 부탁해요'],
  characters: {
    raong: { name: '라옹', soloIntro: '저는 라옹이에요' },
    raoni: { name: '라오니', soloIntro: '저는 라오니예요' },
    raona: { name: '라오나', soloIntro: '저는 라오나예요' },
  },
};

describe('buildSoloGuideScript', () => {
  it('유효한 charKey면 [soloIntro + soloGuideLines] 대본을 그 화자로 조립한다', () => {
    expect(buildSoloGuideScript('raoni', config)).toEqual([
      { speaker: 'raoni', text: '저는 라오니예요' },
      { speaker: 'raoni', text: '환영해요' },
      { speaker: 'raoni', text: '설문 부탁해요' },
    ]);
  });

  it('charKey가 없거나(null/undefined/빈 문자열) 미등록 키면 릴레이 원본을 그대로 반환한다', () => {
    expect(buildSoloGuideScript(null, config)).toBe(relayScript);
    expect(buildSoloGuideScript(undefined, config)).toBe(relayScript);
    expect(buildSoloGuideScript('', config)).toBe(relayScript);
    expect(buildSoloGuideScript('unknown', config)).toBe(relayScript);
  });

  it('soloIntro·soloGuideLines가 모두 비면 빈 대본 대신 릴레이 원본으로 폴백한다', () => {
    const bare = { guideScript: relayScript, soloGuideLines: [], characters: { raong: {} } };
    expect(buildSoloGuideScript('raong', bare)).toBe(relayScript);
  });

  it('원본 배열·객체는 변경하지 않는다(불변)', () => {
    const snapshot = JSON.parse(JSON.stringify(config));
    buildSoloGuideScript('raong', config);
    expect(JSON.parse(JSON.stringify(config))).toEqual(snapshot);
  });
});

// ===========================================================================
// 정체성 회귀 방지 — "라오나를 소환했는데 '저는 라옹이에요'라고 말하는" 실기기 버그(2026-07-20)를
// 기기 없이 잡기 위한 실제 STRINGS 기반 검사. 대본·번역을 고칠 때 이 불변식이 지켜져야 한다.
// ===========================================================================
const selfIntroPattern = (name) =>
  new RegExp(`(저는[^.!?]*${name})|(${name}(이에요|예요|입니다))|(I'?m ${name})|(I am ${name})`);

describe('대본 정체성 불변식 (실제 STRINGS)', () => {
  for (const [lang, S] of Object.entries(STRINGS)) {
    const cfg = { guideScript: S.guideScript, soloGuideLines: S.soloGuideLines, characters: S.characters };
    const keys = Object.keys(S.characters);

    for (const key of keys) {
      it(`[${lang}] ${key} 단독 대본에 다른 캐릭터의 자기소개·이름이 없다`, () => {
        const solo = buildSoloGuideScript(key, cfg);
        expect(solo.length).toBeGreaterThan(0);
        for (const line of solo) {
          expect(line.speaker).toBe(key);
          for (const other of keys.filter((k) => k !== key)) {
            expect(line.text.includes(S.characters[other].name)).toBe(false);
          }
        }
      });

      it(`[${lang}] ${key} 단독 대본 첫 줄(soloIntro)은 자기 이름으로 자기소개한다`, () => {
        const solo = buildSoloGuideScript(key, cfg);
        expect(solo[0].text).toMatch(selfIntroPattern(S.characters[key].name));
      });
    }

    it(`[${lang}] 릴레이 대본의 1인칭 자기소개는 화자와 이름이 일치한다`, () => {
      for (const line of S.guideScript) {
        for (const key of keys) {
          if (selfIntroPattern(S.characters[key].name).test(line.text)) {
            expect(line.speaker).toBe(key);
          }
        }
      }
    });

    it(`[${lang}] soloGuideLines는 정체성 중립이다(캐릭터 이름 미포함)`, () => {
      for (const text of S.soloGuideLines) {
        for (const key of keys) {
          expect(text.includes(S.characters[key].name)).toBe(false);
        }
      }
    });
  }
});
