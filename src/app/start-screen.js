// 시작 화면(#screen-start) 위젯 전부 — 온보딩·캐릭터 카드·크기 칩·운영자 바텀시트·언어 토글·
// 효과음 토글 + 모드 선택 버튼(오버레이/카드/Vision/비-AR 직행) 배선. main.js에 흩어져 있던
// 블록들을 기계적으로 이동했다(Task 10, 셸 재작성 스펙) — 새 로직 없음, 클로저 변수만
// store/config/sound 파라미터 참조로 치환했다. 실제 진입 로직(카메라 권한·AR 세션 등)은
// app/entry.js가 소유하고, 이 모듈은 버튼 클릭을 그 콜백(onOverlay/onMarker/onVision)과
// 비-AR 최후 폴백(onDirectSurvey, main.js 소유)에 연결만 한다.
import { STORAGE_KEYS } from './storage-keys.js';

const SIZE_HEIGHTS = { life: 1.8, giant: 2.5 }; // 크기 칩 선택 → characterHeight 매핑 (store.js와 동일 값)

export function initStartScreen({ config, store, sound, onOverlay, onMarker, onVision, onDirectSurvey }) {
  // 효과음 (B팩) — muted 상태는 localStorage에 저장되며, 아이콘·클래스를 상태와 동기화한다.
  {
    const btnSound = document.getElementById('btn-sound');
    const syncSoundBtn = (muted) => {
      btnSound.textContent = muted ? '🔇' : '🔊';
      btnSound.classList.toggle('is-muted', muted);
      btnSound.setAttribute('aria-label', muted ? config.ui.soundOn : config.ui.soundOff);
    };
    syncSoundBtn(sound.muted);
    btnSound.addEventListener('click', () => syncSoundBtn(sound.toggle()));
  }

  // F1 다국어 — 시작 화면 🌐 토글. URL의 ?lang= 파라미터를 반대 언어로 바꾸고 reload한다
  // (모듈 최상위에서 언어를 한 번 판별해 export하는 config.js 구조상 가장 단순하고 안전한 전환 방식).
  {
    const btnLangToggle = document.getElementById('btn-lang-toggle');
    btnLangToggle.textContent = config.ui.langToggleLabel;
    btnLangToggle.setAttribute('aria-label', config.ui.langToggleAria);
    btnLangToggle.addEventListener('click', () => {
      const nextLang = config.lang === 'en' ? 'ko' : 'en';
      const url = new URL(location.href);
      url.searchParams.set('lang', nextLang);
      location.href = url.toString();
    });
  }

  document.getElementById('start-chars').innerHTML = Object.entries(config.characters)
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
  // ①크기 칩: 방문객이 탭으로 캐릭터 크기 선택 (reload 없이 store.characterHeight에 반영)
  // ②운영자 시트(⚙️): 키오스크·매직미러 토글 + 대시보드 — 적용 시 북마크 가능한 URL로 이동
  // ===========================================================================
  {
    const chipWrap = document.getElementById('size-chips');
    chipWrap.setAttribute('aria-label', config.ui.sizeChipsAria);
    const sizes = [['base', undefined], ['life', SIZE_HEIGHTS.life], ['giant', SIZE_HEIGHTS.giant]];
    const sizeParam = store.params.get('size');
    const currentKey = sizeParam && SIZE_HEIGHTS[sizeParam] ? sizeParam : 'base';
    sizes.forEach(([key, height]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'size-chip' + (key === currentKey ? ' selected' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', key === currentKey ? 'true' : 'false');
      b.textContent = config.ui.sizeChips[key];
      b.addEventListener('click', () => {
        store.set('characterHeight', height);
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
    fab.setAttribute('aria-label', config.ui.operatorFabAria);
    document.getElementById('operator-title').textContent = config.ui.operatorTitle;
    document.getElementById('op-kiosk-label').textContent = config.ui.opKiosk;
    document.getElementById('op-mirror-label').textContent = config.ui.opMirror;
    const dash = document.getElementById('op-dashboard');
    dash.textContent = config.ui.opDashboard;
    dash.href = `${import.meta.env.BASE_URL}dashboard.html`;
    document.getElementById('op-apply').textContent = config.ui.opApply;
    document.getElementById('op-close').textContent = config.ui.opClose;

    document.getElementById('op-kiosk').checked = store.get('kiosk');
    document.getElementById('op-mirror').checked = store.get('cameraFacing') === 'user';

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

  // ===========================================================================
  // 온보딩 1장 (D4 리서치 보완 ①) — 최초 방문에만 카메라 허용→바닥 비추기→캐릭터 등장
  // 3스텝을 안내한다. localStorage에 본 적 있으면 다시 띄우지 않는다.
  // ===========================================================================
  {
    const el = document.getElementById('onboarding');
    document.getElementById('onboarding-title').textContent = config.onboarding.title;
    document.getElementById('onboarding-steps').innerHTML = config.onboarding.steps.map((s) => `
      <div class="onboarding-step">
        <span class="onboarding-step-icon">${s.icon}</span>
        <span class="onboarding-step-text">${s.text}</span>
      </div>
    `).join('');
    const cta = document.getElementById('btn-onboarding-start');
    cta.textContent = config.onboarding.cta;
    cta.addEventListener('click', () => {
      el.hidden = true;
      try {
        localStorage.setItem(STORAGE_KEYS.onboardingSeen, '1');
      } catch {
        // localStorage 불가 환경 — 다음 방문에도 다시 보이는 것으로 감수
      }
    }, { once: true });

    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEYS.onboardingSeen) === '1';
    } catch {
      seen = false;
    }
    if (!seen && !store.get('kiosk')) el.hidden = false; // 무인 키오스크는 매 리셋마다 온보딩이 뜨면 방해되므로 생략
  }

  // 카드 마커 모드(MindAR) — cards.mind가 실제로 배포돼 있을 때만 버튼을 활성화한다.
  // (public/targets/cards.mind가 없으면 클릭해도 initMarker()의 addImageTargets가 실패해
  // entry.js의 catch에서 오버레이로 폴백하지만, 애초에 "준비 중" 배지를 그대로 두는 편이 UX상 낫다.)
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

  document.getElementById('btn-overlay').addEventListener('click', onOverlay);
  document.getElementById('btn-marker').addEventListener('click', onMarker);
  document.getElementById('btn-vision').addEventListener('click', onVision);

  // ===========================================================================
  // F3 비AR 최후 폴백 — "카메라 없이 참여하기" (카메라·AR 없이도 참여 경로가 끊기지 않게)
  // ===========================================================================
  const btnNoCamera = document.getElementById('btn-no-camera');
  btnNoCamera.textContent = config.noCameraLinkText;
  btnNoCamera.addEventListener('click', (e) => {
    e.preventDefault();
    onDirectSurvey();
  });
}
