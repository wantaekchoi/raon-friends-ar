// 다국어(ko/en) 문자열 사전 + 언어 판별 유틸. 설계서 F1 참조.
//
// 사용법:
//   import { currentLang, t } from './i18n.js';
//   const lang = currentLang();          // URL ?lang= > navigator.language > 'ko' 순으로 판별
//   t('ui.btnCapture', lang)             // 중첩 dot-path로 문자열 조회, en에 없으면 ko로 폴백
//   t('survey.ratingAriaLabel', lang, { n: 3 }) // {n} 같은 플레이스홀더 치환
//
// config.js는 모듈 로드 시점에 currentLang()을 한 번 평가해 CONFIG/SURVEY_QUESTIONS를 만든다.
// survey.js처럼 순수 함수로 테스트되는 모듈은 lang을 인자로 명시적으로 받아(기본값 'ko')
// 자동 감지에 의존하지 않는다 — 테스트 환경(jsdom)의 navigator.language는 'en-US'라서
// 자동 감지에 의존하면 기존 한국어 테스트가 깨진다.

export const STRINGS = {
  ko: {
    meta: { title: '라온 프렌즈 AR 안내데스크', htmlLang: 'ko' },
    guideScript: [
      { speaker: 'raong', text: '안녕하세요! 펀펀 시티를 지키는 치료사, 라온 프렌즈의 라옹이에요 🐯' },
      { speaker: 'raong', text: 'FunFun AI경진대회에 오신 걸 환영해요!' },
      { speaker: 'raoni', text: '저는 안내 담당 라오니예요! 이 서비스는 AI(Claude Code)와 함께 만든 웹 AR 안내데스크예요.' },
      // ↓ 행사 정보 멘트: 행사마다 여기를 실제 안내(위치·시간·이벤트)로 교체
      { speaker: 'raoni', text: '부스는 자유롭게 체험하실 수 있어요. 옆에 시연 데모도 준비돼 있으니 꼭 들러보세요!' },
      { speaker: 'raona', text: '저는 라오나예요! 다음엔 잠깐 설문에 참여해주시면 큰 힘이 돼요!' },
    ],
    characters: {
      raong: { name: '라옹' },
      raoni: { name: '라오니' },
      raona: { name: '라오나' },
    },
    scarcityText: '이 부스에서만 만날 수 있어요 🎪',
    onboarding: {
      title: '펀펀 가디언즈가 짠! 하고 나타나요 ✨',
      steps: [
        { icon: '📷', text: '카메라를 허용해주세요' },
        { icon: '🧭', text: '바닥이나 카드를 비춰보세요' },
        { icon: '🐯', text: '라온 프렌즈가 짠! 하고 등장해요' },
      ],
      cta: '시작할게요! 🙌',
    },
    noCameraLinkText: '📝 카메라 없이 참여하기',
    trackingHints: {
      xrReticle: '바닥을 찾기 어려우신가요? 🔍 밝은 곳에서 바닥을 천천히 비춰보세요',
    },
    survey: {
      questions: [
        {
          key: 'privacyConsent',
          label: '개인정보 수집·이용 동의 (필수)',
          type: 'consent',
          required: true,
          notice: [
            '수집 항목: 성함, 소속, 연락처(선택)',
            '이용 목적: 행사 운영, 설문 결과 분석, 경품 추첨 및 안내',
            '보유 기간: 행사 및 경품 지급 종료 후 지체 없이 파기 (2026년 10월 31일까지)',
            '응원 한마디는 부스 대시보드 화면에 표시될 수 있습니다.',
            '동의를 거부할 수 있으며, 거부 시 설문 참여가 제한됩니다.',
          ],
          agreeText: '동의합니다',
        },
        // 가벼운 선택형을 앞으로, 텍스트 입력을 뒤로 — 부스 회전율·중도이탈 대비 정량 데이터 우선 확보
        { key: 'rating', label: '오늘 체험은 얼마나 만족스러우셨나요?', type: 'rating', required: true },
        {
          key: 'highlight',
          label: '가장 인상 깊었던 점은?',
          type: 'choice',
          required: true,
          options: ['AR 캐릭터', '안내 콘텐츠', '기술 완성도', '아이디어', '기타'],
        },
        { key: 'feedback', label: '응원 한마디 또는 개선 의견', type: 'textarea', required: false },
        { key: 'name', label: '성함을 알려주세요', type: 'text', required: true },
        { key: 'org', label: '소속(팀/부서)이 어디신가요?', type: 'text', required: true },
        { key: 'contact', label: '연락처(이메일 또는 전화번호) — 경품 추첨에 필요해요 🎁', type: 'text', required: false },
      ],
      placeholder: { text: '입력해주세요', textarea: '자유롭게 적어주세요' },
      validation: {
        ratingRequired: '별점을 선택해주세요',
        ratingRange: '1~5 사이의 별점을 선택해주세요',
        required: '필수 항목이에요',
        consentRequired: '동의해주셔야 설문에 참여할 수 있어요',
      },
      btnNext: '다음 ▶',
      btnSubmit: '제출',
      ratingAriaLabel: '{n}점',
    },
    ui: {
      soundOn: '효과음 켜기',
      soundOff: '효과음 끄기',
      startSubtitle: '카메라 속으로 찾아오는 라온 프렌즈를 만나보세요!',
      btnOverlay: '라온 프렌즈 만나러 가기',
      btnMarker: '카드로 소환하기',
      btnMarkerBadgeSoon: '준비 중 🚧',
      btnMarkerLoading: '불러오는 중... ⏳',
      hint: '📷 카메라 권한이 필요해요',
      markerHint: '라온 프렌즈 카드를 비춰보세요! 📷',
      btnMarkerFallback: '인식이 잘 안 되나요? 오버레이 모드로 전환',
      directSurveyTitle: '설문으로 바로 참여하기 📝',
      doneMessage: '참여해주셔서 감사해요! 💛 경품 추첨 결과는 행사 안내로 알려드릴게요 🎁',
      btnRestart: '처음으로',
      errorMessage: '앗! 라옹이가 넘어졌어요 🙈',
      errorImgAlt: '라옹',
      btnErrorRestart: '다시 시작',
      googleFormLink: '📮 구글 설문지로 바로 참여하기',
      btnCapture: '📸 기념사진 남기기',
      btnXR: '📍 진짜 바닥에 소환 (베타)',
      btnNext: '다음 ▶',
      surveyBubbleText: '잠깐 설문 부탁해요!',
      retryMessage: '앗, 전송이 잘 안 됐어요 🙏 네트워크를 확인하고 다시 눌러주세요! 연결되면 자동으로 다시 보내드릴게요.',
      btnRetry: '다시 전송하기 🔄',
      captureSavedMessage: '사진이 저장됐어요! 📸',
      captureCaption: '라온 프렌즈와 함께! 🐯 #라온프렌즈AR',
      characterLoading: '친구가 오고 있어요 🐾',
      googleFormLinkFallback: '혹시 응답이 안 갔다면 여기로 📮',
      brandLine: 'with 라온시큐어 펀펀 가디언즈 · make AI fun and secure',
      langToggleLabel: '🌐 English',
      langToggleAria: '영어로 전환',
    },
  },
  en: {
    meta: { title: 'Raon Friends AR Reception Desk', htmlLang: 'en' },
    guideScript: [
      { speaker: 'raong', text: "Hi! I'm Raong, the healer who watches over Fun Fun City 🐯" },
      { speaker: 'raong', text: 'Welcome to the FunFun AI Competition!' },
      { speaker: 'raoni', text: "I'm Raoni, your guide! This app is a web AR reception desk, built together with AI (Claude Code)." },
      { speaker: 'raoni', text: "Feel free to explore the booth — there's a live demo right next to us!" },
      { speaker: 'raona', text: "I'm Raona! A quick survey next would really help us out!" },
    ],
    characters: {
      raong: { name: 'Raong' },
      raoni: { name: 'Raoni' },
      raona: { name: 'Raona' },
    },
    scarcityText: 'Only here at this booth! 🎪',
    onboarding: {
      title: 'The Fun Fun Guardians appear — ta-da! ✨',
      steps: [
        { icon: '📷', text: 'Allow camera access' },
        { icon: '🧭', text: 'Point at the floor or a card' },
        { icon: '🐯', text: 'The Raon Friends will pop in!' },
      ],
      cta: "Let's start! 🙌",
    },
    noCameraLinkText: '📝 Join without a camera',
    trackingHints: {
      xrReticle: "Having trouble finding the floor? 🔍 Try a brighter spot and move slowly",
    },
    survey: {
      questions: [
        {
          key: 'privacyConsent',
          label: 'Consent to Personal Data Collection (required)',
          type: 'consent',
          required: true,
          notice: [
            'Collected: name, team, contact (optional)',
            'Purpose: event operation, survey analysis, prize draw & notification',
            'Retention: deleted right after the event and prize delivery (by Oct 31, 2026)',
            'Your feedback message may be shown on the booth dashboard.',
            'You may decline; declining limits survey participation.',
          ],
          agreeText: 'I agree',
          // 구글 폼 체크박스 옵션은 한국어 원문이므로 전송값은 항상 이 값을 쓴다
          submitValue: '동의합니다',
        },
        { key: 'rating', label: 'How satisfied were you with today\'s experience?', type: 'rating', required: true },
        {
          key: 'highlight',
          label: 'What impressed you the most?',
          type: 'choice',
          required: true,
          // label은 화면 표시용, value는 구글 폼 옵션 원문(한국어) — 불일치하면 폼에 기록되지 않는다
          options: [
            { label: 'AR Characters', value: 'AR 캐릭터' },
            { label: 'Guide Content', value: '안내 콘텐츠' },
            { label: 'Technical Polish', value: '기술 완성도' },
            { label: 'Idea', value: '아이디어' },
            { label: 'Other', value: '기타' },
          ],
        },
        { key: 'feedback', label: 'A word of encouragement or feedback', type: 'textarea', required: false },
        { key: 'name', label: "What's your name?", type: 'text', required: true },
        { key: 'org', label: "What's your team or organization?", type: 'text', required: true },
        { key: 'contact', label: 'Contact (email or phone) — needed for the prize draw 🎁', type: 'text', required: false },
      ],
      placeholder: { text: 'Please enter', textarea: 'Feel free to write anything' },
      validation: {
        ratingRequired: 'Please select a rating',
        ratingRange: 'Please choose a rating between 1 and 5',
        required: 'This field is required',
        consentRequired: 'Please agree to participate in the survey',
      },
      btnNext: 'Next ▶',
      btnSubmit: 'Submit',
      ratingAriaLabel: '{n} out of 5 stars',
    },
    ui: {
      soundOn: 'Turn sound on',
      soundOff: 'Turn sound off',
      startSubtitle: 'Meet the Raon Friends appearing right in your camera!',
      btnOverlay: 'Meet the Raon Friends',
      btnMarker: 'Summon with a card',
      btnMarkerBadgeSoon: 'Coming soon 🚧',
      btnMarkerLoading: 'Loading... ⏳',
      hint: '📷 Camera permission required',
      markerHint: 'Point your camera at a Raon Friends card! 📷',
      btnMarkerFallback: 'Not detecting well? Switch to overlay mode',
      directSurveyTitle: 'Jump straight to the survey 📝',
      doneMessage: 'Thank you for joining! 💛 Prize draw results will be announced! 🎁',
      btnRestart: 'Start over',
      errorMessage: 'Oops! Raong tripped! 🙈',
      errorImgAlt: 'Raong',
      btnErrorRestart: 'Restart',
      googleFormLink: '📮 Join directly via Google Form',
      btnCapture: '📸 Take a memory photo',
      btnXR: '📍 Summon on real floor (beta)',
      btnNext: 'Next ▶',
      surveyBubbleText: 'Quick survey, please!',
      retryMessage: "Oops, that didn't send 🙏 Please check your connection and tap again! We'll auto-retry once you're back online.",
      btnRetry: 'Try sending again 🔄',
      captureSavedMessage: 'Photo saved! 📸',
      captureCaption: 'Together with the Raon Friends! 🐯 #RaonFriendsAR',
      characterLoading: 'A friend is on the way 🐾',
      googleFormLinkFallback: "If your response didn't go through, tap here 📮",
      brandLine: 'with RaonSecure Fun Fun Guardians · make AI fun and secure',
      langToggleLabel: '🌐 한국어',
      langToggleAria: 'Switch to Korean',
    },
  },
};

function resolvePath(dict, path) {
  return path.split('.').reduce(
    (acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined),
    dict,
  );
}

/**
 * 언어를 판별한다. 우선순위: URL `?lang=en|ko` > `navigator.language`가 'en'으로 시작 > 'ko' 기본.
 * 인자를 생략하면 실제 브라우저 환경(location.search, navigator.language)을 읽는다 — 순수 함수로
 * 테스트하려면 { search, language }를 명시적으로 넘긴다.
 */
export function currentLang({
  search = (typeof location !== 'undefined' ? location.search : ''),
  language = (typeof navigator !== 'undefined' ? navigator.language : ''),
} = {}) {
  const params = new URLSearchParams(search || '');
  const urlLang = params.get('lang');
  if (urlLang === 'ko' || urlLang === 'en') return urlLang;
  if (typeof language === 'string' && language.toLowerCase().startsWith('en')) return 'en';
  return 'ko';
}

/**
 * key(dot-path)에 해당하는 문자열을 lang 사전에서 조회한다. lang을 생략하면 currentLang()으로
 * 자동 판별한다(호출부가 순수 함수여야 하는 경우 — 예: survey.js — 반드시 lang을 명시적으로 넘길 것).
 * lang 사전에 키가 없으면 ko로 폴백하고, ko에도 없으면 key 문자열 자체를 반환한다.
 * vars가 주어지면 문자열 안의 {name} 플레이스홀더를 치환한다.
 */
export function t(key, lang = currentLang(), vars) {
  const dict = STRINGS[lang] || STRINGS.ko;
  let value = resolvePath(dict, key);
  if (value === undefined) value = resolvePath(STRINGS.ko, key);
  if (value === undefined) return key;
  if (typeof value === 'string' && vars) {
    return value.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
  }
  return value;
}
