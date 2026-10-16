// Formulário de lançamento (novo ou edição) num <dialog>.
import { state, addTransaction, updateTransaction, deleteTransaction, stopRecurrence, recurrenceById, categoryById } from '../store.js';
import { openDialog, sheetHeader, toast, moneyInput, confirmDialog } from '../ui.js';
import { centsToInput, esc, fmtBRL, monthOf, parseMoney, todayISO, monthLabel, currentMonth, monthCmp } from '../utils.js';
import { budgetStatus } from '../finance.js';
import { icon } from '../icons.js';

function categoryOptions(type, selected) {
  return state.categories
    .filter((c) => c.type === type)
    .map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${c.icon || ''} ${esc(c.name)}</option>`)
    .join('');
}

export function openTxForm({ tx = null, type = 'expense', date } = {}) {
  const editing = Boolean(tx);
  const t = tx || { type, amount: null, date: date || todayISO(), categoryId: type === 'income' ? 'salario' : 'alimentacao', description: '', nature: 'variavel' };
  const rec = tx?.seriesId ? recurrenceById(tx.seriesId) : null;
  const recActive = rec && (!rec.endMonth || monthCmp(rec.endMonth, currentMonth()) > 0);

  const dlg = openDialog(`
    <form class="sheet-body tx-form" novalidate>
      ${sheetHeader(editing ? 'Editar lançamento' : 'Novo lançamento', 'tx-dialog-title')}
      <fieldset class="segmented" aria-label="Tipo de lançamento">
        <legend class="sr-only">Tipo</legend>
        <label><input type="radio" name="type" value="expense" ${t.type === 'expense' ? 'checked' : ''}><span>${icon('down', { size: 18 })} Despesa</span></label>
        <label><input type="radio" name="type" value="income" ${t.type === 'income' ? 'checked' : ''}><span>${icon('up', { size: 18 })} Receita</span></label>
      </fieldset>
      ${moneyInput({ name: 'amount', label: 'Valor', value: t.amount ? centsToInput(t.amount) : '', required: true, id: 'tx-amount' })}
      <label class="field" for="tx-desc"><span class="field-label">Descrição</span>
        <input id="tx-desc" name="description" type="text" maxlength="120" value="${esc(t.description)}" placeholder="Ex.: feira da semana" autocomplete="off"></label>
      <div class="grid-2">
        <label class="field" for="tx-cat"><span class="field-label">Categoria</span>
          <select id="tx-cat" name="categoryId">${categoryOptions(t.type, t.categoryId)}</select></label>
        <label class="field" for="tx-date"><span class="field-label">Data</span>
          <input id="tx-date" name="date" type="date" value="${esc(t.date)}" required></label>
      </div>
      <fieldset class="segmented small" aria-label="Natureza do gasto">
        <legend class="field-label">Esse valor é</legend>
        <label><input type="radio" name="nature" value="variavel" ${t.nature !== 'fixo' ? 'checked' : ''}><span>Variável</span></label>
        <label><input type="radio" name="nature" value="fixo" ${t.nature === 'fixo' ? 'checked' : ''}><span>Fixo</span></label>
      </fieldset>
      ${editing ? '' : `<label class="check"><input type="checkbox" name="recurring"><span>Repetir todo mês <small>(cria automaticamente nos próximos meses)</small></span></label>`}
      ${rec ? `<div class="series-box">
          <p>${icon('repeat', { size: 18 })} Faz parte de uma série mensal${recActive ? '' : ` encerrada em ${monthLabel(rec.endMonth).toLowerCase()}`}.</p>
          ${recActive ? `<label class="check"><input type="checkbox" name="applyToSeries"><span>Aplicar as mudanças também aos próximos meses</span></label>
          <button type="button" class="btn ghost small" data-stop-series>Parar de repetir nos próximos meses</button>` : ''}
        </div>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <div class="actions">
        ${editing ? `<button type="button" class="btn ghost danger-text" data-delete>${icon('trash', { size: 18 })} Excluir</button>` : ''}
        <button type="submit" class="btn primary">${editing ? 'Salvar alterações' : 'Adicionar lançamento'}</button>
      </div>
    </form>`, { id: 'tx-dialog' });

  const form = dlg.querySelector('form');
  const err = form.querySelector('.form-error');
  const catSel = form.querySelector('#tx-cat');
  const showError = (msg) => { err.textContent = msg; err.hidden = false; };

  form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', () => {
    const newType = form.type.value;
    catSel.innerHTML = categoryOptions(newType, newType === 'income' ? 'salario' : 'alimentacao');
  }));
  if (!editing) setTimeout(() => form.querySelector('#tx-amount').focus(), 30);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const amount = parseMoney(form.amount.value);
    if (!(amount > 0)) { showError('Informe um valor maior que zero, por exemplo 25,90.'); form.amount.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.value)) { showError('Escolha uma data válida.'); form.date.focus(); return; }
    if (!categoryById(form.categoryId.value)) { showError('Escolha uma categoria.'); return; }
    const data = {
      type: form.type.value, amount, date: form.date.value, categoryId: form.categoryId.value,
      description: form.description.value, nature: form.nature.value,
    };
    const ym = monthOf(data.date);
    const before = new Map(budgetStatus(state, ym).map((b) => [b.category.id, b.level]));
    try {
      if (editing) {
        await updateTransaction(tx.id, data, { applyToSeries: Boolean(form.applyToSeries?.checked) });
        toast('Lançamento atualizado.', { tone: 'good' });
      } else {
        await addTransaction(data, { recurring: Boolean(form.recurring?.checked) });
        toast(`${data.type === 'income' ? 'Receita' : 'Despesa'} de ${fmtBRL(amount)} adicionada.`, { tone: 'good' });
      }
      dlg.close();
      // Alerta de orçamento: avisa só quando a categoria muda de nível com este lançamento.
      const after = budgetStatus(state, ym).find((b) => b.category.id === data.categoryId);
      if (data.type === 'expense' && after && after.level !== 'ok' && before.get(data.categoryId) !== after.level) {
        toast(after.level === 'over'
          ? `${esc(after.category.name)} passou do limite de ${fmtBRL(after.limit)} neste mês.`
          : `${esc(after.category.name)} já usou ${Math.round(after.ratio * 100)}% do limite do mês.`,
        { tone: after.level === 'over' ? 'alert' : 'warn', timeout: 7000, action: { label: 'Ver orçamento', run: () => { location.hash = '#/planejar'; } } });
      }
    } catch (ex) {
      showError(ex.message || 'Não foi possível salvar. Tente de novo.');
    }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    dlg.close();
    const ok = await confirmDialog({
      title: 'Excluir lançamento?',
      text: `${esc(t.description || categoryById(t.categoryId)?.name || 'Lançamento')} de ${fmtBRL(t.amount)} será removido.${rec ? ' Os outros meses da série continuam.' : ''}`,
      confirmLabel: 'Excluir', danger: true,
    });
    if (!ok) return;
    const snapshot = { ...tx };
    await deleteTransaction(tx.id);
    toast('Lançamento excluído.', snapshot.seriesId ? {} : {
      action: { label: 'Desfazer', run: () => addTransaction(snapshot) },
    });
  });

  form.querySelector('[data-stop-series]')?.addEventListener('click', async () => {
    await stopRecurrence(rec.id);
    dlg.close();
    toast('A série não vai mais se repetir nos próximos meses. Os lançamentos já feitos continuam.', { tone: 'good' });
  });
}
