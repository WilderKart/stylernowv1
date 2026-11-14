-- Pruebas de la migración 133 (prueba sin cobro automático, pago del plan por Checkout Pro, mora con gracia).
-- Base LOCAL, con ROLLBACK:
--   docker cp tests/sql/suscripcion_133.sql supabase_db_stylernow:/tmp/t.sql
--   docker exec supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/t.sql
begin;

-- Paridad con producción (el CLI local no da privilegios por defecto).
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

create temp table _f (k text primary key, v uuid);
insert into _f values ('dueno', gen_random_uuid()), ('intruso', gen_random_uuid()), ('neg', gen_random_uuid());

do $$
declare d uuid := (select v from _f where k='dueno'); i uuid := (select v from _f where k='intruso'); n uuid := (select v from _f where k='neg');
begin
  insert into auth.users (id, email, aud, role) values
    (d, 'd133-' || d || '@t.l', 'authenticated', 'authenticated'), (i, 'i133-' || i || '@t.l', 'authenticated', 'authenticated');
  insert into public.perfil (id, nombre) values (d, 'Dueño 133'), (i, 'Intruso 133') on conflict (id) do nothing;
  insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
  values (n, d, 'Barbería 133 (prueba)', 's133-' || left(n::text, 8), 'Cali', 'CO');
  -- Si la alta no creó la suscripción, se crea la de prueba.
  insert into public.suscripcion (negocio_id, plan_codigo, estado, pais_codigo, prueba_inicio, prueba_fin, fecha_proximo_cobro)
  select n, 'ESSENTIAL', 'TRIAL', 'CO', now() - interval '15 days', now() - interval '1 hour', now() - interval '1 hour'
  where not exists (select 1 from public.suscripcion where negocio_id = n);
  update public.suscripcion set estado = 'TRIAL', plan_codigo = 'ESSENTIAL', prueba_inicio = now() - interval '15 days',
         prueba_fin = now() - interval '1 hour', metodo_pago_ref = null, activacion_manual = false, fecha_proximo_cobro = now() - interval '1 hour'
   where negocio_id = n;
  update public.negocio set estado = 'ACTIVO', plan_codigo = 'ESSENTIAL' where id = n;
end $$;

-- 1 · Prueba vencida → EN_MORA con la gracia configurada; sigue recibiendo reservas.
do $$
declare n uuid := (select v from _f where k='neg'); s public.suscripcion; g int;
begin
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  select suscripcion_gracia_dias into g from public.configuracion_plataforma where id;
  if s.estado <> 'EN_MORA' or s.gracia_fin < now() + make_interval(days => g) - interval '1 minute' then
    raise exception 'FALLA 133: la prueba vencida debe entrar en gracia %', row_to_json(s);
  end if;
  if not public.negocio_puede_recibir_reservas(n) then raise exception 'FALLA 133: en gracia debe seguir recibiendo reservas'; end if;
  -- Gracia vencida sin plan pagado → REQUIERE_PLAN y sin reservas.
  update public.suscripcion set gracia_fin = now() - interval '1 minute' where negocio_id = n;
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  if s.estado <> 'REQUIERE_PLAN' then raise exception 'FALLA 133: tras la gracia debe requerir plan, quedó %', s.estado; end if;
  if public.negocio_puede_recibir_reservas(n) then raise exception 'FALLA 133: sin plan no debe recibir reservas'; end if;
  raise notice 'OK 133: prueba → gracia → requiere plan';
end $$;

-- 2 · Solo el dueño solicita el pago; monto calculado en la base; cuenta de StylerNow; idempotente.
do $$
declare n uuid := (select v from _f where k='neg'); d uuid := (select v from _f where k='dueno'); i uuid := (select v from _f where k='intruso');
        p1 public.pago; p2 public.pago;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', i, 'role', 'authenticated')::text, true);
  begin
    perform public.solicitar_pago_plan(n, 'STUDIO');
    raise exception 'FALLA 133: un intruso solicitó el pago';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  begin
    perform public.solicitar_pago_plan(n, 'SIGNATURE');
    raise exception 'FALLA 133: Signature debe requerir cotización';
  exception when others then if sqlerrm not like '%PLAN_REQUIERE_COTIZACION%' then raise; end if; end;

  p1 := public.solicitar_pago_plan(n, 'STUDIO');
  p2 := public.solicitar_pago_plan(n, 'STUDIO');
  if p1.id <> p2.id then raise exception 'FALLA 133: la segunda solicitud debe reutilizar el pago pendiente'; end if;
  if p1.monto <> 139900 or p1.tipo <> 'SUSCRIPCION' or p1.estado <> 'PENDIENTE' then raise exception 'FALLA 133: pago incorrecto %', row_to_json(p1); end if;
  select * into p1 from public.pago where id = p1.id;
  if p1.cuenta_cobro <> 'PLATAFORMA' or p1.conexion_pago_id is not null then
    raise exception 'FALLA 133: el pago del plan debe ir a la cuenta de StylerNow %', row_to_json(p1);
  end if;
  insert into _f values ('pago1', p1.id);
  raise notice 'OK 133: solicitud solo del dueño, monto de la base, cuenta de StylerNow, idempotente';
end $$;

-- 3 · Pago aprobado (vía aplicar_evento_pago, como el webhook) → ACTIVA con periodo nuevo; reintento sin doble efecto.
do $$
declare n uuid := (select v from _f where k='neg'); p uuid := (select v from _f where k='pago1'); s public.suscripcion; s2 public.suscripcion;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.aplicar_evento_pago(p, '9133001', 'APROBADO', '{}'::jsonb);
  select * into s from public.suscripcion where negocio_id = n;
  if s.estado <> 'ACTIVA' or s.plan_codigo <> 'STUDIO' or s.fecha_proximo_cobro < now() + interval '27 days' or s.gracia_fin is not null then
    raise exception 'FALLA 133: el pago debe activar el plan %', row_to_json(s);
  end if;
  if (select plan_codigo from public.negocio where id = n) <> 'STUDIO' then raise exception 'FALLA 133: negocio sin el plan pagado'; end if;
  if not public.negocio_puede_recibir_reservas(n) then raise exception 'FALLA 133: activo debe recibir reservas'; end if;
  perform public.aplicar_evento_pago(p, '9133001', 'APROBADO', '{}'::jsonb);
  select * into s2 from public.suscripcion where negocio_id = n;
  if s2.fecha_proximo_cobro <> s.fecha_proximo_cobro then raise exception 'FALLA 133: un reintento extendió el periodo dos veces'; end if;
  if (select count(*) from public.evento_auditoria where negocio_id = n and accion = 'PLAN_PAGADO') <> 1 then
    raise exception 'FALLA 133: debe haber exactamente un PLAN_PAGADO';
  end if;
  raise notice 'OK 133: pago aprobado activa el plan una sola vez';
end $$;

-- 4 · Renovación: anticipada solo en los 7 días previos y sin perder días; vencida → gracia → suspendida → reactivable.
do $$
declare n uuid := (select v from _f where k='neg'); d uuid := (select v from _f where k='dueno'); s public.suscripcion; p public.pago; fin timestamptz;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  begin
    perform public.solicitar_pago_plan(n);
    raise exception 'FALLA 133: no debe renovar con un mes por delante';
  exception when others then if sqlerrm not like '%AUN_NO_TOCA_RENOVAR%' then raise; end if; end;

  update public.suscripcion set fecha_proximo_cobro = now() + interval '3 days' where negocio_id = n;
  select fecha_proximo_cobro into fin from public.suscripcion where negocio_id = n;
  p := public.solicitar_pago_plan(n);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.aplicar_evento_pago(p.id, '9133002', 'APROBADO', '{}'::jsonb);
  select * into s from public.suscripcion where negocio_id = n;
  if s.fecha_inicio_ciclo <> fin or s.fecha_proximo_cobro <> fin + interval '1 month' then
    raise exception 'FALLA 133: la renovación anticipada debe sumarse al periodo vigente %', row_to_json(s);
  end if;

  -- Periodo vencido → gracia → suspendida por impago.
  update public.suscripcion set fecha_proximo_cobro = now() - interval '1 minute' where negocio_id = n;
  perform public.mantenimiento_suscripciones();
  if (select estado from public.suscripcion where negocio_id = n) <> 'EN_MORA' then raise exception 'FALLA 133: periodo vencido debe entrar en gracia'; end if;
  update public.suscripcion set gracia_fin = now() - interval '1 minute' where negocio_id = n;
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  if s.estado <> 'SUSPENDIDA' or s.suspendido_causa <> 'IMPAGO' then raise exception 'FALLA 133: tras la gracia de un plan pagado debe suspenderse %', row_to_json(s); end if;

  -- Pagar reactiva.
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  p := public.solicitar_pago_plan(n);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.aplicar_evento_pago(p.id, '9133003', 'APROBADO', '{}'::jsonb);
  select * into s from public.suscripcion where negocio_id = n;
  if s.estado <> 'ACTIVA' or s.suspendido_causa is not null or s.fecha_proximo_cobro < now() + interval '27 days' then
    raise exception 'FALLA 133: el pago debe reactivar %', row_to_json(s);
  end if;
  raise notice 'OK 133: renovación anticipada, mora, suspensión y reactivación';
end $$;

-- 5 · Permisos: las funciones internas no son invocables por la API.
do $$
begin
  if has_function_privilege('anon', 'public.solicitar_pago_plan(uuid,public.plan_codigo,text)', 'execute') then raise exception 'FALLA 133: anon solicita pagos'; end if;
  if has_function_privilege('authenticated', 'public._precio_plan_ciclo(uuid,public.plan_codigo,text)', 'execute') then raise exception 'FALLA 133: precio interno expuesto'; end if;
  if has_function_privilege('authenticated', 'public.mantenimiento_suscripciones()', 'execute') then raise exception 'FALLA 133: mantenimiento expuesto'; end if;
  raise notice 'OK 133: funciones internas solo para service_role';
end $$;

rollback;
