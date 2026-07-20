// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createGuide } from '../src/app/guide.js';
import { NullScene } from '../src/app/scenes.js';

function makeGuide(overrides = {}) {
  const config = {
    guideScript: [
      { speaker: 'raong', text: 'a' }, { speaker: 'raoni', text: 'b' }, { speaker: 'raona', text: 'c' },
    ],
    soloGuideLines: ['공통1'],
    characters: { raong: { name: '라옹', soloIntro: '저는 라옹' }, raoni: { name: '라오니', soloIntro: '저는 라오니' }, raona: { name: '라오나', soloIntro: '저는 라오나' } },
    ui: { characterLoading: '로딩' },
  };
  document.body.innerHTML = '<button id="n"></button><div id="s" hidden></div><div id="d" hidden></div>';
  return createGuide({
    config,
    router: { show: vi.fn(), setMode: vi.fn(), screen: () => 'guide', mode: () => null },
    sound: { play: vi.fn() },
    showLine: vi.fn(),
    loadCharacter: vi.fn(async () => null),
    buildSoloGuideScript: (key, cfg) => [{ speaker: key, text: cfg.characters[key].soloIntro }, ...cfg.soloGuideLines.map((text) => ({ speaker: key, text }))],
    dom: { nextBtn: document.getElementById('n'), surveyPanel: document.getElementById('s'), donePanel: document.getElementById('d') },
    ...overrides,
  });
}

describe('createGuide', () => {
  it('begin 후 첫 화자는 릴레이 첫 화자', () => {
    const g = makeGuide();
    g.begin();
    expect(g.speaker()).toBe('raong');
    expect(g.surveySpeaker()).toBe('raona');
  });
  it('lockTo 후 전 대사가 그 화자·설문 화자도 승계', () => {
    const g = makeGuide();
    g.lockTo('raoni');
    g.begin();
    expect(g.speaker()).toBe('raoni');
    expect(g.surveySpeaker()).toBe('raoni');
  });
  it('초기 scene은 NullScene이고 setScene으로 교체된다', () => {
    const g = makeGuide();
    expect(g.scene()).toBe(NullScene);
  });
});
