// Ponto de entrada: inicia armazenamento, tema, rotas, service worker, onboarding e (se houver conta) a sincronização.
import { state, initStore, onChange, onAchievement, materializeRecurrences } from './store.js';
import { requestPersistence } from './db.js';
import { applyTheme, registerSW, preventZoom } from './app-shell.js';
import { ui, toast } from './ui.js';
import { addMonths, currentMonth, todayISO } from './utils.js';
import { icon } from './icons.js';
import { openTxForm } from './views/txform.js';
import { renderOnboarding } from './views/onboarding.js';
import * as home from './views/home.js';
import * as transactions from './views/transactions.js';
import * as plan from './views/plan.js';
import * as learn from './views/learn.js';
import * as tools from './views/tools.js';
import * as settings from './views/settings.js';
import { captureAuthCallback } from './auth.js';
import { initAccount, openAuthDialog } from './account.js';

// Retorno de link de e-mail (confirmação/recuperação): lê os tokens do hash e limpa a URL ANTES do roteador.
captureAuthCallback();

const ROUTES = {
  inicio: { view: home, label: 'Início', icon: 'home', fab: true },
  lancamentos: { view: transactions, label: 'Lançamentos', icon: 'list', fab: true },
  planejar: { view: plan, label: 'Planejar', icon: 'target', fab: true },
  aprender: { view: learn, label: 'Aprender', icon: 'book' },
  ferramentas: { view: tools, label: 'Ferramentas', icon: 'calc' },
  ajustes: { view: settings, label: 'Ajustes', icon: 'settings', desktopOnly: true },
};

const main = document.getElementById('main');
const shell = document.getElementById('shell');
const fab = document.getElementById('fab');
const obRoot = document.getElementById('onboarding-root');
let lastRouteKey = '';

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name, sub = ''] = path.split('/');
  const route = ROUTES[name] ? name : 'inicio';
  return { route, sub: decodeURIComponent(sub), params: new URLSearchParams(query) };
}

function buildNav() {
  document.getElementById('nav-list').innerHTML = Object.entries(ROUTES).map(([key, r]) => `
    <li class="${r.desktopOnly ? 'only-desktop' : ''}"><a href="#/${key}" data-route="${key}">${icon(r.icon)}<span>${r.label}</span></a></li>`).join('');
}

function render({ keepScroll = false } = {}) {
  if (!state.settings.onboarded) return;
  const { route, sub, params } = parseHash();
  const def = ROUTES[route];
  const routeKey = `${route}/${sub}`;
  const isNewRoute = routeKey !== lastRouteKey;
  const scrollY = window.scrollY;
  const ctx = { params, sub, rerender: () => render({ keepScroll: true }), showOnboarding };
  main.innerHTML = def.view.render(ctx);
  def.view.mount?.(main, ctx);
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fab.hidden = !def.fab;
  document.title = `${def.label} | Caderneta`;
  if (isNewRoute) {
    lastRouteKey = routeKey;
    window.scrollTo(0, 0);
    // Leva o foco ao conteúdo novo (leitores de tela anunciam a página).
    if (document.activeElement && document.activeElement !== document.body && !document.querySelector('dialog[open]')) {
      main.focus({ preventScroll: true });
    }
  } else if (keepScroll) {
    window.scrollTo(0, scrollY);
  }
}

function newTxDefaults() {
  return ui.ym === currentMonth() ? todayISO() : `${ui.ym}-01`;
}

let onboardingOpen = false;
let onboardingRequired = false; // aberta porque ainda não houve apresentação (e não por 'Refazer')

function closeOnboarding() {
  obRoot.innerHTML = '';
  onboardingOpen = false;
  shell.hidden = false;
  lastRouteKey = '';
  render();
}

function showOnboarding() {
  if (onboardingOpen) return;
  onboardingOpen = true;
  onboardingRequired = !state.settings.onboarded;
  shell.hidden = true;
  fab.hidden = true;
  renderOnboarding(obRoot, {
    onSignIn: () => openAuthDialog('signin'),
    onDone: () => {
      onboardingOpen = false;
      shell.hidden = false;
      lastRouteKey = '';
      ui.ym = currentMonth();
      if (location.hash !== '#/inicio') location.hash = '#/inicio'; else render();
      requestPersistence();
    },
  });
}

function wireGlobalEvents() {
  window.addEventListener('hashchange', () => render());
  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-month]');
    if (m) {
      const which = m.dataset.month;
      ui.ym = which === 'today' ? currentMonth() : addMonths(ui.ym, Number(which));
      render({ keepScroll: true });
      // Mantém o foco no botão equivalente depois de redesenhar (navegação por teclado).
      (main.querySelector(`[data-month="${which}"]`) || main.querySelector('[data-month="1"]'))?.focus();
      return;
    }
    const n = e.target.closest('[data-new-tx]');
    if (n) openTxForm({ type: n.dataset.newTx || 'expense', date: newTxDefaults() });
  });
  fab.innerHTML = icon('plus', { size: 26 });
  fab.addEventListener('click', () => openTxForm({ type: 'expense', date: newTxDefaults() }));

  onChange((reason) => {
    if (String(reason).endsWith(':silent')) return;
    if (reason === 'reset') { if (!state.settings.onboarded) showOnboarding(); return; } // a tela de onboarding assume
    if (reason === 'sync') {
      // Dados vindos de outro aparelho: tema, e apresentação inicial concluída (ou apagada) lá.
      applyTheme(state.settings.theme);
      if (!state.settings.onboarded) { showOnboarding(); return; }
      if (onboardingOpen && onboardingRequired) { closeOnboarding(); return; }
      if (onboardingOpen) return;
    }
    render({ keepScroll: true });
  });
  onAchievement((a) => toast(`<span aria-hidden="true">${a.icon}</span> Conquista desbloqueada: <strong>${a.title}</strong>`, { tone: 'good', timeout: 6000 }));

  // Ao voltar para o app (ex.: virou o mês), gera recorrências pendentes.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !state.settings.onboarded) return;
    const created = await materializeRecurrences();
    if (created) toast(`${created} ${created === 1 ? 'lançamento recorrente foi criado' : 'lançamentos recorrentes foram criados'} para este mês.`);
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(state.settings.theme));
}

async function boot() {
  preventZoom();
  buildNav();
  wireGlobalEvents();
  try {
    await initStore();
  } catch (err) {
    console.error('[caderneta] falha ao iniciar dados', err);
    toast(err?.code === 'blocked' ? err.message : 'Não foi possível abrir os dados salvos. Recarregue a página.', { tone: 'alert', timeout: 0 });
    return;
  }
  applyTheme(state.settings.theme);
  if (state.storageMode === 'memory') {
    toast('Este navegador não permite salvar dados. Use o backup em Ajustes para não perder nada.', { tone: 'alert', timeout: 0 });
  }
  if (!state.settings.onboarded) showOnboarding();
  else { shell.hidden = false; render(); }

  // Conta/sincronização (opcional): não bloqueia a abertura do app.
  initAccount({ showOnboarding }).catch((err) => console.warn('[caderneta] conta/sincronização:', err?.message || err));

  registerSW((apply) => toast('Nova versão da Caderneta disponível.', { timeout: 0, action: { label: 'Atualizar', run: apply } }));

  // Atalho do manifest: ?acao=novo abre o formulário direto.
  const params = new URLSearchParams(location.search);
  if (params.get('acao') === 'novo' && state.settings.onboarded) {
    history.replaceState(null, '', `${location.pathname}#/lancamentos`);
    openTxForm({ type: 'expense', date: todayISO() });
  }
  window.__caderneta = { state };
}

boot();
