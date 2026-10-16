-- =====================================================================
-- Caderneta — banco no Supabase
-- Como usar: Supabase > SQL Editor > New query > colar este arquivo > Run.
-- Pode rodar de novo sem estragar nada (idempotente).
-- =====================================================================
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

-- ---------------------------------------------------------------------
-- Gatilho comum: carimba o horário do servidor e aplica "o mais recente vence"
-- ---------------------------------------------------------------------
create or replace function public.caderneta_before_write()
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
    execute format($f$
      create table if not exists public.%1$I (
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        id text not null check (char_length(id) between 1 and 120),
        data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
        deleted boolean not null default false,
        client_updated_at timestamptz not null default now(),
        server_updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )
    $f$, t);

    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);

    execute format('drop trigger if exists caderneta_before_write on public.%I', t);
    execute format('create trigger caderneta_before_write before insert or update on public.%I
                    for each row execute function public.caderneta_before_write()', t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "dono lê" on public.%I', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated
                    using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    -- Sem DELETE direto: exclusão é "deleted = true" (para sincronizar). Apagar de verdade
    -- acontece só ao excluir a conta (cascade a partir de auth.users).
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Colunas legíveis nos lançamentos (para ver e filtrar no painel do Supabase).
-- São calculadas a partir do JSON; o app não precisa mandá-las.
-- ---------------------------------------------------------------------
alter table public.transactions
  add column if not exists type text generated always as (data ->> 'type') stored,
  add column if not exists amount_cents bigint generated always as ((data ->> 'amount')::bigint) stored,
  add column if not exists date text generated always as (data ->> 'date') stored,
  add column if not exists category_id text generated always as (data ->> 'categoryId') stored;

alter table public.goals
  add column if not exists name text generated always as (data ->> 'name') stored,
  add column if not exists target_cents bigint generated always as ((data ->> 'target')::bigint) stored,
  add column if not exists saved_cents bigint generated always as ((data ->> 'saved')::bigint) stored;

-- Validação mínima no servidor (o app já valida; isto barra dado torto vindo de fora).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_valid') then
    alter table public.transactions add constraint transactions_valid check (
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
-- Chamada pelo app: supabase.rpc('delete_my_account')
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
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

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.caderneta_before_write() from public, anon, authenticated;
