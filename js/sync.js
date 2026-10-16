// Motor de sincronização (opcional) entre o armazenamento local e a conta no Supabase.
//
// Modelo: cada store local espelha uma tabela (user_id, id, data jsonb, deleted, client_updated_at,
// server_updated_at). O servidor aplica "o mais recente vence" por client_updated_at (gatilho no banco)
// e carimba server_updated_at; o app baixa só o que mudou desde o último cursor.
//
//  ordem: pull, depois push (e um 2º push se a junção gerou versão nova).
//  push: lê a fila local (outbox), faz upsert em lote e tira da fila só o que foi enviado e não mudou
//        de novo durante o envio. O que o servidor ignorou (ele tinha versão mais nova) é baixado e aplicado.
//  pull: por tabela, server_updated_at >= cursor (com uma margem para trás), paginado; aplica localmente
//        respeitando alterações locais pendentes mais novas (regras em store.applyRemote).
//
// Nunca bloqueia a interface: sem rede, as mudanças só se acumulam na fila.
// O motor recebe `store` e `getClient` por parâmetro (dá para testar no Node com um cliente falso).
import { STORES } from './db.js';
import { tsMs } from './merge.js';

const COLS = 'id,data,deleted,client_updated_at,server_updated_at';
const PAGE_SIZE = 1000;
const PUSH_CHUNK = 200;
const IN_CHUNK = 100;
// Margem do cursor: uma transação que gravou antes mas confirmou depois de um pull não fica para trás.
const OVERLAP_MS = 30 * 1000;
const RETRY_BASE_MS = 15 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

export class SyncError extends Error {
  constructor(kind, message, cause) { super(message); this.kind = kind; this.cause = cause; }
}

/** Classifica um erro do supabase-js / fetch: 'network' | 'auth' | 'data' | 'other'. */
export function classifyError(error, status) {
  if (!error) return 'other';
  if (error.kind) return error.kind;
  const msg = String(error.message || error);
  const code = String(error.code || '');
  if (status === 0 || error.name === 'TypeError' || error.name === 'AuthRetryableFetchError'
    || /failed to fetch|networkerror|fetch failed|load failed|network request failed|timeout|aborted/i.test(msg)) return 'network';
  if (status === 401 || error.status === 401 || /^PGRST30[0-9]$/.test(code) || /jwt/i.test(msg)) return 'auth';
  if (/^(22|23)/.test(code)) return 'data'; // 22xxx dado inválido, 23xxx restrição (check, not null...)
  return 'other';
}

const MESSAGES = {
  network: 'Sem conexão com o servidor. As alterações ficam guardadas e sobem quando a internet voltar.',
  auth: 'Sua sessão expirou. Entre de novo para voltar a sincronizar (nada foi perdido).',
  other: 'Não foi possível sincronizar agora. Vamos tentar de novo em instantes; nada foi perdido.',
};

export function createSyncEngine({ store, getClient, debounceMs = 2000, now = () => Date.now(), env = globalThis } = {}) {
  const listeners = new Set();
  const status = {
    linked: false, userId: null, email: null,
    phase: 'idle', // idle | syncing | offline | error | auth
    message: '', lastSyncAt: null, pending: 0, rejected: 0,
  };
  let link = null;
  let running = null;
  let again = false;
  let debounceTimer = null;
  let retryTimer = null;
  let countsTimer = null;
  let failures = 0;
  let started = false;
  const cleanups = [];

  const snapshot = () => ({ ...status });
  const emitStatus = () => { const s = snapshot(); for (const fn of listeners) { try { fn(s); } catch (err) { console.warn(err); } } };
  const setStatus = (patch) => { Object.assign(status, patch); emitStatus(); };

  async function refreshCounts() {
    const all = await store.readOutbox();
    const rejected = all.filter((e) => e.rejected).length;
    status.pending = all.length - rejected;
    status.rejected = rejected;
    emitStatus();
  }
  const countsSoon = () => { clearTimeout(countsTimer); countsTimer = setTimeout(() => refreshCounts().catch(() => {}), 250); };

  async function init() {
    link = (await store.getSyncState('link')) || null;
    Object.assign(status, {
      linked: Boolean(link), userId: link?.userId || null, email: link?.email || null, lastSyncAt: link?.lastSyncAt || null,
    });
    await refreshCounts();
    return snapshot();
  }

  function schedule(ms = debounceMs) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { syncNow({ reason: 'local' }); }, ms);
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    if (!link) return;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
    retryTimer = setTimeout(() => {
      if (env.document && env.document.visibilityState === 'hidden') return; // volta no visibilitychange
      syncNow({ reason: 'retry' });
    }, delay);
  }

  function start() {
    if (started) return;
    started = true;
    cleanups.push(store.onLocalWrite(() => { countsSoon(); if (link) schedule(); }));
    const on = (target, ev, fn) => { if (target?.addEventListener) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); } };
    on(env, 'online', () => syncNow({ reason: 'online' }));
    on(env, 'offline', () => { if (link) setStatus({ phase: 'offline', message: MESSAGES.network }); });
    on(env.document, 'visibilitychange', () => { if (env.document.visibilityState === 'visible') syncNow({ reason: 'visible' }); });
  }

  function stop() {
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignora */ } }
    started = false;
    clearTimeout(debounceTimer); clearTimeout(retryTimer); clearTimeout(countsTimer);
  }

  /** Sincroniza agora (se houver conta). Nunca lança: o resultado e o status dizem o que houve. */
  function syncNow({ reason = 'manual' } = {}) {
    if (!link) return Promise.resolve({ skipped: 'unlinked' });
    if (running) { again = true; return running; }
    running = (async () => {
      let result;
      try {
        do { again = false; result = await runOnce(reason); } while (again && link);
      } finally {
        running = null;
      }
      return result;
    })();
    return running;
  }

  async function runOnce(reason, authRetried = false) {
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    if (!link) return { skipped: 'unlinked' };
    if (env.navigator && env.navigator.onLine === false) {
      setStatus({ phase: 'offline', message: MESSAGES.network });
      await refreshCounts();
      return { skipped: 'offline' };
    }
    let client;
    try {
      client = await getClient();
    } catch (err) {
      failures++;
      setStatus({ phase: 'error', message: 'Não foi possível carregar o módulo de sincronização. Tente de novo.' });
      scheduleRetry();
      return { error: 'other', detail: err?.message };
    }

    const sess = await client.auth.getSession().catch((err) => ({ data: { session: null }, error: err }));
    const session = sess?.data?.session || null;
    if (!session) {
      const kind = sess?.error ? classifyError(sess.error) : 'auth';
      if (kind === 'network') {
        failures++;
        setStatus({ phase: 'offline', message: MESSAGES.network });
        scheduleRetry();
        return { error: 'network' };
      }
      setStatus({ phase: 'auth', message: MESSAGES.auth });
      return { error: 'auth' };
    }
    if (session.user.id !== link.userId) {
      setStatus({ phase: 'auth', message: 'A sessão aberta é de outra conta. Saia e entre de novo.' });
      return { error: 'auth' };
    }

    setStatus({ phase: 'syncing', message: '' });
    const ctx = { applied: 0 };
    try {
      // Baixa primeiro: assim o progresso (que é juntado, não substituído) já sobe com o que está na conta,
      // e um aparelho novo nunca sobrescreve no servidor algo que só existia lá.
      await pull(client, ctx);
      // Aplica de vez o que chegou (recorrências que faltam, conquistas): o que isso gerar já sobe nesta rodada.
      if (ctx.applied) await store.finishRemoteApply();
      await store.ensureSeeded();
      const appliedBeforePush = ctx.applied;
      let pushed = await push(client, link.userId, ctx);
      // O servidor pode ter ignorado algo (tinha versão mais nova) e a junção gerou versão nova: envia já.
      if ((await store.readOutbox()).some((e) => !e.rejected)) pushed += await push(client, link.userId, ctx);
      if (ctx.applied > appliedBeforePush) await store.finishRemoteApply();
      link = { ...link, lastSyncAt: new Date(now()).toISOString() };
      await store.putSyncState(link);
      failures = 0;
      await refreshCounts();
      // Gravações feitas por esta própria rodada já subiram: não precisa de outra rodada só por elas.
      if (!status.pending) clearTimeout(debounceTimer);
      setStatus({ phase: 'idle', message: status.rejected ? `${status.rejected} alteração(ões) recusada(s) pelo servidor.` : '', lastSyncAt: link.lastSyncAt });
      return { ok: true, reason, pushed, applied: ctx.applied };
    } catch (err) {
      const kind = classifyError(err);
      if (ctx.applied) await store.finishRemoteApply().catch(() => {});
      if (kind === 'auth' && !authRetried) {
        const r = await client.auth.refreshSession().catch((e) => ({ error: e }));
        if (!r?.error && r?.data?.session) return runOnce(reason, true);
        if (r?.error && classifyError(r.error) === 'network') {
          failures++;
          setStatus({ phase: 'offline', message: MESSAGES.network });
          scheduleRetry();
          await refreshCounts();
          return { error: 'network' };
        }
      }
      await refreshCounts();
      if (kind === 'auth') {
        setStatus({ phase: 'auth', message: MESSAGES.auth });
        return { error: 'auth' };
      }
      failures++;
      setStatus({ phase: kind === 'network' ? 'offline' : 'error', message: MESSAGES[kind] || MESSAGES.other });
      if (kind !== 'network') console.warn('[caderneta] sincronização falhou:', err?.message || err);
      scheduleRetry();
      return { error: kind, detail: err?.message };
    }
  }

  // ---------- push ----------
  async function push(client, userId, ctx) {
    const entries = (await store.readOutbox()).filter((e) => !e.rejected);
    if (!entries.length) return 0;
    let sent = 0;
    for (const table of STORES) {
      const list = entries.filter((e) => e.store === table);
      if (!list.length) continue;
      const recs = new Map((await store.readStore(table)).map((r) => [r.id, r]));
      const orphans = [];
      const items = [];
      for (const e of list) {
        if (e.deleted) {
          items.push({ e, row: { user_id: userId, id: e.id, data: { id: e.id }, deleted: true, client_updated_at: e.updatedAt } });
        } else {
          const r = recs.get(e.id);
          // Entrada sem registro (não deveria acontecer): não envia nada (nunca apagar no servidor por engano).
          if (!r) orphans.push(e);
          else items.push({ e, row: { user_id: userId, id: e.id, data: r, deleted: false, client_updated_at: r.updatedAt || e.updatedAt } });
        }
      }
      if (orphans.length) await store.ackOutbox(orphans);
      for (let i = 0; i < items.length; i += PUSH_CHUNK) {
        sent += await pushChunk(client, table, items.slice(i, i + PUSH_CHUNK), ctx);
      }
    }
    return sent;
  }

  async function pushChunk(client, table, chunk, ctx) {
    const res = await client.from(table).upsert(chunk.map((c) => c.row), { onConflict: 'user_id,id' }).select('id');
    if (res.error) {
      const kind = classifyError(res.error, res.status);
      if (kind === 'data') {
        // Um registro inválido não pode travar os outros: divide o lote até isolar o culpado.
        if (chunk.length > 1) {
          const mid = Math.ceil(chunk.length / 2);
          return (await pushChunk(client, table, chunk.slice(0, mid), ctx)) + (await pushChunk(client, table, chunk.slice(mid), ctx));
        }
        await store.markRejected([chunk[0].e], `${res.error.code || ''} ${res.error.message || ''}`.trim());
        return 0;
      }
      throw new SyncError(kind, res.error.message || 'falha no envio', res.error);
    }
    const accepted = new Set((res.data || []).map((r) => r.id));
    await store.ackOutbox(chunk.map((c) => c.e));
    // Linhas que o servidor ignorou: ele já tinha uma versão mais nova. Baixa e aplica agora.
    const ignored = chunk.map((c) => c.row.id).filter((id) => !accepted.has(id));
    if (ignored.length) await fetchAndApply(client, table, ignored, ctx);
    return accepted.size;
  }

  async function fetchAndApply(client, table, ids, ctx) {
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const res = await client.from(table).select(COLS).in('id', ids.slice(i, i + IN_CHUNK));
      if (res.error) throw new SyncError(classifyError(res.error, res.status), res.error.message, res.error);
      if (res.data?.length) ctx.applied += (await store.applyRemote(table, res.data)).applied;
    }
  }

  // ---------- pull ----------
  async function pull(client, ctx) {
    for (const table of STORES) {
      const cur = await store.getSyncState(`cursor:${table}`);
      let maxTs = cur?.ts || null;
      let since = maxTs ? new Date(tsMs(maxTs) - OVERLAP_MS).toISOString() : null;
      const seen = new Set();
      for (;;) {
        let q = client.from(table).select(COLS);
        if (since) q = q.gte('server_updated_at', since);
        const res = await q.order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE_SIZE);
        if (res.error) throw new SyncError(classifyError(res.error, res.status), res.error.message, res.error);
        const rows = res.data || [];
        const fresh = rows.filter((r) => {
          const k = `${r.id}|${r.server_updated_at}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (fresh.length) ctx.applied += (await store.applyRemote(table, fresh)).applied;
        if (!rows.length) break;
        const last = rows[rows.length - 1].server_updated_at;
        if (!maxTs || tsMs(last) >= tsMs(maxTs)) maxTs = last;
        if (rows.length < PAGE_SIZE || !fresh.length) break; // página incompleta = fim; página repetida = proteção contra laço
        since = last;
      }
      // O cursor só avança depois de tudo da tabela aplicado: se cair no meio, a próxima vez repete.
      if (maxTs && maxTs !== cur?.ts) await store.putSyncState({ id: `cursor:${table}`, ts: maxTs });
    }
  }

  // ---------- vínculo com a conta ----------
  async function remoteSummary(client) {
    const count = async (table, extra) => {
      let q = client.from(table).select('id', { count: 'exact', head: true }).eq('deleted', false);
      if (extra) q = q.eq('id', extra);
      const res = await q;
      if (res.error) throw new SyncError(classifyError(res.error, res.status), res.error.message, res.error);
      return res.count || 0;
    };
    return { transactions: await count('transactions'), goals: await count('goals'), hasSettings: (await count('meta', 'settings')) > 0 };
  }

  /**
   * Antes de ligar a conta neste aparelho: decide se precisa perguntar à pessoa.
   * mode: 'resume' (mesma conta de antes), 'merge' (nada relevante no aparelho), 'ask' (há dados locais).
   */
  async function prepareLink(user) {
    const prev = (await store.getSyncState('link')) || null;
    if (prev?.userId === user.id) return { mode: 'resume' };
    const local = store.localSummary();
    const meaningful = local.transactions || local.goals || local.recurrences || local.customCategories || local.lessons;
    let remote = null;
    try { remote = await remoteSummary(await getClient()); } catch { remote = null; }
    return { mode: meaningful ? 'ask' : 'merge', local, remote, previousEmail: prev?.email || null };
  }

  /**
   * Liga a conta neste aparelho e sincroniza.
   *  - 'merge': envia tudo que é local e depois baixa a conta (junta, sem apagar nada);
   *  - 'replace': apaga os dados SÓ deste aparelho e baixa os da conta;
   *  - 'resume': mesma conta de antes (sessão tinha expirado): só continua.
   */
  async function linkAccount(user, mode = 'merge') {
    if (running) await running.catch(() => {});
    const prev = (await store.getSyncState('link')) || null;
    if (mode === 'replace') await store.wipeLocal({ seed: true });
    else if (mode === 'merge') await store.markAllForSync();
    if (mode !== 'resume') for (const t of STORES) await store.deleteSyncState(`cursor:${t}`);
    link = {
      id: 'link', userId: user.id, email: user.email || null, linkedAt: new Date(now()).toISOString(),
      lastSyncAt: mode === 'resume' ? prev?.lastSyncAt || null : null,
    };
    await store.putSyncState(link);
    failures = 0;
    setStatus({ linked: true, userId: link.userId, email: link.email, lastSyncAt: link.lastSyncAt, phase: 'idle', message: '' });
    return syncNow({ reason: 'link' });
  }

  /** Desliga a conta deste aparelho. `wipe`: apaga também os dados locais. */
  async function unlink({ wipe = false } = {}) {
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    const inflight = running;
    link = null;
    if (inflight) await inflight.catch(() => {});
    await store.deleteSyncState('link');
    for (const t of STORES) await store.deleteSyncState(`cursor:${t}`);
    if (wipe) await store.wipeLocal({ seed: true });
    else await store.clearOutbox();
    failures = 0;
    setStatus({ linked: false, userId: null, email: null, lastSyncAt: null, phase: 'idle', message: '' });
    await refreshCounts();
  }

  /** A sessão caiu (ex.: senha trocada em outro aparelho). Mantém o vínculo e a fila; pede novo login. */
  function markAuthExpired() {
    if (link) setStatus({ phase: 'auth', message: MESSAGES.auth });
  }

  return {
    init, start, stop, syncNow, prepareLink, linkAccount, unlink, markAuthExpired, remoteSummary, refreshCounts,
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    getStatus: snapshot,
    isLinked: () => Boolean(link),
    linkedUserId: () => link?.userId || null,
  };
}
