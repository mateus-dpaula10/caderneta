-- =====================================================================
-- Caderneta: sai do schema public para o schema próprio "caderneta".
-- O projeto Supabase ("apps") passa a hospedar outros apps; cada app no seu schema.
--
-- O que faz (dados, índices, constraints, colunas geradas, RLS, policies, grants e
-- triggers vão junto com a tabela no ALTER TABLE ... SET SCHEMA):
--   1. cria o schema caderneta (uso: authenticated e service_role; anon não precisa)
--   2. move caderneta_before_write e as 5 tabelas para caderneta
--   3. cria caderneta.delete_my_account (mesmo corpo; public.delete_my_account continua)
--   4. ponte para versões antigas do app (PWA em cache chama .from('transactions') no public):
--      views public.<tabela> = select * from caderneta.<tabela>, security_invoker
--      (RLS e grants da tabela valem para quem chama). Upsert ON CONFLICT funciona pela view.
--   5. avisa o PostgREST para recarregar o schema
--
-- Pode rodar de novo sem estragar nada (idempotente). Tudo numa transação.
-- public.ping (keep-alive) e public.rls_auto_enable ficam no public.
-- Rollback: 2026-10-27-schema-caderneta-rollback.sql
-- =====================================================================

begin;

-- Não esperar indefinidamente por lock: se o app estiver gravando, falha e tenta-se de novo.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create schema if not exists caderneta;
grant usage on schema caderneta to authenticated, service_role;

-- Gatilho comum (os triggers apontam pelo OID: continuam ligados depois de mover).
do $$
begin
  if exists (select 1 from pg_proc where oid = to_regprocedure('public.caderneta_before_write()'))
     and to_regprocedure('caderneta.caderneta_before_write()') is null then
    alter function public.caderneta_before_write() set schema caderneta;
  end if;
end;
$$;

-- Tabelas
do $$
declare
  t text;
begin
  foreach t in array array['meta', 'categories', 'transactions', 'recurrences', 'goals'] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      if to_regclass('caderneta.' || quote_ident(t)) is not null then
        raise exception 'public.% e caderneta.% existem como tabela: resolver na mão', t, t;
      end if;
      execute format('alter table public.%I set schema caderneta', t);
    end if;
  end loop;
end;
$$;

-- LGPD: mesmo corpo de public.delete_my_account (apaga a conta inteira; cascade nos dados).
-- A decisão de restringir aos dados da Caderneta ainda está com o dono do projeto.
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

-- Ponte para o app antigo: views no public com o mesmo nome das tabelas.
do $$
declare
  t text;
begin
  foreach t in array array['meta', 'categories', 'transactions', 'recurrences', 'goals'] loop
    execute format('create or replace view public.%1$I with (security_invoker = true)
                    as select * from caderneta.%1$I', t);
    execute format('comment on view public.%1$I is %2$L', t,
      'Ponte de compatibilidade para versões antigas do app Caderneta. Dados em caderneta.' || t || '.');
    -- Os default privileges do public dariam algo a anon/service_role: deixar igual à tabela.
    execute format('revoke all on public.%I from anon, authenticated, service_role, public', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
