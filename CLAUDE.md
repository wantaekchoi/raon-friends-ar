# raon-friends-ar

라온 프렌즈 웹 AR 안내데스크 — FunFun AI경진대회 출품작 (접수 마감 2026-07-31).
배포: https://wantaekchoi.github.io/raon-friends-ar/ (main push → GitHub Actions → Pages 즉시 배포)

## 검증 (push 전 필수 순서)

1. `npm test` (Vitest) → 2. `npm run build` → 3. 헤드리스 스크린샷 검증(시작→AR→설문 흐름, 스크린샷을 눈으로 확인)
- `npm install`은 반드시 `--ignore-scripts` — mind-ar의 canvas 네이티브 빌드가 macOS에서 실패함 (docs/marker-setup.md)

## 품질 방침 (사용자 지정)

- **예쁘고 에러 없게 > 기능. 기능보다 귀엽게.** UI 문구는 캐릭터 말투로.
- 바뀔 수 있는 값(멘트·설문 문항·폼 ID·안내 문구)은 전부 `src/config.js` 한 곳에 — 행사 당일 즉석 수정 가능해야 함.

## 워크플로

- main push = 즉시 프로덕션 배포. **검증 없이 push 금지, main force-push 금지.**
- 문서(docs/CURRENT_STATE.md · NEXT_STEP.md · adr/)는 **코드와 같은 커밋으로 동기화** — 소스만 push하고 문서 빠뜨리지 말 것.
- 병렬 작업은 git worktree + `agent/*` 브랜치, 조율 세션이 머지→검증→push. 에이전트는 push 금지.
- 커밋 제목은 간결한 한 줄 (conventional commit, 본문 한국어 허용).

## 함정 (gotchas)

- fbx 머티리얼: vertexColors 요구하는데 정점색 데이터 없으면 **clone 후 off**, `m.map`은 있는데 `m.map.image` 없으면(깨진 임베디드) 외부 텍스처 교체, **순색 머티리얼은 건드리지 않기** (src/characters.js 규칙).
- GitHub API 익명 호출은 시간당 60회 — 배포 폴링은 사이트 URL(github.io)로 할 것.
- WebXR·카메라·자이로는 헤드리스로 검증 불가 — 실기기 체크리스트를 보고에 남기고 "검증 못 함" 명시.

## 구글 자산(폼·시트) 운영 원칙

- 폼·시트·드라이브 조작은 브라우저 자동화 대신 **서비스 계정 + 공식 API**(Sheets/Forms/Drive) 우선. 키 JSON은 repo 밖(~/.config/ 등)에 보관하고 절대 커밋하지 않는다.
- 응답 시트는 비공개 유지(익명 401), 공개는 PII 없는 `public` 집계 탭의 게시 CSV만. 폼의 "이메일 수집"은 켜지 말 것 — 켜면 로그인이 강제되어 앱의 no-cors 전송이 깨진다.
- 대사·문구처럼 데이터에 불변식이 있으면(화자-정체성 일치 등) 실제 STRINGS를 넣은 유닛 테스트로 고정한다 — 실기기 없이 검증 가능하게 설계 (2026-07-20 정체성 불변식 버그 재발 방지).
