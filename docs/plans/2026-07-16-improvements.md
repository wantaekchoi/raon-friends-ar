# 개선 배치 Implementation Plan (A~F팩)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** docs/specs/2026-07-16-improvements-design.md의 A(귀여움)·B(사운드)·C(임팩트)·D(견고화)·E(자이언트)·F(포용성) 팩을 4개 병렬 에이전트 + 조율 머지로 구현·배포한다.

**Architecture:** 팩별 git worktree(agent/*)에서 병렬 구현 → 조율 세션이 순차 머지하며 main.js 연결부를 직접 추가 → 전체 검증 → push 배포. F1(다국어)·F2(접근성)는 머지 후 순차.

**Tech Stack:** 기존과 동일 (Vite 6 · three.js · MindAR · Vitest · WebAudio API · Service Worker)

## Global Constraints

- 스펙 원문이 각 항목의 상세 요구 — 이 계획과 함께 반드시 읽을 것: `docs/specs/2026-07-16-improvements-design.md`
- `npm install --ignore-scripts` 필수 (CLAUDE.md — canvas 네이티브 빌드 실패)
- 각 팩 완료 조건: `npm test`(기존 18개 유지+신규) + `npm run build` + 헤드리스 스크린샷을 직접 Read로 확인
- **push 금지** (에이전트) — 커밋만. main push=즉시 배포는 조율 세션 전담
- 품질 방침: 예쁘고 에러 없게 > 기능, 귀엽게, 문구·값은 `src/config.js`
- 스펙의 파일 경계 표 준수 — 다른 팩 전담 파일 수정 금지. main.js는 D팩 전담

## 인터페이스 계약 (팩 간 — 시그니처 변경 금지)

```js
// A팩 산출
createEffects(scene) → { burst(type /* 'heart'|'star' */, worldPos, count = 8), update(elapsedSec) }   // src/effects.js
motionEngine.play(name) // 기존 + 'cheer'|'sad'|'wiggle' 추가                                          // src/motion.js
initOverlay({ videoEl, canvasEl, characterHeight = 1.2, cameraFacing = 'environment' })
  → 기존 API + { burst(type), stopCamera() }  // 쓰다듬기(레이캐스트→wiggle+heart)는 내부 처리       // src/scenes/overlay.js
startXR({ character, overlayRoot, onEnd, characterHeight = 1.2 })                                      // src/scenes/webxr.js (E1)

// B팩 산출
initSound() → { play(name /* 'pop'|'boing'|'twinkle'|'tap' */), toggle(), get muted }                  // src/sound.js

// C팩 산출
captureMoment({ videoEl, canvasEl, caption }) → Promise<{ shared: boolean }>                            // src/capture.js
// marker.js: maxTrack 3, 시각 요소 외 initMarker 시그니처 불변

// D팩 산출
enqueue(answers) / flush(submitFn) → Promise<number> / pendingCount()                                   // src/queue.js
renderSurvey(container, questions, onComplete, { onAnswer } = {})  // onAnswer는 A팩이 추가, D팩은 사용 안 함
```

---

### Task A: 귀여움 팩 + E1 (worktree ../raon-wt-cute, 브랜치 agent/cute)

**Files:** Create `src/effects.js` / Modify `src/motion.js`, `src/scenes/overlay.js`, `src/scenes/webxr.js`(characterHeight만), `src/survey.js`(onAnswer 인자만) / Test `test/survey.test.js`(onAnswer 케이스 추가)

**Interfaces:** Produces 위 계약의 A팩 블록 전부. Consumes 기존 motion 엔진 구조.

- [ ] 스펙 A1·A2·A3·E1 정독 후 effects.js TDD 불가 영역(3D)은 헤드리스 연속 프레임으로 검증
- [ ] `renderSurvey` 4번째 인자 `{ onAnswer }` 추가 — vitest: rating 확정 시 `onAnswer('rating', 5)` 발화 검증 (실패→구현→통과)
- [ ] motion.js에 cheer/sad/wiggle — 연속 스크린샷으로 3캐릭터 각 모션 육안 확인
- [ ] overlay.js: characterHeight/cameraFacing 옵션(스케일에 따라 카메라 거리·lookAt 자동 조정: 1.2→2.7m, 1.8→3.5m, 2.5→4.5m), 레이캐스트 쓰다듬기, effects 통합(burst·update), stopCamera() (스트림 track.stop())
- [ ] webxr.js: characterHeight 인자로 배치 스케일 적용
- [ ] `npm test`+build+스크린샷 검증 → 커밋 `feat: 리액션 모션·파티클·쓰다듬기 + 자이언트 스케일 옵션`

### Task B: 사운드 팩 (worktree ../raon-wt-sound, 브랜치 agent/sound)

**Files:** Create `src/sound.js` / Modify `index.html`(#btn-sound), `src/style.css`(append)

**Interfaces:** Produces `initSound()` 계약. main.js 연결은 조율 세션 몫 — **main.js 수정 금지**, 대신 사용 예를 파일 상단 주석으로.

- [ ] WebAudio 신스 4종 (pop: 상승 사인 80ms / boing: 주파수 바운스 200ms / twinkle: 고음 아르페지오 250ms / tap: 짧은 노이즈 30ms) — 볼륨 0.15 이하로 은은하게
- [ ] AudioContext는 첫 play() 호출 시 lazy 생성+resume (iOS)
- [ ] #btn-sound 🔊/🔇 토글 + localStorage `soundMuted` — 버튼 클릭만으로 상태 전환되는 데모 페이지 수준 검증(헤드리스에선 클래스 토글 확인)
- [ ] `npm test`+build → 커밋 `feat: WebAudio 효과음 4종 + 음소거 토글`

### Task C: 임팩트 팩 (worktree ../raon-wt-impact, 브랜치 agent/impact)

**Files:** Create `src/capture.js`, `dashboard.html` / Modify `src/scenes/marker.js`(maxTrack 3), `public/targets/*`(카드 리디자인+재컴파일), `docs/cards-print.pdf`, `vite.config.js`(input 추가)

**Interfaces:** Produces `captureMoment` 계약. Consumes `loadCharacter(key)`(불변). **main.js 수정 금지** — 스크린샷 버튼 배선은 조율 세션 몫, 사용 예 주석으로.

- [ ] 카드 리디자인: 수집 카드풍(일러스트+이름 리본+오렌지 프레임+은은한 배경 패턴). **컴파일러 특징점 시각화로 3장 검증** — docs/marker-setup.md 절차로 cards.mind 재컴파일, PDF 갱신
- [ ] capture.js: video 프레임+three 캔버스(렌더 직후 동기 캡처)+캡션 합성 → navigator.share → 폴백 다운로드
- [ ] marker.js: `maxTrack: 3` + 타깃별 앵커에 각 캐릭터 (기존 found 흐름 유지)
- [ ] dashboard.html: `CONFIG.DASHBOARD.csvUrl` 폴링(10s), 미설정 시 데모 데이터 모드 라벨. vite input 추가 후 build에 포함 확인
- [ ] `npm test`+build+스크린샷(새 카드·대시보드 데모 모드) → 커밋 `feat: 카드 리디자인·기념 스크린샷·멀티 카드·대시보드`

### Task D: 견고화 팩 + E2 + F3 (worktree ../raon-wt-robust, 브랜치 agent/robust)

**Files:** Create `src/queue.js`, `public/sw.js`(오프라인 캐시) / Modify `src/main.js`(전담), `index.html`(#error-screen·온보딩·비AR 링크), `src/style.css`(append), `src/config.js`(kiosk·한정성 문구·온보딩 문구 추가) / Test `test/queue.test.js`

**Interfaces:** Consumes queue 계약(자체 산출), submitSurvey(불변). Produces main.js의 URL 파라미터 처리(`?kiosk=1`, `?char=`, `?size=life|giant`, `?camera=user`) — size/camera 값은 initOverlay 옵션으로 전달만 (A팩이 옵션 구현; 머지 전엔 옵션 없어도 동작하도록 전달부를 옵셔널로).

- [ ] queue.js TDD: enqueue/flush/pendingCount + 파손 JSON 무시 (vitest 실패→구현→통과)
- [ ] 마커 dynamic import (`await import('./scenes/marker.js')`) + 버튼 로딩 상태 — build에서 청크 분리 확인 (index 청크 < 700KB)
- [ ] 전역 에러 가드(#error-screen, 1회 표시) + 구글 폼 직접 링크(완료·에러·전송실패·시작 하단 "📝 카메라 없이 참여하기"→설문 직행)
- [ ] 온보딩 1장(3스텝 아이콘, 최초 1회 localStorage), 한정성 문구(config), 체험 종료 시 `overlay.stopCamera?.()` 호출, 키오스크 무입력 리셋
- [ ] 트래킹 실패 친절 안내: WebXR 레티클 15초 미검출 시 "바닥을 찾기 어렵나요? 밝은 곳에서 바닥을 천천히 비춰보세요" 힌트 (마커 모드 30초 폴백은 기존 유지)
- [ ] service worker: 모델·텍스처·타깃 precache (등록은 main.js, 실패해도 무해하게)
- [ ] `npm test`+build+스크린샷(온보딩·에러 화면·비AR 설문 직행) → 커밋 `feat: 오프라인 큐·에러 가드·온보딩·키오스크·비AR 폴백 + SW 캐시`

### Task 조율: 머지·연결·검증·배포 (조율 세션 직접)

- [ ] B→C→A→D 순 머지 (충돌 최소 순서), 각 머지마다 test+build
- [ ] main.js 연결부 직접 추가: `sound.play` 트리거(등장 pop·점프 boing·쓰다듬기 twinkle·버튼 tap), `onAnswer` rating→cheer/sad+burst, 완료 화면 [📸 기념사진]→captureMoment, initOverlay에 size/camera 파라미터 전달
- [ ] 전체 헤드리스 회귀(시작→AR→설문→완료, 파티클·모션 연속 프레임) + `npm test` + build
- [ ] CURRENT_STATE/NEXT_STEP 갱신 → push → 프로덕션 검증(사이트 200 + 번들 해시 + 헤드리스)

### Task F: 다국어·접근성 (머지 후 순차, worktree ../raon-wt-i18n, 브랜치 agent/i18n)

- [ ] F1: `STRINGS = { ko, en }` 사전으로 전 UI 문자열 이동 (`t(key)` 헬퍼, `?lang=` > navigator.language > ko, 🌐 토글) — vitest: 키 누락 시 ko 폴백
- [ ] F2: aria-label 전수, 말풍선 `aria-live="polite"`, 포커스 링, 별점 키보드 조작, reduced-motion에서 파티클·모션 스킵
- [ ] test+build+스크린샷(en 모드) → 커밋 → 조율 세션 머지·배포

## 머지 프로토콜 (조율 세션)

1. 워크트리: `git worktree add ../raon-wt-<name> -b agent/<name>` (main 최신에서)
2. 머지 충돌은 조율 세션이 해결 (오늘 검증된 패턴: 양쪽 유지 + 연결부 직접 작성)
3. 에이전트 커밋은 보존, squash 안 함. main force-push 금지
4. 배포 전 반드시: test → build → 헤드리스 스크린샷 육안 확인
