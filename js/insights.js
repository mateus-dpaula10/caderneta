// Dicas contextuais: cruzam os dados da pessoa com a trilha de lições.
// Cada dica: { key, tone: 'alert'|'warn'|'good'|'info', title, text, lesson?, href?, cta? }
import { addMonths, currentMonth, fmtBRL, fmtPct, todayISO, addDays } from './utils.js';
import {
  GOAL_TYPES, budgetStatus, emergencyGoal, lastMonths, monthSummary, referenceIncome, reserveMonths, monthlyNeeded,
} from './finance.js';
import { computeStreak } from './gamification.js';
import { LESSONS } from './lessons.js';

const lessonDone = (state, id) => Boolean(state.progress.lessons[id]?.done);

export function buildInsights(state, ym = currentMonth()) {
  const tips = [];
  const s = monthSummary(state, ym);
  const prev = monthSummary(state, addMonths(ym, -1));
  const income = referenceIncome(state, ym);
  const isCurrent = ym === currentMonth();
  const catName = (id) => state.categories.find((c) => c.id === id)?.name || 'Outros';

  // 1) Gastando mais do que ganha
  if (s.income > 0 && s.expense > s.income) {
    tips.push({
      key: `deficit:${ym}`, tone: 'alert',
      title: `Você gastou ${fmtBRL(s.expense - s.income)} a mais do que recebeu`,
      text: 'Quando isso se repete, a diferença costuma virar cartão ou cheque especial. Veja onde dá para ajustar.',
      lesson: 'orcamento',
    });
  }

  // 2) Orçamentos estourados ou perto do limite
  const budgetAlerts = budgetStatus(state, ym).filter((x) => x.level !== 'ok').slice(0, 2);
  for (const b of budgetAlerts) {
    tips.push({
      key: `budget:${b.category.id}:${ym}:${b.level}`, tone: b.level === 'over' ? 'alert' : 'warn',
      title: b.level === 'over'
        ? `${b.category.name}: limite passou em ${fmtBRL(b.spent - b.limit)}`
        : `${b.category.name}: ${fmtPct(b.ratio)} do limite já usado`,
      text: b.level === 'over'
        ? 'Veja se dá para compensar com menos gastos em desejos neste mês, ou ajuste o limite se ele estava irreal.'
        : 'Ainda dá tempo de segurar até o fim do mês.',
      href: '#/planejar', cta: 'Ver orçamento',
    });
  }

  // 3) Categoria que subiu muito em relação ao mês anterior
  let biggestJump = null;
  for (const [catId, value] of s.byCategory) {
    const before = prev.byCategory.get(catId) || 0;
    if (before < 5000 || value - before < 5000) continue; // ignora valores pequenos (< R$ 50)
    if (budgetAlerts.some((x) => x.category.id === catId)) continue; // já avisado pelo orçamento
    const rise = (value - before) / before;
    if (rise >= 0.3 && (!biggestJump || rise > biggestJump.rise)) biggestJump = { catId, rise, value, before };
  }
  if (biggestJump) {
    const isWant = state.categories.find((c) => c.id === biggestJump.catId)?.group === 'desejos';
    tips.push({
      key: `jump:${biggestJump.catId}:${ym}`, tone: 'warn',
      title: `Gastos com ${catName(biggestJump.catId).toLowerCase()} subiram ${fmtPct(biggestJump.rise)} vs. mês passado`,
      text: `Foram ${fmtBRL(biggestJump.value)} contra ${fmtBRL(biggestJump.before)}.${isWant ? ' Que tal testar a regra das 24 horas antes da próxima compra?' : ''}`,
      lesson: isWant ? 'consumo' : 'orcamento',
    });
  }

  // 4) Dívidas pesando na renda
  const debt = s.byCategory.get('dividas') || 0;
  if (income > 0 && debt / income >= 0.3) {
    tips.push({
      key: `debt-heavy:${ym}`, tone: 'alert',
      title: `Dívidas levam ${fmtPct(debt / income)} da sua renda`,
      text: 'Acima de 30% a situação fica apertada. Entenda como priorizar e trocar dívida cara por barata.',
      lesson: 'dividas',
    });
  } else if ((debt > 0 || state.settings.hasDebt) && !lessonDone(state, 'dividas')) {
    tips.push({
      key: 'debt-lesson', tone: 'info',
      title: 'Tem dívidas? Comece pelas mais caras',
      text: 'Rotativo do cartão e cheque especial costumam ter os juros mais altos. A lição mostra como sair deles.',
      lesson: 'dividas',
    });
  }

  // 5) Reserva de emergência
  const goal = emergencyGoal(state);
  const reserve = reserveMonths(state, ym);
  if (!goal) {
    tips.push({
      key: 'no-reserve', tone: 'info',
      title: 'Você ainda não tem uma meta de reserva de emergência',
      text: 'Ela é o que evita que um imprevisto vire dívida. Crie a meta e veja quanto guardar.',
      lesson: 'reserva', href: '#/planejar?nova-meta=reserva', cta: 'Criar meta',
    });
  } else if (reserve.avg > 0 && reserve.months < 3) {
    tips.push({
      key: `reserve-low:${ym}`, tone: 'info',
      title: `Sua reserva cobre ${reserve.months.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${reserve.months >= 1 && reserve.months < 2 ? 'mês' : 'meses'} de gastos`,
      text: `A referência é de 3 a 6 meses (${fmtBRL(reserve.avg * 3)} a ${fmtBRL(reserve.avg * 6)} no seu caso).`,
      lesson: 'reserva',
    });
  } else if (reserve.months >= 3 && !lessonDone(state, 'investimentos')) {
    tips.push({
      key: 'reserve-ok', tone: 'good',
      title: 'Reserva de 3 meses ou mais: muito bem',
      text: 'Com a base segura, faz sentido entender as opções de renda fixa para os próximos objetivos.',
      lesson: 'investimentos',
    });
  }

  // 6) Metas com prazo
  for (const g of state.goals.filter((x) => x.deadline && x.saved < x.target)) {
    const need = monthlyNeeded(g, ym);
    if (!need) continue;
    tips.push({
      key: `goal:${g.id}:${ym}`, tone: 'info',
      title: `${g.name}: guarde ${fmtBRL(need.perMonth)} por mês`,
      text: `É o necessário para chegar a ${fmtBRL(g.target)} até o prazo (${need.months} ${need.months === 1 ? 'mês' : 'meses'}).`,
      href: '#/planejar', cta: 'Ver metas',
    });
    break;
  }

  // 7) Distribuição 50/30/20
  if (income > 0 && s.expense > 0) {
    const wants = s.byGroup.desejos / income;
    const future = s.byGroup.futuro / income;
    if (wants > 0.35) {
      tips.push({
        key: `wants:${ym}`, tone: 'warn',
        title: `Desejos estão em ${fmtPct(wants)} da renda`,
        text: 'A referência do 50/30/20 é 30%. Restaurantes, compras e assinaturas são os primeiros lugares para olhar.',
        lesson: 'consumo',
      });
    } else if (future >= 0.2 && debt / income < 0.3) {
      tips.push({
        key: `future:${ym}`, tone: 'good',
        title: `Você destinou ${fmtPct(future)} da renda ao futuro`,
        text: 'Está dentro ou acima dos 20% do método 50/30/20. Os juros compostos agradecem.',
        lesson: 'juros-compostos',
      });
    }
  }

  // 8) Mês no azul, com dinheiro parado
  if (!isCurrent && s.income > 0 && s.balance > 0) {
    tips.push({
      key: `surplus:${ym}`, tone: 'good',
      title: `Sobraram ${fmtBRL(s.balance)} neste mês`,
      text: 'Dinheiro parado perde para a inflação. Dê um destino para a sobra: reserva, dívida ou meta.',
      lesson: 'inflacao',
    });
  }

  // 9) Hábito: sem registros recentes
  if (isCurrent) {
    const streak = computeStreak(state.progress.activity);
    const lastDay = (state.progress.activity || []).at(-1);
    if (state.transactions.length > 0 && streak === 0 && lastDay && lastDay < addDays(todayISO(), -2)) {
      tips.push({
        key: `stale:${todayISO()}`, tone: 'info',
        title: 'Faz alguns dias que você não registra nada',
        text: 'Lançar os gastos do dia leva menos de um minuto e mantém o mês fiel à realidade.',
        href: '#/lancamentos?novo=1', cta: 'Registrar agora',
      });
    }
    if (!s.income && state.settings.income > 0 && new Date().getDate() >= 10) {
      tips.push({
        key: `no-income:${ym}`, tone: 'info',
        title: 'Nenhuma receita registrada neste mês',
        text: 'Registre seu salário (pode marcar como recorrente) para o saldo e as dicas ficarem corretos.',
        href: '#/lancamentos?novo=receita', cta: 'Registrar receita',
      });
    }
  }

  // 10) Golpes: lição de segurança para quem ainda não fez
  if (!lessonDone(state, 'golpes') && state.transactions.length >= 5) {
    tips.push({
      key: 'golpes', tone: 'info',
      title: 'Proteja o que você está organizando',
      text: 'Falsa central do banco e falso parente pedindo Pix são os golpes mais comuns. Quatro minutos de lição.',
      lesson: 'golpes',
    });
  }

  // 11) Recomendação inicial pelo objetivo escolhido
  const goalLesson = GOAL_TYPES[state.settings.goal]?.lesson;
  if (goalLesson && !lessonDone(state, goalLesson)) {
    tips.push({
      key: `goal-lesson:${goalLesson}`, tone: 'info',
      title: `Para o seu objetivo: ${GOAL_TYPES[state.settings.goal].label.toLowerCase()}`,
      text: `Comece pela lição "${LESSONS.find((l) => l.id === goalLesson).title}".`,
      lesson: goalLesson,
    });
  }

  const dismissed = state.progress.dismissedTips || {};
  const order = { alert: 0, warn: 1, good: 2, info: 3 };
  const seen = new Set();
  return tips
    .filter((t) => !dismissed[t.key])
    .filter((t) => { const k = t.lesson && t.tone === 'info' ? `l:${t.lesson}` : t.key; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Próxima lição sugerida: a do objetivo, depois a primeira não concluída da trilha. */
export function nextLesson(state) {
  const goalLesson = GOAL_TYPES[state.settings.goal]?.lesson;
  if (goalLesson && !lessonDone(state, goalLesson)) return LESSONS.find((l) => l.id === goalLesson);
  return LESSONS.find((l) => !lessonDone(state, l.id)) || null;
}

/** Variação de gastos nos últimos meses (usada no gráfico/insight de tendência). */
export function expenseTrend(state, ym) {
  return lastMonths(state, ym, 6);
}
