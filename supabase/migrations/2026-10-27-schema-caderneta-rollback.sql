-- =====================================================================
-- Rollback de 2026-10-27-schema-caderneta.sql: volta a Caderneta para o schema public.
-- Os dados vão junto com as tabelas (nada é copiado nem apagado).
-- Só use se o app ainda não depende do schema caderneta (versão nova do app chama
-- .schema('caderneta')); depois de voltar, tirar "caderneta" de Exposed schemas.
-- Idempotente. Tudo numa transação.
-- =====================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  t text;
begin
  foreach t in array array['meta', 'categories', 'transactions', 'recurrences', 'goals'] loop
    -- 1. tira a view-ponte do public (só se for view: nunca derrubar uma tabela aqui)
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'v') then
      execute format('drop view public.%I', t);
    end if;
    -- 2. devolve a tabela ao public
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'caderneta' and c.relname = t and c.relkind = 'r') then
      if to_regclass('public.' || quote_ident(t)) is not null then
        raise exception 'public.% já existe: resolver na mão', t;
      end if;
      execute format('alter table caderneta.%I set schema public', t);
    end if;
  end loop;

  if to_regprocedure('caderneta.caderneta_before_write()') is not null
     and to_regprocedure('public.caderneta_before_write()') is null then
    alter function caderneta.caderneta_before_write() set schema public;
  end if;
end;
$$;

-- public.delete_my_account nunca saiu do lugar; a cópia no caderneta some.
drop function if exists caderneta.delete_my_account();

-- Sem "cascade": se algo novo foi criado no schema, falha em vez de apagar.
drop schema if exists caderneta;

notify pgrst, 'reload schema';

commit;
