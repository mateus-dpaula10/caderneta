// Aprender: trilha de micro-aulas na ordem do objetivo da pessoa, quiz, conquistas e sequência.
import { state, saveLessonResult, saveSettings } from '../store.js';
import { esc, fmtBRL, fmtPct, currentMonth } from '../utils.js';
import { LESSONS, lessonById, DISCLAIMER, goalTrack, nextLessonFor } from '../lessons.js';
import { ACHIEVEMENTS, computeStreak } from '../gamification.js';
import { GOAL_TYPES, avgMonthlyExpense } from '../finance.js';
import { openDialog, sheetHeader, toast } from '../ui.js';
import { icon } from '../icons.js';

/** Lista numerada de lições; `start` continua a numeração entre as duas listas. */
function trailList(lessons, { start = 1, recommended } = {}) {
  return `<ol class="trail" ${start > 1 ? `start="${start}"` : ''}>${lessons.map((l, i) => {
    const p = state.progress.lessons[l.id];
    return `<li class="trail-item ${p?.done ? 'is-done' : ''}">
          <a href="#/aprender/${l.id}">
            <span class="trail-step" aria-hidden="true">${p?.done ? icon('check', { size: 18 }) : start + i}</span>
            <span class="trail-text">
              <span class="trail-title">${l.icon} ${esc(l.title)}</span>
              <span class="muted">${esc(l.summary)}</span>
              <span class="trail-meta">${l.minutes} min${p?.done ? `, quiz: ${p.best}/${p.total}` : ''}${l.id === recommended ? ' <span class="tag accent">Recomendada para você</span>' : ''}</span>
            </span>
          </a></li>`;
  }).join('')}</ol>`;
}

function trail() {
  const track = goalTrack(state.settings.goal);
  const goal = GOAL_TYPES[track.goal];
  const recommended = nextLessonFor(track.goal, state.progress)?.id;
  const done = LESSONS.filter((l) => state.progress.lessons[l.id]?.done).length;
  const essDone = track.essentials.filter((l) => state.progress.lessons[l.id]?.done).length;
  const essTotal = track.essentials.length;
  const streak = computeStreak(state.progress.activity);
  const unlocked = state.progress.achievements || {};

  // "Outras lições" fica recolhida, a não ser que a recomendada esteja lá (trilha do objetivo já concluída).
  const othersOpen = track.others.some((l) => l.id === recommended);

  return `<header class="page-head"><div><h1 class="page-title">Aprender</h1>
      <p class="page-sub">Lições de poucos minutos escolhidas para o seu objetivo, cada uma com um quiz rápido.</p></div></header>

    <section class="progress-strip" aria-label="Seu progresso">
      <div><span class="big">${done}<small>/${LESSONS.length}</small></span><span>lições concluídas</span></div>
      <div><span class="big">${streak}</span><span>${streak === 1 ? 'dia seguido' : 'dias seguidos'} registrando</span></div>
      <div><span class="big">${Object.keys(unlocked).length}<small>/${ACHIEVEMENTS.length}</small></span><span>conquistas</span></div>
      <div class="meter wide" role="progressbar" aria-label="Progresso de todas as lições" aria-valuemin="0" aria-valuemax="${LESSONS.length}" aria-valuenow="${done}">
        <span style="width:${((done / LESSONS.length) * 100).toFixed(1)}%"></span></div>
    </section>

    <section class="block goal-track" aria-labelledby="trail-title">
      <div class="block-head">
        <h2 id="trail-title"><span class="muted goal-kicker">Para o seu objetivo:</span> <span aria-hidden="true">${goal.icon}</span> ${esc(goal.label)}</h2>
        <button type="button" class="btn ghost small" data-change-goal aria-haspopup="dialog">Mudar objetivo</button>
      </div>
      <p class="goal-progress"><strong>${essDone} de ${essTotal}</strong> lições essenciais concluídas${essDone === essTotal ? '. Trilha do objetivo completa!' : ''}</p>
      <div class="meter" role="progressbar" aria-label="Progresso da trilha do objetivo" aria-valuemin="0" aria-valuemax="${essTotal}" aria-valuenow="${essDone}">
        <span style="width:${((essDone / essTotal) * 100).toFixed(1)}%"></span></div>
      ${trailList(track.essentials, { recommended })}
    </section>

    <section class="block more-lessons" aria-labelledby="others-title">
      <details ${othersOpen ? 'open' : ''}>
        <summary><h2 id="others-title">Outras lições <span class="muted">(${track.others.length})</span></h2>
          <span class="muted">Fora do seu objetivo, para quando quiser ir além.</span></summary>
        ${trailList(track.others, { start: essTotal + 1, recommended })}
      </details>
    </section>

    <section class="block" aria-labelledby="ach-title">
      <div class="block-head"><h2 id="ach-title">Conquistas</h2></div>
      <ul class="achievements">${ACHIEVEMENTS.map((a) => {
    const at = unlocked[a.id];
    return `<li class="ach ${at ? 'is-on' : ''}">
          <span class="ach-icon" aria-hidden="true">${a.icon}</span>
          <span><span class="ach-title">${esc(a.title)}</span><span class="muted">${esc(a.text)}</span></span>
          <span class="sr-only">${at ? 'Desbloqueada' : 'Bloqueada'}</span>
        </li>`;
  }).join('')}</ul>
    </section>
    <p class="disclaimer">${icon('info', { size: 16 })} ${esc(DISCLAIMER)}</p>`;
}

function lessonPage(l) {
  // Numeração e "próxima lição" seguem a ordem da trilha do objetivo (a mesma da tela Aprender).
  const track = goalTrack(state.settings.goal);
  const order = track.order;
  const idx = order.findIndex((x) => x.id === l.id);
  const goal = GOAL_TYPES[track.goal];
  const goalNote = l.goalNotes?.[track.goal];
  const next = order[idx + 1];
  const p = state.progress.lessons[l.id];
  const ctx = {
    income: state.settings.income || 0,
    avgExpense: avgMonthlyExpense(state, currentMonth()),
    fmtBRL, fmtPct,
  };
  const personal = l.personal ? l.personal(ctx) : null;
  return `<nav class="crumbs" aria-label="Você está em"><a href="#/aprender">${icon('left', { size: 18 })} Trilha</a></nav>
  <article class="lesson" aria-labelledby="lesson-h1">
    <header class="lesson-head">
      <span class="lesson-emoji big" aria-hidden="true">${l.icon}</span>
      <h1 id="lesson-h1" class="page-title">${esc(l.title)}</h1>
      <p class="muted">Lição ${idx + 1} de ${LESSONS.length}, ${l.minutes} min${p?.done ? `. Concluída, melhor nota ${p.best}/${p.total}.` : ''}</p>
    </header>
    ${goalNote ? `<aside class="goal-note" aria-labelledby="goal-note-title"><span class="goal-note-icon" aria-hidden="true">${goal.icon}</span>
      <div><p class="goal-note-title" id="goal-note-title">No seu objetivo: ${esc(goal.label.toLowerCase())}</p><p>${goalNote}</p></div></aside>` : ''}
    ${l.body.map((s) => `<section class="lesson-sec"><h2>${esc(s.h)}</h2>${s.html}</section>`).join('')}
    ${personal ? `<aside class="personal">${icon('bulb', { size: 20 })}<div><p class="personal-title">Com os seus números</p><p>${personal}</p></div></aside>` : ''}
    <section class="lesson-sec takeaways"><h2>Para lembrar</h2><ul>${l.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>

    <form class="quiz" id="quiz" novalidate aria-labelledby="quiz-title">
      <h2 id="quiz-title">Quiz rápido</h2>
      ${l.quiz.map((q, qi) => `<fieldset class="quiz-q" data-q="${qi}">
        <legend>${qi + 1}. ${esc(q.q)}</legend>
        ${q.options.map((o, oi) => `<label class="quiz-opt"><input type="radio" name="q${qi}" value="${oi}"><span>${esc(o)}</span></label>`).join('')}
        <p class="quiz-feedback" hidden></p>
      </fieldset>`).join('')}
      <p class="form-error" role="alert" hidden></p>
      <div class="actions"><button type="submit" class="btn primary">Conferir respostas</button></div>
      <div class="quiz-result" role="status" hidden></div>
    </form>
    <p class="disclaimer">${icon('info', { size: 16 })} ${esc(DISCLAIMER)}</p>
    ${next ? `<a class="lesson-card" href="#/aprender/${next.id}"><span class="lesson-emoji" aria-hidden="true">${next.icon}</span>
      <span><span class="muted">Próxima lição</span><span class="lesson-card-title">${esc(next.title)}</span></span></a>` : ''}
  </article>`;
}

export function render({ params, sub }) {
  const l = sub ? lessonById(sub) : null;
  if (sub && !l) return `<div class="empty"><p class="empty-title">Lição não encontrada</p><a class="btn ghost" href="#/aprender">Voltar para a trilha</a></div>`;
  return l ? lessonPage(l) : trail();
}

/**
 * Seletor de objetivo (o mesmo campo de Ajustes → Objetivo principal). Ao salvar, o redesenho
 * (onChange 'settings') atualiza a trilha, a lição recomendada e as dicas.
 */
function openGoalPicker(opener) {
  const current = goalTrack(state.settings.goal).goal;
  const dlg = openDialog(`<form class="sheet-body" novalidate>
    ${sheetHeader('Mudar objetivo')}
    <p class="lead">A ordem das lições e a lição recomendada seguem o seu objetivo. Nenhuma lição some e o progresso continua.</p>
    <fieldset class="choice-grid"><legend class="sr-only">Objetivo principal</legend>
      ${Object.entries(GOAL_TYPES).map(([k, g]) => `<label class="choice">
        <input type="radio" name="goal" value="${k}" ${k === current ? 'checked' : ''}>
        <span><span class="choice-icon" aria-hidden="true">${g.icon}</span>${esc(g.label)}</span></label>`).join('')}
    </fieldset>
    <div class="actions">
      <button type="button" class="btn ghost" data-close>Cancelar</button>
      <button type="submit" class="btn primary">Salvar objetivo</button>
    </div>
  </form>`, { onClose: () => (document.querySelector('[data-change-goal]') || opener)?.focus() });
  dlg.querySelector('input[name="goal"]:checked')?.focus();
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goal = e.target.goal.value;
    dlg.close();
    if (goal && goal !== current) {
      await saveSettings({ goal });
      document.querySelector('[data-change-goal]')?.focus(); // a tela foi redesenhada: foco no botão novo
      toast(`Objetivo: ${esc(GOAL_TYPES[goal].label.toLowerCase())}. A trilha foi reorganizada.`, { tone: 'good' });
    }
  });
}

export function mount(root, { sub }) {
  const l = sub ? lessonById(sub) : null;
  if (!l) {
    const btn = root.querySelector('[data-change-goal]');
    btn?.addEventListener('click', () => openGoalPicker(btn));
    return;
  }
  const form = root.querySelector('#quiz');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.form-error');
    const answers = l.quiz.map((_, qi) => form.querySelector(`input[name="q${qi}"]:checked`));
    if (answers.some((a) => !a)) {
      err.textContent = 'Responda todas as perguntas antes de conferir.';
      err.hidden = false;
      form.querySelector(`[data-q="${answers.findIndex((a) => !a)}"] input`).focus();
      return;
    }
    err.hidden = true;
    let correct = 0;
    l.quiz.forEach((q, qi) => {
      const chosen = Number(answers[qi].value);
      const ok = chosen === q.answer;
      if (ok) correct++;
      const fs = form.querySelector(`[data-q="${qi}"]`);
      fs.classList.toggle('is-right', ok);
      fs.classList.toggle('is-wrong', !ok);
      fs.querySelectorAll('.quiz-opt').forEach((opt, oi) => opt.classList.toggle('is-answer', oi === q.answer));
      const fb = fs.querySelector('.quiz-feedback');
      fb.innerHTML = `<strong>${ok ? 'Certo.' : `Resposta: ${esc(q.options[q.answer])}.`}</strong> ${esc(q.explain)}`;
      fb.hidden = false;
    });
    const total = l.quiz.length;
    const res = form.querySelector('.quiz-result');
    res.innerHTML = `<p class="quiz-score">${correct} de ${total} ${correct === 1 ? 'acerto' : 'acertos'}</p>
      <p>${correct === total ? 'Mandou bem! Lição concluída.' : 'Lição concluída. Releia os pontos marcados e tente de novo quando quiser.'}</p>
      <button type="button" class="btn ghost small" data-retry>Refazer quiz</button>`;
    res.hidden = false;
    form.querySelector('button[type="submit"]').hidden = true;
    res.querySelector('[data-retry]').addEventListener('click', () => {
      form.reset();
      form.querySelectorAll('.quiz-q').forEach((fs) => { fs.classList.remove('is-right', 'is-wrong'); fs.querySelector('.quiz-feedback').hidden = true; });
      form.querySelectorAll('.quiz-opt').forEach((o) => o.classList.remove('is-answer'));
      res.hidden = true;
      form.querySelector('button[type="submit"]').hidden = false;
      form.querySelector('input').focus();
    });
    // Grava sem redesenhar a página (a pessoa ainda está lendo o resultado).
    await saveLessonResult(l.id, correct, total, { silent: true });
    if (correct === total) toast('Quiz perfeito!', { tone: 'good' });
  });
}
