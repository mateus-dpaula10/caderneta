// Camada de armazenamento local. Ordem de preferência:
// 1) IndexedDB  2) localStorage  3) memória (aviso: nada é salvo ao fechar).
// As stores de dados usam a chave "id". Sem conta, os dados ficam só no aparelho; com a sincronização
// (opcional) ligada, uma cópia vai para a conta da pessoa no Supabase (ver js/sync.js).

/** Stores com os dados do app (espelhadas nas tabelas do Supabase quando há conta). */
export const STORES = ['meta', 'categories', 'transactions', 'recurrences', 'goals'];
/**
 * Stores só deste aparelho (nunca sincronizadas):
 *  - outbox: fila de alterações locais ainda não enviadas (uma entrada por registro, chave "<store>:<id>").
 *  - syncstate: vínculo com a conta, cursores de sincronização, id do aparelho.
 */
export const LOCAL_STORES = ['outbox', 'syncstate'];
export const ALL_STORES = [...STORES, ...LOCAL_STORES];
const KEY_PATH = { outbox: 'key' };
const keyOf = (store, value) => value[KEY_PATH[store] || 'id'];

const DB_NAME = 'caderneta';
const DB_VERSION = 2; // v2: + outbox, + syncstate (dados da v1 continuam intactos)
const LS_PREFIX = 'caderneta:store:';
const BLOCKED_TIMEOUT_MS = 8000;

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
  });
}

/** Erro de "banco bloqueado por outra aba": não deve cair para outro armazenamento (pareceria que os dados sumiram). */
export class StorageBlockedError extends Error {
  constructor() {
    super('Outra aba da Caderneta está usando uma versão antiga dos dados. Feche as outras abas e recarregue.');
    this.code = 'blocked';
  }
}

class IDBAdapter {
  constructor() { this.mode = 'indexeddb'; this.db = null; }

  async open() {
    if (!('indexedDB' in globalThis)) throw new Error('IndexedDB indisponível');
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      let blockedTimer = null;
      let gaveUp = false;
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            if (name === 'transactions') store.createIndex('date', 'date');
          }
        }
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('syncstate')) db.createObjectStore('syncstate', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        clearTimeout(blockedTimer);
        if (gaveUp) { req.result.close(); return; }
        resolve(req.result);
      };
      req.onerror = () => { clearTimeout(blockedTimer); reject(req.error); };
      // Outra aba ainda com a versão antiga aberta: normalmente ela fecha sozinha (onversionchange).
      // Espera um pouco antes de desistir, e desiste com um erro que NÃO troca de armazenamento.
      req.onblocked = () => {
        clearTimeout(blockedTimer);
        blockedTimer = setTimeout(() => { gaveUp = true; reject(new StorageBlockedError()); }, BLOCKED_TIMEOUT_MS);
      };
    });
    // Se outra aba abrir uma versão nova do banco, fecha esta conexão com elegância.
    this.db.onversionchange = () => this.db.close();
    // Teste real de escrita/leitura (alguns modos privados abrem mas falham ao gravar).
    await this.put('meta', { id: '__probe', at: Date.now() });
    await this.delete('meta', '__probe');
    return this;
  }

  async getAll(store) {
    const tx = this.db.transaction(store, 'readonly');
    return promisify(tx.objectStore(store).getAll());
  }

  async get(store, key) {
    const tx = this.db.transaction(store, 'readonly');
    return promisify(tx.objectStore(store).get(key));
  }

  async put(store, value) {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await txDone(tx);
  }

  async putMany(store, values) {
    if (!values.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of values) os.put(v);
    await txDone(tx);
  }

  async delete(store, id) {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    await txDone(tx);
  }

  async deleteMany(store, ids) {
    if (!ids.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const id of ids) os.delete(id);
    await txDone(tx);
  }

  /**
   * Várias gravações numa única transação (ou grava tudo, ou nada).
   * ops: [{ store, put: valor } | { store, del: chave } | { store, clear: true }]
   */
  async write(ops) {
    if (!ops.length) return;
    const names = [...new Set(ops.map((o) => o.store))];
    const tx = this.db.transaction(names, 'readwrite');
    for (const op of ops) {
      const os = tx.objectStore(op.store);
      if (op.clear) os.clear();
      else if ('put' in op) os.put(op.put);
      else os.delete(op.del);
    }
    await txDone(tx);
  }

  /** Tira da fila só as entradas que não mudaram desde que foram lidas (mesmo "rev"). Atômico. */
  async ackOutbox(entries) {
    if (!entries.length) return 0;
    const tx = this.db.transaction('outbox', 'readwrite');
    const os = tx.objectStore('outbox');
    let removed = 0;
    for (const e of entries) {
      const req = os.get(e.key);
      req.onsuccess = () => {
        if (req.result && req.result.rev === e.rev) { os.delete(e.key); removed++; }
      };
    }
    await txDone(tx);
    return removed;
  }

  /** Substitui TODO o conteúdo dos dados numa única transação. `extraOps` entra na mesma transação. */
  async replaceAll(data, extraOps = []) {
    const names = [...new Set([...STORES, ...extraOps.map((o) => o.store)])];
    const tx = this.db.transaction(names, 'readwrite');
    for (const name of STORES) {
      const os = tx.objectStore(name);
      os.clear();
      for (const v of data[name] || []) os.put(v);
    }
    for (const op of extraOps) {
      const os = tx.objectStore(op.store);
      if (op.clear) os.clear(); else if ('put' in op) os.put(op.put); else os.delete(op.del);
    }
    await txDone(tx);
  }
}

class LocalStorageAdapter {
  constructor() { this.mode = 'localstorage'; }

  async open() {
    const k = `${LS_PREFIX}__probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return this;
  }

  read(store) {
    try { return JSON.parse(localStorage.getItem(LS_PREFIX + store) || '{}'); } catch { return {}; }
  }

  write1(store, map) { localStorage.setItem(LS_PREFIX + store, JSON.stringify(map)); }

  /** Executa `fn` e, se faltar espaço no meio, devolve as stores tocadas ao estado anterior. */
  atomic(names, fn) {
    const backup = {};
    for (const name of names) backup[name] = localStorage.getItem(LS_PREFIX + name);
    try {
      return fn();
    } catch (err) {
      for (const name of names) {
        if (backup[name] == null) localStorage.removeItem(LS_PREFIX + name);
        else localStorage.setItem(LS_PREFIX + name, backup[name]);
      }
      throw err;
    }
  }

  applyOps(ops) {
    const maps = {};
    const m = (s) => (maps[s] ||= this.read(s));
    for (const op of ops) {
      if (op.clear) maps[op.store] = {};
      else if ('put' in op) m(op.store)[keyOf(op.store, op.put)] = op.put;
      else delete m(op.store)[op.del];
    }
    for (const [s, map] of Object.entries(maps)) this.write1(s, map);
  }

  async getAll(store) { return Object.values(this.read(store)); }
  async get(store, key) { return this.read(store)[key]; }
  async put(store, value) { this.applyOps([{ store, put: value }]); }
  async putMany(store, values) { this.atomic([store], () => this.applyOps(values.map((v) => ({ store, put: v })))); }
  async delete(store, id) { this.applyOps([{ store, del: id }]); }
  async deleteMany(store, ids) { this.applyOps(ids.map((id) => ({ store, del: id }))); }
  async write(ops) { this.atomic([...new Set(ops.map((o) => o.store))], () => this.applyOps(ops)); }

  async ackOutbox(entries) {
    const map = this.read('outbox');
    let removed = 0;
    for (const e of entries) if (map[e.key] && map[e.key].rev === e.rev) { delete map[e.key]; removed++; }
    if (removed) this.write1('outbox', map);
    return removed;
  }

  async replaceAll(data, extraOps = []) {
    const names = [...new Set([...STORES, ...extraOps.map((o) => o.store)])];
    this.atomic(names, () => {
      for (const name of STORES) {
        const m = {};
        for (const v of data[name] || []) m[v.id] = v;
        this.write1(name, m);
      }
      this.applyOps(extraOps);
    });
  }
}

class MemoryAdapter {
  constructor() { this.mode = 'memory'; this.data = Object.fromEntries(ALL_STORES.map((s) => [s, new Map()])); }
  async open() { return this; }
  async getAll(store) { return [...this.data[store].values()].map((v) => structuredClone(v)); }
  async get(store, key) { const v = this.data[store].get(key); return v === undefined ? undefined : structuredClone(v); }
  async put(store, value) { this.data[store].set(keyOf(store, value), structuredClone(value)); }
  async putMany(store, values) { for (const v of values) await this.put(store, v); }
  async delete(store, id) { this.data[store].delete(id); }
  async deleteMany(store, ids) { for (const id of ids) this.data[store].delete(id); }
  async write(ops) {
    for (const op of ops) {
      if (op.clear) this.data[op.store] = new Map();
      else if ('put' in op) this.data[op.store].set(keyOf(op.store, op.put), structuredClone(op.put));
      else this.data[op.store].delete(op.del);
    }
  }
  async ackOutbox(entries) {
    let removed = 0;
    for (const e of entries) {
      const cur = this.data.outbox.get(e.key);
      if (cur && cur.rev === e.rev) { this.data.outbox.delete(e.key); removed++; }
    }
    return removed;
  }
  async replaceAll(data, extraOps = []) {
    for (const name of STORES) {
      this.data[name] = new Map((data[name] || []).map((v) => [v.id, structuredClone(v)]));
    }
    await this.write(extraOps);
  }
}

/**
 * Abre o melhor armazenamento disponível. Só lança no caso "bloqueado por outra aba"
 * (cair para outro armazenamento faria os dados parecerem sumidos); fora isso, no pior caso usa memória.
 */
export async function openStorage() {
  for (const Adapter of [IDBAdapter, LocalStorageAdapter]) {
    try {
      return await new Adapter().open();
    } catch (err) {
      if (err?.code === 'blocked') throw err;
      console.warn(`[caderneta] armazenamento ${Adapter.name} indisponível:`, err?.message || err);
    }
  }
  return new MemoryAdapter().open();
}

/** Pede ao navegador para não apagar os dados sob pressão de espaço (quando suportado). */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
