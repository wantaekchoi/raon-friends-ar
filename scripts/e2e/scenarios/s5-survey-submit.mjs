// S5: 설문 제출 — 구글폼 POST(docs.google.com)를 네트워크 인터셉트로 스텁해 실전송을 막는다.
// 차단 상태에선 submitAndRetry가 큐(localStorage 'pendingResponses')에 적재하고 #btn-retry를
// 보여준 채 대기 → 인터셉트를 허용으로 바꾼 뒤 재시도 클릭 → 완료(done) 화면까지 확인한다.
//
// 셀렉터·키는 브리프의 후보가 아니라 실제 소스 확인 결과로 확정했다:
// - survey.js는 문항을 한 번에 한 장(카드)씩만 렌더링한다(draw()) — 전체 패널을 한 번에
//   채우는 브리프 예시 코드는 실제 구조와 맞지 않아 문항별 루프로 다시 작성했다.
// - 객관식(choice)은 <input type="radio">가 아니라 data-choice 버튼(.survey-choice-btn)이다
//   (survey.js:141-149).
// - "다음"/"제출" 버튼은 항상 같은 클래스 .survey-next-btn 하나이며 type="submit"이 아니다
//   (survey.js:195, 231) — button[type="submit"]/.btn-submit 후보는 존재하지 않는다.
// - 오프라인 큐 localStorage 키는 'surveyQueue'가 아니라 'pendingResponses'다(queue.js:4).
// - 재시도 버튼은 CSS 클래스가 아니라 id="btn-retry"로 submitAndRetry가 그때그때 생성해
//   retryParent(설문 완료 경로에서는 #screen-ar)에 append한다(main.js submitAndRetry 함수,
//   startSurvey의 retryParent: document.getElementById('screen-ar')).
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S5 설문 전송 스텁 + 오프라인 큐';

// 현재 표시된 문항 카드 하나를 유효한 값으로 채우고 다음/제출을 누른다.
// 문항 종류는 브리프처럼 순서를 가정하지 않고 DOM에 실제로 렌더된 필드로 판별한다
// (survey.js renderField: consent/textarea/choice/rating/text 각각 고유 클래스를 가진다).
async function fillCurrentQuestion(page) {
  const type = await page.evaluate(() => {
    const field = document.querySelector('#survey-panel .survey-field');
    if (!field) return null;
    if (field.querySelector('.survey-consent-check')) return 'consent';
    if (field.querySelector('.survey-star-btn')) return 'rating';
    if (field.querySelector('.survey-choice-btn')) return 'choice';
    if (field.querySelector('.survey-textarea')) return 'textarea';
    if (field.querySelector('.survey-input')) return 'text';
    return null;
  });
  if (type === 'consent') {
    await page.click('#survey-panel .survey-consent-check');
  } else if (type === 'rating') {
    await page.click('#survey-panel .survey-star-btn[data-rating="5"]');
  } else if (type === 'choice') {
    await page.click('#survey-panel .survey-choice-btn');
  } else if (type === 'textarea') {
    await page.type('#survey-panel .survey-textarea', 'e2e 테스트 의견입니다');
  } else if (type === 'text') {
    await page.type('#survey-panel .survey-input', 'e2e');
  } else {
    throw new Error('설문 문항 타입을 식별하지 못함');
  }
  await page.click('#survey-panel .survey-next-btn');
}

// 설문 전체(7문항: 동의·별점·객관식·의견·성함·소속·연락처)를 순서와 무관하게
// 패널이 숨겨질 때까지(=onComplete 호출로 제출 완료) 반복해서 채운다.
async function fillSurveyAndSubmit(page) {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const hidden = await page.evaluate(() => document.getElementById('survey-panel').hidden);
    if (hidden) return;
    // eslint-disable-next-line no-await-in-loop
    await fillCurrentQuestion(page);
  }
  throw new Error('설문 문항 루프가 10회 안에 끝나지 않음(무한 루프 의심)');
}

export async function run() {
  await withPage(async (page, ctx) => {
    // 인터셉트는 fn(page) 진입 직후, 이후의 모든 상호작용보다 먼저 켠다 — withPage의 초기
    // page.goto는 이미 끝난 뒤이므로(설문 제출 전까지 docs.google.com 요청이 발생할 여지가
    // 없어 안전) 실전송 위험 없이 이 시점에 켜도 된다.
    let blocked = true;
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('docs.google.com')) {
        if (blocked) { req.abort('internetdisconnected'); return; }
        req.respond({ status: 200, contentType: 'text/plain', body: '' });
        return;
      }
      req.continue();
    });

    await dismissOnboarding(page);
    await page.click('#btn-overlay');

    // 릴레이 가이드 5줄을 지나 설문 화면까지 (s1-overlay-flow.mjs와 동일 패턴 —
    // 캐릭터 fbx 로딩이 readBubble 기본 settleMs를 넘길 수 있어 btn-next 활성화를 별도로 기다린다)
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const b = await readBubble(page, { settleMs: 1800 });
      if (b.screen !== 'guide') break;
      // eslint-disable-next-line no-await-in-loop
      const canNext = await page
        .waitForFunction(() => {
          const btn = document.getElementById('btn-next');
          return btn && !btn.hidden && !btn.disabled;
        }, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!canNext) throw new Error(`가이드 ${i}번째에서 다음 버튼 비활성`);
      // eslint-disable-next-line no-await-in-loop
      await page.click('#btn-next');
    }
    await page.waitForSelector('#survey-panel:not([hidden])', { timeout: 15000 });

    await fillSurveyAndSubmit(page);

    // 차단 상태: submitAndRetry가 실패 즉시 큐(localStorage 'pendingResponses')에 응답을 남기고
    // #btn-retry를 노출한다(main.js submitAndRetry).
    await page.waitForSelector('#btn-retry', { timeout: 15000 });
    const queued = await page.evaluate(() => (localStorage.getItem('pendingResponses') ?? '[]') !== '[]');
    if (!queued) throw new Error('오프라인 큐(pendingResponses) 미적재');

    // 하네스의 암묵적 단언은 "콘솔/페이지 에러 0건"이지만(favicon.ico 404만 예외), 이 시나리오는
    // req.abort('internetdisconnected')로 오프라인을 의도적으로 재현한다 — 그 결과 브라우저가 직접
    // 찍는 진단성 콘솔 에러(net::ERR_INTERNET_DISCONNECTED, submitSurvey의 1회 재시도만큼 최대 2건)는
    // 버그가 아니라 이 시나리오가 검증하려는 차단 상태 그 자체다. favicon.ico 예외와 동일한 원리로
    // 정확히 이 메시지만 걸러내고, 그 외 어떤 에러도 그대로 실패로 남긴다(harness.mjs는 이 태스크의
    // 수정 대상이 아니라 시나리오 파일 안에서 걸러낸다).
    for (let i = ctx.errors.length - 1; i >= 0; i -= 1) {
      if (ctx.errors[i].includes('ERR_INTERNET_DISCONNECTED')) ctx.errors.splice(i, 1);
    }

    blocked = false;
    await page.click('#btn-retry');

    const done = await readBubble(page, { settleMs: 3000 });
    if (done.screen !== 'done') throw new Error(`완료 화면 아님: ${done.screen}`);
    const stillQueued = await page.evaluate(() => (localStorage.getItem('pendingResponses') ?? '[]') !== '[]');
    if (stillQueued) throw new Error('재시도 성공 후에도 큐가 비지 않음');
  });
}
