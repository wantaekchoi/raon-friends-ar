// 안내(가이드)·설문 진행 흐름 — main.js에 흩어져 있던 로직을 기계적으로 이동했다(Task 9,
// 셸 재작성 스펙). flow(대본 진행)·activeScene(3D 씬 참조)·characterCache(캐릭터 로딩 캐시)를
// 이 모듈이 전담 소유하고, main.js는 여기서 제공하는 메서드만 호출한다. 동작은 원본 main.js와
// 동일해야 한다(새 설계 금지) — 브리프가 명시한 인터페이스(begin/lockTo/next/setScene/scene/
// speaker/surveySpeaker/ensureCharacter/startSurvey)에 더해, main.js에 남는 배선(오버레이 진입
// 완료 시점의 렌더·XR 복귀·QuickLook·비-AR 직행 설문)을 위해 최소한만 추가로 노출한다:
// renderGuide/reactionsFor/loadedCharacter/screen. 전부 원본에 있던 호출부를 그대로 옮기기 위한
// 것일 뿐 새 동작을 만들지 않는다(각 사용처는 main.js 쪽 주석 참조).
import { createFlow, SCREENS } from '../flow.js';
import { NullScene } from './scenes.js';

export function createGuide({ config, router, sound, showLine, loadCharacter, buildSoloGuideScript, dom }) {
  let lockedCharacter = null; // 원본 main.js의 guideSpeakerLock
  let flow = createFlow(config.guideScript);

  // 현재 캐릭터 배턴터치 호출을 받는 활성 씬 — 기본은 NullScene. main.js가 오버레이/WebXR
  // 진입 시 setScene()으로 교체한다.
  let activeScene = NullScene;

  // 캐릭터 배턴터치: 최초 필요 시점에만 로드하고 이후엔 캐시에서 재사용한다.
  const characterCache = new Map();
  let currentSpeaker = null;
  let characterLoading = false;

  function syncScreen() {
    router.show(flow.screen);
  }

  function renderGuide() {
    if (flow.screen !== SCREENS.GUIDE) return;
    showLine(flow.line);
    dom.nextBtn.hidden = false;
  }

  // speaker가 currentSpeaker와 다를 때만 로드/전환한다. 로드 중 중복 클릭 방지를 위해
  // characterLoading 플래그로 btn-next를 잠근다. (main.js ensureCharacter 그대로 이동)
  async function ensureCharacter(speaker) {
    if (activeScene === NullScene || speaker === currentSpeaker) return;

    characterLoading = true;
    dom.nextBtn.disabled = true;

    let model = characterCache.get(speaker);
    if (!model) {
      // 행사장 네트워크에서 fbx 로딩이 길어질 수 있음 — 무응답처럼 보이지 않게 대기 문구 표시
      showLine({ speaker, text: config.ui.characterLoading });
      model = await loadCharacter(speaker);
      if (model) characterCache.set(speaker, model);
    }
    if (model) {
      activeScene.setCharacter(model);
      activeScene.playEntrance();
      sound.play('pop'); // 등장 효과음
      // 등장 바운스(700ms)가 끝난 직후 손 흔들며 인사. asScene()은 호출될 때마다 새 래퍼
      // 객체를 만들기 때문에(app/scenes.js) 래퍼 신원 비교는 같은 씬이 유지돼도 깨질 수
      // 있다(리뷰 지적) — 원본 구현체(scene.raw)는 실제로 씬이 바뀔 때만 달라지므로 이걸로
      // 비교한다. 800ms 사이 씬이 전환됐으면 발화하지 않는다.
      const rawAtLoad = activeScene.raw;
      setTimeout(() => {
        if (rawAtLoad === activeScene.raw) activeScene.playMotion('wave');
      }, 800);
    }

    currentSpeaker = speaker;
    characterLoading = false;
    dom.nextBtn.disabled = false;
  }

  // ?char=<key>(URL 파라미터), 카드 소환(마커), Vision AI 인식이 공유하는 단독 진행 고정.
  // config.characters에 없는 키는 조용히 무시한다(원본 main.js 모듈 스코프의
  // `if (soloCharParam && CONFIG.characters[soloCharParam])` 검증과 동일 — buildSoloGuideScript
  // 자체도 잘못된 키에는 릴레이 대본을 그대로 반환하므로 결과적으로 일관된다).
  function lockTo(charKey) {
    if (config.characters?.[charKey]) lockedCharacter = charKey;
    flow = createFlow(buildSoloGuideScript(charKey, config));
  }

  // 릴레이(또는 사전 고정된) 대본으로 flow를 새로 만들고 시작해 화면을 guide로 전환한다.
  // renderGuide()는 여기서 호출하지 않는다 — 오버레이 진입 경로는 activeScene이 아직
  // NullScene인 이 시점과 캐릭터 로딩이 끝난 시점 사이에 실제 시간차가 있어(카메라 권한 등),
  // 원본처럼 ensureCharacter 완료 후에 별도로 renderGuide()를 불러야 로딩 문구가 실제 대사를
  // 덮어쓰는 순서 역전이 생기지 않는다(마커 플로우처럼 즉시 렌더가 필요한 경우는 호출부가
  // begin() 직후 renderGuide()를 이어서 부른다).
  function begin() {
    const script = lockedCharacter ? buildSoloGuideScript(lockedCharacter, config) : config.guideScript;
    flow = createFlow(script);
    flow.start();
    syncScreen();
  }

  function surveySpeaker() {
    return lockedCharacter ?? 'raona'; // 기본은 라오나, 단독 진행이면 그 캐릭터가 승계
  }

  // A팩 별점 리액션 — 문항 확정 시 캐릭터가 반응한다 (4~5점 신남 / 1~2점 시무룩→힘내기 / 3점 무반응)
  // AR 설문(startSurvey)과 비-AR 직행 설문(main.js startDirectSurvey) 양쪽이 공유한다 — 직행
  // 설문에서는 activeScene이 NullScene 그대로라 재생 호출은 조용히 no-op된다.
  function reactionsFor() {
    return {
      onAnswer(key, value) {
        if (key !== 'rating') return;
        const n = Number(value);
        if (n >= 4) {
          activeScene.playMotion('cheer');
          activeScene.burst('heart');
          sound.play('twinkle');
        } else if (n <= 2) {
          activeScene.playMotion('sad');
          setTimeout(() => activeScene.playMotion('wave'), 1100); // 시무룩 후 다시 힘내기
        }
      },
    };
  }

  // handlers: { submitAndRetry(answers, {onMessage}), renderSurvey, questions, onRevealDone, onDone }
  // submitAndRetry/onRevealDone/onDone은 main.js가 자신만의 DOM(구글폼 링크·캡처 버튼·재시작
  // 버튼·키오스크 타이머)을 이미 클로저에 담아 넘긴다 — 이 모듈은 survey-panel/done-panel과
  // 화자·flow 상태만 책임진다.
  async function startSurvey(handlers) {
    const { submitAndRetry, renderSurvey, questions, onRevealDone, onDone } = handlers;
    const speaker = surveySpeaker();
    await ensureCharacter(speaker);
    showLine({ speaker, text: config.ui.surveyBubbleText });
    dom.surveyPanel.hidden = false;
    renderSurvey(dom.surveyPanel, questions, async (answers) => {
      dom.surveyPanel.hidden = true;
      dom.donePanel.hidden = false;
      onRevealDone?.(); // 구글폼 폴백 링크·캡처 버튼 노출 — 전송 성공 여부와 무관하게 즉시

      await submitAndRetry(answers, {
        onMessage: (text) => showLine({ speaker, text }),
      });

      flow.finishSurvey();
      syncScreen();
      await ensureCharacter(speaker); // 완료 화면도 진행 캐릭터가 인사
      showLine({ speaker, text: config.ui.doneMessage });
      // 마커 모드는 NullScene 위에서 진행되므로 이 호출들은 조용히 no-op된다
      activeScene.playMotion('jump'); // 감사 인사와 함께 기쁨의 점프
      sound.play('boing');
      activeScene.burst('heart');
      onDone?.(); // 재시작 버튼 노출 + 키오스크 타이머 무장
    }, { ...reactionsFor(), lang: config.lang });
  }

  // 기존 btn-next 클릭 핸들러 본문 그대로. surveyHandlers는 SURVEY 화면으로 넘어갈 때만
  // startSurvey에 그대로 전달된다(그 외 분기에서는 무시돼도 무해).
  async function next(surveyHandlers) {
    if (characterLoading) return;
    sound.play('tap');
    flow.next();
    syncScreen();
    if (flow.screen === SCREENS.GUIDE) {
      await ensureCharacter(flow.line.speaker);
      renderGuide();
    } else if (flow.screen === SCREENS.SURVEY) {
      dom.nextBtn.hidden = true;
      startSurvey(surveyHandlers);
    }
  }

  return {
    begin,
    lockTo,
    next,
    setScene(scene) { activeScene = scene; },
    scene() { return activeScene; },
    speaker() { return flow.line?.speaker ?? null; },
    surveySpeaker,
    ensureCharacter,
    startSurvey,
    renderGuide,
    reactionsFor,
    // 브라우저 뒤로가기(popstate)가 "아직 시작 전인지"를 판단하는 데 쓴다(main.js) — 원본의
    // `flow.screen !== SCREENS.START` 검사를 그대로 옮긴 것.
    screen() { return flow.screen; },
    // XR 세션 복귀(btn-xr onEnd)·AR Quick Look 버튼이 "지금 로드돼 있는 캐릭터"를 참조하기
    // 위한 접근자 — 원본의 characterCache.get(currentSpeaker)/currentSpeaker를 그대로 옮긴 것.
    // speaker()(=flow상의 현재 대사 화자)와 달리 이건 "실제로 3D 로드가 끝난" 화자다.
    loadedCharacter() { return { key: currentSpeaker, model: characterCache.get(currentSpeaker) }; },
  };
}
