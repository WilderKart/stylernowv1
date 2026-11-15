-- Los catálogos que son públicos «por diseño» (sede, servicio, combos, recursos, excepciones de horario, ofertas) solo deben serlo
-- mientras el negocio está ACTIVO. Con el negocio B en PENDIENTE_APROBACION / SUSPENDIDO / CANCELADO, un tercero no debe ver NADA de B;
-- su dueño sí (control). Base LOCAL con seed_pruebas + seed_tablas_sin_datos; cada estado se prueba dentro de una transacción con ROLLBACK.
\set ON_ERROR_STOP 1
\set NEG '00000000-0000-0000-0006-0000000001b0'
begin;
grant select on all tables in schema public to service_role;
create temp table _v (estado text, actor text, tabla text, filas int);
grant all on _v to authenticated, anon;
create or replace function pg_temp.medir(p_estado text, p_actor text, p_email text, p_rol text) returns void language plpgsql as $$
declare t text; n int; v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  execute format('set local role %I', p_rol);
  perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role', p_rol)::text end, true);
  foreach t in array array['sede','servicio','servicio_combo','recurso_tipo','oferta_negocio'] loop
    begin
      execute format('select count(*) from public.%I where negocio_id = %L', t, current_setting('seed.neg')) into n;
    exception when insufficient_privilege then n := 0; -- sin permiso de tabla para ese rol (p. ej. anon en oferta_negocio): no ve nada
    end;
    insert into _v values (p_estado, p_actor, t, n);
  end loop;
  -- tablas cuyo vínculo es la sede
  execute format('select count(*) from public.recurso r join public.sede s on s.id = r.sede_id where s.negocio_id = %L', current_setting('seed.neg')) into n;
  insert into _v values (p_estado, p_actor, 'recurso', n);
  execute format('select count(*) from public.sede_horario_excepcion e join public.sede s on s.id = e.sede_id where s.negocio_id = %L', current_setting('seed.neg')) into n;
  insert into _v values (p_estado, p_actor, 'sede_horario_excepcion', n);
  reset role;
end $$;
select set_config('seed.neg', :'NEG', false) \gset
\o /dev/null
do $$
declare e text;
begin
  foreach e in array array['ACTIVO','PENDIENTE_APROBACION','SUSPENDIDO','CANCELADO'] loop
    execute format('update public.negocio set estado = %L where id = current_setting(''seed.neg'')::uuid', e);
    perform pg_temp.medir(e, 'anonimo',  'no-existe@pruebas.test', 'anon');
    perform pg_temp.medir(e, 'intruso',  'intruso@pruebas.test', 'authenticated');
    perform pg_temp.medir(e, 'dueno-a',  'dueno-a@pruebas.test', 'authenticated');
    perform pg_temp.medir(e, 'dueno-b',  'dueno-b@pruebas.test', 'authenticated');
  end loop;
end $$;
\o
\echo '== filas de B visibles según el estado del negocio (anon/intruso/dueño de A deben ver 0 salvo con B ACTIVO) =='
select estado, actor, sum(filas) as filas_visibles, string_agg(tabla || '=' || filas, ' ' order by tabla) filter (where filas > 0) as detalle from _v group by estado, actor order by estado, actor;
do $$
declare v_mal int; v_ctrl int;
begin
  select count(*) into v_mal from _v where estado <> 'ACTIVO' and actor in ('anonimo','intruso','dueno-a') and filas > 0;
  select count(*) into v_ctrl from _v where estado <> 'ACTIVO' and actor = 'dueno-b' and filas > 0;
  if v_mal > 0 then raise exception 'FALLA: % lecturas de B por terceros con el negocio NO activo', v_mal; end if;
  if v_ctrl < 5 then raise exception 'FALLA del control: el dueño de B no ve sus propios datos con el negocio inactivo (%)', v_ctrl; end if;
  raise notice 'OK: con B inactivo los terceros no ven nada y el dueño sí (% tablas con datos para el dueño)', v_ctrl;
end $$;
rollback;
