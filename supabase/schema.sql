-- =====================================================================
-- Caderneta — banco no Supabase
-- Como usar: Supabase > SQL Editor > New query > colar este arquivo > Run.
-- Pode rodar de novo sem estragar nada (idempotente).
-- Depois: Data API (Settings > API) > Exposed schemas > incluir "caderneta".
-- =====================================================================
--
-- O projeto Supabase hospeda vários apps: cada um no seu schema. A Caderneta fica no schema
-- "caderneta"; o login (auth.users) é comum aos apps do projeto. No public fica só o ping (keep-alive).
-- Instalação antiga, com as tabelas ainda no public: este arquivo as move para caderneta (com os dados).
-- Para manter versões antigas do app funcionando, rode também
-- migrations/2026-10-27-schema-caderneta.sql (cria as views-ponte public.<tabela>).
--
-- Cada tabela espelha uma "store" do IndexedDB do app, para a sincronização ser simples
-- e o app continuar funcionando offline:
--   user_id            dono do registro (preenchido pelo login)
--   id                 o mesmo id que o registro tem no aparelho
--   data               o registro inteiro, do jeito que o app guarda (JSON)
--   deleted            exclusão lógica: a exclusão precisa chegar aos outros aparelhos
--   client_updated_at  quando o registro mudou no aparelho; em conflito, o mais recente vence
--   server_updated_at  quando chegou aqui; o app baixa só o que mudou desde a última vez
--
-- Segurança: RLS ligado em todas as tabelas. Cada pessoa só lê e grava as próprias linhas.
-- O papel "anon" (visitante sem login) não tem acesso a nada.

create schema if not exists caderneta;
grant usage on schema caderneta to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Gatilho comum: carimba o horário do servidor e aplica "o mais recente vence"
-- ---------------------------------------------------------------------
do $$
begin
  -- Instalação antiga: a função estava no public.
  if to_regprocedure('public.caderneta_before_write()') is not null
     and to_regprocedure('caderneta.caderneta_before_write()') is null then
    alter function public.caderneta_before_write() set schema caderneta;
  end if;
end;
$$;

create or replace function caderneta.caderneta_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Relógio do aparelho adiantado não pode "travar" um registro no futuro.
  if new.client_updated_at > now() + interval '1 day' then
    new.client_updated_at := now();
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
      raise exception 'user_id e id não podem ser alterados';
    end if;
    -- Versão mais velha que a do servidor: ignora em silêncio (o aparelho baixa a nova depois).
    if new.client_updated_at < old.client_updated_at then
      return null;
    end if;
  end if;

  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabelas (mesma estrutura nas cinco)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['meta', 'categories', 'transactions', 'recurrences', 'goals'] loop
    -- Instalação antiga: a tabela estava no public (só se for tabela; a view-ponte fica onde está).
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r')
       and to_regclass('caderneta.' || quote_ident(t)) is null then
      execute format('alter table public.%I set schema caderneta', t);
    end if;

    execute format($f$
      create table if not exists caderneta.%1$I (
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        id text not null check (char_length(id) between 1 and 120),
        data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
        deleted boolean not null default false,
        client_updated_at timestamptz not null default now(),
        server_updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )
    $f$, t);

    execute format('create index if not exists %I on caderneta.%I (user_id, server_updated_at)', t || '_sync_idx', t);

    execute format('drop trigger if exists caderneta_before_write on caderneta.%I', t);
    execute format('create trigger caderneta_before_write before insert or update on caderneta.%I
                    for each row execute function caderneta.caderneta_before_write()', t);

    -- Fora do public o Supabase não liga RLS sozinho: ligar sempre aqui.
    execute format('alter table caderneta.%I enable row level security', t);

    execute format('drop policy if exists "dono lê" on caderneta.%I', t);
    execute format('create policy "dono lê" on caderneta.%I for select to authenticated
                    using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono cria" on caderneta.%I', t);
    execute format('create policy "dono cria" on caderneta.%I for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono altera" on caderneta.%I', t);
    execute format('create policy "dono altera" on caderneta.%I for update to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    -- Sem DELETE direto: exclusão é "deleted = true" (para sincronizar). Apagar de verdade
    -- acontece só ao excluir a conta (cascade a partir de auth.users).
    execute format('revoke all on caderneta.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update on caderneta.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Colunas legíveis nos lançamentos (para ver e filtrar no painel do Supabase).
-- São calculadas a partir do JSON; o app não precisa mandá-las.
-- ---------------------------------------------------------------------
alter table caderneta.transactions
  add column if not exists type text generated always as (data ->> 'type') stored,
  add column if not exists amount_cents bigint generated always as ((data ->> 'amount')::bigint) stored,
  add column if not exists date text generated always as (data ->> 'date') stored,
  add column if not exists category_id text generated always as (data ->> 'categoryId') stored;

alter table caderneta.goals
  add column if not exists name text generated always as (data ->> 'name') stored,
  add column if not exists target_cents bigint generated always as ((data ->> 'target')::bigint) stored,
  add column if not exists saved_cents bigint generated always as ((data ->> 'saved')::bigint) stored;

-- Validação mínima no servidor (o app já valida; isto barra dado torto vindo de fora).
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'transactions_valid' and conrelid = 'caderneta.transactions'::regclass) then
    alter table caderneta.transactions add constraint transactions_valid check (
      deleted or (
        (data ->> 'type') in ('income', 'expense')
        and (data ->> 'amount') ~ '^[0-9]{1,13}$' and (data ->> 'amount')::bigint > 0
        and (data ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
      )
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- LGPD: a pessoa pode excluir a própria conta e TODOS os dados (cascade).
-- Apaga o login (auth.users), que é comum aos apps do projeto: o app avisa isso antes de confirmar.
-- Chamada pelo app: supabase.rpc('delete_my_account') com o cliente no schema caderneta.
-- (public.delete_my_account, igual, continua existindo para versões antigas do app.)
-- ---------------------------------------------------------------------
create or replace function caderneta.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function caderneta.delete_my_account() from public, anon;
grant execute on function caderneta.delete_my_account() to authenticated;
revoke execute on function caderneta.caderneta_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Keep-alive: o plano grátis pausa o projeto após ~7 dias sem uso.
-- O GitHub Actions (.github/workflows/keepalive.yml) chama supabase.rpc('ping') 2x por semana.
-- Não lê nem grava dado nenhum: só faz o Postgres responder. Fica no public (serve ao projeto todo).
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

notify pgrst, 'reload schema';
