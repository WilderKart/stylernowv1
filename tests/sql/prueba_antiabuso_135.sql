-- Pruebas de la migración 135 (antiabuso de la prueba gratuita por red y equipo). Base LOCAL, con ROLLBACK:
--   docker cp tests/sql/prueba_antiabuso_135.sql supabase_db_stylernow:/tmp/t.sql
--   docker exec supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/t.sql
begin;

create temp table _n (i int primary key, dueno uuid, neg uuid);

-- Cinco negocios de dueños distintos, sin suscripción.
do $$
declare d uuid; n uuid;
begin
  for k in 1..5 loop
    d := gen_random_uuid(); n := gen_random_uuid();
    insert into auth.users (id, email, aud, role) values (d, 'p135-' || d || '@t.l', 'authenticated', 'authenticated');
    insert into public.perfil (id, nombre) values (d, 'Dueño 135') on conflict (id) do nothing;
    insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
    values (n, d, 'Neg 135 ' || k, 'p135-' || left(n::text, 8), 'Cali', 'CO');
    delete from public.suscripcion where negocio_id = n;
    insert into _n values (k, d, n);
  end loop;
end $$;

create or replace function pg_temp.h(t text) returns text language sql as $$ select encode(sha256(t::bytea), 'hex') $$;
create or replace function pg_temp.iniciar(k int, ip text, equipo text, disp text) returns text language plpgsql as $$
declare r record;
begin
  select * into r from _n where i = k;
  perform public.iniciar_prueba_negocio_srv2(r.dueno, r.neg, 'ESSENTIAL', 'MENSUAL', null, null,
    pg_temp.h('tel' || k), pg_temp.h('doc' || k), pg_temp.h('mail' || k), pg_temp.h(disp),
    pg_temp.h(ip), pg_temp.h(equipo));
  return 'OK';
exception when others then
  return sqlerrm;
end $$;

do $$
declare r text;
begin
  r := pg_temp.iniciar(1, 'red-A', 'equipo-1', 'disp-1');
  if r <> 'OK' then raise exception 'FALLA 135: la primera prueba debía pasar: %', r; end if;

  -- Misma red y mismo equipo, aunque cambien teléfono, documento, correo y dispositivo (incógnito): bloqueada.
  r := pg_temp.iniciar(2, 'red-A', 'equipo-1', 'disp-2');
  if r not like '%PRUEBA_YA_USADA%' then raise exception 'FALLA 135: misma red y equipo debía bloquearse: %', r; end if;

  -- Misma red, otro equipo (otra persona en la misma red del operador): permitida.
  r := pg_temp.iniciar(3, 'red-A', 'equipo-3', 'disp-3');
  if r <> 'OK' then raise exception 'FALLA 135: misma red con otro equipo debía pasar: %', r; end if;
  r := pg_temp.iniciar(4, 'red-A', 'equipo-4', 'disp-4');
  if r <> 'OK' then raise exception 'FALLA 135: tercera prueba en la red debía pasar: %', r; end if;

  -- Cuarta prueba desde la misma red en 30 días: bloqueada.
  r := pg_temp.iniciar(5, 'red-A', 'equipo-5', 'disp-5');
  if r not like '%PRUEBA_YA_USADA%' then raise exception 'FALLA 135: la cuarta en la misma red debía bloquearse: %', r; end if;

  -- Mismo dispositivo desde otra red: bloqueada (regla de 118, ahora con cookie).
  r := pg_temp.iniciar(5, 'red-B', 'equipo-5', 'disp-1');
  if r not like '%PRUEBA_YA_USADA%' then raise exception 'FALLA 135: el mismo dispositivo debía bloquearse: %', r; end if;

  -- Sin huellas válidas: rechazada.
  begin
    perform public.iniciar_prueba_negocio_srv2((select dueno from _n where i = 5), (select neg from _n where i = 5),
      'ESSENTIAL', 'MENSUAL', null, null, pg_temp.h('t'), pg_temp.h('d'), pg_temp.h('m'), pg_temp.h('x'), 'corta', pg_temp.h('e'));
    raise exception 'FALLA 135: una huella de red inválida debía rechazarse';
  exception when others then if sqlerrm not like '%VERIFICACION_INCOMPLETA%' then raise; end if; end;

  if has_function_privilege('authenticated',
       'public.iniciar_prueba_negocio_srv2(uuid,uuid,public.plan_codigo,text,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'FALLA 135: la función no debe ser invocable desde la API';
  end if;
  raise notice 'OK 135: red+equipo, límite por red, dispositivo y permisos';
end $$;

rollback;
