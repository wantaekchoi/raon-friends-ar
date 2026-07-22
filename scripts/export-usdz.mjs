// iOS AR Quick Look용 .usdz 3종 생성 러너 (부착감 계획 Task D)
//
// USDZExporter는 캔버스·이미지 디코딩 등 브라우저 API가 필요해 Node 단독으론 못 돌린다 —
// vite dev 서버를 띄우고 헤드리스 Chrome에서 usdz-export.html의 exportUsdz()를 호출한 뒤
// 다운로드된 파일을 public/usdz/로 옮긴다.
//
// 사용법: node scripts/export-usdz.mjs
//   - puppeteer-core는 리포 devDependency다(scripts/e2e/harness.mjs와 동일하게 npm install로 확보).
//   - Chrome 경로는 CHROME_BIN으로 재정의 가능 (기본: macOS 표준 설치 경로)
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url))); // .pathname은 비ASCII 경로에서 %인코딩 문제
const OUT_DIR = join(ROOT, 'public', 'usdz');
const KEYS = ['raong', 'raoni', 'raona'];
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const dev = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'ignore', detached: true });
const BASE_URL = 'http://localhost:5173/raon-friends-ar/';
async function waitForServer(timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE_URL);
      if (r.ok) return;
    } catch { /* 아직 안 뜸 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite dev 서버 기동 실패');
}

mkdirSync(OUT_DIR, { recursive: true });

try {
  await waitForServer();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto(`${BASE_URL}usdz-export.html`, { waitUntil: 'networkidle0' });

  for (const key of KEYS) {
    const b64 = await page.evaluate((k) => window.exportUsdz(k), key);
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 10000) throw new Error(`${key}.usdz가 비정상적으로 작음 (${buf.length}B)`);
    writeFileSync(join(OUT_DIR, `${key}.usdz`), buf);
    console.log(`✓ ${key}.usdz (${(buf.length / 1024).toFixed(0)}KB)`);
  }
  await browser.close();
  console.log('완료:', readdirSync(OUT_DIR).join(', '));
} finally {
  try { process.kill(-dev.pid); } catch { /* 이미 종료 */ }
}
