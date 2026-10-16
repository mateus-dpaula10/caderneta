// Cálculos puros sobre os dados (sem efeitos colaterais). Valores em centavos.
import { addMonths, monthOf, sum, todayISO } from './utils.js';

export const GROUPS = {
  necessidades: { label: 'Necessidades', share: 0.5, hint: 'Moradia, contas, mercado, transporte, saúde' },
  desejos: { label: 'Desejos', share: 0.3, hint: 'Lazer, compras, delivery, assinaturas' },
  futuro: { label: 'Futuro', share: 0.2, hint: 'Guardar, investir e quitar dívidas' },
};

// Objetivos da pessoa (settings.goal). A trilha de lições de cada um fica em GOAL_TRACKS (js/lessons.js).
export const GOAL_TYPES = {
  organizar: { label: 'Organizar minhas contas', icon: '🧾' },
  reserva: { label: 'Montar uma reserva de emergência', icon: '🛟' },
  dividas: { label: 'Sair das dívidas', icon: '💳' },
  investir: { label: 'Começar a investir', icon: '🌱' },
};

export function txOfMonth(state, ym) {
  return state.transactions.filter((t) => monthOf(t.date) === ym);
}

/**
 * Despesa paga? ÚNICA regra do app: use sempre esta função, nunca `t.paid` direto.
 * O campo `paid` (boolean) só existe em despesa e só quando alguém decidiu (formulário, toque na lista
 * ou coluna "Pago" da planilha). Sem o campo (dados antigos, ocorrência gerada pela recorrência), vale
 * a data: conta como paga se a data já chegou e como "a pagar" se é futura. Receita conta sempre como paga.
 */
export function isPaid(t, today = todayISO()) {
  if (!t || t.type !== 'expense') return true;
  return hasPaidChoice(t) ? t.paid : t.date <= today;
}

/** A pessoa já decidiu pago/a pagar neste lançamento (o campo existe)? Se não, isPaid segue a data. */
export const hasPaidChoice = (t) => typeof t?.paid === 'boolean';

/** Situação de pagamento: 'paid' (paga), 'due' (a pagar, vence hoje ou depois) ou 'late' (a pagar e a data já passou). */
export function payStatus(t, today = todayISO()) {
  if (isPaid(t, today)) return 'paid';
  return t.date < today ? 'late' : 'due';
}

/**
 * Contas a pagar do mês (só despesas não pagas): total e quantidade; `late`/`lateCount` é a parte já atrasada.
 * Não muda os totais do mês: despesas, saldo, 50/30/20 e orçamento continuam contando tudo, pago ou não.
 */
export function billsSummary(state, ym, today = todayISO()) {
  const out = { due: 0, dueCount: 0, late: 0, lateCount: 0, expenseCount: 0 };
  for (const t of txOfMonth(state, ym)) {
    if (t.type !== 'expense') continue;
    out.expenseCount++;
    const st = payStatus(t, today);
    if (st === 'paid') continue;
    out.due += t.amount; out.dueCount++;
    if (st === 'late') { out.late += t.amount; out.lateCount++; }
  }
  return out;
}

/** De onde saiu o dinheiro de uma despesa (`paidWith`). */
export const PAID_WITH = { salario: 'Salário', cartao: 'Cartão de crédito' };
export const isPaidWith = (v) => v === 'salario' || v === 'cartao';

/**
 * De onde saiu a despesa: 'salario' ou 'cartao'. ÚNICA regra do app: use sempre esta função, nunca
 * `t.paidWith` direto. Sem o campo (dados antigos, planilha com a coluna vazia) conta como salário.
 * Receita não tem o campo: devolve null.
 */
export function paidWithOf(t) {
  if (!t || t.type !== 'expense') return null;
  return isPaidWith(t.paidWith) ? t.paidWith : 'salario';
}

/** Despesas do mês por origem: quanto saiu do salário e quanto foi no cartão (soma = total de despesas). */
export function paidWithSummary(state, ym) {
  const out = { salario: 0, cartao: 0, cartaoCount: 0, expenseCount: 0 };
  for (const t of txOfMonth(state, ym)) {
    if (t.type !== 'expense') continue;
    out.expenseCount++;
    const w = paidWithOf(t);
    out[w] += t.amount;
    if (w === 'cartao') out.cartaoCount++;
  }
  return out;
}

/** Resumo de um mês: totais, por categoria e por grupo 50/30/20. */
export function monthSummary(state, ym) {
  const txs = txOfMonth(state, ym);
  const catById = new Map(state.categories.map((c) => [c.id, c]));
  const income = sum(txs.filter((t) => t.type === 'income'), (t) => t.amount);
  const expense = sum(txs.filter((t) => t.type === 'expense'), (t) => t.amount);
  const byCategory = new Map();
  const byGroup = { necessidades: 0, desejos: 0, futuro: 0 };
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) || 0) + t.amount);
    const group = catById.get(t.categoryId)?.group || 'desejos';
    byGroup[group] = (byGroup[group] || 0) + t.amount;
  }
  const fixed = sum(txs.filter((t) => t.type === 'expense' && t.nature === 'fixo'), (t) => t.amount);
  return { ym, txs, income, expense, balance: income - expense, byCategory, byGroup, fixed, count: txs.length };
}

/** Série dos últimos N meses terminando em `ym`. */
export function lastMonths(state, ym, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(ym, -i);
    const s = monthSummary(state, m);
    out.push({ ym: m, income: s.income, expense: s.expense, balance: s.balance, count: s.count });
  }
  return out;
}

/** Média mensal de despesas dos últimos meses com movimento (para medir a reserva). */
export function avgMonthlyExpense(state, ym, n = 3) {
  const months = lastMonths(state, ym, n + 1).filter((m) => m.count > 0 && m.expense > 0);
  // Ignora o mês corrente se ainda estiver "incompleto" e houver histórico anterior.
  const closed = months.filter((m) => m.ym !== ym);
  const base = closed.length ? closed : months;
  if (!base.length) return 0;
  return Math.round(sum(base, (m) => m.expense) / base.length);
}

/** Renda de referência: renda informada ou receitas do mês (o que for maior). */
export function referenceIncome(state, ym) {
  const declared = state.settings.income || 0;
  const s = monthSummary(state, ym);
  return Math.max(declared, s.income);
}

/** Sugestão de limites por categoria no método 50/30/20. */
export function suggestBudgets(state, income, ym) {
  const expenseCats = state.categories.filter((c) => c.type === 'expense');
  // Peso de cada categoria dentro do grupo: gasto médio dos últimos 3 meses; sem histórico, peso padrão.
  const history = [1, 2, 3].map((i) => monthSummary(state, addMonths(ym, -i)));
  const weight = new Map();
  for (const c of expenseCats) {
    const spent = sum(history, (h) => h.byCategory.get(c.id) || 0);
    weight.set(c.id, spent > 0 ? spent : (c.defaultWeight || 1) * 1000);
  }
  const result = {};
  for (const [group, { share }] of Object.entries(GROUPS)) {
    const cats = expenseCats.filter((c) => (c.group || 'desejos') === group);
    const total = sum(cats, (c) => weight.get(c.id));
    const groupBudget = Math.round(income * share);
    for (const c of cats) {
      const raw = total > 0 ? (groupBudget * weight.get(c.id)) / total : groupBudget / cats.length;
      result[c.id] = Math.round(raw / 1000) * 1000; // arredonda para R$ 10
    }
  }
  return result;
}

/** Situação do orçamento de cada categoria com limite no mês. */
export function budgetStatus(state, ym) {
  const s = monthSummary(state, ym);
  return state.categories
    // O grupo 'futuro' (guardar, investir, quitar dívidas) usa o valor como meta, não como teto: não gera alerta.
    .filter((c) => c.type === 'expense' && c.budget > 0 && c.group !== 'futuro')
    .map((c) => {
      const spent = s.byCategory.get(c.id) || 0;
      const ratio = spent / c.budget;
      return { category: c, spent, limit: c.budget, ratio, level: ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok' };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export function emergencyGoal(state) {
  return state.goals.find((g) => g.kind === 'reserva') || null;
}

/** Quantos meses de despesas a reserva cobre. */
export function reserveMonths(state, ym) {
  const goal = emergencyGoal(state);
  const avg = avgMonthlyExpense(state, ym) || state.settings.income * 0.8 || 0;
  if (!goal || !avg) return { months: 0, saved: goal?.saved || 0, avg };
  return { months: goal.saved / avg, saved: goal.saved, avg };
}

/** Quanto falta poupar por mês para bater uma meta no prazo. */
export function monthlyNeeded(goal, fromYm) {
  if (!goal.deadline) return null;
  const remaining = Math.max(0, goal.target - goal.saved);
  let months = 0;
  let m = fromYm;
  while (m <= goal.deadline && months < 600) { months++; m = addMonths(m, 1); }
  if (months <= 0) return { months: 0, perMonth: remaining };
  return { months, perMonth: Math.ceil(remaining / months) };
}
