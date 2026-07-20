import { STRINGS, currentLang } from './i18n.js';

// 캐릭터 이미지 경로는 언어 무관 — STRINGS의 캐릭터 이름(다국어)과 여기서 merge한다.
const CHARACTER_IMAGES = {
  raong: 'img/raong.png',
  raoni: 'img/raoni.png',
  raona: 'img/raona.png',
};

// 모듈 로드 시점에 언어를 한 번 판별해 CONFIG/SURVEY_QUESTIONS를 그 언어로 고정 export한다.
// ?lang= 토글은 URL을 바꾼 뒤 reload하는 방식이라(F1), 언어가 바뀌면 이 모듈도 다시 평가된다.
const lang = currentLang();
const S = STRINGS[lang] ?? STRINGS.ko;

export const CONFIG = {
  title: S.meta.title,
  lang,
  guideScript: S.guideScript,
  // 한정성 문구(시작 화면) — "일회성 필터"가 아닌 "이 자리에서만" 프레이밍 (리서치 보완 ④)
  scarcityText: S.scarcityText,
  characters: Object.fromEntries(
    Object.entries(S.characters).map(([key, c]) => [key, { ...c, img: CHARACTER_IMAGES[key] }]),
  ),
  // 온보딩 1장(최초 방문 1회, localStorage로 기억) — 카메라 허용→바닥 비추기→캐릭터 등장 3스텝
  onboarding: S.onboarding,
  noCameraLinkText: S.noCameraLinkText,
  trackingHints: {
    // WebXR 바닥인식 레티클이 일정 시간 안 잡힐 때 안내 (마커 30초 폴백과는 별개)
    xrReticle: S.trackingHints.xrReticle,
  },
  kiosk: {
    idleResetSec: 30, // ?kiosk=1: DONE 화면에서 이 시간(초) 동안 무입력 시 자동으로 처음화면 리셋
  },
  // main.js/survey.js가 참조하는 UI 문자열 사전 (F1) — 버튼·안내·에러·재시도 문구 전부 포함
  ui: S.ui,
  // Vision AI 인식 모드 (1단계: 구조만, mock classifier / 2단계: MediaPipe 실 모델로 교체 예정)
  vision: {
    // BASE_URL 기준 상대경로 — characters.js의 `${BASE}models/...` 패턴과 동일하게 로드부에서 조합한다.
    modelPath: 'models/vision/raon-mascot-classifier.tflite',
    labels: ['raong', 'raoni', 'raona', 'unknown'],
    confidenceThreshold: 0.7, // 이 미만 신뢰도는 인식 실패로 취급 (recognition-gate.js)
    requiredConsecutive: 5, // 동일 라벨이 이 횟수만큼 연속 인식돼야 확정
    classifyIntervalMs: 400, // 매 프레임 추론하지 않고 이 간격(ms)으로 제한 (저사양 기기 대비)
  },
};

export const SURVEY_QUESTIONS = S.survey.questions;

// 구글 폼 편집 화면의 "미리 채워진 링크 받기"로 얻은 formId·entry ID를 채워 넣으면 실제 전송이 활성화된다.
// formId가 'REPLACE_ME'인 동안은 submitSurvey()가 전송을 생략한다.
export const GOOGLE_FORM = {
  formId: '1FAIpQLSdavHvSEe0BkE59OdPhMdzn024HzUkItWzSRF-nDKnwadG54w',
  entries: {
    privacyConsent: 'entry.1468997439',
    name: 'entry.868682328',
    org: 'entry.1047708124',
    contact: 'entry.376462269',
    rating: 'entry.1528246500',
    highlight: 'entry.561270838',
    feedback: 'entry.662999618',
  },
  // 폼에서 "기타"가 자유입력 옵션으로 만들어져 있어 구글 규격(__other_option__)으로 전송해야 하는 값들.
  // key: 문항 키, values: 기타 처리해야 하는 응답값 목록.
  otherOptionValues: {
    highlight: ['기타', 'Other'],
  },
};

// 부스 모니터용 실시간 대시보드(dashboard.html) 설정.
// ⚠️ csvUrl에는 반드시 개인정보 열이 없는 "집계 전용 탭"(예: public 탭 — QUERY로 별점·의견만 미러링)의
// 게시 URL만 넣을 것. 원본 응답 시트를 게시하면 성함·연락처가 공개 URL로 노출된다 (적대 리뷰 HIGH 4).
// 구글 시트의 "파일 > 웹에 게시"로 얻은
// CSV 링크를 csvUrl에 채우면 10초마다 폴링해 참여 수·평균 별점·최근 응원 한마디를 보여준다.
// 비워두면(기본값) 데모 데이터 모드로 동작 — 폼 연결 전에도 대시보드 시연이 가능하다.
export const DASHBOARD = {
  // public 탭(개인정보 제외: 타임스탬프·별점·인상깊은점·의견만) 게시 CSV — 2026-07-20 연결, PII 부재 검증됨
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6uJ7lny53fZ3QHTF6s9aWm7YsGYhA-EVzvLNDcbmqsYuTgKI3-7YtvSKZ-m25DljFKrESGbIFJ55M/pub?gid=720052507&single=true&output=csv',
};
