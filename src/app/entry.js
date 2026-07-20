// 모드 진입 오케스트레이션 — main.js에 흩어져 있던 오버레이/카드 소환/Vision 인식 진입 로직을
// 기계적으로 이동했다(Task 10, 셸 재작성 스펙). 동작은 원본 main.js와 동일해야 한다(새 설계 금지).
// createOnceGuard()는 overlayEntering/markerEntering/visionEntering 3벌의 중복 방지 플래그를
// 하나의 재사용 유틸로 통합한 것이고, initEntry()는 그 세 진입 핸들러(오버레이/카드/Vision)의
// 본문을 그대로 옮기기 위한 조립 함수다 — main.js는 여기서 반환하는 메서드만 호출한다.
import { initOverlay } from '../scenes/overlay.js';
import { isXRSupported } from '../scenes/webxr.js';
import { asScene } from './scenes.js';
import { scaledMs } from './timing.js';
import { STORAGE_KEYS } from './storage-keys.js';

// 모드 진입 중복 가드 — 기존 overlayEntering/markerEntering/visionEntering 3벌의 공통화.
// 진입은 페이지 수명당 1회(성공 후 홈은 reload)가 기본이라 재무장은 기본적으로 두지 않지만,
// 진입이 실패로 끝났을 때만(예: 동적 import 실패) 호출부가 명시적으로 guard.reset()을 불러
// 재시도를 허용할 수 있다(성공 시엔 재진입 없음 — reset()을 호출하지 않는다).
export function createOnceGuard() {
  let entered = false;
  const guard = async (fn) => {
    if (entered) return;
    entered = true;
    return fn();
  };
  guard.reset = () => { entered = false; };
  return guard;
}

// iOS Safari의 AR Quick Look 지원 감지 — rel="ar" 앵커를 지원하면 네이티브 ARKit 뷰어 사용 가능
function supportsQuickLook() {
  const a = document.createElement('a');
  return a.relList && a.relList.supports && a.relList.supports('ar');
}

// config/store/guide/router/sound과, main.js가 소유한 비-AR 최후 폴백(onDirectSurvey)을 받아
// 오버레이·카드·Vision 3개 진입 플로우를 구성한다. overlay()/markerSession()은 main.js의
// goHome·btn-restart·WebXR 버튼이 원본처럼 "지금 붙어 있는 세션"을 참조하기 위한 접근자다
// (guide.js의 scene()/loadedCharacter() 접근자 패턴과 동일).
export function initEntry({ config, store, guide, router, sound, onDirectSurvey }) {
  let overlay = null;
  let markerSession = null;

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

  // 오버레이 진입 공통 흐름 — 시작 버튼과 카드 소환 전환이 함께 사용한다.
  const guardOverlay = createOnceGuard();
  async function startOverlayFlow() {
    return guardOverlay(async () => {
      history.pushState({ ar: true }, ''); // 하드웨어 뒤로가기 → 홈 (사이트 이탈 방지)
      document.getElementById('btn-home').hidden = false;
      guide.begin();
      const gyroOk = await ensureGyroPermission();
      overlay = await initOverlay({
        videoEl: document.getElementById('camera-video'),
        canvasEl: document.getElementById('three-canvas'),
        gyroAllowed: gyroOk,
        // E2 매직미러: size/camera 파라미터가 있을 때만 옵션을 전달한다 — overlay.js가 아직
        // 해당 옵션을 지원하지 않는 상태에서도(A팩 작업 중) 여분의 키는 무시되어 안전하다.
        ...(store.get('characterHeight') !== undefined && { characterHeight: store.get('characterHeight') }),
        ...(store.get('cameraFacing') !== undefined && { cameraFacing: store.get('cameraFacing') }),
      });
      guide.setScene(asScene(overlay));
      {
        const hintEl = document.getElementById('xr-hint');
        let hintText = null;
        if (!gyroOk) {
          hintText = config.ui.gyroOffHint;
        } else {
          // 자이로가 켜져 있어도 위치(6DoF)는 추적 불가 — 최초 1회만 행동 유도 (걸어가면 밀려나는 한계 안내)
          try {
            if (!localStorage.getItem(STORAGE_KEYS.overlayLookHintSeen)) {
              hintText = config.ui.overlayLookHint;
              localStorage.setItem(STORAGE_KEYS.overlayLookHintSeen, '1');
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
      await guide.ensureCharacter(guide.speaker());
      guide.renderGuide();

      // WebXR hit-test 지원 기기(Android Chrome 등)에서만 "진짜 바닥에 소환" 버튼 노출.
      // 미지원 기기(iOS 등)는 isXRSupported()가 false를 반환해 버튼이 계속 숨겨진 채 —
      // 기존 자이로 오버레이 흐름과 완전히 동일하게 동작한다.
      if (await isXRSupported()) {
        document.getElementById('btn-xr').hidden = false;
      } else if (supportsQuickLook()) {
        // iOS: WebXR 대신 네이티브 AR Quick Look(진짜 6DoF 바닥 고정)으로 대칭을 맞춘다 (Task D)
        document.getElementById('btn-quicklook').hidden = false;
      }
    });
  }

  // 카드 하이브리드 플로우 — 마커 세션(캐릭터는 카드에 부착)을 살려둔 채 가이드·설문 UI(#screen-ar)만
  // 그 위에 얹는다. overlay 전용 요소(카메라 비디오·캔버스·기념사진)는 data-mode="marker-flow" CSS로 숨긴다.
  // guide의 activeScene은 NullScene(기본값) 유지 — ensureCharacter는 NullScene 비교로 조기 반환하고,
  // 모션·연출 호출은 NullScene의 no-op 메서드로 자연스럽게 흡수된다.
  function startMarkerFlow(key) {
    history.pushState({ ar: true }, ''); // 하드웨어 뒤로가기 → 홈 (오버레이 플로우와 동일)
    router.setMode('marker-flow');
    guide.lockTo(key);
    guide.begin();
    guide.renderGuide();
  }

  // 중복 탭 시 MindARThree 인스턴스가 두 개 떠서 카메라를 경쟁하는 것 방지
  const guardMarker = createOnceGuard();

  // D1: mind-ar(무거운 의존성)는 카드 모드 버튼을 실제로 눌렀을 때만 로드한다 —
  // 초기 번들에서 분리되는 별도 청크이므로 로딩 중임을 버튼 상태로 보여준다.
  async function enterMarkerMode() {
    return guardMarker(async () => {
      ensureGyroPermission(); // 제스처 컨텍스트에서 선요청 — 소환 후 오버레이 전환 대비 (await 안 함: 프롬프트와 병행 진행)

      const btnMarker = document.getElementById('btn-marker');
      const labelEl = document.getElementById('btn-marker-label');
      const labelBeforeLoad = labelEl.textContent;
      btnMarker.disabled = true;
      btnMarker.classList.add('btn-loading');
      labelEl.textContent = config.ui.btnMarkerLoading;

      let initMarker;
      try {
        ({ initMarker } = await import('../scenes/marker.js'));
      } catch (err) {
        console.warn('마커 모듈 로드 실패 — 준비 중 상태로 복귀', err);
        labelEl.textContent = labelBeforeLoad;
        btnMarker.classList.remove('btn-loading');
        btnMarker.disabled = false;
        // 원본(main.js)은 이 실패 경로에서만 markerEntering을 되돌려 재시도를 허용했다 — 버튼은
        // 복원됐는데 가드만 잠긴 채면 클릭이 조용히 무시되는 회귀가 생긴다(리뷰 Important). 동일하게
        // guardMarker를 재무장해 다음 클릭이 다시 import를 시도하게 한다.
        guardMarker.reset();
        return;
      }
      btnMarker.classList.remove('btn-loading');
      labelEl.textContent = labelBeforeLoad;

      // #screen-start의 자식(.start-content)에 걸린 z-index:1이 #screen-start 자체는
      // stacking context를 만들지 않아 body 최상위 레벨로 그대로 노출된다 — 그 결과 DOM 순서만으론
      // #screen-marker(z-index:auto)가 절대 위로 못 올라온다. 그래서 router.show로 명시적으로 숨긴다
      // (data-screen이 "marker"가 되면 #screen-start는 base section 규칙으로 되돌아가 display:none).
      router.show('marker');
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
        // #screen-marker를 별도로 숨기지 않는다 — btn-overlay 클릭이 동기적으로 startOverlayFlow의
        // guide.begin()(flow.start()+syncScreen 내부 호출)까지 실행해(첫 await 이전) data-screen이
        // 곧장 "guide"로 바뀌고, router CSS 규칙에 따라 #screen-marker는 자동으로 사라진다
        // (중간에 리페인트가 끼어들 여지 없음).
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
            hint.textContent = config.ui.markerSummoned.replace('{name}', config.characters[key].name);
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
              hint.textContent = config.ui.markerLostHint;
              hint.hidden = false;
              setTimeout(() => { hint.hidden = true; }, 3000);
            }
          },
        });
      } catch (err) {
        console.warn('마커 모드 초기화 실패 — 오버레이로 폴백', err);
        fallbackToOverlay();
      }
    });
  }

  // 중복 탭 시 getUserMedia 스트림이 두 개 떠서 카메라를 경쟁하는 것 방지 (마커 모드와 동일한 가드)
  const guardVision = createOnceGuard();

  async function enterVisionMode() {
    return guardVision(async () => {
      ensureGyroPermission(); // 제스처 컨텍스트 선요청 — 인식 후 오버레이 전환 대비

      const btnVision = document.getElementById('btn-vision');
      const labelEl = document.getElementById('btn-vision-label');
      const labelBeforeLoad = labelEl.textContent;
      btnVision.disabled = true;
      btnVision.classList.add('btn-loading');
      labelEl.textContent = config.ui.visionLoadingLabel;

      let initVision;
      try {
        ({ initVision } = await import('../scenes/vision.js'));
      } catch (err) {
        console.warn('비전 모듈 로드 실패 — 시작 화면으로 복귀', err);
        labelEl.textContent = labelBeforeLoad;
        btnVision.classList.remove('btn-loading');
        btnVision.disabled = false;
        // 마커 모드와 동일한 이유로 guardVision을 재무장한다 — 버튼만 복원되고 가드가 잠긴 채면
        // 다음 클릭이 조용히 무시된다(리뷰 Important).
        guardVision.reset();
        return;
      }
      btnVision.classList.remove('btn-loading');
      labelEl.textContent = labelBeforeLoad;

      router.show('vision');
      const hint = document.getElementById('vision-hint');
      const errorPanel = document.getElementById('vision-error');
      const backBtn = document.getElementById('btn-vision-back');
      hint.hidden = false;
      errorPanel.hidden = true;

      let visionSession = null;

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
        // #screen-vision을 별도로 숨기지 않는다 — 아래 세 호출부 모두 exitVisionScreen() 직후
        // 동기적으로(첫 await 이전) router.show()를 거치는 다음 화면 전환을 실행해 data-screen이
        // 곧장 바뀌고, router CSS 규칙에 따라 #screen-vision은 자동으로 사라진다.
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
        onDirectSurvey();
      }, { once: true });

      try {
        const session = await initVision({
          containerEl: document.getElementById('vision-container'),
          // E2 매직미러(?camera=user)에서도 스캔 카메라가 이후 오버레이와 같은 방향을 보게 한다.
          ...(store.get('cameraFacing') !== undefined && { cameraFacing: store.get('cameraFacing') }),
          onRecognized(key) {
            if (aborted) return; // 이미 화면을 벗어남 — 세션은 아래 finally 격 로직에서 정리된다
            // 3단계: 인식된 캐릭터(raong/raoni/raona)로 안내 전체 화자를 고정한다 — ?char=와 동일한
            // 공통 함수(solo-character.js)를 guide.lockTo 내부에서 재사용. flow.start() 이전(가이드
            // 시작 전)이라 안전하게 통째로 재생성할 수 있다. key가 'unknown'이거나 미등록 값이면
            // (정상 경로에서는 발생하지 않지만 방어적으로) buildSoloGuideScript가 원본 릴레이
            // guideScript를 그대로 반환한다.
            guide.lockTo(key);
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
    });
  }

  return {
    startOverlayFlow,
    enterMarkerMode,
    enterVisionMode,
    // main.js의 goHome·btn-restart·WebXR 버튼이 "지금 붙어 있는 세션"을 참조하기 위한 접근자.
    overlay: () => overlay,
    markerSession: () => markerSession,
  };
}
