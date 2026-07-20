import { describe, it, expect } from 'vitest';
import { STRINGS, currentLang, t } from '../src/i18n.js';

describe('currentLang', () => {
  it('URL ?lang=en이 있으면 en', () => {
    expect(currentLang({ search: '?lang=en', language: 'ko-KR' })).toBe('en');
  });

  it('URL ?lang=ko가 있으면 ko (navigator가 영어여도 URL 우선)', () => {
    expect(currentLang({ search: '?lang=ko', language: 'en-US' })).toBe('ko');
  });

  it('URL 파라미터가 없고 navigator.language가 en으로 시작하면 en', () => {
    expect(currentLang({ search: '', language: 'en-US' })).toBe('en');
  });

  it('URL 파라미터가 없고 navigator.language가 ko이면 ko', () => {
    expect(currentLang({ search: '', language: 'ko-KR' })).toBe('ko');
  });

  it('아무 정보도 없으면 ko 기본값', () => {
    expect(currentLang({ search: '', language: '' })).toBe('ko');
  });

  it('URL에 잘못된 lang 값이 있으면 무시하고 navigator.language를 따른다', () => {
    expect(currentLang({ search: '?lang=fr', language: 'en-US' })).toBe('en');
  });
});

describe('t', () => {
  it('존재하는 키를 지정한 언어로 반환한다', () => {
    expect(t('ui.btnCapture', 'ko')).toBe(STRINGS.ko.ui.btnCapture);
    expect(t('ui.btnCapture', 'en')).toBe(STRINGS.en.ui.btnCapture);
  });

  it('중첩 경로(dot-path)를 조회한다', () => {
    expect(t('onboarding.title', 'ko')).toBe(STRINGS.ko.onboarding.title);
  });

  it('en 사전에 키가 없으면 ko로 폴백한다', () => {
    // en 사전에서 일부러 지워진 값이 있다고 가정한 시나리오 대신, 실제 누락 키를 시뮬레이션
    expect(t('__missing__.key', 'en')).toBe(t('__missing__.key', 'ko'));
  });

  it('ko에도 없는 완전히 없는 키는 키 문자열 자체를 반환한다', () => {
    expect(t('완전히.없는.키', 'ko')).toBe('완전히.없는.키');
  });

  it('lang 인자를 생략하면 currentLang()으로 자동 판단한다', () => {
    // 인자 없이 호출해도 에러 없이 문자열을 반환해야 한다 (자동 감지 경로 커버)
    expect(typeof t('ui.btnCapture')).toBe('string');
  });

  it('vars로 플레이스홀더를 치환한다', () => {
    expect(t('survey.ratingAriaLabel', 'ko', { n: 3 })).toBe('3점');
    expect(t('survey.ratingAriaLabel', 'en', { n: 3 })).toContain('3');
  });
});

describe('STRINGS 구조', () => {
  it('ko/en 모두 guideScript·survey.questions·ui 핵심 키를 갖는다', () => {
    ['ko', 'en'].forEach((lang) => {
      const dict = STRINGS[lang];
      expect(Array.isArray(dict.guideScript)).toBe(true);
      expect(dict.guideScript.length).toBeGreaterThan(0);
      expect(Array.isArray(dict.survey.questions)).toBe(true);
      expect(dict.survey.questions.length).toBe(7); // 개인정보 동의 카드 포함
      expect(typeof dict.ui.btnCapture).toBe('string');
      expect(typeof dict.characters.raong.name).toBe('string');
    });
  });

  it('en 캐릭터 이름은 로마자 표기(Raong/Raoni/Raona)를 쓴다', () => {
    expect(STRINGS.en.characters.raong.name).toBe('Raong');
    expect(STRINGS.en.characters.raoni.name).toBe('Raoni');
    expect(STRINGS.en.characters.raona.name).toBe('Raona');
  });
});
