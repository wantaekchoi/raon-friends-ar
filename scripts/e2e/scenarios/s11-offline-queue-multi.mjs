// S11: 오프라인 큐 다건 누적 + 리로드 후 자동 플러시.
//
// S5는 "1건 실패 → 같은 세션에서 재시도 버튼 클릭 → 성공"만 검증한다. 실제 행사 부스에서는
// 방문객 A가 오프라인 상태로 완주(1건 적재) → 다음 방문객 B를 위해 페이지가 리로드(무인 부스
// 자동 리셋이든 수동이든) → B도 오프라인 상태로 완주(2건 누적) → 네트워크가 복구된 뒤 앱이 다시
// 로드되는 시점에 큐가 실제로 비워지는지가 관건이다. 이 시나리오는 그 다건 누적·리로드 경계를
// 지나는 경로를 검증한다.
//
// 코드 확인 결과(main.js:127, queue.js): 자동 플러시 트리거는 "앱 부팅 시점(모듈 최상단
// flush() 1회 호출)" 하나뿐이다 — `online` 이벤트 리스너나 주기적 재시도는 없다. 즉 네트워크가
// 복구돼도 페이지를 다시 로드(reload)하기 전까지는 큐가 자동으로 비워지지 않는다. 이는 버그가
// 아니라 "리로드 = 다음 방문객"이라는 기존 설계(D2, 키오스크 리셋과 자연히 맞물림)의 특성이므로
// 이 시나리오는 고치지 않고 "리로드 후에는 정상적으로 비워진다"는 것만 확정 검증한다(네트워크
// 복구 후 리로드 없이 자동으로 비워지는지는 별도로 확인하지 않는다 — 그런 트리거가 없다는 것을
// 이미 코드로 확인했으므로 존재하지 않는 동작을 시나리오로 강제하지 않는다).
import { withPage, dismissOnboarding, readBubble } from '../harness.mjs';

export const name = 'S11 오프라인 큐 다건 누적 + 리로드 후 자동 플러시';

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

// 온보딩 닫기 → 오버레이 진입 → 릴레이 5줄 통과 → 설문 완주(제출 시도까지). 완주 후 큐 상태는
// 호출부가 확인한다(적재 성공/실패는 그 시점의 네트워크 차단 여부에 달려 있다).
async function completeOneVisit(page) {
  await dismissOnboarding(page);
  await page.click('#btn-overlay');
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
}

function queueLength(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('pendingResponses');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : -1;
    } catch {
      return -1;
    }
  });
}

export async function run() {
  await withPage(async (page, ctx) => {
    // request interception은 page 단위로 유지되며 이후의 모든 reload()에도 그대로 적용된다.
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

    // ① 오프라인 상태로 방문객 A 완주 — 큐에 1건 적재.
    await completeOneVisit(page);
    await page.waitForSelector('#btn-retry', { timeout: 15000 });
    let count = await queueLength(page);
    if (count !== 1) throw new Error(`1번째 방문 후 큐 길이 ${count} (기대: 1)`);

    // ② 페이지 리로드(=다음 방문객이 부스 태블릿을 새로 켠 상황) — 여전히 오프라인이므로
    // 부팅 시 자동 flush()는 시도되지만 실패하고 조용히 흡수된다(main.js catch(()=>{})). 큐는
    // 그대로 1건이어야 한다 — 리로드만으로 큐가 유실되지 않는지도 이 지점에서 함께 확인된다.
    await page.reload({ waitUntil: 'networkidle0' });
    count = await queueLength(page);
    if (count !== 1) throw new Error(`리로드 직후(여전히 오프라인) 큐 길이 ${count} (기대: 1, 유실 또는 오적재 의심)`);

    // 방문객 B 완주 — 큐가 2건으로 누적돼야 한다(1번째 항목이 지워지거나 덮어써지지 않는지 확인).
    await completeOneVisit(page);
    await page.waitForSelector('#btn-retry', { timeout: 15000 });
    count = await queueLength(page);
    if (count !== 2) throw new Error(`2번째 방문 후 큐 길이 ${count} (기대: 2, 다건 누적 실패)`);

    // 이 시나리오는 req.abort('internetdisconnected')로 오프라인을 의도적으로 재현한다 —
    // 그 결과 브라우저가 직접 찍는 진단성 콘솔 에러(ERR_INTERNET_DISCONNECTED)는 버그가 아니라
    // 이 시나리오가 검증하려는 차단 상태 그 자체다(S5와 동일 원리로 이 메시지만 걸러낸다).
    for (let i = ctx.errors.length - 1; i >= 0; i -= 1) {
      if (ctx.errors[i].includes('ERR_INTERNET_DISCONNECTED')) ctx.errors.splice(i, 1);
    }

    // ③ 네트워크 복구 + 리로드(=네트워크가 살아난 뒤 다음 방문객이 켠 상황) — 부팅 시 자동
    // flush()가 이번엔 성공해 큐 2건이 전부 비워져야 한다. 리로드 없이 네트워크만 복구했을 때
    // 자동으로 비워지는 트리거는 코드에 없다(위 파일 상단 주석 참고) — 그래서 이 시나리오는
    // 그 경우를 테스트하지 않는다(존재하지 않는 동작을 강제하면 항상 빨간 시나리오가 된다).
    blocked = false;
    await page.reload({ waitUntil: 'networkidle0' });
    // 부팅 flush()는 비동기이고 완료를 기다리는 별도 신호가 없어, 큐가 비워질 때까지 폴링한다.
    await page.waitForFunction(() => {
      try {
        const raw = localStorage.getItem('pendingResponses');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) && parsed.length === 0;
      } catch {
        return false;
      }
    }, { timeout: 15000 });
    count = await queueLength(page);
    if (count !== 0) throw new Error(`네트워크 복구 후 리로드했는데도 큐 길이 ${count} (기대: 0)`);

    await ctx.shot('s11-queue-flushed');
  });
}
