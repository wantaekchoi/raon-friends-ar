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
// Vision(MediaPipe) 실 모델은 2단계까지 배포되지 않는다(CONFIG.vision.modelPath) — #btn-vision
// 게이팅(start-screen.js)이 이를 HEAD로 확인하는 매 페이지 로드마다, Chrome이 네트워크 스택
// 수준에서 자동으로 찍는 "Failed to load resource: 404" 콘솔 에러가 뜬다(실측 확인 — fetch를
// try/catch해도 이 메시지 자체는 억제되지 않는다. 브라우저 DevTools가 남기는 것이지 앱 코드가
// 아님). 파비콘 404(과거엔 하네스 예외가 있었지만 실제 파비콘을 추가해 근본적으로 제거함, 위
// 커밋 이력 참고)와 달리 이건 "고쳐야 할 버그"가 아니라 "게이팅 로직이 의도적으로 다루는, 아직
// 배포되지 않은 자산"이므로 정확히 이 리소스 1건만 허용한다 — 다른 어떤 404·에러도 여전히
// 실패로 취급된다(그 자산의 존재 여부와 무관하게 URL로 정밀 매칭 — 아래 콘솔 핸들러가 붙이는
// location().url 참고).
const EXPECTED_ERROR_PATTERNS = [/models\/vision\/raon-mascot-classifier\.tflite/];

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
    // 리소스 로드 실패 메시지("Failed to load resource: ...")는 텍스트만으론 어떤 URL이 실패했는지
    // 알 수 없다 — location().url로 보강해야 EXPECTED_ERROR_PATTERNS/allowErrors가 자산 하나만
    // 정밀하게 예외 처리할 수 있다(무관한 404까지 뭉뚱그려 허용하는 걸 막는다).
    const loc = m.location()?.url;
    errors.push(`console: ${m.text()}${loc ? ` @ ${loc}` : ''}`);
  });
  const ctx = {
    errors,
    warnings,
    shot: (name) => page.screenshot({ path: join(SHOT_DIR, `${name}.png`) }),
  };
  try {
    await page.goto(`${BASE_URL}${params}`, { waitUntil: 'networkidle0' });
    await fn(page, ctx);
    // 콘솔/페이지 에러 0건 원칙 — 리소스 404를 포함해 무조건 실패로 취급한다(index.html이 파비콘을
    // 명시하므로 브라우저의 /favicon.ico 자동 요청도 더는 발생하지 않는다). EXPECTED_ERROR_PATTERNS는
    // 위에서 설명한 예외 자산 1건만 정밀하게 걸러낸다. allowErrors가 주어지면 그 패턴에 매칭되는
    // 항목도 추가로 걸러내고, 나머지는 그대로 실패시킨다.
    const unexpected = errors.filter((e) => {
      if (EXPECTED_ERROR_PATTERNS.some((re) => re.test(e))) return false;
      if (allowErrors?.some((re) => re.test(e))) return false;
      return true;
    });
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
