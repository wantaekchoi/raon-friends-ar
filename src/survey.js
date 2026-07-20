// 설문 UI 렌더링 + 구글 폼(formResponse) 전송 모듈.
// 설계서 7장 참조: entry ID 매핑 → URLSearchParams → no-cors POST.
//
// F1 다국어: 이 모듈의 함수들은 lang을 인자로 명시적으로 받는다(기본값 'ko', 자동감지 아님) —
// jsdom 테스트 환경의 navigator.language가 'en-US'라서 t()의 자동 currentLang()에 의존하면
// 기존 한국어 테스트가 깨진다. 실제 런타임(main.js)은 currentLang()으로 판별한 lang을 넘긴다.
import { t } from './i18n.js';

function isEmptyValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * answers 객체를 구글 폼 entry ID 매핑으로 변환해 URLSearchParams 문자열을 만든다.
 * 빈 값(미응답 선택 문항)은 제외한다.
 */
export function buildFormBody(entries, answers, otherOptionValues = {}) {
  const params = new URLSearchParams();
  Object.entries(entries).forEach(([key, entryId]) => {
    const value = answers[key];
    if (isEmptyValue(value)) return;
    const text = String(value).trim();
    // 구글 폼의 "기타" 자유입력 옵션은 __other_option__ + .other_option_response 쌍으로 보내야 기록된다.
    if ((otherOptionValues[key] ?? []).includes(text)) {
      params.set(entryId, '__other_option__');
      params.set(`${entryId}.other_option_response`, text);
      return;
    }
    params.set(entryId, text);
  });
  return params.toString();
}

/**
 * 문항 하나에 대한 응답값을 검증한다.
 * 반환: { valid: boolean, message: string|null }
 */
export function validateAnswer(question, value, lang = 'ko') {
  const { type, required } = question;
  const empty = isEmptyValue(value);

  if (type === 'consent') {
    return empty
      ? { valid: false, message: t('survey.validation.consentRequired', lang) }
      : { valid: true, message: null };
  }

  if (type === 'rating') {
    if (empty) {
      return required
        ? { valid: false, message: t('survey.validation.ratingRequired', lang) }
        : { valid: true, message: null };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return { valid: false, message: t('survey.validation.ratingRange', lang) };
    }
    return { valid: true, message: null };
  }

  if (required && empty) {
    return { valid: false, message: t('survey.validation.required', lang) };
  }
  return { valid: true, message: null };
}

/**
 * 구글 폼 formResponse 엔드포인트로 응답을 전송한다.
 * config.formId가 'REPLACE_ME'면(아직 폼 미연결) 전송을 생략한다.
 * no-cors 특성상 응답 본문을 읽을 수 없어 성공 여부는 예외 발생 여부로만 판단하며, 실패 시 1회 재시도한다.
 */
export async function submitSurvey(config, answers, fetchFn = fetch) {
  const { formId, entries, otherOptionValues } = config;
  if (!formId || formId === 'REPLACE_ME') {
    return { ok: true, skipped: true };
  }

  const url = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
  const body = buildFormBody(entries, answers, otherOptionValues ?? {});
  const attempt = () => fetchFn(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  try {
    await attempt();
    return { ok: true, skipped: false };
  } catch (err) {
    try {
      await attempt();
      return { ok: true, skipped: false, retried: true };
    } catch (err2) {
      return { ok: false, skipped: false, error: err2 };
    }
  }
}

function renderProgress(index, total) {
  const pct = Math.round(((index + 1) / total) * 100);
  return `
    <div class="survey-progress">
      <div class="survey-progress-bar"><div class="survey-progress-fill" style="width:${pct}%"></div></div>
      <span class="survey-progress-label">${index + 1} / ${total}</span>
    </div>
  `;
}

// 사용자 입력이 innerHTML로 다시 렌더링될 때를 대비한 이스케이프 (self-XSS 방어)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// 객관식 옵션은 문자열(표시=전송값) 또는 { label, value } 객체(표시≠전송값 — 영어 UI에서
// 구글 폼의 한국어 원문 옵션으로 전송해야 할 때)를 허용한다.
function normalizeOption(opt) {
  return typeof opt === 'string' ? { label: opt, value: opt } : opt;
}

function renderField(question, value, lang = 'ko') {
  const { type, options } = question;
  if (type === 'consent') {
    const checked = !isEmptyValue(value);
    return `
      <ul class="survey-consent-notice">
        ${question.notice.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
      <label class="survey-consent-agree">
        <input type="checkbox" class="survey-consent-check" ${checked ? 'checked' : ''} />
        <span>${escapeHtml(question.agreeText)}</span>
      </label>
    `;
  }
  if (type === 'textarea') {
    const placeholder = escapeHtml(t('survey.placeholder.textarea', lang));
    return `<textarea class="survey-input survey-textarea" rows="4" placeholder="${placeholder}">${escapeHtml(value ?? '')}</textarea>`;
  }
  if (type === 'choice') {
    return `
      <div class="survey-choices">
        ${options.map(normalizeOption).map((opt) => `
          <button type="button" class="survey-choice-btn${value === opt.value ? ' selected' : ''}" data-choice="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>
        `).join('')}
      </div>
    `;
  }
  if (type === 'rating') {
    const n = Number(value) || 0;
    return `
      <div class="survey-stars">
        ${[1, 2, 3, 4, 5].map((i) => `
          <button type="button" class="survey-star-btn${i <= n ? ' filled' : ''}" data-rating="${i}" aria-label="${t('survey.ratingAriaLabel', lang, { n: i })}">★</button>
        `).join('')}
      </div>
    `;
  }
  const placeholder = escapeHtml(t('survey.placeholder.text', lang));
  return `<input type="text" class="survey-input" value="${escapeHtml(value ?? '')}" placeholder="${placeholder}" />`;
}

/**
 * container에 설문을 문항 1개씩 카드 형태로 렌더링한다.
 * 완료 시 onComplete(answers)를 호출한다.
 * onAnswer(key, value)는 문항이 확정(유효성 검증 통과)될 때마다 호출된다 — 리액션 모션 트리거용(선택 인자, 기본 no-op).
 */
export function renderSurvey(container, questions, onComplete, { onAnswer = () => {}, lang = 'ko' } = {}) {
  const answers = {};
  let index = 0;

  function currentValue(question) {
    return answers[question.key];
  }

  function readFieldValue(question, root) {
    const { type } = question;
    if (type === 'textarea') return root.querySelector('.survey-textarea').value;
    if (type === 'text') return root.querySelector('.survey-input').value;
    // choice/rating은 클릭 시 즉시 answers에 반영되므로 저장된 값을 그대로 사용
    return answers[question.key];
  }

  function draw(direction = 'in') {
    const question = questions[index];
    const isLast = index === questions.length - 1;

    container.innerHTML = `
      ${renderProgress(index, questions.length)}
      <div class="survey-card survey-slide-${direction}">
        <p class="survey-question">${question.label}</p>
        <div class="survey-field">${renderField(question, currentValue(question), lang)}</div>
        <p class="survey-error" hidden aria-live="polite"></p>
        <button type="button" class="survey-next-btn">${isLast ? t('survey.btnSubmit', lang) : t('survey.btnNext', lang)}</button>
      </div>
    `;

    const card = container.querySelector('.survey-card');
    const errorEl = container.querySelector('.survey-error');

    if (question.type === 'choice') {
      card.querySelectorAll('.survey-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[question.key] = btn.dataset.choice;
          card.querySelectorAll('.survey-choice-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    }

    if (question.type === 'consent') {
      card.querySelector('.survey-consent-check').addEventListener('change', (e) => {
        // 표시 언어와 무관하게 구글 폼 옵션 원문(submitValue)으로 기록한다
        answers[question.key] = e.target.checked ? (question.submitValue ?? question.agreeText) : '';
      });
    }

    if (question.type === 'rating') {
      card.querySelectorAll('.survey-star-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rating = Number(btn.dataset.rating);
          answers[question.key] = rating;
          card.querySelectorAll('.survey-star-btn').forEach((b) => {
            b.classList.toggle('filled', Number(b.dataset.rating) <= rating);
          });
        });
      });
    }

    card.querySelector('.survey-next-btn').addEventListener('click', () => {
      const value = readFieldValue(question, card);
      answers[question.key] = value;

      const { valid, message } = validateAnswer(question, value, lang);
      if (!valid) {
        errorEl.textContent = message;
        errorEl.hidden = false;
        card.classList.remove('survey-shake');
        // eslint-disable-next-line no-void
        void card.offsetWidth; // 리플로우 강제로 애니메이션 재시작
        card.classList.add('survey-shake');
        return;
      }

      onAnswer(question.key, value);

      if (isLast) {
        onComplete({ ...answers });
        return;
      }
      index += 1;
      draw('in');
    });
  }

  draw('in');
}
