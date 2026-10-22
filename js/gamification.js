// Gamificação leve: sequência de dias registrando e conquistas. Funções puras sobre o estado.
import { addDays, addMonths, currentMonth, todayISO } from './utils.js';
import { monthSummary, reserveMonths } from './finance.js';
import { LESSONS } from './lessons.js';
import { debtRemaining, isDebt, reviewStreak } from './objective.js';

/** Sequência atual: dias seguidos com registro, terminando hoje ou ontem. */
export function computeStreak(activity, today = todayISO()) {
  const days = new Set(activity || []);
  let start = today;
  if (!days.has(today)) {
    start = addDays(today, -1);
    if (!days.has(start)) return 0;
  }
  let n = 0;
  let d = start;
  while (days.has(d) && n < 3660) { n++; d = addDays(d, -1); }
  return n;
}

export const ACHIEVEMENTS = [
  {
    id: 'primeiro-lancamento', title: 'Primeiro passo', icon: '✍️',
    text: 'Registrou o primeiro lançamento.',
    check: (s) => s.transactions.length > 0,
  },
  {
    id: 'sequencia-7', title: 'Uma semana no controle', icon: '🔥',
    text: 'Registrou algo 7 dias seguidos.',
    check: (s) => Math.max(computeStreak(s.progress.activity), s.progress.bestStreak || 0) >= 7,
  },
  {
    id: 'sequencia-30', title: 'Hábito formado', icon: '🗓️',
    text: 'Registrou algo 30 dias seguidos.',
    check: (s) => Math.max(computeStreak(s.progress.activity), s.progress.bestStreak || 0) >= 30,
  },
  {
    id: 'primeira-licao', title: 'Curiosidade', icon: '📘',
    text: 'Concluiu a primeira lição.',
    check: (s) => Object.values(s.progress.lessons).some((l) => l.done),
  },
  {
    id: 'quiz-perfeito', title: 'Nota máxima', icon: '🎯',
    text: 'Acertou todas as perguntas de um quiz.',
    check: (s) => Object.values(s.progress.lessons).some((l) => l.done && l.best === l.total),
  },
  {
    id: 'trilha-completa', title: 'Trilha completa', icon: '🎓',
    text: 'Concluiu todas as lições.',
    check: (s) => LESSONS.every((l) => s.progress.lessons[l.id]?.done),
  },
  {
    id: 'planejador', title: 'Planejador', icon: '🧭',
    text: 'Definiu limite de gasto em 3 categorias.',
    check: (s) => s.categories.filter((c) => c.type === 'expense' && c.budget > 0).length >= 3,
  },
  {
    id: 'primeira-meta', title: 'Mira no futuro', icon: '🎯',
    text: 'Criou a primeira meta de economia.',
    check: (s) => s.goals.some((g) => !isDebt(g)),
  },
  {
    id: 'divida-quitada', title: 'Uma a menos', icon: '🧯',
    text: 'Quitou uma dívida cadastrada.',
    check: (s) => s.goals.some((g) => isDebt(g) && g.target > 0 && debtRemaining(g) === 0),
  },
  {
    id: 'primeira-revisao', title: 'Olhando de perto', icon: '🔎',
    text: 'Fez a primeira revisão da semana.',
    check: (s) => (s.progress.reviews || []).length > 0,
  },
  {
    id: 'revisao-4', title: 'Um mês de revisões', icon: '📆',
    text: 'Fez a revisão da semana 4 semanas seguidas.',
    check: (s) => reviewStreak(s.progress.reviews) >= 4,
  },
  {
    id: 'reserva-1-mes', title: 'Colchão', icon: '🛟',
    text: 'A reserva de emergência já cobre 1 mês de gastos.',
    check: (s) => reserveMonths(s, currentMonth()).months >= 1,
  },
  {
    id: 'mes-no-azul', title: 'Mês no azul', icon: '💙',
    text: 'Fechou um mês gastando menos do que ganhou.',
    check: (s) => {
      const last = monthSummary(s, addMonths(currentMonth(), -1));
      return last.income > 0 && last.balance > 0;
    },
  },
  {
    id: 'precavido', title: 'Precavido', icon: '💾',
    text: 'Exportou um backup dos dados.',
    check: (s) => Boolean(s.progress.flags?.exportedAt),
  },
];

/** Retorna as conquistas recém-desbloqueadas (ainda não registradas no progresso). */
export function newlyUnlocked(state) {
  const have = state.progress.achievements || {};
  return ACHIEVEMENTS.filter((a) => !have[a.id] && safeCheck(a, state));
}

function safeCheck(a, state) {
  try { return Boolean(a.check(state)); } catch { return false; }
}
