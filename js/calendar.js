// Lembretes como arquivo de calendário (.ics): funciona em qualquer celular, sem servidor e sem conta.
// Horários "flutuantes" (sem fuso): o calendário do aparelho usa o fuso local. Função pura.
import { addDays, parseISODate, todayISO } from './utils.js';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Texto seguro para o .ics (RFC 5545): barra, vírgula, ponto e vírgula e quebras de linha. */
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Linhas com mais de 75 bytes (UTF-8; acento conta 2) continuam na seguinte, começando com espaço. */
const enc = new TextEncoder();
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 74) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

const local = (iso, time) => `${iso.replace(/-/g, '')}T${time.replace(':', '')}00`;

/** Próxima data (hoje ou depois) que cai no dia da semana (0 = domingo). */
function nextWeekday(today, weekday) {
  const diff = (weekday - parseISODate(today).getDay() + 7) % 7;
  return addDays(today, diff);
}

/** Próxima data (hoje ou depois) com o dia do mês informado. */
function nextMonthDay(today, day) {
  const [y, m, d] = today.split('-').map(Number);
  const date = day >= d ? new Date(y, m - 1, day) : new Date(y, m, day);
  return todayISO(date);
}

function event({ uid, start, minutes = 15, title, description, rrule, alarm = 'PT0M', stamp }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DURATION:PT${minutes}M`,
    `SUMMARY:${icsText(title)}`,
    description ? `DESCRIPTION:${icsText(description)}` : null,
    rrule ? `RRULE:${rrule}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, `TRIGGER:${alarm}`, 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
}

/**
 * Monta o .ics. Opções (cada uma pode faltar):
 *  review: { weekday 0–6, time 'HH:MM', link }       revisão semanal, toda semana
 *  salary: { day 1–28, text }                          dia do salário, todo mês às 9h
 *  bills:  [{ id, title, day 1–28, text }]             contas fixas, todo mês às 9h, aviso um dia antes
 *  once:   [{ id, title, date 'AAAA-MM-DD', text }]    contas avulsas a pagar, às 9h, aviso um dia antes
 * Os UIDs são estáveis: baixar de novo atualiza (em calendários que reconhecem o UID) em vez de duplicar.
 */
export function buildICS({ review, salary, bills = [], once = [] }, today = todayISO(), now = new Date()) {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Caderneta//Lembretes//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Caderneta'];
  if (review) {
    lines.push(...event({
      uid: 'revisao-semanal@caderneta', stamp, start: local(nextWeekday(today, review.weekday), review.time),
      title: 'Caderneta: revisão da semana (2 min)',
      description: `Lance o que faltou, confira as contas a pagar e veja o seu objetivo.${review.link ? `\n${review.link}` : ''}`,
      rrule: `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODE[review.weekday]}`,
    }));
  }
  if (salary) {
    lines.push(...event({
      uid: 'dia-do-salario@caderneta', stamp, start: local(nextMonthDay(today, salary.day), '09:00'),
      title: 'Caderneta: dia do salário, pague-se primeiro', description: salary.text, rrule: `FREQ=MONTHLY;BYMONTHDAY=${salary.day}`,
    }));
  }
  for (const b of bills) {
    lines.push(...event({
      uid: `conta-${b.id}@caderneta`, stamp, start: local(nextMonthDay(today, b.day), '09:00'),
      title: `Vence hoje: ${b.title}`, description: b.text, rrule: `FREQ=MONTHLY;BYMONTHDAY=${b.day}`, alarm: '-P1D',
    }));
  }
  for (const o of once) {
    lines.push(...event({ uid: `conta-${o.id}@caderneta`, stamp, start: local(o.date, '09:00'), title: `Vence hoje: ${o.title}`, description: o.text, alarm: '-P1D' }));
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
