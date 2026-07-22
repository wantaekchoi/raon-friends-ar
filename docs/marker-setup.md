# 카드 마커 모드 (MindAR) — 셋업·컴파일 절차

> 카드 이미지 3장(`public/targets/card-*.png`)과 이를 컴파일한 이미지 타깃 파일
> (`public/targets/cards.mind`)로 동작하는 "카드로 소환하기" 기능의 산출 과정 기록.
> 카드를 다시 디자인하거나 `cards.mind`를 재컴파일해야 할 때 이 문서를 따른다.

## 결과물

| 파일 | 설명 |
|---|---|
| `public/targets/card-raong.png` | 라옹 카드 (720×1000px, 주황 테마) |
| `public/targets/card-raoni.png` | 라오니 카드 (720×1000px, 인디고 테마) |
| `public/targets/card-raona.png` | 라오나 카드 (720×1000px, 틸 테마) |
| `public/targets/cards.mind` | 위 3장을 컴파일한 MindAR 이미지 타깃 (msgpack, ~1.8MB) |
| `docs/cards-print.pdf` | 3장을 A4 한 장에 배치한 인쇄용 PDF |

**타깃 인덱스 순서** (반드시 `src/scenes/marker.js`의 `TARGET_INDEX`와 일치해야 함):

```
0 = raong (라옹)
1 = raoni (라오니)
2 = raona (라오나)
```

## 1. 카드 디자인 — HTML/CSS + puppeteer 스크린샷

node-canvas(캔버스 네이티브 모듈)를 빌드하지 않고도 카드를 만들기 위해, HTML/CSS로 카드
레이아웃을 짜고 puppeteer로 스크린샷을 떴다. `public/img/{key}.png`(투명 배경, 512×512)의
캐릭터 컷을 그대로 가져다 쓴다.

**v2 리디자인(임팩트 팩, 수집 카드풍)**: v1은 두꺼운 체커보드 테두리 + 흑백 코너 마커로
"AR 마커"처럼 보였다. v2는 같은 트래킹 품질 요구사항을 유지하면서 "캐릭터 굿즈"처럼 보이도록
바꿨다.

- **라온 오렌지 그라데이션 프레임**(3장 공통, `#ffb066→#ff8a30→#e8590c`) — 캐릭터별로 테마
  색을 바꾸던 v1과 달리 프레임은 브랜드 컬러로 통일해 "카드 세트" 느낌을 준다. 캐릭터 구분은
  리본·번호(`NO. 0X/03`)의 액센트 컬러로 한다.
- **스크랩북 포토코너 스티커**(4모서리) — 흑백 기하 무늬 대신 대각선 스티치 라인 + 별 아이콘의
  둥근 삼각 스티커. 굵은 대각선 엣지 하나로 코너 특징점을 확보하면서 장식처럼 보인다.
  MindAR은 자연 특징점(FREAK) 추적이라 ArUco/AR.js식 방향 판별용 코너 마커가 필요 없다 —
  v1의 흑백 사분할 코너는 과설계였다.
- **중간 크기 폴카닷 2겹 + 대각선 종이결**(캐릭터 액센트 컬러, 지름 ~35px·108px 간격,
  불투명도 15%) — 트래킹 파이프라인의 최하위 피라미드 레벨(128×178, 원본의 약 0.18배)까지
  살아남는 게 핵심. v1은 1.6px짜리 아주 가는 도트 그리드를 썼는데, 이 정도로 미세한 패턴은
  그 레벨로 다운샘플되면 사실상 사라져(에일리어싱) **캐릭터 일러스트 내용에 따라 트래킹
  특징점 수가 들쭉날쭉했다** (구버전 실측: 라옹 tracking level0=14pt vs 라오니=73pt — 라옹의
  가늘고 흰 라인아트 워터마크가 저해상도에서 대비를 거의 남기지 않았기 때문). v2는 다운샘플
  후에도 남는 굵기의 블롭 패턴으로 교체해 캐릭터와 무관하게 균일한 밀도를 낸다.
- 리본형 이름표(폴드 날개 + 역할 뱃지) + 은은한 스포트라이트 그라데이션.

재생성 방법 (프로젝트 루트가 아니라 별도 스크래치 디렉터리에 있던 스크립트를 옮겨 써도 되고,
아래 로직을 그대로 재현해도 된다):

1. 템플릿 함수로 카드별 HTML 문자열 생성 (`public/img/{key}.png`를 base64 data URI로 임베드).
2. puppeteer로 뷰포트를 정확히 `720×1000`, `deviceScaleFactor: 1`로 설정 — 최장변이 1024px를
   넘지 않아야 한다는 제약을 업스케일 없이 그대로 만족시키기 위함.
3. `page.setContent(html)` → `page.screenshot({ path, clip: {x:0,y:0,width:720,height:1000} })`.

카드를 다시 디자인하려면 위 방식을 재현하는 새 스크립트를 작성해 `public/targets/card-*.png`를
덮어쓴 다음, **반드시 2번(재컴파일)도 다시 실행**해야 한다 (이미지가 바뀌면 타깃 데이터도 바뀐다).

### 특징점 품질 게이트 — 컴파일러 특징점 시각화

카드를 다시 디자인할 때마다 컴파일 직후 `.mind`(msgpack)를 디코드해 트래킹 특징점을
카드 이미지 위에 점으로 오버레이해 눈으로 검수한다 (`@msgpack/msgpack`으로 `dataList[i]`의
`matchingData[].maximaPoints/minimaPoints`, `trackingData[].points`를 원본 좌표계로 스케일
후 캔버스에 그린다 — node-canvas 없이 헤드리스 Chrome의 canvas 2D로 그리면 된다). 확인할 것:

- **3장 사이 편차가 크지 않은지** (한 캐릭터만 유난히 적으면 그 카드가 실전에서 인식이
  불안정하다 — v1의 라옹이 이 케이스였다).
- **점이 카드 전역에 고르게 퍼져 있는지** (한쪽에 몰려 있으면 각도·부분 가림에 약하다).
- 미달이면 배경 패턴 밀도(폴카닷 지름·간격, 종이결 스트라이프 폭)를 조정해 재컴파일 반복.

## 2. `.mind` 컴파일 — 실제로 동작한 방법

### 조사한 후보와 결론

- **(a) mind-ar npm 패키지의 Compiler를 Node에서 직접 실행** → 불가. `Compiler` 클래스는
  `document.createElement('canvas')`와 `getImageData`, Web Worker(내부에 tfjs 커널 inline)를
  써서 브라우저 전용이다. Node의 `canvas` 패키지로 이를 흉내 낼 수도 있지만, 이 개발 환경(macOS,
  Homebrew)에서 `canvas`의 네이티브 바인딩 빌드가 `pkg-config`/`pangocairo` 부재로 실패했다
  (아래 "canvas 네이티브 빌드 이슈" 참고). 애초에 mind-ar의 브라우저 번들 자체가 canvas를
  import하지 않으므로 이 경로는 필요 없다는 걸 확인했다.
- **(b) 공식 웹 컴파일러(hiukim.github.io/mind-ar-js-doc/tools/compile)를 puppeteer로 자동화**
  → 페이지 자체가 Docusaurus 위에 얹힌 클라이언트 렌더링 위젯이라 DOM 셀렉터가 불안정하고,
  외부 CDN(jsdelivr) 의존이라 오프라인 재현성이 떨어진다.
- **(c) 채택: mind-ar npm 패키지(1.2.5)가 배포하는 `dist/mindar-image.prod.js`(ESM, `Compiler`
  export)를 헤드리스 Chrome 안에서 직접 `import`해서 실행.** npm 패키지를 그대로 쓰므로
  버전이 앱 런타임(`mind-ar/dist/mindar-image-three.prod.js`, 같은 1.2.5)과 완전히 일치해
  `.mind` 포맷 버전(`CURRENT_VERSION`) 불일치 걱정이 없다.

### 실행 절차 (재현 방법)

1. `npm pack mind-ar@1.2.5`로 패키지를 내려받아 압축 해제 (또는 프로젝트의
   `node_modules/mind-ar/dist/`를 그대로 사용해도 무방 — 같은 파일).
2. 그 `dist/` 디렉터리 안에 컴파일 러너 HTML을 하나 만든다 (같은 디렉터리에 둬야 상대 경로
   import `./mindar-image.prod.js` → `./controller-*.js`가 그대로 풀린다):
   ```html
   <script type="module">
     import { Compiler } from './mindar-image.prod.js';
     // 카드 3장을 <img>로 로드 (base64 data URI로 임베드하면 파일 서빙 없이 가능)
     // 순서 = [raong, raoni, raona]
     const compiler = new Compiler();
     await compiler.compileImageTargets(images, (progress) => {/* ... */});
     const buffer = compiler.exportData(); // Uint8Array (msgpack)
     // buffer를 base64로 인코딩해 전역 변수에 저장 (아래 4번에서 회수)
   </script>
   ```
3. **`file://`가 아니라 로컬 HTTP 서버로 서빙**해야 한다 — Chrome이 `type="module"` 스크립트의
   상대 경로 import를 `file://`에서 CORS 유사 정책으로 막는 경우가 있다. Node 내장 `http` 모듈로
   해당 `dist/` 디렉터리를 정적 서빙하는 임시 서버(포트 0 = 임의 빈 포트)면 충분하다.
4. puppeteer로 그 러너 HTML을 열고, `page.waitForFunction(() => window.__mindDone === true)`로
   완료를 기다린 뒤 `page.evaluate(() => window.__mindBase64)`로 결과를 회수해
   Node에서 `Buffer.from(base64, 'base64')`로 디코드, `public/targets/cards.mind`에 저장한다.
   - Compiler의 `exportData()`는 브라우저의 `Uint8Array`를 반환한다. puppeteer로 큰 바이너리를
     그대로 회수하면 JSON 직렬화 비용이 크므로, 브라우저 안에서 청크 단위로
     `String.fromCharCode` → `btoa`로 base64 인코딩해 문자열로 넘기는 편이 안전하다
     (배열 그대로 넘기면 `String.fromCharCode(...bigArray)`에서 콜스택 초과 위험).
5. Worker는 mind-ar 자체 빌드 시점에 `data:application/javascript;base64,...` 블롭 URL로
   이미 인라인돼 있어(`controller-*.js` 안에 `atob(...)` + `new Blob(...)` + `new Worker(...)`
   패턴 확인됨) 별도 워커 파일을 서빙할 필요가 없다.

컴파일 결과 검증(`@msgpack/msgpack`으로 디코드):
```
version: 2
targets count: 3
  [0] 720x1000  raong
  [1] 720x1000  raoni
  [2] 720x1000  raona
```

### canvas 네이티브 빌드 이슈 (참고)

`mind-ar` npm 패키지는 `dependencies`에 `canvas`(node-canvas)를 갖고 있는데, 이 저장소의
`npm install`이 canvas의 네이티브 애드온을 빌드하려다 `pkg-config`/`pangocairo` 부재로
실패할 수 있다. **`mind-ar/dist/mindar-image-three.prod.js`(앱이 실제로 쓰는 파일)와
`dist/mindar-image.prod.js`(컴파일에 쓴 파일) 어느 쪽도 canvas를 import하지 않으므로
런타임에는 전혀 필요 없다.** 이 경우 `npm install --ignore-scripts`로 네이티브 빌드 스텝을
건너뛰면 된다 (canvas의 postinstall만 건너뛸 뿐, 우리가 쓰는 두 dist 파일은 순수 ESM +
tfjs/Web Worker라 정상 동작). GitHub Actions(ubuntu-latest)의 `npm ci`는 canvas의 리눅스
prebuilt 바이너리를 받을 수 있어 대체로 문제없이 지나가지만, 혹시 CI에서도 같은 오류가 나면
워크플로에 `--ignore-scripts`를 추가하면 된다.

## 3. three.js `sRGBEncoding` 호환 shim

`mind-ar/dist/mindar-image-three.prod.js`는 three r152에서 제거된 `sRGBEncoding` 상수를
`import { sRGBEncoding } from "three"`로 가져오려 한다. 이 프로젝트의 three는 0.170이라
그 이름의 export가 없어 그대로 두면 번들링 단계에서
`"sRGBEncoding" is not exported by "three"` 에러로 빌드가 깨진다.

해결: `src/lib/three-compat.js`가 실제 three 전체를 재수출하면서 누락된 상수만 보강하고,
`vite.config.js`의 `resolve.alias`가 정규식 `/^three$/`로 "three" 베어 스펙파이어만 정확히
이 shim으로 우회시킨다 (`three/addons/*` 서브패스는 건드리지 않음). shim이 실제 three 파일을
상대 경로로 직접 참조하는 이유는, 베어 스펙파이어 `'three'`로 재수출하면 alias가 shim 자기
자신에게 다시 걸려 무한 루프가 되기 때문이다.

## 4. 카드 재인쇄

`docs/cards-print.pdf`는 카드 3장을 A4 한 장에 원본 해상도(720×1000px, 확대·축소 없이)로
배치한 인쇄용 PDF다. 코팅/무광 용지 인쇄를 권장한다(조명 반사가 트래킹을 방해할 수 있음).
카드가 접히거나 구겨지면 인식률이 떨어지니 평평하게 보관·거치할 것.

## 5. 바닥 포스터 ArUco 마커 (2026-07-22)

대형(A3+) 확대 인쇄한 바닥 포스터는 NFT(Natural Feature Tracking, 자연 특징점 추적 — 그림 자체의 특징점을 지문처럼 등록해 인식하는 MindAR 방식, .mind) 인식이 구조적으로 실패한다 — 세 카드가 같은
템플릿이라 서서 비스듬히 보면 특징점이 다른 카드 타겟에 교차 매칭된다(계측). 그래서 바닥
포스터(`docs/print/floor-card-*.svg`)는 **모서리 ArUco 마커 4점(fiducial)**으로 인식한다.

- 주입: `node scripts/inject-poster-markers.mjs` (멱등 — 재실행 시 기존 마커 교체)
- ID 규약·마커 크기·여백의 단일 소스: `src/scenes/poster-detect.js`
  (라옹 10~13 · 라오니 20~23 · 라오나 30~33, corner = id%10, 사전 ARUCO_MIP_36h12)
- 검출·포즈: `src/scenes/poster-watch.js`(진입 감시·NFT veto) + `src/scenes/poster.js`
  (전 마커 꼭짓점 호모그래피 → 6DoF — 마커별 POSIT는 평면 2중 해 모호성이 있어 쓰지 않는다)
- **포스터 SVG를 다시 만들면 반드시 주입 스크립트를 재실행**할 것 — 마커 없는 포스터는
  포스터 모드가 켜지지 않는다(E2E S13이 그 상태를 음성통제로 검증).

## 6. 알려진 제약 / TODO

- `src/scenes/marker.js`는 `characters.js`의 `loadCharacter(key)`로 라옹·라오니·라오나 3장
  모두에 실제 FBX 모델을 붙인다 (`maxTrack: 3` — 여러 카드를 동시에 비추면 동시 소환). 로드
  실패 시에만 임시 캡슐 플레이스홀더로 폴백한다.
- 여러 카드가 동시에 시야에 들어와 각자 캐릭터가 등장해도, 안내 흐름(말풍선 진행) 시작은
  **먼저 인식된 카드 하나만** 기준으로 한다 (`main.js`의 `found` 플래그) — 동시 소환은 되지만
  진행 흐름은 단일 화자로 유지.
- 30초 내 인식 실패 시 폴백 버튼이 노출되지만 자동 전환은 하지 않는다(사용자가 직접 탭).
