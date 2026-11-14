-- Pruebas de la migración 131 (índices de FK, RLS sin reevaluación por fila, código de referido).
-- Base LOCAL, con ROLLBACK:
--   docker cp tests/sql/rendimiento_131.sql supabase_db_stylernow:/tmp/t.sql
--   docker exec supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/t.sql
begin;

do $$
declare n int;
begin
  select count(*) into n from pg_constraint c join pg_namespace s on s.oid = c.connamespace
   where c.contype = 'f' and s.nspname = 'public'
     and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
                     and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey);
  if n <> 0 then raise exception 'FALLA 131: % claves foráneas sin índice', n; end if;

  select count(*) into n from pg_policies where schemaname = 'public'
     and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                        '\( SELECT auth\.(uid|jwt|role)\(\) AS \1\)', '', 'g') ~ 'auth\.(uid|jwt|role)\(\)';
  if n <> 0 then raise exception 'FALLA 131: % políticas evalúan auth.*() por fila', n; end if;
  raise notice 'OK 131: FKs indexadas y RLS con auth.*() evaluado una vez';
end $$;

-- Código de referido: idempotente, y si el código de 8 caracteres ya es de otro cliente se alarga.
do $$
declare a uuid := gen_random_uuid(); b uuid; r1 public.referido_codigo; r2 public.referido_codigo;
begin
  -- b comparte los primeros 8 hex de a (colisión forzada del código corto).
  b := (left(replace(a::text, '-', ''), 8) || '-0000-4000-8000-000000000000')::uuid;
  insert into auth.users (id, email, aud, role) values
    (a, 'ref-a-' || a || '@t.l', 'authenticated', 'authenticated'),
    (b, 'ref-b-' || b || '@t.l', 'authenticated', 'authenticated');
  insert into public.perfil (id, nombre) values (a, 'Ref A'), (b, 'Ref B') on conflict (id) do nothing;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r1 := public.obtener_mi_codigo_referido();
  r2 := public.obtener_mi_codigo_referido();
  if r1.id <> r2.id or length(r1.codigo) <> 8 then raise exception 'FALLA 131: el código no es estable %/%', r1, r2; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r2 := public.obtener_mi_codigo_referido();
  if r2.codigo = r1.codigo or length(r2.codigo) <= 8 then raise exception 'FALLA 131: la colisión no se resolvió %', r2; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.obtener_mi_codigo_referido();
    raise exception 'FALLA 131: sin sesión no debe crear código';
  exception when others then
    if sqlerrm not like '%NO_AUTENTICADO%' then raise; end if;
  end;
  raise notice 'OK 131: código de referido estable, sin colisiones y solo con sesión';
end $$;

rollback;
