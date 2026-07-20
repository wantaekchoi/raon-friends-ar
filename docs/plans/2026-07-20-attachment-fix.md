# 공간 부착감 개선 Implementation Plan (A+B+D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "캐릭터가 카드/바닥에 붙어있지 않다" 문제를 3방향으로 해결 — 카드 6DoF 유지(A), 오버레이 기대 관리+자이로 캐시(B), iPhone AR Quick Look 완전 고정(D).

**근본 원인(systematic-debugging 확정):** ①오버레이=자이로 3DoF라 위치 미추적(다가가면 멀어져 보임 — iOS 웹 한계) ②카드 모드는 6DoF인데 소환 시맨틱이 1.6초 후 3DoF 오버레이로 전환해 부착성을 버림.

**Tech:** MindAR onTargetFound/Lost 재부모화 · three.js USDZExporter(헤드리스 브라우저에서 실행) · AR Quick Look(`<a rel="ar">`)

## Global Constraints
- CLAUDE.md 검증 순서 준수, push 전 테스트+빌드+헤드리스 스크린샷
- UI 문구는 i18n(ko/en), 값은 config
- 기존 3모드 회귀 금지 (특히 Vision·soloChar 경로)

---

### Task B: 오버레이 기대 관리 + 자이로 권한 캐시 (작업 트리에 부분 적용됨 — 완성·검증·커밋)
**Files:** src/main.js, src/scenes/overlay.js, src/i18n.js
- [ ] 이미 적용된 변경 검토: ensureGyroPermission(제스처 캐시)·initOverlay gyroAllowed 옵션·gyroOffHint
- [ ] 힌트 문구를 "고정 모드" 안내에서 **행동 유도**로 확장: 자이로 ON이어도 최초 1회 "제자리에서 천천히 둘러보세요 📍 (걸어가면 친구가 밀려나요)" 표시 — i18n `overlayLookHint` ko/en 추가, xr-hint 배너 5초
- [ ] btn-vision 클릭 핸들러에도 ensureGyroPermission() 선호출 추가 (마커와 동일 — 인식 후 전환 대비)
- [ ] npm test + build + 헤드리스(힌트 노출 스크린샷) → 커밋 `fix: 자이로 권한 제스처 캐시 + 오버레이 시점 한계 안내 힌트`

### Task A: 카드 하이브리드 — 소환 후에도 마커 세션 유지 (부착+지속)
**Files:** src/scenes/marker.js, src/main.js, src/i18n.js
- [ ] marker.js: initMarker 반환에 `holdCharacter(key)` 개념 재설계 —
  소환 확정 후에도 세션을 stop하지 않고: 대상 anchor의 standGroup을 유지, `onTargetLost` 시 캐릭터를 scene 루트로 재부모화해 **카메라 앞 고정 위치(마지막 화면 위치에서 lerp)** 로 이동, `onTargetFound` 시 다시 anchor로 재부모화(부드러운 복귀). 다른 두 캐릭터 anchor는 소환 확정 후 비활성(제거)
- [ ] main.js: 소환 onTarget에서 startOverlayFlow 전환 **제거** — 마커 세션 위에서 flow.start()+renderGuide() 진행(가이드·설문 UI는 기존 #screen-ar 요소를 마커 화면 위에 표시하거나 marker 화면에 동일 UI 노출 — 기존 소환 이전 구현처럼 #screen-ar 오버레이 사용: syncScreen이 #screen-ar 표시하므로 z-order만 확인). 홈 버튼 marker 유지, activeScene은 마커 세션 어댑터(setCharacter/playEntrance 없음 → null 가드 이미 존재)
- [ ] i18n: `markerLostHint` "카드를 다시 비추면 그 자리에 붙어요 🃏" (로스트 시 3초 배너)
- [ ] 설문 완료 시 markerSession.stop()+카메라 해제 (기존 stopCamera 경로에 연결)
- [ ] npm test + build + 헤드리스(마커 진입 UI 회귀 — 트래킹은 실기기 항목으로 보고) → 커밋 `feat: 카드 하이브리드 — 소환 후 6DoF 부착 유지, 로스트 시 화면 유지·재스냅`

### Task D: iPhone AR Quick Look (USDZ) — "진짜 바닥에 세우기"
**Files:** scripts/export-usdz.mjs(신규, 헤드리스 변환 러너), public/usdz/raong.usdz 등 3종, src/main.js, index.html, src/i18n.js
- [ ] 변환 러너: dev 서버 + puppeteer로 페이지 내에서 `포즈/` fbx 3종(라옹_주사기_포즈·라오니_포즈·라오나헤어3_포즈)을 characters.js 보정 규칙(vertexColors·텍스처·툰 제외 — USDZ는 Standard 재질로)으로 로드 → three USDZExporter로 .usdz 생성·다운로드 → public/usdz/ 배치. 용량 목표 각 3MB 이하(텍스처 리사이즈 512)
- [ ] 진입 UI: iPhone(iOS Safari) 감지 시에만 오버레이 화면에 "🍎 진짜 바닥에 세우기" 버튼 노출 → 현재 화자의 usdz를 `<a rel="ar" href=...>` 클릭으로 AR Quick Look 실행 (복귀 시 웹 상태 유지 확인)
- [ ] i18n: btnQuickLook ko/en. README·NEXT_STEP에 D 반영(모드 표에 Quick Look 추가)
- [ ] 검증: usdz 파일 생성·용량 확인, 데스크톱에선 버튼 미노출 확인(헤드리스). Quick Look 실동작은 실기기 체크리스트로 보고
- [ ] npm test + build → 커밋 `feat: iPhone AR Quick Look — 포즈 USDZ 3종 + 진짜 바닥 고정 버튼`

### 마무리
- [ ] CURRENT_STATE/NEXT_STEP 갱신, v1.3.0 태그, push 1회(대기열 취소 방지 — 전부 묶어서), 프로덕션 검증
