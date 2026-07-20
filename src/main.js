import './style.css';
import { CONFIG, SURVEY_QUESTIONS, GOOGLE_FORM } from './config.js';
import { createFlow, SCREENS } from './flow.js';
import { initOverlay } from './scenes/overlay.js';
import { isXRSupported, startXR } from './scenes/webxr.js';
import { showLine } from './ui/bubble.js';
import { loadCharacter } from './characters.js';
import { renderSurvey, submitSurvey } from './survey.js';
import { enqueue, flush, pendingCount } from './queue.js';
import { initSound } from './sound.js';
import { captureMoment } from './capture.js';
import { buildSoloGuideScript } from './solo-character.js';
import { scaledMs } from './app/timing.js';

// F1 다국어 — html lang·문서 제목을 현재 언어에 맞춘다 (CONFIG.lang은 config.js가 모듈 로드
// 시점에 currentLang()으로 이미 판별해 둔 값).
document.documentElement.lang = CONFIG.lang;
document.title = CONFIG.title;

// 효과음 (B팩) — muted 상태는 localStorage에 저장되며, 아이콘·클래스를 상태와 동기화한다.
const sound = initSound();
{
  const btnSound = document.getElementById('btn-sound');
  const syncSoundBtn = (muted) => {
    btnSound.textContent = muted ? '🔇' : '🔊';
    btnSound.classList.toggle('is-muted', muted);
    btnSound.setAttribute('aria-label', muted ? CONFIG.ui.soundOn : CONFIG.ui.soundOff);
  };
  syncSoundBtn(sound.muted);
  btnSound.addEventListener('click', () => syncSoundBtn(sound.toggle()));
}

// F1 다국어 — 시작 화면 🌐 토글. URL의 ?lang= 파라미터를 반대 언어로 바꾸고 reload한다
// (모듈 최상위에서 언어를 한 번 판별해 export하는 config.js 구조상 가장 단순하고 안전한 전환 방식).
{
  const btnLangToggle = document.getElementById('btn-lang-toggle');
  btnLangToggle.textContent = CONFIG.ui.langToggleLabel;
  btnLangToggle.setAttribute('aria-label', CONFIG.ui.langToggleAria);
  btnLangToggle.addEventListener('click', () => {
    const nextLang = CONFIG.lang === 'en' ? 'ko' : 'en';
    const url = new URL(location.href);
    url.searchParams.set('lang', nextLang);
    location.href = url.toString();
  });
}

// ===========================================================================
// 전역 에러 가드 (D3) — 예상 못 한 예외/거부 프로미스로 앱이 멈춰도 사용자에게
// "라옹이가 넘어졌어요" 화면 + 다시 시작 버튼을 보여준다. 콘솔 로그는 그대로 보존해
// 실기기 디버깅 시 원인을 추적할 수 있게 한다. 최대한 이른 시점에 등록해야
// 이후 코드에서 발생하는 에러도 놓치지 않는다.
// ===========================================================================
let errorScreenShown = false;
function showErrorScreen(err) {
  console.error('전역 에러 가드 포착:', err);
  if (errorScreenShown) return; // 중복 표시 방지(같은 에러가 반복 발생해도 화면은 1회만)
  errorScreenShown = true;
  try {
    activeScene?.stopCamera?.(); // 크래시 상황에서도 카메라 스트림은 반드시 해제
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

// ===========================================================================
// URL 파라미터 (D4 키오스크 모드 · E2 매직미러) — ?kiosk=1&size=giant&camera=user 조합으로
// 별도 페이지 없이 부스 설치형 매직 미러 모드가 성립한다.
// ===========================================================================
const urlParams = new URLSearchParams(location.search);
const KIOSK_MODE = urlParams.get('kiosk') === '1';
const soloCharParam = urlParams.get('char');
const SIZE_HEIGHTS = { life: 1.8, giant: 2.5 };
const sizeParam = urlParams.get('size');
let characterHeight = SIZE_HEIGHTS[sizeParam]; // 매칭 안 되면 undefined(기본 크기). 시작 화면 크기 칩이 덮어쓸 수 있다.
const cameraFacingParam = urlParams.get('camera') === 'user' ? 'user' : undefined;

// ?char=raoni처럼 유효한 캐릭터 키가 주어지면 배턴터치 없이 그 캐릭터가 안내 전체를 단독 진행한다.
// (soloIntro + 정체성 중립 soloGuideLines로 대본을 새로 조립 — solo-character.js의 공통 로직.
// 카드 소환·Vision AI 인식 성공 시에도 동일한 함수를 쓴다.)
// 단독 진행으로 고정된 캐릭터 — 설문·완료 단계 화자도 이 캐릭터가 승계한다(없으면 기본 라오나).
// 카드 소환·Vision 경로가 진입 시점에 설정하고, ?char=는 아래에서 즉시 설정한다.
let guideSpeakerLock = null;
const guideScript = buildSoloGuideScript(soloCharParam, CONFIG);
if (soloCharParam && CONFIG.characters[soloCharParam]) guideSpeakerLock = soloCharParam;

// Vision AI 인식으로 화자가 새로 고정되면 flow 자체를 새로 만들어 교체한다(가이드 시작 전에만
// 일어나므로 진행 중인 상태를 끊을 위험이 없다) — 그래서 const가 아니라 let이다.
let flow = createFlow(guideScript);
let overlay = null;
// 현재 캐릭터 배턴터치 호출을 받는 활성 씬 — 기본은 자이로 오버레이, WebXR 바닥인식
// 모드가 켜져있는 동안엔 webxr.js의 컨트롤러로 바뀐다. 두 씬 모두 setCharacter/playEntrance
// 인터페이스를 동일하게 노출하므로 ensureCharacter는 이 변수만 바라보면 된다.
let activeScene = null;

// 캐릭터 배턴터치: 최초 필요 시점에만 로드하고 이후엔 캐시에서 재사용한다.
const characterCache = new Map();
let currentSpeaker = null;
let characterLoading = false;

// speaker가 currentSpeaker와 다를 때만 로드/전환한다. 로드 중 중복 클릭 방지를 위해
// characterLoading 플래그로 btn-next를 잠근다.
async function ensureCharacter(speaker) {
  if (!activeScene || speaker === currentSpeaker) return;

  characterLoading = true;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.disabled = true;

  let model = characterCache.get(speaker);
  if (!model) {
    // 행사장 네트워크에서 fbx 로딩이 길어질 수 있음 — 무응답처럼 보이지 않게 대기 문구 표시
    showLine({ speaker, text: CONFIG.ui.characterLoading });
    model = await loadCharacter(speaker);
    if (model) characterCache.set(speaker, model);
  }
  if (model) {
    activeScene.setCharacter(model);
    activeScene.playEntrance();
    sound.play('pop'); // 등장 효과음
    // 등장 바운스(700ms)가 끝난 직후 손 흔들며 인사 (XR 컨트롤러엔 모션 API가 없을 수 있음).
    // 800ms 사이 씬이 전환됐으면 발화하지 않는다 — 엉뚱한 씬에 wave가 걸리는 것 방지.
    const sceneAtLoad = activeScene;
    setTimeout(() => {
      if (sceneAtLoad === activeScene) sceneAtLoad.playMotion?.('wave');
    }, 800);
  }

  currentSpeaker = speaker;
  characterLoading = false;
  nextBtn.disabled = false;
}

document.getElementById('start-title').textContent = CONFIG.title;
document.getElementById('start-subtitle').textContent = CONFIG.ui.startSubtitle;
document.getElementById('start-scarcity').textContent = CONFIG.scarcityText;
document.getElementById('btn-overlay-label').textContent = CONFIG.ui.btnOverlay;
document.getElementById('btn-marker-label').textContent = CONFIG.ui.btnMarker;
document.getElementById('btn-marker-badge').textContent = CONFIG.ui.btnMarkerBadgeSoon;
document.getElementById('btn-vision-label').textContent = CONFIG.ui.btnVision;
document.getElementById('btn-vision-badge').textContent = CONFIG.ui.btnVisionBadge;
document.getElementById('vision-hint').textContent = CONFIG.ui.visionHint;
document.getElementById('vision-error-message').textContent = CONFIG.ui.visionErrorMessage;
document.getElementById('btn-vision-fallback-overlay').textContent = CONFIG.ui.btnVisionFallbackOverlay;
document.getElementById('btn-vision-fallback-survey').textContent = CONFIG.ui.btnVisionFallbackSurvey;
document.getElementById('btn-vision-back').textContent = '←';
document.getElementById('btn-vision-back').setAttribute('aria-label', CONFIG.ui.btnVisionBackAria);
document.getElementById('hint-text').textContent = CONFIG.ui.hint;
document.getElementById('brand-line').textContent = CONFIG.ui.brandLine;
document.getElementById('marker-hint').textContent = CONFIG.ui.markerHint;
document.getElementById('btn-marker-fallback').textContent = CONFIG.ui.btnMarkerFallback;
document.getElementById('direct-survey-title').textContent = CONFIG.ui.directSurveyTitle;
document.getElementById('btn-direct-restart').textContent = CONFIG.ui.btnRestart;
document.getElementById('error-message').textContent = CONFIG.ui.errorMessage;
document.getElementById('error-img').alt = CONFIG.ui.errorImgAlt;
document.getElementById('btn-error-restart').textContent = CONFIG.ui.btnErrorRestart;
document.getElementById('btn-capture').textContent = CONFIG.ui.btnCapture;
document.getElementById('btn-restart').textContent = CONFIG.ui.btnRestart;
document.getElementById('btn-xr').textContent = CONFIG.ui.btnXR;
document.getElementById('btn-quicklook').textContent = CONFIG.ui.btnQuickLook;
document.getElementById('btn-next').textContent = CONFIG.ui.btnNext;
document.querySelectorAll('.google-form-link').forEach((a) => { a.textContent = CONFIG.ui.googleFormLink; });

document.getElementById('start-chars').innerHTML = Object.entries(CONFIG.characters)
  .map(([key, c], i) => `
    <button type="button" class="char-card char-${key}" style="--float-delay: ${i * 0.35}s" aria-label="${c.name}">
      <img src="${import.meta.env.BASE_URL}${c.img}" alt="${c.name}">
      <span class="char-name">${c.name}</span>
    </button>
  `)
  .join('');

// 캐릭터 탭하면 통통 튀는 재미 요소 (장식용, flow와 무관)
document.querySelectorAll('#start-chars .char-card').forEach((card) => {
  card.addEventListener('click', () => {
    card.classList.remove('char-bounce');
    void card.offsetWidth;
    card.classList.add('char-bounce');
  });
});


// ===========================================================================
// v1.1.0 — URL 파라미터를 몰라도 되는 인앱 메뉴 (모바일 UX)
// ①크기 칩: 방문객이 탭으로 캐릭터 크기 선택 (reload 없이 characterHeight에 반영)
// ②운영자 시트(⚙️): 키오스크·매직미러 토글 + 대시보드 — 적용 시 북마크 가능한 URL로 이동
// ===========================================================================
{
  const chipWrap = document.getElementById('size-chips');
  chipWrap.setAttribute('aria-label', CONFIG.ui.sizeChipsAria);
  const sizes = [['base', undefined], ['life', SIZE_HEIGHTS.life], ['giant', SIZE_HEIGHTS.giant]];
  const currentKey = sizeParam && SIZE_HEIGHTS[sizeParam] ? sizeParam : 'base';
  sizes.forEach(([key, height]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-chip' + (key === currentKey ? ' selected' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', key === currentKey ? 'true' : 'false');
    b.textContent = CONFIG.ui.sizeChips[key];
    b.addEventListener('click', () => {
      characterHeight = height;
      chipWrap.querySelectorAll('.size-chip').forEach((c) => {
        c.classList.toggle('selected', c === b);
        c.setAttribute('aria-checked', c === b ? 'true' : 'false');
      });
      sound.play('tap');
    });
    chipWrap.appendChild(b);
  });
}

{
  const fab = document.getElementById('btn-operator');
  const sheet = document.getElementById('operator-sheet');
  fab.textContent = '⚙️';
  fab.setAttribute('aria-label', CONFIG.ui.operatorFabAria);
  document.getElementById('operator-title').textContent = CONFIG.ui.operatorTitle;
  document.getElementById('op-kiosk-label').textContent = CONFIG.ui.opKiosk;
  document.getElementById('op-mirror-label').textContent = CONFIG.ui.opMirror;
  const dash = document.getElementById('op-dashboard');
  dash.textContent = CONFIG.ui.opDashboard;
  dash.href = `${import.meta.env.BASE_URL}dashboard.html`;
  document.getElementById('op-apply').textContent = CONFIG.ui.opApply;
  document.getElementById('op-close').textContent = CONFIG.ui.opClose;

  document.getElementById('op-kiosk').checked = KIOSK_MODE;
  document.getElementById('op-mirror').checked = cameraFacingParam === 'user';

  fab.addEventListener('click', () => { sheet.hidden = false; sound.play('tap'); });
  document.getElementById('op-close').addEventListener('click', () => { sheet.hidden = true; });
  document.getElementById('op-apply').addEventListener('click', () => {
    const url = new URL(location.href);
    ['kiosk', 'camera', 'size'].forEach((k) => url.searchParams.delete(k));
    if (document.getElementById('op-kiosk').checked) url.searchParams.set('kiosk', '1');
    if (document.getElementById('op-mirror').checked) url.searchParams.set('camera', 'user');
    const sel = document.querySelector('.size-chip.selected');
    const idx = [...document.querySelectorAll('.size-chip')].indexOf(sel);
    if (idx === 1) url.searchParams.set('size', 'life');
    if (idx === 2) url.searchParams.set('size', 'giant');
    location.href = url.toString();
  });
}

function syncScreen() {
  document.body.dataset.screen = flow.screen;
}

// ===========================================================================
// 온보딩 1장 (D4 리서치 보완 ①) — 최초 방문에만 카메라 허용→바닥 비추기→캐릭터 등장
// 3스텝을 안내한다. localStorage에 본 적 있으면 다시 띄우지 않는다.
// ===========================================================================
const ONBOARDING_SEEN_KEY = 'onboardingSeen';
function initOnboarding() {
  const el = document.getElementById('onboarding');
  document.getElementById('onboarding-title').textContent = CONFIG.onboarding.title;
  document.getElementById('onboarding-steps').innerHTML = CONFIG.onboarding.steps.map((s) => `
    <div class="onboarding-step">
      <span class="onboarding-step-icon">${s.icon}</span>
      <span class="onboarding-step-text">${s.text}</span>
    </div>
  `).join('');
  const cta = document.getElementById('btn-onboarding-start');
  cta.textContent = CONFIG.onboarding.cta;
  cta.addEventListener('click', () => {
    el.hidden = true;
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    } catch {
      // localStorage 불가 환경 — 다음 방문에도 다시 보이는 것으로 감수
    }
  }, { once: true });

  let seen = false;
  try {
    seen = localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    seen = false;
  }
  if (!seen && !KIOSK_MODE) el.hidden = false; // 무인 키오스크는 매 리셋마다 온보딩이 뜨면 방해되므로 생략
}
initOnboarding();

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
// 오프라인 응답 큐 (D2) — 앱 시작 시 이전 세션에서 못 보낸 응답이 있으면 조용히 재시도.
// ===========================================================================
flush((a) => submitSurvey(GOOGLE_FORM, a)).catch(() => {});

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

// iOS 자이로 권한 — 반드시 사용자 제스처(버튼 탭) 안에서 1회 요청해 캐시한다.
// 소환/Vision 인식처럼 타이머·콜백으로 오버레이에 진입하는 경로는 제스처가 아니라 요청이
// 조용히 거부되고, 그 결과 시점 고정(화면 중앙 박제) 폴백으로 떨어진다(실기기 피드백 2026-07-20).
let gyroGranted; // undefined = 미요청
async function ensureGyroPermission() {
  if (gyroGranted !== undefined) return gyroGranted;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function') {
      gyroGranted = (await DeviceOrientationEvent.requestPermission()) === 'granted';
    } else {
      gyroGranted = 'DeviceOrientationEvent' in window;
    }
  } catch {
    gyroGranted = false;
  }
  return gyroGranted;
}

// 카메라 권한 프롬프트 대기 중 중복 탭으로 initOverlay가 두 번 실행되는 것 방지
// (스트림·렌더러·리스너가 두 세트 생겨 리소스 누수)
let overlayEntering = false;

// 오버레이 진입 공통 흐름 — 시작 버튼과 카드 소환 전환이 함께 사용한다.
async function startOverlayFlow() {
  if (overlayEntering) return;
  overlayEntering = true;
  history.pushState({ ar: true }, ''); // 하드웨어 뒤로가기 → 홈 (사이트 이탈 방지)
  document.getElementById('btn-home').hidden = false;
  flow.start();
  syncScreen();
  const gyroOk = await ensureGyroPermission();
  overlay = await initOverlay({
    videoEl: document.getElementById('camera-video'),
    canvasEl: document.getElementById('three-canvas'),
    gyroAllowed: gyroOk,
    // E2 매직미러: size/camera 파라미터가 있을 때만 옵션을 전달한다 — overlay.js가 아직
    // 해당 옵션을 지원하지 않는 상태에서도(A팩 작업 중) 여분의 키는 무시되어 안전하다.
    ...(characterHeight !== undefined && { characterHeight }),
    ...(cameraFacingParam !== undefined && { cameraFacing: cameraFacingParam }),
  });
  activeScene = overlay;
  {
    const hintEl = document.getElementById('xr-hint');
    let hintText = null;
    if (!gyroOk) {
      hintText = CONFIG.ui.gyroOffHint;
    } else {
      // 자이로가 켜져 있어도 위치(6DoF)는 추적 불가 — 최초 1회만 행동 유도 (걸어가면 밀려나는 한계 안내)
      try {
        if (!localStorage.getItem('overlayLookHintSeen')) {
          hintText = CONFIG.ui.overlayLookHint;
          localStorage.setItem('overlayLookHintSeen', '1');
        }
      } catch { /* localStorage 불가 — 힌트 생략 */ }
    }
    if (hintText) {
      hintEl.textContent = hintText;
      hintEl.hidden = false;
      setTimeout(() => { hintEl.hidden = true; }, 5000);
    }
  }
  // 최초 진입은 항상 라옹(환영 담당) — 단, ?char=로 화자가 고정된 경우 그 캐릭터
  await ensureCharacter(flow.line.speaker);
  renderGuide();

  // WebXR hit-test 지원 기기(Android Chrome 등)에서만 "진짜 바닥에 소환" 버튼 노출.
  // 미지원 기기(iOS 등)는 isXRSupported()가 false를 반환해 버튼이 계속 숨겨진 채 —
  // 기존 자이로 오버레이 흐름과 완전히 동일하게 동작한다.
  if (await isXRSupported()) {
    document.getElementById('btn-xr').hidden = false;
  } else if (supportsQuickLook()) {
    // iOS: WebXR 대신 네이티브 AR Quick Look(진짜 6DoF 바닥 고정)으로 대칭을 맞춘다 (Task D)
    document.getElementById('btn-quicklook').hidden = false;
  }
}

// iOS Safari의 AR Quick Look 지원 감지 — rel="ar" 앵커를 지원하면 네이티브 ARKit 뷰어 사용 가능
function supportsQuickLook() {
  const a = document.createElement('a');
  return a.relList && a.relList.supports && a.relList.supports('ar');
}

// 현재 화자의 .usdz를 AR Quick Look으로 연다. rel="ar" 앵커는 <img>가 유일한 자식이어야
// 내비게이션 대신 Quick Look이 뜨므로, 보이는 버튼과 분리된 임시 앵커를 만들어 클릭한다.
document.getElementById('btn-quicklook').addEventListener('click', () => {
  sound.play('tap');
  const key = currentSpeaker || 'raong';
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = `${import.meta.env.BASE_URL}usdz/${key}.usdz`;
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById('btn-overlay').addEventListener('click', startOverlayFlow);

// 카드 하이브리드 플로우 — 마커 세션(캐릭터는 카드에 부착)을 살려둔 채 가이드·설문 UI(#screen-ar)만
// 그 위에 얹는다. overlay 전용 요소(카메라 비디오·캔버스·기념사진)는 body.marker-flow CSS로 숨긴다.
// activeScene은 null 유지 — ensureCharacter/모션 호출은 기존 null 가드로 자연스럽게 생략된다.
function startMarkerFlow(key) {
  history.pushState({ ar: true }, ''); // 하드웨어 뒤로가기 → 홈 (오버레이 플로우와 동일)
  document.body.classList.add('marker-flow');
  guideSpeakerLock = key;
  flow = createFlow(buildSoloGuideScript(key, CONFIG));
  flow.start();
  syncScreen();
  renderGuide();
}

// 🏠 홈 — AR/마커 어디서든 처음 화면으로. 카메라·세션을 정리하는 가장 안전한 방법은 reload.
function goHome() {
  try { activeScene?.stopCamera?.(); markerSession?.stop(); } catch { /* 정리 실패해도 리로드는 진행 */ }
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
window.addEventListener('popstate', () => { if (flow.screen !== SCREENS.START) goHome(); });

// ===========================================================================
// F3 비AR 최후 폴백 — "카메라 없이 참여하기" (카메라·AR 없이도 참여 경로가 끊기지 않게)
// ===========================================================================
const btnNoCamera = document.getElementById('btn-no-camera');
btnNoCamera.textContent = CONFIG.noCameraLinkText;
btnNoCamera.addEventListener('click', (e) => {
  e.preventDefault();
  startDirectSurvey();
});

function startDirectSurvey() {
  document.getElementById('screen-start').style.display = 'none';
  const screen = document.getElementById('screen-survey-direct');
  screen.style.display = 'block';

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
  }, { ...reactionsFor(), lang: CONFIG.lang });
}

document.getElementById('btn-direct-restart').addEventListener('click', () => {
  location.reload();
});

// 카드 마커 모드(MindAR) — cards.mind가 실제로 배포돼 있을 때만 버튼을 활성화한다.
// (public/targets/cards.mind가 없으면 클릭해도 initMarker()의 addImageTargets가 실패해
// 아래 catch에서 오버레이로 폴백하지만, 애초에 "준비 중" 배지를 그대로 두는 편이 UX상 낫다.)
(async () => {
  const btnMarker = document.getElementById('btn-marker');
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}targets/cards.mind`, { method: 'HEAD' });
    if (res.ok) {
      btnMarker.disabled = false;
      document.getElementById('btn-marker-badge').hidden = true;
    }
  } catch {
    // 네트워크 오류 등 — 비활성 상태 유지
  }
})();

let markerSession = null;

document.getElementById('btn-marker').addEventListener('click', enterMarkerMode);

// 중복 탭 시 MindARThree 인스턴스가 두 개 떠서 카메라를 경쟁하는 것 방지
let markerEntering = false;

// D1: mind-ar(무거운 의존성)는 카드 모드 버튼을 실제로 눌렀을 때만 로드한다 —
// 초기 번들에서 분리되는 별도 청크이므로 로딩 중임을 버튼 상태로 보여준다.
async function enterMarkerMode() {
  if (markerEntering) return;
  markerEntering = true;
  ensureGyroPermission(); // 제스처 컨텍스트에서 선요청 — 소환 후 오버레이 전환 대비 (await 안 함: 프롬프트와 병행 진행)

  const btnMarker = document.getElementById('btn-marker');
  const labelEl = document.getElementById('btn-marker-label');
  const labelBeforeLoad = labelEl.textContent;
  btnMarker.disabled = true;
  btnMarker.classList.add('btn-loading');
  labelEl.textContent = CONFIG.ui.btnMarkerLoading;

  let initMarker;
  try {
    ({ initMarker } = await import('./scenes/marker.js'));
  } catch (err) {
    console.warn('마커 모듈 로드 실패 — 준비 중 상태로 복귀', err);
    labelEl.textContent = labelBeforeLoad;
    btnMarker.classList.remove('btn-loading');
    btnMarker.disabled = false;
    markerEntering = false;
    return;
  }
  btnMarker.classList.remove('btn-loading');
  labelEl.textContent = labelBeforeLoad;

  // #screen-start의 자식(.start-content)에 걸린 z-index:1이 #screen-start 자체는
  // stacking context를 만들지 않아 body 최상위 레벨로 그대로 노출된다 — 그 결과 DOM 순서만으론
  // #screen-marker(z-index:auto)가 절대 위로 못 올라온다. 그래서 명시적으로 숨긴다.
  document.getElementById('screen-start').style.display = 'none';
  document.getElementById('screen-marker').style.display = 'block';
  const hint = document.getElementById('marker-hint');
  const fallbackBtn = document.getElementById('btn-marker-fallback');
  hint.hidden = false;
  fallbackBtn.hidden = true;

  let found = false;

  const fallbackTimer = setTimeout(() => {
    if (!found) fallbackBtn.hidden = false;
  }, scaledMs(30000));

  function fallbackToOverlay() {
    clearTimeout(fallbackTimer);
    markerSession?.stop();
    document.getElementById('screen-marker').style.display = 'none';
    document.getElementById('btn-overlay').click();
  }

  fallbackBtn.addEventListener('click', fallbackToOverlay, { once: true });

  try {
    markerSession = await initMarker({
      containerEl: document.getElementById('marker-container'),
      onTarget(key) {
        if (found) return; // 첫 인식 카드가 소환 확정 — 이후 다른 카드 인식은 무시
        found = true;
        clearTimeout(fallbackTimer);
        fallbackBtn.hidden = true;
        // 소환 확정: 마커 세션을 유지한 채 진행한다 — 카드가 보이면 캐릭터가 카드에 딱 붙고(6DoF),
        // 놓치면 화면에 남았다가 재인식 시 다시 붙는다(marker.js confirmSummon). 오버레이(3DoF)로
        // 넘기던 이전 방식은 부착감을 잃어 폐기 (부착감 계획 Task A, 실기기 피드백 2026-07-20).
        hint.hidden = false;
        hint.textContent = CONFIG.ui.markerSummoned.replace('{name}', CONFIG.characters[key].name);
        sound.play('twinkle');
        markerSession?.confirmSummon(key);
        setTimeout(() => {
          hint.hidden = true;
          startMarkerFlow(key);
        }, 1600);
      },
      // 소환 확정 후 트래킹 상태 전환 알림 — 카드를 놓치면 재부착 방법 힌트를 잠깐 보여준다
      onHoldChange(tracked) {
        if (!found) return;
        if (tracked) {
          hint.hidden = true;
        } else {
          hint.textContent = CONFIG.ui.markerLostHint;
          hint.hidden = false;
          setTimeout(() => { hint.hidden = true; }, 3000);
        }
      },
    });
  } catch (err) {
    console.warn('마커 모드 초기화 실패 — 오버레이로 폴백', err);
    fallbackToOverlay();
  }
}

// ===========================================================================
// Vision AI 인식 모드 — 카메라로 캐릭터(카드·그림)를 알아보고 안내를 시작한다.
// scenes/vision.js는 렌더링을 직접 하지 않고 "인식"만 담당한다 — 확정되면 자신의 카메라·
// classifier를 정리한 뒤 onRecognized(key)만 알려주고, 실제 AR 안내는 검증된 오버레이 모드
// (btn-overlay 클릭 핸들러)로 그대로 이어받는다. 그래서 여기서는 마커 모드처럼 activeScene에
// 연결하지 않는다 — 화면 전환 이후엔 overlay가 activeScene을 스스로 채운다.
// 1단계 기준: 인식된 라벨↔캐릭터 고정 연결은 3단계에서 추가한다(현재는 표준 오버레이 흐름 진입).
// ===========================================================================
let visionSession = null;

document.getElementById('btn-vision').addEventListener('click', enterVisionMode);

// 중복 탭 시 getUserMedia 스트림이 두 개 떠서 카메라를 경쟁하는 것 방지 (마커 모드와 동일한 가드)
let visionEntering = false;

async function enterVisionMode() {
  if (visionEntering) return;
  ensureGyroPermission(); // 제스처 컨텍스트 선요청 — 인식 후 오버레이 전환 대비
  visionEntering = true;

  const btnVision = document.getElementById('btn-vision');
  const labelEl = document.getElementById('btn-vision-label');
  const labelBeforeLoad = labelEl.textContent;
  btnVision.disabled = true;
  btnVision.classList.add('btn-loading');
  labelEl.textContent = CONFIG.ui.visionLoadingLabel;

  let initVision;
  try {
    ({ initVision } = await import('./scenes/vision.js'));
  } catch (err) {
    console.warn('비전 모듈 로드 실패 — 시작 화면으로 복귀', err);
    labelEl.textContent = labelBeforeLoad;
    btnVision.classList.remove('btn-loading');
    btnVision.disabled = false;
    visionEntering = false;
    return;
  }
  btnVision.classList.remove('btn-loading');
  labelEl.textContent = labelBeforeLoad;

  document.getElementById('screen-start').style.display = 'none';
  const screenVision = document.getElementById('screen-vision');
  screenVision.style.display = 'block';
  const hint = document.getElementById('vision-hint');
  const errorPanel = document.getElementById('vision-error');
  const backBtn = document.getElementById('btn-vision-back');
  hint.hidden = false;
  errorPanel.hidden = true;

  // 4단계(모델 로딩 중 화면 이탈): initVision()이 아직 카메라·WASM·모델을 로딩하는 도중에도
  // 뒤로가기로 빠져나갈 수 있어야 한다. aborted는 "이 화면을 이미 벗어났다"는 표시로, 뒤늦게
  // onRecognized/onError가 호출되거나 initVision()이 뒤늦게 resolve돼도 무시하고 즉시 정리한다.
  let aborted = false;

  function showVisionError() {
    hint.hidden = true;
    errorPanel.hidden = false;
  }

  function exitVisionScreen() {
    visionSession?.stop();
    visionSession = null;
    screenVision.style.display = 'none';
  }

  backBtn.addEventListener('click', () => {
    aborted = true;
    visionSession?.stop();
    // 다른 모든 "처음으로" 동작(btn-restart 등)과 동일하게 전체 리로드로 되돌아간다 —
    // 진행 중이던 getUserMedia·WASM 로딩·타이머까지 확실하게 정리되는 가장 안전한 방법이다.
    location.reload();
  }, { once: true });

  document.getElementById('btn-vision-fallback-overlay').addEventListener('click', () => {
    exitVisionScreen();
    document.getElementById('btn-overlay').click();
  }, { once: true });
  document.getElementById('btn-vision-fallback-survey').addEventListener('click', () => {
    exitVisionScreen();
    startDirectSurvey();
  }, { once: true });

  try {
    const session = await initVision({
      containerEl: document.getElementById('vision-container'),
      // E2 매직미러(?camera=user)에서도 스캔 카메라가 이후 오버레이와 같은 방향을 보게 한다.
      ...(cameraFacingParam !== undefined && { cameraFacing: cameraFacingParam }),
      onRecognized(key) {
        if (aborted) return; // 이미 화면을 벗어남 — 세션은 아래 finally 격 로직에서 정리된다
        // 3단계: 인식된 캐릭터(raong/raoni/raona)로 안내 전체 화자를 고정한다 — ?char=와 동일한
        // 공통 함수(solo-character.js)를 재사용. flow.start() 이전(가이드 시작 전)이라 안전하게
        // 통째로 재생성할 수 있다. key가 'unknown'이거나 미등록 값이면(정상 경로에서는 발생하지
        // 않지만 방어적으로) buildSoloGuideScript가 원본 릴레이 guideScript를 그대로 반환한다.
        guideSpeakerLock = key;
        flow = createFlow(buildSoloGuideScript(key, CONFIG));
        exitVisionScreen();
        document.getElementById('btn-overlay').click();
      },
      onError(err) {
        if (aborted) return;
        console.warn('비전 인식 실패 — 폴백 안내 노출', err);
        showVisionError();
      },
    });
    if (aborted) {
      session?.stop(); // 로딩 도중 뒤로가기를 눌렀다면 방금 막 만들어진 세션(카메라 등)을 즉시 정리
    } else {
      visionSession = session;
    }
  } catch (err) {
    if (!aborted) {
      console.warn('비전 모드 초기화 실패 — 폴백 안내 노출', err);
      showVisionError();
    }
  }

  visionEntering = false;
}

function renderGuide() {
  if (flow.screen !== SCREENS.GUIDE) return;
  showLine(flow.line);
  document.getElementById('btn-next').hidden = false;
}

document.getElementById('btn-next').addEventListener('click', async () => {
  if (characterLoading) return;
  sound.play('tap');
  flow.next();
  syncScreen();
  if (flow.screen === SCREENS.GUIDE) {
    await ensureCharacter(flow.line.speaker);
    renderGuide();
  } else if (flow.screen === SCREENS.SURVEY) {
    document.getElementById('btn-next').hidden = true;
    startSurvey();
  }
});

async function startSurvey() {
  const surveySpeaker = guideSpeakerLock ?? 'raona'; // 기본은 라오나, 단독 진행이면 그 캐릭터가 승계
  await ensureCharacter(surveySpeaker);
  showLine({ speaker: surveySpeaker, text: CONFIG.ui.surveyBubbleText });
  const panel = document.getElementById('survey-panel');
  panel.hidden = false;
  renderSurvey(panel, SURVEY_QUESTIONS, async (answers) => {
    panel.hidden = true;
    const donePanel = document.getElementById('done-panel');
    donePanel.hidden = false;
    showGoogleFormLinks(donePanel);
    // 완료 화면의 폼 링크는 "또 해야 하나?" 혼란을 막기 위해 폴백용임을 명시하는 문구로 교체
    const doneFormLink = donePanel.querySelector('.google-form-link');
    if (doneFormLink) doneFormLink.textContent = CONFIG.ui.googleFormLinkFallback;
    document.getElementById('btn-capture').hidden = false;

    await submitAndRetry(answers, {
      onMessage: (text) => showLine({ speaker: surveySpeaker, text }),
      retryParent: document.getElementById('screen-ar'),
      onFail: () => {
        document.getElementById('btn-restart').hidden = false;
        armKioskReset();
      },
    });

    flow.finishSurvey();
    syncScreen();
    await ensureCharacter(surveySpeaker); // 완료 화면도 진행 캐릭터가 인사
    showLine({ speaker: surveySpeaker, text: CONFIG.ui.doneMessage });
    // 마커 모드는 activeScene 없이 진행되므로 null 가드 필수
    activeScene?.playMotion?.('jump'); // 감사 인사와 함께 기쁨의 점프
    sound.play('boing');
    activeScene?.burst?.('heart');
    // 카메라 스트림은 [처음으로]에서 해제 — 완료 화면의 [📸 기념사진]이 카메라 프레임을 쓰기 때문.
    // 무인 운영의 발열·배터리는 키오스크 무입력 리셋이 처리한다.
    document.getElementById('btn-restart').hidden = false;
    armKioskReset();
  }, { ...reactionsFor(), lang: CONFIG.lang });
}

// A팩 별점 리액션 — 문항 확정 시 캐릭터가 반응한다 (4~5점 신남 / 1~2점 시무룩→힘내기 / 3점 무반응)
function reactionsFor() {
  return {
    onAnswer(key, value) {
      if (key !== 'rating') return;
      const n = Number(value);
      if (n >= 4) {
        activeScene?.playMotion?.('cheer');
        activeScene?.burst?.('heart');
        sound.play('twinkle');
      } else if (n <= 2) {
        activeScene?.playMotion?.('sad');
        setTimeout(() => activeScene?.playMotion?.('wave'), 1100); // 시무룩 후 다시 힘내기
      }
    },
  };
}

// 완료 화면 기념 스크린샷 (C팩) — 카메라 프레임 + 3D 캔버스 + 캡션 합성 → 공유/다운로드
document.getElementById('btn-capture').addEventListener('click', async () => {
  sound.play('tap');
  const { shared } = await captureMoment({
    videoEl: document.getElementById('camera-video'),
    canvasEl: document.getElementById('three-canvas'),
    caption: CONFIG.ui.captureCaption,
  });
  if (!shared) showLine({ speaker: guideSpeakerLock ?? 'raona', text: CONFIG.ui.captureSavedMessage });
});

document.getElementById('btn-restart').addEventListener('click', () => {
  activeScene?.stopCamera?.(); // 리셋 직전 카메라 스트림 해제
  markerSession?.stop(); // 마커 플로우로 완주한 경우의 카메라 해제 (goHome과 동일)
  location.reload();
});
document.getElementById('btn-error-restart').addEventListener('click', () => {
  location.reload();
});

// ===========================================================================
// D4 키오스크 모드 — ?kiosk=1: DONE(또는 에러) 화면 도달 후 무입력 상태가
// CONFIG.kiosk.idleResetSec만큼 이어지면 다음 체험자를 위해 자동으로 처음 화면으로 되돌린다.
// ===========================================================================
let kioskArmed = false;
let kioskTimer = null;

function resetKioskTimer() {
  if (!KIOSK_MODE || !kioskArmed) return;
  clearTimeout(kioskTimer);
  kioskTimer = setTimeout(() => location.reload(), scaledMs((CONFIG.kiosk.idleResetSec ?? 30) * 1000));
}

function armKioskReset() {
  if (!KIOSK_MODE) return;
  kioskArmed = true;
  resetKioskTimer();
}

if (KIOSK_MODE) {
  ['click', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, resetKioskTimer, { passive: true });
  });
}

// ===========================================================================
// D: public/sw.js 오프라인 자산 캐시 등록 — 실패해도 무해(캐시 없이 기존처럼 동작).
// ===========================================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
    console.warn('서비스워커 등록 실패 — 오프라인 캐시 없이 정상 동작', err);
  });
}

// ===========================================================================
// WebXR hit-test 바닥인식 모드 (Android Chrome, 베타) — agent/webxr-hittest
// isXRSupported() 체크·#btn-xr 노출은 위 btn-overlay 핸들러 안에서 처리한다.
// 여기서는 진입/종료 전환만 담당 — 다른 씬 로직(자이로 오버레이·설문)은 건드리지 않는다.
// ===========================================================================
const btnXR = document.getElementById('btn-xr');
const xrHint = document.getElementById('xr-hint');
let xrHintTimer = null;

function hideXRHint() {
  clearTimeout(xrHintTimer);
  xrHint.hidden = true;
}

btnXR.addEventListener('click', async () => {
  if (!overlay) return;
  btnXR.disabled = true;

  const xr = await startXR({
    character: characterCache.get(currentSpeaker),
    overlayRoot: document.getElementById('screen-ar'),
    ...(characterHeight !== undefined && { characterHeight }),
    // 바닥 인식(레티클)이 배치되면 힌트 타이머를 취소 — 트래킹 실패 안내(D)
    onPlaced: hideXRHint,
    onEnd: () => {
      // 세션 종료(뒤로가기 등) → 기존 자이로 오버레이 씬으로 복귀.
      // XR 씬에 캐릭터가 재소속되며 overlay 씬에서 빠졌을 수 있으니 다시 붙여준다.
      hideXRHint();
      activeScene = overlay;
      overlay.resume();
      const restored = characterCache.get(currentSpeaker);
      if (restored) {
        overlay.setCharacter(restored);
        overlay.playEntrance();
      }
      btnXR.hidden = false;
      btnXR.disabled = false;
    },
  });

  if (!xr) {
    // 세션 시작 실패(권한 거부 등) — 오버레이 모드를 그대로 유지
    btnXR.disabled = false;
    return;
  }

  overlay.pause();
  activeScene = xr;
  btnXR.hidden = true;
  btnXR.disabled = false;

  // 15초 안에 바닥(레티클)이 잡히지 않으면 친절한 안내 문구 노출 (리서치 보완 ①·②)
  xrHint.textContent = CONFIG.trackingHints.xrReticle;
  xrHintTimer = setTimeout(() => { xrHint.hidden = false; }, 15000);
});
// ===========================================================================

syncScreen();
