// Gráficos próprios, sem dependências. Cores vêm de variáveis CSS (--series-*) com tema claro/escuro.
import { esc, fmtBRL, fmtBRLCompact } from './utils.js';

/** Barra com só os cantos superiores arredondados (dado ancorado na base). */
function barPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Receitas x despesas por mês (barras agrupadas).
 * data: [{ label, income, expense }] em centavos.
 */
export function monthBars(data, { title = 'Receitas e despesas por mês' } = {}) {
  const W = 360, H = 210, padL = 46, padR = 6, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.income, d.expense)), 0));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const groupW = plotW / data.length;
  const barW = Math.min(16, (groupW - 10) / 2);
  const ticks = [0, 0.5, 1].map((f) => f * max);

  const grid = ticks.map((t) => `
    <line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/>
    <text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end" class="chart-axis">${esc(fmtBRLCompact(t))}</text>`).join('');

  const groups = data.map((d, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const xi = cx - barW - 1;
    const xe = cx + 1;
    const tip = `${d.label}: receitas ${fmtBRL(d.income)}, despesas ${fmtBRL(d.expense)}, saldo ${fmtBRL(d.income - d.expense)}`;
    return `<g class="chart-group" tabindex="0" aria-label="${esc(tip)}">
      <title>${esc(tip)}</title>
      <rect x="${padL + groupW * i}" y="${padT}" width="${groupW}" height="${plotH}" class="chart-hit"/>
      <path d="${barPath(xi, y(d.income), barW, y(0) - y(d.income))}" class="s-income"/>
      <path d="${barPath(xe, y(d.expense), barW, y(0) - y(d.expense))}" class="s-expense"/>
      <text x="${cx}" y="${H - 8}" text-anchor="middle" class="chart-axis${d.current ? ' is-current' : ''}">${esc(d.label)}</text>
    </g>`;
  }).join('');

  // Espaço normal depois do "R$" (o Intl usa um fixo) para a célula poder quebrar ali em tela estreita.
  const cell = (cents) => fmtBRL(cents).replace(/ /g, ' ');
  const rows = data.map((d) => `<tr><th scope="row">${esc(d.label)}</th><td>${cell(d.income)}</td><td>${cell(d.expense)}</td><td>${cell(d.income - d.expense)}</td></tr>`).join('');

  return `<figure class="chart">
    <div class="legend" aria-hidden="true">
      <span><i class="swatch s-income-bg"></i>Receitas</span>
      <span><i class="swatch s-expense-bg"></i>Despesas</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="group" aria-label="${esc(title)}">${grid}${groups}</svg>
    <details class="chart-table"><summary>Ver em tabela</summary>
      <table><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Saldo</th></tr></thead><tbody>${rows}</tbody></table>
    </details>
  </figure>`;
}

/**
 * Gastos por categoria em barras horizontais (uma só cor; o rótulo identifica).
 * items: [{ label, icon, value, limit? }]
 */
export function categoryBars(items, total) {
  if (!items.length) return '';
  const max = Math.max(...items.map((i) => Math.max(i.value, i.limit || 0)));
  return `<ul class="cat-bars">${items.map((it) => {
    const w = max ? (it.value / max) * 100 : 0;
    const lim = it.limit ? (it.limit / max) * 100 : null;
    const share = total ? Math.round((it.value / total) * 100) : 0;
    const over = it.limit && it.value > it.limit;
    return `<li class="cat-bar${over ? ' is-over' : ''}">
      <div class="cat-bar-head">
        <span class="cat-bar-label"><span aria-hidden="true">${it.icon || ''}</span> ${esc(it.label)}</span>
        <span class="cat-bar-value">${fmtBRL(it.value)} <small>${share}%</small></span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${w.toFixed(2)}%"></div>
        ${lim != null ? `<div class="cat-bar-limit" style="left:${lim.toFixed(2)}%" title="Limite ${fmtBRL(it.limit)}"></div>` : ''}
      </div>
      ${over ? `<p class="cat-bar-note">${fmtBRL(it.value - it.limit)} acima do limite de ${fmtBRL(it.limit)}</p>` : ''}
    </li>`;
  }).join('')}</ul>`;
}

/**
 * Evolução de um investimento: área do total com a parte investida por baixo.
 * series: [{ month, invested, total }] em reais.
 */
export function growthChart(series) {
  const W = 360, H = 200, padL = 50, padR = 8, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = series.length - 1 || 1;
  const max = niceMax(Math.max(...series.map((s) => s.total), 1) * 100) / 100;
  const x = (i) => padL + (i / n) * plotW;
  const y = (v) => padT + plotH - (v / max) * plotH;
  const step = Math.max(1, Math.ceil(series.length / 120));
  const pts = series.filter((_, i) => i % step === 0 || i === series.length - 1);
  const line = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const area = (key) => `${line(key)}L${x(pts.at(-1).month).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const years = series.length - 1 >= 24;
  const xt = [0, Math.round(n / 2), n].map((m) => ({ m, label: years ? `${Math.round(m / 12)} a` : `${m} m` }));
  const last = series.at(-1);
  return `<figure class="chart">
    <div class="legend" aria-hidden="true">
      <span><i class="swatch s-total-bg"></i>Juros</span>
      <span><i class="swatch s-invested-bg"></i>Dinheiro investido</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(`Evolução: total final ${fmtBRL(last.total * 100)}, dos quais ${fmtBRL(last.invested * 100)} investidos`)}">
      ${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/>
        <text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end" class="chart-axis">${esc(fmtBRLCompact(t * 100))}</text>`).join('')}
      <path d="${area('total')}" class="s-total-area"/>
      <path d="${area('invested')}" class="s-invested-area"/>
      <path d="${line('total')}" class="s-total-line"/>
      ${xt.map((t) => `<text x="${x(t.m)}" y="${H - 6}" text-anchor="${t.m === 0 ? 'start' : t.m === n ? 'end' : 'middle'}" class="chart-axis">${t.label}</text>`).join('')}
    </svg>
  </figure>`;
}

/** Anel de progresso para metas. */
export function ring(ratio, { size = 56, stroke = 6, label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, ratio));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-width="${stroke}" fill="none"
      stroke-dasharray="${(c * p).toFixed(2)} ${c.toFixed(2)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-text">${Math.round(p * 100)}%</text>
  </svg>`;
}
