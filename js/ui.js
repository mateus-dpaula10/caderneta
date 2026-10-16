// Peças de interface compartilhadas: avisos (toasts), diálogos e navegação de mês.
import { esc, monthLabel, currentMonth } from './utils.js';
import { icon } from './icons.js';

export const ui = { ym: currentMonth() };

export function toast(message, { tone = 'info', action, timeout = 4500 } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `<span>${message}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.run(); el.remove(); });
    el.appendChild(btn);
  }
  root.appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

/** Abre um <dialog> genérico com o HTML informado. Retorna o elemento. */
export function openDialog(html, { id = 'generic-dialog', onClose } = {}) {
  const dlg = document.getElementById(id);
  if (!dlg._wired) {
    // Um único ouvinte permanente; o handler da vez fica em dlg._onClose.
    dlg.addEventListener('close', () => { const fn = dlg._onClose; dlg._onClose = null; fn?.(); });
    dlg._wired = true;
  }
  // Se o diálogo já estava aberto com outro conteúdo, encerra o handler anterior antes de trocar.
  if (dlg.open && dlg._onClose) { const prev = dlg._onClose; dlg._onClose = null; prev(); }
  dlg._onClose = onClose || null;
  dlg.innerHTML = html;
  const close = () => dlg.close();
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  // Fecha ao clicar fora do conteúdo (no backdrop).
  dlg.onclick = (e) => { if (e.target === dlg) close(); };
  if (!dlg.open) dlg.showModal();
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button:not([data-close])');
  first?.focus();
  return dlg;
}

export function sheetHeader(title, id = 'generic-dialog-title') {
  return `<header class="sheet-head">
    <h2 id="${id}">${esc(title)}</h2>
    <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button>
  </header>`;
}

/** Confirmação acessível (substitui window.confirm). */
export function confirmDialog({ title, text, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const dlg = openDialog(`
      <form method="dialog" class="sheet-body confirm">
        ${sheetHeader(title)}
        <p>${text}</p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close ${danger ? 'autofocus' : ''}>Cancelar</button>
          <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>
        </div>
      </form>`, { onClose: () => resolve(answer) });
    dlg.querySelector('[data-ok]').addEventListener('click', () => { answer = true; });
  });
}

export function monthNav(ym) {
  const isCurrent = ym === currentMonth();
  return `<div class="month-nav" role="group" aria-label="Escolher mês">
    <button type="button" class="icon-btn" data-month="-1" aria-label="Mês anterior">${icon('left')}</button>
    <span class="month-label" aria-live="polite">${monthLabel(ym)}</span>
    <button type="button" class="icon-btn" data-month="1" aria-label="Próximo mês">${icon('right')}</button>
    ${isCurrent ? '' : '<button type="button" class="chip" data-month="today">Hoje</button>'}
  </div>`;
}

export function emptyState({ title, text, action }) {
  return `<div class="empty">
    <p class="empty-title">${esc(title)}</p>
    <p>${text}</p>
    ${action || ''}
  </div>`;
}

/** Campo de dinheiro padrão (texto com teclado numérico; aceita vírgula). */
export function moneyInput({ name, label, value = '', required = false, hint = '', id = name }) {
  return `<label class="field" for="${id}">
    <span class="field-label">${esc(label)}</span>
    <span class="money-wrap"><span aria-hidden="true">R$</span>
      <input id="${id}" name="${name}" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"
        value="${esc(value)}" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}-hint"` : ''}></span>
    ${hint ? `<span class="field-hint" id="${id}-hint">${hint}</span>` : ''}
  </label>`;
}
