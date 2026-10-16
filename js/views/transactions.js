// Lançamentos do mês: filtros, busca e lista agrupada por dia.
import { state } from '../store.js';
import { ui, monthNav, emptyState } from '../ui.js';
import { esc, fmtBRL, fmtDateLong, monthLabel, normalize, sum } from '../utils.js';
import { txOfMonth } from '../finance.js';
import { openTxForm } from './txform.js';
import { icon } from '../icons.js';

const filters = { type: 'all', q: '', cat: '' };

function filtered() {
  const q = normalize(filters.q.trim());
  return txOfMonth(state, ui.ym).filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;
    if (filters.cat && t.categoryId !== filters.cat) return false;
    if (q) {
      const cat = state.categories.find((c) => c.id === t.categoryId)?.name || '';
      if (!normalize(`${t.description} ${cat}`).includes(q)) return false;
    }
    return true;
  });
}

function listHTML() {
  const txs = filtered();
  if (!txs.length) {
    const any = txOfMonth(state, ui.ym).length > 0;
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
  return `<p class="list-summary">${txs.length} ${txs.length === 1 ? 'lançamento' : 'lançamentos'}:
      <span class="pos">+${fmtBRL(totalIn)}</span> <span class="neg">−${fmtBRL(totalOut)}</span></p>
    ${[...byDay.entries()].map(([day, items]) => {
    const net = sum(items, (t) => (t.type === 'income' ? t.amount : -t.amount));
    return `<section class="day" aria-label="${esc(fmtDateLong(day))}">
        <h3 class="day-head"><span>${esc(fmtDateLong(day))}</span><span class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${fmtBRL(Math.abs(net))}</span></h3>
        <ul class="tx-list">${items.map((t) => {
      const c = state.categories.find((x) => x.id === t.categoryId);
      return `<li><button type="button" class="tx" data-edit="${esc(t.id)}">
            <span class="tx-icon" aria-hidden="true">${c?.icon || '•'}</span>
            <span class="tx-main">
              <span class="tx-desc">${esc(t.description || c?.name || 'Lançamento')}</span>
              <span class="tx-meta">${esc(c?.name || 'Sem categoria')}${t.nature === 'fixo' ? ', fixo' : ''}${t.seriesId ? ` <span class="tag">${icon('repeat', { size: 12 })} mensal</span>` : ''}</span>
            </span>
            <span class="tx-amount ${t.type === 'income' ? 'pos' : 'neg'}">${t.type === 'income' ? '+' : '−'}${fmtBRL(t.amount)}</span>
          </button></li>`;
    }).join('')}</ul>
      </section>`;
  }).join('')}`;
}

export function render() {
  const cats = state.categories;
  return `
  <header class="page-head"><div><h1 class="page-title">Lançamentos</h1></div>
    <button type="button" class="btn primary only-desktop" data-new-tx="expense">${icon('plus', { size: 18 })} Novo lançamento</button>
  </header>
  ${monthNav(ui.ym)}
  <div class="filters" role="search">
    <div class="chips" role="radiogroup" aria-label="Filtrar por tipo">
      ${[['all', 'Todos'], ['expense', 'Despesas'], ['income', 'Receitas']].map(([v, l]) => `
        <button type="button" class="chip" role="radio" aria-checked="${filters.type === v}" data-type="${v}">${l}</button>`).join('')}
    </div>
    <label class="search">${icon('search', { size: 18 })}<span class="sr-only">Buscar</span>
      <input type="search" id="tx-search" placeholder="Buscar descrição ou categoria" value="${esc(filters.q)}"></label>
    <label class="sr-only" for="tx-cat-filter">Categoria</label>
    <select id="tx-cat-filter" class="compact">
      <option value="">Todas as categorias</option>
      ${cats.map((c) => `<option value="${esc(c.id)}" ${filters.cat === c.id ? 'selected' : ''}>${c.icon || ''} ${esc(c.name)}</option>`).join('')}
    </select>
  </div>
  <div id="tx-results">${listHTML()}</div>`;
}

export function mount(root, { params }) {
  const results = root.querySelector('#tx-results');
  const refresh = () => { results.innerHTML = listHTML(); };
  root.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    filters.type = b.dataset.type;
    root.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    refresh();
  }));
  root.querySelector('#tx-search').addEventListener('input', (e) => { filters.q = e.target.value; refresh(); });
  root.querySelector('#tx-cat-filter').addEventListener('change', (e) => { filters.cat = e.target.value; refresh(); });
  results.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const tx = state.transactions.find((t) => t.id === btn.dataset.edit);
    if (tx) openTxForm({ tx });
  });
  if (params.get('novo')) {
    const type = params.get('novo') === 'receita' ? 'income' : 'expense';
    history.replaceState(null, '', '#/lancamentos');
    openTxForm({ type });
  }
}
