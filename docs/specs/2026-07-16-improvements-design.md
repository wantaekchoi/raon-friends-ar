# 개선 배치 설계서 — 귀여움·사운드·임팩트·견고화 (2026-07-16)

배포본(v0.1, 3모드 AR + 설문 + 모션) 기준 개선 배치. 품질 방침: **예쁘고 에러 없게 > 기능, 귀엽게, config 중심 유연성**. 사용자 결정: TTS는 불쾌한 골짜기 우려로 **제외**, 효과음은 포함. 마커 카드는 **수집 카드풍 리디자인**.

## A. 귀여움 팩

### A1. 별점 리액션 분기
- `renderSurvey(container, questions, onComplete, { onAnswer })` — 문항 확정 시 `onAnswer(key, value)` 발화 (선택 인자, 기본 no-op).
- rating 답변: 4~5점 → `cheer` 모션 + 하트 파티클 burst / 1~2점 → `sad` 모션 후 1초 뒤 `wave`(다시 힘내기) / 3점 → 반응 없음.
- `motion.js`에 모션 3종 추가: `cheer`(빠른 2회 점프+팔 흔들기), `sad`(몸통 앞 숙임+느린 복귀), `wiggle`(좌우 갸우뚱 0.6초). 본 없으면 몸통 폴백 (기존 엔진 패턴).

### A2. 캐릭터 쓰다듬기
- overlay 씬 canvas 탭 → `THREE.Raycaster`로 캐릭터 그룹 히트 검사 → 히트 시 `wiggle` + 하트 burst. 빗나가면 아무 일 없음 (가이드 진행 탭과 간섭 금지 — 가이드 진행은 [다음] 버튼 전용이므로 충돌 없음).

### A3. 파티클 (`src/effects.js` 신규)
- `createEffects(scene)` → `{ burst(type, worldPos, count=8), update(elapsed) }`.
- THREE.Sprite 풀(최대 32개 재사용), 타입: `heart`(💗 canvas 텍스처), `star`(⭐). 수명 0.8~1.2초, 위로 흩어지며 페이드.
- overlay 렌더 루프에서 `update` 호출. 등장·감사·리액션·쓰다듬기에서 burst.

## B. 사운드 팩 (`src/sound.js` 신규 — 오디오 파일 0개)

- WebAudio oscillator+envelope 신스로 4종 생성: `pop`(등장), `boing`(점프), `twinkle`(하트), `tap`(버튼).
- `initSound()` → `{ play(name), toggle(), get muted }`. 첫 사용자 제스처에서 AudioContext resume (iOS).
- `#btn-sound` 🔊/🔇 토글 — AR 화면 상단, localStorage `soundMuted` 기억, 기본 ON.

## C. 임팩트 팩

### C1. 마커 카드 수집 카드풍 리디자인
- 캐릭터 일러스트 + 이름 리본 + 라온 오렌지 프레임 + 미묘한 배경 패턴(특징점 확보 — 장식으로 보이게). HTML/CSS → puppeteer 스크린샷 제작(기존 방법), `cards.mind` 재컴파일(docs/marker-setup.md), `docs/cards-print.pdf` 갱신.
- **게이트**: 컴파일러 특징점 시각화로 3장 모두 인식 품질 확인 후 교체. 미달이면 패턴 밀도 보강 반복.

### C2. 기념 스크린샷 (`src/capture.js` 신규)
- 완료 화면 [📸 기념사진] → `#camera-video` 현재 프레임 + three 캔버스 + 하단 로고 문구("라온 프렌즈와 함께! 🐯")를 오프스크린 canvas 합성 → `navigator.share`(파일 공유), 미지원 시 png 다운로드.
- three 캔버스 캡처는 `preserveDrawingBuffer` 없이 **렌더 직후 동기 캡처**로 처리.

### C3. 멀티 카드 동시 인식 (`marker.js`)
- MindARThree `maxTrack: 3`. 타깃별 앵커에 각 캐릭터 로드·부착 — 여러 카드를 동시에 비추면 동시 소환. 안내 흐름 시작은 여전히 첫 인식 카드 기준(기존 `found` 로직 유지).

### C4. 실시간 대시보드 (`dashboard.html` 신규, 조건부)
- 부스 모니터용 별도 페이지 (vite multi-page input 추가). `config.js`의 `DASHBOARD.csvUrl`(스프레드시트 "웹에 게시" CSV) 10초 폴링 → 참여 수·평균 별점(★ 시각화)·최근 응원 한마디 3카드 레이아웃, 라온 브랜드 톤.
- csvUrl 미설정 시 **데모 데이터 모드**(라벨 표시) — 폼 연결 전에도 시연 가능.

## D. 견고화 팩

### D1. 마커 지연 로드
- `main.js`: `const { initMarker } = await import('./scenes/marker.js')` (버튼 클릭 시). mind-ar가 별도 청크로 분리 → 초기 번들 2.7MB → 약 0.5MB. 로딩 중 버튼에 스피너 표시.

### D2. 오프라인 응답 큐 (`src/queue.js` 신규 + vitest)
- `enqueue(answers)` / `flush(submitFn)` — localStorage `pendingResponses` 배열. 전송 실패 시 보관, 앱 시작 시·재시도 성공 시 flush.
- 재시도 버튼 유지 + 실패 시 안내 문구에 "연결되면 자동으로 다시 보내드릴게요" 추가.

### D3. 전역 에러 가드
- `window.onerror` + `unhandledrejection` → `#error-screen`: 라옹 이미지 + "앗! 라옹이가 넘어졌어요 🙈" + [다시 시작](reload). 1회만 표시(중복 가드), 에러는 console 보존.

### D4. 키오스크 모드
- URL `?kiosk=1`: DONE 도달 후 30초(=`CONFIG.kiosk.idleResetSec`) 무입력 시 자동 reload.
- URL `?char=raoni`: 배턴터치 없이 해당 캐릭터 단독 진행 (마커 모드의 단독 진행 로직과 동일한 화자 고정).

## E. 자이언트 안내 모드 ("인형옷 대체" — 사용자 요청)

### E1. 라이프사이즈/자이언트 스케일
- `initOverlay` 옵션 확장: `{ characterHeight = 1.2, cameraFacing = 'environment' }`. URL `?size=life`(1.8m)·`?size=giant`(2.5m)로 캐릭터 실물 크기 소환 — 거리·구도(카메라 lookAt)도 스케일에 맞춰 자동 조정(giant는 4m 거리). WebXR 모드도 동일 스케일 적용.
- 컨셉: 인형옷 없이 "행사장에 서 있는 거대 라옹"이 방문객을 안내.

### E2. 매직 미러 포토존 (부스 설치형)
- 노트북/미니PC + 웹캠 + 대형 TV로 기존 앱을 그대로 사용: `?kiosk=1&size=giant&camera=user` — 전면/웹캠 화면에 방문객과 거대 라옹이 함께 서 있는 구도. `camera=user`는 getUserMedia `facingMode: 'user'` 매핑(데스크톱 웹캠은 기본 장치).
- 별도 페이지 없음 — URL 파라미터 조합만으로 성립 (D4 키오스크 모드와 결합).

**구현 배분**: E1의 overlay/webxr 옵션은 A팩(overlay.js 전담)에 포함, E2의 URL 파라미터 배선은 D팩(main.js 전담)에 포함.

## 파일 경계 · 연결 규칙 (4팩 병렬 에이전트)

| 팩 | 전담 파일 (다른 팩 수정 금지) |
|---|---|
| A | `src/effects.js`(신규) · `src/motion.js` · `src/scenes/overlay.js`(+E1 옵션) · `src/scenes/webxr.js`(E1 스케일만) · `src/survey.js`(onAnswer 인자 추가만) |
| B | `src/sound.js`(신규) · `index.html`(#btn-sound) · `src/style.css`(끝 append) |
| C | `src/capture.js`(신규) · `src/scenes/marker.js` · `public/targets/*` · `docs/cards-print.pdf` · `dashboard.html`(신규) · `vite.config.js` |
| D | `src/queue.js`(신규) · `src/main.js`(**전담**, +E2 URL 파라미터) · `index.html`(#error-screen) |

- **main.js는 D팩 전담.** A·B·C의 main.js 연결부(리액션 트리거, 효과음 재생 지점, 스크린샷 버튼, 지연 로드와 marker 연결)는 **머지 시 조율 세션이 직접 추가** — 오늘 검증된 병렬 머지 패턴.
- index.html: B는 #btn-sound, D는 #error-screen만 — 서로 다른 위치라 자동 머지 예상.
- 각 팩 완료 조건: `npm test`(기존 18개 유지+신규) + `npm run build` + 헤드리스 스크린샷 검증. 에이전트는 push 금지, 커밋만.

## 테스트

- vitest 신규: queue(보관/flush/파손 데이터 무시), survey `onAnswer` 발화, sound는 mute 상태 로직만(오디오 자체는 수동).
- 헤드리스: 파티클/모션 연속 프레임, 카드 리디자인 특징점 검증, 대시보드 데모 모드 렌더, 에러 가드 강제 발생 테스트.
- 실기기(사용자): 효과음 iOS 재생, 새 카드 인식률, 멀티 카드, 기념사진 공유.

## F. 포용성 팩 (다국어·접근성·비AR 폴백 — 사용자 요청)

### F1. 다국어 (ko/en)
- `config.js`에 문자열 사전 구조 도입: `STRINGS = { ko: {...}, en: {...} }` — 멘트·설문 문항·버튼·안내 문구 전부 포함 (config 중심 원칙 유지).
- 언어 결정: URL `?lang=en` > `navigator.language` > ko 기본. 시작 화면에 🌐 토글.

### F2. 접근성
- 모든 인터랙티브 요소 aria-label, 말풍선 `aria-live="polite"`(멘트 낭독), 버튼 포커스 링, 텍스트 대비 4.5:1 점검, `prefers-reduced-motion` 커버리지 확대(파티클·모션 스킵), 별점 키보드 조작.

### F3. 비AR 최후 폴백 — "안 되는 사람도 참여 가능하게"
- 시작 화면 하단 "📝 카메라 없이 참여하기" 링크 → 그라데이션 배경으로 설문 직행.
- 완료·에러·전송실패 화면에 **구글 폼 직접 링크**(`https://docs.google.com/forms/d/e/{formId}/viewform`) 노출 — 앱이 어떤 이유로든 실패해도 참여 경로가 끊기지 않음.
- 리서치 보완 5종 포함: 온보딩 1장, 트래킹 실패 안내, 체험 종료 시 카메라 스트림 해제, 한정성 문구, 오프라인 자산 캐시(service worker precache).

**구현 배분**: F1·F2는 별도 에이전트(팩 F — 문자열 추출이 전 파일에 걸침, 다른 팩 완료 후 순차 적용이 안전), F3는 D팩에 포함.

> 참고: "AR이 외면받아온 원인" 리서치 결과는 docs/research/2026-07-16-ar-adoption-failures.md — 보완 5종은 F3에 반영됨.

## 제외·후순위

- TTS 음성 (사용자 결정 — 불쾌한 골짜기 우려)
- 피두셜 마커 전환 (AR.js) — 이미지 타깃 유지 결정
- "orange" 머티리얼 색 보정, glb 변환 — 기존 백로그 유지
