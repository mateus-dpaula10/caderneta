// Planilha do Excel (.xlsx): monta o modelo para baixar e lê/valida a planilha preenchida.
// Funções puras: recebem o ExcelJS e os dados por parâmetro (nada de DOM nem de store), então dá para
// testar no Node. O carregamento da biblioteca e as telas ficam em js/views/spreadsheet-dialog.js.
import { normalize, parseMoney } from './utils.js';

export const DATA_SHEET = 'Lançamentos';
export const CATS_SHEET = 'Categorias';
export const HELP_SHEET = 'Como preencher';
/** Linhas com listas suspensas e formatação no modelo (além do cabeçalho). Abaixo disso ainda dá para digitar. */
export const TEMPLATE_ROWS = 1000;
/** Limite de linhas lidas numa importação (proteção contra arquivo gigante travar o aparelho). */
export const MAX_IMPORT_ROWS = 5000;
/** Ícone e grupo 50/30/20 das categorias criadas pela importação (os mesmos padrões do formulário de categoria). */
export const NEW_CATEGORY_ICON = '🏷️';
export const NEW_CATEGORY_GROUP = 'desejos';

// Colunas na ordem do modelo. `aliases`: cabeçalhos aceitos na leitura (sem maiúscula/acento),
// para a importação continuar funcionando se a pessoa reordenar ou renomear levemente as colunas.
const COLUMNS = [
  { key: 'date', header: 'Data', width: 13, aliases: ['data', 'dia'] },
  { key: 'type', header: 'Tipo', width: 12, aliases: ['tipo'] },
  { key: 'category', header: 'Categoria', width: 28, aliases: ['categoria'] },
  { key: 'description', header: 'Descrição', width: 36, aliases: ['descricao', 'historico'] },
  { key: 'amount', header: 'Valor (R$)', width: 15, aliases: ['valor (r$)', 'valor', 'valor r$'] },
  { key: 'nature', header: 'Natureza', width: 12, aliases: ['natureza'] },
  // Opcional (planilhas antigas, sem esta coluna, continuam valendo): só conta em despesa.
  { key: 'paid', header: 'Pago', width: 9, aliases: ['pago', 'paga', 'pago?'] },
  // Opcional, só em despesa: de onde saiu o dinheiro. Vazio = salário (o campo não é gravado).
  { key: 'paidWith', header: 'Saiu do', width: 20, aliases: ['saiu do', 'saiu de', 'saiu', 'pago com', 'forma de pagamento', 'origem'] },
];
// Colunas opcionais: preenchidas sozinhas (sem os dados do lançamento) não fazem da linha um lançamento.
const OPTIONAL_KEYS = new Set(['paid', 'paidWith']);

const TYPE_LABEL = { expense: 'Despesa', income: 'Receita' };
const TYPE_WORDS = { despesa: 'expense', gasto: 'expense', saida: 'expense', receita: 'income', entrada: 'income' };
const NATURE_WORDS = { fixo: 'fixo', fixa: 'fixo', variavel: 'variavel' };
const PAID_WORDS = {
  sim: true, s: true, pago: true, paga: true, x: true,
  nao: false, n: false, 'nao pago': false, 'nao paga': false, 'a pagar': false,
};
const PAID_WITH_WORDS = {
  salario: 'salario', s: 'salario',
  cartao: 'cartao', 'cartao de credito': 'cartao', 'cartao credito': 'cartao', credito: 'cartao', c: 'cartao',
};
const PAID_WITH_LABEL = { salario: 'Salário', cartao: 'Cartão de crédito' };

const pad = (n) => String(n).padStart(2, '0');
/** Chave de comparação de texto: sem maiúscula, sem acento, espaços colapsados. */
export const textKey = (s) => normalize(String(s ?? '').trim()).replace(/\s+/g, ' ');

// ---------- Modelo para baixar ----------

/**
 * Monta a pasta de trabalho do modelo. `categories` são as categorias DESTA pessoa (inclusive as próprias).
 * Retorna o Workbook; quem chama grava com `wb.xlsx.writeBuffer()`.
 */
export function buildTemplate(ExcelJS, categories, { now = new Date() } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Caderneta';
  wb.created = now;

  const ws = wb.addWorksheet(DATA_SHEET, { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle' };
  // Formato na coluna inteira: o que for digitado depois herda (data dd/mm/aaaa e moeda).
  ws.getColumn('date').numFmt = 'dd/mm/yyyy';
  ws.getColumn('amount').numFmt = '"R$" #,##0.00';
  // Para o cabeçalho não aparecer com os formatos de data/moeda.
  ws.getRow(1).eachCell((cell) => { cell.numFmt = '@'; });

  // Aba auxiliar com as categorias (fonte da lista suspensa). Nomes repetidos entre despesa e receita
  // aparecem uma vez só na lista (o Tipo da linha decide a qual dos dois a importação liga).
  const cs = wb.addWorksheet(CATS_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  cs.columns = [{ header: 'Categoria', key: 'name', width: 30 }, { header: 'Tipo', key: 'type', width: 12 }];
  cs.getRow(1).font = { bold: true };
  const seen = new Set();
  const ordered = [...categories.filter((c) => c.type === 'expense'), ...categories.filter((c) => c.type === 'income')];
  for (const c of ordered) {
    const k = textKey(c.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    cs.addRow({ name: String(c.name).trim(), type: TYPE_LABEL[c.type] });
  }
  const lastCatRow = Math.max(2, seen.size + 1);

  const last = TEMPLATE_ROWS + 1;
  ws.dataValidations.add(`B2:B${last}`, {
    type: 'list', allowBlank: true, formulae: ['"Despesa,Receita"'],
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Tipo', error: 'Escolha Despesa ou Receita.',
  });
  ws.dataValidations.add(`C2:C${last}`, {
    type: 'list', allowBlank: true, formulae: [`'${CATS_SHEET}'!$A$2:$A$${lastCatRow}`],
    // Aviso (e não bloqueio): digitar um nome novo é permitido, a importação cria a categoria.
    showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Categoria nova?',
    error: 'Essa categoria não está na lista. Se continuar, ela será criada como categoria nova ao importar.',
  });
  ws.dataValidations.add(`F2:F${last}`, {
    type: 'list', allowBlank: true, formulae: ['"Variável,Fixo"'],
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Natureza', error: 'Escolha Variável ou Fixo (vazio vale como Variável).',
  });
  ws.dataValidations.add(`G2:G${last}`, {
    type: 'list', allowBlank: true, formulae: ['"Sim,Não"'],
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Pago', error: 'Escolha Sim ou Não, ou deixe vazio (vale a data).',
  });
  ws.dataValidations.add(`H2:H${last}`, {
    type: 'list', allowBlank: true, formulae: [`"${PAID_WITH_LABEL.salario},${PAID_WITH_LABEL.cartao}"`],
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Saiu do',
    error: 'Escolha Salário ou Cartão de crédito, ou deixe vazio (vale como Salário).',
  });

  const hs = wb.addWorksheet(HELP_SHEET);
  hs.getColumn(1).width = 100;
  const help = [
    ['Como preencher a planilha da Caderneta', true],
    [''],
    ['Preencha a aba "Lançamentos", uma linha por lançamento, a partir da linha 2. Não mude o cabeçalho.'],
    ['Data: o dia do lançamento, no formato dd/mm/aaaa (ex.: 05/03/2026).'],
    ['Tipo: Despesa (dinheiro que saiu) ou Receita (dinheiro que entrou). Use a lista da célula.'],
    ['Categoria: escolha da lista (são as suas categorias, da aba "Categorias"). Pode digitar um nome novo:'],
    ['   a categoria será criada na importação. A categoria precisa ser do mesmo tipo da linha.'],
    ['Descrição: opcional (ex.: feira da semana). Até 120 caracteres.'],
    ['Valor (R$): sempre positivo, com centavos se houver (ex.: 1.234,56). O Tipo já diz se entrou ou saiu.'],
    ['Natureza: Fixo (repete todo mês, como aluguel) ou Variável. Vazio conta como Variável.'],
    ['Pago: opcional, só para Despesa. Sim (já pagou) ou Não (conta a pagar). Vazio segue a data: data de hoje ou'],
    ['   passada conta como paga, data futura fica "a pagar". Em Receita, esta coluna é ignorada.'],
    ['Saiu do: opcional, só para Despesa. Salário ou Cartão de crédito (de onde saiu o dinheiro). Vazio conta'],
    ['   como Salário. Em Receita, esta coluna é ignorada.'],
    [''],
    ['Para importar: na Caderneta, abra Lançamentos → Planilha (ou Ajustes → Planilha do Excel) → Importar planilha.'],
    ['Antes de gravar, o app mostra uma prévia: quantos lançamentos entram, categorias novas e linhas com erro.'],
    ['Linhas vazias são ignoradas. Lançamentos iguais a outros que já estão no app (mesma data, tipo, valor,'],
    ['categoria e descrição) não são importados de novo, então importar o mesmo arquivo duas vezes não duplica nada.'],
    [`As listas suspensas vão até a linha ${last}; depois disso ainda dá para digitar. Máximo de ${MAX_IMPORT_ROWS} linhas por importação.`],
  ];
  for (const [text, bold] of help) {
    const row = hs.addRow([text]);
    if (bold) row.font = { bold: true, size: 14 };
  }
  return wb;
}

// ---------- Leitura ----------

/** Valor "de verdade" de uma célula do ExcelJS (fórmula → resultado, texto rico → texto, link → texto). */
export function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  if ('result' in v) return cellValue(v.result);
  if (Array.isArray(v.richText)) return v.richText.map((r) => r.text || '').join('');
  if ('text' in v) return cellValue(v.text);
  if ('error' in v) return null;
  return null;
}

const isBlank = (v) => v == null || (typeof v === 'string' && !v.trim());

/** Acha a aba de lançamentos: pelo nome ("Lançamentos", sem acento/maiúscula) ou a primeira aba. */
function findDataSheet(wb) {
  const sheets = wb.worksheets || [];
  return sheets.find((s) => textKey(s.name) === textKey(DATA_SHEET)) || sheets[0] || null;
}

/**
 * Lê as linhas da aba "Lançamentos" de um Workbook já carregado.
 * Retorna { rows: [{ row, date, type, category, description, amount, nature, paid, paidWith }], truncated }
 * (`paid`/`paidWith` são null se a planilha não tiver as colunas opcionais "Pago"/"Saiu do").
 * Os valores vêm crus (como estão na célula); quem valida é planImport. Lança erro se não houver aba/cabeçalho.
 */
export function readSheetRows(wb) {
  const ws = findDataSheet(wb);
  if (!ws) throw new Error('A planilha não tem nenhuma aba.');
  // Cabeçalho na linha 1: mapeia cada coluna pelo nome; se não reconhecer, usa a ordem do modelo.
  const header = ws.getRow(1);
  const colOf = {};
  header.eachCell({ includeEmpty: false }, (cell, col) => {
    const k = textKey(cellValue(cell.value));
    const def = COLUMNS.find((c) => c.aliases.includes(k));
    if (def && !colOf[def.key]) colOf[def.key] = col;
  });
  const found = Object.keys(colOf).length;
  if (found && found < 3) throw new Error('Não reconheci o cabeçalho da aba "Lançamentos". Use a planilha modelo da Caderneta.');
  if (!found) COLUMNS.forEach((c, i) => { colOf[c.key] = i + 1; });

  const rows = [];
  let truncated = false;
  // eachRow percorre só as linhas que existem no arquivo (não cria milhares de linhas vazias na memória).
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (r < 2 || truncated) return;
    const rec = { row: r };
    for (const c of COLUMNS) rec[c.key] = colOf[c.key] ? cellValue(row.getCell(colOf[c.key]).value) : null;
    // Linha vazia (ou só com formatação, ou só com "Pago"/"Saiu do" escolhido na lista, sem lançamento): ignora.
    if (COLUMNS.every((c) => OPTIONAL_KEYS.has(c.key) || isBlank(rec[c.key]))) return;
    if (rows.length >= MAX_IMPORT_ROWS) { truncated = true; return; }
    rows.push(rec);
  });
  return { rows, truncated };
}

// ---------- Conversões (célula → dado do app) ----------

const validYMD = (y, m, d) => {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/**
 * Data da planilha para "AAAA-MM-DD". Aceita data real do Excel (o ExcelJS entrega um Date em UTC, que
 * representa o dia "de parede" — por isso os getters UTC, sem conversão de fuso), número de série do
 * Excel (célula sem formato de data) e texto dd/mm/aaaa (também d/m/aaaa e aaaa-mm-dd). Inválida → null.
 */
export function parseSheetDate(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Data com hora (ex.: 05/03 23:59) continua no próprio dia: só a parte da data importa.
    return validYMD(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === 'number') {
    if (!(v >= 1 && v < 2958466)) return null;
    return parseSheetDate(new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400) * 1000));
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return validYMD(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validYMD(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** Valor em centavos: número da célula ou texto "1.234,56" / "R$ 1.234,56". NaN se inválido. */
export function parseSheetMoney(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : NaN;
  return parseMoney(String(v ?? '').replace(/^r\$/i, ''));
}

export const parseSheetType = (v) => TYPE_WORDS[textKey(v)] || null;
export function parseSheetNature(v) {
  if (isBlank(v)) return 'variavel';
  return NATURE_WORDS[textKey(v)] || null;
}

/**
 * Coluna "Pago": true/false; null se vazia (vale a regra da data e o campo não é gravado);
 * undefined se não reconhecida. Aceita Sim/Não, S/N, Pago, X (sem maiúscula/acento) e VERDADEIRO/FALSO do Excel.
 */
export function parseSheetPaid(v) {
  if (isBlank(v)) return null;
  if (typeof v === 'boolean') return v;
  const k = textKey(v);
  return k in PAID_WORDS ? PAID_WORDS[k] : undefined;
}

/**
 * Coluna "Saiu do": 'salario' | 'cartao'; null se vazia (conta como salário e o campo não é gravado);
 * undefined se não reconhecida. Aceita Salário/S e Cartão/Cartão de crédito/Crédito/C, sem maiúscula/acento.
 */
export function parseSheetPaidWith(v) {
  if (isBlank(v)) return null;
  const k = textKey(v);
  return k in PAID_WITH_WORDS ? PAID_WITH_WORDS[k] : undefined;
}

/**
 * Assinatura usada para não duplicar: mesma data, tipo, valor, categoria e descrição (sem maiúscula/acento).
 * NÃO inclui `paid` nem `paidWith`: a mesma conta marcada como paga (ou trocada de origem) continua sendo a mesma linha.
 */
export const txSignature = (t) => [t.date, t.type, t.amount, t.categoryId, textKey(t.description)].join('|');

// ---------- Validação + plano de importação ----------

/**
 * Valida as linhas e monta o plano, SEM gravar nada.
 *  - categories/transactions: os dados atuais da pessoa (para casar categorias e achar duplicados);
 *  - newId: gerador de id para as categorias novas.
 * Retorna {
 *   transactions: [{ row, type, amount, date, categoryId, description, nature, paid?, paidWith? }],  // a importar
 *   newCategories: [{ id, name, type, icon, group }],                              // a criar
 *   duplicates: [número da linha...], errors: [{ row, reason }], total: linhas lidas (não vazias)
 * }
 * Duplicados contam como multiconjunto: duas linhas iguais no arquivo entram as duas na 1ª importação
 * (podem ser duas compras iguais no mesmo dia) e nenhuma entra quando o mesmo arquivo é importado de novo.
 */
export function planImport(rows, { categories, transactions }, { newId }) {
  const catByKey = { expense: new Map(), income: new Map() };
  for (const c of categories) {
    const k = textKey(c.name);
    if (k && catByKey[c.type] && !catByKey[c.type].has(k)) catByKey[c.type].set(k, c);
  }
  const existing = new Map();
  for (const t of transactions) { const s = txSignature(t); existing.set(s, (existing.get(s) || 0) + 1); }

  const out = { transactions: [], newCategories: [], duplicates: [], errors: [], total: rows.length };
  const fresh = { expense: new Map(), income: new Map() };

  for (const r of rows) {
    const problems = [];
    const date = isBlank(r.date) ? null : parseSheetDate(r.date);
    if (isBlank(r.date)) problems.push('data vazia');
    else if (!date) problems.push(`data inválida ("${String(r.date).trim()}"), use dd/mm/aaaa`);

    const type = parseSheetType(r.type);
    if (isBlank(r.type)) problems.push('tipo vazio (Despesa ou Receita)');
    else if (!type) problems.push(`tipo "${String(r.type).trim()}" não reconhecido (use Despesa ou Receita)`);

    const amount = isBlank(r.amount) ? NaN : parseSheetMoney(r.amount);
    if (isBlank(r.amount)) problems.push('valor vazio');
    else if (!Number.isFinite(amount)) problems.push(`valor "${String(r.amount).trim()}" inválido (ex.: 1.234,56)`);
    else if (amount < 0) problems.push('valor negativo: use valor positivo, o Tipo já diz se entrou ou saiu');
    else if (amount === 0) problems.push('valor zero');
    else if (amount >= 1e13) problems.push('valor grande demais');

    const nature = parseSheetNature(r.nature);
    if (!nature) problems.push(`natureza "${String(r.nature).trim()}" não reconhecida (use Fixo ou Variável)`);

    // Pago só conta em despesa; em receita a coluna é ignorada (mesmo com valor estranho).
    const paid = type === 'expense' ? parseSheetPaid(r.paid) : null;
    if (paid === undefined) problems.push(`pago "${String(r.paid).trim()}" não reconhecido (use Sim ou Não, ou deixe vazio)`);
    const paidWith = type === 'expense' ? parseSheetPaidWith(r.paidWith) : null;
    if (paidWith === undefined) problems.push(`"saiu do" "${String(r.paidWith).trim()}" não reconhecido (use Salário ou Cartão de crédito, ou deixe vazio)`);

    const catName = isBlank(r.category) ? '' : String(r.category).trim().slice(0, 40);
    const catKey = textKey(catName);
    let category = null;
    let isNew = false;
    if (!catKey) problems.push('categoria vazia');
    else if (type) {
      const other = type === 'expense' ? 'income' : 'expense';
      category = catByKey[type].get(catKey) || fresh[type].get(catKey) || null;
      if (!category && catByKey[other].has(catKey)) {
        problems.push(`a categoria "${catName}" é de ${other === 'income' ? 'receita' : 'despesa'}; mude o Tipo ou a categoria`);
      } else if (!category) {
        isNew = true;
      }
    }

    if (problems.length) { out.errors.push({ row: r.row, reason: problems.join('; ') }); continue; }

    if (isNew) {
      category = { id: newId(), name: catName, type, icon: NEW_CATEGORY_ICON, group: type === 'expense' ? NEW_CATEGORY_GROUP : null };
      fresh[type].set(catKey, category);
      out.newCategories.push(category);
    }
    const tx = {
      row: r.row, type, amount, date, categoryId: category.id,
      description: isBlank(r.description) ? '' : String(r.description).trim().slice(0, 120), nature,
    };
    if (typeof paid === 'boolean') tx.paid = paid; // vazio: sem o campo, vale a regra da data
    if (paidWith) tx.paidWith = paidWith; // vazio: sem o campo, conta como salário
    const sig = txSignature(tx);
    const left = existing.get(sig) || 0;
    if (left > 0) { existing.set(sig, left - 1); out.duplicates.push(r.row); continue; }
    out.transactions.push(tx);
  }
  return out;
}
