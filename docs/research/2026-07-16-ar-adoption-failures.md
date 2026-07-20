# 리서치: AR이 확산되지 못하고 외면받아온 원인 — 우리 앱 보완점 매핑

> 2026-07-16, 웹 리서치 종합 (출처 URL 포함). 발표 스토리 소재 겸 설계 근거 문서.

## 1. 외면 원인 종합

| # | 원인 | 요지 | 출처 |
|---|---|---|---|
| ① | 앱 설치 장벽 | QR→앱스토어 전환 순간 관심 고객의 15~20%만 완주. WebAR은 이 단계를 제거 | [Blippar](https://www.blippar.com/no-app-required-why-web-based-ar-is-now-the-default-choice-for-brand-campaigns/) |
| ② | 기믹 소진(novelty effect) | 포켓몬고 DAU 4,500만→500만(5개월). 신기함만으로 유지 불가 | [Wikipedia](https://en.wikipedia.org/wiki/Novelty_effect), [Skyword](https://www.skyword.com/contentstandard/creativity/from-gimmick-to-game-changer-the-evolution-of-augmented-reality-marketing/) |
| ③ | 가치 부재 | 브랜드 노출용 일회성 AR은 실패, 지속 가치를 주는 AR(Sephora)만 생존 | [Marketing Dive](https://www.marketingdive.com/news/what-brands-are-getting-wrong-about-ar/557608/) |
| ④ | 기술 마찰 | 발열·배터리·저조도 지터. WebAR은 메모리·네트워크 제약 추가 | [ARCore Docs](https://developers.google.com/ar/develop/performance) |
| ⑤ | 하드웨어 종속 | Project Tango — 특수 센서 요구로 3년간 기기 2종, 종료. ARCore는 일반 카메라로 1억 대 | [Failory](https://www.failory.com/google/tango) |
| ⑥ | UX 발견성 부족 | NN Group: AR 기능을 찾는 법·쓰는 법 안내 부재가 반복 지적 | [Experientia](https://blog.experientia.com/nielsen-norman-group-on-the-usability-of-ar/) |
| ⑦ | "AR보다 콘텐츠" | 나이언틱 후속작 연쇄 부진 — 포켓몬고의 성공은 AR이 아니라 캐릭터 매력 | [시사저널e](https://www.sisajournal-e.com/news/articleView.html?idxno=202661) |
| ⑧ | 참여 대비 보상 설계 실패 | 난이도 높은 이벤트에 낮은 보상 → 참여 유인 없음 | [위픽레터](https://wepick.kr/editor/4341868/) |
| ⑨ | 사회적 어색함 (정황) | 공공장소에서 폰 들고 서 있는 부담 — 구글 글래스류 저항과 동류 (출처 약함) | [TNW](https://thenextweb.com/news/3-reasons-augmented-reality-hasnt-achieved-widespread-adoption) |

## 2. 우리 앱이 이미 회피한 것

- ① 무설치 QR→브라우저 즉시 실행 / ⑤ 표준 WebXR+자이로, 특수 장비 불요 / ④(부분) 카드 마커 기준점 + 접지 그림자 / ⑦ 범용 필터가 아닌 고유 마스코트 3종 / ③(부분) 설문→구글폼으로 "남는 것" 연결 / ⑨ 등신대·매직미러 모드(E팩)가 정확히 이 어색함을 해소.

## 3. 추가 보완 제안 (우선순위)

1. [낮음/높음] **온보딩 1장** — 카메라 허용→바닥 비추기→캐릭터 등장 3스텝 아이콘. 쓰다듬기 같은 히든 제스처도 안내 없으면 안 쓰임 (⑥ 대응)
2. [낮음/높음] **트래킹 실패 시 명확한 안내** — 침묵 대신 "카드 마커로 전환할까요?" (⑥·④ 대응)
3. [중간/높음] **세션 발열·배터리 관리** — 체험 루프 60~90초 유지, 종료 시 카메라 스트림 즉시 해제 (④ 대응)
4. [낮음/중간] **한정성 문구** — "이 부스에서만 만날 수 있어요" — 일회성 필터가 아닌 프레이밍 (③ 대응)
5. [중간/중간] 등신대·매직미러 우선순위 상향 — E팩으로 이미 반영됨 (⑨ 대응)
6. [낮음/중간] **오프라인 자산 캐시** — 행사장 네트워크 대비 3D 모델 사전 캐싱 (④ 대응)
7. [높음/낮음 — 스코프 밖] AR 클라우드형 영속 콘텐츠 → 대신 "행사별 테마 교체"(config)로 대체

## 4. 발표(5분) 스토리 3포인트

1. **"AR이 망한 건 기술이 아니라 문 앞에서 다 도망갔기 때문"** — 앱스토어 전환 15~20% 데이터 → 우리는 문을 없앰 (QR=체험)
2. **"포켓몬고는 AR이 아니라 포켓몬 때문에 떴다"** — 나이언틱 후속작 부진 → 우리는 고유 마스코트 3종을 세움
3. **"신기함은 5개월을 못 버틴다"** — novelty effect → 처음부터 일회성 필터가 아닌 행사 재사용 킷으로 설계 (테마 교체·설문 연동·등신대 로드맵)

> 검증 메모: 국내 AR 이탈 정량 데이터와 "사회적 어색함" 직접 연구는 미확인 — 정황 증거로만 사용할 것.
