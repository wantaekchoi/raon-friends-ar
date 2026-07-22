// S12: 바닥 포스터(ArUco fiducial) 소환 성공 경로 — 사선 45°+이음새라는 "NFT가 교차 오인식하던
// 바로 그 조건"(라옹 포스터→라오나, 계측 2026-07-22)에서:
//   ① 포스터 모드 진입(body.dataset.posterMode) ② 화자 정체성 = 라옹(오인식 차단 = veto+ID 검증)
//   ③ 기립 안정(§posterDebug: upDot 범위·표본 흔들림) ④ 포즈가 화면 안(ndc)
// 마커 인식은 하네스 공용 브라우저의 fake 카메라로는 불가능해, 전용 y4m을 물린 자체 브라우저를 쓴다
// (S8의 markerMock과 달리 실제 검출·포즈 경로를 끝까지 태우는 시나리오다).
import puppeteer from 'puppeteer-core';
import { BASE_URL } from '../harness.mjs';
import { ensurePosterY4m } from '../assets/make-poster-y4m.mjs';

export const name = 'S12 포스터(fiducial) 소환 — 사선 오인식 조건에서 정체성·기립 고정';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const y4m = await ensurePosterY4m({ marked: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
      '--lang=ko-KR',
      '--accept-lang=ko-KR,ko',
    ],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const loc = m.location()?.url ?? '';
      // 하네스와 동일한 예외 1건 — 미배포 Vision 모델 HEAD 404 (harness.mjs 주석 참고)
      if (/models\/vision\/raon-mascot-classifier\.tflite/.test(loc)) return;
      errors.push(`console: ${m.text()} @ ${loc}`);
    });
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}?posterDebug=1`, { waitUntil: 'networkidle0' });
    const onboarding = await page.evaluate(() => {
      const el = document.getElementById('onboarding');
      return el && !el.hidden;
    });
    if (onboarding) await page.click('#btn-onboarding-start');
    await page.waitForFunction(() => !document.getElementById('btn-marker').disabled, { timeout: 10000 });
    await page.click('#btn-marker');

    // ① 포스터 모드 진입 (ArUco 3연속 게이트 + 씬 기동)
    await page.waitForFunction(() => document.body.dataset.posterMode === '1', { timeout: 25000 });

    // ② 화자 정체성 — 라옹 포스터이므로 반드시 라옹 (NFT였다면 이 조건에서 라오나로 오염)
    await page.waitForSelector('#bubble:not([hidden])', { timeout: 15000 });
    const speaker = await page.evaluate(() => document.getElementById('bubble-name').textContent);
    if (speaker !== '라옹') throw new Error(`포스터 화자 오염: ${speaker} (라옹이어야 함)`);

    // ③④ 기립·부착 안정 — 표본이 쌓이도록 잠시 관찰
    await sleep(3000);
    const s = await page.evaluate(() => window.__posterState);
    if (!s?.tracked) throw new Error('포스터 트래킹이 유지되지 않음');
    if (!(s.detections >= 1)) throw new Error(`마커 검출 0개 (detections=${s.detections})`);
    if (!(s.upDot > 0.5 && s.upDot < 0.999)) throw new Error(`기립 법선 이상 (upDot=${s.upDot})`);
    const spread = Math.max(...s.samples) - Math.min(...s.samples);
    if (!(spread < 0.05)) throw new Error(`기립이 흔들림 (upDot 표본 폭=${spread})`);
    if (!(Math.abs(s.ndc[0]) < 1 && Math.abs(s.ndc[1]) < 1)) {
      throw new Error(`포스터 중심이 화면 밖 (ndc=${s.ndc})`);
    }

    if (errors.length) throw new Error(`콘솔/페이지 에러 ${errors.length}건:\n${errors.join('\n')}`);
  } finally {
    await browser.close();
  }
}
