-- Fase 1 (T3) — Session Version en el JWT (migración 181).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/session_version_181.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.
-- Verifica que el hook inyecta `session_version`, que sigue el valor de `perfil` y que no
-- es invocable por anon/authenticated.

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'sv@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000f1', 'SV') on conflict (id) do nothing;
update public.perfil set session_version = 1 where id = '00000000-0000-0000-0000-0000000000f1';

do $$
declare
  v_out jsonb;
  v_ver int;
begin
  v_out := public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-0000000000f1', 'claims', '{}'::jsonb));
  v_ver := (v_out -> 'claims' ->> 'session_version')::int;
  if v_ver <> 1 then raise exception 'FALLA: hook no inyectó session_version=1 (dio %)', v_ver; end if;

  perform public.incrementar_session_version('00000000-0000-0000-0000-0000000000f1');
  v_out := public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-0000000000f1', 'claims', '{}'::jsonb));
  v_ver := (v_out -> 'claims' ->> 'session_version')::int;
  if v_ver <> 2 then raise exception 'FALLA: hook no reflejó el incremento (dio %)', v_ver; end if;

  raise notice 'OK: el hook refleja el session_version actual (%)', v_ver;
end $$;

do $$
declare v text;
begin
  select string_agg(p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'custom_access_token_hook'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if v is not null then raise exception 'FALLA: custom_access_token_hook es ejecutable por anon/authenticated'; end if;
  raise notice 'OK: el hook no es invocable por anon/authenticated';
end $$;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE SESSION VERSION PASARON'; end $$;
rollback;
