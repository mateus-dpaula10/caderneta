// Painel do objetivo (settings.goal): transforma o objetivo da pessoa num número que anda e num próximo passo.
// Também: dívidas (metas com kind 'divida') e a sequência de revisões semanais. Funções puras sobre o estado.
import { addDays, addMonths, currentMonth, fmtBRL, fmtPct1, parseISODate, todayISO } from './utils.js';
import { GOAL_TYPES, avgMonthlyExpense, emergencyGoal, monthSummary, monthlyNeeded, reserveMonths } from './finance.js';
import { debtPayoff } from './calc.js';

// ---------- Dívidas ----------
// Uma dívida é uma meta com kind 'divida': target = quanto devia ao cadastrar (ou o saldo ajustado depois),
// saved = quanto já pagou. Campos próprios: rate (juros ao mês, fração: 0.12 = 12%) e installment (parcela, centavos).
export const isDebt = (g) => g?.kind === 'divida';
export const debtsOf = (state) => state.goals.filter(isDebt);
export const savingGoalsOf = (state) => state.goals.filter((g) => !isDebt(g));
export const debtRemaining = (d) => Math.max(0, (d.target || 0) - (d.saved || 0));

/**
 * Ordem para pagar (método avalanche): as em aberto primeiro, juros mais altos antes; sem juros informado vai
 * para o fim das em aberto; empate, a de menor saldo (termina antes). Quitadas no fim.
 */
export function debtOrder(debts) {
  const rate = (d) => (Number.isFinite(d.rate) && d.rate > 0 ? d.rate : -1);
  return [...debts].sort((a, b) => {
    const ra = debtRemaining(a) > 0 ? 0 : 1;
    const rb = debtRemaining(b) > 0 ? 0 : 1;
    return ra - rb || rate(b) - rate(a) || debtRemaining(a) - debtRemaining(b);
  });
}

/** Meses para quitar com a parcela informada (null se faltar juros ou parcela; never se a parcela não cobre os juros). */
export function debtForecast(d) {
  const balance = debtRemaining(d);
  if (!balance) return { months: 0 };
  if (!(d.installment > 0) || !Number.isFinite(d.rate) || d.rate < 0) return null;
  return debtPayoff({ balance, rate: d.rate, payment: d.installment });
}

// ---------- Revisão da semana ----------
/** Segunda-feira da semana de uma data (semana de segunda a domingo). */
export function weekStart(iso) {
  const day = parseISODate(iso).getDay();
  return addDays(iso, -((day + 6) % 7));
}

export const reviewedThisWeek = (reviews, today = todayISO()) =>
  (reviews || []).some((d) => weekStart(d) === weekStart(today));

/** Semanas seguidas com revisão, terminando nesta semana (ou na anterior, se esta ainda não teve). */
export function reviewStreak(reviews, today = todayISO()) {
  const weeks = new Set((reviews || []).map(weekStart));
  let w = weekStart(today);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w) && n < 520) { n++; w = addDays(w, -7); }
  return n;
}

// ---------- Painel ----------
const months = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${n >= 1 && n < 2 ? 'mês' : 'meses'}`;

/** Passos com o primeiro não feito como próximo passo. */
function checklist(steps) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return { steps, ratio: done / steps.length, headline: `${done} de ${steps.length} passos`, next: next ? { label: next.cta, href: next.href } : null };
}

function reservePanel(state, ym) {
  const g = emergencyGoal(state);
  const avg = avgMonthlyExpense(state, ym) || Math.round((state.settings.income || 0) * 0.8);
  if (!g) {
    return {
      headline: 'Crie a meta da reserva', ratio: null,
      detail: avg ? `O primeiro degrau é um mês dos seus gastos: cerca de ${fmtBRL(avg)}.` : 'Comece com um mês dos seus gastos como primeiro degrau.',
      next: { label: 'Criar a meta da reserva', href: '#/planejar?nova-meta=reserva' },
    };
  }
  const reached = g.target > 0 && g.saved >= g.target;
  const step = avg ? [1, 3, 6].find((n) => g.saved < n * avg) : null;
  const need = monthlyNeeded(g, ym);
  const parts = [];
  if (avg) parts.push(`Cobre ${months(g.saved / avg)} de gastos.`);
  if (reached) parts.push('Meta alcançada!');
  else if (step) parts.push(`Próximo degrau: ${step === 1 ? '1 mês' : `${step} meses`} (faltam ${fmtBRL(step * avg - g.saved)}).`);
  else parts.push(`Faltam ${fmtBRL(g.target - g.saved)} para a meta.`);
  if (need && !reached) parts.push(`Para chegar no prazo: ${fmtBRL(need.perMonth)} por mês.`);
  return {
    headline: `${fmtBRL(g.saved)} de ${fmtBRL(g.target)}`, ratio: g.target ? g.saved / g.target : 0, detail: parts.join(' '),
    next: reached ? null : { label: 'Guardar na reserva', href: '#/planejar?guardar=reserva' },
  };
}

function debtsPanel(state) {
  const debts = debtsOf(state);
  if (!debts.length) {
    return {
      headline: 'Liste as suas dívidas', ratio: null,
      detail: 'Com saldo, juros e parcela de cada uma, o app mostra a ordem de pagamento e quando você fica livre.',
      next: { label: 'Cadastrar dívidas', href: '#/planejar?nova-divida=1' },
    };
  }
  const total = debts.reduce((s, d) => s + (d.target || 0), 0);
  const paid = debts.reduce((s, d) => s + Math.min(d.saved || 0, d.target || 0), 0);
  const remaining = total - paid;
  if (!remaining) return { headline: 'Dívidas quitadas!', ratio: 1, detail: `Você pagou ${fmtBRL(total)}. Hora de montar a reserva para não voltar a precisar de crédito caro.`, next: null };
  const open = debtOrder(debts).filter((d) => debtRemaining(d) > 0);
  const first = open[0];
  const forecasts = open.map(debtForecast);
  const parts = [`Já pagou ${fmtBRL(paid)} de ${fmtBRL(total)}.`, `Prioridade: ${first.name}${first.rate > 0 ? ` (${fmtPct1(first.rate)} ao mês)` : ''}.`];
  if (forecasts.some((f) => f?.never)) parts.push('Atenção: há parcela que não cobre os juros do mês.');
  else if (forecasts.every((f) => f && Number.isFinite(f.months))) {
    const m = Math.max(...forecasts.map((f) => f.months));
    parts.push(`Pagando as parcelas, livre em cerca de ${m} ${m === 1 ? 'mês' : 'meses'}.`);
  }
  return {
    headline: `${fmtBRL(remaining)} a quitar`, ratio: paid / total, detail: parts.join(' '),
    next: { label: 'Registrar pagamento', href: `#/planejar?pagar=${encodeURIComponent(first.id)}` },
  };
}

function organizePanel(state) {
  return checklist([
    { label: 'Registrar os gastos por alguns dias', done: (state.progress.activity || []).length >= 5 || state.transactions.length >= 15, cta: 'Registrar um gasto', href: '#/lancamentos?novo=1' },
    { label: 'Marcar as contas fixas como "Repetir todo mês"', done: state.recurrences.some((r) => r.type === 'expense'), cta: 'Ver lançamentos', href: '#/lancamentos' },
    { label: 'Dar um limite a pelo menos 3 categorias', done: state.categories.filter((c) => c.type === 'expense' && c.budget > 0).length >= 3, cta: 'Definir limites', href: '#/planejar' },
    { label: 'Fazer a primeira revisão da semana', done: (state.progress.reviews || []).length > 0, cta: 'Fazer a revisão da semana', href: '#/revisao' },
  ]);
}

function investPanel(state, ym) {
  const open = debtsOf(state).filter((d) => debtRemaining(d) > 0);
  const noDebt = !open.length && state.settings.hasDebt !== true;
  const closedInBlue = [1, 2, 3].some((i) => { const s = monthSummary(state, addMonths(ym, -i)); return s.income > 0 && s.balance > 0; });
  return checklist([
    { label: 'Sem dívida cara', done: noDebt, cta: open.length ? 'Pagar as dívidas' : 'Cadastrar dívidas', href: open.length ? `#/planejar?pagar=${encodeURIComponent(debtOrder(open)[0].id)}` : '#/planejar?nova-divida=1' },
    { label: 'Reserva de 3 meses', done: reserveMonths(state, ym).months >= 3, cta: emergencyGoal(state) ? 'Guardar na reserva' : 'Criar a meta da reserva', href: emergencyGoal(state) ? '#/planejar?guardar=reserva' : '#/planejar?nova-meta=reserva' },
    { label: 'Fechar um mês no azul', done: closedInBlue, cta: 'Ver o orçamento', href: '#/planejar' },
    { label: 'Criar uma meta de investimento com prazo', done: savingGoalsOf(state).some((g) => g.kind !== 'reserva' && g.deadline), cta: 'Criar a meta', href: '#/planejar?nova-meta=investir' },
  ]);
}

/**
 * Painel do objetivo: { goal, label, icon, headline, ratio (0–1 ou null), detail?, steps?, next: {label, href} | null }.
 * `steps` (organizar e investir) é um checklist calculado a partir do que a pessoa já fez no app.
 */
export function objectivePanel(state, ym = currentMonth()) {
  const goal = GOAL_TYPES[state.settings.goal] ? state.settings.goal : 'organizar';
  const build = { reserva: () => reservePanel(state, ym), dividas: () => debtsPanel(state), organizar: () => organizePanel(state), investir: () => investPanel(state, ym) };
  return { goal, ...GOAL_TYPES[goal], ...build[goal]() };
}
