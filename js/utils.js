// Utilitários puros: dinheiro (sempre em centavos inteiros), datas locais e HTML seguro.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const PCT1 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_LONG = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

/** Formata centavos como "R$ 1.234,56". */
export const fmtBRL = (cents) => BRL.format((Number(cents) || 0) / 100);
/** Formato compacto para eixos de gráfico ("R$ 1,2 mil"). */
export const fmtBRLCompact = (cents) => BRL_COMPACT.format((Number(cents) || 0) / 100);
export const fmtPct = (ratio) => PCT.format(Number.isFinite(ratio) ? ratio : 0);
export const fmtPct1 = (ratio) => PCT1.format(Number.isFinite(ratio) ? ratio : 0);

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,5", "1234.56", "R$ 10".
 * Retorna NaN se não for um número válido.
 */
export function parseMoney(input) {
  if (typeof input === 'number') return Math.round(input * 100);
  let s = String(input ?? '').replace(/[R$\s ]/g, '').trim();
  if (!s) return NaN;
  const negative = s.startsWith('-');
  s = s.replace(/^-/, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

/** Centavos para o formato de campo de texto ("1234,56"). */
export function centsToInput(cents) {
  if (!Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Lê número decimal digitado em pt-BR ("0,9" ou "0.9"). */
export function parseDecimal(input) {
  const s = String(input ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : NaN;
}

const pad = (n) => String(n).padStart(2, '0');

/** Data local de hoje no formato YYYY-MM-DD (sem armadilha de fuso UTC). */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const monthOf = (iso) => String(iso).slice(0, 7);
export const currentMonth = () => monthOf(todayISO());

export function parseISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Compara meses "YYYY-MM" (string compara bem por ser zero-padded). */
export const monthCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function monthsBetween(from, to) {
  const out = [];
  let m = from;
  let guard = 0;
  while (monthCmp(m, to) <= 0 && guard++ < 600) { out.push(m); m = addMonths(m, 1); }
  return out;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthLabel = (ym) => cap(MONTH.format(parseISODate(`${ym}-01`)));
export const monthShort = (ym) => cap(MONTH_SHORT.format(parseISODate(`${ym}-01`)).replace('.', ''));
export const fmtDate = (iso) => DATE.format(parseISODate(iso));
export const fmtDateLong = (iso) => cap(DATE_LONG.format(parseISODate(iso)));

/** Escapa texto para interpolar em HTML. Use SEMPRE em dado digitado pelo usuário. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const sum = (arr, fn = (x) => x) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Pluralização simples pt-BR. */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
