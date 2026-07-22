// 바닥 카드 SVG 3종의 모서리에 ArUco 마커(ARUCO_MIP_36h12)를 삽입한다.
// ID 규약·크기·여백은 src/scenes/poster-detect.js가 단일 소스 — 인쇄물과 검출 로직이
// 같은 상수를 쓰므로 어긋날 수 없다. 멱등: 기존 <g id="aruco-corners">를 교체.
// 사용: node scripts/inject-poster-markers.mjs
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { MARKER_IDS, MARKER_FRAC, MARGIN_FRAC } from '../src/scenes/poster-detect.js';

const require = createRequire(import.meta.url);
const { AR } = require('js-aruco2');

const HERE = dirname(fileURLToPath(import.meta.url));
const PRINT_DIR = resolve(HERE, '..', 'docs', 'print');
const dictionary = new AR.Dictionary('ARUCO_MIP_36h12');

for (const [key, ids] of Object.entries(MARKER_IDS)) {
  const file = resolve(PRINT_DIR, `floor-card-${key}.svg`);
  let svg = readFileSync(file, 'utf8');

  const widthMatch = svg.match(/viewBox=['"]0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)['"]/);
  if (!widthMatch) throw new Error(`${file}: viewBox 파싱 실패`);
  const W = Number(widthMatch[1]);
  const H = Number(widthMatch[2]);
  const size = MARKER_FRAC * W;
  const margin = MARGIN_FRAC * W;

  // corner = id%10: 0 좌상, 1 우상, 2 좌하, 3 우하 (poster-detect.js cornerOffset와 동일 규약)
  const posFor = (corner) => ({
    x: corner % 2 === 0 ? margin : W - margin - size,
    y: corner < 2 ? margin : H - margin - size,
  });

  const images = ids.map((id, corner) => {
    const { x, y } = posFor(corner);
    const markerSvg = dictionary.generateSVG(id); // quiet zone(흰 테두리) 포함 10x10 viewBox
    const b64 = Buffer.from(markerSvg).toString('base64');
    return `<image id='aruco-corner-${corner}' x='${x.toFixed(2)}' y='${y.toFixed(2)}' width='${size.toFixed(2)}' height='${size.toFixed(2)}' href='data:image/svg+xml;base64,${b64}'/>`;
  });
  const group = `<g id='aruco-corners'>${images.join('')}</g>`;

  svg = svg.replace(/<g id='aruco-corners'>[\s\S]*?<\/g>/, ''); // 멱등 교체
  svg = svg.replace(/<\/svg>\s*$/, `${group}\n</svg>\n`);
  writeFileSync(file, svg);
  console.log(`OK floor-card-${key}.svg ← 마커 ${ids.join(',')} (${size.toFixed(1)}/${W} units)`);
}
