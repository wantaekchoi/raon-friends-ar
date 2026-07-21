import './style.css';
import { CONFIG, SURVEY_QUESTIONS, GOOGLE_FORM } from './config.js';
import { SCREENS } from './flow.js';
import { showLine } from './ui/bubble.js';
import { loadCharacter } from './characters.js';
import { renderSurvey, submitSurvey } from './survey.js';
import { enqueue, flush, pendingCount } from './queue.js';
import { initSound } from './sound.js';
import { captureMoment } from './capture.js';
import { buildSoloGuideScript } from './solo-character.js';
import { scaledMs } from './app/timing.js';
import { createStore } from './app/store.js';
import { createRouter } from './app/router.js';
import { asScene } from './app/scenes.js';
import { createGuide } from './app/guide.js';
import { initEntry } from './app/entry.js';
import { bindLabels } from './app/labels.js';
import { initStartScreen } from './app/start-screen.js';

// ===========================================================================
// 전역 에러 가드 (D3) — 예상 못 한 예외/거부 프로미스로 앱이 멈춰도 사용자에게
// "라옹이가 넘어졌어요" 화면 + 다시 시작 버튼을 보여준다. 콘솔 로그는 그대로 보존해
// 실기기 디버깅 시 원인을 추적할 수 있게 한다. 최대한 이른 시점에 등록해야 이후 코드에서
// 발생하는 에러도 놓치지 않는다 — import 직후, 다른 어떤 초기화보다도 먼저 등록한다
// (원본은 사운드·언어토글 초기화 다음이었지만 그 둘도 예외를 던질 수 있으므로 더 앞으로 당겼다).
// ===========================================================================
let errorScreenShown = false;
function showErrorScreen(err) {
  console.error('전역 에러 가드 포착:', err);
  if (errorScreenShown) return; // 중복 표시 방지(같은 에러가 반복 발생해도 화면은 1회만)
  errorScreenShown = true;
  try {
    guide.scene().stopCamera(); // 크래시 상황에서도 카메라 스트림은 반드시 해제
  } catch {
    // stopCamera 자체가 실패해도 에러 화면 노출은 계속 진행
  }
  const screen = document.getElementById('error-screen');
  showGoogleFormLinks(screen);
  screen.hidden = false;
  armKioskReset(); // 무인 부스에서도 자동으로 회복되도록
}
window.addEventListener('error', (e) => showErrorScreen(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showErrorScreen(e.reason));

const sound = initSound();

// 화면·모드 전환의 단일 소유자(셸 재작성 스펙 §2) — 이 파일 안에서 data-screen/data-mode를
// 직접 만지거나 인라인 style로 화면을 토글하지 않는다. 전부 router를 거친다.
const router = createRouter(document.body);

// URL 파라미터(D4 키오스크 모드·E2 매직미러·F1 ?char=) 파싱의 단일 소유자.
const store = createStore();

// 안내·설문 진행 전체(flow·화자 고정·캐릭터 로딩 캐시·3D 씬 참조)를 소유하는 모듈(Task 9).
// main.js는 이 인스턴스가 제공하는 메서드로만 진행 상태를 다룬다.
const guide = createGuide({
  config: CONFIG,
  router,
  sound,
  showLine,
  loadCharacter,
  buildSoloGuideScript,
  dom: {
    nextBtn: document.getElementById('btn-next'),
    surveyPanel: document.getElementById('survey-panel'),
    donePanel: document.getElementById('done-panel'),
  },
});
// ?char=raoni처럼 유효한 캐릭터 키가 주어지면 배턴터치 없이 그 캐릭터가 안내 전체를 단독
// 진행한다(soloIntro + 정체성 중립 soloGuideLines로 대본을 새로 조립 — solo-character.js의
// 공통 로직. 카드 소환·Vision AI 인식 성공 시에도 동일한 함수를 쓴다). 유효하지 않은 키는
// guide.lockTo 내부에서 조용히 무시된다.
guide.lockTo(store.get('charParam'));

bindLabels(CONFIG);

// ===========================================================================
// 구글 폼 직접 링크 (F3) — formId가 실제로 채워져 있을 때만 노출한다.
// 완료·에러·전송실패 화면 전부에서 같은 클래스(.google-form-link)를 공유해 한 번에 배선한다.
// ===========================================================================
function googleFormViewUrl() {
  const { formId } = GOOGLE_FORM;
  if (!formId || formId === 'REPLACE_ME') return null;
  return `https://docs.google.com/forms/d/e/${formId}/viewform`;
}
function showGoogleFormLinks(scopeEl) {
  const url = googleFormViewUrl();
  scopeEl.querySelectorAll('.google-form-link').forEach((a) => {
    if (url) {
      a.href = url;
      a.hidden = false;
    } else {
      a.hidden = true;
    }
  });
}

// ===========================================================================
// D4 키오스크 모드 — ?kiosk=1: DONE(또는 에러) 화면 도달 후 무입력 상태가
// CONFIG.kiosk.idleResetSec만큼 이어지면 다음 체험자를 위해 자동으로 처음 화면으로 되돌린다.
// ===========================================================================
let kioskArmed = false;
let kioskTimer = null;

function resetKioskTimer() {
  if (!store.get('kiosk') || !kioskArmed) return;
  clearTimeout(kioskTimer);
  kioskTimer = setTimeout(() => location.reload(), scaledMs((CONFIG.kiosk.idleResetSec ?? 30) * 1000));
}

function armKioskReset() {
  if (!store.get('kiosk')) return;
  kioskArmed = true;
  resetKioskTimer();
}

if (store.get('kiosk')) {
  ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, resetKioskTimer, { passive: true });
  });
}

// ===========================================================================
// 오프라인 응답 큐 (D2) — 앱 시작 시 이전 세션에서 못 보낸 응답이 있으면 조용히 재시도.
// 부팅 시 1회만 시도하면 부스 태블릿처럼 리로드 없이 오래 켜두는 기기에서 네트워크가 복구돼도
// 다음 리로드까지 수집이 밀린다(유실은 아니고 지연) — online 이벤트로도 비운다. E2E S11이 검증.
// ===========================================================================
function flushQueue() {
  flush((a) => submitSurvey(GOOGLE_FORM, a)).catch(() => {});
}
flushQueue();
window.addEventListener('online', flushQueue);

/**
 * 설문 완료 콜백에서 공통으로 쓰는 전송 로직. answers를 큐에 넣고 flush를 시도하며,
 * 큐가 완전히 비워질 때까지(=이번 응답 포함 전부 성공) 실패 시 재시도 버튼을 보여주고 기다린다.
 * AR 흐름(말풍선)과 비-AR 직행 흐름(문구 노출)이 메시지 출력·버튼 위치만 다르게 재사용한다.
 */
async function submitAndRetry(answers, { onMessage, retryParent, onFail }) {
  enqueue(answers);
  let failedOnce = false;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    await flush((a) => submitSurvey(GOOGLE_FORM, a));
    if (pendingCount() === 0) return; // 이번 응답 포함 큐가 비었다 = 전송 완료
    // 영구 네트워크 장애로 여기 갇히면 무인 부스 전체가 멈춘다 — 첫 실패 즉시 탈출구([처음으로])와
    // 키오스크 자동 리셋을 연다. 응답은 큐에 보존돼 다음 앱 로드 때 자동 재전송된다.
    if (!failedOnce) {
      failedOnce = true;
      onFail?.();
    }
    onMessage(CONFIG.ui.retryMessage);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const b = document.createElement('button');
      b.id = 'btn-retry';
      b.type = 'button';
      b.textContent = CONFIG.ui.btnRetry;
      retryParent.appendChild(b);
      b.addEventListener('click', () => { b.remove(); resolve(); }, { once: true });
    });
  }
}

// ===========================================================================
// F3 비AR 최후 폴백 — "카메라 없이 참여하기" (카메라·AR 없이도 참여 경로가 끊기지 않게).
// btn-no-camera 자체의 라벨·클릭 배선은 start-screen.js가 onDirectSurvey로 이 함수를 받아 담당한다.
// ===========================================================================
function startDirectSurvey() {
  router.show('direct-survey');

  const panel = document.getElementById('survey-panel-direct');
  renderSurvey(panel, SURVEY_QUESTIONS, async (answers) => {
    panel.hidden = true;
    const doneEl = document.getElementById('direct-done');
    const failMsgEl = document.getElementById('direct-fail-message');
    doneEl.hidden = false;
    showGoogleFormLinks(doneEl);

    await submitAndRetry(answers, {
      onMessage: (text) => { failMsgEl.textContent = text; },
      retryParent: doneEl,
      onFail: () => {
        document.getElementById('btn-direct-restart').hidden = false;
        armKioskReset();
      },
    });

    failMsgEl.textContent = '';
    doneEl.querySelector('.direct-done-message').textContent = CONFIG.ui.doneMessage;
    document.getElementById('btn-direct-restart').hidden = false;
    armKioskReset();
  }, { ...guide.reactionsFor(), lang: CONFIG.lang });
}

document.getElementById('btn-direct-restart').addEventListener('click', () => {
  location.reload();
});

// 오버레이·카드 소환·Vision 인식 3개 진입 플로우(카메라 권한·AR 세션·MindAR·Vision 인식)를
// 소유하는 모듈(Task 10). entry.overlay()/entry.markerSession()은 goHome·재시작·WebXR 버튼이
// "지금 붙어 있는 세션"을 참조하기 위한 접근자다.
const entry = initEntry({ config: CONFIG, store, guide, router, sound, onDirectSurvey: startDirectSurvey });

// 시작 화면(온보딩·캐릭터 카드·크기 칩·운영자 시트·언어·효과음 토글) + 모드 선택 버튼 배선(Task 10).
initStartScreen({
  config: CONFIG,
  store,
  sound,
  onOverlay: entry.startOverlayFlow,
  onMarker: entry.enterMarkerMode,
  onVision: entry.enterVisionMode,
  onDirectSurvey: startDirectSurvey,
});

// 🏠 홈 — AR/마커 어디서든 처음 화면으로. 카메라·세션을 정리하는 가장 안전한 방법은 reload.
function goHome() {
  try { guide.scene().stopCamera(); entry.markerSession()?.stop(); } catch { /* 정리 실패해도 리로드는 진행 */ }
  location.reload();
}
{
  const btnHome = document.getElementById('btn-home');
  const btnHomeMarker = document.getElementById('btn-home-marker');
  [btnHome, btnHomeMarker].forEach((b) => {
    b.textContent = CONFIG.ui.btnHome;
    b.setAttribute('aria-label', CONFIG.ui.btnHomeAria);
    b.addEventListener('click', goHome);
  });
}
// Android 하드웨어 뒤로가기: AR 진입 시 히스토리 한 칸을 쌓아 사이트 이탈 대신 홈으로
window.addEventListener('popstate', () => { if (guide.screen() !== SCREENS.START) goHome(); });

// AR 설문 제출 래퍼 — guide.startSurvey는 onMessage만 넘겨준다. retryParent/onFail은 main.js
// 전용 DOM(#screen-ar·btn-restart)과 키오스크 상태라 여기서 감싸 채운다(원본 startSurvey의
// submitAndRetry 호출부와 동일한 retryParent/onFail).
function guideSubmitAndRetry(answers, { onMessage }) {
  return submitAndRetry(answers, {
    onMessage,
    retryParent: document.getElementById('screen-ar'),
    onFail: () => {
      document.getElementById('btn-restart').hidden = false;
      armKioskReset();
    },
  });
}

// guide.startSurvey에 매번 넘기는 핸들러 묶음 — 원본 startSurvey 안에 있던 main.js 전용 DOM
// 조작(구글폼 폴백 링크·캡처 버튼·재시작 버튼·키오스크 타이머)을 그대로 보존한다.
const surveyHandlers = {
  submitAndRetry: guideSubmitAndRetry,
  renderSurvey,
  questions: SURVEY_QUESTIONS,
  // 설문 제출 직후(전송 성공 여부와 무관) — 완료 화면의 폼 링크는 "또 해야 하나?" 혼란을 막기
  // 위해 폴백용임을 명시하는 문구로 교체하고, 캡처 버튼을 노출한다(원본 startSurvey와 동일 시점).
  onRevealDone: () => {
    const donePanel = document.getElementById('done-panel');
    showGoogleFormLinks(donePanel);
    const doneFormLink = donePanel.querySelector('.google-form-link');
    if (doneFormLink) doneFormLink.textContent = CONFIG.ui.googleFormLinkFallback;
    document.getElementById('btn-capture').hidden = false;
  },
  // 전송 완료 + 캐릭터 인사까지 끝난 시점 — 카메라 스트림은 [처음으로]에서 해제(완료 화면의
  // [📸 기념사진]이 카메라 프레임을 쓰기 때문). 무인 운영의 발열·배터리는 키오스크 무입력
  // 리셋이 처리한다.
  onDone: () => {
    document.getElementById('btn-restart').hidden = false;
    armKioskReset();
  },
};

document.getElementById('btn-next').addEventListener('click', () => guide.next(surveyHandlers));

// 완료 화면 기념 스크린샷 (C팩) — 카메라 프레임 + 3D 캔버스 + 캡션 합성 → 공유/다운로드
document.getElementById('btn-capture').addEventListener('click', async () => {
  sound.play('tap');
  const { shared } = await captureMoment({
    videoEl: document.getElementById('camera-video'),
    canvasEl: document.getElementById('three-canvas'),
    caption: CONFIG.ui.captureCaption,
  });
  if (!shared) showLine({ speaker: guide.surveySpeaker(), text: CONFIG.ui.captureSavedMessage });
});

document.getElementById('btn-restart').addEventListener('click', () => {
  guide.scene().stopCamera(); // 리셋 직전 카메라 스트림 해제
  entry.markerSession()?.stop(); // 마커 플로우로 완주한 경우의 카메라 해제 (goHome과 동일)
  location.reload();
});
document.getElementById('btn-error-restart').addEventListener('click', () => {
  location.reload();
});

// ===========================================================================
// D: public/sw.js 오프라인 자산 캐시 등록 — 실패해도 무해(캐시 없이 기존처럼 동작).
// ===========================================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
    console.warn('서비스워커 등록 실패 — 오프라인 캐시 없이 정상 동작', err);
  });
}

// AR은 카드 소환으로 단일화(실기기 피드백 2026-07-21 "진짜 바닥에 세우기도 쳐내고 카드소환으로")
// — WebXR 바닥인식·AR Quick Look 버튼과 배선은 제거했다. 바닥 손님맞이는 대형 인쇄 카드로:
// 캐릭터 키가 카드 폭에 비례하므로(1.2×카드폭) 카드를 크게 뽑을수록 크게 선다
// (docs/cards-floor-print.pdf). scenes/webxr.js·scripts/export-usdz.mjs는 재도입 대비 보존.
router.show(guide.screen()); // 최초 로드 시 화면 상태 동기화(원본 syncScreen()의 마지막 호출)
