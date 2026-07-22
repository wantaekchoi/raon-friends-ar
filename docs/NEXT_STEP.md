# NEXT_STEP

> 완료 상태는 [CURRENT_STATE.md](CURRENT_STATE.md) 참고. 여기는 다음에 할 일만.

**최종 갱신**: 2026-07-22 (포스터 fiducial 배포·실기기 1차 확인까지 반영)

## 다음 작업

1. **신청서 최종 제출 (마감 7/31 금)** — 폼 입력·영상 첨부까지 완료, "응답 수정 중" 상태에서 [제출] 버튼만 남음. 제출 전: 구버전 유튜브 2개(xPqG267Sc4U·IoOFPr713kE) 삭제, 새 링크 2개 시크릿 창 재생 확인, 배포 URL 동작 확인. 문항 7 문구는 팀 회의 결과에 따라 폼과 `../docs/private/submission.md` 동시 갱신.
2. **실기기 최종 확인 (축소된 범위)** — 쇼케이스 전환·카드 단일화(2026-07-21) 이후 유효 항목만: 실물 카드 인식·소환·홀드, **바닥 대형 포스터(마커 주입판)**: A4 1장판으로 소환·기립·부착 1차 확인 완료(2026-07-22, 키 2.2배 조정 포함) — 남은 것은 **대형 조립판(A2/A1 재인쇄) 실측**(반드시 마커 포함 신판, 구판 폐기), 쇼케이스 등장·말풍선·쓰다듬기, 툰 외곽선(쩜눈·팔 흔들 때 추종), 설문 실전송→시트 적재, 효과음. 오버레이 자이로·Quick Look·WebXR·크기 칩 항목은 기능 제거로 폐기(`../device-test-checklist.md` 배너 참고).
3. **별점 1~2점 "sad" 리액션 유지 여부 (사용자 결정 대기)** — 낮은 점수를 준 방문객에게 캐릭터가 시무룩해하는 리액션(`src/motion.js`의 `sad` 모션, 1.1초 뒤 `wave`로 회복)이 부담을 주거나 응답을 유도하는 것처럼 보일 수 있다는 우려가 있어 유지 여부 결정 필요.
4. **Vision AI 실 모델 제작·배치** — 데이터셋·노트북 준비됨(`../vision-training/`, DEPLOY.md 절차 참고). Colab 학습 → `public/models/vision/raon-mascot-classifier.tflite` 배치만 하면 코드 변경 없이 [AI가 알아봐요] 자동 활성화.
5. **예선(9/2)·결선(9/17) 발표 준비** — 5분 발표 슬라이드(`../docs/private/submission.md`의 아웃라인·심사기준 매핑 참고), 현장 시연용 실물 카드 인쇄(`docs/cards-print.pdf`, 바닥 대형판 `../print/poster-*.pdf`).
6. **E2E 후속 (낮은 우선순위)** — S1/S5 catch의 실패 원인 구분(진단 품질), dev 모드 three 중복 경고(`optimizeDeps.exclude`).
7. **main.js 추가 축소 후보 (v1.4.0 셸 재작성 후속)** — 현재 377줄, 애초 목표(≤150줄)는 미달(사유: `docs/superpowers/plans/2026-07-20-shell-rewrite.md` Task 10 기록 — 부트스트랩 배선 자체가 본질적으로 남는 코드). 더 줄이려면: `submitAndRetry`(설문 재시도 루프), `startDirectSurvey`(비AR 직행 설문), 키오스크 리셋 타이머를 각각 별도 모듈로 추출하는 안을 검토할 것.

## 낮은 우선순위 (동작에 지장 없음)

- 마커 모드 중 가이드 진행 시 숨겨진 오버레이 씬에 불필요한 캐릭터 로드 가능성 — 가드 추가 검토.
- "orange" 순색 머티리얼이 fbx 내장값 `#cc1b01`이라 레퍼런스보다 붉음 — 색 오버라이드 검토.
- FBX "more than 4 skinning weights" 콘솔 경고 — 렌더링 영향 없음.
- fbx → glb 변환·Draco 압축 (Blender 또는 fbx2gltf 필요) — ADR 0001 §3 참고, FBX 직접 로드가 사실상 최종 방식으로 굳어졌으나 용량·로딩 속도 개선 여지로 후속 과제 유지.
- 파티클 풀(`src/effects.js` `POOL_SIZE=32`) 동시 다발 burst 시 라운드로빈으로 조기 재활용됨 — 실기기에서 화면이 붐빌 때 체감 확인 필요.
- 동일 기기 반복 제출·폼 entry 공개로 인한 어뷰징 — 설계 단계에서 감수하기로 한 리스크(design.md 12장), 서버리스 구조상 별도 조치 없이 계속 감수.
- `npm run dev`에서 마커/캐릭터 로드 시 "Multiple instances of Three.js" 콘솔 경고 재현(실측 확인, v1.4.0) — `mind-ar`·`three/addons/loaders/FBXLoader.js`가 esbuild optimizeDeps에서 별도 프리번들 사본으로 분리되는 게 원인. `vite.config.js`의 `resolve.dedupe: ['three']`로는 해소 안 됨(프로덕션 빌드+`vite preview`는 애초 무경고라 배포·E2E에는 영향 없음). 근본 해결은 `optimizeDeps.exclude: ['three']` 추가 검토 — 로컬 개발 콘솔 노이즈 제거 목적으로만 낮은 우선순위.
- 셸 재작성 태스크별 리뷰에서 나온 잔여 Minor 트리아지 — `.superpowers/sdd/progress.md`에 태스크별로 기록됨(예: S1 catch 원인 무구분, size-chip `:last-child` 셀렉터 취약, `overlay.js`의 Scene에 `stop()` 미구현 — `NullScene` no-op으로 안전하게 흡수되어 있어 기능상 문제는 없음). 필요 시 검토.
