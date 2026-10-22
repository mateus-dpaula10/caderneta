// Regras puras de carimbo de tempo e de junção (merge) usadas pela sincronização.
// Sem acesso a armazenamento nem a rede: dá para testar no Node.
import { computeStreak } from './gamification.js';

/**
 * Carimbo dos registros gerados automaticamente (ocorrências de recorrência ainda não editadas)
 * e dos registros antigos sem `updatedAt`. Por ser o menor horário possível, qualquer edição de
 * verdade (em qualquer aparelho) vence; duas gerações iguais empatam e o conteúdo é o mesmo.
 */
export const GENERATED_TS = '1970-01-01T00:00:00.000Z';

/** Horário (ms) de um carimbo ISO; 0 se ausente/inválido. Aceita o formato do Postgres (+00:00, microssegundos). */
export function tsMs(value) {
  if (!value) return 0;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza um carimbo para ISO em ms (o Postgres devolve "2026-10-15T12:00:00.123+00:00"). */
export const normTs = (value) => new Date(tsMs(value)).toISOString();

/**
 * Próximo carimbo de um registro: agora, mas sempre pelo menos 1 ms depois da versão anterior.
 * Assim, editar um registro recebido de outro aparelho (mesmo com o relógio deste atrasado)
 * gera uma versão que vence a que foi vista.
 */
export function nextStamp(prev, now = Date.now()) {
  return new Date(Math.max(now, tsMs(prev) + 1)).toISOString();
}

/** JSON com chaves ordenadas, para comparar registros sem depender da ordem das chaves. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Mesmo conteúdo (ignorando o carimbo `updatedAt`)? */
export function sameContent(a, b) {
  if (!a || !b) return false;
  const strip = ({ updatedAt, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return stableStringify(strip(a)) === stableStringify(strip(b));
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Tentativas por aparelho (contador que só cresce): somar aparelhos, nunca somar a mesma contagem duas vezes. */
function attemptsByOf(lesson, fallbackKey) {
  if (isObj(lesson.attemptsBy)) return { ...lesson.attemptsBy };
  return { [fallbackKey]: Number(lesson.attempts) || 0 };
}

function mergeLesson(a, b, keyA, keyB) {
  if (!isObj(a)) return isObj(b) ? { ...b, attemptsBy: attemptsByOf(b, keyB) } : b;
  if (!isObj(b)) return { ...a, attemptsBy: attemptsByOf(a, keyA) };
  const byA = attemptsByOf(a, keyA);
  const byB = attemptsByOf(b, keyB);
  const attemptsBy = {};
  for (const k of new Set([...Object.keys(byA), ...Object.keys(byB)])) {
    attemptsBy[k] = Math.max(Number(byA[k]) || 0, Number(byB[k]) || 0);
  }
  // Último resultado = o da tentativa mais recente; empate (mesmo ms) decide pela maior nota, para os
  // dois aparelhos chegarem ao mesmo resultado.
  const ta = tsMs(a.lastAt);
  const tb = tsMs(b.lastAt);
  const newer = tb > ta || (tb === ta && (Number(b.last) || 0) > (Number(a.last) || 0)) ? b : a;
  const doneAts = [a.doneAt, b.doneAt].filter(Boolean).sort((x, y) => tsMs(x) - tsMs(y));
  return {
    ...a,
    ...b,
    done: Boolean(a.done || b.done),
    best: Math.max(Number(a.best) || 0, Number(b.best) || 0),
    total: Math.max(Number(a.total) || 0, Number(b.total) || 0) || newer.total,
    last: newer.last,
    lastAt: newer.lastAt,
    doneAt: doneAts[0],
    attemptsBy,
    attempts: Object.values(attemptsBy).reduce((s, n) => s + n, 0),
  };
}

/** União de mapas {chave: carimbo}. `pick` decide qual carimbo fica quando a chave existe nos dois. */
function mergeStampMap(a, b, pick) {
  const out = { ...(isObj(b) ? b : {}) };
  for (const [k, v] of Object.entries(isObj(a) ? a : {})) {
    out[k] = k in out ? pick(v, out[k]) : v;
  }
  return out;
}
const earliest = (x, y) => (tsMs(x) && tsMs(y) ? (tsMs(x) <= tsMs(y) ? x : y) : x ?? y);
const latest = (x, y) => (tsMs(x) && tsMs(y) ? (tsMs(x) >= tsMs(y) ? x : y) : x ?? y);

/**
 * Perguntas que voltam ({chave: {box, due, at}}): fica a resposta mais recente de cada pergunta. Empate no
 * horário decide pela caixa maior e depois pela data, para os dois aparelhos chegarem ao mesmo resultado.
 */
function mergeRecall(a, b) {
  const out = { ...(isObj(b) ? b : {}) };
  for (const [k, v] of Object.entries(isObj(a) ? a : {})) {
    const w = out[k];
    if (!isObj(w)) { out[k] = v; continue; }
    if (!isObj(v)) continue;
    const ta = tsMs(v.at);
    const tb = tsMs(w.at);
    const aWins = ta > tb || (ta === tb && ((Number(v.box) || 0) > (Number(w.box) || 0)
      || ((Number(v.box) || 0) === (Number(w.box) || 0) && String(v.due) > String(w.due))));
    if (aWins) out[k] = v;
  }
  return out;
}

const unionDays = (a, b, max) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])]
  .filter((d) => typeof d === 'string').sort().slice(-max);

/**
 * Junta o progresso (lições, conquistas, sequência) de dois aparelhos sem perder nada:
 *  - activity: união dos dias;  bestStreak: o maior (e no mínimo a sequência da união);
 *  - lições: concluída se concluída em qualquer um, melhor nota, tentativas somadas por aparelho;
 *  - conquistas: união (fica a data da primeira vez);  flags/dicas dispensadas: união (fica a mais recente);
 *  - reviews (dias de revisão da semana): união;  recall (perguntas que voltam): a resposta mais recente de cada uma.
 * `deviceId` identifica as tentativas antigas (sem `attemptsBy`) deste aparelho.
 */
export function mergeProgress(local, remote, deviceId = 'local') {
  const L = isObj(local) ? local : {};
  const R = isObj(remote) ? remote : {};
  const lessons = {};
  const LL = isObj(L.lessons) ? L.lessons : {};
  const RL = isObj(R.lessons) ? R.lessons : {};
  for (const id of new Set([...Object.keys(LL), ...Object.keys(RL)])) {
    lessons[id] = mergeLesson(LL[id], RL[id], deviceId, 'legacy');
  }
  const activity = unionDays(L.activity, R.activity, 400);
  return {
    ...R,
    ...L,
    id: 'progress',
    lessons,
    achievements: mergeStampMap(L.achievements, R.achievements, earliest),
    flags: mergeStampMap(L.flags, R.flags, latest),
    dismissedTips: mergeStampMap(L.dismissedTips, R.dismissedTips, latest),
    activity,
    reviews: unionDays(L.reviews, R.reviews, 260),
    recall: mergeRecall(L.recall, R.recall),
    bestStreak: Math.max(Number(L.bestStreak) || 0, Number(R.bestStreak) || 0, computeStreak(activity)),
  };
}

/** União dos meses pulados de uma série (o app só acrescenta meses; nunca "despula"). */
export function unionSkipped(a, b) {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].sort();
}
