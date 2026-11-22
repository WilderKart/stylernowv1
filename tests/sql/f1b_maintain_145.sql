-- Fase 1B · MAINTAIN (migración 145). Prueba ANTES y DESPUÉS con roles reales (set local role) dentro de una transacción con ROLLBACK:
--  1) se emula el estado previo de producción (grant maintain a anon/authenticated) y se comprueba que el riesgo es REAL (LOCK/VACUUM/ANALYZE/REINDEX permitidos);
--  2) se aplica el cuerpo de 143; 3) los mismos comandos quedan DENEGADOS; 4) las operaciones legítimas (SELECT/INSERT/UPDATE/DELETE con RLS, RPC) siguen funcionando;
--  5) service_role conserva MAINTAIN. Base `limpia`, datos ficticios.
\set ON_ERROR_STOP 1
begin;
create temp table _r (fase text, actor text, caso text, esperado text, obtenido text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.intentar(p_fase text, p_rol text, p_caso text, p_esperado text, p_sql text) returns void language plpgsql as $$
declare v text;
begin
  begin
    execute format('set local role %I', p_rol);
    execute p_sql;
    v := 'PERMITIDO';
    raise exception 'REVERTIR';
  exception when others then
    if sqlerrm <> 'REVERTIR' then v := 'DENEGADO'; end if;
  end;
  insert into _r values (p_fase, p_rol, p_caso, p_esperado, v);
end $$;
grant select on all tables in schema public to authenticated;
-- Estado previo: privilegios por defecto de producción
grant maintain on all tables in schema public to anon, authenticated;
grant maintain on all tables in schema public to service_role;
\o /dev/null
-- REINDEX y CLUSTER fallan con error si falta MAINTAIN (ANALYZE solo emite un aviso y VACUUM no corre dentro de transacción: se miden aparte en 01_MAINTAIN.md)
select pg_temp.intentar('ANTES','anon','REINDEX TABLE reserva','PERMITIDO','reindex table public.reserva');
select pg_temp.intentar('ANTES','authenticated','REINDEX TABLE reserva','PERMITIDO','reindex table public.reserva');
select pg_temp.intentar('ANTES','authenticated','CLUSTER reserva','PERMITIDO','cluster public.reserva using reserva_pkey');
select pg_temp.intentar('ANTES','authenticated','REINDEX TABLE perfil','PERMITIDO','reindex table public.perfil');
select pg_temp.intentar('ANTES','authenticated','LOCK ACCESS EXCLUSIVE reserva (no depende de MAINTAIN)','PERMITIDO','lock table public.reserva in access exclusive mode');
\o
reset role;
-- Migración 143 (cuerpo copiado de supabase/migrations/145_quitar_maintain_a_roles_publicos.sql)
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke maintain on tables from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;
\o /dev/null
select pg_temp.intentar('DESPUES','anon','REINDEX TABLE reserva','DENEGADO','reindex table public.reserva');
select pg_temp.intentar('DESPUES','authenticated','REINDEX TABLE reserva','DENEGADO','reindex table public.reserva');
select pg_temp.intentar('DESPUES','authenticated','CLUSTER reserva','DENEGADO','cluster public.reserva using reserva_pkey');
select pg_temp.intentar('DESPUES','authenticated','REINDEX TABLE perfil','DENEGADO','reindex table public.perfil');
-- Residual conocido y medido: LOCK sigue permitido porque UPDATE/DELETE lo habilitan (no es MAINTAIN)
select pg_temp.intentar('DESPUES','authenticated','LOCK ACCESS EXCLUSIVE reserva (residual: lo habilita UPDATE/DELETE)','PERMITIDO','lock table public.reserva in access exclusive mode');
-- Operaciones legítimas
select pg_temp.intentar('DESPUES','authenticated','SELECT negocio (RLS)','PERMITIDO','select count(*) from public.negocio');
select pg_temp.intentar('DESPUES','authenticated','LOCK ROW SHARE (el que usa SELECT FOR UPDATE) sigue sin MAINTAIN: no se necesita','PERMITIDO','select 1 from public.perfil limit 1 for share');
select pg_temp.intentar('DESPUES','anon','SELECT con política pública (negocio)','PERMITIDO','select count(*) from public.negocio');
select pg_temp.intentar('DESPUES','authenticated','RPC de la app (is_supersu)','PERMITIDO','select public.is_supersu()');
select pg_temp.intentar('DESPUES','service_role','service_role conserva MAINTAIN (REINDEX)','PERMITIDO','reindex table public.reserva');
\o
reset role;
-- Verificación a nivel de catálogo: ninguna tabla de public conserva MAINTAIN para anon/authenticated y las tablas nuevas no lo heredan.
create table public._f1b_tabla_nueva(id int);
do $$
declare v int;
begin
  select count(*) into v from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where c.relkind in ('r','p') and (has_table_privilege('anon', c.oid, 'MAINTAIN') or has_table_privilege('authenticated', c.oid, 'MAINTAIN'));
  insert into _r values ('DESPUES', 'catalogo', 'tablas public con MAINTAIN para anon/authenticated (incluye tabla recién creada)', '0', v::text);
end $$;
\echo '== Fase 1B · MAINTAIN / 145 =='
select fase, actor, caso, esperado, obtenido, case when esperado = obtenido then 'ok' else '*** DIFIERE ***' end veredicto from _r order by fase desc, actor, caso;
do $$ declare v int; begin
  select count(*) into v from _r where esperado <> obtenido;
  if v > 0 then raise exception 'FALLA: % casos no coinciden', v; end if;
  raise notice 'OK: % casos coinciden', (select count(*) from _r);
end $$;
rollback;
