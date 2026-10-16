// Estado do app em memória + gravação imediata no armazenamento local (write-through).
// Toda gravação carimba `updatedAt` no registro e registra a mudança na fila local (`outbox`),
// que a sincronização (opcional, js/sync.js) envia para a conta quando houver login.
import { openStorage, STORES } from './db.js';
import { addMonths, currentMonth, daysInMonth, monthCmp, monthOf, monthsBetween, todayISO, uid } from './utils.js';
import { computeStreak, newlyUnlocked } from './gamification.js';
import { GENERATED_TS, mergeProgress, nextStamp, normTs, sameContent, tsMs, unionSkipped } from './merge.js';
import { textKey, txSignature } from './spreadsheet.js';
import { isPaidWith } from './finance.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_CATEGORIES = [
  // Despesas — grupo do método 50/30/20 e peso padrão para a sugestão de orçamento
  { id: 'moradia', name: 'Moradia', icon: '🏠', type: 'expense', group: 'necessidades', defaultWeight: 35 },
  { id: 'contas', name: 'Contas da casa', icon: '💡', type: 'expense', group: 'necessidades', defaultWeight: 10 },
  { id: 'alimentacao', name: 'Mercado', icon: '🛒', type: 'expense', group: 'necessidades', defaultWeight: 25 },
  { id: 'transporte', name: 'Transporte', icon: '🚌', type: 'expense', group: 'necessidades', defaultWeight: 12 },
  { id: 'saude', name: 'Saúde', icon: '🩺', type: 'expense', group: 'necessidades', defaultWeight: 10 },
  { id: 'educacao', name: 'Educação', icon: '📚', type: 'expense', group: 'necessidades', defaultWeight: 8 },
  { id: 'restaurantes', name: 'Restaurantes e delivery', icon: '🍔', type: 'expense', group: 'desejos', defaultWeight: 30 },
  { id: 'lazer', name: 'Lazer', icon: '🎉', type: 'expense', group: 'desejos', defaultWeight: 30 },
  { id: 'compras', name: 'Compras', icon: '🛍️', type: 'expense', group: 'desejos', defaultWeight: 25 },
  { id: 'assinaturas', name: 'Assinaturas', icon: '📺', type: 'expense', group: 'desejos', defaultWeight: 10 },
  { id: 'outros', name: 'Outros gastos', icon: '📦', type: 'expense', group: 'desejos', defaultWeight: 5 },
  { id: 'dividas', name: 'Dívidas e parcelas', icon: '💳', type: 'expense', group: 'futuro', defaultWeight: 50 },
  { id: 'investimentos', name: 'Guardar e investir', icon: '🌱', type: 'expense', group: 'futuro', defaultWeight: 50 },
  // Receitas
  { id: 'salario', name: 'Salário', icon: '💼', type: 'income', group: null },
  { id: 'renda-extra', name: 'Renda extra', icon: '🧰', type: 'income', group: null },
  { id: 'rendimentos', name: 'Rendimentos', icon: '📈', type: 'income', group: null },
  { id: 'outras-receitas', name: 'Outras receitas', icon: '💰', type: 'income', group: null },
];

const defaultSettings = () => ({
  id: 'settings', onboarded: false, name: '', income: 0, goal: 'organizar',
  hasDebt: null, hasReserve: null, theme: 'auto', createdAt: new Date().toISOString(), schema: SCHEMA_VERSION,
});

const defaultProgress = () => ({
  id: 'progress', lessons: {}, achievements: {}, activity: [], bestStreak: 0, flags: {}, dismissedTips: {},
});

export const state = {
  settings: defaultSettings(),
  progress: defaultProgress(),
  categories: [],
  transactions: [],
  recurrences: [],
  goals: [],
  storageMode: 'memory',
  deviceId: null,
};

let db = null;
const listeners = new Set();
const achievementListeners = new Set();
const localWriteListeners = new Set();

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const onAchievement = (fn) => { achievementListeners.add(fn); return () => achievementListeners.delete(fn); };
/** Avisado sempre que uma alteração local entra na fila de sincronização. */
export const onLocalWrite = (fn) => { localWriteListeners.add(fn); return () => localWriteListeners.delete(fn); };

function emit(reason) { for (const fn of listeners) fn(reason); }
function localWrote() { for (const fn of localWriteListeners) { try { fn(); } catch (err) { console.warn(err); } } }

// Categorias padrão contam como 'geradas' (carimbo GENERATED_TS): num aparelho novo, elas não podem
// vencer as categorias (com limites) que a pessoa já ajustou em outro aparelho.
function isPristineSeed(c) {
  const d = DEFAULT_CATEGORIES.find((x) => x.id === c.id);
  return Boolean(d) && !c.budget && c.name === d.name && c.icon === d.icon && c.type === d.type && (c.group ?? null) === (d.group ?? null);
}
const seedCategories = () => DEFAULT_CATEGORIES.map((c, i) => ({ ...c, budget: 0, order: i, updatedAt: GENERATED_TS }));

// ---------- Exclusão mútua ----------
// Toda operação que altera dados roda em fila (uma de cada vez). Isso impede que a aplicação de dados
// vindos do servidor se intercale com uma edição local no meio do caminho e a sobrescreva.
// Funções internas (prefixo _) assumem que a fila já está com elas e NUNCA chamam as exportadas.
let chain = Promise.resolve();
function locked(fn) {
  return (...args) => {
    const run = chain.then(() => fn(...args));
    chain = run.catch(() => {});
    return run;
  };
}

// ---------- Gravação com rastreamento ----------
const outboxEntry = (store, id, updatedAt, deleted = false) => ({
  key: `${store}:${id}`, store, id, updatedAt, deleted, rev: uid(),
});

/** Carimba `updatedAt` (sempre depois da versão anterior do mesmo registro). */
function touch(rec) { rec.updatedAt = nextStamp(rec.updatedAt); return rec; }

/** Operações de gravação de registro(s) + entradas da fila (para juntar várias stores numa transação só). */
function trackedOps(store, list, { stamp = true } = {}) {
  const ops = [];
  for (const r of list) {
    if (stamp) touch(r);
    ops.push({ store, put: r }, { store: 'outbox', put: outboxEntry(store, r.id, r.updatedAt || GENERATED_TS) });
  }
  return ops;
}

/** Grava registro(s) e as entradas da fila na mesma transação. */
async function persist(store, recs, { stamp = true } = {}) {
  const list = Array.isArray(recs) ? recs : [recs];
  if (!list.length) return;
  await db.write(trackedOps(store, list, { stamp }));
  localWrote();
}

/** Apaga o registro e deixa uma "lápide" na fila (a exclusão precisa chegar aos outros aparelhos). */
async function persistDelete(store, rec) {
  await db.write([{ store, del: rec.id }, { store: 'outbox', put: outboxEntry(store, rec.id, nextStamp(rec.updatedAt), true) }]);
  localWrote();
}

// ---------- Inicialização ----------
function lessonsWithDevice(progress) {
  // Tentativas antigas (sem contagem por aparelho) passam a ser deste aparelho.
  for (const l of Object.values(progress.lessons || {})) {
    if (l && typeof l === 'object' && !l.attemptsBy) l.attemptsBy = { [state.deviceId]: Number(l.attempts) || 0 };
  }
  return progress;
}

async function loadDeviceId() {
  const rec = await db.get('syncstate', 'device');
  if (rec?.deviceId) return rec.deviceId;
  const deviceId = uid();
  await db.put('syncstate', { id: 'device', deviceId, createdAt: new Date().toISOString() });
  return deviceId;
}

export async function initStore() {
  db = await openStorage();
  state.storageMode = db.mode;
  state.deviceId = await loadDeviceId();
  const [meta, categories, transactions, recurrences, goals] = await Promise.all(STORES.map((s) => db.getAll(s)));
  state.settings = { ...defaultSettings(), ...(meta.find((m) => m.id === 'settings') || {}) };
  state.progress = lessonsWithDevice({ ...defaultProgress(), ...(meta.find((m) => m.id === 'progress') || {}) });
  state.categories = categories;
  state.transactions = transactions;
  state.recurrences = recurrences;
  state.goals = goals;
  if (!categories.length) {
    state.categories = seedCategories();
    await persist('categories', state.categories, { stamp: false });
  }
  sortAll();
  await _materialize(false);
  return state;
}

function sortAll() {
  state.categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  state.transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || '').localeCompare(a.createdAt || '')));
  state.goals.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

/** Depois de qualquer mudança: verifica conquistas, grava progresso e avisa a interface. */
async function afterChange(reason) {
  sortAll();
  const unlocked = newlyUnlocked(state);
  if (unlocked.length) {
    const now = new Date().toISOString();
    for (const a of unlocked) state.progress.achievements[a.id] = now;
    await persist('meta', state.progress);
    for (const a of unlocked) for (const fn of achievementListeners) fn(a);
  }
  emit(reason);
}

// ---------- Configurações ----------
export const saveSettings = locked(async (patch) => {
  state.settings = { ...state.settings, ...patch };
  await persist('meta', state.settings);
  await afterChange('settings');
});

// ---------- Categorias ----------
export const categoryById = (id) => state.categories.find((c) => c.id === id);

export const upsertCategory = locked(async (data) => {
  const existing = data.id && categoryById(data.id);
  const cat = existing
    ? { ...existing, ...data }
    : { id: uid(), budget: 0, order: state.categories.length, group: data.type === 'expense' ? 'desejos' : null, ...data };
  if (cat.type === 'income') cat.group = null;
  const idx = state.categories.findIndex((c) => c.id === cat.id);
  if (idx >= 0) state.categories[idx] = cat; else state.categories.push(cat);
  await persist('categories', cat);
  await afterChange('categories');
  return cat;
});

async function _setBudgets(map) {
  const changed = [];
  for (const c of state.categories) {
    if (c.type !== 'expense' || !(c.id in map)) continue;
    c.budget = Math.max(0, Math.round(map[c.id] || 0));
    changed.push(c);
  }
  await persist('categories', changed);
  await afterChange('budgets');
}
export const setBudgets = locked(_setBudgets);

/** Remove a categoria e move os lançamentos para a categoria "outros" do mesmo tipo. */
export const deleteCategory = locked(async (id) => {
  const cat = categoryById(id);
  if (!cat) return;
  const fallbackId = cat.type === 'income' ? 'outras-receitas' : 'outros';
  if (id === fallbackId) throw new Error('Esta categoria recebe os lançamentos de categorias apagadas e não pode ser removida.');
  let fallback = categoryById(fallbackId);
  if (!fallback) {
    const def = DEFAULT_CATEGORIES.find((c) => c.id === fallbackId);
    fallback = { ...def, budget: 0, order: state.categories.length };
    state.categories.push(fallback);
    await persist('categories', fallback);
  }
  const moved = state.transactions.filter((t) => t.categoryId === id);
  for (const t of moved) t.categoryId = fallbackId;
  const recs = state.recurrences.filter((r) => r.categoryId === id);
  for (const r of recs) r.categoryId = fallbackId;
  await persist('transactions', moved);
  await persist('recurrences', recs);
  state.categories = state.categories.filter((c) => c.id !== id);
  await persistDelete('categories', cat);
  await afterChange('categories');
  return moved.length;
});

// ---------- Lançamentos ----------
function cleanTx(data) {
  const tx = {
    type: data.type === 'income' ? 'income' : 'expense',
    amount: Math.abs(Math.round(Number(data.amount) || 0)),
    date: data.date,
    categoryId: data.categoryId,
    description: String(data.description || '').trim().slice(0, 120),
    nature: data.nature === 'fixo' ? 'fixo' : 'variavel',
  };
  // `paid` só existe em despesa e só quando foi decidido (formulário, toque na lista, planilha).
  // Sem o campo vale a regra da data (isPaid em js/finance.js); receita nunca leva o campo.
  if (tx.type === 'expense' && typeof data.paid === 'boolean') tx.paid = data.paid;
  // `paidWith` ('salario' | 'cartao'): de onde saiu a despesa. Sem o campo conta como salário (paidWithOf).
  if (tx.type === 'expense' && isPaidWith(data.paidWith)) tx.paidWith = data.paidWith;
  return tx;
}

function recordActivity() {
  const today = todayISO();
  const act = state.progress.activity || [];
  if (!act.includes(today)) {
    act.push(today);
    act.sort();
    state.progress.activity = act.slice(-400);
  }
  state.progress.bestStreak = Math.max(state.progress.bestStreak || 0, computeStreak(state.progress.activity));
}

/** Cria um lançamento. Se `recurring`, cria a série mensal e as ocorrências até o mês atual. */
async function _addTransaction(data, { recurring = false } = {}) {
  const base = cleanTx(data);
  if (!(base.amount > 0)) throw new Error('Informe um valor maior que zero.');
  const now = new Date().toISOString();
  let tx;
  if (recurring) {
    // A série não guarda `paid`: só a 1ª ocorrência (a que a pessoa preencheu) leva a escolha do formulário;
    // as próximas são geradas sem o campo e seguem a regra da data. Já `paidWith` (salário/cartão) é atributo
    // fixo da conta: fica na série e as ocorrências geradas herdam.
    const { paid, ...seriesBase } = base; // eslint-disable-line no-unused-vars
    const rec = {
      id: uid(), ...seriesBase, day: Number(base.date.slice(8, 10)), startMonth: monthOf(base.date),
      endMonth: null, skipped: [], createdAt: now,
    };
    state.recurrences.push(rec);
    await persist('recurrences', rec);
    tx = { id: `${rec.id}:${rec.startMonth}`, ...base, seriesId: rec.id, createdAt: now };
  } else {
    tx = { id: uid(), ...base, seriesId: null, createdAt: now };
  }
  state.transactions.push(tx);
  await persist('transactions', tx);
  if (recurring) await _materialize(false);
  recordActivity();
  await persist('meta', state.progress);
  await afterChange('transactions');
  return tx;
}
export const addTransaction = locked(_addTransaction);

export const updateTransaction = locked(async (id, data, { applyToSeries = false } = {}) => {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) throw new Error('Lançamento não encontrado.');
  const base = cleanTx({ ...tx, ...data });
  if (!(base.amount > 0)) throw new Error('Informe um valor maior que zero.');
  Object.assign(tx, base);
  if (!('paid' in base)) delete tx.paid; // virou receita (ou `paid: undefined` explícito): volta para a regra da data
  if (!('paidWith' in base)) delete tx.paidWith; // virou receita: receita não tem origem
  await persist('transactions', tx);
  // `paid` nunca vai para a série: marcar ou editar uma ocorrência grava só nela. `paidWith` vai.
  if (applyToSeries && tx.seriesId) {
    const rec = state.recurrences.find((r) => r.id === tx.seriesId);
    if (rec) {
      Object.assign(rec, { type: base.type, amount: base.amount, categoryId: base.categoryId, description: base.description, nature: base.nature });
      if ('paidWith' in base) rec.paidWith = base.paidWith; else delete rec.paidWith;
      await persist('recurrences', rec);
    }
  }
  recordActivity();
  await persist('meta', state.progress);
  await afterChange('transactions');
  return tx;
});

/**
 * Marca uma despesa como paga (true) ou a pagar (false), pelo caminho normal de gravação
 * (carimbo + fila de sincronização + redesenho). Numa ocorrência de série, grava só nela.
 */
export const setTransactionPaid = locked(async (id, paid) => {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) throw new Error('Lançamento não encontrado.');
  if (tx.type !== 'expense') throw new Error('Só despesas podem ser marcadas como pagas.');
  tx.paid = Boolean(paid);
  await persist('transactions', tx);
  await afterChange('transactions');
  return tx;
});

export const deleteTransaction = locked(async (id) => {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;
  if (tx.seriesId) {
    // Lembra que este mês foi apagado de propósito, para a série não recriá-lo (em nenhum aparelho).
    const rec = state.recurrences.find((r) => r.id === tx.seriesId);
    if (rec) {
      rec.skipped = [...new Set([...(rec.skipped || []), monthOf(tx.date)])];
      await persist('recurrences', rec);
    }
  }
  state.transactions = state.transactions.filter((t) => t.id !== id);
  await persistDelete('transactions', tx);
  await afterChange('transactions');
});

/**
 * Importação em lote (planilha): cria as categorias novas e os lançamentos numa única gravação atômica,
 * com um único redesenho e todos os registros na fila de sincronização. Recebe o plano de planImport
 * (js/spreadsheet.js) e confere de novo contra o estado ATUAL, porque algo pode ter mudado entre a
 * prévia e a confirmação (ex.: a sincronização trouxe a mesma categoria ou os mesmos lançamentos):
 *  - categoria nova cujo nome já existe no mesmo tipo passa a usar a existente;
 *  - lançamento igual a um existente (mesma data, tipo, valor, categoria e descrição) é ignorado.
 * Retorna { added, categoriesCreated, skipped }.
 */
export const importTransactions = locked(async ({ newCategories = [], transactions = [] }) => {
  const idMap = new Map();
  const cats = [];
  for (const c of newCategories) {
    const same = state.categories.find((x) => x.type === c.type && textKey(x.name) === textKey(c.name))
      || cats.find((x) => x.type === c.type && textKey(x.name) === textKey(c.name));
    if (same) { idMap.set(c.id, same.id); continue; }
    const cat = {
      id: c.id, name: String(c.name).trim().slice(0, 40), icon: c.icon || '🏷️', type: c.type === 'income' ? 'income' : 'expense',
      group: c.type === 'income' ? null : (c.group || 'desejos'), budget: 0, order: state.categories.length + cats.length,
    };
    cats.push(cat);
  }
  const known = new Set([...state.categories, ...cats].map((c) => c.id));
  const existing = new Map();
  for (const t of state.transactions) { const s = txSignature(t); existing.set(s, (existing.get(s) || 0) + 1); }
  const now = new Date().toISOString();
  const txs = [];
  let skipped = 0;
  for (const data of transactions) {
    const base = cleanTx({ ...data, categoryId: idMap.get(data.categoryId) || data.categoryId });
    if (!(base.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(base.date) || !known.has(base.categoryId)) { skipped++; continue; }
    const s = txSignature(base);
    const left = existing.get(s) || 0;
    if (left > 0) { existing.set(s, left - 1); skipped++; continue; }
    txs.push({ id: uid(), ...base, seriesId: null, createdAt: now });
  }
  // Só cria as categorias que ficaram com algum lançamento.
  const used = new Set(txs.map((t) => t.categoryId));
  const keptCats = cats.filter((c) => used.has(c.id));
  if (!txs.length) return { added: 0, categoriesCreated: 0, skipped };

  // Grava primeiro; o estado em memória só muda se a gravação deu certo (falha = nada importado).
  await db.write([...trackedOps('categories', keptCats), ...trackedOps('transactions', txs)]);
  localWrote();
  state.categories.push(...keptCats);
  state.transactions.push(...txs);
  recordActivity();
  await persist('meta', state.progress);
  await afterChange('transactions');
  return { added: txs.length, categoriesCreated: keptCats.length, skipped };
});

export const recurrenceById = (id) => state.recurrences.find((r) => r.id === id);

/** Encerra a série: nada é apagado, só deixa de gerar ocorrências depois do mês atual. */
export const stopRecurrence = locked(async (seriesId) => {
  const rec = recurrenceById(seriesId);
  if (!rec) return;
  const cm = currentMonth();
  rec.endMonth = monthCmp(rec.startMonth, cm) > 0 ? rec.startMonth : cm;
  await persist('recurrences', rec);
  await afterChange('transactions');
});

/**
 * Gera as ocorrências que faltam de cada série, do início até o mês atual.
 * Idempotente: o id da ocorrência é "<serie>:<AAAA-MM>", então nunca duplica — nem entre aparelhos.
 * A ocorrência gerada leva o carimbo GENERATED_TS (o mais antigo possível): se outro aparelho já
 * editou ou apagou essa ocorrência, a versão dele sempre vence a geração automática.
 */
async function _materialize(notify = true) {
  const cm = currentMonth();
  const existing = new Set(state.transactions.map((t) => t.id));
  const created = [];
  for (const rec of state.recurrences) {
    const until = rec.endMonth && monthCmp(rec.endMonth, cm) < 0 ? rec.endMonth : cm;
    for (const ym of monthsBetween(rec.startMonth, until)) {
      const id = `${rec.id}:${ym}`;
      if (existing.has(id) || (rec.skipped || []).includes(ym)) continue;
      const day = String(Math.min(rec.day || 1, daysInMonth(ym))).padStart(2, '0');
      const tx = {
        id, type: rec.type, amount: rec.amount, date: `${ym}-${day}`, categoryId: rec.categoryId,
        description: rec.description, nature: rec.nature, seriesId: rec.id, createdAt: new Date().toISOString(), updatedAt: GENERATED_TS,
      };
      // Origem (salário/cartão) é herdada da série; `paid` nunca (cai na regra da data).
      if (rec.type === 'expense' && isPaidWith(rec.paidWith)) tx.paidWith = rec.paidWith;
      created.push(tx);
      existing.add(id);
    }
  }
  if (created.length) {
    state.transactions.push(...created);
    await persist('transactions', created, { stamp: false });
    if (notify) await afterChange('transactions');
  }
  return created.length;
}
export const materializeRecurrences = locked(_materialize);

// ---------- Metas ----------
export const goalById = (id) => state.goals.find((g) => g.id === id);

export const upsertGoal = locked(async (data) => {
  const existing = data.id && goalById(data.id);
  const goal = existing
    ? { ...existing, ...data }
    : { id: uid(), saved: 0, history: [], createdAt: new Date().toISOString(), kind: 'outro', icon: '🎯', deadline: null, ...data };
  goal.target = Math.max(0, Math.round(goal.target || 0));
  goal.saved = Math.max(0, Math.round(goal.saved || 0));
  const idx = state.goals.findIndex((g) => g.id === goal.id);
  if (idx >= 0) state.goals[idx] = goal; else state.goals.push(goal);
  await persist('goals', goal);
  await afterChange('goals');
  return goal;
});

export const deleteGoal = locked(async (id) => {
  const goal = goalById(id);
  state.goals = state.goals.filter((g) => g.id !== id);
  if (goal) await persistDelete('goals', goal);
  await afterChange('goals');
});

/**
 * Guarda (valor positivo) ou retira (negativo) dinheiro da meta.
 * Com `registerTx`, também cria o lançamento correspondente no mês.
 */
export const contributeGoal = locked(async (id, amount, { registerTx = true, date = todayISO() } = {}) => {
  const goal = goalById(id);
  if (!goal) throw new Error('Meta não encontrada.');
  const value = Math.round(amount);
  if (!value) throw new Error('Informe um valor.');
  if (value < 0 && -value > goal.saved) throw new Error('Não dá para retirar mais do que está guardado.');
  goal.saved += value;
  goal.history = [...(goal.history || []), { date, amount: value }].slice(-200);
  await persist('goals', goal);
  if (registerTx) {
    await _addTransaction({
      type: value > 0 ? 'expense' : 'income',
      amount: Math.abs(value),
      date,
      categoryId: value > 0 ? 'investimentos' : 'outras-receitas',
      description: value > 0 ? `Guardado na meta: ${goal.name}` : `Retirado da meta: ${goal.name}`,
      nature: 'variavel',
    });
  } else {
    await afterChange('goals');
  }
  return goal;
});

// ---------- Educação ----------
export const saveLessonResult = locked(async (lessonId, correct, total, { silent = false } = {}) => {
  const prev = state.progress.lessons[lessonId] || {};
  const now = new Date().toISOString();
  // Tentativas contadas por aparelho: ao juntar dois aparelhos, soma-se sem contar duas vezes.
  const attemptsBy = { ...(prev.attemptsBy || {}) };
  attemptsBy[state.deviceId] = (Number(attemptsBy[state.deviceId]) || 0) + 1;
  state.progress.lessons[lessonId] = {
    done: true, last: correct, lastAt: now, best: Math.max(prev.best || 0, correct), total,
    doneAt: prev.doneAt || now, attemptsBy, attempts: Object.values(attemptsBy).reduce((s, n) => s + (Number(n) || 0), 0),
  };
  await persist('meta', state.progress);
  await afterChange(silent ? 'progress:silent' : 'progress');
});

export const dismissTip = locked(async (tipKey) => {
  state.progress.dismissedTips = { ...(state.progress.dismissedTips || {}), [tipKey]: new Date().toISOString() };
  await persist('meta', state.progress);
  emit('progress');
});

export const setFlag = locked(async (name, value = new Date().toISOString()) => {
  state.progress.flags = { ...(state.progress.flags || {}), [name]: value };
  await persist('meta', state.progress);
  await afterChange('progress');
});

// ---------- Backup ----------
export function exportData() {
  return {
    app: 'caderneta',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      meta: [state.settings, state.progress],
      categories: state.categories,
      transactions: state.transactions,
      recurrences: state.recurrences,
      goals: state.goals,
    },
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 120;
const isCents = (v) => Number.isInteger(v) && v >= 0 && v < 1e13;

/**
 * Valida um backup antes de importar. Registros inválidos são descartados e contados;
 * se a estrutura geral não bater, lança erro e NADA é alterado.
 */
export function validateBackup(json) {
  if (!json || typeof json !== 'object' || json.app !== 'caderneta' || typeof json.data !== 'object') {
    throw new Error('Este arquivo não é um backup da Caderneta.');
  }
  if (Number(json.schema) > SCHEMA_VERSION) {
    throw new Error('Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.');
  }
  const d = json.data;
  const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
  let dropped = 0;
  const keep = (list, ok) => list.filter((x) => { const v = x && typeof x === 'object' && isId(x.id) && ok(x); if (!v) dropped++; return v; });

  const categories = keep(arr('categories'), (c) => typeof c.name === 'string' && ['income', 'expense'].includes(c.type))
    .map((c) => ({ ...c, name: c.name.slice(0, 60), budget: isCents(c.budget) ? c.budget : 0 }));
  const catIds = new Set(categories.map((c) => c.id));
  const transactions = keep(arr('transactions'), (t) => ['income', 'expense'].includes(t.type) && isCents(t.amount) && t.amount > 0
    && ISO_DATE.test(t.date) && catIds.has(t.categoryId))
    // `paid` só vale como boolean em despesa e `paidWith` só como 'salario'/'cartao' em despesa; qualquer outra
    // coisa é descartada (o lançamento fica, nas regras padrão: data e salário).
    .map((t) => {
      const out = { ...t };
      if ('paid' in out && !(out.type === 'expense' && typeof out.paid === 'boolean')) delete out.paid;
      if ('paidWith' in out && !(out.type === 'expense' && isPaidWith(out.paidWith))) delete out.paidWith;
      return out;
    });
  const recurrences = keep(arr('recurrences'), (r) => ['income', 'expense'].includes(r.type) && isCents(r.amount)
    && YM.test(r.startMonth) && (r.endMonth == null || YM.test(r.endMonth)) && catIds.has(r.categoryId))
    .map((r) => {
      const out = { ...r };
      delete out.paid; // a série nunca guarda paid
      if ('paidWith' in out && !(out.type === 'expense' && isPaidWith(out.paidWith))) delete out.paidWith;
      return out;
    });
  const goals = keep(arr('goals'), (g) => typeof g.name === 'string' && isCents(g.target) && isCents(g.saved));
  const meta = arr('meta').filter((m) => m && (m.id === 'settings' || m.id === 'progress'));
  if (!categories.length) throw new Error('O backup não tem categorias válidas.');
  return { data: { meta, categories, transactions, recurrences, goals }, dropped, counts: { transactions: transactions.length, goals: goals.length } };
}

/**
 * Substitui TODOS os dados (gravação atômica) e registra na fila: lápides para o que existia e não
 * existe mais, e versões novas (carimbadas agora) para tudo que ficou. Com a sincronização ligada,
 * isso faz a substituição valer em todos os aparelhos da conta.
 */
async function replaceEverything(next) {
  const outbox = new Map();
  const current = currentRecords();
  for (const store of STORES) {
    const keepIds = new Set(next[store].map((r) => r.id));
    for (const r of current[store]) {
      if (!keepIds.has(r.id)) outbox.set(`${store}:${r.id}`, outboxEntry(store, r.id, nextStamp(r.updatedAt), true));
    }
    const prevById = new Map(current[store].map((r) => [r.id, r]));
    for (const r of next[store]) {
      r.updatedAt = nextStamp(prevById.get(r.id)?.updatedAt ?? r.updatedAt);
      outbox.set(`${store}:${r.id}`, outboxEntry(store, r.id, r.updatedAt));
    }
  }
  await db.replaceAll(next, [...outbox.values()].map((e) => ({ store: 'outbox', put: e })));
  localWrote();
}

function currentRecords() {
  return {
    meta: [state.settings, state.progress].filter(Boolean),
    categories: state.categories,
    transactions: state.transactions,
    recurrences: state.recurrences,
    goals: state.goals,
  };
}

export const importData = locked(async (json) => {
  const { data, dropped, counts } = validateBackup(json);
  const settings = { ...defaultSettings(), ...(data.meta.find((m) => m.id === 'settings') || {}), onboarded: true };
  const progress = lessonsWithDevice({ ...defaultProgress(), ...(data.meta.find((m) => m.id === 'progress') || {}) });
  const next = { ...data, meta: [settings, progress] };
  await replaceEverything(next);
  state.settings = settings;
  state.progress = progress;
  state.categories = data.categories;
  state.transactions = data.transactions;
  state.recurrences = data.recurrences;
  state.goals = data.goals;
  await _materialize(false);
  await afterChange('import');
  return { dropped, counts };
});

/** "Apagar todos os dados": com a sincronização ligada, apaga também na conta (lápides). */
export const resetAll = locked(async () => {
  const next = { meta: [], categories: seedCategories(), transactions: [], recurrences: [], goals: [] };
  await replaceEverything(next);
  setFreshState(next.categories);
  emit('reset');
});

function setFreshState(categories) {
  state.settings = defaultSettings();
  state.progress = defaultProgress();
  state.categories = categories;
  state.transactions = [];
  state.recurrences = [];
  state.goals = [];
}

// ---------- Interface com a sincronização (js/sync.js) ----------

/** Apaga os dados SÓ deste aparelho (sem lápides, fila zerada). Usado ao sair da conta e ao "usar só os dados da conta". */
export const wipeLocal = locked(async ({ seed = true } = {}) => {
  const categories = seed ? seedCategories() : [];
  await db.replaceAll({ meta: [], categories, transactions: [], recurrences: [], goals: [] }, [{ store: 'outbox', clear: true }]);
  setFreshState(categories);
  emit('reset');
});

/** Se não sobrou nenhuma categoria (conta vazia), recria as padrão e as coloca na fila. */
export const ensureSeeded = locked(async () => {
  if (state.categories.length) return false;
  state.categories = seedCategories();
  await persist('categories', state.categories, { stamp: false });
  await afterChange('categories');
  return true;
});

/**
 * Primeiro login neste aparelho: coloca TODOS os registros locais na fila, sem alterar os registros.
 * Antes, descarta a fila antiga: lápides de coisas apagadas enquanto o aparelho não tinha conta NÃO
 * devem apagar nada na conta ("juntar sem apagar nada").
 */
export const markAllForSync = locked(async () => {
  const ops = [{ store: 'outbox', clear: true }];
  const recs = currentRecords();
  for (const store of STORES) {
    for (const r of recs[store]) {
      // Categoria padrão nunca mexida conta como gerada: não pode vencer a versão (com limites) da conta.
      if (store === 'categories' && r.updatedAt !== GENERATED_TS && isPristineSeed(r)) {
        r.updatedAt = GENERATED_TS;
        ops.push({ store, put: r });
      }
      ops.push({ store: 'outbox', put: outboxEntry(store, r.id, r.updatedAt || GENERATED_TS) });
    }
  }
  await db.write(ops);
  localWrote();
  return ops.length - 1;
});

export const clearOutbox = locked(async () => { await db.write([{ store: 'outbox', clear: true }]); });

/**
 * Marca entradas da fila que o servidor recusou por conteúdo (ex.: violou uma validação). Elas param de
 * ser reenviadas a cada sincronização, mas continuam na fila: se o registro mudar, a entrada é trocada
 * por uma nova (sem a marca) e volta a ser enviada. Só marca se a entrada não mudou desde o envio.
 */
export const markRejected = locked(async (entries, reason) => {
  const ops = [];
  for (const e of entries) {
    const cur = await db.get('outbox', e.key);
    if (cur && cur.rev === e.rev) ops.push({ store: 'outbox', put: { ...cur, rejected: String(reason || 'recusado').slice(0, 200) } });
  }
  if (ops.length) await db.write(ops);
  return ops.length;
});

export const readOutbox = () => db.getAll('outbox');
export const ackOutbox = (entries) => db.ackOutbox(entries);
export const readStore = (store) => db.getAll(store);
export const getSyncState = (id) => db.get('syncstate', id);
export const putSyncState = (rec) => db.put('syncstate', rec);
export const deleteSyncState = (id) => db.delete('syncstate', id);

/** Quanto há de dado "de verdade" neste aparelho (para avisar antes do primeiro login). */
export function localSummary() {
  return {
    transactions: state.transactions.length,
    goals: state.goals.length,
    recurrences: state.recurrences.length,
    customCategories: state.categories.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.id === c.id)).length,
    onboarded: Boolean(state.settings.onboarded),
    lessons: Object.keys(state.progress.lessons || {}).length,
  };
}

const ARRAY_OF = { categories: 'categories', transactions: 'transactions', recurrences: 'recurrences', goals: 'goals' };

function localRecord(table, id) {
  if (table === 'meta') return id === 'settings' ? state.settings : id === 'progress' ? state.progress : null;
  return state[ARRAY_OF[table]].find((r) => r.id === id) || null;
}

function setLocalRecord(table, rec) {
  if (table === 'meta') {
    if (rec.id === 'settings') state.settings = { ...defaultSettings(), ...rec };
    else if (rec.id === 'progress') state.progress = lessonsWithDevice({ ...defaultProgress(), ...rec });
    return;
  }
  const list = state[ARRAY_OF[table]];
  const idx = list.findIndex((r) => r.id === rec.id);
  if (idx >= 0) list[idx] = rec; else list.push(rec);
}

function removeLocalRecord(table, id) {
  if (table === 'meta') {
    if (id === 'settings') state.settings = defaultSettings();
    else if (id === 'progress') state.progress = defaultProgress();
    return;
  }
  state[ARRAY_OF[table]] = state[ARRAY_OF[table]].filter((r) => r.id !== id);
}

/**
 * Aplica linhas vindas do servidor ({ id, data, deleted, client_updated_at }).
 * Regras:
 *  - se há alteração local pendente MAIS NOVA (ou igual) para o mesmo id, a local fica (será enviada);
 *  - senão vence o servidor: grava/apaga localmente e descarta a pendência velha;
 *  - meta/progress: junta (mergeProgress) em vez de escolher um lado; se a junção difere do servidor, volta para a fila;
 *  - recorrências: os meses pulados são unidos (um mês apagado em qualquer aparelho continua pulado).
 * Retorna { applied, requeued }.
 */
export const applyRemote = locked(async (table, rows) => {
  if (!STORES.includes(table) || !rows.length) return { applied: 0, requeued: 0 };
  const pendingById = new Map((await db.getAll('outbox')).filter((e) => e.store === table).map((e) => [e.id, e]));
  const ops = [];
  const memory = [];
  let applied = 0;
  let requeued = 0;

  for (const row of rows) {
    const rts = normTs(row.client_updated_at);
    const pending = pendingById.get(row.id);
    const local = localRecord(table, row.id);
    const remoteData = row.data && typeof row.data === 'object' ? { ...row.data, id: row.id, updatedAt: rts } : { id: row.id, updatedAt: rts };

    // Progresso: sempre junta os dois lados.
    if (table === 'meta' && row.id === 'progress' && !row.deleted) {
      const merged = mergeProgress(local || {}, remoteData, state.deviceId);
      if (sameContent(merged, remoteData)) {
        merged.updatedAt = rts;
        if (pending) ops.push({ store: 'outbox', del: pending.key });
        if (!local || !sameContent(local, merged) || local.updatedAt !== rts) {
          ops.push({ store: 'meta', put: merged }); memory.push(() => setLocalRecord('meta', merged)); applied++;
        }
      } else {
        merged.updatedAt = nextStamp(tsMs(local?.updatedAt) > tsMs(rts) ? local.updatedAt : rts);
        ops.push({ store: 'meta', put: merged }, { store: 'outbox', put: outboxEntry('meta', 'progress', merged.updatedAt) });
        memory.push(() => setLocalRecord('meta', merged));
        applied++; requeued++;
      }
      continue;
    }

    if (pending && tsMs(pending.updatedAt) >= tsMs(rts)) {
      // A versão local é mais nova e ainda vai subir. Só aproveita os meses pulados vindos do servidor.
      if (table === 'recurrences' && local && !pending.deleted && !row.deleted) {
        const skipped = unionSkipped(local.skipped, remoteData.skipped);
        if (skipped.length !== (local.skipped || []).length) {
          const upd = { ...local, skipped };
          ops.push({ store: 'recurrences', put: upd });
          memory.push(() => setLocalRecord('recurrences', upd));
          applied++;
        }
      }
      continue;
    }

    // Servidor vence.
    if (pending) ops.push({ store: 'outbox', del: pending.key });
    if (row.deleted) {
      if (local) { ops.push({ store: table, del: row.id }); memory.push(() => removeLocalRecord(table, row.id)); applied++; }
      continue;
    }
    let rec = remoteData;
    if (table === 'recurrences' && local) {
      const skipped = unionSkipped(remoteData.skipped, local.skipped);
      if (skipped.length !== (remoteData.skipped || []).length) {
        rec = { ...remoteData, skipped, updatedAt: nextStamp(rts) };
        ops.push({ store: 'outbox', put: outboxEntry('recurrences', rec.id, rec.updatedAt) });
        requeued++;
      }
    }
    if (local && local.updatedAt === rec.updatedAt && sameContent(local, rec)) continue; // já igual (eco do próprio envio)
    ops.push({ store: table, put: rec });
    memory.push(() => setLocalRecord(table, rec));
    applied++;
  }

  if (ops.length) await db.write(ops);
  for (const fn of memory) fn();
  if (requeued) localWrote();
  return { applied, requeued };
});

/** Depois de aplicar um lote vindo do servidor: gera recorrências que faltam e redesenha a interface. */
export const finishRemoteApply = locked(async () => {
  sortAll();
  await _materialize(false);
  await afterChange('sync');
});

// Exposto só para testes manuais no console: window.__caderneta
export const _debug = { state, addMonths };
