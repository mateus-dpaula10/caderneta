// Configuração da sincronização (opcional) com o Supabase.
// Só a chave PÚBLICA ("publishable") pode ficar aqui: ela identifica o projeto e, sozinha, não dá acesso
// a dado nenhum (o banco exige login + RLS: cada pessoa só lê e grava as próprias linhas).
// NUNCA coloque aqui a chave secreta / service_role.

export const SUPABASE_URL = 'https://vujhnbiohitufdjpdbvq.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Mt-0LqMiEwJq_Uv2Uf9ygw__FDmEN79';

// O projeto Supabase hospeda outros apps: as tabelas e funções da Caderneta ficam no schema próprio
// "caderneta" (precisa estar em Data API → Exposed schemas). O login (auth) é comum aos apps do projeto.
export const SUPABASE_SCHEMA = 'caderneta';

// Cliente oficial empacotado no próprio app (funciona offline e é cacheado pelo service worker).
// Caminho relativo a esta pasta (js/). Ao trocar a versão, atualize também a lista SHELL do sw.js.
export const SUPABASE_LIB = 'vendor/supabase-js-2.117.2.umd.js';

// ExcelJS (planilha modelo e importação .xlsx), empacotado no app do mesmo jeito: só é carregado quando a pessoa
// baixa ou importa uma planilha. Ao trocar a versão, atualize também a lista SHELL do sw.js.
export const EXCELJS_LIB = 'vendor/exceljs-4.4.0.min.js';

// Onde o supabase-js guarda a sessão (localStorage). Fica fora das tabelas sincronizadas.
export const AUTH_STORAGE_KEY = 'caderneta:auth';

// Para o texto de privacidade.
export const SERVER_REGION_LABEL = 'Supabase, servidor em São Paulo (Brasil)';
