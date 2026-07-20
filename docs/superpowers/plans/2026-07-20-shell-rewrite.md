# E2E-first 셸 재작성 Implementation Plan (v1.4.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E 시나리오 슈트로 현재 동작을 먼저 고정한 뒤, main.js(932줄)를 `src/app/` 모듈 + 부트스트랩(≤150줄)으로 재작성한다. 스펙: `docs/superpowers/specs/2026-07-20-shell-rewrite-design.md`.

**Architecture:** Phase 0에서 puppeteer-core 기반 E2E(fake 카메라)와 CI 게이트를 구축해 리팩토링 전후 동작 동일성을 증명한다. Phase 1에서 상태(store)·화면(router)·씬 계약(scenes)·안내 흐름(guide)·진입 골격(entry)을 분리하고 main.js는 배선만 남긴다. 검증된 leaf 모듈은 불변.

**Tech Stack:** Vite 5 · vanilla JS(ESM) · vitest · puppeteer-core(신규 devDep) · GitHub Actions

## Global Constraints

- `npm install`은 로컬에서 반드시 `--ignore-scripts` (CLAUDE.md — canvas 빌드 회피). CI의 `npm ci`는 그대로.
- main push = 즉시 배포. **각 태스크가 리뷰 통과하면 push** (사용자 지시 2026-07-20 — CI e2e 게이트가 매 push를 검증). force-push 금지.
- 문서는 코드와 같은 커밋에. UI 문구는 i18n(ko/en) 사전에만, 값·타이밍은 config/모듈 상수로.
- 시각·UX·대본·설문 내용 변경 금지 (스펙 Non-goals). leaf 모듈(scenes/* 내부, survey, queue, sound, motion, effects, capture, i18n, characters, solo-character) 재작성 금지.
- 각 Task 완료 조건: `npm test` 전체 그린 + (E2E 존재 시) `npm run e2e` 전체 그린.
- 커밋 메시지 한국어, 타입 프리픽스(feat/fix/test/refactor/docs/chore).

---

## Phase 0 — 검증 인프라 (현재 동작 고정)

### Task 1: E2E 하네스 + 시나리오 S0(시작 화면)

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `scripts/e2e/harness.mjs`
- Create: `scripts/e2e/scenarios/s0-start.mjs`
- Create: `scripts/e2e.mjs`

**Interfaces (Produces):**
- `withPage(fn, {params})` — preview 서버 위 새 브라우저 컨텍스트에서 `fn(page, ctx)` 실행 (언어 등 URL 상태는 전부 `params` 쿼리스트링으로). `ctx.errors`(pageerror+console.error 수집 배열), `ctx.shot(name)`(스크린샷 저장). fn 종료 후 `ctx.errors`가 비어있지 않으면 throw.
- 시나리오 모듈 계약: `export const name = '...'; export async function run() { ... }` — 실패 시 throw.
- `npm run e2e` — 빌드→preview 기동→전 시나리오 순차 실행→요약 출력, 실패 시 exit 1.

- [ ] **Step 1: 의존성·스크립트 추가**

```bash
cd /Users/wantaek/Desktop/raon-friends-ar
npm install --ignore-scripts --save-dev puppeteer-core
```

`package.json` scripts에 추가:
```json
"e2e": "node scripts/e2e.mjs"
```

- [ ] **Step 2: 하네스 작성** — `scripts/e2e/harness.mjs` 전체:

```js
// E2E 하네스 — vite preview(빌드 산출물) 위에서 headless Chrome을 fake 카메라로 구동한다.
// 시나리오 공통 규약: 콘솔 에러/페이지 에러 0건이 모든 시나리오의 암묵적 단언이다.
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const BASE_URL = 'http://localhost:4173/raon-friends-ar/';
const SHOT_DIR = join(ROOT, 'scripts', 'e2e', '.screenshots');

let previewProc = null;
let browser = null;

export async function startApp() {
  mkdirSync(SHOT_DIR, { recursive: true });
  previewProc = spawn('npm', ['run', 'preview'], { cwd: ROOT, stdio: 'ignore', detached: true });
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try { if ((await fetch(BASE_URL)).ok) break; } catch { /* 기동 대기 */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream', // 가짜 카메라 프레임 공급
      '--use-fake-ui-for-media-stream',     // getUserMedia 권한 자동 허용
    ],
  });
}

export async function stopApp() {
  await browser?.close();
  try { process.kill(-previewProc.pid); } catch { /* 이미 종료 */ }
}

// 시나리오 하나가 쓰는 격리 페이지 — incognito 컨텍스트라 localStorage가 매번 깨끗하다.
export async function withPage(fn, { params = '' } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const ctx = {
    errors,
    shot: (name) => page.screenshot({ path: join(SHOT_DIR, `${name}.png`) }),
  };
  try {
    await page.goto(`${BASE_URL}${params}`, { waitUntil: 'networkidle0' });
    await fn(page, ctx);
    // 리소스 404(sw 캐시 미스 등 무해 케이스)는 여기서 필터링하지 말 것 — 전부 실패로 취급해
    // "에러 0" 원칙을 유지한다. 예외가 필요해지면 시나리오가 아니라 앱을 고친다.
    if (errors.length) throw new Error(`콘솔/페이지 에러 ${errors.length}건:\n${errors.join('\n')}`);
  } finally {
    await context.close();
  }
}

// 공용 헬퍼 — 온보딩 닫기(있을 때만), 말풍선 타자 효과 완료 대기
export async function dismissOnboarding(page) {
  const visible = await page.evaluate(() => {
    const el = document.getElementById('onboarding');
    return el && !el.hidden;
  });
  if (visible) await page.click('#btn-onboarding-start');
}

export async function readBubble(page, { settleMs = 2500 } = {}) {
  await page.waitForSelector('#bubble:not([hidden])', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, settleMs)); // 타자 효과 35ms/자 완료 대기
  return page.evaluate(() => ({
    name: document.getElementById('bubble-name').textContent,
    text: document.getElementById('bubble-text').textContent,
    screen: document.body.dataset.screen,
  }));
}
```

- [ ] **Step 3: 러너 작성** — `scripts/e2e.mjs` 전체:

```js
// E2E 러너 — 시나리오를 순차 실행하고 요약을 출력한다. 실패 1건이라도 있으면 exit 1.
// 사용법: npm run e2e  (사전 조건: npm run build — CI에서는 별도 스텝, 로컬은 아래에서 자동)
import { execSync } from 'child_process';
import { startApp, stopApp } from './e2e/harness.mjs';

const scenarioModules = [
  './e2e/scenarios/s0-start.mjs',
];

execSync('npm run build', { stdio: 'inherit' });
await startApp();
let failed = 0;
try {
  for (const path of scenarioModules) {
    const mod = await import(path);
    try {
      await mod.run();
      console.log(`✓ ${mod.name}`);
    } catch (e) {
      failed += 1;
      console.error(`✗ ${mod.name}\n  ${e.message}`);
    }
  }
} finally {
  await stopApp();
}
console.log(failed ? `실패 ${failed}건` : '전체 그린');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 4: 시나리오 S0** — `scripts/e2e/scenarios/s0-start.mjs` 전체:

```js
// S0: 시작 화면 — 타이틀·모드 버튼 3종·언어 토글이 렌더되고 콘솔 에러가 없다.
import { withPage } from '../harness.mjs';

export const name = 'S0 시작 화면 렌더';

export async function run() {
  await withPage(async (page, ctx) => {
    const state = await page.evaluate(() => ({
      title: document.getElementById('start-title').textContent,
      overlay: document.getElementById('btn-overlay-label').textContent,
      marker: document.getElementById('btn-marker-label').textContent,
      vision: document.getElementById('btn-vision-label').textContent,
      screen: document.body.dataset.screen,
    }));
    if (!state.title.includes('라온 프렌즈')) throw new Error(`타이틀 이상: ${state.title}`);
    if (state.screen !== 'start') throw new Error(`시작 화면 아님: ${state.screen}`);
    for (const [k, v] of Object.entries(state)) if (!v) throw new Error(`${k} 라벨 비어있음`);
    await ctx.shot('s0-start');
  });
}
```

- [ ] **Step 5: 실행해 그린 확인**

```bash
npm run e2e
```
Expected: `✓ S0 시작 화면 렌더` / `전체 그린` / exit 0. (`scripts/e2e/.screenshots/`는 `.gitignore`에 추가)

- [ ] **Step 6: Commit** — `test: E2E 하네스 + S0 시작 화면 (fake 카메라 headless)`

### Task 2: S1 오버레이 전체 플로우

**Files:**
- Create: `scripts/e2e/scenarios/s1-overlay-flow.mjs`
- Modify: `scripts/e2e.mjs` (scenarioModules에 추가)

**Interfaces (Consumes):** Task 1의 `withPage`/`dismissOnboarding`/`readBubble`.

- [ ] **Step 1: 시나리오 작성** — 전체:

```js
// S1: 기본 경로 — 온보딩 → 오버레이 → 릴레이 3캐릭터 배턴터치 → 설문 화면 진입.
// 릴레이 대본의 화자 순서(라옹→라옹→라오니→라오니→라오나)가 그대로 재생되는지 고정한다.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S1 오버레이 전체 플로우';

export async function run() {
  await withPage(async (page, ctx) => {
    await dismissOnboarding(page);
    await page.click('#btn-overlay');
    const speakers = [];
    for (let i = 0; i < 6; i++) {
      const b = await readBubble(page);
      if (b.screen !== 'guide') { speakers.push(`[${b.screen}]`); break; }
      speakers.push(b.name);
      const canNext = await page.evaluate(() => {
        const btn = document.getElementById('btn-next');
        return btn && !btn.hidden && !btn.disabled;
      });
      if (!canNext) throw new Error(`가이드 ${i}번째에서 다음 버튼 비활성`);
      await page.click('#btn-next');
    }
    const expected = ['라옹', '라옹', '라오니', '라오니', '라오나', '[survey]'];
    if (JSON.stringify(speakers) !== JSON.stringify(expected)) {
      throw new Error(`배턴터치 순서 불일치: ${speakers.join(',')} ≠ ${expected.join(',')}`);
    }
    const surveyVisible = await page.evaluate(() => !document.getElementById('survey-panel').hidden);
    if (!surveyVisible) throw new Error('설문 패널 미표시');
    await ctx.shot('s1-survey');
  });
}
```

- [ ] **Step 2: 러너 등록 후 실행** — `scenarioModules`에 `'./e2e/scenarios/s1-overlay-flow.mjs'` 추가, `npm run e2e` → S0·S1 그린.
- [ ] **Step 3: Commit** — `test: S1 오버레이 배턴터치 전체 플로우 고정`

### Task 3: S2 단독 진행 정체성 + S3 Vision mock

**Files:**
- Create: `scripts/e2e/scenarios/s2-solo-identity.mjs`
- Create: `scripts/e2e/scenarios/s3-vision-mock.mjs`
- Modify: `scripts/e2e.mjs`

- [ ] **Step 1: S2 작성** — 전체:

```js
// S2: ?char= 단독 진행 — 3캐릭터 각각, 전 대사에서 "다른 캐릭터 이름 0회" 불변식.
// (v1.3.1 정체성 버그의 E2E 레벨 회귀 방지 — 유닛 불변식은 test/solo-character.test.js)
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S2 단독 진행 정체성 (?char= 3종)';
const NAMES = { raong: '라옹', raoni: '라오니', raona: '라오나' };

export async function run() {
  for (const [key, myName] of Object.entries(NAMES)) {
    await withPage(async (page) => {
      await dismissOnboarding(page);
      await page.click('#btn-overlay');
      for (let i = 0; i < 7; i++) {
        const b = await readBubble(page);
        const others = Object.values(NAMES).filter((n) => n !== myName);
        for (const other of others) {
          if ((b.name + b.text).includes(other)) {
            throw new Error(`[${key}] ${i}번째 대사에 ${other} 노출: ${b.name}: ${b.text}`);
          }
        }
        if (b.screen !== 'guide') break;
        if (b.name !== myName) throw new Error(`[${key}] 화자 불일치: ${b.name}`);
        await page.click('#btn-next');
      }
    }, { params: `?char=${key}` });
  }
}
```

- [ ] **Step 2: S3 작성** — 전체:

```js
// S3: Vision mock — ?visionMock=raong으로 진입해 인식 게이트 통과 후 라옹 단독 진행 확인.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S3 Vision mock 인식 → 단독 진행';

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#btn-vision');
    // 인식 게이트: classifyIntervalMs 400 × 연속 5회 ≈ 2초 + 전환 연출 여유
    const b = await readBubble(page, { settleMs: 6000 });
    if (b.name !== '라옹') throw new Error(`인식 후 화자가 라옹이 아님: ${b.name}`);
    if (!b.text.includes('라옹')) throw new Error(`자기소개에 라옹 없음: ${b.text}`);
  }, { params: '?visionMock=raong' });
}
```

- [ ] **Step 3: 러너 등록·실행·확인** — S0~S3 그린. 실패 시 시나리오의 대기시간(settleMs)만 조정 — **앱 코드는 이 Phase에서 수정 금지** (버그 발견 시 기록만 하고 사용자 보고).
- [ ] **Step 4: Commit** — `test: S2 정체성·S3 Vision mock 시나리오`

### Task 4: 타이머 배속 + S4 카드 폴백 + S5 설문 전송·오프라인 큐

**Files:**
- Create: `src/app/timing.js`
- Test: `test/timing.test.js`
- Modify: `src/main.js` (마커 폴백 30000·키오스크 리셋에 timing 적용 — 2곳)
- Create: `scripts/e2e/scenarios/s4-marker-fallback.mjs`
- Create: `scripts/e2e/scenarios/s5-survey-submit.mjs`
- Modify: `scripts/e2e.mjs`

**Interfaces (Produces):** `scaledMs(baseMs, search?)` — `?timerScale=0.1`이면 baseMs×0.1(하한 50ms). 파라미터 없으면 원값. E2E·리허설 전용이며 README에는 넣지 않는다.

- [ ] **Step 1: 실패 테스트** — `test/timing.test.js` 전체:

```js
import { describe, it, expect } from 'vitest';
import { scaledMs } from '../src/app/timing.js';

describe('scaledMs', () => {
  it('파라미터 없으면 원값', () => expect(scaledMs(30000, '')).toBe(30000));
  it('timerScale 적용', () => expect(scaledMs(30000, '?timerScale=0.1')).toBe(3000));
  it('하한 50ms', () => expect(scaledMs(100, '?timerScale=0.0001')).toBe(50));
  it('비정상 값은 무시', () => expect(scaledMs(30000, '?timerScale=abc')).toBe(30000));
});
```
Run: `npx vitest run test/timing.test.js` → FAIL (모듈 없음).

- [ ] **Step 2: 구현** — `src/app/timing.js` 전체:

```js
// 테스트·리허설용 타이머 배속 — ?timerScale=0.1이면 대기 시간이 1/10로 줄어든다.
// E2E가 30초 폴백·키오스크 리셋을 수 초 안에 검증하기 위한 장치로, 운영 문서(README)에는 싣지 않는다.
export function scaledMs(baseMs, search = location.search) {
  const raw = new URLSearchParams(search).get('timerScale');
  const scale = Number(raw);
  if (!raw || !Number.isFinite(scale) || scale <= 0 || scale > 1) return baseMs;
  return Math.max(50, Math.round(baseMs * scale));
}
```
테스트 그린 확인. main.js에서 마커 폴백 `30000` → `scaledMs(30000)`, 키오스크 리셋 대기 상수에도 동일 적용(해당 상수를 찾아 `scaledMs(...)`로 감싼다 — `armKioskReset` 정의부).

- [ ] **Step 3: S4 작성** — 전체:

```js
// S4: 카드 모드 — fake 카메라로는 인식 불가 → 폴백 버튼 노출 → 오버레이 폴백까지.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S4 카드 미인식 폴백';

export async function run() {
  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('#btn-marker');
    await page.waitForSelector('#btn-marker-fallback:not([hidden])', { timeout: 15000 }); // 30s × 0.1
    await page.click('#btn-marker-fallback');
    const b = await readBubble(page);
    if (b.screen !== 'guide') throw new Error(`폴백 후 가이드 아님: ${b.screen}`);
  }, { params: '?timerScale=0.1' });
}
```

- [ ] **Step 4: S5 작성** — 전체:

```js
// S5: 설문 제출 — 구글폼 POST를 네트워크 인터셉트로 스텁(실전송 금지). 차단 상태에선
// 재시도 UI+오프라인 큐 적재, 허용 후 재시도로 완료 화면까지.
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S5 설문 전송 스텁 + 오프라인 큐';

async function fillSurveyAndSubmit(page) {
  // 동의 → 별점5 → 첫 객관식 → 텍스트 입력들 → 제출. 셀렉터는 survey.js 렌더 구조 기준.
  await page.evaluate(() => {
    document.querySelector('#survey-panel input[type="checkbox"]')?.click();
  });
  await page.click('#survey-panel [data-rating="5"], #survey-panel .rating button:nth-child(5)');
  await page.evaluate(() => {
    const panel = document.getElementById('survey-panel');
    panel.querySelector('input[type="radio"]')?.click();
    for (const input of panel.querySelectorAll('input[type="text"], textarea')) input.value = 'e2e';
    for (const input of panel.querySelectorAll('input[type="text"], textarea')) input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#survey-panel button[type="submit"], #survey-panel .btn-submit');
}

export async function run() {
  await withPage(async (page) => {
    let blocked = true;
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('docs.google.com')) {
        if (blocked) return req.abort('internetdisconnected');
        return req.respond({ status: 200, body: '' });
      }
      return req.continue();
    });
    await dismissOnboarding(page);
    await page.click('#btn-overlay');
    for (let i = 0; i < 5; i++) { await readBubble(page, { settleMs: 1800 }); await page.click('#btn-next'); }
    await page.waitForSelector('#survey-panel:not([hidden])');
    await fillSurveyAndSubmit(page);
    // 차단 상태: 재시도 안내 + 큐 적재
    const queued = await page.waitForFunction(
      () => (localStorage.getItem('surveyQueue') ?? '[]') !== '[]', { timeout: 10000 },
    ).then(() => true).catch(() => false);
    if (!queued) throw new Error('오프라인 큐 미적재');
    blocked = false;
    await page.click('.retry-button, #screen-ar button.btn-retry'); // submitAndRetry가 붙인 재시도 버튼
    const done = await readBubble(page, { settleMs: 3000 });
    if (done.screen !== 'done') throw new Error(`완료 화면 아님: ${done.screen}`);
  });
}
```
주의: 셀렉터·localStorage 키는 작성 시점에 `src/survey.js`·`src/queue.js`·`src/main.js(submitAndRetry)`를 열어 실제 값으로 맞춘다(위 코드의 후보 셀렉터 중 실존하는 것으로 확정). **앱 코드는 수정 금지.**

- [ ] **Step 5: 러너 등록·실행** — S0~S5 그린. **Commit** — `test: S4 카드 폴백·S5 설문 스텁/오프라인 큐 + 타이머 배속(scaledMs)`

### Task 5: S6(en·kiosk·size) + CI 게이트 + usdz 러너 정리

**Files:**
- Create: `scripts/e2e/scenarios/s6-params.mjs`
- Modify: `scripts/e2e.mjs`, `.github/workflows/deploy.yml`, `scripts/export-usdz.mjs`

- [ ] **Step 1: S6 작성** — 전체:

```js
// S6: 파라미터 매트릭스 — ?lang=en 문구, ?kiosk=1 온보딩 생략, 크기 칩 상태.
import { withPage, dismissOnboarding } from '../harness.mjs';

export const name = 'S6 파라미터(en·kiosk·size)';

export async function run() {
  await withPage(async (page) => {
    const label = await page.evaluate(() => document.getElementById('btn-overlay-label').textContent);
    if (/만나러/.test(label)) throw new Error(`en인데 한국어 라벨: ${label}`);
  }, { params: '?lang=en' });

  await withPage(async (page) => {
    const onboardingShown = await page.evaluate(() => {
      const el = document.getElementById('onboarding');
      return el && !el.hidden;
    });
    if (onboardingShown) throw new Error('kiosk 모드에서 온보딩 노출');
  }, { params: '?kiosk=1' });

  await withPage(async (page) => {
    await dismissOnboarding(page);
    await page.click('[data-size="giant"], .size-chip:last-child'); // 실제 셀렉터로 확정할 것
    const active = await page.evaluate(() =>
      document.querySelector('.size-chip.active, [data-size].selected')?.textContent ?? '');
    if (!active.includes('자이언트')) throw new Error(`자이언트 칩 미적용: ${active}`);
  });
}
```

- [ ] **Step 2: CI 게이트** — `.github/workflows/deploy.yml`의 `build` 잡 `npm run build` 다음에 스텝 추가:

```yaml
      - name: E2E
        run: CHROME_BIN=$(which google-chrome) npm run e2e
```
(ubuntu-latest에 google-chrome 사전 설치. e2e가 실패하면 upload-pages-artifact에 도달하지 않아 배포가 게이트된다.)

- [ ] **Step 3: usdz 러너 정리** — `scripts/export-usdz.mjs`에서 `PUPPETEER_DIR`/`createRequire` 블록 삭제 → `import puppeteer from 'puppeteer-core';`로 교체(이제 devDep). 사용법 주석도 갱신.
- [ ] **Step 4: 전체 실행** — `npm test` + `npm run e2e` 그린. **Commit** — `test: S6 파라미터 매트릭스 + CI e2e 게이트 + usdz 러너 devDep 전환`
- [ ] **Step 5: Phase 0 완료 push** — `git push origin main` 후 Actions에서 e2e 잡 그린 + 배포 성공 확인 (사이트 폴링). **여기가 "현재 동작 고정" 기준선이다.**

---

## Phase 1 — 셸 재작성 (모듈 단위 이관, 매 Task 후 test+e2e 그린)

### Task 6: app/storage-keys.js + app/store.js

**Files:**
- Create: `src/app/storage-keys.js`, `src/app/store.js`
- Test: `test/store.test.js`

**Interfaces (Produces):**
- `STORAGE_KEYS = { onboardingSeen, overlayLookHintSeen, soundMuted, surveyQueue }` — 실값은 현재 코드에서 grep으로 수집해 **기존 문자열 그대로** 옮긴다(마이그레이션 금지).
- `createStore(search)` → `{ get(key), set(key, value), subscribe(fn): unsubscribe, params }`. 초기 상태: `{ kiosk, charParam, characterHeight, cameraFacing, lockedCharacter: null }` — 파싱 규칙은 현재 main.js L74~80과 동일(`SIZE_HEIGHTS = { life: 1.8, giant: 2.5 }`).

- [ ] **Step 1: 실패 테스트** — `test/store.test.js` 전체:

```js
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/app/store.js';

describe('createStore', () => {
  it('URL 파라미터를 초기 상태로 파싱한다', () => {
    const s = createStore('?kiosk=1&char=raoni&size=giant&camera=user');
    expect(s.get('kiosk')).toBe(true);
    expect(s.get('charParam')).toBe('raoni');
    expect(s.get('characterHeight')).toBe(2.5);
    expect(s.get('cameraFacing')).toBe('user');
    expect(s.get('lockedCharacter')).toBe(null);
  });
  it('알 수 없는 size·camera는 undefined', () => {
    const s = createStore('?size=xl&camera=rear');
    expect(s.get('characterHeight')).toBeUndefined();
    expect(s.get('cameraFacing')).toBeUndefined();
  });
  it('set은 구독자에게 (key, value)로 알린다 / unsubscribe 동작', () => {
    const s = createStore('');
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set('lockedCharacter', 'raona');
    expect(fn).toHaveBeenCalledWith('lockedCharacter', 'raona');
    off();
    s.set('lockedCharacter', null);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 구현** — `src/app/store.js` 전체:

```js
// 앱 상태 단일 소유 — URL 파라미터 파싱 규칙은 기존 main.js와 동일해야 한다(동작 보존).
const SIZE_HEIGHTS = { life: 1.8, giant: 2.5 };

export function createStore(search = location.search) {
  const params = new URLSearchParams(search);
  const state = {
    kiosk: params.get('kiosk') === '1',
    charParam: params.get('char'),
    characterHeight: SIZE_HEIGHTS[params.get('size')],
    cameraFacing: params.get('camera') === 'user' ? 'user' : undefined,
    lockedCharacter: null, // ?char= 검증 통과·카드 소환·Vision 인식이 설정
  };
  const listeners = new Set();
  return {
    params,
    get: (key) => state[key],
    set(key, value) {
      state[key] = value;
      listeners.forEach((fn) => fn(key, value));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
```

`src/app/storage-keys.js`: 현재 코드에서 `localStorage.(get|set)Item` 전 호출을 grep, 키 문자열을 그대로 상수화하고 호출부를 상수 참조로 바꾼다(값 불변).

- [ ] **Step 3: 테스트 그린 + e2e 그린 확인 후 Commit** — `refactor: app/store 상태 단일화 + storage-keys 상수화`

### Task 7: app/router.js + 화면 전환 일원화

**Files:**
- Create: `src/app/router.js` · Test: `test/router.test.js`
- Modify: `src/main.js`(syncScreen·style.display 토글 전부 교체), `src/style.css`(marker/vision/direct-survey/error 화면과 `body.marker-flow`·`body.xr-active` 규칙을 data-screen/data-mode 셀렉터로)

**Interfaces (Produces):** `createRouter(root = document.body)` → `{ show(screen), screen(), setMode(mode | null), mode() }`. screen 값: `start|guide|survey|done|marker|vision|direct-survey|error`. mode 값: `marker-flow|xr|null`.

- [ ] **Step 1: 실패 테스트** — `test/router.test.js` 전체 (vitest jsdom 환경):

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRouter } from '../src/app/router.js';

describe('createRouter', () => {
  it('show가 data-screen을 단독 소유한다', () => {
    const r = createRouter(document.body);
    r.show('guide');
    expect(document.body.dataset.screen).toBe('guide');
    expect(r.screen()).toBe('guide');
  });
  it('setMode(null)이 data-mode를 제거한다', () => {
    const r = createRouter(document.body);
    r.setMode('marker-flow');
    expect(document.body.dataset.mode).toBe('marker-flow');
    r.setMode(null);
    expect('mode' in document.body.dataset).toBe(false);
    expect(r.mode()).toBe(null);
  });
});
```

- [ ] **Step 2: 구현** — `src/app/router.js` 전체:

```js
// 화면·모드 전환의 단일 소유자 — 이 모듈 밖에서 data-screen/data-mode를 만지거나
// style.display로 화면을 토글하는 것을 금지한다(셸 재작성 스펙 §2).
export function createRouter(root = document.body) {
  return {
    show(screen) { root.dataset.screen = screen; },
    screen() { return root.dataset.screen; },
    setMode(mode) {
      if (mode) root.dataset.mode = mode;
      else delete root.dataset.mode;
    },
    mode() { return root.dataset.mode ?? null; },
  };
}
```

- [ ] **Step 3: CSS 이관** — `style.css`에 추가하고 JS 인라인 토글을 대체:

```css
/* 화면 전환은 router(data-screen/data-mode)가 단독 소유 — JS의 style.display 토글 금지 */
body[data-screen="marker"] #screen-marker { display: block; }
body[data-mode="marker-flow"] #screen-marker { display: block; }
body[data-screen="vision"] #screen-vision { display: block; }
body[data-screen="direct-survey"] #screen-direct-survey { display: flex; }
body[data-screen="error"] #error-screen { display: flex; }
body[data-mode="marker-flow"] #camera-video,
body[data-mode="marker-flow"] #three-canvas,
body[data-mode="marker-flow"] #btn-capture,
body[data-mode="marker-flow"] #btn-home,
body[data-mode="xr"] #camera-video,
body[data-mode="xr"] #three-canvas { display: none; }
```
main.js에서: `syncScreen()` 구현을 `router.show(flow.screen)`으로, `#screen-marker/#screen-vision` `style.display` 대입 8곳을 `router.show('marker')`·`router.setMode('marker-flow')` 등으로, `body.classList.add('marker-flow')`·`xr-active` 추가/제거를 `router.setMode(...)`로 교체. 기존 `body.marker-flow`·`body.xr-active` CSS 규칙과 `#screen-marker{display:none}` 기본값 등 낡은 셀렉터는 삭제. `#screen-direct-survey`·`#error-screen`의 hidden 속성 토글은 그대로 두되 화면 상태와 겹치면 data-screen으로 통일.

- [ ] **Step 4: 검증** — `npm test` + `npm run e2e` 전체 그린(특히 S4 카드 폴백·S1). 헤드리스 스크린샷 s0/s1을 이전 아카이브와 눈으로 대조. **Commit** — `refactor: router로 화면·모드 전환 일원화 (3중 메커니즘 제거)`

### Task 8: app/scenes.js — 씬 계약 + NullScene

**Files:**
- Create: `src/app/scenes.js` · Test: `test/scenes.test.js`
- Modify: `src/main.js` (`activeScene` 사용부 전체)

**Interfaces (Produces):**
- `SCENE_METHODS = ['setCharacter','playEntrance','playMotion','burst','stopCamera','pause','resume','stop']`
- `asScene(impl)` → 모든 메서드가 존재하는 Scene(없는 메서드는 no-op, this 바인딩 유지). `NullScene = asScene()`.

- [ ] **Step 1: 실패 테스트** — `test/scenes.test.js` 전체:

```js
import { describe, it, expect, vi } from 'vitest';
import { asScene, NullScene, SCENE_METHODS } from '../src/app/scenes.js';

describe('asScene', () => {
  it('NullScene은 전 메서드가 no-op으로 존재한다', () => {
    for (const m of SCENE_METHODS) expect(() => NullScene[m]()).not.toThrow();
  });
  it('구현이 있는 메서드는 위임, 없는 메서드는 no-op', () => {
    const impl = { playMotion: vi.fn() };
    const s = asScene(impl);
    s.playMotion('wave');
    expect(impl.playMotion).toHaveBeenCalledWith('wave');
    expect(() => s.burst('heart')).not.toThrow();
  });
});
```

- [ ] **Step 2: 구현** — `src/app/scenes.js` 전체:

```js
// 씬 공통 계약 — overlay/marker/webxr가 부분적으로만 구현하는 API를 전 메서드 보장형으로
// 정규화한다. activeScene은 null이 될 수 없고(NullScene), 호출부의 `?.` 가드를 없앤다.
const noop = () => {};

export const SCENE_METHODS = [
  'setCharacter', 'playEntrance', 'playMotion', 'burst',
  'stopCamera', 'pause', 'resume', 'stop',
];

export function asScene(impl = {}) {
  const scene = {};
  for (const m of SCENE_METHODS) {
    scene[m] = typeof impl[m] === 'function' ? impl[m].bind(impl) : noop;
  }
  scene.raw = impl; // webxr 복귀 등 원본이 필요한 예외 경로용
  return scene;
}

export const NullScene = asScene();
```

- [ ] **Step 3: main.js 적용** — `let activeScene = null` → `let activeScene = NullScene`; `activeScene = overlay` → `activeScene = asScene(overlay)`(webxr·마커도 동일); `activeScene?.stopCamera?.()` 등 `?.` 가드 12곳을 일반 호출로. `ensureCharacter`의 `if (!activeScene || ...)` → `if (activeScene === NullScene || speaker === currentSpeaker) return;`.
- [ ] **Step 4: 검증 후 Commit** — test+e2e 그린 → `refactor: Scene 계약(asScene/NullScene)으로 씬 인터페이스 통일`

### Task 9: app/guide.js — 안내·설문 흐름 분리

**Files:**
- Create: `src/app/guide.js` · Test: `test/guide.test.js`
- Modify: `src/main.js`

**Interfaces (Produces):**

```js
createGuide({ config, router, sound, showLine, loadCharacter, buildSoloGuideScript, dom })
// dom = { nextBtn, surveyPanel, donePanel } (HTMLElement)
→ {
  begin(),                    // 릴레이(또는 사전 고정된) 대본으로 flow 생성·start·renderGuide
  lockTo(charKey),            // 단독 대본 재조립 + lockedCharacter 기록 (begin 전·후 모두 안전)
  next(),                     // 다음 대사/설문 진입 (기존 btn-next 핸들러 본문)
  setScene(scene), scene(),   // asScene 결과 주입/조회 (초기값 NullScene)
  speaker(),                  // 현재 화자 키
  surveySpeaker(),            // lockedCharacter ?? 'raona'
  ensureCharacter(speaker),   // 캐시 포함 — 기존 main.js 구현 이동
  startSurvey(handlers),      // handlers = { submitAndRetry, renderSurvey, questions, onDone }
}
```

- [ ] **Step 1: 실패 테스트** — `test/guide.test.js` 전체 (DOM 없는 순수 부분만 — begin/lockTo/speaker/surveySpeaker):

```js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createGuide } from '../src/app/guide.js';
import { NullScene } from '../src/app/scenes.js';

function makeGuide(overrides = {}) {
  const config = {
    guideScript: [
      { speaker: 'raong', text: 'a' }, { speaker: 'raoni', text: 'b' }, { speaker: 'raona', text: 'c' },
    ],
    soloGuideLines: ['공통1'],
    characters: { raong: { name: '라옹', soloIntro: '저는 라옹' }, raoni: { name: '라오니', soloIntro: '저는 라오니' }, raona: { name: '라오나', soloIntro: '저는 라오나' } },
    ui: { characterLoading: '로딩' },
  };
  document.body.innerHTML = '<button id="n"></button><div id="s" hidden></div><div id="d" hidden></div>';
  return createGuide({
    config,
    router: { show: vi.fn(), setMode: vi.fn(), screen: () => 'guide', mode: () => null },
    sound: { play: vi.fn() },
    showLine: vi.fn(),
    loadCharacter: vi.fn(async () => null),
    buildSoloGuideScript: (key, cfg) => [{ speaker: key, text: cfg.characters[key].soloIntro }, ...cfg.soloGuideLines.map((text) => ({ speaker: key, text }))],
    dom: { nextBtn: document.getElementById('n'), surveyPanel: document.getElementById('s'), donePanel: document.getElementById('d') },
    ...overrides,
  });
}

describe('createGuide', () => {
  it('begin 후 첫 화자는 릴레이 첫 화자', () => {
    const g = makeGuide();
    g.begin();
    expect(g.speaker()).toBe('raong');
    expect(g.surveySpeaker()).toBe('raona');
  });
  it('lockTo 후 전 대사가 그 화자·설문 화자도 승계', () => {
    const g = makeGuide();
    g.lockTo('raoni');
    g.begin();
    expect(g.speaker()).toBe('raoni');
    expect(g.surveySpeaker()).toBe('raoni');
  });
  it('초기 scene은 NullScene이고 setScene으로 교체된다', () => {
    const g = makeGuide();
    expect(g.scene()).toBe(NullScene);
  });
});
```

- [ ] **Step 2: 구현** — `src/app/guide.js`: 위 계약대로. **본문은 main.js에서 그대로 이동**한다(동작 보존): `ensureCharacter`(main.js `async function ensureCharacter` 전체), `renderGuide`, `btn-next` 핸들러 본문 → `next()`, `startSurvey`+`reactionsFor`(surveySpeaker 치환 포함), `guideSpeakerLock` → 내부 `lockedCharacter`. flow는 `createFlow`를 내부 import. 이동 후 main.js에서 원본 삭제.
- [ ] **Step 3: 검증 후 Commit** — test(신규 3+기존 전체)+e2e(S1·S2가 최종 심판) 그린 → `refactor: guide 모듈로 안내·설문 흐름 분리 (모드 무관)`

### Task 10: app/entry.js + main.js 부트스트랩 재작성

**Files:**
- Create: `src/app/entry.js`, `src/app/labels.js`, `src/app/start-screen.js` · Test: `test/entry.test.js`
- Rewrite: `src/main.js` (≤150줄 목표)

**Interfaces (Produces):**
- `createOnceGuard()` → `guard(fn)` — 첫 호출만 실행(진입 중복 방지 3벌 통합). 테스트: 두 번 호출 시 fn 1회.
- `bindLabels(config)` (labels.js) — 현재 main.js의 `document.getElementById(...).textContent = CONFIG...` 라벨 대입 ~30줄 전부 이동.
- `initStartScreen({ config, store, sound, onOverlay, onMarker, onVision, onDirectSurvey })` (start-screen.js) — 온보딩·캐릭터 카드·크기 칩·운영자 시트·언어 토글·효과음 토글 이동.

- [ ] **Step 1: entry 테스트·구현** — `test/entry.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createOnceGuard } from '../src/app/entry.js';

describe('createOnceGuard', () => {
  it('두 번째 호출은 무시된다', async () => {
    const guard = createOnceGuard();
    const fn = vi.fn(async () => {});
    await guard(fn);
    await guard(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```
구현 `src/app/entry.js`:

```js
// 모드 진입 중복 가드 — 기존 overlayEntering/markerEntering/visionEntering 3벌의 공통화.
// 진입은 페이지 수명당 1회(성공 후 홈은 reload)라 재무장(reset)은 두지 않는다(YAGNI).
export function createOnceGuard() {
  let entered = false;
  return async (fn) => {
    if (entered) return;
    entered = true;
    return fn();
  };
}
```

- [ ] **Step 2: labels.js·start-screen.js로 기계적 이동** — main.js에서 해당 블록(라벨 대입 전부 / `initOnboarding`·캐릭터 카드·크기 칩·운영자 시트·언어 토글·효과음 토글)을 함수로 감싸 이동. 코드 내용 변경 금지, import만 정리.
- [ ] **Step 3: main.js 재작성** — 남는 것: import·전역 에러 가드(showErrorScreen)·store/router/guide 생성·진입 핸들러(startOverlayFlow/enterMarkerMode/enterVisionMode/startMarkerFlow — guide·router·entry 사용으로 축약)·goHome/popstate·XR/QuickLook 버튼·기념사진·SW 등록. 각 핸들러는 기존 본문을 유지하되 syncScreen→router, activeScene→guide.setScene, guideSpeakerLock→guide.lockTo로 치환.
- [ ] **Step 4: 검증** — `wc -l src/main.js` ≤ 150 / `grep -c "?\\." src/main.js`에서 씬 가드 0 / `grep -c "style.display" src/main.js` = 0 / `npm test`·`npm run e2e` 전체 그린 + 스크린샷 대조. **Commit** — `refactor: main.js 부트스트랩化 — entry/labels/start-screen 분리 (932→≤150줄)`

### Task 11: overlay orientationProvider 주입 + 자이로 E2E

**Files:**
- Modify: `src/scenes/overlay.js` (자이로 구독부만 — 렌더링 불변)
- Create: `scripts/e2e/scenarios/s7-gyro-fake.mjs` · Modify: `scripts/e2e.mjs`

**Interfaces (Produces):** `initOverlay({ ..., orientationProvider })` — `orientationProvider(cb)` 형태(기본값: `(cb) => window.addEventListener('deviceorientation', cb)`). E2E는 `window.__fakeOrientation = cb` 노출 파라미터(`?fakeGyro=1`) 대신 **provider 주입을 main.js에서 분기**: `store.params.get('fakeGyro') === '1'`이면 window에 콜백을 노출하는 provider 사용.

- [ ] **Step 1: overlay 수정** — `window.addEventListener('deviceorientation', handler)` 한 줄을 `((orientationProvider) ?? default)(handler)`로. 기본 동작 완전 동일.
- [ ] **Step 2: S7 작성** — `?fakeGyro=1`로 진입 → `page.evaluate(() => window.__fakeOrientation({ alpha: 10, beta: 45, gamma: 0 }))` 수회 주입 → three 카메라 쿼터니언이 변했는지 `window.__overlayCameraQuat`(fakeGyro 모드에서만 노출) 비교로 단언. 콘솔 에러 0.
- [ ] **Step 3: 검증 후 Commit** — `feat: 자이로 provider 주입 — 자이로 경로 헤드리스 검증(S7)`

### Task 12: three dedupe + 마무리

**Files:**
- Modify: `vite.config.js`(`resolve.dedupe: ['three']`), `docs/CURRENT_STATE.md`, `docs/NEXT_STEP.md`, `README.md`(저장소 구조도), `package.json`(1.4.0), 본 계획 체크박스

- [ ] **Step 1: dedupe 적용** — 빌드 후 S1 실행 시 콘솔에 "Multiple instances of Three.js" 경고가 **없음**을 e2e 에러 수집기 로그로 확인(경고는 console.warn이라 수동 확인: `page.on('console')`에서 warn도 일시 수집해 검사하는 단언을 S0에 추가).
- [ ] **Step 2: 문서 동기화** — CURRENT_STATE에 v1.4.0 항목(모듈 구조·E2E 매트릭스·성공 기준 달성 수치), README 저장소 구조도에 `src/app/`·`scripts/e2e/` 반영, NEXT_STEP 정리.
- [ ] **Step 3: 최종 검증** — `npm test`(전체)·`npm run e2e`(S0~S7) 그린, `wc -l src/main.js` 기록. **Commit + tag v1.4.0 + push 1회** → Actions e2e 게이트·배포·사이트 폴링 확인.
- [ ] **Step 4: 실기기 체크리스트 보고** — 마커 실트래킹·실자이로·Quick Look·효과음은 사용자 확인 항목으로 정리해 전달.

## Self-Review 결과

- 스펙 커버리지: §1(Task 1~5)·§2(Task 6~10)·§3(Task 11)·§4(Task 12) — 성공 기준 1~6 모두 태스크에 대응. 스펙의 "app 5모듈"은 구현상 labels/start-screen/timing/storage-keys가 추가됨(부트스트랩 ≤150줄 달성 수단, 스펙 §2 "모듈 단위 이관" 범위 내).
- 플레이스홀더: S5·S6의 일부 셀렉터는 실행 시점에 실제 DOM으로 확정하도록 명시(후보 나열) — 앱 수정 금지 조건과 함께라면 모호성 없음.
- 타입 일관성: Scene 메서드 목록·createGuide 시그니처·scaledMs·createOnceGuard 명칭이 태스크 간 일치함을 확인.
