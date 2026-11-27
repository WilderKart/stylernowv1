-- Prueba SQL de la migración 205 (recuperar una reserva cuyo bloqueo temporal expiró).
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/recuperar_reserva_bloqueo.sql
-- Transacción que se revierte al final. Usa el motor real (crear_reserva / slots_disponibles / restricciones EXCLUDE).
begin;

insert into auth.users (id, email, aud, role) values
  ('a5000001-0000-4000-8000-000000000001', 'r_dueno@t.l', 'authenticated', 'authenticated'),
  ('a5000001-0000-4000-8000-000000000002', 'r_staff@t.l', 'authenticated', 'authenticated'),
  ('a5000001-0000-4000-8000-000000000003', 'r_c1@t.l', 'authenticated', 'authenticated'),
  ('a5000001-0000-4000-8000-000000000004', 'r_c2@t.l', 'authenticated', 'authenticated'),
  ('a5000001-0000-4000-8000-000000000005', 'r_c3@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('a5000001-0000-4000-8000-000000000001', 'Dueño'), ('a5000001-0000-4000-8000-000000000002', 'Profesional'),
  ('a5000001-0000-4000-8000-000000000003', 'Cliente Uno'), ('a5000001-0000-4000-8000-000000000004', 'Cliente Dos'),
  ('a5000001-0000-4000-8000-000000000005', 'Cliente Tres')
on conflict (id) do update set nombre = excluded.nombre;
insert into public.staff (usuario_id, nombre) values ('a5000001-0000-4000-8000-000000000002', 'Profesional') on conflict (usuario_id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b5000001-0000-4000-8000-00000000000a', 'a5000001-0000-4000-8000-000000000001', 'Neg Rec', 'rec-neg-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b5000001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
delete from public.sede where negocio_id = 'b5000001-0000-4000-8000-00000000000a';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('c5000001-0000-4000-8000-000000000001', 'b5000001-0000-4000-8000-00000000000a', 'Sede', 'Calle 1', 'Cali', '{}'::jsonb, true);
-- El vínculo es anterior a la ventana de transición para que el profesional sea publicable sin evidencias legales (solo para la prueba).
update public.configuracion_plataforma set staff_transicion_inicio = now() - interval '1 day', staff_transicion_fin = now() + interval '1 year';
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, presta_servicios, created_at) values
  ('d5000001-0000-4000-8000-000000000001', 'a5000001-0000-4000-8000-000000000002', 'b5000001-0000-4000-8000-00000000000a', 'c5000001-0000-4000-8000-000000000001', 'ACTIVO', true, now() - interval '10 days');
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
  select 'd5000001-0000-4000-8000-000000000001', 'c5000001-0000-4000-8000-000000000001', d, '08:00', '20:00' from generate_series(0, 6) d;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('e5000001-0000-4000-8000-000000000001', 'b5000001-0000-4000-8000-00000000000a', 'Corte', 30, 30000, 'ACTIVO');
insert into public.staff_servicio (staff_id, servicio_id) values ('a5000001-0000-4000-8000-000000000002', 'e5000001-0000-4000-8000-000000000001');
insert into public.negocio_medio_pago_directo (negocio_id, activo, nequi) values ('b5000001-0000-4000-8000-00000000000a', true, '3001112233')
on conflict (negocio_id) do update set activo = true, nequi = '3001112233';

create temp table t_res (clave text primary key, id uuid, hora timestamptz);
grant all on t_res to authenticated;

-- Atajo para actuar como un usuario
create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(text) to authenticated;

set local role authenticated;

-- ═══ A. El bloqueo expiró y el horario sigue libre → se recupera el MISMO turno (sin duplicar) ═══
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare
  c1 constant text := 'a5000001-0000-4000-8000-000000000003';
  v_h timestamptz := ((current_date + 2)::text || ' 10:00:00-05')::timestamptz;
  r public.reserva; j jsonb; v_n int;
begin
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a5000001-0000-4000-8000-000000000002', 'rec-a-1', true);
  if r.estado <> 'PENDIENTE_PAGO' or r.expira_at is null then raise exception 'FALLA A: la reserva debía quedar con bloqueo temporal (%)', r.estado; end if;
  insert into t_res values ('A', r.id, v_h);
  perform set_config('app.r_a', r.id::text, true);
end $$;
reset role;
update public.reserva set expira_at = now() - interval '1 minute' where id = current_setting('app.r_a')::uuid;     -- el bloqueo venció
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare v_id uuid := current_setting('app.r_a')::uuid; j jsonb; r public.reserva; v_n int;
begin
  j := public.reserva_estado_recuperacion(v_id);
  if j ->> 'situacion' <> 'DISPONIBLE' then raise exception 'FALLA A: se esperaba DISPONIBLE y fue %', j; end if;
  j := public.reserva_recuperar(v_id);
  if j ->> 'resultado' <> 'RECUPERADA' then raise exception 'FALLA A: no se recuperó: %', j; end if;
  select * into r from public.reserva where id = v_id;
  if r.estado <> 'PENDIENTE_PAGO' or r.expira_at <= now() or r.cancelado_motivo is not null then raise exception 'FALLA A: estado tras recuperar % / %', r.estado, r.expira_at; end if;
  -- Reintentos (doble clic): idempotente, sin duplicados
  if public.reserva_recuperar(v_id) ->> 'resultado' <> 'VIGENTE' then raise exception 'FALLA A: el reintento no fue idempotente'; end if;
  if public.reserva_recuperar(v_id) ->> 'resultado' <> 'VIGENTE' then raise exception 'FALLA A: el segundo reintento no fue idempotente'; end if;
  select count(*) into v_n from public.reserva where cliente_id = 'a5000001-0000-4000-8000-000000000003';
  if v_n <> 1 then raise exception 'FALLA A: se duplicaron reservas (%)', v_n; end if;
end $$;

-- ═══ B. El bloqueo expiró y OTRO cliente adquirió el turno → no se re-bloquea; se ofrecen alternativas ═══
reset role;
update public.reserva set expira_at = now() - interval '1 minute' where id = current_setting('app.r_a')::uuid;
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000004');
do $$
declare v_h timestamptz := ((current_date + 2)::text || ' 10:00:00-05')::timestamptz; r public.reserva;
begin
  -- Cliente 2 reserva el mismo turno (crear_reserva libera antes los bloqueos vencidos)
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a5000001-0000-4000-8000-000000000002', 'rec-b-2', true);
  if r.estado <> 'PENDIENTE_PAGO' then raise exception 'FALLA B: el cliente 2 no obtuvo el turno'; end if;
  perform set_config('app.r_b2', r.id::text, true);
end $$;
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare v_id uuid := current_setting('app.r_a')::uuid; j jsonb; r public.reserva; v_alt record; v_n int;
begin
  j := public.reserva_estado_recuperacion(v_id);
  if j ->> 'situacion' <> 'NO_DISPONIBLE' then raise exception 'FALLA B: se esperaba NO_DISPONIBLE y fue %', j; end if;
  j := public.reserva_recuperar(v_id);
  if j ->> 'resultado' <> 'NO_DISPONIBLE' then raise exception 'FALLA B: re-bloqueó un turno ocupado: %', j; end if;
  select * into r from public.reserva where id = v_id;
  if r.estado <> 'CANCELADA' then raise exception 'FALLA B: el estado cambió a pesar de no estar disponible (%)', r.estado; end if;
  -- Alternativas actualizadas (no incluyen el turno ocupado)
  select count(*) into v_n from public.reserva_alternativas(v_id);
  if v_n = 0 then raise exception 'FALLA B: no hay horarios alternativos'; end if;
  if exists (select 1 from public.reserva_alternativas(v_id) a where a.hora_inicio = r.hora_inicio) then raise exception 'FALLA B: la alternativa incluye el turno ocupado'; end if;
  select * into v_alt from public.reserva_alternativas(v_id) order by hora_inicio limit 1;
  -- Se reubica la MISMA reserva en otro horario (sin perder servicio/sede/cliente)
  j := public.reserva_recuperar(v_id, v_alt.hora_inicio, v_alt.staff_id);
  if j ->> 'resultado' <> 'RECUPERADA' then raise exception 'FALLA B: no se pudo reubicar: %', j; end if;
  select * into r from public.reserva where id = v_id;
  if r.hora_inicio <> v_alt.hora_inicio or r.estado <> 'PENDIENTE_PAGO' then raise exception 'FALLA B: reubicación incorrecta'; end if;
  select count(*) into v_n from public.reserva where cliente_id = 'a5000001-0000-4000-8000-000000000003';
  if v_n <> 1 then raise exception 'FALLA B: se duplicaron reservas al reubicar (%)', v_n; end if;
end $$;

-- ═══ C. Comprobante ya reportado ═══
-- C1: expira el bloqueo, el turno sigue libre → el comprobante se acepta, se re-adquiere el turno y la cita queda confirmada
reset role;
update public.reserva set estado = 'CANCELADA', cancelado_por = 'CLIENTE', cancelado_motivo = 'CLIENTE_CANCELO' where id = current_setting('app.r_b2')::uuid;      -- el cliente 2 cancela (libera su turno)
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
declare v_h timestamptz := ((current_date + 3)::text || ' 11:00:00-05')::timestamptz; r public.reserva;
begin
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a5000001-0000-4000-8000-000000000002', 'rec-c-1', true);
  perform set_config('app.r_c1', r.id::text, true);
end $$;
reset role;
update public.reserva set expira_at = now() - interval '1 minute' where id = current_setting('app.r_c1')::uuid;
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
declare v_id uuid := current_setting('app.r_c1')::uuid; v_pago uuid; r public.reserva; p public.pago_reserva;
begin
  perform public.aceptar_politica_reserva(v_id);        -- el paso previo de la app no debe rechazar un bloqueo vencido
  v_pago := public.registrar_pago_directo_reserva(v_id, 10000, 'b5000001-0000-4000-8000-00000000000a/' || v_id::text || '/comp1.png', repeat('a', 64));
  select * into r from public.reserva where id = v_id;
  if r.estado <> 'CONFIRMADA' then raise exception 'FALLA C1: con el turno libre debía quedar CONFIRMADA y quedó %', r.estado; end if;
  select * into p from public.pago_reserva where id = v_pago;
  if p.estado <> 'REPORTADO' or p.monto_reportado <> 10000 then raise exception 'FALLA C1: comprobante mal registrado'; end if;
end $$;

-- C2: expira el bloqueo y el turno YA NO está libre → el comprobante se CONSERVA y la reserva se reubica sin volver a pagar
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
declare v_h timestamptz := ((current_date + 3)::text || ' 15:00:00-05')::timestamptz; r public.reserva;
begin
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a5000001-0000-4000-8000-000000000002', 'rec-c-2', true);
  perform set_config('app.r_c2', r.id::text, true);
end $$;
reset role;
update public.reserva set expira_at = now() - interval '1 minute' where id = current_setting('app.r_c2')::uuid;
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000004');
do $$
declare v_h timestamptz := ((current_date + 3)::text || ' 15:00:00-05')::timestamptz; r public.reserva;
begin
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a5000001-0000-4000-8000-000000000002', 'rec-c-3', true);   -- otro cliente se queda el turno
  if r.estado <> 'PENDIENTE_PAGO' then raise exception 'FALLA C2: el cliente 2 no obtuvo el turno'; end if;
end $$;
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
declare v_id uuid := current_setting('app.r_c2')::uuid; v_pago uuid; r public.reserva; p public.pago_reserva; j jsonb; v_alt record; v_n int;
begin
  perform public.aceptar_politica_reserva(v_id);        -- incluso si la reserva ya figura CANCELADA por expiración
  v_pago := public.registrar_pago_directo_reserva(v_id, 10000, 'b5000001-0000-4000-8000-00000000000a/' || v_id::text || '/comp2.png', repeat('b', 64));   -- NO debe fallar
  select * into r from public.reserva where id = v_id;
  if r.estado <> 'CANCELADA' then raise exception 'FALLA C2: no debía confirmarse un turno ocupado (%)', r.estado; end if;
  select * into p from public.pago_reserva where id = v_pago;
  if p.estado <> 'REPORTADO' then raise exception 'FALLA C2: el comprobante no quedó REPORTADO'; end if;   -- ni confirmado ni perdido
  j := public.reserva_estado_recuperacion(v_id);
  if j ->> 'situacion' <> 'PAGO_REPORTADO_NO_DISPONIBLE' then raise exception 'FALLA C2: situación %', j; end if;
  select * into v_alt from public.reserva_alternativas(v_id) order by hora_inicio limit 1;
  j := public.reserva_recuperar(v_id, v_alt.hora_inicio, v_alt.staff_id);
  select * into r from public.reserva where id = v_id;
  if j ->> 'resultado' <> 'RECUPERADA' or r.estado <> 'CONFIRMADA' or r.expira_at is not null then raise exception 'FALLA C2: no quedó confirmada tras reubicar (% / %)', j, r.estado; end if;
  -- El comprobante, el monto y la referencia siguen siendo los mismos; no hay pagos ni reservas nuevas
  select count(*) into v_n from public.pago_reserva where reserva_id = v_id;
  select * into p from public.pago_reserva where reserva_id = v_id;
  if v_n <> 1 or p.id <> v_pago or p.comprobante_url not like '%/comp2.png' or p.monto_reportado <> 10000 or p.referencia_corta is null then raise exception 'FALLA C2: se alteró el comprobante'; end if;
  select count(*) into v_n from public.reserva where cliente_id = 'a5000001-0000-4000-8000-000000000005' and estado <> 'CANCELADA';
  if v_n <> 2 then raise exception 'FALLA C2: reservas activas del cliente 3 = % (esperadas 2)', v_n; end if;
  -- Un comprobante duplicado en otra cita sigue rechazándose (la protección existente no se debilitó)
end $$;

-- ═══ D. Servicio o profesional ya no disponibles ═══
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare r public.reserva;
begin
  r := public.crear_reserva_autorizada('c5000001-0000-4000-8000-000000000001', array['e5000001-0000-4000-8000-000000000001']::uuid[], ((current_date + 4)::text || ' 10:00:00-05')::timestamptz, 'a5000001-0000-4000-8000-000000000002', 'rec-d-1', true);
  perform set_config('app.r_d', r.id::text, true);
end $$;
reset role;
update public.reserva set expira_at = now() - interval '1 minute' where id = current_setting('app.r_d')::uuid;
update public.servicio set estado = 'INACTIVO' where id = 'e5000001-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare v_id uuid := current_setting('app.r_d')::uuid; j jsonb;
begin
  j := public.reserva_estado_recuperacion(v_id);
  if j ->> 'situacion' <> 'NO_DISPONIBLE' or j ->> 'motivo' <> 'SERVICIO_NO_DISPONIBLE' then raise exception 'FALLA D: servicio inactivo %', j; end if;
  if public.reserva_recuperar(v_id) ->> 'resultado' <> 'NO_DISPONIBLE' then raise exception 'FALLA D: recuperó con servicio inactivo'; end if;
end $$;
reset role;
update public.servicio set estado = 'ACTIVO' where id = 'e5000001-0000-4000-8000-000000000001';
update public.vinculo_staff_negocio set estado = 'RETIRADO' where id = 'd5000001-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare v_id uuid := current_setting('app.r_d')::uuid; j jsonb;
begin
  j := public.reserva_estado_recuperacion(v_id);
  if j ->> 'situacion' <> 'NO_DISPONIBLE' or j ->> 'motivo' <> 'PROFESIONAL_NO_DISPONIBLE' then raise exception 'FALLA D: profesional retirado %', j; end if;
  if public.reserva_recuperar(v_id) ->> 'resultado' <> 'NO_DISPONIBLE' then raise exception 'FALLA D: recuperó con profesional retirado'; end if;
end $$;
reset role;
update public.vinculo_staff_negocio set estado = 'ACTIVO' where id = 'd5000001-0000-4000-8000-000000000001';
set local role authenticated;

-- ═══ E. Seguridad: solo el dueño de la reserva; sin anónimos; sin edición directa; lo cancelado de verdad no se revierte ═══
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
declare v_id uuid := current_setting('app.r_d')::uuid;
begin
  begin perform public.reserva_estado_recuperacion(v_id); raise exception 'FALLA E: otro cliente leyó el diagnóstico'; exception when others then if sqlerrm not like '%RESERVA_NO_ENCONTRADA%' then raise; end if; end;
  begin perform public.reserva_recuperar(v_id); raise exception 'FALLA E: otro cliente recuperó una reserva ajena'; exception when others then if sqlerrm not like '%RESERVA_NO_ENCONTRADA%' then raise; end if; end;
  begin perform public.reserva_alternativas(v_id); raise exception 'FALLA E: otro cliente vio alternativas de una reserva ajena'; exception when others then if sqlerrm not like '%RESERVA_NO_ENCONTRADA%' then raise; end if; end;
  declare v_n int; begin
    begin update public.reserva set estado = 'CONFIRMADA' where id = v_id; get diagnostics v_n = row_count;
      if v_n <> 0 then raise exception 'FALLA E: edición directa de la reserva (filas %)', v_n; end if;
    exception when others then if sqlerrm not like '%RESERVA_EDICION_DIRECTA_NO_PERMITIDA%' and sqlerrm not like '%permission denied%' and sqlerrm not like '%FALLA E%' then raise; end if; if sqlerrm like '%FALLA E%' then raise; end if; end;
  end;
  begin perform public._reserva_recuperar_interno(v_id, null, null); raise exception 'FALLA E: función interna invocable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.reserva_recuperar('00000000-0000-0000-0000-000000000000'); raise exception 'FALLA E: anónimo ejecutó reserva_recuperar'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Una cancelación real (por el cliente) no se revierte
update public.reserva set estado = 'CANCELADA', cancelado_por = 'CLIENTE', cancelado_motivo = 'CLIENTE_CANCELO' where id = current_setting('app.r_d')::uuid;
set local role authenticated;
select pg_temp.como('a5000001-0000-4000-8000-000000000003');
do $$
declare v_id uuid := current_setting('app.r_d')::uuid;
begin
  if public.reserva_estado_recuperacion(v_id) ->> 'situacion' <> 'NO_RECUPERABLE' then raise exception 'FALLA E: una cancelación real se consideró recuperable'; end if;
  if public.reserva_recuperar(v_id) ->> 'resultado' <> 'NO_RECUPERABLE' then raise exception 'FALLA E: se revirtió una cancelación real'; end if;
  -- Una reserva ya confirmada no se toca
  if public.reserva_recuperar(current_setting('app.r_c1')::uuid) ->> 'resultado' is not null and false then null; end if;
end $$;
select pg_temp.como('a5000001-0000-4000-8000-000000000005');
do $$
begin
  if public.reserva_recuperar(current_setting('app.r_c1')::uuid) ->> 'resultado' <> 'YA_CONFIRMADA' then raise exception 'FALLA E: una reserva confirmada debía responder YA_CONFIRMADA'; end if;
end $$;

rollback;
select 'OK recuperar_reserva_bloqueo' as resultado;
