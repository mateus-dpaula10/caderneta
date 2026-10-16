// Planilha do Excel: baixar o modelo e importar a planilha preenchida (com prévia antes de gravar).
// O ExcelJS (~1 MB) é carregado sob demanda, só quando a pessoa usa uma dessas ações, no mesmo padrão
// do supabase-js em js/auth.js (arquivo empacotado em js/vendor/, cacheado pelo service worker).
import { state, importTransactions } from '../store.js';
import { openDialog, sheetHeader, toast, downloadFile } from '../ui.js';
import { esc, fmtBRL, plural, sum, todayISO, uid } from '../utils.js';
import { EXCELJS_LIB } from '../config.js';
import { buildTemplate, readSheetRows, planImport, MAX_IMPORT_ROWS } from '../spreadsheet.js';
import { isPaid, paidWithOf } from '../finance.js';
import { icon } from '../icons.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ERRORS_SHOWN = 200;

let libPromise = null;
function loadExcelJS() {
  if (globalThis.ExcelJS?.Workbook) return Promise.resolve(globalThis.ExcelJS);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL(`../${EXCELJS_LIB}`, import.meta.url).href;
      s.async = true;
      s.onload = () => (globalThis.ExcelJS?.Workbook ? resolve(globalThis.ExcelJS) : reject(new Error('ExcelJS não carregou')));
      s.onerror = () => { s.remove(); reject(new Error('Não foi possível carregar o módulo de planilhas.')); };
      document.head.appendChild(s);
    }).catch((err) => { libPromise = null; throw err; });
  }
  return libPromise;
}

/** Botões "Baixar planilha modelo" e "Importar planilha" (Ajustes e o diálogo de Lançamentos usam os mesmos). */
export function renderSheetActions() {
  return `<div class="actions left">
    <button type="button" class="btn ghost" data-sheet-template>${icon('download', { size: 18 })} Baixar planilha modelo</button>
    <label class="btn ghost file-btn">${icon('upload', { size: 18 })} Importar planilha
      <input type="file" accept=".xlsx,${XLSX_MIME}" data-sheet-import class="sr-only"></label>
  </div>`;
}

export function mountSheetActions(root) {
  const btn = root.querySelector('[data-sheet-template]');
  btn?.addEventListener('click', () => downloadTemplate(btn));
  root.querySelector('[data-sheet-import]')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importSheetFile(file);
  });
}

/** Diálogo aberto pelo botão "Planilha" de Lançamentos: explica e oferece as duas ações. */
export function openSheetDialog() {
  const dlg = openDialog(`<div class="sheet-body">
    ${sheetHeader('Planilha do Excel')}
    <p class="lead">Prefere anotar no Excel? Baixe a planilha modelo, preencha uma linha por lançamento e importe aqui.
      As listas de Tipo, Categoria, Natureza, Pago e Saiu do já vêm prontas, com as suas categorias.</p>
    <ul class="ob-points">
      <li>Antes de gravar, você vê uma <strong>prévia</strong>: o que entra, categorias novas e linhas com erro.</li>
      <li>Categoria que não existe vira <strong>categoria nova</strong> sua.</li>
      <li>Importar o mesmo arquivo de novo <strong>não duplica</strong> os lançamentos.</li>
    </ul>
    ${renderSheetActions()}
  </div>`);
  mountSheetActions(dlg);
  return dlg;
}

async function downloadTemplate(btn) {
  if (btn) btn.disabled = true;
  try {
    const ExcelJS = await loadExcelJS();
    const wb = buildTemplate(ExcelJS, state.categories);
    const buf = await wb.xlsx.writeBuffer();
    downloadFile(`caderneta-planilha-${todayISO()}.xlsx`, new Blob([buf], { type: XLSX_MIME }));
    toast('Planilha modelo baixada. Preencha a aba "Lançamentos" e importe aqui.', { tone: 'good', timeout: 6000 });
  } catch (err) {
    console.warn('[caderneta] planilha modelo:', err);
    toast(esc(err?.message || 'Não foi possível gerar a planilha.'), { tone: 'alert' });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function importSheetFile(file) {
  if (!/\.xlsx$/i.test(file.name) && file.type !== XLSX_MIME) {
    toast('Escolha um arquivo .xlsx (Excel 2007 ou mais novo). Planilhas .xls antigas e .csv não são aceitas.', { tone: 'alert', timeout: 7000 });
    return;
  }
  if (file.size > MAX_FILE_BYTES) { toast('Arquivo grande demais para uma planilha de lançamentos (máximo 10 MB).', { tone: 'alert' }); return; }
  const busy = toast('Lendo a planilha…', { timeout: 0 });
  let ExcelJS;
  try {
    ExcelJS = await loadExcelJS();
  } catch (err) {
    busy.remove();
    toast(esc(err?.message || 'Não foi possível carregar o módulo de planilhas.'), { tone: 'alert' });
    return;
  }
  let parsed;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    parsed = readSheetRows(wb);
  } catch (err) {
    busy.remove();
    const known = err instanceof Error && /planilha|cabeçalho|aba/i.test(err.message);
    toast(esc(known ? err.message : 'Não foi possível ler o arquivo. Ele precisa ser uma planilha .xlsx (como a planilha modelo).'), { tone: 'alert', timeout: 7000 });
    return;
  }
  busy.remove();
  const plan = planImport(parsed.rows, state, { newId: uid });
  openPreview(plan, { fileName: file.name, truncated: parsed.truncated });
}

function openPreview(plan, { fileName, truncated }) {
  const n = plan.transactions.length;
  const income = sum(plan.transactions.filter((t) => t.type === 'income'), (t) => t.amount);
  const expense = sum(plan.transactions.filter((t) => t.type === 'expense'), (t) => t.amount);
  // Despesas que entram como "a pagar" (coluna Pago = Não, ou vazia com data futura).
  const today = todayISO();
  const due = plan.transactions.filter((t) => !isPaid(t, today));
  const onCard = plan.transactions.filter((t) => paidWithOf(t) === 'cartao');
  const shown = plan.errors.slice(0, MAX_ERRORS_SHOWN);
  const empty = plan.total === 0;
  const dlg = openDialog(`<div class="sheet-body">
    ${sheetHeader('Importar planilha')}
    <p class="muted small">Arquivo: ${esc(fileName)}</p>
    ${empty ? '<p>A planilha não tem nenhum lançamento preenchido na aba "Lançamentos".</p>' : `<ul class="import-summary">
      <li><strong>${plural(n, 'lançamento será importado', 'lançamentos serão importados')}</strong>${n ? `:
        <span class="pos">+${fmtBRL(income)}</span> em receitas e <span class="neg">−${fmtBRL(expense)}</span> em despesas` : ''}.</li>
      ${due.length ? `<li>${plural(due.length, 'despesa entra', 'despesas entram')} como <strong>a pagar</strong> (${fmtBRL(sum(due, (t) => t.amount))}).</li>` : ''}
      ${onCard.length ? `<li>${plural(onCard.length, 'despesa saiu', 'despesas saíram')} no <strong>cartão de crédito</strong> (${fmtBRL(sum(onCard, (t) => t.amount))}); as outras contam como salário.</li>` : ''}
      ${plan.newCategories.length ? `<li>${plural(plan.newCategories.length, 'categoria nova será criada', 'categorias novas serão criadas')}:
        ${plan.newCategories.map((c) => `${esc(c.name)} <small class="muted">(${c.type === 'income' ? 'receita' : 'despesa'})</small>`).join(', ')}.</li>` : ''}
      ${plan.duplicates.length ? `<li>${plural(plan.duplicates.length, 'linha já existe no app e será ignorada', 'linhas já existem no app e serão ignoradas')}
        <small class="muted">(mesma data, tipo, valor, categoria e descrição)</small>.</li>` : ''}
      ${plan.errors.length ? `<li class="neg">${plural(plan.errors.length, 'linha com erro fica', 'linhas com erro ficam')} de fora.</li>` : ''}
    </ul>`}
    ${truncated ? `<p class="callout alert">A planilha passa de ${MAX_IMPORT_ROWS} lançamentos; só os primeiros ${MAX_IMPORT_ROWS} foram lidos. Divida o arquivo e importe o resto depois.</p>` : ''}
    ${plan.errors.length ? `<h3 class="sub-title" id="import-errors-title">Linhas com erro (corrija na planilha e importe de novo)</h3>
      <ul class="import-errors" tabindex="0" aria-labelledby="import-errors-title">
        ${shown.map((e) => `<li><strong>Linha ${e.row}:</strong> ${esc(e.reason)}.</li>`).join('')}
        ${plan.errors.length > shown.length ? `<li class="muted">… e mais ${plan.errors.length - shown.length}.</li>` : ''}
      </ul>` : ''}
    <p class="form-error" role="alert" hidden></p>
    <div class="actions">
      <button type="button" class="btn ghost" data-close>${n ? 'Cancelar' : 'Fechar'}</button>
      ${n ? `<button type="button" class="btn primary" data-confirm-import>Importar ${plural(n, 'lançamento', 'lançamentos')}</button>` : ''}
    </div>
  </div>`);
  const ok = dlg.querySelector('[data-confirm-import]');
  ok?.addEventListener('click', async () => {
    ok.disabled = true;
    const err = dlg.querySelector('.form-error');
    try {
      const res = await importTransactions(plan);
      dlg.close();
      // Ignoradas = as que a prévia já apontou + as que passaram a existir entre a prévia e a confirmação.
      const ignored = plan.duplicates.length + res.skipped;
      const extra = [
        res.categoriesCreated ? plural(res.categoriesCreated, 'categoria nova', 'categorias novas') : '',
        ignored ? `${plural(ignored, 'linha ignorada', 'linhas ignoradas')} por já existir` : '',
        plan.errors.length ? `${plural(plan.errors.length, 'linha com erro', 'linhas com erro')} de fora` : '',
      ].filter(Boolean).join(', ');
      toast(res.added
        ? `${plural(res.added, 'lançamento importado', 'lançamentos importados')}${extra ? ` (${extra})` : ''}.`
        : 'Nada novo para importar: esses lançamentos já estão no app.', { tone: res.added ? 'good' : 'info', timeout: 7000 });
    } catch (ex) {
      ok.disabled = false;
      err.textContent = `Não foi possível gravar: ${ex?.message || 'erro desconhecido'}. Nada foi importado.`;
      err.hidden = false;
    }
  });
  return dlg;
}
