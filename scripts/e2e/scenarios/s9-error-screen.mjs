// S9: 전역 에러 가드 — 미처리 예외가 발생하면 #error-screen이 뜨고, 문구·[다시 시작] 버튼·
// 구글폼 폴백 링크가 노출되며, [다시 시작] 클릭 시 처음 화면으로 복귀하는지 확인한다.
//
// main.js의 전역 가드(window.addEventListener('error'|'unhandledrejection') → showErrorScreen)는
// 이전까지 어떤 시나리오도 검증하지 않았다. 하네스는 "콘솔/페이지 에러 0건"을 모든 시나리오의
// 암묵 단언으로 강제하므로(harness.mjs withPage), 이 화면 자체를 트리거하려면 그 원칙과 정면으로
// 충돌한다 — 원칙을 훼손하는 대신 withPage의 allowErrors 옵션으로 "정확히 이 시나리오가 주입한
// 에러 문자열"만 좁게 허용한다. 이 옵션은 기본값이 없어(=undefined) 다른 모든 시나리오는 기존
// 동작(에러 0건)을 그대로 유지한다.
//
// 에러 주입 방법: setTimeout 콜백 안에서 던지면 evaluate 자체는 즉시 resolve하고(콜백은 나중에
// 마이크로/매크로태스크로 실행), 그 예외는 Promise 체인 밖이라 unhandledrejection이 아니라
// window의 'error' 이벤트(→ pageerror)로 잡힌다 — main.js의 두 가드 중 'error' 경로를 검증한다.
// page.evaluate()로 직접 실행한 함수 안에서 던지면 Chrome이 그 예외를 "출처 불명 스크립트"로 취급해
// window.onerror에 실제 메시지 대신 뭉개진 "Script error."만 전달한다(Runtime.evaluate로 주입된
// 코드가 문서 origin과 매칭되지 않아 muted errors 규칙이 적용됨 — 실측으로 확인). 그러면 main.js가
// console.error로 찍는 진단 로그에도 'e2e-injected'가 안 남아 allowErrors 패턴이 못 잡는다.
// page.addScriptTag()로 실제 <script> 엘리먼트를 문서에 추가하면 같은 origin의 인라인 스크립트로
// 취급돼 뭉개지지 않고 진짜 메시지가 전달된다 — 그 방식을 쓴다.
import { withPage } from '../harness.mjs';

export const name = 'S9 전역 에러 화면';

const INJECTED_MESSAGE = 'e2e-injected';

export async function run() {
  await withPage(async (page) => {
    await page.addScriptTag({
      content: `setTimeout(() => { throw new Error(${JSON.stringify(INJECTED_MESSAGE)}); }, 0);`,
    });

    await page.waitForSelector('#error-screen:not([hidden])', { timeout: 15000 });

    const state = await page.evaluate(() => {
      const link = document.querySelector('#error-screen .google-form-link');
      return {
        message: document.getElementById('error-message').textContent,
        restartLabel: document.getElementById('btn-error-restart').textContent,
        restartHidden: document.getElementById('btn-error-restart').hidden,
        formLinkHidden: link ? link.hidden : true,
        formLinkHref: link ? link.href : '',
      };
    });
    if (!state.message.includes('넘어졌')) throw new Error(`에러 화면 문구 이상: ${state.message}`);
    if (state.restartHidden || !state.restartLabel) throw new Error('[다시 시작] 버튼 미노출');
    if (state.formLinkHidden || !state.formLinkHref) throw new Error('구글폼 폴백 링크 미노출');

    // [다시 시작] → location.reload() → 처음 화면으로 복귀.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('#btn-error-restart'),
    ]);
    const after = await page.evaluate(() => ({
      screen: document.body.dataset.screen,
      errorHidden: document.getElementById('error-screen').hidden,
    }));
    if (after.screen !== 'start') throw new Error(`다시 시작 후 처음 화면 아님: ${after.screen}`);
    if (!after.errorHidden) throw new Error('다시 시작 후에도 에러 화면 노출');
  }, { allowErrors: [new RegExp(INJECTED_MESSAGE)] });
}
