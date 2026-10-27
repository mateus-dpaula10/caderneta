// Conta e sincronização (opcional): fluxos de login/cadastro/senha, vínculo do aparelho com a conta,
// bloco "Conta e sincronização" em Ajustes. Sem conta, nada aqui roda (nem a biblioteca é carregada).
import * as store from './store.js';
import { createSyncEngine } from './sync.js';
import {
  getClient, hasStoredSession, currentSession, takeCapturedCallback, adoptCallbackSession, signIn, signUp,
  sendPasswordReset, setNewPassword, resendConfirmation, signOutLocal, deleteAccount, onAuthChange,
} from './auth.js';
import { SERVER_REGION_LABEL } from './config.js';
import { openDialog, sheetHeader, toast, confirmDialog } from './ui.js';
import { esc, plural } from './utils.js';
import { icon } from './icons.js';

export const sync = createSyncEngine({ store, getClient });

let hooks = { showOnboarding: () => {} };
let authWatched = false;
let lastSession = null;

const blocks = new Set(); // blocos de conta montados (Ajustes)
function refreshBlocks() {
  for (const el of [...blocks]) {
    if (!el.isConnected) { blocks.delete(el); continue; }
    el.innerHTML = accountBodyHTML();
  }
}
sync.onStatus(() => refreshBlocks());

async function watchAuth() {
  if (authWatched) return;
  authWatched = true;
  try {
    await onAuthChange((event, session) => {
      lastSession = session || null;
      if (event === 'SIGNED_OUT') sync.markAuthExpired();
      refreshBlocks();
    });
  } catch { authWatched = false; }
}

/** Chamado no boot, depois do initStore e da primeira tela. Nunca bloqueia a interface. */
export async function initAccount({ showOnboarding }) {
  hooks = { showOnboarding };
  await sync.init();
  sync.start();
  refreshBlocks();

  const cb = takeCapturedCallback();
  if (cb?.kind === 'error') {
    toast(esc(cb.code === 'otp_expired' || /expired|invalid/i.test(cb.description)
      ? 'O link do e-mail expirou ou já foi usado. Peça um novo em Ajustes → Conta e sincronização.'
      : `Não foi possível concluir pelo link do e-mail: ${cb.description || cb.code}`), { tone: 'alert', timeout: 9000 });
  } else if (cb?.kind === 'session') {
    const res = await adoptCallbackSession(cb);
    if (res.error) {
      const offline = /conexão/.test(res.error);
      toast(esc(offline ? res.error : 'O link do e-mail é inválido ou expirou. Peça um novo em Ajustes → Conta e sincronização.'), { tone: 'alert', timeout: 9000 });
    } else {
      await watchAuth();
      const user = res.data?.user || res.data?.session?.user;
      lastSession = res.data?.session || null;
      if (cb.type === 'recovery') await openNewPasswordDialog();
      else toast('E-mail confirmado. Você entrou na sua conta.', { tone: 'good' });
      if (user) await afterSignIn(user);
    }
    return;
  }

  if (sync.isLinked()) {
    await watchAuth();
    sync.syncNow({ reason: 'boot' });
  } else if (hasStoredSession()) {
    // Login feito mas o vínculo não chegou a ser gravado (ex.: app fechado no meio): retoma.
    const session = await currentSession();
    lastSession = session;
    await watchAuth();
    if (session?.user) await afterSignIn(session.user);
  }
}

// ---------- Vínculo da conta com este aparelho ----------
function summaryText(s) {
  const parts = [];
  if (s.transactions) parts.push(plural(s.transactions, 'lançamento', 'lançamentos'));
  if (s.goals) parts.push(plural(s.goals, 'meta', 'metas'));
  if (s.recurrences) parts.push(plural(s.recurrences, 'série recorrente', 'séries recorrentes'));
  if (s.customCategories) parts.push(plural(s.customCategories, 'categoria criada', 'categorias criadas'));
  if (s.lessons) parts.push(plural(s.lessons, 'lição feita', 'lições feitas'));
  return parts.length ? parts.join(', ') : 'nenhum dado';
}

/** Pergunta o que fazer quando o aparelho já tem dados. Resolve 'merge' | 'replace' | null. */
function askLinkMode(plan, user) {
  const r = plan.remote;
  const remoteText = r
    ? `${plural(r.transactions, 'lançamento', 'lançamentos')} e ${plural(r.goals, 'meta', 'metas')}${!r.transactions && !r.goals && !r.hasSettings ? ' (conta vazia)' : ''}`
    : 'não foi possível consultar agora';
  return new Promise((resolve) => {
    let choice = null;
    const dlg = openDialog(`<form method="dialog" class="sheet-body" novalidate>
      ${sheetHeader('Este aparelho já tem dados')}
      <p>Você entrou como <strong>${esc(user.email || '')}</strong>.${plan.previousEmail ? ` Este aparelho estava ligado a outra conta (${esc(plan.previousEmail)}).` : ''}</p>
      <ul class="ob-points">
        <li><strong>Neste aparelho:</strong> ${esc(summaryText(plan.local))}.</li>
        <li><strong>Na conta:</strong> ${esc(remoteText)}.</li>
      </ul>
      <p><strong>Juntar tudo</strong> envia o que está aqui para a conta e baixa o que já está lá. Nada é apagado;
        se o mesmo item foi mudado nos dois lugares, fica a versão mais recente.</p>
      <p><strong>Usar só os dados da conta</strong> apaga os dados deste aparelho e baixa os da conta. Bom quando aqui só há
        testes ou o que a apresentação inicial criou (para não duplicar renda e metas). Se tiver dúvida, exporte um backup antes.</p>
      <div class="actions">
        <button type="button" class="btn link" data-choice="cancel">Cancelar e sair</button>
        <button type="button" class="btn ghost" data-choice="replace" ${r ? '' : 'disabled'}>Usar só os dados da conta</button>
        <button type="button" class="btn primary" data-choice="merge" autofocus>Juntar tudo</button>
      </div>
    </form>`, { onClose: () => resolve(choice === 'merge' || choice === 'replace' ? choice : null) });
    dlg.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => { choice = b.dataset.choice; dlg.close(); }));
  });
}

async function afterSignIn(user) {
  let plan;
  try {
    plan = await sync.prepareLink(user);
  } catch (err) {
    toast(esc(`Não foi possível preparar a sincronização: ${err?.message || err}`), { tone: 'alert' });
    return;
  }
  let mode = plan.mode;
  if (mode === 'ask') {
    mode = await askLinkMode(plan, user);
    if (!mode) {
      await signOutLocal();
      lastSession = null;
      refreshBlocks();
      toast('Você saiu da conta. Nada foi alterado neste aparelho.');
      return;
    }
    if (mode === 'replace') {
      const ok = await confirmDialog({
        title: 'Apagar os dados deste aparelho?',
        text: `Os dados deste aparelho (${esc(summaryText(plan.local))}) serão apagados e substituídos pelos da conta. Não dá para desfazer.`,
        confirmLabel: 'Apagar e usar a conta', danger: true,
      });
      if (!ok) return afterSignIn(user);
    }
  }
  const res = await sync.linkAccount(user, mode);
  refreshBlocks();
  if (res?.ok) {
    toast(mode === 'resume' ? 'Sincronização retomada.' : 'Pronto! Este aparelho agora sincroniza com a sua conta.', { tone: 'good' });
  } else if (res?.error) {
    toast(esc(sync.getStatus().message || 'A sincronização vai tentar de novo em instantes.'), { tone: 'alert', timeout: 7000 });
  }
}

// ---------- Diálogos de autenticação ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Entrar / criar conta / esqueci a senha. */
export function openAuthDialog(mode = 'signin') {
  const titles = { signin: 'Entrar na conta', signup: 'Criar conta', reset: 'Recuperar a senha' };
  const dlg = openDialog(`<form class="sheet-body stack" novalidate data-auth-form>
    ${sheetHeader(titles[mode])}
    ${mode === 'reset' ? '<p class="lead">Informe o e-mail da conta. Vamos enviar um link para você criar uma senha nova.</p>' : `
    <fieldset class="segmented small"><legend class="sr-only">Já tem conta?</legend>
      <label><input type="radio" name="mode" value="signin" ${mode === 'signin' ? 'checked' : ''}><span>Entrar</span></label>
      <label><input type="radio" name="mode" value="signup" ${mode === 'signup' ? 'checked' : ''}><span>Criar conta</span></label>
    </fieldset>`}
    <label class="field" for="a-email"><span class="field-label">E-mail</span>
      <input id="a-email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" autofocus></label>
    ${mode === 'reset' ? '' : `
    <label class="field" for="a-pass"><span class="field-label">Senha</span>
      <input id="a-pass" name="password" type="password" required minlength="${mode === 'signup' ? 8 : 1}" maxlength="72"
        autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" ${mode === 'signup' ? 'aria-describedby="a-pass-hint"' : ''}>
      ${mode === 'signup' ? '<span class="field-hint" id="a-pass-hint">Pelo menos 8 caracteres.</span>' : ''}</label>`}
    ${mode === 'signup' ? `
    <label class="field" for="a-pass2"><span class="field-label">Repita a senha</span>
      <input id="a-pass2" name="password2" type="password" required maxlength="72" autocomplete="new-password"></label>` : ''}
    <p class="form-error" role="alert" hidden></p>
    <p class="callout" role="status" data-ok hidden></p>
    <div class="actions">
      ${mode === 'signin' ? '<button type="button" class="btn link" data-forgot>Esqueci a senha</button>' : ''}
      ${mode === 'reset' ? '<button type="button" class="btn link" data-back-signin>Voltar</button>' : ''}
      <button type="submit" class="btn primary">${mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}</button>
    </div>
    ${mode === 'reset' ? '' : `<p class="muted small">A conta é opcional e serve para sincronizar seus aparelhos. Os dados ficam no ${esc(SERVER_REGION_LABEL)}.
      Veja os detalhes em Ajustes → Conta e sincronização.</p>`}
  </form>`);
  const form = dlg.querySelector('form');
  const err = form.querySelector('.form-error');
  const okBox = form.querySelector('[data-ok]');
  const submit = form.querySelector('[type="submit"]');
  const showErr = (m, field) => { err.textContent = m; err.hidden = false; okBox.hidden = true; field?.focus(); };
  const showOk = (html) => { okBox.innerHTML = html; okBox.hidden = false; err.hidden = true; };

  form.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
    const email = form.email.value;
    const d = openAuthDialog(r.value);
    d.querySelector('[name="email"]').value = email;
  }));
  form.querySelector('[data-forgot]')?.addEventListener('click', () => {
    const email = form.email.value;
    openAuthDialog('reset').querySelector('[name="email"]').value = email;
  });
  form.querySelector('[data-back-signin]')?.addEventListener('click', () => {
    const email = form.email.value;
    openAuthDialog('signin').querySelector('[name="email"]').value = email;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return showErr('Digite um e-mail válido.', form.email);
    if (navigator.onLine === false) return showErr('Sem internet agora. Conecte-se para entrar ou criar a conta.');
    submit.disabled = true;
    try {
      if (mode === 'reset') {
        const res = await sendPasswordReset(email);
        if (res.error) return showErr(res.error);
        showOk(`Se existir uma conta com <strong>${esc(email)}</strong>, enviamos um link para criar uma senha nova.
          Abra o link no aparelho em que quer usar a Caderneta (veja também a caixa de spam).`);
        return;
      }
      const password = form.password.value;
      if (!password) return showErr('Digite a senha.', form.password);
      if (mode === 'signup') {
        if (password.length < 8) return showErr('A senha precisa ter pelo menos 8 caracteres.', form.password);
        if (password !== form.password2.value) return showErr('As senhas não são iguais.', form.password2);
        const res = await signUp(email, password);
        if (res.error) return showErr(res.error);
        if (res.data?.session) { dlg.close(); lastSession = res.data.session; await watchAuth(); await afterSignIn(res.data.user); return; }
        showOk(`Quase lá! Enviamos um link de confirmação para <strong>${esc(email)}</strong>.
          Abra o e-mail e toque no link para ativar a conta (veja também o spam). Depois disso você já entra automaticamente.
          <button type="button" class="btn link" data-resend>Reenviar e-mail</button>`);
        okBox.querySelector('[data-resend]').addEventListener('click', async (ev) => {
          ev.target.disabled = true;
          const r2 = await resendConfirmation(email);
          toast(r2.error ? esc(r2.error) : 'E-mail reenviado.', { tone: r2.error ? 'alert' : 'good' });
        });
        return;
      }
      const res = await signIn(email, password);
      if (res.error) return showErr(res.error, form.password);
      dlg.close();
      lastSession = res.data?.session || null;
      await watchAuth();
      await afterSignIn(res.data.user);
    } finally {
      submit.disabled = false;
    }
  });
  return dlg;
}

/** Depois do link de recuperação: definir a senha nova. Resolve quando o diálogo fecha. */
function openNewPasswordDialog() {
  return new Promise((resolve) => {
    const dlg = openDialog(`<form class="sheet-body stack" novalidate>
      ${sheetHeader('Crie uma senha nova')}
      <p class="lead">Você abriu o link de recuperação. Escolha a senha nova da sua conta.</p>
      <label class="field" for="np-pass"><span class="field-label">Senha nova</span>
        <input id="np-pass" name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password" autofocus
          aria-describedby="np-hint"><span class="field-hint" id="np-hint">Pelo menos 8 caracteres.</span></label>
      <label class="field" for="np-pass2"><span class="field-label">Repita a senha nova</span>
        <input id="np-pass2" name="password2" type="password" required maxlength="72" autocomplete="new-password"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="actions"><button type="submit" class="btn primary">Salvar senha</button></div>
    </form>`, { onClose: () => resolve() });
    const form = dlg.querySelector('form');
    const err = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = form.password.value;
      if (p.length < 8) { err.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; err.hidden = false; return; }
      if (p !== form.password2.value) { err.textContent = 'As senhas não são iguais.'; err.hidden = false; return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      const res = await setNewPassword(p);
      btn.disabled = false;
      if (res.error) { err.textContent = res.error; err.hidden = false; return; }
      dlg.close();
      toast('Senha alterada.', { tone: 'good' });
    });
  });
}

// ---------- Sair / excluir conta ----------
async function signOutFlow() {
  if (sync.getStatus().pending > 0) await sync.syncNow({ reason: 'signout' });
  const pending = sync.getStatus().pending;
  const choice = await new Promise((resolve) => {
    let value = null;
    const dlg = openDialog(`<form method="dialog" class="sheet-body" novalidate>
      ${sheetHeader('Sair da conta?')}
      ${pending ? `<p class="callout alert">${plural(pending, 'alteração deste aparelho ainda não foi enviada', 'alterações deste aparelho ainda não foram enviadas')} (sem conexão?).
        Se apagar os dados deste aparelho agora, ${pending === 1 ? 'ela será perdida' : 'elas serão perdidas'}.</p>` : ''}
      <fieldset class="ob-options"><legend class="field-label">O que fazer com os dados deste aparelho?</legend>
        <label class="check"><input type="radio" name="keep" value="keep" checked><span>Manter neste aparelho
          <small>Continuam aqui, mas deixam de sincronizar. Na conta, nada muda.</small></span></label>
        <label class="check"><input type="radio" name="keep" value="wipe"><span>Apagar deste aparelho
          <small>Some só daqui; continua guardado na conta. Bom para aparelho emprestado ou compartilhado.</small></span></label>
      </fieldset>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary" data-ok>Sair</button>
      </div>
    </form>`, { onClose: () => resolve(value) });
    dlg.querySelector('[data-ok]').addEventListener('click', () => { value = dlg.querySelector('input[name="keep"]:checked').value; });
  });
  if (!choice) return;
  const wipe = choice === 'wipe';
  await sync.unlink({ wipe });
  await signOutLocal();
  lastSession = null;
  refreshBlocks();
  toast(wipe ? 'Você saiu e os dados deste aparelho foram apagados.' : 'Você saiu da conta. Os dados continuam neste aparelho.');
  if (wipe) hooks.showOnboarding();
}

async function deleteAccountFlow() {
  const result = await new Promise((resolve) => {
    let value = null;
    const dlg = openDialog(`<form class="sheet-body stack" novalidate>
      ${sheetHeader('Excluir sua conta?')}
      <p class="callout alert">Isto apaga a conta <strong>${esc(sync.getStatus().email || '')}</strong> e, junto com ela,
        <strong>todos os seus dados guardados no servidor</strong>, de forma definitiva. Não dá para desfazer.</p>
      <p>O login (e-mail e senha) deixa de existir: não dá mais para entrar com ele aqui nem em outro app que use esse
        mesmo login. Outros aparelhos conectados deixam de sincronizar.</p>
      <label class="field" for="del-confirm"><span class="field-label">Para confirmar, digite EXCLUIR</span>
        <input id="del-confirm" name="confirm" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <label class="check"><input type="checkbox" name="wipe"><span>Apagar também os dados deste aparelho
        <small>Sem marcar, eles continuam aqui, só neste aparelho.</small></span></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn danger">Excluir conta</button>
      </div>
    </form>`, { onClose: () => resolve(value) });
    const form = dlg.querySelector('form');
    const err = form.querySelector('.form-error');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (form.confirm.value.trim().toUpperCase() !== 'EXCLUIR') { err.textContent = 'Digite EXCLUIR para confirmar.'; err.hidden = false; form.confirm.focus(); return; }
      if (navigator.onLine === false) { err.textContent = 'Sem internet agora. Conecte-se para excluir a conta.'; err.hidden = false; return; }
      value = { wipe: form.wipe.checked };
      dlg.close();
    });
  });
  if (!result) return;
  const session = await currentSession();
  if (!session) { toast('Sua sessão expirou. Entre de novo e repita a exclusão.', { tone: 'alert', timeout: 7000 }); openAuthDialog('signin'); return; }
  const res = await deleteAccount();
  if (res.error) { toast(esc(`A conta NÃO foi excluída. ${res.error}`), { tone: 'alert', timeout: 9000 }); return; }
  await sync.unlink({ wipe: result.wipe });
  await signOutLocal();
  lastSession = null;
  refreshBlocks();
  toast(result.wipe ? 'Conta e dados excluídos.' : 'Conta excluída. Os dados continuam só neste aparelho.', { tone: 'good', timeout: 7000 });
  if (result.wipe) hooks.showOnboarding();
}

// ---------- Bloco em Ajustes ----------
const PHASE_TEXT = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando…',
  offline: 'Sem conexão: as alterações ficam guardadas aqui e sobem depois',
  error: 'A última sincronização falhou',
  auth: 'Conta desconectada neste aparelho',
};

function fmtWhen(iso) {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString('pt-BR');
}

export const privacyHTML = () => `<details class="privacy">
    <summary>Privacidade: o que fica guardado e onde</summary>
    <ul>
      <li><strong>Sem conta</strong>, nada sai deste aparelho.</li>
      <li><strong>Com conta</strong>, uma cópia dos seus lançamentos, metas, categorias, perfil (nome e renda informados) e progresso nas lições
        fica no ${esc(SERVER_REGION_LABEL)}, ligada ao seu e-mail. Só você acessa (login com senha; o banco só entrega a cada pessoa as próprias linhas).</li>
      <li>Serve apenas para sincronizar seus aparelhos. O app não tem anúncios nem rastreadores.</li>
      <li>Você pode sair quando quiser e <strong>excluir a conta e todos os dados do servidor</strong> aqui mesmo, em "Excluir minha conta".</li>
    </ul>
  </details>`;

function accountBodyHTML() {
  const st = sync.getStatus();
  if (!st.linked) {
    return `<p class="lead">Opcional. Sem conta, tudo continua só neste aparelho. Com uma conta, seus dados ficam iguais
        em todos os aparelhos em que você entrar, e não se perdem se o celular quebrar.</p>
      <div class="actions left">
        <button type="button" class="btn primary" data-acc="signin">Entrar</button>
        <button type="button" class="btn ghost" data-acc="signup">Criar conta</button>
      </div>
      ${privacyHTML()}`;
  }
  const lines = [`Última sincronização: ${fmtWhen(st.lastSyncAt)}`];
  if (st.pending) lines.push(plural(st.pending, 'alteração aguardando envio', 'alterações aguardando envio'));
  if (st.rejected) lines.push(plural(st.rejected, 'alteração recusada pelo servidor', 'alterações recusadas pelo servidor'));
  const tone = st.phase === 'auth' || st.phase === 'error' ? 'callout alert' : 'callout';
  return `<p>Conectado como <strong>${esc(st.email || '')}</strong></p>
    <div class="${tone} sync-status" role="status" aria-live="polite">${icon({ syncing: 'repeat', idle: 'check', auth: 'alert', error: 'alert' }[st.phase] || 'info', { size: 16 })}
      <span><strong>${PHASE_TEXT[st.phase] || ''}</strong>${st.message && st.phase !== 'idle' ? `. ${esc(st.message)}` : ''}<br>
      <span class="small">${lines.map(esc).join(' · ')}</span></span></div>
    <div class="actions left">
      ${st.phase === 'auth'
    ? '<button type="button" class="btn primary" data-acc="signin">Entrar de novo</button>'
    : `<button type="button" class="btn primary" data-acc="sync" ${st.phase === 'syncing' ? 'disabled' : ''}>Sincronizar agora</button>`}
      <button type="button" class="btn ghost" data-acc="signout">Sair da conta</button>
    </div>
    ${privacyHTML()}
    <div class="actions left"><button type="button" class="btn ghost danger-text" data-acc="delete">${icon('trash', { size: 18 })} Excluir minha conta</button></div>`;
}

export function renderAccountBlock() {
  return `<section class="block" aria-labelledby="account-title">
    <div class="block-head"><h2 id="account-title">Conta e sincronização</h2></div>
    <div data-account-body>${accountBodyHTML()}</div>
  </section>`;
}

export function mountAccountBlock(root) {
  const body = root.querySelector('[data-account-body]');
  if (!body) return;
  blocks.add(body);
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const action = b.dataset.acc;
    if (action === 'signin') openAuthDialog('signin');
    else if (action === 'signup') openAuthDialog('signup');
    else if (action === 'sync') {
      const res = await sync.syncNow({ reason: 'manual' });
      if (res?.ok) toast('Tudo sincronizado.', { tone: 'good' });
      else if (res?.error) toast(esc(sync.getStatus().message || 'Não foi possível sincronizar agora.'), { tone: 'alert' });
    } else if (action === 'signout') signOutFlow();
    else if (action === 'delete') deleteAccountFlow();
  });
}

/** Para textos de outras telas (backup, apagar tudo). */
export const isSyncLinked = () => sync.isLinked();
export const sessionHint = () => lastSession;
