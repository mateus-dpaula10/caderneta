// Formulário de categoria (criar/editar), usado em Ajustes → Categorias e direto no formulário de lançamento.
// Abre no diálogo genérico (#generic-dialog): por ser outro <dialog>, ele empilha por cima do lançamento
// (#tx-dialog) sem fechá-lo, e o Esc/backdrop fecham só o de cima.
import { state, upsertCategory, deleteCategory } from '../store.js';
import { openDialog, sheetHeader, toast, confirmDialog } from '../ui.js';
import { esc } from '../utils.js';
import { GROUPS } from '../finance.js';
import { icon } from '../icons.js';

/**
 * cat: categoria a editar (null = nova).
 * Opções (só para categoria nova):
 *  - type: tipo já escolhido ('expense' | 'income');
 *  - lockType: não deixa trocar o tipo (vindo do lançamento, a categoria tem de ser do tipo dele);
 *  - onSaved(cat): chamado depois de gravar; onCancel(): chamado se fechar sem gravar.
 */
export function openCategoryForm(cat = null, { type = 'expense', lockType = false, onSaved, onCancel } = {}) {
  const c = cat || { name: '', icon: '🏷️', type, group: 'desejos' };
  let saved = null;
  const typeField = cat ? '' : lockType
    ? `<p class="field-hint" id="c-type-hint">Categoria de ${c.type === 'income' ? 'receita' : 'despesa'}, igual ao lançamento.</p>
       <input type="hidden" name="type" value="${c.type === 'income' ? 'income' : 'expense'}">`
    : `<fieldset class="segmented small"><legend class="field-label">Tipo</legend>
      <label><input type="radio" name="type" value="expense" ${c.type !== 'income' ? 'checked' : ''}><span>Despesa</span></label>
      <label><input type="radio" name="type" value="income" ${c.type === 'income' ? 'checked' : ''}><span>Receita</span></label></fieldset>`;
  const dlg = openDialog(`<form class="sheet-body" novalidate>
    ${sheetHeader(cat ? 'Editar categoria' : 'Nova categoria')}
    <div class="grid-2 icon-name">
      <label class="field" for="c-icon"><span class="field-label">Ícone</span>
        <input id="c-icon" name="icon" maxlength="4" value="${esc(c.icon)}" class="emoji-input"></label>
      <label class="field" for="c-name"><span class="field-label">Nome</span>
        <input id="c-name" name="name" maxlength="40" required value="${esc(c.name)}" autocomplete="off" ${lockType ? 'aria-describedby="c-type-hint"' : ''}></label>
    </div>
    ${typeField}
    <label class="field" for="c-group" ${c.type === 'income' ? 'hidden' : ''} data-group-field><span class="field-label">Grupo no 50/30/20</span>
      <select id="c-group" name="group">${Object.entries(GROUPS).map(([k, g]) => `<option value="${k}" ${k === c.group ? 'selected' : ''}>${g.label}: ${g.hint.toLowerCase()}</option>`).join('')}</select></label>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions">
      ${cat ? `<button type="button" class="btn ghost danger-text" data-del-cat>${icon('trash', { size: 18 })} Excluir</button>` : ''}
      <button type="submit" class="btn primary">${cat ? 'Salvar' : 'Criar categoria'}</button>
    </div>
  </form>`, { onClose: () => { if (saved) onSaved?.(saved); else onCancel?.(); } });
  const form = dlg.querySelector('form');
  // Categoria nova: o foco vai direto para o nome (o ícone já vem preenchido).
  if (!cat) form.querySelector('#c-name').focus();
  form.querySelectorAll('input[name="type"][type="radio"]').forEach((r) => r.addEventListener('change', () => {
    form.querySelector('[data-group-field]').hidden = form.type.value === 'income';
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const err = form.querySelector('.form-error');
    if (!name) { err.textContent = 'Dê um nome para a categoria.'; err.hidden = false; form.name.focus(); return; }
    const kind = cat ? cat.type : form.type.value;
    try {
      saved = await upsertCategory({ ...(cat ? { id: cat.id } : {}), name, icon: form.icon.value.trim() || '🏷️', type: kind, group: kind === 'expense' ? form.group.value : null });
    } catch (ex) {
      err.textContent = ex.message || 'Não foi possível salvar. Tente de novo.'; err.hidden = false; return;
    }
    dlg.close();
    toast(cat ? 'Categoria salva.' : 'Categoria criada.', { tone: 'good' });
  });
  form.querySelector('[data-del-cat]')?.addEventListener('click', async () => {
    dlg.close();
    const count = state.transactions.filter((t) => t.categoryId === cat.id).length;
    const target = cat.type === 'income' ? 'Outras receitas' : 'Outros gastos';
    const ok = await confirmDialog({
      title: `Excluir "${esc(cat.name)}"?`,
      text: count ? `${count} ${count === 1 ? 'lançamento será movido' : 'lançamentos serão movidos'} para "${target}".` : 'Nenhum lançamento usa esta categoria.',
      confirmLabel: 'Excluir', danger: true,
    });
    if (!ok) return;
    try { await deleteCategory(cat.id); toast('Categoria excluída.'); } catch (ex) { toast(esc(ex.message), { tone: 'alert' }); }
  });
}
