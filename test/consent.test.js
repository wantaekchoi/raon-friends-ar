import { describe, it, expect } from 'vitest';
import { buildFormBody, validateAnswer } from '../src/survey.js';

describe('개인정보 동의 검증', () => {
  const consentQ = { key: 'privacyConsent', type: 'consent', required: true };

  it('미동의(빈 값)면 통과 불가', () => {
    expect(validateAnswer(consentQ, '').valid).toBe(false);
    expect(validateAnswer(consentQ, undefined).valid).toBe(false);
  });

  it('동의값이 있으면 통과', () => {
    expect(validateAnswer(consentQ, '동의합니다').valid).toBe(true);
  });
});

describe('buildFormBody 기타 옵션 규격', () => {
  const entries = { highlight: 'entry.100', name: 'entry.200' };
  const otherValues = { highlight: ['기타', 'Other'] };

  it('기타 값은 __other_option__ + other_option_response 쌍으로 변환', () => {
    const body = buildFormBody(entries, { highlight: '기타' }, otherValues);
    const p = new URLSearchParams(body);
    expect(p.get('entry.100')).toBe('__other_option__');
    expect(p.get('entry.100.other_option_response')).toBe('기타');
  });

  it('일반 옵션은 그대로 전송', () => {
    const body = buildFormBody(entries, { highlight: 'AR 캐릭터', name: '홍길동' }, otherValues);
    const p = new URLSearchParams(body);
    expect(p.get('entry.100')).toBe('AR 캐릭터');
    expect(p.get('entry.200')).toBe('홍길동');
  });
});
