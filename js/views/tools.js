// Ferramentas: simuladores de juros compostos, tempo até a meta e custo real de dívida/parcelamento.
import { state } from '../store.js';
import { esc, fmtBRL, fmtPct1, parseDecimal, parseMoney, centsToInput, monthLabel, addMonths, currentMonth } from '../utils.js';
import { annualToMonthly, monthlyToAnnual, compound, timeToGoal, impliedRate, debtPayoff } from '../calc.js';
import { growthChart } from '../charts.js';
import { icon } from '../icons.js';

const TABS = [
  { id: 'juros', label: 'Juros compostos' },
  { id: 'meta', label: 'Tempo até a meta' },
  { id: 'divida', label: 'Custo de dívida' },
];
let active = 'juros';

const R = (cents) => fmtBRL(Math.round(cents * 100)); // reais -> texto
const money = (v) => { const c = parseMoney(v); return Number.isFinite(c) ? c / 100 : NaN; };
const num = (v) => parseDecimal(v);

function durationText(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'ano' : 'anos'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ') || 'menos de 1 mês';
}

const field = (id, label, value, { suffix = '', prefix = '', hint = '' } = {}) => `
  <label class="field" for="${id}"><span class="field-label">${label}</span>
    <span class="money-wrap">${prefix ? `<span aria-hidden="true">${prefix}</span>` : ''}
      <input id="${id}" name="${id}" inputmode="decimal" autocomplete="off" value="${esc(value)}">
      ${suffix ? `<span aria-hidden="true">${suffix}</span>` : ''}</span>
    ${hint ? `<span class="field-hint">${hint}</span>` : ''}
  </label>`;

function panelJuros() {
  return `<form class="calc" data-calc="juros" novalidate>
    <div class="grid-2">
      ${field('j-ini', 'Valor inicial', '1.000,00', { prefix: 'R$' })}
      ${field('j-mes', 'Aporte por mês', '200,00', { prefix: 'R$' })}
      <div class="field"><label class="field-label" for="j-taxa">Rendimento</label>
        <div class="inline"><span class="money-wrap"><input id="j-taxa" name="j-taxa" inputmode="decimal" value="10" aria-describedby="j-taxa-u"><span aria-hidden="true">%</span></span>
        <select id="j-taxa-u" name="j-taxa-u" aria-label="Período da taxa"><option value="a">ao ano</option><option value="m">ao mês</option></select></div></div>
      <div class="field"><label class="field-label" for="j-prazo">Prazo</label>
        <div class="inline"><span class="money-wrap"><input id="j-prazo" name="j-prazo" inputmode="numeric" value="10"></span>
        <select id="j-prazo-u" name="j-prazo-u" aria-label="Unidade do prazo"><option value="a">anos</option><option value="m">meses</option></select></div></div>
    </div>
    <div class="calc-out" aria-live="polite"></div>
    <p class="note">${icon('info', { size: 16 })} Simulação educativa com taxa constante, sem impostos, taxas ou inflação. Rendimentos reais variam.
      <a href="#/aprender/juros-compostos">Lição sobre juros compostos</a></p>
  </form>`;
}

function calcJuros(form) {
  const ini = money(form['j-ini'].value) || 0;
  const mes = money(form['j-mes'].value) || 0;
  const taxa = num(form['j-taxa'].value) / 100;
  const prazo = Math.round(num(form['j-prazo'].value));
  if (!(taxa >= 0) || !(prazo > 0) || ini < 0 || mes < 0) return '<p class="form-error">Preencha valores válidos (prazo maior que zero).</p>';
  const months = form['j-prazo-u'].value === 'a' ? prazo * 12 : prazo;
  if (months > 1200) return '<p class="form-error">Use um prazo de até 100 anos.</p>';
  const rate = form['j-taxa-u'].value === 'a' ? annualToMonthly(taxa) : taxa;
  const r = compound({ initial: ini, monthly: mes, rate, months });
  return `<dl class="results">
      <div class="res-main"><dt>Você teria</dt><dd>${R(r.total)}</dd></div>
      <div><dt>Dinheiro que você colocou</dt><dd>${R(r.invested)}</dd></div>
      <div><dt>Ganho com juros</dt><dd class="pos">${R(r.interest)}</dd></div>
      <div><dt>Taxa equivalente</dt><dd>${fmtPct1(rate)} ao mês, ${fmtPct1(monthlyToAnnual(rate))} ao ano</dd></div>
    </dl>${growthChart(r.series)}`;
}

function panelMeta() {
  const goal = state.goals.find((g) => g.saved < g.target) || null;
  return `<form class="calc" data-calc="meta" novalidate>
    ${goal ? `<p class="lead">Preenchido com a sua meta <strong>${esc(goal.name)}</strong>.</p>` : ''}
    <div class="grid-2">
      ${field('m-alvo', 'Quanto quer juntar', goal ? centsToInput(goal.target) : '10.000,00', { prefix: 'R$' })}
      ${field('m-tenho', 'Já tem guardado', goal ? centsToInput(goal.saved) : '0', { prefix: 'R$' })}
      ${field('m-mes', 'Vai guardar por mês', '300,00', { prefix: 'R$' })}
      ${field('m-taxa', 'Rendimento esperado', '8', { suffix: '% ao ano', hint: 'Use 0 se o dinheiro ficar parado.' })}
    </div>
    <div class="calc-out" aria-live="polite"></div>
    <p class="note">${icon('info', { size: 16 })} Estimativa com rendimento constante e sem impostos.</p>
  </form>`;
}

function calcMeta(form) {
  const target = money(form['m-alvo'].value);
  const current = money(form['m-tenho'].value || '0') || 0;
  const monthly = money(form['m-mes'].value || '0') || 0;
  const taxa = num(form['m-taxa'].value || '0') / 100;
  if (!(target > 0) || !(taxa >= 0)) return '<p class="form-error">Informe a meta e um rendimento válido.</p>';
  const r = timeToGoal({ target, current, monthly, rate: annualToMonthly(taxa) });
  if (!r) return '<p class="form-error">Com esses valores a meta não é alcançada em 100 anos. Aumente o valor guardado por mês.</p>';
  if (r.months === 0) return '<p class="pos">Você já alcançou essa meta.</p>';
  const noRate = timeToGoal({ target, current, monthly, rate: 0 });
  return `<dl class="results">
    <div class="res-main"><dt>Tempo estimado</dt><dd>${durationText(r.months)}</dd></div>
    <div><dt>Previsão</dt><dd>${monthLabel(addMonths(currentMonth(), r.months))}</dd></div>
    <div><dt>Você vai colocar</dt><dd>${R(r.invested)}</dd></div>
    <div><dt>Juros ajudam com</dt><dd class="pos">${R(r.total - r.invested)}</dd></div>
  </dl>${noRate && taxa > 0 && noRate.months > r.months ? `<p class="muted">Sem rendimento, levaria ${durationText(noRate.months)}.</p>` : ''}`;
}

function panelDivida() {
  return `<div class="calc-group">
    <form class="calc" data-calc="parcela" novalidate>
      <h3>Parcelado ou à vista?</h3>
      <p class="muted">Descubra os juros escondidos num parcelamento "sem juros" quando há desconto à vista.</p>
      <div class="grid-2">
        ${field('p-vista', 'Preço à vista', '900,00', { prefix: 'R$' })}
        ${field('p-n', 'Número de parcelas', '10')}
        ${field('p-parc', 'Valor de cada parcela', '100,00', { prefix: 'R$' })}
      </div>
      <label class="check"><input type="checkbox" name="p-entrada"><span>A primeira parcela é paga no ato da compra</span></label>
      <div class="calc-out" aria-live="polite"></div>
    </form>
    <form class="calc" data-calc="quitar" novalidate>
      <h3>Quanto custa uma dívida?</h3>
      <p class="muted">Para cartão, cheque especial ou empréstimo: veja em quanto tempo quita e quanto paga de juros.</p>
      <div class="grid-2">
        ${field('d-saldo', 'Saldo devedor', '2.000,00', { prefix: 'R$' })}
        ${field('d-taxa', 'Juros', '12', { suffix: '% ao mês' })}
        ${field('d-pag', 'Quanto consegue pagar por mês', '300,00', { prefix: 'R$' })}
      </div>
      <div class="calc-out" aria-live="polite"></div>
    </form>
    <p class="note">${icon('info', { size: 16 })} Cálculos aproximados (tabela Price, sem IOF e tarifas). Para comparar propostas reais, peça o CET.
      <a href="#/aprender/dividas">Lição sobre dívidas e juros</a></p>
  </div>`;
}

function calcParcela(form) {
  const cash = money(form['p-vista'].value);
  const n = Math.round(num(form['p-n'].value));
  const pmt = money(form['p-parc'].value);
  if (!(cash > 0 && n > 0 && pmt > 0)) return '<p class="form-error">Preencha preço, parcelas e valor da parcela.</p>';
  const r = impliedRate({ cash, pmt, n, firstNow: form['p-entrada'].checked });
  if (r.rate === 0) return `<p class="pos">Sem juros de verdade: o total parcelado (${R(r.total)}) não passa do preço à vista. Parcelar pode fazer sentido se couber no orçamento.</p>`;
  return `<dl class="results">
    <div class="res-main"><dt>Juros embutidos</dt><dd>${r.capped ? 'mais de 100%' : fmtPct1(r.rate)} ao mês</dd></div>
    <div><dt>Equivale a</dt><dd>${r.capped ? '—' : `${fmtPct1(monthlyToAnnual(r.rate))} ao ano`}</dd></div>
    <div><dt>Total parcelado</dt><dd>${R(r.total)}</dd></div>
    <div><dt>Você paga a mais</dt><dd class="neg">${R(r.extra)}</dd></div>
  </dl>`;
}

function calcQuitar(form) {
  const balance = money(form['d-saldo'].value);
  const rate = num(form['d-taxa'].value) / 100;
  const payment = money(form['d-pag'].value);
  if (!(balance > 0 && rate >= 0 && payment > 0)) return '<p class="form-error">Preencha saldo, juros e pagamento.</p>';
  const r = debtPayoff({ balance, rate, payment });
  if (r.never) {
    return `<p class="callout alert">${icon('alert', { size: 18 })} Com ${R(payment)} por mês a dívida <strong>nunca acaba</strong>: só os juros do primeiro mês são ${R(r.firstInterest)}. Renegocie a taxa ou troque por um crédito mais barato.</p>`;
  }
  return `<dl class="results">
    <div class="res-main"><dt>Quitação em</dt><dd>${durationText(r.months)}</dd></div>
    <div><dt>Total pago</dt><dd>${R(r.totalPaid)}</dd></div>
    <div><dt>Só de juros</dt><dd class="neg">${R(r.interest)}</dd></div>
    <div><dt>Taxa ao ano</dt><dd>${fmtPct1(monthlyToAnnual(rate))}</dd></div>
  </dl>`;
}

const CALCS = { juros: calcJuros, meta: calcMeta, parcela: calcParcela, quitar: calcQuitar };

export function render() {
  const panels = { juros: panelJuros, meta: panelMeta, divida: panelDivida };
  return `<header class="page-head"><div><h1 class="page-title">Ferramentas</h1>
      <p class="page-sub">Simule antes de decidir.</p></div></header>
    <div class="tabs" role="tablist" aria-label="Simuladores">
      ${TABS.map((t) => `<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${t.id === active}" tabindex="${t.id === active ? 0 : -1}" class="tab">${t.label}</button>`).join('')}
    </div>
    ${TABS.map((t) => `<section role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" class="block" ${t.id === active ? '' : 'hidden'}>${panels[t.id]()}</section>`).join('')}`;
}

export function mount(root) {
  const update = (form) => { form.querySelector('.calc-out').innerHTML = CALCS[form.dataset.calc](form); };
  root.querySelectorAll('form.calc').forEach((form) => {
    form.addEventListener('input', () => update(form));
    form.addEventListener('change', () => update(form));
    form.addEventListener('submit', (e) => e.preventDefault());
    update(form);
  });
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    active = tab.id.replace('tab-', '');
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next); next.focus();
    });
  });
}
