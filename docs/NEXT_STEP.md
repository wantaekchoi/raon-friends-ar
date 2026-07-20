# NEXT_STEP

> 완료 상태는 [CURRENT_STATE.md](CURRENT_STATE.md) 참고. 여기는 다음에 할 일만.

**최종 갱신**: 2026-07-20 (v1.4.0)

## 다음 작업

1. **실기기 테스트** — 오버레이(자이로·둘러보기 힌트), 카드 하이브리드(소환 후 카드 부착·놓침 시 화면 유지·재인식 스냅), iPhone [진짜 바닥에 세우기](AR Quick Look — usdz 3종 외형·바닥 고정 확인), WebXR(Android), 효과음(iOS 무음 스위치 포함), 기념사진 공유 시트, `?size=giant`·`?camera=user` 매직미러, 온보딩/키오스크, 다국어(🌐 토글로 영어 전환 시 문구·레이아웃 확인), 구글 폼 실전송(테스트 제출 1건으로 스프레드시트 적재 확인). **(v1.4.0 셸 재작성 추가분)** 마커 실트래킹(fake 카메라 E2E가 대체할 수 없는 실물 카드 인식)·실자이로(overlay orientationProvider 기본 경로)·Quick Look·효과음 — 셸 리팩토링이 렌더링/UX를 건드리지 않았다는 전제(스펙 Non-goals)를 실기기에서 최종 확인.
2. **시연 영상 촬영 + 신청서 제출** — 스토리보드(내부 보관 문서)대로 촬영(참여 컷 + 화면 캡처 + AI 활용 컷) → 업로드 → 신청서 확정·제출.
3. **별점 1~2점 "sad" 리액션 유지 여부 (사용자 결정 대기)** — 낮은 점수를 준 방문객에게 캐릭터가 시무룩해하는 리액션(`src/motion.js`의 `sad` 모션, 1.1초 뒤 `wave`로 회복)이 부담을 주거나 응답을 유도하는 것처럼 보일 수 있다는 우려가 있어 유지 여부 결정 필요.
4. **Vision AI 실 모델 제작·배치** — MediaPipe Model Maker(Colab)로 raong/raoni/raona/unknown 4라벨 분류기 학습(카드·렌더·굿즈 사진 각 수십 장+네거티브) → `public/models/vision/raon-mascot-classifier.tflite` 배치만 하면 코드 변경 없이 실 인식 활성화. 실기기에서 mock(`?visionMock=raong`)으로 흐름 먼저 확인 가능.
5. **E2E 후속 (감사 잔여, 낮은 우선순위)** — WebXR·Quick Look 버튼 노출 조건 검증(`supportsQuickLook` 모킹), S1/S5 catch의 실패 원인 구분(진단 품질), `--passWithNoTests` 제거, dev 모드 three 중복 경고(`optimizeDeps.exclude`).
6. **main.js 추가 축소 후보 (v1.4.0 셸 재작성 후속)** — 현재 377줄, 애초 목표(≤150줄)는 미달(사유: `docs/superpowers/plans/2026-07-20-shell-rewrite.md` Task 10 기록 — 부트스트랩 배선 자체가 본질적으로 남는 코드). 더 줄이려면: `submitAndRetry`(설문 재시도 루프), `startDirectSurvey`(비AR 직행 설문), 키오스크 리셋 타이머를 각각 별도 모듈로 추출하는 안을 검토할 것.

## 낮은 우선순위 (동작에 지장 없음)

- 마커 모드 중 가이드 진행 시 숨겨진 오버레이 씬에 불필요한 캐릭터 로드 가능성 — 가드 추가 검토.
- "orange" 순색 머티리얼이 fbx 내장값 `#cc1b01`이라 레퍼런스보다 붉음 — 색 오버라이드 검토.
- FBX "more than 4 skinning weights" 콘솔 경고 — 렌더링 영향 없음.
- fbx → glb 변환·Draco 압축 (Blender 또는 fbx2gltf 필요) — ADR 0001 §3 참고, FBX 직접 로드가 사실상 최종 방식으로 굳어졌으나 용량·로딩 속도 개선 여지로 후속 과제 유지.
- 파티클 풀(`src/effects.js` `POOL_SIZE=32`) 동시 다발 burst 시 라운드로빈으로 조기 재활용됨 — 실기기에서 화면이 붐빌 때 체감 확인 필요.
- 동일 기기 반복 제출·폼 entry 공개로 인한 어뷰징 — 설계 단계에서 감수하기로 한 리스크(design.md 12장), 서버리스 구조상 별도 조치 없이 계속 감수.
- `npm run dev`에서 마커/캐릭터 로드 시 "Multiple instances of Three.js" 콘솔 경고 재현(실측 확인, v1.4.0) — `mind-ar`·`three/addons/loaders/FBXLoader.js`가 esbuild optimizeDeps에서 별도 프리번들 사본으로 분리되는 게 원인. `vite.config.js`의 `resolve.dedupe: ['three']`로는 해소 안 됨(프로덕션 빌드+`vite preview`는 애초 무경고라 배포·E2E에는 영향 없음). 근본 해결은 `optimizeDeps.exclude: ['three']` 추가 검토 — 로컬 개발 콘솔 노이즈 제거 목적으로만 낮은 우선순위.
- 셸 재작성 태스크별 리뷰에서 나온 잔여 Minor 트리아지 — `.superpowers/sdd/progress.md`에 태스크별로 기록됨(예: S1 catch 원인 무구분, size-chip `:last-child` 셀렉터 취약, `overlay.js`의 Scene에 `stop()` 미구현 — `NullScene` no-op으로 안전하게 흡수되어 있어 기능상 문제는 없음). 필요 시 검토.
