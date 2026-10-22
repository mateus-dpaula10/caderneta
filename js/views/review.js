// Revisão da semana (#/revisao): 2 minutos guiados para lançar o que faltou, conferir as contas a pagar,
// ver o objetivo e responder perguntas de lições já feitas. É o hábito para onde os lembretes apontam.
import { state, completeReview, setTransactionPaid, categoryById } from '../store.js';
import { toast } from '../ui.js';
import { addDays, esc, fmtBRL, fmtDate, todayISO } from '../utils.js';
import { payStatus } from '../finance.js';
import { reviewStreak, reviewedThisWeek, weekStart } from '../objective.js';
import { nextLessonFor } from '../lessons.js';
import { objectiveBlock, dueRecall, recallCards, mountRecall } from './coach.js';
import { openReminders } from './reminders.js';
import { icon } from '../icons.js';

let recallItems = [];

function weekStats(today) {
  const from = weekStart(today);
  const txs = state.transactions.filter((t) => t.date >= from && t.date <= today);
  return { from, count: txs.length, expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) };
}

/** Despesas a pagar atrasadas ou vencendo nos próximos 7 dias, as mais antigas primeiro. */
function billsSoon(today) {
  const limit = addDays(today, 7);
  return state.transactions
    .filter((t) => t.type === 'expense' && t.date <= limit && payStatus(t, today) !== 'paid')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
}

export function render() {
  const today = todayISO();
  const w = weekStats(today);
  const bills = billsSoon(today);
  const done = reviewedThisWeek(state.progress.reviews, today);
  const streak = reviewStreak(state.progress.reviews, today);
  recallItems = dueRecall(2);
  const lesson = nextLessonFor(state.settings.goal, state.progress);

  return `<nav class="crumbs" aria-label="Você está em"><a href="#/inicio">${icon('left', { size: 18 })} Início</a></nav>
  <header class="page-head"><div><h1 class="page-title">Revisão da semana</h1>
    <p class="page-sub">Uns 2 minutos. Semana de ${fmtDate(w.from)} até hoje.${streak ? ` ${streak} ${streak === 1 ? 'semana seguida' : 'semanas seguidas'} com revisão.` : ''}</p></div></header>

  <section class="block review-step" aria-labelledby="rv-1">
    <div class="block-head"><h2 id="rv-1"><span class="step-n" aria-hidden="true">1</span> O que faltou lançar?</h2></div>
    <p>${w.count ? `Nesta semana você registrou <strong>${w.count} ${w.count === 1 ? 'lançamento' : 'lançamentos'}</strong>${w.expense ? `, ${fmtBRL(w.expense)} em despesas` : ''}.` : 'Nenhum lançamento nesta semana ainda.'}
      Pense no Pix, no cartão e nos gastos pequenos que ficaram para trás.</p>
    <div class="actions left">
      <button type="button" class="btn ghost small" data-new-tx="expense">${icon('plus', { size: 16 })} Despesa</button>
      <button type="button" class="btn ghost small" data-new-tx="income">${icon('plus', { size: 16 })} Receita</button>
    </div>
  </section>

  <section class="block review-step" aria-labelledby="rv-2">
    <div class="block-head"><h2 id="rv-2"><span class="step-n" aria-hidden="true">2</span> Contas a pagar</h2></div>
    ${bills.length ? `<p class="muted">Atrasadas e as que vencem nos próximos 7 dias. Já pagou? Marque aqui.</p>
      <ul class="bill-list">${bills.map((t) => {
    const late = payStatus(t, today) === 'late';
    return `<li><span class="bill-main"><span class="bill-desc">${esc(t.description || categoryById(t.categoryId)?.name || 'Conta')}</span>
          <span class="muted">${late ? `<span class="tag tag-late">Atrasada</span> ` : ''}${t.date === today ? 'vence hoje' : `${late ? 'venceu' : 'vence'} ${fmtDate(t.date)}`}</span></span>
          <span class="bill-amount">${fmtBRL(t.amount)}</span>
          <button type="button" class="btn ghost small" data-paid="${esc(t.id)}">Paguei</button></li>`;
  }).join('')}</ul>`
    : `<p>${icon('check', { size: 16 })} Nada atrasado nem vencendo nos próximos 7 dias.</p>`}
  </section>

  <div class="review-step">${objectiveBlock({ review: false, headingId: 'rv-3' })}</div>

  ${recallItems.length ? recallCards(recallItems, { title: 'Perguntas para fixar', headingId: 'rv-4' })
    : `<section class="block review-step" aria-labelledby="rv-4"><div class="block-head"><h2 id="rv-4">Para aprender</h2></div>
      ${lesson ? `<p>Nenhuma pergunta para revisar agora. Que tal a próxima lição da sua trilha?</p>
        <a class="lesson-card" href="#/aprender/${lesson.id}"><span class="lesson-emoji" aria-hidden="true">${lesson.icon}</span>
          <span><span class="lesson-card-title">${esc(lesson.title)}</span><span class="muted">${lesson.minutes} min</span></span></a>`
    : '<p>Você concluiu a trilha inteira. As perguntas das lições voltam aqui de tempos em tempos.</p>'}</section>`}

  <section class="review-done" aria-live="polite">
    ${done ? `<p class="obj-review is-done">${icon('check', { size: 16 })} Revisão desta semana feita. Até a próxima!</p>`
    : '<button type="button" class="btn primary" data-finish>Concluir a revisão</button>'}
    ${state.settings.reminders?.savedAt ? '' : `<button type="button" class="btn ghost" data-reminders>${icon('calendar', { size: 18 })} Lembrar toda semana no calendário</button>`}
  </section>`;
}

export function mount(root, { rerender }) {
  mountRecall(root, recallItems);
  root.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    await setTransactionPaid(b.dataset.paid, true);
    toast('Conta marcada como paga.', { tone: 'good' });
  }));
  root.querySelector('[data-reminders]')?.addEventListener('click', () => openReminders());
  root.querySelector('[data-finish]')?.addEventListener('click', async () => {
    await completeReview();
    const n = reviewStreak(state.progress.reviews);
    toast(n > 1 ? `Revisão feita: ${n} semanas seguidas!` : 'Revisão feita. Até a próxima semana!', { tone: 'good' });
    rerender();
  });
}
