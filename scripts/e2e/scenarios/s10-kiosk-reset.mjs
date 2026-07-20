// S10: 키오스크 자동 리셋 — ?kiosk=1 상태에서 리셋이 무장(arm)된 뒤 idleResetSec(timerScale로
// 압축)만큼 무입력이 이어지면 main.js의 kioskTimer가 실제로 location.reload()를 일으켜 처음
// 화면으로 돌아오는지 확인한다.
//
// armKioskReset() 호출부는 main.js에 여러 곳(에러 화면 진입, 비-AR 직행 설문 완료/실패, AR 설문
// 완료/실패)이 있는데, 그중 showErrorScreen()이 에러 발생 즉시 무조건 armKioskReset()을 호출한다
// (main.js:41) — 전체 릴레이+설문을 완주해야 도달하는 다른 경로들보다 훨씬 적은 단계로 "무장" 상태에
// 이를 수 있다. S9과 동일한 방식(setTimeout 안에서 미처리 예외를 던져 전역 에러 가드를 트리거)으로
// 에러 화면에 도달한 뒤, 실제 자동 리로드를 기다린다.
//
// timerScale=0.1(30s→3s)은 S4(카드 미인식 폴백)에서 이미 안정적으로 쓰이는 값과 동일하게
// 맞춰 CI 환경에서의 타이밍 여유를 확보했다.
//
// 에러 주입은 S9과 동일하게 page.addScriptTag()로 실제 <script> 엘리먼트를 문서에 추가한다 —
// page.evaluate()로 직접 실행하면 Chrome이 origin 불명 스크립트로 취급해 window.onerror에
// 실제 메시지 대신 "Script error."만 전달해(muted errors) allowErrors 패턴이 못 잡는다(S9에서 실측).
import { withPage } from '../harness.mjs';

export const name = 'S10 키오스크 자동 리셋';

const INJECTED_MESSAGE = 'e2e-injected';

export async function run() {
  await withPage(async (page) => {
    await page.addScriptTag({
      content: `setTimeout(() => { throw new Error(${JSON.stringify(INJECTED_MESSAGE)}); }, 0);`,
    });

    await page.waitForSelector('#error-screen:not([hidden])', { timeout: 15000 });

    // 에러 화면 도달 = armKioskReset() 호출 시점. 이후 무입력 상태로 idleResetSec(×timerScale)만큼
    // 지나면 kioskTimer가 만료돼 location.reload()가 자동으로 일어나야 한다 — waitForSelector가
    // 막 resolve한 직후라 리로드까지는 아직 ~3초가 남아 있어, 이 시점에 waitForNavigation을
    // 걸어도 이미 지나간 내비게이션을 놓칠 위험은 없다.
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 });

    const after = await page.evaluate(() => ({
      screen: document.body.dataset.screen,
      errorHidden: document.getElementById('error-screen').hidden,
      kiosk: new URL(location.href).searchParams.get('kiosk'),
    }));
    if (after.screen !== 'start') throw new Error(`자동 리셋 후 처음 화면 아님: ${after.screen}`);
    if (!after.errorHidden) throw new Error('자동 리셋 후에도 에러 화면 노출');
    if (after.kiosk !== '1') throw new Error(`리로드 후 kiosk 파라미터 유실: ${after.kiosk}`);
  }, { params: '?kiosk=1&timerScale=0.1', allowErrors: [new RegExp(INJECTED_MESSAGE)] });
}
