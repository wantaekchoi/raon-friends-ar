# raon-friends-ar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘 안에 `https://wantaekchoi.github.io/raon-friends-ar/` 접속 시 시작 화면 → 카메라 배경 위 라옹(3D)이 등장해 말풍선 안내까지 동작하는 MVP를 배포한다.

**Architecture:** Vite 정적 앱(백엔드 없음). 화면 전환은 순수 JS 상태머신(flow.js), AR은 getUserMedia 카메라 영상 배경 + 투명 three.js 캔버스 오버레이. 3D는 fbx를 FBXLoader로 브라우저에서 직접 로드(오늘은 변환 도구가 없으므로), 로드 실패 시 임시 캐릭터 폴백. main push 시 GitHub Actions가 빌드해 Pages로 자동 배포.

**Tech Stack:** Vite 6 · three.js(FBXLoader 포함) · Vitest · GitHub Actions + GitHub Pages

## Global Constraints

- 로컬 환경: macOS arm64, Node v20.20.2, npm 11.12.1. **Blender·gh CLI·FBX2glTF·assimp 없음** → fbx→glb 변환은 이 계획 범위 밖 (후속 계획에서 처리).
- 작업 디렉토리: 저장소는 `/Users/wantaek/Desktop/raon-friends-ar` 에 클론. 원본 자산은 `/Users/wantaek/Desktop/20231127_산출물` (읽기만, 수정 금지).
- `vite.config.js`에 `base: '/raon-friends-ar/'` 필수 (Pages 하위 경로 — 누락 시 배포 후 빈 화면).
- 자산 파일명은 전부 ASCII로 복사(예: `라옹리깅O.fbx` → `raong.fbx`) — URL 인코딩 사고 방지.
- 카메라·오디오는 반드시 사용자 탭(버튼) 이후 시작 (iOS Safari 정책).
- 커밋 메시지는 conventional commit (`feat:`, `chore:`, `test:` …), 본문 한국어 허용.
- 설계서: `/Users/wantaek/Desktop/20231127_산출물/라온_프렌즈_AR_안내데스크_설계서.md` (Task 1에서 repo `docs/design.md`로 복사).
- MVP 범위 밖 (후속 계획): 3캐릭터 배턴터치, 카드 마커 모드(MindAR), 설문+구글폼 연동, glb 최적화, 경진대회 산출물 문서. S1의 [카드로 소환하기] 버튼은 "준비 중" 비활성으로만 둔다.

---

### Task 1: 저장소 클론 + Vite 뼈대 + 문서 이동

**Files:**
- Create: `/Users/wantaek/Desktop/raon-friends-ar/` (클론), `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/style.css`, `.gitignore`, `docs/design.md`(복사), `docs/plans/2026-07-16-raon-friends-ar-mvp.md`(이 문서 복사)

**Interfaces:**
- Produces: 이후 모든 태스크의 작업 루트 `/Users/wantaek/Desktop/raon-friends-ar`, npm 스크립트 `dev`/`build`/`preview`/`test`

- [ ] **Step 1: 클론**

```bash
git clone https://github.com/wantaekchoi/raon-friends-ar.git /Users/wantaek/Desktop/raon-friends-ar
cd /Users/wantaek/Desktop/raon-friends-ar
```

빈 저장소 경고(`warning: You appear to have cloned an empty repository`)는 정상. 기본 브랜치가 없으면 `git checkout -b main`.

- [ ] **Step 2: package.json 작성**

```json
{
  "name": "raon-friends-ar",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: vite.config.js / .gitignore 작성**

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/raon-friends-ar/',
});
```

```
# .gitignore
node_modules/
dist/
.DS_Store
```

- [ ] **Step 4: 최소 index.html / src 작성**

```html
<!-- index.html -->
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>라온 프렌즈 AR 안내데스크</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

```js
// src/main.js
import './style.css';

document.querySelector('#app').textContent = '라온 프렌즈 AR 안내데스크 — 준비 중';
```

```css
/* src/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; }
```

- [ ] **Step 5: 문서 복사**

```bash
mkdir -p docs/plans
cp "/Users/wantaek/Desktop/20231127_산출물/라온_프렌즈_AR_안내데스크_설계서.md" docs/design.md
cp "/Users/wantaek/Desktop/20231127_산출물/docs/plans/2026-07-16-raon-friends-ar-mvp.md" docs/plans/
```

- [ ] **Step 6: 설치·빌드 검증**

```bash
npm install
npm run build
```

Expected: `dist/` 생성, 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: Vite 프로젝트 뼈대 + 설계서/계획서 추가"
```

---

### Task 2: GitHub Actions → Pages 배포 파이프라인

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Task 1의 npm 스크립트 (`npm ci && npm test && npm run build` → `dist/`)
- Produces: main push 시 자동 배포되는 프로덕션 URL `https://wantaekchoi.github.io/raon-friends-ar/`

- [ ] **Step 1: 워크플로 작성**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test --if-present
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 커밋 + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages 자동 배포 워크플로"
git push -u origin main
```

push 인증 실패 시 사용자에게 요청 (`! git push -u origin main`).

- [ ] **Step 3: 사용자 수동 1회 — Pages 활성화**

gh CLI가 없으므로 사용자가 브라우저에서: **repo Settings → Pages → Build and deployment → Source: "GitHub Actions"** 선택. (이걸 하기 전엔 deploy job이 실패할 수 있음 — 활성화 후 Actions 탭에서 Re-run.)

- [ ] **Step 4: 배포 검증**

```bash
sleep 90 && curl -s -o /dev/null -w "%{http_code}" https://wantaekchoi.github.io/raon-friends-ar/
```

Expected: `200` (404면 Actions 탭 로그 확인 → base 경로/Pages 소스 설정 순서로 의심).

---

### Task 3: 화면 흐름 상태머신 (TDD)

**Files:**
- Create: `src/flow.js`, `test/flow.test.js`

**Interfaces:**
- Produces: `SCREENS` 상수(`{START:'start', GUIDE:'guide', SURVEY:'survey', DONE:'done'}`), `createFlow(guideScript: {speaker,text}[])` → `{ screen, step, line, start(), next(), finishSurvey(), reset() }`. Task 4·6이 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// test/flow.test.js
import { describe, it, expect } from 'vitest';
import { createFlow, SCREENS } from '../src/flow.js';

const script = [
  { speaker: 'raong', text: '안녕' },
  { speaker: 'raong', text: '환영' },
];

describe('createFlow', () => {
  it('시작 상태는 START', () => {
    expect(createFlow(script).screen).toBe(SCREENS.START);
  });

  it('start()로 GUIDE 진입, 첫 멘트 노출', () => {
    const f = createFlow(script);
    f.start();
    expect(f.screen).toBe(SCREENS.GUIDE);
    expect(f.line).toEqual(script[0]);
  });

  it('next()로 멘트 진행, 마지막 멘트 이후 SURVEY', () => {
    const f = createFlow(script);
    f.start();
    f.next();
    expect(f.line).toEqual(script[1]);
    f.next();
    expect(f.screen).toBe(SCREENS.SURVEY);
    expect(f.line).toBeNull();
  });

  it('GUIDE가 아닐 때 next()는 무시', () => {
    const f = createFlow(script);
    f.next();
    expect(f.screen).toBe(SCREENS.START);
  });

  it('finishSurvey() → DONE, reset() → START', () => {
    const f = createFlow(script);
    f.start(); f.next(); f.next();
    f.finishSurvey();
    expect(f.screen).toBe(SCREENS.DONE);
    f.reset();
    expect(f.screen).toBe(SCREENS.START);
    expect(f.step).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to load ../src/flow.js`

- [ ] **Step 3: 구현**

```js
// src/flow.js
export const SCREENS = {
  START: 'start',
  GUIDE: 'guide',
  SURVEY: 'survey',
  DONE: 'done',
};

export function createFlow(guideScript) {
  let screen = SCREENS.START;
  let step = 0;

  return {
    get screen() { return screen; },
    get step() { return step; },
    get line() { return screen === SCREENS.GUIDE ? guideScript[step] : null; },
    start() { screen = SCREENS.GUIDE; step = 0; },
    next() {
      if (screen !== SCREENS.GUIDE) return;
      if (step < guideScript.length - 1) step += 1;
      else screen = SCREENS.SURVEY;
    },
    finishSurvey() { if (screen === SCREENS.SURVEY) screen = SCREENS.DONE; },
    reset() { screen = SCREENS.START; step = 0; },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/flow.js test/flow.test.js
git commit -m "feat: 화면 흐름 상태머신 (START→GUIDE→SURVEY→DONE)"
```

---

### Task 4: config + S1 시작 화면

**Files:**
- Create: `src/config.js`, `public/img/raong.png`, `public/img/raoni.png`, `public/img/raona.png`
- Modify: `index.html`, `src/main.js`, `src/style.css`

**Interfaces:**
- Consumes: `createFlow`/`SCREENS` (Task 3)
- Produces: `CONFIG` (`{ title, guideScript, characters }`), DOM 구조 — `#screen-start`(내부 `#btn-overlay`, `#btn-marker`), `#screen-ar`(내부 `#camera-video`, `#three-canvas`, `#bubble`, `#btn-next`). `data-screen` 속성으로 화면 표시 전환. Task 5·6이 소비.

- [ ] **Step 1: 캐릭터 이미지 리사이즈 복사 (macOS sips 사용)**

```bash
mkdir -p public/img
sips -Z 512 --out public/img/raong.png "/Users/wantaek/Desktop/20231127_산출물/랜더이미지/라옹주사기_front_.png"
sips -Z 512 --out public/img/raoni.png "/Users/wantaek/Desktop/20231127_산출물/랜더이미지/라오니_front.png"
sips -Z 512 --out public/img/raona.png "/Users/wantaek/Desktop/20231127_산출물/랜더이미지/라오나헤어3_F.png"
ls -la public/img
```

Expected: 3개 png, 각 200KB 미만.

- [ ] **Step 2: config.js 작성**

```js
// src/config.js
export const CONFIG = {
  title: '라온 프렌즈 AR 안내데스크',
  guideScript: [
    { speaker: 'raong', text: '안녕하세요! 라온 프렌즈의 라옹이에요 🐯' },
    { speaker: 'raong', text: 'FunFun AI경진대회에 오신 걸 환영해요!' },
    { speaker: 'raong', text: '이 서비스는 AI(Claude Code)와 함께 만든 웹 AR 안내데스크예요.' },
    { speaker: 'raong', text: '앱 설치 없이 브라우저에서 바로 동작한답니다.' },
    { speaker: 'raong', text: '다음엔 잠깐 설문에 참여해주시면 큰 힘이 돼요!' },
  ],
  characters: {
    raong: { name: '라옹', img: 'img/raong.png' },
    raoni: { name: '라오니', img: 'img/raoni.png' },
    raona: { name: '라오나', img: 'img/raona.png' },
  },
};
```

(멘트 speaker는 MVP에선 전부 raong — 배턴터치는 후속 계획에서 speaker 전환으로 구현.)

- [ ] **Step 3: index.html에 화면 마크업 작성**

```html
<!-- index.html의 <body> 교체 -->
<body data-screen="start">
  <section id="screen-start">
    <h1 id="start-title"></h1>
    <div id="start-chars"></div>
    <button id="btn-overlay">라온 프렌즈 만나러 가기</button>
    <button id="btn-marker" disabled>카드로 소환하기 (준비 중)</button>
    <p class="hint">카메라 권한이 필요해요</p>
  </section>

  <section id="screen-ar">
    <video id="camera-video" autoplay muted playsinline></video>
    <canvas id="three-canvas"></canvas>
    <div id="bubble" hidden><span id="bubble-name"></span><p id="bubble-text"></p></div>
    <button id="btn-next" hidden>다음 ▶</button>
  </section>

  <script type="module" src="/src/main.js"></script>
</body>
```

- [ ] **Step 4: style.css에 화면 전환·시작 화면 스타일 작성**

```css
/* src/style.css 에 추가 */
section { display: none; }
body[data-screen="start"] #screen-start { display: flex; }
body[data-screen="guide"] #screen-ar,
body[data-screen="survey"] #screen-ar,
body[data-screen="done"] #screen-ar { display: block; }

#screen-start {
  height: 100dvh; flex-direction: column; justify-content: center; align-items: center;
  gap: 20px; text-align: center; padding: 24px;
  background: linear-gradient(160deg, #fff7ef 0%, #ffe3c7 60%, #ffd0a0 100%);
}
#start-title { font-size: 1.6rem; color: #e8590c; }
#start-chars { display: flex; gap: 8px; }
#start-chars img { width: 96px; height: 96px; object-fit: contain; }
#btn-overlay, #btn-marker {
  padding: 14px 28px; border: none; border-radius: 28px; font-size: 1rem;
  background: #ff7a1a; color: #fff;
}
#btn-marker { background: #d0d0d0; color: #777; }
.hint { font-size: 0.8rem; color: #a0764f; }

#screen-ar { position: fixed; inset: 0; }
#camera-video, #three-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
#camera-video { object-fit: cover; }
body.no-camera #camera-video { display: none; }
body.no-camera #screen-ar { background: linear-gradient(180deg, #2b1a3a, #6b3f8f); }
```

- [ ] **Step 5: main.js에서 시작 화면 렌더 + flow 연결**

```js
// src/main.js 전체 교체
import './style.css';
import { CONFIG } from './config.js';
import { createFlow, SCREENS } from './flow.js';

const flow = createFlow(CONFIG.guideScript);

document.getElementById('start-title').textContent = CONFIG.title;
document.getElementById('start-chars').innerHTML = Object.values(CONFIG.characters)
  .map((c) => `<img src="${import.meta.env.BASE_URL}${c.img}" alt="${c.name}">`)
  .join('');

function syncScreen() {
  document.body.dataset.screen = flow.screen;
}

document.getElementById('btn-overlay').addEventListener('click', () => {
  flow.start();
  syncScreen();
});

syncScreen();
```

- [ ] **Step 6: 수동 검증**

Run: `npm run dev` → 브라우저에서 `http://localhost:5173/raon-friends-ar/`
Expected: 타이틀 + 캐릭터 3종 이미지 + 버튼. [라온 프렌즈 만나러 가기] 탭 시 검은 AR 화면으로 전환(아직 빈 화면 정상). `npm test` 여전히 PASS.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 시작 화면(S1) + config + 화면 전환"
```

---

### Task 5: 오버레이 씬 — 카메라 배경 + three.js + 임시 캐릭터

**Files:**
- Create: `src/scenes/overlay.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: Task 4의 DOM(`#camera-video`, `#three-canvas`)
- Produces: `initOverlay({ videoEl, canvasEl })` → `Promise<{ setCharacter(obj3d), playEntrance() }>` — 카메라 시작(거부 시 `document.body.classList.add('no-camera')`), three 씬 구성, 임시 캐릭터 기본 장착, 대기 모션 루프 상시 동작. Task 7이 `setCharacter`를 소비.

- [ ] **Step 1: overlay.js 구현**

```js
// src/scenes/overlay.js
import * as THREE from 'three';

async function startCamera(videoEl) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return true;
  } catch {
    document.body.classList.add('no-camera');
    return false;
  }
}

export function createPlaceholderCharacter() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.45, 8, 16), white);
  body.position.y = 0.55;
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), white);
  earL.position.set(-0.22, 1.05, 0);
  const earR = earL.clone();
  earR.position.x = 0.22;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), orange);
  belly.position.set(0, 0.45, 0.3);

  g.add(body, earL, earR, belly);
  return g;
}

export async function initOverlay({ videoEl, canvasEl }) {
  await startCamera(videoEl);

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.1, 2.4);
  camera.lookAt(0, 0.7, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  let character = createPlaceholderCharacter();
  scene.add(character);

  let entranceT = null; // 등장 애니메이션 진행 시각(ms)
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (entranceT !== null) {
      const p = Math.min((performance.now() - entranceT) / 700, 1);
      const bounce = 1 - Math.pow(1 - p, 3); // ease-out
      character.scale.setScalar(bounce);
      character.position.y = (1 - bounce) * 1.5;
      if (p >= 1) entranceT = null;
    } else {
      character.position.y = Math.sin(t * 2.2) * 0.04;       // 숨쉬기
      character.rotation.y = Math.sin(t * 0.9) * 0.18;       // 좌우 흔들기
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    setCharacter(obj3d) {
      scene.remove(character);
      character = obj3d;
      scene.add(character);
    },
    playEntrance() {
      character.scale.setScalar(0);
      entranceT = performance.now();
    },
  };
}
```

- [ ] **Step 2: main.js 연결**

```js
// src/main.js — btn-overlay 리스너를 아래로 교체
import { initOverlay } from './scenes/overlay.js';

let overlay = null;

document.getElementById('btn-overlay').addEventListener('click', async () => {
  flow.start();
  syncScreen();
  overlay = await initOverlay({
    videoEl: document.getElementById('camera-video'),
    canvasEl: document.getElementById('three-canvas'),
  });
  overlay.playEntrance();
});
```

- [ ] **Step 3: 수동 검증**

Run: `npm run dev` → 버튼 탭 → 카메라 권한 허용
Expected: 카메라 영상 위에 흰 캡슐 캐릭터가 튀며 등장, 숨쉬기·흔들기 모션. 권한 거부 시 보라 그라데이션 배경 위 동일 동작. `npm test` PASS 유지.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: 오버레이 AR 씬 (카메라 배경 + 임시 캐릭터 + 모션)"
```

---

### Task 6: 말풍선 + 멘트 진행

**Files:**
- Create: `src/ui/bubble.js`
- Modify: `src/main.js`, `src/style.css`

**Interfaces:**
- Consumes: `flow.line`/`flow.next()`(Task 3), DOM `#bubble`/`#bubble-name`/`#bubble-text`/`#btn-next`(Task 4), `CONFIG.characters`(Task 4)
- Produces: `showLine(line)` — 말풍선에 화자 이름 + 타이핑 효과 출력

- [ ] **Step 1: bubble.js 구현**

```js
// src/ui/bubble.js
import { CONFIG } from '../config.js';

let timer = null;

export function showLine(line) {
  const bubble = document.getElementById('bubble');
  const name = document.getElementById('bubble-name');
  const text = document.getElementById('bubble-text');

  bubble.hidden = false;
  name.textContent = CONFIG.characters[line.speaker].name;

  clearInterval(timer);
  let i = 0;
  text.textContent = '';
  timer = setInterval(() => {
    text.textContent = line.text.slice(0, ++i);
    if (i >= line.text.length) clearInterval(timer);
  }, 35);
}
```

- [ ] **Step 2: 스타일 추가**

```css
/* src/style.css 에 추가 */
#bubble {
  position: absolute; top: max(24px, env(safe-area-inset-top)); left: 16px; right: 16px;
  background: rgba(255, 255, 255, 0.94); border-radius: 16px; padding: 14px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
#bubble-name { font-weight: 700; color: #e8590c; font-size: 0.85rem; }
#bubble-text { margin-top: 4px; font-size: 1rem; line-height: 1.5; min-height: 3em; }
#btn-next {
  position: absolute; bottom: max(28px, env(safe-area-inset-bottom)); left: 50%;
  transform: translateX(-50%);
  padding: 12px 32px; border: none; border-radius: 24px;
  background: #ff7a1a; color: #fff; font-size: 1rem;
}
```

- [ ] **Step 3: main.js 연결**

```js
// src/main.js — 추가/수정
import { showLine } from './ui/bubble.js';

function renderGuide() {
  if (flow.screen !== SCREENS.GUIDE) return;
  showLine(flow.line);
  document.getElementById('btn-next').hidden = false;
}

// btn-overlay 리스너 끝에 추가:
//   renderGuide();

document.getElementById('btn-next').addEventListener('click', () => {
  flow.next();
  syncScreen();
  if (flow.screen === SCREENS.GUIDE) {
    renderGuide();
  } else {
    // MVP: 설문은 후속 — 마지막 멘트 후 감사 문구로 마무리
    showLine({ speaker: 'raong', text: '오늘은 여기까지! 설문은 곧 열릴 예정이에요. 감사합니다 💛' });
    document.getElementById('btn-next').hidden = true;
  }
});
```

(주의: `body[data-screen="survey"]`에서도 `#screen-ar`이 보이도록 Task 4 CSS가 이미 처리.)

- [ ] **Step 4: 수동 검증**

Run: `npm run dev`
Expected: 캐릭터 등장 후 말풍선에 "안녕하세요! 라온 프렌즈의 라옹이에요 🐯" 타이핑 효과. [다음]으로 5개 멘트 진행 → 마지막에 감사 문구 + 버튼 숨김. `npm test` PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 말풍선 안내 멘트 진행 (타이핑 효과)"
```

---

### Task 7: 라옹 FBX 실모델 로드 (실패 시 임시 캐릭터 유지)

**Files:**
- Create: `src/characters.js`, `public/models/raong.fbx`, `public/models/raong_face.jpg`, `public/models/raong_syringe.jpg`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `initOverlay` 반환값의 `setCharacter`/`playEntrance` (Task 5)
- Produces: `loadRaong()` → `Promise<THREE.Group|null>` (실패 시 null — 호출부는 null이면 아무것도 하지 않고 임시 캐릭터 유지)

- [ ] **Step 1: 자산 복사 (ASCII 이름으로)**

```bash
mkdir -p public/models
cp "/Users/wantaek/Desktop/20231127_산출물/리깅적용/라옹리깅O.fbx" public/models/raong.fbx
cp "/Users/wantaek/Desktop/20231127_산출물/포즈/raong_face_tail_texture-01-01.jpg" public/models/raong_face.jpg
cp "/Users/wantaek/Desktop/20231127_산출물/포즈/Cylinder_Texture-01-01.jpg" public/models/raong_syringe.jpg
```

- [ ] **Step 2: characters.js 구현**

```js
// src/characters.js
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const BASE = import.meta.env.BASE_URL;

export async function loadRaong() {
  try {
    const fbx = await new FBXLoader().loadAsync(`${BASE}models/raong.fbx`);

    const texLoader = new THREE.TextureLoader();
    const faceTex = texLoader.load(`${BASE}models/raong_face.jpg`);
    const syringeTex = texLoader.load(`${BASE}models/raong_syringe.jpg`);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    syringeTex.colorSpace = THREE.SRGBColorSpace;

    fbx.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        // fbx에 텍스처 연결이 없을 수 있어 이름 기반으로 수동 매핑
        if (!m.map) m.map = /cylinder|syringe/i.test(`${m.name} ${child.name}`) ? syringeTex : faceTex;
        m.needsUpdate = true;
      });
      // 개발 확인용: 메시/머티리얼 이름 로그 (매핑이 틀리면 이 로그로 규칙 수정)
      console.debug('[raong]', child.name, mats.map((m) => m.name));
    });

    // 크기 정규화: 캐릭터 높이를 1.2 유닛으로
    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.2 / size.y;
    fbx.scale.setScalar(scale);
    box.setFromObject(fbx);
    fbx.position.y -= box.min.y; // 발바닥을 y=0에

    const group = new THREE.Group();
    group.add(fbx);
    return group;
  } catch (e) {
    console.warn('라옹 fbx 로드 실패 — 임시 캐릭터 유지', e);
    return null;
  }
}
```

- [ ] **Step 3: main.js 연결**

```js
// src/main.js — btn-overlay 리스너에서 initOverlay 이후를 아래처럼 변경
import { loadRaong } from './characters.js';

// ...
  overlay = await initOverlay({ ... });
  const raong = await loadRaong();
  if (raong) overlay.setCharacter(raong);
  overlay.playEntrance();
  renderGuide();
```

- [ ] **Step 4: 수동 검증 (외형 검수)**

Run: `npm run dev` → 데스크톱 브라우저 + 콘솔
Expected: 흰 캡슐 대신 라옹 모델 렌더. 콘솔 `[raong]` 로그로 메시·머티리얼 이름 확인 — 텍스처가 엉뚱한 곳에 입혀졌으면 Step 2의 정규식 규칙을 로그 기준으로 수정. 모델이 T포즈로 뻣뻣해도 MVP 허용(그룹 단위 바운스·흔들기 모션은 동작).

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
npm run build && npm test
git add -A
git commit -m "feat: 라옹 FBX 실모델 로드 + 텍스처 수동 매핑 (실패 시 폴백)"
```

---

### Task 8: 프로덕션 배포 검증

**Files:**
- 없음 (검증만)

**Interfaces:**
- Consumes: Task 2 파이프라인, Task 1~7 결과물

- [ ] **Step 1: push**

```bash
git push
```

- [ ] **Step 2: Actions 완료 대기 후 URL 검증**

```bash
sleep 120 && curl -s https://wantaekchoi.github.io/raon-friends-ar/ | grep -o "라온 프렌즈 AR 안내데스크" | head -1
curl -s -o /dev/null -w "%{http_code}" https://wantaekchoi.github.io/raon-friends-ar/models/raong.fbx
```

Expected: 첫 명령 `라온 프렌즈 AR 안내데스크`, 둘째 명령 `200`.

- [ ] **Step 3: 사용자 실기기 확인 요청**

사용자 폰(iOS Safari + 가능하면 Android Chrome)에서 URL 접속 → 시작 화면 → 카메라 허용 → 라옹 등장 → 멘트 진행 확인. 문제 화면은 스크린샷으로 공유 요청.

---

## 후속 계획 (이 계획 범위 밖 — 별도 plan으로)

1. 3캐릭터 배턴터치 (라오니·라오나 fbx 로드 + speaker 전환 연출)
2. fbx→glb 최적화 파이프라인 (Blender 설치 또는 fbx2gltf, Draco 압축)
3. 카드 마커 모드 (MindAR + 카드 디자인 + cards.mind)
4. 설문 UI + 구글 폼 연동 (팀 공용 계정으로 폼 생성)
5. 경진대회 산출물 (submission.md, video-storyboard.md, 카드 PDF)
