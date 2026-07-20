# 셸 재작성 + 검증 인프라 설계 (E2E-first Shell Rewrite)

- 날짜: 2026-07-20 · 승인: 사용자 (접근 A 선택, 섹션 1~4 개별 승인)
- 목표 버전: v1.4.0

## 배경 — 왜 지금 갈아엎나

기능을 빠르게 쌓는 동안 배선 계층(main.js)에 임시방편이 누적됐고, 그 결과가 실기기에서만 발견되는 버그로 나타났다(2026-07-20 "라오나가 '저는 라옹이에요'" 정체성 버그 — 유닛 테스트 한 줄이면 잡혔을 결함). 실측 인벤토리:

| 문제 | 증거 |
|---|---|
| main.js 모놀리스 — 전 기능 배선+상태 한 파일 | 932줄 (2위 파일의 3배) |
| 화면 전환 3중 메커니즘 — `data-screen` + `style.display` 토글 + body 클래스 | display 토글 8곳, z-order 해명 주석 3곳 |
| 씬 인터페이스 불일치 — overlay/marker/webxr/vision 제각각, `activeScene` nullable | `?.` 방어 가드 12곳 |
| 진입 가드 3벌 복붙 | overlayEntering/markerEntering/visionEntering |
| 전역 상태 산재 | gyroGranted, characterCache, currentSpeaker, guideSpeakerLock, localStorage 키 3종 |
| three 이중 로드 경고 | mind-ar shim 경로 |
| 테스트 사각지대 — 102개 전부 순수 로직, 배선·플로우는 일회성 헤드리스에 의존 | |
| usdz 러너의 외부 의존 뗌빵 | `PUPPETEER_DIR` 환경변수 |

## 원칙 (사용자 지시)

1. **실기기 없이 검증 가능하게** — 모든 동작에 "깨지면 어떤 테스트가 잡나"의 답이 있어야 한다.
2. 예쁘고 에러 없게 > 기능. 시각적 동작은 전후 동일해야 한다.
3. 상황 변화에 빠르게 — config/i18n 중심 유연성 유지.

## 설계

### 1. 검증 인프라 (선행 — 안전망을 먼저 친다)

- `scripts/e2e.mjs` + `npm run e2e`. **puppeteer-core를 devDependency로 정식 추가**하고 `PUPPETEER_DIR` 뗌빵 제거 (`scripts/export-usdz.mjs`도 같이 정리).
- Chrome fake 미디어 플래그(`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`)로 카메라 허용 경로를 실제로 주행한다.
- 시나리오 매트릭스 (각 시나리오 공통 단언: 기대 말풍선 내용·화면 상태 전이·콘솔 에러 0):
  1. 온보딩 → 오버레이 → 가이드 3캐릭터 배턴터치 → 설문 → 완료
  2. `?char=` 3종 — 전 대사 정체성 (고정 캐릭터 외 이름 노출 금지)
  3. `?visionMock=raong` — 인식 → 단독 진행 정체성
  4. 카드 진입 → (fake 카메라로는 미인식) 30초 폴백 버튼 → 오버레이 폴백
  5. 설문 제출 — 네트워크 인터셉트로 구글폼 POST 스텁(실전송 금지) + 오프라인(요청 차단) 시 큐 적재→복구 flush
  6. `?lang=en` 주요 화면 문구, `?kiosk=1` 무입력 리셋, 크기 칩 적용
- **GitHub Actions에 e2e 잡 추가** — build 후 preview 서버 + headless Chrome으로 배포 전 게이트.
- 실기기로만 확인 가능한 것(마커 실트래킹 정밀도, 실제 자이로 물리값, AR Quick Look)은 README 실기기 체크리스트로 명시적으로 남긴다 — 단, 그 로직 자체는 §3의 주입 구조로 헤드리스 검증한다.

### 2. 셸 아키텍처 — main.js를 역할별 모듈로 재작성

```
src/app/
  store.js    앱 상태 단일 소유: { mode, lockedCharacter, characterHeight, cameraFacing,
              kiosk, lang } + URL 파라미터 파싱. 구독(subscribe)으로 UI 갱신.
  router.js   화면 전환 단일 메커니즘. 화면은 `data-screen`(start/guide/survey/done/
              marker/vision/direct-survey/error), 겹치는 모드 상태는 `data-mode`(예:
              marker-flow, xr)로 — 두 어트리뷰트 모두 router만 쓴다. router 밖에서의
              style.display 직접 토글·ad-hoc body 클래스는 금지, CSS는 이 셀렉터로 일원화.
  scenes.js   씬 공통 계약과 어댑터:
              interface Scene { start(opts), stop(), setCharacter(model), playEntrance(),
                                playMotion(name), burst(type), stopCamera() }
              overlay/marker/webxr/vision 각각 어댑터로 래핑. activeScene은 null 불허 —
              NullScene(전 메서드 no-op)으로 `?.` 가드 제거.
  guide.js    대본 진행(모드 무관): flow 생성, 화자 전환(ensureCharacter·캐시), 화자 승계
              (lockedCharacter), 설문 시작·완료·리액션. 씬은 Scene 계약으로만 접근.
  entry.js    진입 경로 공통 골격: 중복 가드(entering) 1개 구현, 자이로 선요청,
              진입 실패 폴백 규약.
main.js       부트스트랩만: store 초기화 → DOM 라벨 바인딩(i18n) → 이벤트 배선 → 라우터
              시작. 목표 150줄 이하.
```

- **불변(재작성 금지)**: scenes/overlay·marker·webxr·vision의 렌더링 내부, survey.js,
  queue.js, sound.js, motion.js, effects.js, capture.js, i18n.js, characters.js,
  solo-character.js. 어댑터가 기존 API를 감싼다.
- 이관은 모듈 단위로 하되, 각 단계에서 `npm test` + `npm run e2e` 전부 통과를 커밋 조건으로 한다.

### 3. 실기기 의존 격리 (mock 주입)

- overlay: `initOverlay({ orientationProvider })` — 기본은 `window.deviceorientation` 구독,
  E2E는 fake 스트림 주입으로 "자이로 켜짐" 경로를 헤드리스 검증.
- vision: classifier가 이미 `?visionMock=` 주입 구조 — 계약을 명시 문서화만.
- 원칙: 기기 전용 API는 씬 생성 옵션의 provider로만 접근한다 (신규 코드 규약).

### 4. 잔여 정리

- three 이중 로드: vite `resolve.dedupe: ['three']` 적용 후 경고 소멸 확인.
- localStorage 키 상수 모듈(`app/storage-keys.js`)로 수집.
- 문서 동기화(README 구조도·CURRENT_STATE·NEXT_STEP), semver v1.4.0.

## 범위 제외 (Non-goals)

- 씬 렌더링 로직 재작성, TypeScript 전환, 시각·UX 변경, 새 기능. 대본·설문 내용 변경 없음.
- 대시보드(dashboard.html)는 이번 범위 밖 (독립 엔트리, 뗌빵 밀도 낮음).

## 성공 기준

1. E2E 매트릭스 6종이 재작성 **이전** 코드에서 전부 통과 (동작 고정 증명) → 재작성 **이후**에도 동일 통과.
2. `npm test`(102+) 전부 통과, 새 아키텍처 모듈(store/router/guide)에 유닛 테스트 추가.
3. main.js ≤ 150줄, `?.` 씬 가드 0곳, style.display 직접 토글 0곳(3중 메커니즘 → 1개).
4. "Multiple instances of Three.js" 경고 소멸.
5. CI에서 test + e2e 게이트 통과 후에만 배포.
6. 실기기 확인 항목이 체크리스트로 명시되고, 그 외 전부는 기기 없이 검증된다.

## 리스크와 대응

- **E2E가 못 잡는 시각 회귀** → 각 시나리오에서 스크린샷 아카이브(픽셀 비교는 안 하되 수동 대조용 저장).
- **fake 카메라와 실기기 차이** → 센서·트래킹은 provider 격리로 로직만 검증하고, 물리 경로는 실기기 체크리스트(사용자 수시 협조 가능 확인됨).
- **마감(7/31) 리스크** → 0단계(E2E)만으로도 독립 가치가 있음. 셸 이관은 모듈 단위로 중단 가능한 구조.
