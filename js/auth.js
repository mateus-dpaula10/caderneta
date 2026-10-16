// Conta (opcional): carrega o supabase-js empacotado no app só quando é preciso, e cuida de
// cadastro, login, recuperação de senha, saída e exclusão da conta.
//
// Decisões:
//  - Biblioteca oficial (supabase-js v2, build UMD autocontido em js/vendor/), não CDN: funciona offline,
//    é cacheada pelo service worker e traz o que é difícil de acertar à mão (renovação do token com trava
//    entre abas, reintentos, eventos de sessão).
//  - Carregamento preguiçoso: quem nunca entrou numa conta não baixa nem executa a biblioteca.
//  - flowType 'implicit' + detectSessionInUrl desligado: o link do e-mail volta com os tokens no hash
//    (#access_token=...&type=signup|recovery). O app lê e limpa esse hash ANTES do roteador por hash
//    (captureAuthCallback) e entrega os tokens ao cliente com setSession. Funciona mesmo que o link seja
//    aberto em outro navegador/aparelho (o fluxo PKCE exigiria o mesmo navegador que pediu o e-mail).
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB, AUTH_STORAGE_KEY } from './config.js';

let clientPromise = null;
let capturedCallback = null;

export function hasStoredSession() {
  try { return Boolean(localStorage.getItem(AUTH_STORAGE_KEY)); } catch { return false; }
}

function loadLib() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(SUPABASE_LIB, import.meta.url).href;
    s.async = true;
    s.onload = () => (globalThis.supabase?.createClient ? resolve(globalThis.supabase) : reject(new Error('supabase-js não carregou')));
    s.onerror = () => { s.remove(); reject(new Error('Não foi possível carregar o módulo da conta.')); };
    document.head.appendChild(s);
  });
}

/** Cliente Supabase (criado uma vez). Lança se a biblioteca não carregar; a próxima chamada tenta de novo. */
export function getClient() {
  if (!clientPromise) {
    clientPromise = loadLib().then((lib) => lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'implicit',
      },
    })).catch((err) => { clientPromise = null; throw err; });
  }
  return clientPromise;
}

/** Endereço do app sem hash nem query (para onde os links dos e-mails voltam). */
export function appUrl() {
  return `${location.origin}${location.pathname}`;
}

/**
 * Lê o retorno de um link de e-mail (confirmação de cadastro, recuperação de senha) e LIMPA a URL na hora,
 * para os tokens não ficarem no histórico nem confundirem o roteador por hash. Chame no início do boot.
 */
export function captureAuthCallback() {
  const hash = location.hash.replace(/^#/, '');
  const query = new URLSearchParams(location.search);
  const hp = new URLSearchParams(hash.startsWith('/') ? '' : hash);
  const has = (k) => hp.has(k) || query.has(k);
  if (!has('access_token') && !has('error_description') && !has('error_code')) return null;
  const get = (k) => hp.get(k) ?? query.get(k);
  capturedCallback = has('access_token')
    ? { kind: 'session', type: get('type') || 'signup', access_token: get('access_token'), refresh_token: get('refresh_token') }
    : { kind: 'error', code: get('error_code') || get('error') || '', description: get('error_description') || '' };
  for (const k of ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type', 'error', 'error_code', 'error_description', 'provider_token', 'sb']) query.delete(k);
  const qs = query.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}#/ajustes`);
  return capturedCallback;
}

export const takeCapturedCallback = () => { const c = capturedCallback; capturedCallback = null; return c; };

/** Mensagens de erro do Supabase Auth em português. */
export function authErrorMessage(error) {
  const msg = String(error?.message || error || '');
  const code = String(error?.code || '');
  if (error?.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Você ainda não confirmou o e-mail. Abra o link que enviamos (veja também o spam).';
  if (code === 'weak_password' || /password should be|weak password/i.test(msg)) return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.';
  if (code === 'same_password' || /should be different/i.test(msg)) return 'A nova senha precisa ser diferente da atual.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|too many/i.test(msg)) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
  }
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'Esse e-mail não parece válido.';
  if (code === 'signup_disabled') return 'Novos cadastros estão desativados no momento.';
  if (code === 'otp_expired' || /expired/i.test(msg)) return 'O link expirou ou já foi usado. Peça um novo.';
  if (code === 'user_already_exists') return 'Já existe uma conta com esse e-mail. Tente entrar.';
  return `Não deu certo: ${msg || 'erro desconhecido'}.`;
}

const ok = (data) => ({ data, error: null });
const fail = (error) => ({ data: null, error: authErrorMessage(error), raw: error });

async function call(fn) {
  try {
    const client = await getClient();
    const res = await fn(client);
    return res.error ? fail(res.error) : ok(res.data);
  } catch (err) {
    return fail(err);
  }
}

export async function currentSession() {
  if (!clientPromise && !hasStoredSession()) return null;
  try {
    const client = await getClient();
    const { data } = await client.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

/** Cadastro. Com confirmação de e-mail ligada, não há sessão até a pessoa clicar no link. */
export const signUp = (email, password) => call((c) => c.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }));
export const signIn = (email, password) => call((c) => c.auth.signInWithPassword({ email, password }));
export const sendPasswordReset = (email) => call((c) => c.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }));
export const setNewPassword = (password) => call((c) => c.auth.updateUser({ password }));
export const resendConfirmation = (email) => call((c) => c.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } }));
/** Usa os tokens que vieram no link do e-mail. */
export const adoptCallbackSession = (cb) => call((c) => c.auth.setSession({ access_token: cb.access_token, refresh_token: cb.refresh_token }));

/** Sai SÓ deste aparelho (scope local). Mesmo sem internet, a sessão local é removida. */
export async function signOutLocal() {
  try {
    const client = await getClient();
    await client.auth.signOut({ scope: 'local' });
  } catch { /* segue para a limpeza manual */ }
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* sem armazenamento */ }
}

/** LGPD: apaga a conta e todos os dados dela no servidor (função delete_my_account, cascade). */
export const deleteAccount = () => call((c) => c.rpc('delete_my_account'));

/** Avisa mudanças de sessão (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED...). */
export async function onAuthChange(fn) {
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // Não chamar o supabase de dentro deste callback (pode travar a fila interna); adia.
    setTimeout(() => fn(event, session), 0);
  });
  return () => data?.subscription?.unsubscribe();
}
