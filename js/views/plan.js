// Planejar: metas de economia, dívidas (ordem de pagamento) e orçamento por categoria (com sugestão 50/30/20).
import { state, setBudgets, upsertGoal, deleteGoal, contributeGoal, goalById } from '../store.js';
import { ui, monthNav, openDialog, sheetHeader, toast, confirmDialog, moneyInput } from '../ui.js';
import { esc, fmtBRL, fmtPct, fmtPct1, parseMoney, parseDecimal, centsToInput, monthLabel, currentMonth } from '../utils.js';
import { GROUPS, avgMonthlyExpense, budgetStatus, monthSummary, monthlyNeeded, referenceIncome, suggestBudgets } from '../finance.js';
import { debtForecast, debtOrder, debtRemaining, debtsOf, isDebt, savingGoalsOf } from '../objective.js';
import { ring } from '../charts.js';
import { icon } from '../icons.js';

function budgetSection() {
  const ym = ui.ym;
  const s = monthSummary(state, ym);
  const income = referenceIncome(state, ym);
  const status = new Map(budgetStatus(state, ym).map((b) => [b.category.id, b]));
  const groups = Object.entries(GROUPS).map(([key, g]) => {
    const cats = state.categories.filter((c) => c.type === 'expense' && (c.group || 'desejos') === key);
    const limitSum = cats.reduce((a, c) => a + (c.budget || 0), 0);
    return { key, ...g, cats, spent: s.byGroup[key] || 0, ideal: Math.round(income * g.share), limitSum };
  });

  return `<section class="block" aria-labelledby="budget-title">
    <div class="block-head"><h2 id="budget-title">Orçamento do mês</h2></div>
    ${income > 0 ? `<p class="lead">Renda de referência: <strong>${fmtBRL(income)}</strong>.
       Pelo método 50/30/20, isso daria ${fmtBRL(income * 0.5)} para necessidades, ${fmtBRL(income * 0.3)} para desejos e
       ${fmtBRL(income * 0.2)} para o futuro. <a href="#/aprender/orcamento">Entenda o método</a>.</p>
       <button type="button" class="btn ghost" data-suggest>${icon('bulb', { size: 18 })} Sugerir limites pelo 50/30/20</button>`
    : '<p class="lead">Informe sua renda em <a href="#/ajustes">Ajustes</a> para receber uma sugestão de limites pelo método 50/30/20.</p>'}
    <form class="budget-groups" id="budget-form" novalidate>
      ${groups.map((g) => `<fieldset class="budget-group">
        <legend><span class="swatch seg-${g.key}"></span> ${g.label}
          <span class="muted">${fmtBRL(g.spent)} gastos${income ? `, ${fmtPct(g.spent / income)} da renda (referência ${fmtPct(g.share)})` : ''}</span></legend>
        <ul class="budget-list">${g.cats.map((c) => {
    const st = status.get(c.id);
    const spent = s.byCategory.get(c.id) || 0;
    const ratio = c.budget ? spent / c.budget : 0;
    return `<li class="budget-row ${st ? `lvl-${st.level}` : ''}">
            <div class="budget-row-head">
              <label for="b-${esc(c.id)}"><span aria-hidden="true">${c.icon || ''}</span> ${esc(c.name)}</label>
              <span class="money-wrap compact"><span aria-hidden="true">R$</span>
                <input id="b-${esc(c.id)}" name="${esc(c.id)}" inputmode="decimal" autocomplete="off" placeholder="sem limite"
                  value="${c.budget ? centsToInput(c.budget) : ''}" aria-describedby="bs-${esc(c.id)}"></span>
            </div>
            <div class="meter" aria-hidden="true"><span style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></span></div>
            <p class="budget-status" id="bs-${esc(c.id)}">${c.budget
      ? `${fmtBRL(spent)} de ${fmtBRL(c.budget)}${c.group === 'futuro' ? ' planejados' : ''}${st?.level === 'over' ? `: <strong>passou ${fmtBRL(spent - c.budget)}</strong>` : st?.level === 'near' ? ': perto do limite' : ''}`
      : `${fmtBRL(spent)} gastos, sem limite definido`}</p>
          </li>`;
  }).join('')}</ul>
      </fieldset>`).join('')}
      <div class="actions sticky-actions"><button type="submit" class="btn primary">Salvar limites</button></div>
    </form>
  </section>`;
}

function goalCard(g) {
  const ratio = g.target ? g.saved / g.target : 0;
  const need = monthlyNeeded(g, currentMonth());
  const done = g.saved >= g.target && g.target > 0;
  return `<li class="goal">
    ${ring(ratio, { size: 64, label: `${Math.round(ratio * 100)}% da meta` })}
    <div class="goal-body">
      <h3>${g.icon || '🎯'} ${esc(g.name)}</h3>
      <p><strong>${fmtBRL(g.saved)}</strong> de ${fmtBRL(g.target)}</p>
      <p class="muted">${done ? 'Meta alcançada. Parabéns!'
    : need ? `Prazo: ${monthLabel(g.deadline).toLowerCase()}. Guarde ${fmtBRL(need.perMonth)} por mês.`
      : g.target ? `Faltam ${fmtBRL(Math.max(0, g.target - g.saved))}.` : 'Defina quanto quer juntar no botão de editar.'}</p>
      ${g.kind === 'reserva' ? '<p class="muted small"><a href="#/aprender/reserva">Onde deixar a reserva?</a></p>' : ''}
      <div class="goal-actions">
        <button type="button" class="btn primary small" data-contrib="${esc(g.id)}">${icon('plus', { size: 16 })} Guardar</button>
        <button type="button" class="btn ghost small" data-withdraw="${esc(g.id)}" ${g.saved ? '' : 'disabled'}>Retirar</button>
        <button type="button" class="icon-btn small" data-edit-goal="${esc(g.id)}" aria-label="Editar meta ${esc(g.name)}">${icon('edit', { size: 18 })}</button>
      </div>
    </div>
  </li>`;
}

function goalsSection() {
  return `<section class="block" aria-labelledby="goals-title">
    <div class="block-head"><h2 id="goals-title">Metas de economia</h2>
      <button type="button" class="btn ghost small" data-new-goal>${icon('plus', { size: 16 })} Nova meta</button></div>
    ${savingGoalsOf(state).length ? `<ul class="goals">${savingGoalsOf(state).map(goalCard).join('')}</ul>`
    : `<div class="empty"><p class="empty-title">Nenhuma meta ainda</p>
        <p>Comece pela reserva de emergência: é ela que impede que um imprevisto vire dívida.</p>
        <button type="button" class="btn primary" data-new-goal="reserva">Criar reserva de emergência</button></div>`}
  </section>`;
}

function debtCard(d, priority) {
  const left = debtRemaining(d);
  const f = debtForecast(d);
  const facts = [
    d.rate > 0 ? `juros de ${fmtPct1(d.rate)} ao mês` : 'juros não informados',
    d.installment ? `parcela de ${fmtBRL(d.installment)}` : null,
  ].filter(Boolean).join(', ');
  return `<li class="goal debt ${left ? '' : 'is-paid'}">
    ${ring(d.target ? (d.target - left) / d.target : 0, { size: 64, label: `${Math.round(((d.target - left) / (d.target || 1)) * 100)}% pago` })}
    <div class="goal-body">
      <h3>${esc(d.name)} ${priority ? '<span class="tag accent">Prioridade</span>' : ''}</h3>
      ${left ? `<p><strong>Faltam ${fmtBRL(left)}</strong> de ${fmtBRL(d.target)}</p>
        <p class="muted">${esc(facts.charAt(0).toUpperCase() + facts.slice(1))}.${f?.never
    ? ' <strong class=\"neg\">A parcela não cobre os juros do mês: a dívida cresce.</strong>'
    : f?.months ? ` Pagando a parcela, quita em cerca de ${f.months} ${f.months === 1 ? 'mês' : 'meses'} (${fmtBRL(f.interest)} de juros).` : ''}</p>`
    : `<p><strong>Quitada!</strong> Você pagou ${fmtBRL(d.target)}.</p>`}
      <div class="goal-actions">
        ${left ? `<button type="button" class="btn primary small" data-pay="${esc(d.id)}">${icon('check', { size: 16 })} Paguei</button>` : ''}
        <button type="button" class="icon-btn small" data-edit-debt="${esc(d.id)}" aria-label="Editar dívida ${esc(d.name)}">${icon('edit', { size: 18 })}</button>
      </div>
    </div>
  </li>`;
}

/** Dívidas: aparece para quem tem alguma cadastrada, escolheu esse objetivo ou disse que tem dívidas. */
function debtsSection() {
  const debts = debtOrder(debtsOf(state));
  if (!debts.length && state.settings.goal !== 'dividas' && !state.settings.hasDebt) return '';
  const firstOpen = debts.find((d) => debtRemaining(d) > 0);
  return `<section class="block" id="dividas" aria-labelledby="debts-title">
    <div class="block-head"><h2 id="debts-title">Minhas dívidas</h2>
      <button type="button" class="btn ghost small" data-new-debt>${icon('plus', { size: 16 })} Nova dívida</button></div>
    ${debts.length ? `<p class="lead">Ordem sugerida: juros mais altos primeiro (método avalanche). Pague a parcela de todas e coloque
        o que sobrar na primeira. <a href="#/aprender/plano-dividas">Entenda o plano</a>.</p>
      <ul class="goals">${debts.map((d) => debtCard(d, d === firstOpen && debts.filter((x) => debtRemaining(x) > 0).length > 1)).join('')}</ul>`
    : `<div class="empty"><p class="empty-title">Nenhuma dívida cadastrada</p>
        <p>Cadastre cada uma com o saldo, os juros e a parcela. O app mostra qual pagar primeiro e quando você fica livre.</p>
        <button type="button" class="btn primary" data-new-debt>Cadastrar dívida</button></div>`}
  </section>`;
}

export function render() {
  const debtsFirst = state.settings.goal === 'dividas';
  return `<header class="page-head"><div><h1 class="page-title">Planejar</h1></div></header>
    ${monthNav(ui.ym)}
    ${debtsFirst ? debtsSection() : ''}
    ${goalsSection()}
    ${debtsFirst ? '' : debtsSection()}
    ${budgetSection()}`;
}

function openDebtForm(debt = null) {
  const left = debt ? debtRemaining(debt) : 0;
  const dlg = openDialog(`<form class="sheet-body" novalidate>
    ${sheetHeader(debt ? 'Editar dívida' : 'Nova dívida')}
    <label class="field" for="d-name"><span class="field-label">Nome</span>
      <input id="d-name" name="name" required maxlength="60" value="${esc(debt?.name || '')}" placeholder="Ex.: cartão de crédito, empréstimo, cheque especial"></label>
    ${moneyInput({ name: 'balance', label: 'Quanto deve hoje', value: debt ? centsToInput(left) : '', required: true, id: 'd-balance',
    hint: debt && debt.saved ? `Você já registrou ${fmtBRL(debt.saved)} em pagamentos.` : 'O saldo para quitar hoje (no app do banco ou no boleto).' })}
    <div class="grid-2">
      <label class="field" for="d-rate"><span class="field-label">Juros ao mês (%) <small>opcional</small></span>
        <span class="money-wrap"><input id="d-rate" name="rate" inputmode="decimal" autocomplete="off" placeholder="Ex.: 12"
          value="${debt?.rate > 0 ? String(+(debt.rate * 100).toFixed(2)).replace('.', ',') : ''}"><span aria-hidden="true">%</span></span></label>
      ${moneyInput({ name: 'installment', label: 'Parcela por mês (opcional)', value: debt?.installment ? centsToInput(debt.installment) : '', id: 'd-installment' })}
    </div>
    <p class="field-hint">Com juros e parcela, o app calcula a ordem de pagamento e em quanto tempo você quita.
      Não sabe os juros? Veja o CET no contrato ou no app do banco.</p>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions">
      ${debt ? `<button type="button" class="btn ghost danger-text" data-del-debt>${icon('trash', { size: 18 })} Excluir</button>` : ''}
      <button type="submit" class="btn primary">${debt ? 'Salvar' : 'Cadastrar dívida'}</button>
    </div>
  </form>`);
  const form = dlg.querySelector('form');
  const err = form.querySelector('.form-error');
  const fail = (msg, el) => { err.textContent = msg; err.hidden = false; el?.focus(); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const balance = parseMoney(form.balance.value);
    const rateRaw = form.rate.value.trim();
    const rate = rateRaw ? parseDecimal(rateRaw) / 100 : null;
    const installment = form.installment.value.trim() ? parseMoney(form.installment.value) : 0;
    if (!form.name.value.trim()) return fail('Dê um nome para a dívida.', form.name);
    if (!(balance >= 0) || (!debt && !(balance > 0))) return fail('Informe quanto deve hoje.', form.balance);
    if (rateRaw && !(rate >= 0 && rate <= 1)) return fail('Juros ao mês entre 0 e 100%.', form.rate);
    if (!(installment >= 0)) return fail('A parcela não é válida.', form.installment);
    const saved = debt?.saved || 0;
    await upsertGoal({
      ...(debt ? { id: debt.id } : {}), kind: 'divida', icon: '💳', name: form.name.value.trim(),
      target: saved + balance, saved, rate: rate ?? null, installment: installment || 0, deadline: null,
    });
    dlg.close();
    toast(debt ? 'Dívida atualizada.' : 'Dívida cadastrada.', { tone: 'good' });
  });
  form.querySelector('[data-del-debt]')?.addEventListener('click', async () => {
    dlg.close();
    if (await confirmDialog({ title: 'Excluir dívida?', text: `"${esc(debt.name)}" sai da lista. Os pagamentos já lançados continuam nos lançamentos.`, confirmLabel: 'Excluir', danger: true })) {
      await deleteGoal(debt.id);
      toast('Dívida excluída.');
    }
  });
}

function openGoalForm(goal = null, preset = null) {
  const avg = avgMonthlyExpense(state, currentMonth()) || Math.round((state.settings.income || 0) * 0.8);
  const isReserve = (goal?.kind || preset) === 'reserva';
  const isInvest = !goal && preset === 'investir';
  const g = goal || {
    name: isReserve ? 'Reserva de emergência' : isInvest ? 'Primeiro investimento' : '',
    target: isReserve && avg ? avg * 6 : 0, saved: 0, kind: isReserve ? 'reserva' : 'outro', icon: isReserve ? '🛟' : isInvest ? '🌱' : '🎯', deadline: null,
  };
  const dlg = openDialog(`<form class="sheet-body" novalidate>
    ${sheetHeader(goal ? 'Editar meta' : 'Nova meta')}
    <label class="field" for="g-name"><span class="field-label">Nome da meta</span>
      <input id="g-name" name="name" required maxlength="60" value="${esc(g.name)}" placeholder="Ex.: viagem, troca do celular"></label>
    ${moneyInput({ name: 'target', label: 'Quanto quer juntar', value: g.target ? centsToInput(g.target) : '', required: true, id: 'g-target',
    hint: isReserve && avg ? `Sugestão: 6 meses do seu gasto médio (${fmtBRL(avg)} por mês).` : '' })}
    ${goal ? '' : moneyInput({ name: 'saved', label: 'Já tenho guardado (opcional)', id: 'g-saved' })}
    <div class="grid-2">
      <label class="field" for="g-deadline"><span class="field-label">Prazo (opcional)</span>
        <input id="g-deadline" name="deadline" type="month" min="${currentMonth()}" value="${esc(g.deadline || '')}"></label>
      <label class="field" for="g-icon"><span class="field-label">Ícone</span>
        <select id="g-icon" name="icon">${['🎯', '🛟', '🌱', '✈️', '🏠', '🚗', '🎓', '💍', '📱', '👶', '🐾'].map((e) => `<option ${e === g.icon ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
    </div>
    <label class="check"><input type="checkbox" name="reserva" ${g.kind === 'reserva' ? 'checked' : ''}><span>Esta é minha reserva de emergência</span></label>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions">
      ${goal ? `<button type="button" class="btn ghost danger-text" data-del-goal>${icon('trash', { size: 18 })} Excluir</button>` : ''}
      <button type="submit" class="btn primary">${goal ? 'Salvar meta' : 'Criar meta'}</button>
    </div>
  </form>`);
  const form = dlg.querySelector('form');
  const err = form.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = parseMoney(form.target.value);
    const saved = form.saved ? parseMoney(form.saved.value || '0') : g.saved;
    if (!form.name.value.trim()) { err.textContent = 'Dê um nome para a meta.'; err.hidden = false; form.name.focus(); return; }
    if (!(target > 0)) { err.textContent = 'Informe quanto quer juntar.'; err.hidden = false; form.target.focus(); return; }
    if (!(saved >= 0)) { err.textContent = 'O valor já guardado não é válido.'; err.hidden = false; return; }
    const isRes = form.reserva.checked;
    if (isRes && state.goals.some((x) => x.kind === 'reserva' && x.id !== goal?.id)) {
      err.textContent = 'Você já tem uma meta marcada como reserva de emergência.'; err.hidden = false; return;
    }
    await upsertGoal({
      ...(goal ? { id: goal.id } : {}), name: form.name.value.trim(), target, saved,
      deadline: form.deadline.value || null, icon: form.icon.value, kind: isRes ? 'reserva' : 'outro',
    });
    dlg.close();
    toast(goal ? 'Meta atualizada.' : 'Meta criada.', { tone: 'good' });
  });
  form.querySelector('[data-del-goal]')?.addEventListener('click', async () => {
    dlg.close();
    if (await confirmDialog({ title: 'Excluir meta?', text: `A meta "${esc(goal.name)}" será removida. Os lançamentos já registrados continuam.`, confirmLabel: 'Excluir', danger: true })) {
      await deleteGoal(goal.id);
      toast('Meta excluída.');
    }
  });
}

/** Guardar/retirar de uma meta, ou registrar o pagamento de uma dívida (kind 'divida'). */
function openContribForm(goal, withdraw = false) {
  const debt = isDebt(goal);
  const dlg = openDialog(`<form class="sheet-body" novalidate>
    ${sheetHeader(debt ? `Pagamento: ${goal.name}` : withdraw ? `Retirar de "${goal.name}"` : `Guardar em "${goal.name}"`)}
    ${moneyInput({ name: 'amount', label: debt ? 'Quanto pagou' : withdraw ? 'Quanto vai retirar' : 'Quanto vai guardar', required: true, id: 'c-amount',
    value: debt && goal.installment ? centsToInput(Math.min(goal.installment, debtRemaining(goal))) : '',
    hint: debt ? `Faltam ${fmtBRL(debtRemaining(goal))}.` : withdraw ? `Disponível: ${fmtBRL(goal.saved)}` : '' })}
    <label class="check"><input type="checkbox" name="register" checked>
      <span>Registrar também nos lançamentos do mês <small>(${debt ? 'como despesa em "Dívidas e parcelas"' : withdraw ? 'como receita' : 'como despesa em "Guardar e investir"'})</small></span></label>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions"><button type="submit" class="btn primary">${debt ? 'Registrar pagamento' : withdraw ? 'Retirar' : 'Guardar'}</button></div>
  </form>`);
  const form = dlg.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseMoney(form.amount.value);
    const err = form.querySelector('.form-error');
    if (!(v > 0)) { err.textContent = 'Informe um valor maior que zero.'; err.hidden = false; return; }
    try {
      await contributeGoal(goal.id, withdraw ? -v : v, { registerTx: form.register.checked });
      dlg.close();
      const g = goalById(goal.id);
      toast(debt ? (debtRemaining(g) ? `Pagamento registrado. Faltam ${fmtBRL(debtRemaining(g))}.` : `Dívida quitada: ${esc(g.name)}!`)
        : withdraw ? `Retirado ${fmtBRL(v)}.` : `Guardado ${fmtBRL(v)}. Agora são ${fmtBRL(g.saved)}.`, { tone: 'good' });
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
    }
  });
}

export function mount(root, { params }) {
  root.querySelector('[data-suggest]')?.addEventListener('click', async () => {
    const income = referenceIncome(state, ui.ym);
    const ok = await confirmDialog({
      title: 'Sugerir limites pelo 50/30/20?',
      text: `Vamos dividir ${fmtBRL(income)} entre as categorias, proporcionalmente ao que você costuma gastar em cada uma. Os limites atuais serão substituídos e você pode ajustar depois.`,
      confirmLabel: 'Aplicar sugestão',
    });
    if (!ok) return;
    await setBudgets(suggestBudgets(state, income, ui.ym));
    toast('Limites sugeridos aplicados. Ajuste o que não fizer sentido para você.', { tone: 'good' });
  });

  const form = root.querySelector('#budget-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const map = {};
    const bad = [];
    for (const input of form.querySelectorAll('input')) {
      const raw = input.value.trim();
      const v = raw ? parseMoney(raw) : 0;
      if (!(v >= 0)) { bad.push(input); continue; }
      map[input.name] = v;
    }
    if (bad.length) { bad[0].focus(); toast('Algum valor não é válido. Use números, por exemplo 350,00.', { tone: 'alert' }); return; }
    await setBudgets(map);
    toast('Limites salvos.', { tone: 'good' });
  });

  root.querySelectorAll('[data-new-goal]').forEach((b) => b.addEventListener('click', () => openGoalForm(null, b.dataset.newGoal || null)));
  root.querySelectorAll('[data-edit-goal]').forEach((b) => b.addEventListener('click', () => openGoalForm(goalById(b.dataset.editGoal))));
  root.querySelectorAll('[data-contrib]').forEach((b) => b.addEventListener('click', () => openContribForm(goalById(b.dataset.contrib))));
  root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => openContribForm(goalById(b.dataset.withdraw), true)));

  root.querySelectorAll('[data-new-debt]').forEach((b) => b.addEventListener('click', () => openDebtForm()));
  root.querySelectorAll('[data-edit-debt]').forEach((b) => b.addEventListener('click', () => openDebtForm(goalById(b.dataset.editDebt))));
  root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => openContribForm(goalById(b.dataset.pay))));

  // Atalhos vindos do painel do objetivo, das lições e das dicas (o parâmetro sai da URL ao abrir).
  if ([...params.keys()].length) history.replaceState(null, '', '#/planejar');
  const preset = params.get('nova-meta');
  const reserve = state.goals.find((g) => g.kind === 'reserva');
  if (preset) {
    openGoalForm((preset === 'reserva' && reserve) || null, preset);
  } else if (params.get('guardar') === 'reserva') {
    if (reserve) openContribForm(reserve); else openGoalForm(null, 'reserva');
  } else if (params.get('nova-divida')) {
    openDebtForm();
  } else if (params.get('pagar')) {
    const d = goalById(params.get('pagar'));
    if (d && isDebt(d) && debtRemaining(d) > 0) openContribForm(d);
  } else if (params.get('sugerir')) {
    root.querySelector('[data-suggest]')?.click();
  } else if (params.get('ver') === 'dividas') {
    // Depois do roteador, que leva a página nova para o topo.
    setTimeout(() => root.querySelector('#dividas')?.scrollIntoView({ block: 'start' }), 0);
  }
}

