// Ajustes: perfil, tema, categorias, conta e sincronização (opcional), backup, planilha do Excel, instalação e dados.
import { state, saveSettings, exportData, importData, resetAll, setFlag, categoryById } from '../store.js';
import { toast, confirmDialog, moneyInput, downloadFile } from '../ui.js';
import { esc, fmtBRL, parseMoney, centsToInput, todayISO } from '../utils.js';
import { GOAL_TYPES, GROUPS } from '../finance.js';
import { DISCLAIMER } from '../lessons.js';
import { icon } from '../icons.js';
import { applyTheme, install } from '../app-shell.js';
import { renderAccountBlock, mountAccountBlock, isSyncLinked } from '../account.js';
import { openCategoryForm } from './category-form.js';
import { renderSheetActions, mountSheetActions } from './spreadsheet-dialog.js';

const STORAGE_TEXT = {
  indexeddb: 'Seus dados estão salvos neste aparelho (IndexedDB).',
  localstorage: 'Seus dados estão salvos neste aparelho (armazenamento simples do navegador).',
  memory: 'Atenção: este navegador não permitiu salvar dados. O que você registrar será perdido ao fechar a página. Exporte um backup antes de sair.',
};

export function render() {
  const s = state.settings;
  const cats = (type) => state.categories.filter((c) => c.type === type);
  return `<header class="page-head"><div><h1 class="page-title">Ajustes</h1></div></header>

  <section class="block" aria-labelledby="profile-title">
    <div class="block-head"><h2 id="profile-title">Seu perfil</h2></div>
    <form id="profile-form" class="stack" novalidate>
      <label class="field" for="s-name"><span class="field-label">Como quer ser chamado(a)</span>
        <input id="s-name" name="name" maxlength="40" value="${esc(s.name)}" autocomplete="given-name"></label>
      ${moneyInput({ name: 'income', label: 'Renda mensal líquida', value: s.income ? centsToInput(s.income) : '', id: 's-income', hint: 'O que cai na conta por mês. Usado na régua 50/30/20 e nas dicas.' })}
      <label class="field" for="s-goal"><span class="field-label">Objetivo principal</span>
        <select id="s-goal" name="goal">${Object.entries(GOAL_TYPES).map(([k, g]) => `<option value="${k}" ${k === s.goal ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
      <div class="actions"><button class="btn primary" type="submit">Salvar perfil</button></div>
    </form>
  </section>

  <section class="block" aria-labelledby="theme-title">
    <div class="block-head"><h2 id="theme-title">Aparência</h2></div>
    <fieldset class="segmented" aria-label="Tema">
      <legend class="sr-only">Tema</legend>
      ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `
        <label><input type="radio" name="theme" value="${v}" ${s.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </fieldset>
  </section>

  <section class="block" aria-labelledby="cats-title">
    <div class="block-head"><h2 id="cats-title">Categorias</h2>
      <button type="button" class="btn ghost small" data-new-cat>${icon('plus', { size: 16 })} Nova categoria</button></div>
    ${['expense', 'income'].map((type) => `<h3 class="sub-title">${type === 'expense' ? 'Despesas' : 'Receitas'}</h3>
      <ul class="cat-list">${cats(type).map((c) => `<li>
        <span aria-hidden="true" class="cat-emoji">${c.icon || '•'}</span>
        <span class="cat-name">${esc(c.name)}${c.group ? `<small class="muted">${GROUPS[c.group]?.label || ''}${c.budget ? `, limite ${fmtBRL(c.budget)}` : ''}</small>` : ''}</span>
        <button type="button" class="icon-btn small" data-edit-cat="${esc(c.id)}" aria-label="Editar ${esc(c.name)}">${icon('edit', { size: 18 })}</button>
      </li>`).join('')}</ul>`).join('')}
  </section>

  ${renderAccountBlock()}

  <section class="block" aria-labelledby="backup-title">
    <div class="block-head"><h2 id="backup-title">Backup</h2></div>
    <p class="${state.storageMode === 'memory' ? 'callout alert' : 'lead'}">${STORAGE_TEXT[state.storageMode]}
      ${isSyncLinked()
    ? 'Com a conta conectada, uma cópia também fica na sua conta e volta ao entrar em outro aparelho. O backup é uma cópia extra, só sua, em arquivo.'
    : 'Sem conta, nada é enviado para servidores: se você trocar de aparelho ou limpar os dados do navegador, só o backup (ou uma conta, acima) traz tudo de volta.'}</p>
    <div class="actions left">
      <button type="button" class="btn primary" data-export>${icon('download', { size: 18 })} Exportar backup</button>
      <label class="btn ghost file-btn">${icon('upload', { size: 18 })} Importar backup
        <input type="file" accept="application/json,.json" data-import class="sr-only"></label>
    </div>
    ${state.progress.flags?.exportedAt ? `<p class="muted small">Último backup: ${new Date(state.progress.flags.exportedAt).toLocaleString('pt-BR')}</p>` : ''}
  </section>

  <section class="block" aria-labelledby="sheet-title">
    <div class="block-head"><h2 id="sheet-title">Planilha do Excel</h2></div>
    <p class="lead">Baixe a planilha modelo (já com as suas categorias), preencha no Excel e importe. Antes de gravar, o app mostra
      uma prévia; nada é apagado e lançamentos que já existem não são duplicados. Também fica em Lançamentos → Planilha.</p>
    ${renderSheetActions()}
  </section>

  <section class="block" aria-labelledby="install-title">
    <div class="block-head"><h2 id="install-title">Instalar no aparelho</h2></div>
    <p class="lead" id="install-help">No Android e no computador, use o botão abaixo (ou o menu do navegador, "Instalar app").
      No iPhone/iPad, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>
    <button type="button" class="btn ghost" data-install hidden>Instalar a Caderneta</button>
  </section>

  <section class="block" aria-labelledby="about-title">
    <div class="block-head"><h2 id="about-title">Sobre</h2></div>
    <p class="disclaimer">${icon('info', { size: 16 })} ${esc(DISCLAIMER)}</p>
    <div class="actions left">
      <button type="button" class="btn ghost" data-redo-onboarding>Refazer a apresentação inicial</button>
      <button type="button" class="btn ghost danger-text" data-reset>${icon('trash', { size: 18 })} Apagar todos os dados</button>
    </div>
  </section>`;
}

export function mount(root, { rerender, showOnboarding }) {
  root.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const income = f.income.value.trim() ? parseMoney(f.income.value) : 0;
    if (!(income >= 0)) { toast('Renda inválida. Use números, por exemplo 3.500,00.', { tone: 'alert' }); f.income.focus(); return; }
    await saveSettings({ name: f.name.value.trim(), income, goal: f.goal.value });
    toast('Perfil salvo.', { tone: 'good' });
  });

  root.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', async () => {
    applyTheme(r.value);
    await saveSettings({ theme: r.value });
  }));

  mountAccountBlock(root);

  root.querySelector('[data-new-cat]').addEventListener('click', () => openCategoryForm());
  root.querySelectorAll('[data-edit-cat]').forEach((b) => b.addEventListener('click', () => openCategoryForm(categoryById(b.dataset.editCat))));

  root.querySelector('[data-export]').addEventListener('click', async () => {
    // Marca antes de gerar o arquivo, para o próprio backup já registrar a data e a conquista.
    await setFlag('exportedAt');
    downloadFile(`caderneta-backup-${todayISO()}.json`, JSON.stringify(exportData(), null, 2), 'application/json');
    toast('Backup exportado. Guarde o arquivo num lugar seguro: ele contém seus dados financeiros.', { tone: 'good', timeout: 7000 });
  });

  mountSheetActions(root);

  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Arquivo grande demais para ser um backup da Caderneta.', { tone: 'alert' }); return; }
    let json;
    try { json = JSON.parse(await file.text()); } catch { toast('Não foi possível ler o arquivo. Ele precisa ser o .json exportado pela Caderneta.', { tone: 'alert' }); return; }
    const ok = await confirmDialog({
      title: 'Substituir os dados atuais?',
      text: `Tudo o que está neste aparelho será trocado pelo conteúdo do backup.${isSyncLinked() ? ' Com a sincronização ligada, a troca vale também para a sua conta e para os outros aparelhos conectados.' : ''} Se quiser guardar o estado atual, exporte um backup antes.`,
      confirmLabel: 'Importar e substituir', danger: true,
    });
    if (!ok) return;
    try {
      const { dropped, counts } = await importData(json);
      applyTheme(state.settings.theme);
      toast(`Backup importado: ${counts.transactions} lançamentos e ${counts.goals} metas.${dropped ? ` ${dropped} registros inválidos foram ignorados.` : ''}`, { tone: 'good', timeout: 7000 });
    } catch (ex) {
      toast(esc(ex.message || 'Falha ao importar. Nada foi alterado.'), { tone: 'alert', timeout: 7000 });
    }
  });

  const installBtn = root.querySelector('[data-install]');
  if (install.available()) installBtn.hidden = false;
  installBtn.addEventListener('click', async () => { const outcome = await install.prompt(); if (outcome === 'accepted') installBtn.hidden = true; });

  root.querySelector('[data-redo-onboarding]').addEventListener('click', () => showOnboarding());
  root.querySelector('[data-reset]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Apagar todos os dados?',
      text: isSyncLinked()
        ? 'Lançamentos, metas, categorias e progresso das lições serão apagados deste aparelho <strong>e da sua conta</strong> (todos os aparelhos conectados). Não dá para desfazer. Para limpar só este aparelho, use "Sair da conta" e escolha apagar os dados daqui.'
        : 'Lançamentos, metas, categorias e progresso das lições serão apagados deste aparelho. Não dá para desfazer.',
      confirmLabel: 'Apagar tudo', danger: true,
    });
    if (!ok) return;
    await resetAll();
    applyTheme('auto');
    toast('Dados apagados.');
    showOnboarding();
  });
  void rerender;
}
