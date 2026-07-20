import { describe, it, expect } from 'vitest';
import { createFlow, SCREENS } from '../src/flow.js';

const script = [
  { speaker: 'raong', text: '안녕' },
  { speaker: 'raong', text: '환영' },
];

describe('createFlow', () => {
  it('시작 상태는 START', () => {
    expect(createFlow(script).screen).toBe(SCREENS.START);
  });

  it('start()로 GUIDE 진입, 첫 멘트 노출', () => {
    const f = createFlow(script);
    f.start();
    expect(f.screen).toBe(SCREENS.GUIDE);
    expect(f.line).toEqual(script[0]);
  });

  it('next()로 멘트 진행, 마지막 멘트 이후 SURVEY', () => {
    const f = createFlow(script);
    f.start();
    f.next();
    expect(f.line).toEqual(script[1]);
    f.next();
    expect(f.screen).toBe(SCREENS.SURVEY);
    expect(f.line).toBeNull();
  });

  it('GUIDE가 아닐 때 next()는 무시', () => {
    const f = createFlow(script);
    f.next();
    expect(f.screen).toBe(SCREENS.START);
  });

  it('finishSurvey() → DONE, reset() → START', () => {
    const f = createFlow(script);
    f.start(); f.next(); f.next();
    f.finishSurvey();
    expect(f.screen).toBe(SCREENS.DONE);
    f.reset();
    expect(f.screen).toBe(SCREENS.START);
    expect(f.step).toBe(0);
  });
});
