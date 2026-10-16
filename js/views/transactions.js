// Lançamentos do mês: filtros, busca, lista agrupada por dia e acesso à planilha do Excel.
// Despesas têm um botão de pago/a pagar ao lado (um toque, sem abrir o formulário).
import { state, setTransactionPaid } from '../store.js';
import { ui, monthNav, emptyState, toast } from '../ui.js';
import { esc, fmtBRL, fmtDateLong, monthLabel, normalize, sum, todayISO } from '../utils.js';
import { isPaid, paidWithOf, payStatus, txOfMonth } from '../finance.js';
import { openTxForm } from './txform.js';
import { openSheetDialog } from './spreadsheet-dialog.js';
import { icon } from '../icons.js';

// status: 'all' | 'due' (a pagar) | 'paid' (pagas). from: '' | 'salario' | 'cartao' (de onde saiu).
// Os dois só valem para despesas: ligados, a lista mostra só despesas (receita não tem pago nem origem).
const filters = { type: 'all', q: '', cat: '', status: 'all', from: '' };
const STATUS_PARAM = { apagar: 'due', pagas: 'paid' };
const FROM_PARAM = { salario: 'salario', cartao: 'cartao' };

const statusActive = () => filters.status !== 'all' && filters.type !== 'income';
const fromActive = () => Boolean(filters.from) && filters.type !== 'income';

function filtered(today) {
  const q = normalize(filters.q.trim());
  return txOfMonth(state, ui.ym).filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;
    if (statusActive()) {
      if (t.type !== 'expense') return false;
      if (isPaid(t, today) !== (filters.status === 'paid')) return false;
    }
    if (fromActive() && paidWithOf(t) !== filters.from) return false; // receita: paidWithOf = null, sai
    if (filters.cat && t.categoryId !== filters.cat) return false;
    if (q) {
      const cat = state.categories.find((c) => c.id === t.categoryId)?.name || '';
      if (!normalize(`${t.description} ${cat}`).includes(q)) return false;
    }
    return true;
  });
}

const txName = (t, c) => t.description || c?.name || 'Lançamento';

/** Selo da despesa não paga: "A pagar" ou, se a data já passou, "Atrasada" (tom de alerta). */
function payTag(st) {
  if (st === 'late') return ` <span class="tag tag-late">${icon('alert', { size: 12 })} Atrasada</span>`;
  if (st === 'due') return ' <span class="tag tag-due">A pagar</span>';
  return '';
}

function payButton(t, c, st) {
  const paid = st === 'paid';
  const label = `Marcar ${txName(t, c)} como ${paid ? 'não pago' : 'pago'}`;
  return `<button type="button" class="pay-toggle ${paid ? 'is-paid' : `is-${st}`}" data-pay="${esc(t.id)}"
      aria-label="${esc(label)}" title="${esc(label)}"><span class="pay-dot">${paid ? icon('check', { size: 16 }) : ''}</span></button>`;
}

function listHTML() {
  const today = todayISO();
  const txs = filtered(today);
  if (!txs.length) {
    const any = txOfMonth(state, ui.ym).length > 0;
    if (any && statusActive() && filters.status === 'due' && !filters.q.trim() && !filters.cat && !fromActive()) {
      return emptyState({ title: 'Nenhuma conta a pagar', text: `Todas as despesas de ${monthLabel(ui.ym).toLowerCase()} estão marcadas como pagas.` });
    }
    return any
      ? emptyState({ title: 'Nada encontrado', text: 'Nenhum lançamento corresponde aos filtros. Tente limpar a busca.' })
      : emptyState({
        title: `Nenhum lançamento em ${monthLabel(ui.ym).toLowerCase()}`,
        text: 'Registre o que entrou e o que saiu. Salário e aluguel podem ser marcados para repetir todo mês.',
        action: `<button type="button" class="btn primary" data-new-tx="expense">${icon('plus', { size: 18 })} Novo lançamento</button>`,
      });
  }
  const byDay = new Map();
  for (const t of txs) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  const totalIn = sum(txs.filter((t) => t.type === 'income'), (t) => t.amount);
  const totalOut = sum(txs.filter((t) => t.type === 'expense'), (t) => t.amount);
  const totalDue = sum(txs.filter((t) => !isPaid(t, today)), (t) => t.amount);
  return `<p class="list-summary">${txs.length} ${txs.length === 1 ? 'lançamento' : 'lançamentos'}:
      <span class="pos">+${fmtBRL(totalIn)}</span> <span class="neg">−${fmtBRL(totalOut)}</span>${totalDue ? `
      <span class="due-sum">a pagar ${fmtBRL(totalDue)}</span>` : ''}</p>
    ${[...byDay.entries()].map(([day, items]) => {
    const net = sum(items, (t) => (t.type === 'income' ? t.amount : -t.amount));
    return `<section class="day" aria-label="${esc(fmtDateLong(day))}">
        <h3 class="day-head"><span>${esc(fmtDateLong(day))}</span><span class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${fmtBRL(Math.abs(net))}</span></h3>
        <ul class="tx-list">${items.map((t) => {
      const c = state.categories.find((x) => x.id === t.categoryId);
      const st = t.type === 'expense' ? payStatus(t, today) : null;
      return `<li class="tx-row"><button type="button" class="tx" data-edit="${esc(t.id)}">
            <span class="tx-icon" aria-hidden="true">${c?.icon || '•'}</span>
            <span class="tx-main">
              <span class="tx-desc">${esc(txName(t, c))}</span>
              <span class="tx-meta">${esc(c?.name || 'Sem categoria')}${t.nature === 'fixo' ? ', fixo' : ''}${t.seriesId ? ` <span class="tag">${icon('repeat', { size: 12 })} mensal</span>` : ''}${paidWithOf(t) === 'cartao' ? ` <span class="tag tag-card">${icon('card', { size: 12 })} Cartão</span>` : ''}${st ? payTag(st) : ''}</span>
            </span>
            <span class="tx-amount ${t.type === 'income' ? 'pos' : 'neg'}">${t.type === 'income' ? '+' : '−'}${fmtBRL(t.amount)}</span>
          </button>${st ? payButton(t, c, st) : '<span class="pay-slot" aria-hidden="true"></span>'}</li>`;
    }).join('')}</ul>
      </section>`;
  }).join('')}`;
}

function chipGroup(label, attr, current, options, { hidden = false } = {}) {
  return `<div class="chips" role="radiogroup" aria-label="${label}" ${hidden ? 'hidden' : ''} data-group="${attr}">
      ${options.map(([v, l]) => `
        <button type="button" class="chip" role="radio" aria-checked="${current === v}" data-${attr}="${v}">${l}</button>`).join('')}
    </div>`;
}

export function render({ params } = {}) {
  // Atalho do Início ("A pagar no mês" → #/lancamentos?pagamento=apagar): já abre filtrado.
  const fromLink = STATUS_PARAM[params?.get('pagamento')];
  if (fromLink) Object.assign(filters, { status: fromLink, type: 'all', q: '', cat: '', from: '' });
  // Atalho do Início ("No cartão" → #/lancamentos?saiu=cartao).
  const fromParam = FROM_PARAM[params?.get('saiu')];
  if (fromParam) Object.assign(filters, { from: fromParam, type: 'all', q: '', cat: '', status: 'all' });
  const cats = state.categories;
  return `
  <header class="page-head"><div><h1 class="page-title">Lançamentos</h1></div>
    <div class="head-actions">
      <button type="button" class="btn ghost small" data-sheet aria-haspopup="dialog">${icon('sheet', { size: 16 })} Planilha</button>
      <button type="button" class="btn primary only-desktop" data-new-tx="expense">${icon('plus', { size: 18 })} Novo lançamento</button>
    </div>
  </header>
  ${monthNav(ui.ym)}
  <div class="filters" role="search">
    <div class="chip-groups">
      ${chipGroup('Filtrar por tipo', 'type', filters.type, [['all', 'Todos'], ['expense', 'Despesas'], ['income', 'Receitas']])}
      ${chipGroup('Filtrar despesas por pagamento', 'status', filters.status, [['all', 'Todas'], ['due', 'A pagar'], ['paid', 'Pagas']], { hidden: filters.type === 'income' })}
    </div>
    <label class="search">${icon('search', { size: 18 })}<span class="sr-only">Buscar</span>
      <input type="search" id="tx-search" placeholder="Buscar descrição ou categoria" value="${esc(filters.q)}"></label>
    <div class="filter-selects">
      <label class="sr-only" for="tx-cat-filter">Categoria</label>
      <select id="tx-cat-filter" class="compact">
        <option value="">Todas as categorias</option>
        ${cats.map((c) => `<option value="${esc(c.id)}" ${filters.cat === c.id ? 'selected' : ''}>${c.icon || ''} ${esc(c.name)}</option>`).join('')}
      </select>
      <label class="sr-only" for="tx-from-filter">De onde saiu (só despesas)</label>
      <select id="tx-from-filter" class="compact" ${filters.type === 'income' ? 'hidden' : ''}>
        ${[['', 'Salário e cartão'], ['salario', 'Só salário'], ['cartao', 'Só cartão']].map(([v, l]) => `<option value="${v}" ${filters.from === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
  </div>
  <div id="tx-results">${listHTML()}</div>`;
}

/** Alterna pago/a pagar e devolve o foco a um botão equivalente (a lista é redesenhada inteira). */
async function togglePaid(btn, root) {
  const tx = state.transactions.find((t) => t.id === btn.dataset.pay);
  if (!tx) return;
  const index = [...root.querySelectorAll('[data-pay]')].indexOf(btn);
  const wasPaid = isPaid(tx);
  const name = txName(tx, state.categories.find((c) => c.id === tx.categoryId));
  btn.disabled = true;
  try {
    await setTransactionPaid(tx.id, !wasPaid);
  } catch (ex) {
    btn.disabled = false;
    toast(esc(ex?.message || 'Não foi possível salvar. Tente de novo.'), { tone: 'alert' });
    return;
  }
  // O redesenho já aconteceu (onChange). Com o filtro "A pagar"/"Pagas", o item pode ter saído da lista:
  // o foco vai para o próximo da lista (ou o anterior), ou para a área de resultados.
  const main = document.getElementById('main') || document;
  const pays = [...main.querySelectorAll('[data-pay]')];
  const next = main.querySelector(`[data-pay="${CSS.escape(tx.id)}"]`) || pays[Math.min(index, pays.length - 1)];
  if (next) next.focus();
  else { const res = main.querySelector('#tx-results'); if (res) { res.tabIndex = -1; res.focus(); } }
  toast(`${wasPaid ? 'Marcado como a pagar' : 'Marcado como pago'}: ${esc(name)}.`, {
    tone: 'good', action: { label: 'Desfazer', run: () => setTransactionPaid(tx.id, wasPaid).catch(() => {}) },
  });
}

export function mount(root, { params }) {
  const results = root.querySelector('#tx-results');
  const statusGroup = root.querySelector('[data-group="status"]');
  const fromSel = root.querySelector('#tx-from-filter');
  const refresh = () => { results.innerHTML = listHTML(); };
  root.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    filters.type = b.dataset.type;
    root.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    statusGroup.hidden = filters.type === 'income'; // receita não tem pago/a pagar
    fromSel.hidden = filters.type === 'income'; // nem origem
    refresh();
  }));
  fromSel.addEventListener('change', (e) => { filters.from = e.target.value; refresh(); });
  root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    filters.status = b.dataset.status;
    root.querySelectorAll('[data-status]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    refresh();
  }));
  root.querySelector('[data-sheet]').addEventListener('click', () => openSheetDialog());
  root.querySelector('#tx-search').addEventListener('input', (e) => { filters.q = e.target.value; refresh(); });
  root.querySelector('#tx-cat-filter').addEventListener('change', (e) => { filters.cat = e.target.value; refresh(); });
  results.addEventListener('click', (e) => {
    const pay = e.target.closest('[data-pay]');
    if (pay) { togglePaid(pay, root); return; }
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const tx = state.transactions.find((t) => t.id === btn.dataset.edit);
    if (tx) openTxForm({ tx });
  });
  if (params.get('pagamento') || params.get('saiu')) history.replaceState(null, '', '#/lancamentos');
  if (params.get('novo')) {
    const type = params.get('novo') === 'receita' ? 'income' : 'expense';
    history.replaceState(null, '', '#/lancamentos');
    openTxForm({ type });
  }
}
