// 전 화면 UI 문자열을 CONFIG(F1 다국어)에서 DOM으로 대입 — main.js에 흩어져 있던
// document.getElementById(...).textContent = CONFIG... 라벨 대입 블록 전부를 기계적으로
// 이동했다(Task 10, 셸 재작성 스펙). 새 로직 없음 — 대입 순서·값 전부 원본과 동일.
export function bindLabels(config) {
  // F1 다국어 — html lang·문서 제목을 현재 언어에 맞춘다 (config.lang은 config.js가 모듈 로드
  // 시점에 currentLang()으로 이미 판별해 둔 값). getElementById+textContent 패턴은 아니지만
  // 같은 "CONFIG → DOM 라벨 대입" 성격이라 함께 옮겼다.
  document.documentElement.lang = config.lang;
  document.title = config.title;

  document.getElementById('start-title').textContent = config.title;
  document.getElementById('start-subtitle').textContent = config.ui.startSubtitle;
  document.getElementById('start-scarcity').textContent = config.scarcityText;
  document.getElementById('btn-overlay-label').textContent = config.ui.btnOverlay;
  document.getElementById('btn-marker-label').textContent = config.ui.btnMarker;
  document.getElementById('btn-marker-badge').textContent = config.ui.btnMarkerBadgeSoon;
  document.getElementById('btn-vision-label').textContent = config.ui.btnVision;
  // 기본값은 마커와 동일한 "준비 중" 배지(안전한 쪽) — 모델 배포 여부를 HEAD로 확인하는
  // start-screen.js의 게이팅이 활성화 가능할 때만 config.ui.btnVisionBadge(체험/Beta 배지)로 바꾼다.
  document.getElementById('btn-vision-badge').textContent = config.ui.btnMarkerBadgeSoon;
  document.getElementById('vision-hint').textContent = config.ui.visionHint;
  document.getElementById('vision-error-message').textContent = config.ui.visionErrorMessage;
  document.getElementById('btn-vision-fallback-overlay').textContent = config.ui.btnVisionFallbackOverlay;
  document.getElementById('btn-vision-fallback-survey').textContent = config.ui.btnVisionFallbackSurvey;
  document.getElementById('btn-vision-back').textContent = '←';
  document.getElementById('btn-vision-back').setAttribute('aria-label', config.ui.btnVisionBackAria);
  document.getElementById('hint-text').textContent = config.ui.hint;
  document.getElementById('brand-line').textContent = config.ui.brandLine;
  document.getElementById('marker-hint').textContent = config.ui.markerHint;
  document.getElementById('btn-marker-fallback').textContent = config.ui.btnMarkerFallback;
  document.getElementById('direct-survey-title').textContent = config.ui.directSurveyTitle;
  document.getElementById('btn-direct-restart').textContent = config.ui.btnRestart;
  document.getElementById('error-message').textContent = config.ui.errorMessage;
  document.getElementById('error-img').alt = config.ui.errorImgAlt;
  document.getElementById('btn-error-restart').textContent = config.ui.btnErrorRestart;
  document.getElementById('btn-capture').textContent = config.ui.btnCapture;
  document.getElementById('btn-restart').textContent = config.ui.btnRestart;
  document.getElementById('btn-next').textContent = config.ui.btnNext;
  document.querySelectorAll('.google-form-link').forEach((a) => { a.textContent = config.ui.googleFormLink; });
}
