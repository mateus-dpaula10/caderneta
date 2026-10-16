// Simuladores financeiros (funções puras). Valores em reais (number), taxas em fração (0,01 = 1%).

/** Converte taxa anual em mensal equivalente (juros compostos). */
export const annualToMonthly = (a) => Math.pow(1 + a, 1 / 12) - 1;
export const monthlyToAnnual = (m) => Math.pow(1 + m, 12) - 1;

/**
 * Juros compostos com aportes mensais (aporte no fim de cada mês).
 * Retorna a evolução mês a mês para o gráfico.
 */
export function compound({ initial = 0, monthly = 0, rate = 0, months = 0 }) {
  const series = [{ month: 0, invested: initial, total: initial }];
  let total = initial;
  let invested = initial;
  for (let m = 1; m <= months; m++) {
    total = total * (1 + rate) + monthly;
    invested += monthly;
    series.push({ month: m, invested, total });
  }
  return { total, invested, interest: total - invested, series };
}

/**
 * Quantos meses até atingir a meta guardando `monthly` por mês a uma taxa mensal `rate`.
 * Retorna null se nunca chega (sem aporte e sem rendimento) ou se passa de 100 anos.
 */
export function timeToGoal({ target, current = 0, monthly = 0, rate = 0 }) {
  if (current >= target) return { months: 0, total: current, invested: current };
  if (monthly <= 0 && (rate <= 0 || current <= 0)) return null;
  let total = current;
  let invested = current;
  for (let m = 1; m <= 1200; m++) {
    total = total * (1 + rate) + monthly;
    invested += monthly;
    if (total >= target) return { months: m, total, invested, interest: total - invested };
  }
  return null;
}

/** Valor presente de uma série de parcelas iguais (Tabela Price). */
function pvAnnuity(pmt, n, i) {
  if (i === 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + i, -n)) / i;
}

/**
 * Taxa mensal implícita num parcelamento: à vista `cash` vs. `n` parcelas de `pmt`.
 * `firstNow`: primeira parcela paga no ato (comum no varejo, "1 + n-1").
 */
export function impliedRate({ cash, pmt, n, firstNow = false }) {
  const total = pmt * n;
  if (!(cash > 0 && pmt > 0 && n > 0)) return null;
  if (total <= cash) return { rate: 0, total, extra: total - cash };
  const pv = (i) => (firstNow ? pmt + pvAnnuity(pmt, n - 1, i) : pvAnnuity(pmt, n, i));
  // Bisseção: pv(i) decresce com i. Procuramos pv(i) = cash.
  let lo = 0;
  let hi = 1; // 100% ao mês já é absurdo o bastante como limite
  if (pv(hi) > cash) return { rate: hi, total, extra: total - cash, capped: true };
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > cash) lo = mid; else hi = mid;
  }
  return { rate: (lo + hi) / 2, total, extra: total - cash };
}

/**
 * Quitação de dívida: saldo, juros mensais e pagamento mensal fixo.
 * Retorna meses e total de juros; `never: true` se o pagamento não cobre os juros.
 */
export function debtPayoff({ balance, rate, payment }) {
  if (!(balance > 0)) return { months: 0, totalPaid: 0, interest: 0 };
  const firstInterest = balance * rate;
  if (payment <= firstInterest) return { never: true, firstInterest };
  let b = balance;
  let paid = 0;
  let months = 0;
  while (b > 0.005 && months < 1200) {
    b = b * (1 + rate);
    const p = Math.min(payment, b);
    b -= p;
    paid += p;
    months++;
  }
  return { months, totalPaid: paid, interest: paid - balance };
}
