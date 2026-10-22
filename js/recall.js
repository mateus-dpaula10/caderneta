// Perguntas que voltam (repetição espaçada): as perguntas dos quizzes de lições concluídas reaparecem
// 1, 3, 7, 21 e 60 dias depois. Errou, volta para o começo (amanhã). Funções puras.
// progress.recall = { '<lição>:<nº da pergunta>': { box, due: 'AAAA-MM-DD', at: ISO } }.
// Pergunta sem registro de lição concluída vence no dia seguinte à conclusão (não precisa migrar nada).
import { addDays, todayISO } from './utils.js';

export const RECALL_DAYS = [1, 3, 7, 21, 60];
const MAX_BOX = RECALL_DAYS.length - 1;

export const recallKey = (lessonId, qi) => `${lessonId}:${qi}`;

/**
 * Perguntas vencidas (hoje ou antes), as mais atrasadas primeiro: [{ key, lesson, qi, q, box, due }].
 * `lessons` define a ordem de desempate (use a ordem da trilha do objetivo).
 */
export function dueQuestions(progress, lessons, today = todayISO(), limit = 1) {
  const recall = progress?.recall || {};
  const out = [];
  lessons.forEach((lesson, order) => {
    const done = progress?.lessons?.[lesson.id];
    if (!done?.done) return;
    const start = addDays(String(done.doneAt || done.lastAt || '').slice(0, 10) || today, RECALL_DAYS[0]);
    lesson.quiz.forEach((q, qi) => {
      const key = recallKey(lesson.id, qi);
      const entry = recall[key];
      const due = entry?.due || start;
      if (due <= today) out.push({ key, lesson, qi, q, box: entry?.box ?? 0, due, order });
    });
  });
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.order - b.order || a.qi - b.qi).slice(0, limit);
}

/** Novo registro depois de responder: acertou sobe uma caixa (intervalo maior); errou volta para a primeira. */
export function nextRecall(entry, correct, today = todayISO(), now = new Date().toISOString()) {
  // Sem registro = caixa 0 (a 1ª volta, um dia depois da lição): o 1º acerto já vai para 3 dias.
  const box = correct ? Math.min((entry?.box ?? 0) + 1, MAX_BOX) : 0;
  return { box, due: addDays(today, correct ? RECALL_DAYS[box] : RECALL_DAYS[0]), at: now };
}
