# 바닥 포스터 fiducial(ArUco) 인식 Implementation Plan

> ✅ **실행 완료 (2026-07-22)** — 전 태스크 구현·검증 완료(유닛 152 · E2E 14종 그린). 계획 대비 변경:
> ① 마커별 POSIT → 전 마커 꼭짓점 호모그래피 분해(평면 2중 해 모호성 계측 후, ADR 0002)
> ② js-aruco2 svd 버그로 야코비 고유분해 자체 구현 ③ e2e 하네스 URL.pathname → fileURLToPath
> ④ E2E 합성 y4m의 원근 매핑을 진짜 핀홀 기하로 교정(가짜 원근은 호모그래피가 거부).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바닥 대형 포스터를 ArUco 모서리 마커 4점으로 인식해, 사선에서도 오인식 0·기립 고정("딱 붙게")을 달성한다.

**Architecture:** 손 카드는 기존 MindAR(NFT) 유지. 포스터는 [카드로 소환하기] 진입 후 MindAR의 video를 150ms 간격 샘플링해 js-aruco2로 검출 — 3연속 검출 시 MindAR를 멈추고 poster 씬(자체 카메라+three)으로 전환. 마커 ID가 캐릭터+모서리를 인코딩해 교차 오인식이 불가능. 포즈는 마커별 POSIT 6DoF → 다중 평균 → 지수 스무딩.

**Tech Stack:** js-aruco2 2.0.0 (사전 ARUCO_MIP_36h12, `AR.Detector#detect(imageData)`, `AR.Dictionary#generateSVG(id)`, `POS.Posit(modelSize, focal)#pose(centeredPoints)`), three.js, Vitest, 기존 E2E 하네스(y4m fake camera).

## Global Constraints

- `npm install`은 항상 `--ignore-scripts` (repo CLAUDE.md).
- 커밋·push는 사용자 담당 — 작업자는 파일 변경·검증까지만, 커밋 메시지는 제안만.
- localStorage 키 문자열 불변. UI 문구는 `src/config.js`(i18n STRINGS) 경유.
- 검증 순서: `npm test` → `npm run build` → `npm run e2e` 전부 그린이어야 완료.
- 마커 ID 규약: 라옹 10~13 · 라오니 20~23 · 라오나 30~33, corner = id%10 (0:좌상 1:우상 2:좌하 3:우하).
- 포스터 좌표 단위: 포스터 폭 = 1.0. 마커 한 변 MARKER_FRAC = 0.14, 모서리 여백 MARGIN_FRAC = 0.03.

---

### Task 1: poster-detect 순수 로직 (ID 매핑·3연속 게이트·모서리 오프셋)

**Files:** Create `src/scenes/poster-detect.js`, Test `test/poster-detect.test.js`

**Produces:** `markerToCharacter(id) -> {key, corner}|null` · `cornerOffset(corner, aspect) -> {x, y}`(포스터 중심 기준, 폭=1 단위) · `createConsecutiveGate(n) -> {feed(key|null) -> key|null}`(같은 key n연속 시 그 key 반환, 아니면 null; miss로 리셋) · `MARKER_FRAC`, `MARGIN_FRAC`, `MARKER_IDS`.

- [ ] 실패 테스트 작성: id 10→{raong,0}·23→{raoni,3}·34/9→null; cornerOffset(0, h/w=1.46)이 {x:-(0.5-0.03-0.07), y:+(0.73-0.03-0.07)}; gate(3)에 raong,raong,null,raong,raong,raong feed 시 마지막에만 raong.
- [ ] `npm test` 실패 확인 → 구현 → 통과 확인.

### Task 2: 인쇄물에 마커 삽입 (floor-card SVG 3종 + 분할 PDF 재생성)

**Files:** Create `scripts/inject-poster-markers.mjs`, Modify `docs/print/floor-card-{raong,raoni,raona}.svg`(재생성)

- [ ] 스크립트: `require('js-aruco2')`의 `new AR.Dictionary('ARUCO_MIP_36h12').generateSVG(id)`로 마커 SVG 문자열 생성 → base64 data-URI `<image>`로 각 SVG의 4모서리에 삽입(마커 뒤 흰 quiet-zone rect 포함, 크기 `MARKER_FRAC×폭`, 여백 `MARGIN_FRAC×폭`). 멱등성: 주입 마커에 `id="aruco-corner-N"` 부여, 재실행 시 기존 것 교체.
- [ ] 실행 후 Chrome 헤드리스로 SVG 스크린샷 → 4모서리 마커·중앙 아트 무손상 육안 확인.
- [ ] `print/make-poster.mjs` 재실행으로 분할 PDF 재생성.

### Task 3: 포즈 수학 (posit→three 변환·다중 평균·스무딩·포스터 중심 역산)

**Files:** Create `src/scenes/poster-math.js`, Test `test/poster-math.test.js`

**Produces:** `positToThree(bestRotation, bestTranslation) -> {position:[x,y,z], quaternion:[x,y,z,w]}`(three 카메라 공간: y·z 부호 반전) · `posterCenterFrom(markerPose, corner, aspect) -> {position, quaternion}`(cornerOffset을 마커 로컬 평면에서 역적용) · `createPoseSmoother(alpha) -> {push(pose) -> pose}`(pos lerp + quat slerp) · `averagePoses(poses) -> pose`.

- [ ] 실패 테스트: 항등 회전 posit 결과가 {pos:[tx,-ty,-tz], quat 항등}; 마커 로컬 +x 오프셋이 요 90° 회전 포즈에서 월드 -z로 매핑; smoother alpha=1이면 즉시 추종·0.5면 중간값; averagePoses가 두 항등 포즈 평균 = 항등.
- [ ] 구현(회전행렬→Matrix4→Quaternion, 축 변환 `m[i][j]`에서 1·2행 부호 반전) → 통과.

### Task 4: poster 씬 (검출 루프 + 캐릭터 기립 부착)

**Files:** Create `src/scenes/poster.js`

**Interfaces:** `initPoster({ containerEl, characterKey, video? }) -> Promise<{stop()}>`. 내부: 자체 getUserMedia(environment, overlay.js 패턴) 또는 전달받은 video 재사용 → 640px 캔버스 샘플(rAF 2프레임당 1회) → `AR.Detector` 검출 → 보이는 마커들 각각 `POS.Posit(MARKER_FRAC, 640).pose(중심원점 좌표)` → Task 3 수학으로 포스터 중심 포즈 → 평균 → smoother(α=0.25) → standGroup에 적용. 캐릭터 업 = 포스터 평면 법선(카메라 쪽), 요는 카메라 빌보드, 키 = 포스터 폭 × 1.3. 미검출 시 마지막 포즈 유지(N=20연속 미스 후에도 유지, 재검출 시 스냅). `?posterDebug=1`(testParam)일 때 `window.__posterState = {up dot worldUp, tracked}` 노출(E2E 단언용).
- [ ] three 씬(투명 캔버스 오버레이 + marker.js와 동일 스튜디오 조명 + loadCharacter) 구성 → 헤드리스 스모크(모의 y4m으로 화면 캡처 육안).

### Task 5: entry.js 배선 (posterWatch + NFT veto + 전환)

**Files:** Modify `src/app/entry.js`(enterMarkerMode 내부), `src/config.js`/`src/i18n.js`(힌트 문구 1개 추가: `markerPosterFound` ko/en)

- [ ] enterMarkerMode에서 initMarker 성공 후: `containerEl.querySelector('video')`를 300ms 폴링으로 획득 → 150ms 간격 샘플 + Task 1 게이트(3연속). 게이트 통과 시 `confirmPoster(key)`: `found=true`, fallbackTimer 해제, markerSession.stop(), 컨테이너 정리, `initPoster` 동적 import·시작, 힌트→효과음→`startMarkerFlow(key)`(카드와 동일 1600ms 시퀀스).
- [ ] NFT veto: `confirmTarget` 진입부에 "최근 600ms 내 ArUco 검출 있음 → return" 가드(posterWatch가 타임스탬프 공유). markerMock 경로는 영향 없음.
- [ ] 기존 유닛·E2E(S4·S8) 그린 확인.

### Task 6: E2E 시나리오 + 최종 검증

**Files:** Create `scripts/e2e/scenarios/s12-poster-summon.mjs`, `scripts/e2e/scenarios/s13-poster-negative.mjs`, `scripts/e2e/assets/make-poster-y4m.mjs`(마커 포함 포스터를 사선 45°로 렌더 — debug-marker 렌더러 이식, 마커 이미지는 Task 2 스크립트 산출 SVG 사용), harness에 y4m 경로 주입 지원(브라우저 재기동 필요 시 S8 방식대로 자체 launch).

- [ ] S12: 마커 포스터 y4m + `?posterDebug=1` → marker-flow 진입 + 화자 라옹 + `__posterState.upDot ≥ 0.85` + posterMode 흔적 단언. 음성통제: veto 가드 주석 처리 시 화자 오염 재현 확인 후 원복.
- [ ] S13: 마커 없는 사선 포스터 y4m(debug-marker v2 조건 재생성) → posterMode 미진입 단언.
- [ ] `npm test` → `npm run build` → `npm run e2e` 전체 그린. CURRENT_STATE/NEXT_STEP 갱신, 커밋 메시지 제안 목록 작성.
