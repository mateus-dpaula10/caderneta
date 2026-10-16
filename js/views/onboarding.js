// Apresentação inicial: renda, objetivo e situação atual personalizam dicas e lições.
import { state, saveSettings, addTransaction, setBudgets, upsertGoal } from '../store.js';
import { moneyInput, toast } from '../ui.js';
import { esc, parseMoney, centsToInput, todayISO, currentMonth, fmtBRL } from '../utils.js';
import { GOAL_TYPES, suggestBudgets } from '../finance.js';
import { DISCLAIMER } from '../lessons.js';

const GOAL_ICONS = { organizar: '🧾', reserva: '🛟', dividas: '💳', investir: '🌱' };

export function renderOnboarding(root, { onDone, onSignIn }) {
  const s = state.settings;
  const hasIncomeTx = state.transactions.some((t) => t.type === 'income');
  root.innerHTML = `<div class="onboarding" role="dialog" aria-modal="true" aria-labelledby="ob-title">
    <form class="ob-card" novalidate>
      <div class="ob-progress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>

      <section class="ob-step" data-step="0">
        <img src="icons/icon.svg" alt="" width="64" height="64" class="ob-logo">
        <h1 id="ob-title" class="ob-title">Seu dinheiro, anotado e entendido.</h1>
        <p>A Caderneta ajuda você a registrar o que entra e o que sai, e ensina finanças pessoais com lições curtas
          que usam os seus próprios números.</p>
        <ul class="ob-points">
          <li><strong>Privado:</strong> tudo fica salvo neste aparelho. Se quiser, crie uma conta (opcional) para sincronizar com outros aparelhos.</li>
          <li><strong>Funciona offline</strong> e pode ser instalado como app.</li>
          <li><strong>Educativo:</strong> ${esc(DISCLAIMER)}</li>
        </ul>
        ${onSignIn ? '<p class="muted small">Já usa a Caderneta em outro aparelho? <button type="button" class="btn link" data-signin>Entrar na conta</button></p>' : ''}
      </section>

      <section class="ob-step" data-step="1" hidden>
        <h2 class="ob-title">Vamos começar pelo básico</h2>
        <label class="field" for="ob-name"><span class="field-label">Como quer ser chamado(a)? <small>(opcional)</small></span>
          <input id="ob-name" name="name" maxlength="40" autocomplete="given-name" value="${esc(s.name)}"></label>
        ${moneyInput({ name: 'income', label: 'Quanto você recebe por mês, já com descontos?', id: 'ob-income', value: s.income ? centsToInput(s.income) : '',
    hint: 'Pode ser um valor aproximado. Se a renda varia, use a média dos últimos meses.' })}
      </section>

      <section class="ob-step" data-step="2" hidden>
        <h2 class="ob-title">Qual é o seu objetivo principal agora?</h2>
        <fieldset class="choice-grid"><legend class="sr-only">Objetivo principal</legend>
          ${Object.entries(GOAL_TYPES).map(([k, g]) => `<label class="choice">
            <input type="radio" name="goal" value="${k}" ${k === s.goal ? 'checked' : ''}>
            <span><span class="choice-icon" aria-hidden="true">${GOAL_ICONS[k]}</span>${g.label}</span></label>`).join('')}
        </fieldset>
      </section>

      <section class="ob-step" data-step="3" hidden>
        <h2 class="ob-title">Duas perguntas rápidas</h2>
        <fieldset class="segmented small"><legend class="field-label">Hoje você tem dívidas no cartão, cheque especial ou atrasadas?</legend>
          <label><input type="radio" name="hasDebt" value="sim"><span>Sim</span></label>
          <label><input type="radio" name="hasDebt" value="nao"><span>Não</span></label>
          <label><input type="radio" name="hasDebt" value="" checked><span>Prefiro não dizer</span></label>
        </fieldset>
        <fieldset class="segmented small"><legend class="field-label">Você tem dinheiro guardado para emergências?</legend>
          <label><input type="radio" name="hasReserve" value="sim"><span>Sim</span></label>
          <label><input type="radio" name="hasReserve" value="nao" checked><span>Ainda não</span></label>
        </fieldset>
        <fieldset class="ob-options"><legend class="field-label">Quer que a gente já deixe pronto?</legend>
          <label class="check" data-needs-income><input type="checkbox" name="incomeTx" ${hasIncomeTx ? '' : 'checked'}><span>Registrar a renda como receita mensal (repete todo mês)</span></label>
          <label class="check" data-needs-income><input type="checkbox" name="budgets" checked><span>Sugerir limites por categoria pelo método 50/30/20</span></label>
          <label class="check"><input type="checkbox" name="reserveGoal" ${state.goals.some((g) => g.kind === 'reserva') ? 'disabled' : 'checked'}><span>Criar a meta "Reserva de emergência"</span></label>
        </fieldset>
      </section>

      <p class="form-error" role="alert" hidden></p>
      <div class="ob-actions">
        <button type="button" class="btn ghost" data-back hidden>Voltar</button>
        <button type="button" class="btn link" data-skip>Pular</button>
        <button type="submit" class="btn primary" data-next>Começar</button>
      </div>
    </form>
  </div>`;

  const form = root.querySelector('form');
  const steps = [...form.querySelectorAll('.ob-step')];
  const dots = [...form.querySelectorAll('.ob-progress span')];
  const err = form.querySelector('.form-error');
  const next = form.querySelector('[data-next]');
  const back = form.querySelector('[data-back]');
  let step = 0;

  const show = (i) => {
    step = i;
    steps.forEach((el, k) => { el.hidden = k !== i; });
    dots.forEach((d, k) => d.classList.toggle('on', k <= i));
    back.hidden = i === 0;
    next.textContent = i === 0 ? 'Começar' : i === steps.length - 1 ? 'Concluir' : 'Continuar';
    err.hidden = true;
    if (i === 3) {
      const hasIncome = parseMoney(form.income.value) > 0;
      form.querySelectorAll('[data-needs-income]').forEach((l) => { l.hidden = !hasIncome; });
    }
    const focusEl = steps[i].querySelector('input:not([type="radio"]), input:checked, .ob-title');
    if (focusEl?.classList.contains('ob-title')) { focusEl.tabIndex = -1; }
    focusEl?.focus();
  };

  back.addEventListener('click', () => show(Math.max(0, step - 1)));

  async function finish({ skipped = false } = {}) {
    const rawIncome = form.income.value.trim();
    const income = rawIncome ? parseMoney(rawIncome) : 0;
    const patch = { onboarded: true };
    if (!skipped) {
      Object.assign(patch, {
        name: form.name.value.trim(),
        income: income > 0 ? income : 0,
        goal: form.goal.value || 'organizar',
        hasDebt: form.hasDebt.value === '' ? null : form.hasDebt.value === 'sim',
        hasReserve: form.hasReserve.value === 'sim',
      });
    }
    await saveSettings(patch);
    if (!skipped) {
      const ym = currentMonth();
      if (patch.income > 0 && form.incomeTx.checked) {
        await addTransaction({ type: 'income', amount: patch.income, date: `${ym}-05` <= todayISO() ? `${ym}-05` : todayISO(), categoryId: 'salario', description: 'Salário', nature: 'fixo' }, { recurring: true });
      }
      if (patch.income > 0 && form.budgets.checked) await setBudgets(suggestBudgets(state, patch.income, ym));
      if (form.reserveGoal.checked && !form.reserveGoal.disabled) {
        await upsertGoal({ name: 'Reserva de emergência', kind: 'reserva', icon: '🛟', target: patch.income > 0 ? Math.round(patch.income * 0.8) * 6 : 0, saved: 0 });
      }
    }
    root.innerHTML = '';
    onDone();
    toast(skipped ? 'Tudo bem. Você pode completar seu perfil em Ajustes quando quiser.'
      : `Tudo pronto${patch.name ? `, ${esc(patch.name)}` : ''}! ${patch.income ? `A régua do mês já usa sua renda de ${fmtBRL(patch.income)}.` : ''}`, { tone: 'good', timeout: 6000 });
  }

  form.querySelector('[data-skip]').addEventListener('click', () => finish({ skipped: true }));
  form.querySelector('[data-signin]')?.addEventListener('click', () => onSignIn());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step === 1) {
      const raw = form.income.value.trim();
      if (raw && !(parseMoney(raw) >= 0)) {
        err.textContent = 'Não entendi esse valor. Use números, por exemplo 3.200,00.';
        err.hidden = false; form.income.focus(); return;
      }
    }
    if (step < steps.length - 1) { show(step + 1); return; }
    next.disabled = true;
    try { await finish(); } catch (ex) { next.disabled = false; err.textContent = ex.message || 'Algo deu errado. Tente de novo.'; err.hidden = false; }
  });

  show(0);
}
