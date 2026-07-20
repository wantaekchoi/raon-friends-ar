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
      // CI(리눅스) Chrome은 기본 locale이 en이라 navigator.language 기반 언어 판별이 흔들린다 —
      // "파라미터 없으면 한국어" 전제를 어느 환경에서든 고정한다.
      '--lang=ko-KR',
      '--accept-lang=ko-KR,ko',
    ],
  });
}

export async function stopApp() {
  await browser?.close();
  try { process.kill(-previewProc.pid); } catch { /* 이미 종료 */ }
}

// 시나리오 하나가 쓰는 격리 페이지 — incognito 컨텍스트라 localStorage가 매번 깨끗하다.
//
// allowErrors: 정규식 배열(옵션, 기본값 없음=기존 동작 그대로). "콘솔/페이지 에러 0건" 원칙의
// 예외를 시나리오 단위로 아주 좁게만 열어주는 용도 — 지금은 S9(전역 에러 화면)가 스스로 주입한
// 에러(정확히 그 메시지 문자열)만 허용하는 데 쓴다. 패턴에 매칭되지 않는 에러는 이 옵션을 켜도
// 여전히 실패로 취급된다.
export async function withPage(fn, { params = '', allowErrors } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const errors = [];
  const warnings = []; // console.warn 전용 별도 수집 — 에러 판정(errors)과 무관, 통과/실패에 영향 없음.
  // 시나리오가 특정 경고의 부재를 직접 단언하고 싶을 때 참조한다(예: three dedupe 검증).
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
    if (m.type() !== 'error') return;
    // 브라우저가 페이지 콘텐츠와 무관하게 항상 자동 요청하는 /favicon.ico 404는 앱 리소스가 아니라
    // 브라우저 자체의 관례적 요청이므로 제외한다. 그 외 모든 리소스 404(sw 캐시 미스 등)는 계속 실패로 취급한다.
    if (m.location()?.url?.endsWith('/favicon.ico')) return;
    errors.push(`console: ${m.text()}`);
  });
  const ctx = {
    errors,
    warnings,
    shot: (name) => page.screenshot({ path: join(SHOT_DIR, `${name}.png`) }),
  };
  try {
    await page.goto(`${BASE_URL}${params}`, { waitUntil: 'networkidle0' });
    await fn(page, ctx);
    // 콘솔/페이지 에러 0건 원칙. 유일한 예외는 위의 /favicon.ico 404 한 건뿐이며(앱에 favicon이
    // 없어 브라우저 자동 요청이 항상 404) — 그 외 어떤 리소스 404·에러도 전부 실패로 취급한다.
    // allowErrors가 주어지면 그 패턴에 매칭되는 항목만 추가로 걸러내고, 나머지는 그대로 실패시킨다.
    const unexpected = allowErrors
      ? errors.filter((e) => !allowErrors.some((re) => re.test(e)))
      : errors;
    if (unexpected.length) throw new Error(`콘솔/페이지 에러 ${unexpected.length}건:\n${unexpected.join('\n')}`);
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

// three.js 중복 인스턴스 회귀 검사 — vite의 resolve.dedupe가 깨지거나 청크가 자체 three 사본을
// 들고 오면 이 console.warn이 뜬다. 검사하려는 청크가 실제로 로드된 시나리오에서만 의미가 있다
// (mind-ar는 마커 진입에서만 로드되므로 S4가 그 담당).
export function assertNoThreeDuplicate(ctx) {
  const dup = ctx.warnings.find((w) => w.includes('Multiple instances of Three.js'));
  if (dup) throw new Error(`three.js 중복 인스턴스 경고 발견: ${dup}`);
}
