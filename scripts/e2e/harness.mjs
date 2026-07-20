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
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // 브라우저가 페이지 콘텐츠와 무관하게 항상 자동 요청하는 /favicon.ico 404는 앱 리소스가 아니라
    // 브라우저 자체의 관례적 요청이므로 제외한다. 그 외 모든 리소스 404(sw 캐시 미스 등)는 계속 실패로 취급한다.
    if (m.location()?.url?.endsWith('/favicon.ico')) return;
    errors.push(`console: ${m.text()}`);
  });
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
