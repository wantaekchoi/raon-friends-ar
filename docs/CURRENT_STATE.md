# CURRENT_STATE

> 완료된 상태만 기록한다. 다음 작업은 [NEXT_STEP.md](NEXT_STEP.md), 결정 배경은 [adr/](adr/) 참고.

**최종 갱신**: 2026-07-20 (v1.4.3)

## 완료된 것

- **설계서 확정** — [`docs/design.md`](design.md): 전체 개요·캐릭터 3종 역할·시스템 구성도·화면 설계(S1~S4)·설문 설계·3D 파이프라인·저장소 구조·개발 일정·리스크 대응까지 13개 섹션 확정.
- **배포 파이프라인** — Vite 6 프로젝트 뼈대 + `.github/workflows/deploy.yml` (main push → `npm ci` → `npm test` → `npm run build` → GitHub Pages 자동 배포). `vite.config.js`에 `base: '/raon-friends-ar/'` 반영.
- **S1 시작 화면** — 타이틀 + 캐릭터 3종 썸네일(`public/img/raong.png`, `raoni.png`, `raona.png`) + [바로 만나기]/[카드로 소환하기(준비 중, 비활성)] 버튼. `src/config.js`로 타이틀·멘트·캐릭터 정보 관리.
- **화면 흐름 상태머신** — `src/flow.js`: `SCREENS`(START/GUIDE/SURVEY/DONE) + `createFlow()` (`start()`/`next()`/`finishSurvey()`/`reset()`).
- **오버레이 AR 화면** — `src/scenes/overlay.js`: `getUserMedia` 후면 카메라 배경(거부 시 그라데이션 폴백) + three.js 투명 캔버스 오버레이 + 등장 바운스·대기 숨쉬기 모션.
- **라옹 3D 모델 로드 + 렌더링 수정** — `src/characters.js`: FBXLoader로 `public/models/raong.fbx` 직접 로드, 로드 실패 시 임시 캡슐 캐릭터로 자동 폴백. 검정 렌더링 원인 2건 해결: ①vertexColors 요구하지만 정점색 데이터가 없는 메시는 머티리얼 clone 후 `vertexColors=false` ②`m.map`은 있지만 이미지가 깨진 임베디드 텍스처만 외부 텍스처로 교체. 레퍼런스 렌더와 일치 확인.
- **말풍선 안내 진행** — `src/ui/bubble.js`: 화자 이름 + 타이핑 효과로 `guideScript` 멘트를 순차 노출, [다음] 버튼으로 진행.
- **설문(S3)·완료(S4) 화면** — `src/survey.js`: 카드형 문항(동의/단답/객관식/별점/장문, 이후 7문항으로 확장 — 아래 참고) + 진행 바 + 필수 검증(shake) + 구글 폼 no-cors 전송(1회 재시도, `formId`가 비어있거나 `REPLACE_ME`면 자동 생략) + 완료 화면 [처음으로] 리셋.
- **시작 화면 폴리시** — 그라데이션 배경 + 플로팅 캐릭터(이름표·탭 바운스) + CTA glow 펄스 + `prefers-reduced-motion` 대응.
- **행사 제출 문서** — 신청서 문안·영상 스토리보드는 내부 보관(비공개 — 공개 저장소 미포함), README + QR(`docs/qr-prod.png`).
- **프로덕션 배포** — https://wantaekchoi.github.io/raon-friends-ar/ 라이브 (public repo, main push → Actions → Pages 자동 배포, Pages 자동 활성화 enablement 포함). 회사 원본 자산 48MB는 git 히스토리에서 제거됨.
- **3캐릭터 배턴터치** — `loadCharacter(key)` 일반화(라옹·라오니·라오나), guideScript `speaker` 전환 시 교대 등장, 무광 머티리얼(shininess≤8·roughness≥0.9).
- **지면 앵커 (포켓몬GO식)** — 캐릭터를 2.7m 앞 바닥(y=0)에 배치 + 접지 그림자 + 자이로 시점(iOS 권한 처리 포함, 미지원 시 고정 구도 폴백).
- **카드 마커 모드 (MindAR)** — 카드 3장 디자인 + `cards.mind` 컴파일(방법: docs/marker-setup.md) + `src/scenes/marker.js` + 인쇄용 `docs/cards-print.pdf`. 인식 실패 시 오버레이 폴백 버튼.
- **WebXR 바닥인식 (Android, 베타)** — hit-test 레티클 → 탭 배치 → SLAM 고정. 지원 기기에서만 버튼 노출, dom-overlay로 기존 UI 유지.
- **README 스크린샷 갤러리** — docs/screenshots/ 3장.
- **개선 배치(2차)** — 별점 리액션(cheer/sad)·쓰다듬기·하트/별 파티클·본 기반 모션 3종 추가 / WebAudio 효과음 4종+🔊토글 / 카드 수집카드풍 리디자인(특징점 31~45pt 균일)·기념 스크린샷·멀티 카드(maxTrack 3)·대시보드(dashboard.html, 데모 모드) / 오프라인 응답 큐·전역 에러 가드·온보딩·키오스크(?kiosk=1)·비AR 설문 직행+구글폼 직접 링크·SW 캐시·마커 지연 로드(초기 번들 2.7MB→618KB) / 자이언트 모드(?size=life|giant)·매직미러(?camera=user) / 펀펀 가디언즈 세계관 반영 / 라오나 피부톤 수정.
- **다국어(ko/en) + 접근성 (F1·F2)** — `src/i18n.js`: 멘트·설문 문항·전 UI 문구를 `STRINGS.ko`/`STRINGS.en` 사전으로 이전, `currentLang()`(`?lang=` > `navigator.language` > `ko`) + `t()` dot-path 조회 + 플레이스홀더 치환. 시작 화면 🌐 토글(URL 갱신 후 reload로 재판별). 접근성: 상태 변화 요소에 `aria-live="polite"`(말풍선·마커 힌트·XR 힌트·비AR 직행 실패 메시지), `:focus-visible` 키보드 포커스 링, `prefers-reduced-motion`에서 파티클 burst 스킵·리액션 모션 진폭 축소(완전 정지는 아님).
- **구글 폼 실연결** — `src/config.js`의 `GOOGLE_FORM`에 실제 formId + entry ID 6종(성함·소속·연락처·별점·인상깊은점·의견) 반영 완료. "기타" 자유입력 옵션은 구글 규격(`__other_option__` + `.other_option_response` 쌍)으로 전송(`buildFormBody`). 단, 개인정보 동의 문항은 아직 entry ID가 없어 스프레드시트에는 기록되지 않음 — [NEXT_STEP.md](NEXT_STEP.md) 참고.
- **개인정보 수집·이용 동의 카드** — 설문 첫 문항으로 추가돼 총 7문항 체계(동의→별점→인상깊은점→의견→성함→소속→연락처)로 재배열. 영어 UI에서도 구글 폼 원문(한국어) 값으로 전송(`submitValue`).
- **적대 리뷰 3건 반영** — 기획·영업 리뷰: 행사 안내 멘트·경품 추첨 안내 문구·문항 순서 재배열(선택형 우선)·캐릭터 로딩 대기 문구·브랜드 라인(`CONFIG.ui.brandLine`)·자산 고지. 개발 리뷰: `public/sw.js` cache-first → stale-while-revalidate 전환(CACHE_NAME v2, 재방문 시 자산 갱신 반영), `submitAndRetry`의 재시도 무한 대기 탈출구(첫 실패 시 [처음으로]·키오스크 리셋 즉시 노출), `queue.js`의 동시 flush 직렬화(`flushInFlight`), 대시보드 CSV 헤더-문항 불일치 경고 배지, 대시보드 csvUrl 개인정보 노출 경고 주석.
- **README 전면 현행화** — 3체험 모드·마커 카드·URL 파라미터·대시보드·매직미러 부스 레시피·저장소 구조 반영.
- **대시보드 데모 데이터 게이팅** — `?demo=1`을 붙였을 때만 데모 숫자 노출, 기본은 "연동 대기" 안내만 표시(공개 URL에서 가짜 숫자가 실데이터처럼 보이지 않도록).
- **동의 기록 폼 연결 (2026-07-20)** — 구글 폼에 동의 문항(첫 위치·필수·옵션 '동의합니다') 추가, `entries.privacyConsent` 연결, 실전송으로 시트 H열 기록 검증. 응답 탭 `responses` 개명(폼 연동 유지), 개인정보 제외 `public` 집계 탭 웹 게시 → 대시보드 실시간 연동 검증. cmux 내장 브라우저 자동화로 수행.
- **테스트 59개** (flow 5 + survey 21 + consent 4 + i18n 14 + sound 7 + queue 8) + 통합 헤드리스 검증(온보딩→AR→별점 리액션→완료) 에러 0건.

- **v1.1.0 인앱 메뉴 (2026-07-20)** — URL 파라미터를 몰라도 되도록: 시작 화면 캐릭터 크기 칩(기본/등신대/자이언트, reload 없이 적용) + ⚙️ 운영자 바텀시트(키오스크·매직미러 토글, 대시보드 링크, 북마크 가능한 URL 생성).

- **v1.2.0 Vision AI 인식 모드 (2026-07-20)** — 시작 화면 "🔍 AI가 알아봐요(체험)" 진입: 카메라로 마스코트(카드·굿즈)를 비추면 분류기가 캐릭터를 인식해 해당 캐릭터가 안내 전체 진행. 구조: scenes/vision.js(세션 인터페이스, 지연 로드) + vision/classifier.js(mock `?visionMock=` / MediaPipe 실 모델 라우팅, WASM은 CDN) + vision/recognition-gate.js(연속 N회·threshold 게이트, 순수 로직) + solo-character.js(?char=·카드 소환·Vision 공통 캐릭터 고정). 모델 파일(public/models/vision/*.tflite)은 미배치 — 없으면 폴백 UI(오버레이/설문 직행). SW는 모델 경로만 네트워크 우선. 테스트 88개.
- **카드 소환 시맨틱 + 기립 (2026-07-20)** — 카드 인식=소환 확정(연출 1.6초 후 오버레이로 전환해 캐릭터 지속), 눕힌 카드에서 수직 기립 자동 전환, 트래킹 스무딩. 🏠 홈 버튼(AR·마커)과 Android 뒤로가기 홈 처리, 캐릭터 셀 셰이딩(툰) 전환.

- **v1.3.0 공간 부착감 개선 (2026-07-20)** — systematic-debugging으로 원인 확정(오버레이=자이로 3DoF 위치 미추적 / 카드=소환 시 오버레이 전환이 6DoF 부착을 버림) 후 3방향 수정: ① 카드 하이브리드 — 소환 후에도 마커 세션 유지(카드 보이면 6DoF 부착, 놓치면 화면 유지, 재인식 시 스냅 — marker.js confirmSummon/attach 재부모화), 가이드·설문 UI는 #screen-ar를 마커 뷰 위에 얹음(body.marker-flow) ② 오버레이 기대 관리 — 자이로 권한 제스처 캐시(ensureGyroPermission, 소환·Vision 경로 대비) + 최초 1회 "제자리에서 둘러보세요" 힌트 ③ iPhone AR Quick Look — 캐릭터 3종 .usdz(three USDZExporter 헤드리스 변환: 툰→스탠더드, 멀티머티리얼 그룹 분할, mergeVertices 용접 — scripts/export-usdz.mjs + usdz-export.html) + iOS에서 [진짜 바닥에 세우기] 버튼(rel="ar" 앵커)으로 네이티브 ARKit 완전 고정. usdz 용량 3.6/6/12.4MB(탭 시에만 다운로드).

- **v1.3.1 단독 진행 정체성 버그 수정 (2026-07-20)** — 카드 소환·?char=·Vision에서 speaker만 바꾸고 대사는 릴레이 원문을 쓰던 lockGuideScriptToCharacter를 폐기, buildSoloGuideScript(캐릭터별 soloIntro + 정체성 중립 soloGuideLines 조립)로 교체. 설문·완료·기념사진 화자도 고정 캐릭터 승계(guideSpeakerLock). 회귀 방지: 실제 STRINGS 기반 정체성 불변식 테스트 14개 추가(총 102개) + ?char=raona 헤드리스 E2E로 전 대사 검증.

- **v1.4.0 E2E-first 셸 재작성 (2026-07-20)** — 계획: `docs/superpowers/plans/2026-07-20-shell-rewrite.md`. `main.js`(932줄, 화면 전환 3중 메커니즘·산발적 `style.display` 토글·씬 optional-chaining 가드 다수)를 먼저 E2E 8종으로 동작 고정한 뒤 `src/app/` 모듈 + 부트스트랩으로 재작성.
  - **E2E 하네스** — `scripts/e2e/harness.mjs`(puppeteer-core, fake 카메라 headless Chrome) + 시나리오 8종: S0 시작 화면·S1 오버레이 배턴터치 전체 플로우·S2 `?char=` 단독 정체성 불변식·S3 Vision mock 인식·S4 카드 미인식 폴백·S5 설문 전송 스텁+오프라인 큐·S6 파라미터 매트릭스(en/kiosk/size)·S7 자이로 provider 주입(`?fakeGyro=1`). `npm run e2e`로 빌드→preview 기동→전체 순차 실행. CI(`​.github/workflows/deploy.yml`)에 e2e 게이트 삽입 — 실패 시 배포 미도달.
  - **`src/app/` 9모듈** — `store.js`(URL 파라미터 파싱+구독 상태 단일화)·`storage-keys.js`(localStorage 키 상수화)·`router.js`(`data-screen`/`data-mode` 단일 소유, `style.display` 토글 완전 제거)·`scenes.js`(`asScene`/`NullScene` 계약 — 씬 메서드 optional-chaining 가드 제거)·`guide.js`(안내·설문 흐름, 모드 무관)·`entry.js`(`createOnceGuard` — 모드 진입 중복 가드 통합 + 재무장)·`labels.js`(정적 라벨 대입)·`start-screen.js`(온보딩·크기 칩·운영자 시트·언어/음소거 토글)·`timing.js`(`scaledMs` — `?timerScale=`로 E2E 대기시간 단축).
  - **자이로 provider 주입** — `src/scenes/overlay.js`의 `deviceorientation` 구독을 `orientationProvider` 주입형으로 바꿔 S7이 `window.__fakeOrientation`으로 헤드리스 검증(렌더링·기본 동작 불변).
  - **three.js dedupe** — `vite.config.js`에 `resolve.dedupe: ['three']` 추가. 실측: 프로덕션 빌드+`vite preview`(E2E가 검증하는 환경)는 dedupe 적용 전에도 Rollup이 동일 파일로 정적 결합해 "Multiple instances of Three.js" 경고 0건(적용 후도 동일, 회귀 없음). 반면 `npm run dev`는 esbuild optimizeDeps가 `mind-ar`/`three/addons/loaders/FBXLoader.js`의 내부 `three` 임포트를 별도 프리번들 사본으로 분리해 경고가 실제로 재현됨(dedupe 적용으로도 dev 모드 자체는 완전히 해소되지 않음 — 근본 해결은 `optimizeDeps.exclude`가 필요해 범위 밖, NEXT_STEP 참고). `ctx.warnings`(harness가 새로 수집하는 console.warn 전수, 기존 에러 판정과 별개) 기반 회귀 방지 단언 추가 — 처음엔 S0에 뒀으나 감사 후 S4로 이관(아래 v1.4.1 항목 참고: mind-ar 청크가 실제 로드되는 시나리오라야 의미가 있다).
  - **성과 수치** — `main.js` 932→377줄(목표 150은 미달 — 배선 코드 특성상 남은 것으로 판단, 사유는 계획서 Task 10 기록) · `style.display` 산발 토글 0건 · 씬 메서드 호출부 optional-chaining 가드 0건(`NullScene`으로 대체) · 테스트 102→120개(store 3·scenes 2·timing 4·entry 4·router 2·guide 3 신규) · E2E 8종 로컬 전체 그린 · CI(GitHub Actions)에 e2e 게이트 적용 — 배포 전 8종을 실행해 실패 시 배포 차단.

- **E2E 감사 반영 (2026-07-20, v1.4.1)** — 별도 세션의 E2E 감사 지적을 실측 확인 후 조치: ① S0의 three 중복 경고 단언은 mind-ar 청크가 로드되지 않는 시작 화면이라 구조적으로 발화 불가(=무의미)여서 제거하고, 청크를 실제 로드하는 S4 것만 유지 ② 테스트 전용 파라미터 `?timerScale=`·`?fakeGyro=`를 localhost에서만 유효하도록 제한(`src/app/test-params.js`) — 공개 URL에서 키오스크 리셋 타이머·자이로를 왜곡할 수 있던 오작동 벡터 차단(`?visionMock=`은 실기기 시연용이라 제외) ③ 최대 커버리지 구멍이던 카드 소환 **성공** 경로를 `?markerMock=`(localhost 전용, 인식 이후 시퀀스를 실경로와 공유)으로 S8 신설 ④ 전역 에러 화면 S9·키오스크 자동 리셋 S10·언어 토글 클릭(S6) 추가. 신규 시나리오는 전부 음성통제(관련 로직 일시 파손 시 실패 확인)를 거쳤다. E2E 8종→11종, 테스트 120→127개.

- **v1.4.2~v1.4.3 심사 대비 방어 (2026-07-20)** — 외부 심사위원 관점 리뷰에서 나온 실사용 결함 2건 조치: ① **Vision 버튼이 항상 실패하던 문제** — 분류기 모델(tflite)이 배포본에 없어 [AI가 알아봐요]를 누르면 100% 폴백 화면이 떴다. 카드 버튼이 이미 쓰던 자산 존재 확인 패턴을 공용 함수(`gateButtonOnAsset`)로 뽑아 Vision에도 적용 — 모델이 없으면 "준비 중 🚧" 비활성, 배치하면 코드 변경 없이 자동 활성화, `?visionMock=`은 항상 우회. E2E S0가 이 상태를 검증(음성통제 확인). ② **fbx에 구워진 제작 PC 절대경로** — `raoni.fbx`의 `C:\Users\Administrator\raoni_texture-01.jpg` 요청이 프로덕션에서 매번 404를 냈다(화면은 머티리얼 규칙이 외부 텍스처로 교체해 정상이라 눈에 안 띄었음). `LoadingManager.setURLModifier`로 배포 텍스처로 돌려 요청 자체를 제거. 파비콘도 추가해 루트 `/favicon.ico` 404를 없애고 하네스의 예외 분기를 삭제 — 이제 E2E "콘솔 에러 0건"에 파비콘 예외가 없다. 테스트 127→132개. README는 체험 모드 5종·E2E 11종·유닛 수치·스크린샷까지 현행화.

## 아직 안 된 것

[NEXT_STEP.md](NEXT_STEP.md) 참고. 요약: 구글 폼 동의 문항 entry 연결, 대시보드 시트 연동(csvUrl), 실기기 테스트, 시연 영상·신청서 제출, 별점 1~2점 "sad" 리액션 유지 여부 결정.
