// S13(음성통제): 마커 "없는" 구판 포스터에서는 포스터 모드가 절대 켜지지 않아야 한다 —
// ArUco 게이트(3연속·ID 규약)가 없는 입력에 반응하면 오검출이다. S12와 같은 사선 조건에서
// 마커 그룹만 제거한 y4m을 쓴다. (이 입력에서 NFT가 무엇을 하든 — 폴백이든 오인식 소환이든 —
// 이 시나리오의 관심사가 아니다. 단언은 오직 posterMode 부재.)
import puppeteer from 'puppeteer-core';
import { BASE_URL } from '../harness.mjs';
import { ensurePosterY4m } from '../assets/make-poster-y4m.mjs';

export const name = 'S13 포스터 음성통제 — 마커 없는 포스터는 포스터 모드 미진입';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const y4m = await ensurePosterY4m({ marked: false });
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
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    const onboarding = await page.evaluate(() => {
      const el = document.getElementById('onboarding');
      return el && !el.hidden;
    });
    if (onboarding) await page.click('#btn-onboarding-start');
    await page.waitForFunction(() => !document.getElementById('btn-marker').disabled, { timeout: 10000 });
    await page.click('#btn-marker');

    // ArUco 게이트가 반응할 시간(3연속 = 450ms + 여유)을 충분히 준 뒤에도 posterMode가 없어야 한다
    for (let i = 0; i < 10; i += 1) {
      await sleep(800);
      const posterMode = await page.evaluate(() => document.body.dataset.posterMode ?? null);
      if (posterMode !== null) throw new Error('마커 없는 포스터인데 포스터 모드 진입(오검출)');
    }
  } finally {
    await browser.close();
  }
}
