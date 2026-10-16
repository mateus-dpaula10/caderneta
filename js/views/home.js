// Início: saldo do mês, régua 50/30/20, dicas contextuais, gráficos, metas e próxima lição.
import { state, dismissTip } from '../store.js';
import { ui, monthNav } from '../ui.js';
import { esc, fmtBRL, monthLabel, currentMonth, monthShort, fmtPct } from '../utils.js';
import { GROUPS, lastMonths, monthSummary, referenceIncome } from '../finance.js';
import { buildInsights, nextLesson } from '../insights.js';
import { categoryBars, monthBars, ring } from '../charts.js';
import { computeStreak } from '../gamification.js';
import { lessonById } from '../lessons.js';
import { icon } from '../icons.js';

const TONE_ICON = { alert: 'alert', warn: 'alert', good: 'check', info: 'bulb' };
const TONE_LABEL = { alert: 'Atenção', warn: 'Cuidado', good: 'Bom sinal', info: 'Dica' };

function greeting() {
  const h = new Date().getHours();
  const base = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return state.settings.name ? `${base}, ${esc(state.settings.name)}` : base;
}

/** A régua do mês: quanto da renda já foi para cada grupo do 50/30/20. */
function ruler(summary, income) {
  if (!(income > 0)) {
    return `<p class="ruler-empty">Informe sua renda em <a href="#/ajustes">Ajustes</a> ou registre uma receita para ver a régua 50/30/20.</p>`;
  }
  const parts = Object.entries(GROUPS).map(([key, g]) => ({ key, ...g, value: summary.byGroup[key] || 0 }));
  const used = parts.reduce((a, p) => a + p.value, 0);
  const scale = Math.max(income, used);
  const segs = parts.map((p) => `<span class="ruler-seg seg-${p.key}" style="width:${((p.value / scale) * 100).toFixed(2)}%"></span>`).join('');
  const incomeMark = used > income ? `<span class="ruler-income" style="left:${((income / scale) * 100).toFixed(2)}%"><span>sua renda</span></span>` : '';
  const ticks = [0.5, 0.8].map((f) => `<span class="ruler-tick" style="left:${((income * f / scale) * 100).toFixed(2)}%"></span>`).join('');
  const legend = parts.map((p) => {
    const ratio = p.value / income;
    const off = p.key === 'futuro' ? ratio < p.share * 0.5 : ratio > p.share;
    return `<li><i class="swatch seg-${p.key}"></i>
      <span class="ruler-name">${p.label}</span>
      <span class="ruler-val ${off ? 'is-off' : ''}">${fmtPct(ratio)} <small>de ${fmtPct(p.share)}</small></span></li>`;
  }).join('');
  return `<div class="ruler" role="img" aria-label="${esc(parts.map((p) => `${p.label}: ${fmtPct(p.value / income)} da renda, referência ${fmtPct(p.share)}`).join('; '))}">
      <div class="ruler-track">${segs}${ticks}${incomeMark}</div>
    </div>
    <ul class="ruler-legend">${legend}</ul>`;
}

function tipCard(t) {
  const lesson = t.lesson ? lessonById(t.lesson) : null;
  const href = t.href || (lesson ? `#/aprender/${lesson.id}` : null);
  const cta = t.cta || (lesson ? `Lição: ${lesson.title}` : null);
  return `<li class="tip tip-${t.tone}">
    <span class="tip-icon">${icon(TONE_ICON[t.tone], { size: 20, label: TONE_LABEL[t.tone] })}</span>
    <div class="tip-body">
      <p class="tip-title">${esc(t.title)}</p>
      <p>${esc(t.text)}</p>
      ${href ? `<a class="tip-link" href="${href}">${esc(cta)}</a>` : ''}
    </div>
    <button type="button" class="icon-btn small" data-dismiss="${esc(t.key)}" aria-label="Dispensar dica">${icon('x', { size: 16 })}</button>
  </li>`;
}

export function render() {
  const ym = ui.ym;
  const s = monthSummary(state, ym);
  const income = referenceIncome(state, ym);
  const tips = buildInsights(state, ym).slice(0, 3);
  const streak = computeStreak(state.progress.activity);
  const isCurrent = ym === currentMonth();

  const catItems = [...s.byCategory.entries()]
    .map(([id, value]) => {
      const c = state.categories.find((x) => x.id === id);
      return { label: c?.name || 'Sem categoria', icon: c?.icon, value, limit: c?.group === 'futuro' ? 0 : (c?.budget || 0) };
    })
    .sort((a, b) => b.value - a.value);
  const top = catItems.length > 7 ? catItems.slice(0, 6) : catItems;
  const rest = catItems.length > 7 ? catItems.slice(6) : [];
  if (rest.length) top.push({ label: `Outras ${rest.length} categorias`, icon: '…', value: rest.reduce((a, r) => a + r.value, 0) });

  const months = lastMonths(state, ym, 6).map((m) => ({ ...m, label: monthShort(m.ym), current: m.ym === ym }));
  const hasHistory = months.some((m) => m.count > 0);
  const lesson = nextLesson(state);
  const goals = state.goals.slice(0, 3);

  return `
  <header class="page-head">
    <div>
      <p class="page-kicker">${greeting()}</p>
      <h1 class="page-title">Seu mês</h1>
    </div>
    <div class="head-actions">
      <a href="#/aprender" class="streak ${streak ? 'is-on' : ''}" title="Dias seguidos registrando">
        ${icon('flame', { size: 18 })}<span><strong>${streak}</strong> ${streak === 1 ? 'dia' : 'dias'}</span>
      </a>
      <a href="#/ajustes" class="icon-btn only-mobile" aria-label="Ajustes">${icon('settings')}</a>
    </div>
  </header>
  ${monthNav(ym)}

  <section class="hero" aria-labelledby="hero-title">
    <h2 id="hero-title" class="hero-label">${isCurrent ? 'Saldo até agora' : `Saldo de ${monthLabel(ym).toLowerCase()}`}</h2>
    <p class="hero-value ${s.balance < 0 ? 'neg' : ''}">${fmtBRL(s.balance)}</p>
    <dl class="hero-split">
      <div><dt>${icon('up', { size: 16 })} Receitas</dt><dd class="pos">${fmtBRL(s.income)}</dd></div>
      <div><dt>${icon('down', { size: 16 })} Despesas</dt><dd class="neg">${fmtBRL(s.expense)}</dd></div>
      <div><dt>Gastos fixos</dt><dd>${fmtBRL(s.fixed)}</dd></div>
    </dl>
    <h3 class="ruler-title">Para onde foi a renda</h3>
    ${ruler(s, income)}
  </section>

  ${tips.length ? `<section class="block" aria-labelledby="tips-title">
    <div class="block-head"><h2 id="tips-title">Para você</h2></div>
    <ul class="tips">${tips.map(tipCard).join('')}</ul>
  </section>` : ''}

  <div class="cols">
    <section class="block" aria-labelledby="cat-title">
      <div class="block-head"><h2 id="cat-title">Gastos por categoria</h2><a href="#/lancamentos" class="link">Ver lançamentos</a></div>
      ${top.length ? categoryBars(top, s.expense) : `<div class="empty small"><p>Nenhuma despesa em ${monthLabel(ym).toLowerCase()}.</p>
        <button type="button" class="btn primary small" data-new-tx="expense">${icon('plus', { size: 18 })} Registrar despesa</button></div>`}
    </section>

    <section class="block" aria-labelledby="trend-title">
      <div class="block-head"><h2 id="trend-title">Últimos 6 meses</h2></div>
      ${hasHistory ? monthBars(months) : '<div class="empty small"><p>O gráfico aparece assim que houver lançamentos.</p></div>'}
    </section>
  </div>

  <div class="cols">
    <section class="block" aria-labelledby="goals-title">
      <div class="block-head"><h2 id="goals-title">Metas</h2><a href="#/planejar" class="link">Planejar</a></div>
      ${goals.length ? `<ul class="goal-mini">${goals.map((g) => `<li>
          ${ring(g.target ? g.saved / g.target : 0, { label: `${g.name}: ${Math.round((g.saved / (g.target || 1)) * 100)}%` })}
          <div><p class="goal-mini-name">${g.icon || '🎯'} ${esc(g.name)}</p><p class="muted">${fmtBRL(g.saved)} de ${fmtBRL(g.target)}</p></div>
        </li>`).join('')}</ul>`
        : `<div class="empty small"><p>Uma meta dá destino ao dinheiro que sobra.</p><a class="btn ghost small" href="#/planejar?nova-meta=reserva">Criar reserva de emergência</a></div>`}
    </section>

    <section class="block lesson-next" aria-labelledby="lesson-title">
      <div class="block-head"><h2 id="lesson-title">Aprender</h2><a href="#/aprender" class="link">Trilha</a></div>
      ${lesson ? `<a class="lesson-card" href="#/aprender/${lesson.id}">
          <span class="lesson-emoji" aria-hidden="true">${lesson.icon}</span>
          <span><span class="lesson-card-title">${esc(lesson.title)}</span>
          <span class="muted">${lesson.minutes} min de leitura e quiz rápido</span></span>
        </a>` : '<p>Você concluiu a trilha inteira. Que tal refazer um quiz?</p>'}
    </section>
  </div>`;
}

export function mount(root, { rerender }) {
  root.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', async () => {
    await dismissTip(b.dataset.dismiss);
    rerender();
  }));
}
