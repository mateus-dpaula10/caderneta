// Lembretes no calendário do celular (arquivo .ics, js/calendar.js): revisão da semana, dia do salário e contas.
// As escolhas ficam em settings.reminders (sincroniza com a conta) para o formulário abrir como da última vez.
import { state, saveSettings, categoryById } from '../store.js';
import { openDialog, sheetHeader, toast, downloadFile } from '../ui.js';
import { addDays, currentMonth, esc, fmtBRL, monthCmp, todayISO } from '../utils.js';
import { emergencyGoal, monthlyNeeded, payStatus, referenceIncome } from '../finance.js';
import { debtOrder, debtRemaining, debtsOf } from '../objective.js';
import { buildICS } from '../calendar.js';
import { icon } from '../icons.js';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const clampDay = (d) => Math.min(28, Math.max(1, Math.round(Number(d) || 1)));

/** Dia do salário: o da receita recorrente de salário, se houver; senão, dia 5. */
function salaryDayGuess() {
  const rec = state.recurrences.find((r) => r.type === 'income' && r.categoryId === 'salario' && !r.endMonth);
  return clampDay(rec?.day || 5);
}

/** O que separar no dia do salário, de acordo com o objetivo. */
function salaryText() {
  const income = referenceIncome(state, currentMonth());
  const future = income ? fmtBRL(income * 0.2) : null;
  if (state.settings.goal === 'dividas') {
    const first = debtOrder(debtsOf(state)).find((d) => debtRemaining(d) > 0);
    if (first) return `Antes de gastar, pague a dívida prioritária: ${first.name}${first.installment ? ` (${fmtBRL(first.installment)})` : ''}.`;
  }
  if (state.settings.goal === 'reserva') {
    const g = emergencyGoal(state);
    const need = g && monthlyNeeded(g, currentMonth());
    if (need?.perMonth) return `Antes de gastar, guarde ${fmtBRL(need.perMonth)} na reserva de emergência.`;
  }
  return future ? `Antes de gastar, separe a parte do futuro: ${future} (20% da renda).` : 'Antes de gastar, separe a parte do futuro (reserva, dívida ou meta).';
}

/** Contas fixas (séries de despesa ativas) e contas avulsas a pagar nos próximos 60 dias. */
function billsFor() {
  const cm = currentMonth();
  const today = todayISO();
  const bills = state.recurrences
    .filter((r) => r.type === 'expense' && (!r.endMonth || monthCmp(r.endMonth, cm) >= 0))
    .map((r) => ({
      id: r.id, title: r.description || categoryById(r.categoryId)?.name || 'Conta', day: clampDay(r.day),
      text: `Valor: ${fmtBRL(r.amount)}. Depois de pagar, marque como paga na Caderneta.`,
    }));
  const limit = addDays(today, 60);
  const once = state.transactions
    .filter((t) => t.type === 'expense' && !t.seriesId && t.date > today && t.date <= limit && payStatus(t, today) === 'due')
    .map((t) => ({ id: t.id, title: t.description || categoryById(t.categoryId)?.name || 'Conta', date: t.date, text: `Valor: ${fmtBRL(t.amount)}.` }));
  return { bills, once };
}

export function openReminders() {
  const r = state.settings.reminders || {};
  const review = r.review === null ? null : { weekday: 0, time: '19:00', ...(r.review || {}) };
  const salaryDay = r.salaryDay === null ? null : clampDay(r.salaryDay || salaryDayGuess());
  const { bills, once } = billsFor();
  const nBills = bills.length + once.length;

  const dlg = openDialog(`<form class="sheet-body reminders" novalidate>
    ${sheetHeader('Lembretes no calendário')}
    <p class="lead">O app gera um arquivo de calendário. Ao abrir, o celular oferece adicionar os eventos, e o
      calendário avisa na hora certa, mesmo com o app fechado.</p>

    <label class="check"><input type="checkbox" name="review" ${review ? 'checked' : ''}>
      <span><strong>Revisão da semana</strong> <small>(2 minutos: lançar o que faltou e ver o objetivo)</small></span></label>
    <div class="grid-2 reminder-opts" data-for="review">
      <label class="field" for="r-weekday"><span class="field-label">Dia</span>
        <select id="r-weekday" name="weekday">${WEEKDAYS.map((d, i) => `<option value="${i}" ${i === (review?.weekday ?? 0) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field" for="r-time"><span class="field-label">Horário</span>
        <input id="r-time" name="time" type="time" value="${esc(review?.time || '19:00')}"></label>
    </div>

    <label class="check"><input type="checkbox" name="salary" ${salaryDay ? 'checked' : ''}>
      <span><strong>Dia do salário</strong> <small>(${esc(salaryText())})</small></span></label>
    <div class="reminder-opts" data-for="salary">
      <label class="field" for="r-salary-day"><span class="field-label">Dia do mês</span>
        <input id="r-salary-day" name="salaryDay" type="number" inputmode="numeric" min="1" max="28" value="${salaryDay || salaryDayGuess()}"></label>
    </div>

    <label class="check"><input type="checkbox" name="bills" ${nBills && r.bills !== false ? 'checked' : ''} ${nBills ? '' : 'disabled'}>
      <span><strong>Vencimento das contas</strong> <small>(${nBills
    ? `${nBills} ${nBills === 1 ? 'conta' : 'contas'}: as fixas todo mês e as a pagar dos próximos 60 dias, com aviso um dia antes`
    : 'nenhuma conta fixa ou a pagar por enquanto'})</small></span></label>

    <p class="field-hint">Baixou de novo depois de mudar algo? Alguns calendários atualizam os eventos; se aparecerem
      repetidos, apague os antigos. Dias 29 a 31 viram dia 28, para valer em todos os meses.</p>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions"><button type="submit" class="btn primary">${icon('calendar', { size: 18 })} Baixar e adicionar ao calendário</button></div>
  </form>`);

  const form = dlg.querySelector('form');
  const sync = () => dlg.querySelectorAll('.reminder-opts').forEach((el) => { el.hidden = !form[el.dataset.for].checked; });
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.form-error');
    const wantReview = form.review.checked;
    const wantSalary = form.salary.checked;
    const wantBills = form.bills.checked && !form.bills.disabled;
    if (!wantReview && !wantSalary && !wantBills) { err.textContent = 'Escolha pelo menos um lembrete.'; err.hidden = false; return; }
    if (wantReview && !/^\d{2}:\d{2}$/.test(form.time.value)) { err.textContent = 'Informe o horário da revisão.'; err.hidden = false; form.time.focus(); return; }
    const reviewOpt = wantReview ? { weekday: Number(form.weekday.value), time: form.time.value } : null;
    const day = wantSalary ? clampDay(form.salaryDay.value) : null;
    const ics = buildICS({
      review: reviewOpt && { ...reviewOpt, link: `${location.origin}${location.pathname}#/revisao` },
      salary: day && { day, text: salaryText() },
      bills: wantBills ? bills : [],
      once: wantBills ? once : [],
    });
    downloadFile('caderneta-lembretes.ics', ics, 'text/calendar');
    dlg.close();
    await saveSettings({ reminders: { review: reviewOpt, salaryDay: day, bills: wantBills, savedAt: new Date().toISOString() } });
    toast('Arquivo de lembretes baixado. Abra o arquivo e confirme "Adicionar" no calendário.', { tone: 'good', timeout: 8000 });
  });
}
