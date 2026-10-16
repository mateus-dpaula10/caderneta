// Integração com o navegador: tema, zoom, instalação (PWA) e service worker.

const THEME_KEY = 'caderneta:theme';

/**
 * Bloqueia o zoom de pinça. O iOS Safari ignora user-scalable=no do meta viewport, então
 * cancelamos os gestos (gesturestart/gesturechange, só existem no Safari) e o touchmove com
 * mais de um dedo. O duplo toque já é barrado pelo touch-action: manipulation do CSS.
 * passive: false é obrigatório para o preventDefault valer em eventos de toque.
 */
export function preventZoom() {
  const block = (e) => e.preventDefault();
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('gesturechange', block, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}

/** Aplica o tema: 'auto' segue o sistema; 'light'/'dark' forçam. Guarda em localStorage para evitar flash. */
export function applyTheme(theme = 'auto') {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* sem armazenamento: só não lembra */ }
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#140f1c' : '#5b2a86'));
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = false; });
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; });

export const install = {
  available: () => Boolean(deferredPrompt),
  async prompt() {
    if (!deferredPrompt) return 'unavailable';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return outcome;
  },
};

/**
 * Registra o service worker e avisa quando há versão nova esperando.
 * onUpdate(apply) recebe uma função que ativa a nova versão e recarrega.
 */
export async function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // Só recarrega quando a pessoa aceitou a atualização (no 1º acesso o SW assume sem recarregar).
    let userAccepted = false;
    const offer = (worker) => onUpdate(() => { userAccepted = true; worker.postMessage({ type: 'SKIP_WAITING' }); });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !userAccepted) return;
      reloading = true;
      location.reload();
    });
    return reg;
  } catch (err) {
    console.warn('[caderneta] service worker não registrado:', err?.message || err);
    return null;
  }
}
