-- Prueba SQL de la migración 210 (evidencia de la «Información importante» del pago directo).
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/aceptacion_info_pago_directo.sql
-- Transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('a8000001-0000-4000-8000-000000000001', 'i_dueno@t.l', 'authenticated', 'authenticated'),
  ('a8000001-0000-4000-8000-000000000002', 'i_staff@t.l', 'authenticated', 'authenticated'),
  ('a8000001-0000-4000-8000-000000000003', 'i_c1@t.l', 'authenticated', 'authenticated'),
  ('a8000001-0000-4000-8000-000000000004', 'i_c2@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('a8000001-0000-4000-8000-000000000001', 'Dueño'), ('a8000001-0000-4000-8000-000000000002', 'Profesional'),
  ('a8000001-0000-4000-8000-000000000003', 'Cliente Uno'), ('a8000001-0000-4000-8000-000000000004', 'Cliente Dos')
on conflict (id) do update set nombre = excluded.nombre;
insert into public.staff (usuario_id, nombre) values ('a8000001-0000-4000-8000-000000000002', 'Profesional') on conflict (usuario_id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b8000001-0000-4000-8000-00000000000a', 'a8000001-0000-4000-8000-000000000001', 'Neg Info', 'info-neg-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b8000001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
delete from public.sede where negocio_id = 'b8000001-0000-4000-8000-00000000000a';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('c8000001-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-00000000000a', 'Sede', 'Calle 1', 'Cali', '{}'::jsonb, true);
update public.configuracion_plataforma set staff_transicion_inicio = now() - interval '1 day', staff_transicion_fin = now() + interval '1 year';
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, presta_servicios, created_at) values
  ('d8000001-0000-4000-8000-000000000001', 'a8000001-0000-4000-8000-000000000002', 'b8000001-0000-4000-8000-00000000000a', 'c8000001-0000-4000-8000-000000000001', 'ACTIVO', true, now() - interval '10 days');
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
  select 'd8000001-0000-4000-8000-000000000001', 'c8000001-0000-4000-8000-000000000001', d, '08:00', '20:00' from generate_series(0, 6) d;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('e8000001-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-00000000000a', 'Corte', 30, 30000, 'ACTIVO');
insert into public.staff_servicio (staff_id, servicio_id) values ('a8000001-0000-4000-8000-000000000002', 'e8000001-0000-4000-8000-000000000001');
insert into public.negocio_medio_pago_directo (negocio_id, activo, nequi, llave_breb) values ('b8000001-0000-4000-8000-00000000000a', true, '3001112233', '@neg-info')
on conflict (negocio_id) do update set activo = true, nequi = '3001112233', llave_breb = '@neg-info';

create temp table t_r (n int, ok boolean, detalle text);
grant all on t_r to authenticated, anon;
create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(text) to authenticated;

set local role authenticated;
select pg_temp.como('a8000001-0000-4000-8000-000000000003');
do $$
declare
  v_h timestamptz := ((current_date + 2)::text || ' 10:00:00-05')::timestamptz;
  r public.reserva;
begin
  r := public.crear_reserva_autorizada('c8000001-0000-4000-8000-000000000001', array['e8000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a8000001-0000-4000-8000-000000000002', 'info-1', true);
  perform set_config('app.r1', r.id::text, true);
  insert into t_r values (0, r.estado = 'PENDIENTE_PAGO', 'reserva creada');
end $$;

-- 2) Otra persona no puede registrar la aceptación de una reserva ajena.
select pg_temp.como('a8000001-0000-4000-8000-000000000004');
do $$
declare v_msg text;
begin
  begin perform public.aceptar_informacion_pago_directo(current_setting('app.r1')::uuid);
  exception when others then v_msg := sqlerrm; end;
  insert into t_r values (2, coalesce(v_msg, '') like '%RESERVA_NO_ENCONTRADA%', coalesce(v_msg, 'aceptó una reserva ajena'));
end $$;

-- 3) El cliente dueño sí; es idempotente (mismo id) y queda UNA fila.
select pg_temp.como('a8000001-0000-4000-8000-000000000003');
do $$
declare v_a uuid; v_b uuid;
begin
  v_a := public.aceptar_informacion_pago_directo(current_setting('app.r1')::uuid);
  v_b := public.aceptar_informacion_pago_directo(current_setting('app.r1')::uuid);
  insert into t_r values (3, v_a is not null and v_a = v_b and (select count(*) from public.aceptacion_info_pago_directo where reserva_id = current_setting('app.r1')::uuid) = 1, 'aceptación idempotente');
end $$;
reset role;

-- 1) La exigencia viene APAGADA por defecto (compatibilidad con el código anterior a esta migración).
insert into t_r select 1, not exigir_info_pago_directo, 'exigencia apagada por defecto' from public.configuracion_plataforma limit 1;

-- 4) La evidencia guarda el texto exacto, el destino del dinero y los montos.
insert into t_r select 4, a.texto_aceptado = public.texto_info_pago_directo()
    and a.destino ->> 'nequi' = '3001112233' and a.destino ->> 'llave_breb' = '@neg-info'
    and a.monto_sena > 0 and a.monto_total = 30000 and a.version_texto = md5(public.texto_info_pago_directo()),
  'texto exacto, cuenta de destino y montos'
  from public.aceptacion_info_pago_directo a where a.reserva_id = current_setting('app.r1')::uuid;

-- 5) Se copió al repositorio de evidencias legales.
insert into t_r select 5, count(*) = 1, 'evidencia legal creada'
  from public.evidencia_legal where documento = 'INFORMACION_PAGO_DIRECTO' and referencia_id = current_setting('app.r1')::uuid and accion = 'ACEPTA' and rol = 'CLIENTE';

-- 6) Inmutable para quien no es administrador de la base; anon no puede ejecutar ni leer.
set local role authenticated;
select pg_temp.como('a8000001-0000-4000-8000-000000000003');
do $$
declare v_msg text;
begin
  begin update public.aceptacion_info_pago_directo set texto_aceptado = 'otro' where reserva_id = current_setting('app.r1')::uuid;
  exception when others then v_msg := sqlerrm; end;
  insert into t_r values (6, v_msg is not null or (select texto_aceptado from public.aceptacion_info_pago_directo where reserva_id = current_setting('app.r1')::uuid) <> 'otro', coalesce(v_msg, 'update sin efecto'));
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.aceptar_informacion_pago_directo(current_setting('app.r1')::uuid); insert into t_r values (7, false, 'anon ejecutó');
  exception when insufficient_privilege then insert into t_r values (7, true, 'anon sin permiso'); end;
end $$;
reset role;

-- 8) Con la exigencia ENCENDIDA, un pago directo sin aceptación es rechazado; con aceptación, pasa.
update public.configuracion_plataforma set exigir_info_pago_directo = true;
set local role authenticated;
select pg_temp.como('a8000001-0000-4000-8000-000000000003');
do $$
declare
  v_h timestamptz := ((current_date + 3)::text || ' 10:00:00-05')::timestamptz;
  r2 public.reserva; v_msg text; v_id uuid;
begin
  r2 := public.crear_reserva_autorizada('c8000001-0000-4000-8000-000000000001', array['e8000001-0000-4000-8000-000000000001']::uuid[], v_h, 'a8000001-0000-4000-8000-000000000002', 'info-2', true);
  begin
    perform public.registrar_pago_directo_reserva(r2.id, 10000, 'b8000001-0000-4000-8000-00000000000a/' || r2.id || '/x.jpg', repeat('a', 64));
  exception when others then v_msg := sqlerrm; end;
  insert into t_r values (8, coalesce(v_msg, '') like '%INFO_PAGO_DIRECTO_NO_ACEPTADA%', coalesce(v_msg, 'registró sin aceptación'));
  perform public.aceptar_informacion_pago_directo(r2.id);
  v_msg := null;
  begin
    v_id := public.registrar_pago_directo_reserva(r2.id, 10000, 'b8000001-0000-4000-8000-00000000000a/' || r2.id || '/x.jpg', repeat('b', 64));
  exception when others then v_msg := sqlerrm; end;
  insert into t_r values (9, v_id is not null, coalesce(v_msg, 'pago directo registrado con la aceptación'));
end $$;
reset role;

select n, case when ok then 'OK' else 'FALLA' end resultado, detalle from t_r order by n;
do $$ begin if exists (select 1 from t_r where not ok) then raise exception 'HAY PRUEBAS FALLIDAS'; end if; end $$;
rollback;
