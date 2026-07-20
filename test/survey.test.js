// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildFormBody, validateAnswer, submitSurvey, renderSurvey } from '../src/survey.js';

describe('buildFormBody', () => {
  const entries = {
    name: 'entry.1111111',
    org: 'entry.2222222',
    contact: 'entry.3333333',
    rating: 'entry.4444444',
  };

  it('매핑된 entry ID로 answers를 URLSearchParams 문자열로 변환한다', () => {
    const body = buildFormBody(entries, { name: '홍길동', org: '플랫폼개발팀', rating: 5 });
    const params = new URLSearchParams(body);
    expect(params.get('entry.1111111')).toBe('홍길동');
    expect(params.get('entry.2222222')).toBe('플랫폼개발팀');
    expect(params.get('entry.4444444')).toBe('5');
  });

  it('빈 값(미응답 선택 문항)은 제외한다', () => {
    const body = buildFormBody(entries, { name: '홍길동', org: '팀', contact: '', rating: 5 });
    const params = new URLSearchParams(body);
    expect(params.has('entry.3333333')).toBe(false);
  });

  it('공백뿐인 값도 제외한다', () => {
    const body = buildFormBody(entries, { name: '홍길동', org: '팀', contact: '   ', rating: 5 });
    const params = new URLSearchParams(body);
    expect(params.has('entry.3333333')).toBe(false);
  });

  it('null/undefined 값도 제외한다', () => {
    const body = buildFormBody(entries, { name: '홍길동', org: '팀', contact: undefined, rating: null });
    const params = new URLSearchParams(body);
    expect(params.has('entry.3333333')).toBe(false);
    expect(params.has('entry.4444444')).toBe(false);
  });
});

describe('validateAnswer', () => {
  it('필수 문항이 비어있으면 invalid', () => {
    const q = { key: 'name', type: 'text', required: true };
    expect(validateAnswer(q, '').valid).toBe(false);
    expect(validateAnswer(q, '   ').valid).toBe(false);
    expect(validateAnswer(q, undefined).valid).toBe(false);
  });

  it('필수 문항에 값이 있으면 valid', () => {
    const q = { key: 'name', type: 'text', required: true };
    expect(validateAnswer(q, '홍길동').valid).toBe(true);
  });

  it('선택 문항은 비어있어도 valid', () => {
    const q = { key: 'contact', type: 'text', required: false };
    expect(validateAnswer(q, '').valid).toBe(true);
  });

  it('별점은 1~5 정수만 valid', () => {
    const q = { key: 'rating', type: 'rating', required: true };
    expect(validateAnswer(q, 1).valid).toBe(true);
    expect(validateAnswer(q, 5).valid).toBe(true);
    expect(validateAnswer(q, 3).valid).toBe(true);
    expect(validateAnswer(q, 0).valid).toBe(false);
    expect(validateAnswer(q, 6).valid).toBe(false);
    expect(validateAnswer(q, 2.5).valid).toBe(false);
    expect(validateAnswer(q, undefined).valid).toBe(false);
  });

  it('선택형(rating) 필수 아니면 미응답 valid, 응답 시 범위 검증', () => {
    const q = { key: 'rating', type: 'rating', required: false };
    expect(validateAnswer(q, undefined).valid).toBe(true);
    expect(validateAnswer(q, 7).valid).toBe(false);
  });
});

describe('submitSurvey', () => {
  it('formId가 REPLACE_ME면 전송을 생략한다', async () => {
    const config = { formId: 'REPLACE_ME', entries: { name: 'entry.1111111' } };
    const fetchFn = vi.fn();
    const result = await submitSurvey(config, { name: '홍길동' }, fetchFn);
    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('formId가 있으면 formResponse 엔드포인트로 no-cors POST한다', async () => {
    const fetchFn = vi.fn().mockResolvedValue({});
    const config = { formId: '1FAIpQLTest', entries: { name: 'entry.1111111' } };
    const result = await submitSurvey(config, { name: '홍길동' }, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe('https://docs.google.com/forms/d/e/1FAIpQLTest/formResponse');
    expect(options.method).toBe('POST');
    expect(options.mode).toBe('no-cors');
    expect(options.body).toContain('entry.1111111=');
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
  });

  it('첫 시도 실패 시 1회 재시도해서 성공하면 ok:true', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('network fail'))
      .mockResolvedValueOnce({});
    const config = { formId: '1FAIpQLTest', entries: { name: 'entry.1111111' } };
    const result = await submitSurvey(config, { name: '홍길동' }, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('재시도까지 실패하면 ok:false를 반환한다', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network fail'));
    const config = { formId: '1FAIpQLTest', entries: { name: 'entry.1111111' } };
    const result = await submitSurvey(config, { name: '홍길동' }, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
  });
});

describe('F1 다국어 — lang 옵션', () => {
  it('validateAnswer: lang을 생략하면 기본 ko 메시지', () => {
    const q = { key: 'rating', type: 'rating', required: true };
    expect(validateAnswer(q, undefined).message).toBe('별점을 선택해주세요');
  });

  it("validateAnswer: lang='en'이면 영문 메시지", () => {
    const q = { key: 'rating', type: 'rating', required: true };
    expect(validateAnswer(q, undefined, 'en').message).toBe('Please select a rating');
    const q2 = { key: 'name', type: 'text', required: true };
    expect(validateAnswer(q2, '', 'en').message).toBe('This field is required');
  });

  it("renderSurvey: lang='en'이면 placeholder·버튼·별점 aria-label이 영문으로 렌더된다", () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [
      { key: 'rating', label: 'Rating', type: 'rating', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
    ];
    renderSurvey(container, questions, () => {}, { lang: 'en' });

    expect(container.querySelector('.survey-next-btn').textContent).toBe('Next ▶');
    expect(container.querySelector('[data-rating="1"]').getAttribute('aria-label')).toBe('1 out of 5 stars');
    container.querySelector('[data-rating="5"]').click();
    container.querySelector('.survey-next-btn').click();
    expect(container.querySelector('.survey-input').placeholder).toBe('Please enter');
  });

  it("renderSurvey: 마지막 문항 제출 버튼은 lang='en'일 때 'Submit'", () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [{ key: 'name', label: 'Name', type: 'text', required: true }];
    renderSurvey(container, questions, () => {}, { lang: 'en' });

    expect(container.querySelector('.survey-next-btn').textContent).toBe('Submit');
  });
});

describe('renderSurvey onAnswer', () => {
  it('별점 문항 확정 시 onAnswer(key, value)를 발화한다', () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [{ key: 'rating', label: '만족도', type: 'rating', required: true }];
    const onAnswer = vi.fn();
    const onComplete = vi.fn();

    renderSurvey(container, questions, onComplete, { onAnswer });
    container.querySelector('[data-rating="5"]').click();
    container.querySelector('.survey-next-btn').click();

    expect(onAnswer).toHaveBeenCalledWith('rating', 5);
    expect(onComplete).toHaveBeenCalledWith({ rating: 5 });
  });

  it('여러 문항을 순서대로 확정할 때마다 onAnswer가 각각 발화한다', () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [
      { key: 'name', label: '이름', type: 'text', required: true },
      { key: 'rating', label: '만족도', type: 'rating', required: true },
    ];
    const onAnswer = vi.fn();
    const onComplete = vi.fn();

    renderSurvey(container, questions, onComplete, { onAnswer });
    container.querySelector('.survey-input').value = '홍길동';
    container.querySelector('.survey-next-btn').click();
    container.querySelector('[data-rating="2"]').click();
    container.querySelector('.survey-next-btn').click();

    expect(onAnswer).toHaveBeenNthCalledWith(1, 'name', '홍길동');
    expect(onAnswer).toHaveBeenNthCalledWith(2, 'rating', 2);
    expect(onComplete).toHaveBeenCalledWith({ name: '홍길동', rating: 2 });
  });

  it('onAnswer 생략 시 기본 no-op으로 동작해 에러가 나지 않는다', () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [{ key: 'name', label: '이름', type: 'text', required: true }];
    const onComplete = vi.fn();

    renderSurvey(container, questions, onComplete);
    container.querySelector('.survey-input').value = '홍길동';
    expect(() => container.querySelector('.survey-next-btn').click()).not.toThrow();
    expect(onComplete).toHaveBeenCalledWith({ name: '홍길동' });
  });

  it('유효성 검증 실패 시에는 onAnswer가 발화하지 않는다', () => {
    document.body.innerHTML = '<div id="panel"></div>';
    const container = document.getElementById('panel');
    const questions = [{ key: 'name', label: '이름', type: 'text', required: true }];
    const onAnswer = vi.fn();
    const onComplete = vi.fn();

    renderSurvey(container, questions, onComplete, { onAnswer });
    container.querySelector('.survey-next-btn').click(); // 빈 값 그대로 제출 시도

    expect(onAnswer).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
