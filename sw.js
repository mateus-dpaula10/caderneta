/* Service worker da Caderneta: cache do app shell (offline-first).
   Ao mudar qualquer arquivo do app, aumente VERSION para os aparelhos baixarem a versão nova. */
const VERSION = 'v1.1.1';
const CACHE = `caderneta-${VERSION}`;

// Sem './index.html': servidores como o `npx serve` redirecionam /index.html -> /index,
// e o navegador recusa servir uma resposta redirecionada para uma navegação (ERR_FAILED).
const SHELL = [
  './',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/account.js',
  './js/auth.js',
  './js/config.js',
  './js/merge.js',
  './js/sync.js',
  './js/vendor/supabase-js-2.117.2.umd.js',
  './js/app-shell.js',
  './js/calc.js',
  './js/charts.js',
  './js/db.js',
  './js/finance.js',
  './js/gamification.js',
  './js/icons.js',
  './js/insights.js',
  './js/lessons.js',
  './js/store.js',
  './js/ui.js',
  './js/utils.js',
  './js/views/home.js',
  './js/views/learn.js',
  './js/views/onboarding.js',
  './js/views/plan.js',
  './js/views/settings.js',
  './js/views/tools.js',
  './js/views/transactions.js',
  './js/views/txform.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' garante que o precache não reaproveite cópias antigas do cache HTTP.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // Sem skipWaiting aqui: na 1ª instalação o SW ativa sozinho; nas atualizações,
  // a versão nova espera a pessoa tocar em "Atualizar" (mensagem SKIP_WAITING).
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('caderneta-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Alguns navegadores (webviews de editor, perfis com cache corrompido) lançam erro no Cache Storage;
// nesse caso tratamos como "não está no cache" e seguimos pela rede, em vez de quebrar a página.
async function cacheMatch(req) {
  try { return await caches.match(req, { ignoreSearch: true }); } catch { return undefined; }
}

// Uma resposta que passou por redirecionamento não pode responder a uma navegação; recria sem a marca.
async function unredirect(res) {
  if (!res || !res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Não intercepta nada de terceiros: as chamadas ao Supabase (*.supabase.co: login, REST) vão direto
  // para a rede e nunca são cacheadas. (POST/PATCH já saíram acima, por não serem GET.)
  if (url.origin !== self.location.origin) return;

  // Navegação: devolve o index do cache (app de página única), com rede como reserva.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await cacheMatch('./');
      if (cached) return unredirect(cached);
      try { return await fetch(req); } catch { return new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }

  // Arquivos do app: cache primeiro; o que não estiver no cache vem da rede e é guardado.
  event.respondWith((async () => {
    const cached = await cacheMatch(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});
