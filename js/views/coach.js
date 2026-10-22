// Peças que levam o objetivo para o dia a dia (Início e Revisão da semana): o painel do objetivo, o convite
// para a revisão semanal e a "pergunta para fixar" (repetição espaçada dos quizzes, js/recall.js).
import { state, saveRecallAnswer } from '../store.js';
import { esc } from '../utils.js';
import { objectivePanel, reviewStreak, reviewedThisWeek } from '../objective.js';
import { dueQuestions } from '../recall.js';
import { goalTrack } from '../lessons.js';
import { icon } from '../icons.js';

const weeks = (n) => `${n} ${n === 1 ? 'semana seguida' : 'semanas seguidas'}`;

/** Painel do objetivo. `review: true` acrescenta a linha da revisão da semana (feita ou convite). */
export function objectiveBlock({ review = true, headingId = 'obj-title' } = {}) {
  const p = objectivePanel(state);
  const done = reviewedThisWeek(state.progress.reviews);
  const streak = reviewStreak(state.progress.reviews);
  return `<section class="block objective" aria-labelledby="${headingId}">
    <div class="block-head">
      <h2 id="${headingId}"><span class="muted goal-kicker">Seu objetivo</span><span aria-hidden="true">${p.icon}</span> ${esc(p.label)}</h2>
    </div>
    <p class="obj-headline">${esc(p.headline)}</p>
    ${p.ratio != null ? `<div class="meter" role="progressbar" aria-label="Progresso do objetivo" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${Math.round(Math.min(1, p.ratio) * 100)}"><span style="width:${(Math.min(1, p.ratio) * 100).toFixed(1)}%"></span></div>` : ''}
    ${p.detail ? `<p class="obj-detail">${esc(p.detail)}</p>` : ''}
    ${p.steps ? `<ol class="obj-steps">${p.steps.map((s) => `<li class="${s.done ? 'is-done' : ''}">
        <span class="obj-check" aria-hidden="true">${s.done ? icon('check', { size: 14 }) : ''}</span>
        <span>${esc(s.label)}<span class="sr-only">${s.done ? ' (feito)' : ' (a fazer)'}</span></span></li>`).join('')}</ol>` : ''}
    ${p.next ? `<a class="btn primary small" href="${p.next.href}">${esc(p.next.label)}</a>` : ''}
    ${review ? (done
    ? `<p class="obj-review is-done">${icon('check', { size: 16 })} Revisão da semana feita${streak > 1 ? `: ${weeks(streak)}` : ''}.</p>`
    : `<a class="obj-review" href="#/revisao">${icon('calendar', { size: 18 })}<span><strong>Revisão da semana</strong>
        <span class="muted">2 minutos para fechar a semana${streak ? ` (${weeks(streak)} até agora)` : ''}</span></span>${icon('right', { size: 18 })}</a>`) : ''}
  </section>`;
}

/** Perguntas vencidas, na ordem da trilha do objetivo. */
export const dueRecall = (limit = 1) => dueQuestions(state.progress, goalTrack(state.settings.goal).order, undefined, limit);

/** Cartão(ões) de pergunta para fixar. Vazio se não houver pergunta vencida. */
export function recallCards(items, { title = 'Pergunta para fixar', headingId = 'recall-title' } = {}) {
  if (!items.length) return '';
  return `<section class="block recall" aria-labelledby="${headingId}">
    <div class="block-head"><h2 id="${headingId}">${esc(title)}</h2></div>
    ${items.map((it) => `<form class="recall-q" data-recall="${esc(it.key)}" novalidate>
      <fieldset>
        <legend><span class="muted recall-from">${it.lesson.icon} ${esc(it.lesson.title)}</span>${esc(it.q.q)}</legend>
        ${it.q.options.map((o, oi) => `<label class="quiz-opt"><input type="radio" name="a" value="${oi}"><span>${esc(o)}</span></label>`).join('')}
      </fieldset>
      <p class="quiz-feedback" role="status" hidden></p>
      <div class="actions left"><button type="submit" class="btn ghost small">Responder</button></div>
    </form>`).join('')}
  </section>`;
}

/** Liga os cartões: confere, mostra a explicação e agenda a próxima volta da pergunta. */
export function mountRecall(root, items) {
  for (const it of items) {
    const form = root.querySelector(`[data-recall="${CSS.escape(it.key)}"]`);
    if (!form) continue;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const chosen = form.querySelector('input[name="a"]:checked');
      const fb = form.querySelector('.quiz-feedback');
      if (!chosen) { fb.textContent = 'Escolha uma resposta.'; fb.hidden = false; return; }
      const ok = Number(chosen.value) === it.q.answer;
      form.querySelectorAll('.quiz-opt').forEach((opt, oi) => opt.classList.toggle('is-answer', oi === it.q.answer));
      form.classList.toggle('is-wrong', !ok);
      form.querySelectorAll('input').forEach((i) => { i.disabled = true; });
      form.querySelector('button[type="submit"]').hidden = true;
      fb.innerHTML = `<strong>${ok ? 'Certo!' : `Resposta: ${esc(it.q.options[it.q.answer])}.`}</strong> ${esc(it.q.explain)}
        <span class="muted">${ok ? 'Ela volta daqui a alguns dias para fixar.' : 'Ela volta amanhã.'}</span>`;
      fb.hidden = false;
      await saveRecallAnswer(it.key, ok);
    });
  }
}
