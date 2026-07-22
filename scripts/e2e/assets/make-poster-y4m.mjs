// S12/S13용 합성 카메라 y4m 생성기 — 바닥 카드 SVG(마커 포함/제거)를 "서서 내려다보는"
// 사선 시점으로 렌더한다. 원근은 진짜 핀홀 기하(깊이 z=zn+u(zf-zn), 폭∝1/z, 먼 쪽 압축) —
// 근사 매핑을 쓰면 호모그래피 포즈가 불가능한 평면을 추정한다(계측 2026-07-22, debug-marker).
// 산출물은 scripts/e2e/.assets/에 캐시되고 SVG 내용 해시로 무효화된다.
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const ASSET_DIR = join(ROOT, 'scripts', 'e2e', '.assets');
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const W = 1280;
const H = 720;
const FPS = 15;
const DUR = 14; // 시나리오가 20초 안에 끝나므로 루프 되감김 걱정 없이 넉넉히
const MOTION_S = 2.0;

function rgbaToI420(rgba) {
  const y = Buffer.alloc(W * H);
  const u = Buffer.alloc((W / 2) * (H / 2));
  const v = Buffer.alloc((W / 2) * (H / 2));
  for (let j = 0; j < H; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const idx = (j * W + i) * 4;
      y[j * W + i] = Math.max(16, Math.min(235, 16 + ((65.738 * rgba[idx] + 129.057 * rgba[idx + 1] + 25.064 * rgba[idx + 2]) >> 8)));
    }
  }
  for (let j = 0; j < H; j += 2) {
    for (let i = 0; i < W; i += 2) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [dj, di] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        const idx = ((j + dj) * W + (i + di)) * 4;
        r += rgba[idx];
        g += rgba[idx + 1];
        b += rgba[idx + 2];
      }
      r >>= 2; g >>= 2; b >>= 2;
      const ci = (j / 2) * (W / 2) + i / 2;
      u[ci] = Math.max(16, Math.min(240, 128 + ((-37.945 * r - 74.494 * g + 112.439 * b) >> 8)));
      v[ci] = Math.max(16, Math.min(240, 128 + ((112.439 * r - 94.154 * g - 18.285 * b) >> 8)));
    }
  }
  return Buffer.concat([y, u, v]);
}

function pageHtml(svgB64) {
  return `<!doctype html><meta charset="utf-8">
<canvas id="c" width="${W}" height="${H}"></canvas>
<img id="poster" src="data:image/svg+xml;base64,${svgB64}">
<script>
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { willReadFrequently: true });
const img = document.getElementById('poster');
const ease = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
window.drawFrame = (t) => {
  const g = ctx.createLinearGradient(0, 0, 0, ${H});
  g.addColorStop(0, '#d8d2c8'); g.addColorStop(1, '#b8b0a2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, ${W}, ${H});
  const e = ease(Math.min(1, t));
  const wob = (1 - e) * (1 - e);
  const dx = wob * 50 * Math.sin(t * 11);
  const dy = wob * 25 * Math.sin(t * 8 + 1.2);
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const zn = 1, zf = 2.4;
  const baseW = ${W} * 0.78 * (0.9 + 0.1 * e);
  const bottomY = ${H} * 0.93 + dy;
  const spanH = ${H} * 0.62;
  const STRIPS = 220;
  for (let i = 0; i < STRIPS; i++) {
    const tb0 = i / STRIPS, tb1 = (i + 1) / STRIPS; // 0=아래(가깝다) → 1=위(멀다)
    const u0 = (tb0 * zn) / (zf - tb0 * (zf - zn));
    const u1 = (tb1 * zn) / (zf - tb1 * (zf - zn));
    const v0 = 1 - u0, v1 = 1 - u1; // 소스 세로 비율(위=0)
    const zMid = zn + ((u0 + u1) / 2) * (zf - zn);
    const w = baseW * (zn / zMid);
    const y0 = bottomY - spanH * tb0;
    const y1 = bottomY - spanH * tb1;
    ctx.drawImage(img, 0, v1 * sh, sw, Math.max(1, (v0 - v1) * sh),
      ${W}/2 - w/2 + dx, y1, w, Math.max(1, y0 - y1) + 0.6);
  }
};
window.grabFrame = () => {
  const d = ctx.getImageData(0, 0, ${W}, ${H}).data;
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < d.length; i += CHUNK) bin += String.fromCharCode.apply(null, d.subarray(i, i + CHUNK));
  return btoa(bin);
};
</script>`;
}

/**
 * @param {{ marked: boolean }} opts marked=false면 ArUco 그룹을 제거한(구판) 포스터 — 음성통제용
 * @returns {Promise<string>} 생성(또는 캐시)된 y4m 절대경로
 */
export async function ensurePosterY4m({ marked }) {
  let svg = readFileSync(join(ROOT, 'docs', 'print', 'floor-card-raong.svg'), 'utf8');
  if (!marked) svg = svg.replace(/<g id='aruco-corners'>[\s\S]*?<\/g>/, '');
  const hash = createHash('sha1').update(svg).digest('hex').slice(0, 8);
  const out = join(ASSET_DIR, `poster-${marked ? 'marked' : 'plain'}-${hash}.y4m`);
  if (existsSync(out)) return out;

  mkdirSync(ASSET_DIR, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(pageHtml(Buffer.from(svg).toString('base64')));
    await page.waitForFunction(() => document.getElementById('poster').complete);
    writeFileSync(out, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420\n`);
    const total = DUR * FPS;
    const motionFrames = Math.round(MOTION_S * FPS);
    let holdFrame = null;
    for (let f = 0; f < total; f += 1) {
      if (f < motionFrames || !holdFrame) {
        await page.evaluate((t) => window.drawFrame(t), Math.min(1, f / motionFrames));
        const b64 = await page.evaluate(() => window.grabFrame());
        const frame = rgbaToI420(Buffer.from(b64, 'base64'));
        if (f >= motionFrames - 1) holdFrame = frame;
        appendFileSync(out, Buffer.concat([Buffer.from('FRAME\n'), frame]));
      } else {
        appendFileSync(out, Buffer.concat([Buffer.from('FRAME\n'), holdFrame]));
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}
