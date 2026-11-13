-- Pruebas de comportamiento de la migración 122 (libro financiero).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/libro_122.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK: no deja datos.

begin;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;
-- Paridad con las revocaciones explícitas de las migraciones (se reaplican tras el grant masivo).
revoke insert, update, delete, truncate on public.libro_movimiento from authenticated, service_role;
revoke all on public.conexion_pago_negocio, public.oauth_estado, public.conexion_pago_evento from authenticated, anon;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'duenoA@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'duenoB@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'cliente@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'su@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'A'), ('00000000-0000-0000-0000-0000000000a2', 'B'),
  ('00000000-0000-0000-0000-0000000000a3', 'C'), ('00000000-0000-0000-0000-0000000000a4', 'S')
on conflict (id) do nothing;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000000000a4';
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 'libro-a', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'B', 'libro-b', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S', 'D', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.conexion_pago_negocio (id, negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'CONECTADA', 'SANDBOX', '111', 'v1.a.b.c', now() + interval '180 days', now());
update public.negocio set comision_plataforma_pct = 5 where id = '00000000-0000-0000-0000-0000000000b1';

-- Reserva con anticipo (requiere aceptación de la política) y su pago.
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '3 days', now() + interval '3 days 1 hour', 'PENDIENTE_PAGO', 50000, 10000);
insert into public.aceptacion_politica_reserva (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, zona_horaria, monto_sena, hora_inicio_reserva)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1',
        '{"total_horas":24,"parcial_horas":2,"parcial_pct":50}', 't', 'v', 'America/Bogota', 10000, now() + interval '3 days');
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1',
        'SENA', 10000, 'PENDIENTE', 'MERCADOPAGO');

do $$ begin
  if not exists (select 1 from public.libro_movimiento where idempotency_key = 'reserva:00000000-0000-0000-0000-0000000000d1:RESERVA_CREADA') then
    raise exception 'FALLA 122: la reserva creada no quedó en el libro';
  end if;
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e1'
                  and evento = 'PAGO_PENDIENTE' and sentido = 'INFORMATIVO') then
    raise exception 'FALLA 122: el pago pendiente no quedó como informativo';
  end if;
  raise notice 'OK 122: reserva y pago pendiente registrados (sin efecto económico)';
end $$;

-- Aprobación por la vía real (aplicar_evento_pago), y la misma notificación repetida 3 veces.
do $$
declare n int; c public.libro_movimiento;
begin
  perform public.aplicar_evento_pago('00000000-0000-0000-0000-0000000000e1', '777001', 'APROBADO', '{}'::jsonb);
  perform public.aplicar_evento_pago('00000000-0000-0000-0000-0000000000e1', '777001', 'APROBADO', '{}'::jsonb);
  perform public.aplicar_evento_pago('00000000-0000-0000-0000-0000000000e1', '777001', 'APROBADO', '{}'::jsonb);
  select count(*) into n from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e1' and evento = 'PAGO_CONFIRMADO';
  if n <> 1 then raise exception 'FALLA 122: webhooks repetidos duplicaron el pago confirmado (% filas)', n; end if;
  select * into c from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e1' and evento = 'PAGO_CONFIRMADO';
  if c.sentido <> 'INGRESO' or c.estado <> 'CONFIRMADO' or c.id_externo <> '777001' or c.categoria <> 'ANTICIPO'
     or c.entidad <> 'NEGOCIO' or c.proveedor <> 'MERCADOPAGO' or c.monto <> 10000 then
    raise exception 'FALLA 122: pago confirmado mal registrado: %', row_to_json(c);
  end if;
  select count(*) into n from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e1' and categoria = 'COMISION_PLATAFORMA';
  if n <> 2 then raise exception 'FALLA 122: la comisión debe registrarse para negocio (egreso) y plataforma (ingreso): %', n; end if;
  raise notice 'OK 122: pago confirmado con evidencia, comisión en ambas entidades, sin duplicados';
end $$;

-- Pago en línea "aprobado" sin id de transacción → no se registra como confirmado.
insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', 'GIFT_CARD', 30000, 'APROBADO', 'MERCADOPAGO');
do $$ begin
  if exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e2' and estado = 'CONFIRMADO') then
    raise exception 'FALLA 122: un pago sin evidencia del proveedor quedó confirmado';
  end if;
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e2' and evento = 'PAGO_SIN_EVIDENCIA') then
    raise exception 'FALLA 122: el pago sin evidencia no quedó en revisión';
  end if;
  raise notice 'OK 122: sin evidencia del proveedor no hay pago confirmado';
end $$;

-- Pago rechazado.
insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b1', 'MEMBRESIA', 40000, 'PENDIENTE', 'MERCADOPAGO');
update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = '777003' where id = '00000000-0000-0000-0000-0000000000e3';
do $$ begin
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e3' and evento = 'PAGO_FALLIDO' and sentido = 'INFORMATIVO') then
    raise exception 'FALLA 122: el pago fallido no quedó registrado';
  end if;
  raise notice 'OK 122: pago fallido registrado sin efecto económico';
end $$;

-- Ingreso de StylerNow: plan pagado por el negocio A.
insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b1', 'SUSCRIPCION', 139900, 'PENDIENTE', 'MERCADOPAGO');
update public.pago set estado = 'APROBADO', id_transaccion_pasarela = '777004', procesado_at = now() where id = '00000000-0000-0000-0000-0000000000e4';
do $$ begin
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e4'
                  and entidad = 'PLATAFORMA' and categoria = 'INGRESO_PLATAFORMA' and sentido = 'INGRESO') then
    raise exception 'FALLA 122: el ingreso de StylerNow no quedó en su libro';
  end if;
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e4'
                  and entidad = 'NEGOCIO' and categoria = 'PAGO_A_STYLERNOW' and sentido = 'EGRESO') then
    raise exception 'FALLA 122: el negocio no ve su pago a StylerNow';
  end if;
  raise notice 'OK 122: ingresos de StylerNow separados de los del negocio';
end $$;

-- Venta en el local (efectivo): del negocio, proveedor LOCAL.
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'SALDO', 40000, 'APROBADO', 'EFECTIVO');
do $$ begin
  if not exists (select 1 from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e5'
                  and categoria = 'VENTA_LOCAL' and proveedor = 'LOCAL' and estado = 'CONFIRMADO') then
    raise exception 'FALLA 122: la venta en el local no quedó registrada';
  end if;
  raise notice 'OK 122: venta en el local registrada';
end $$;

-- Reembolso: solicitado → fallido → confirmado (vía las funciones reales del 116).
do $$
declare v_id uuid; n int;
begin
  v_id := public._reembolso_crear('00000000-0000-0000-0000-0000000000e1', 10000, 100, 'CANCELACION_NEGOCIO', 'CANCELACION_NEGOCIO', 'BARBERIA');
  perform public.reembolso_tomar_pendientes(10);
  perform public.reembolso_registrar_resultado(v_id, null, null, 'saldo insuficiente');
  if exists (select 1 from public.libro_movimiento where reembolso_id = v_id and evento = 'REEMBOLSO_CONFIRMADO') then
    raise exception 'FALLA 122: un reembolso fallido figura como confirmado';
  end if;
  update public.reembolso set estado = 'SOLICITADO' where id = v_id;
  perform public.reembolso_registrar_resultado(v_id, 'approved', '888', null);
  perform public.reembolso_registrar_resultado(v_id, 'approved', '888', null);
  select count(*) into n from public.libro_movimiento where reembolso_id = v_id and evento = 'REEMBOLSO_CONFIRMADO' and sentido = 'EGRESO';
  if n <> 1 then raise exception 'FALLA 122: reembolso confirmado % veces', n; end if;
  if not exists (select 1 from public.libro_movimiento where reembolso_id = v_id and evento = 'REEMBOLSO_SOLICITADO')
     or not exists (select 1 from public.libro_movimiento where reembolso_id = v_id and evento = 'REEMBOLSO_FALLIDO') then
    raise exception 'FALLA 122: falta la trazabilidad solicitado/fallido';
  end if;
  if not exists (select 1 from public.libro_movimiento where reembolso_id = v_id and pago_id = '00000000-0000-0000-0000-0000000000e1'
                  and reserva_id = '00000000-0000-0000-0000-0000000000d1') then
    raise exception 'FALLA 122: el reembolso no quedó ligado al pago y a la reserva';
  end if;
  raise notice 'OK 122: reembolso trazable (solicitado, fallido, confirmado una sola vez) ligado a pago y reserva';
end $$;

-- Inmutabilidad para todos los roles de API.
set local role service_role;
do $$ begin
  begin
    update public.libro_movimiento set monto = 1 where true;
    raise exception 'FALLA 122: service_role modificó el libro';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    delete from public.libro_movimiento where true;
    raise exception 'FALLA 122: service_role borró el libro';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    insert into public.libro_movimiento (idempotency_key, entidad, negocio_id, categoria, evento, sentido, estado, monto, ocurrido_at, referencia_tipo, referencia_id)
    values ('x', 'NEGOCIO', '00000000-0000-0000-0000-0000000000b1', 'AJUSTE', 'AJUSTE', 'INGRESO', 'CONFIRMADO', 1, now(), 'x', gen_random_uuid());
    raise exception 'FALLA 122: service_role insertó en el libro directamente';
  exception when others then
    if sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'OK 122: libro inmutable y sin escritura directa';
end $$;
reset role;

-- Aislamiento: dueño B no ve nada de A; dueño A no ve el libro de StylerNow.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.libro_movimiento where negocio_id = '00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FALLA 122: el negocio B ve movimientos del negocio A';
  end if;
  if exists (select 1 from public.libro_totales('00000000-0000-0000-0000-0000000000b1')) then
    raise exception 'FALLA 122: los totales filtran datos ajenos';
  end if;
  begin
    perform public.libro_registrar_ajuste((select id from public.libro_movimiento limit 1), 1, 'INGRESO', 'x');
    raise exception 'FALLA 122: un negocio registró un ajuste';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 122: un negocio no ve ni ajusta el libro de otro';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare n int; t numeric;
begin
  select count(*) into n from public.libro_movimiento where entidad = 'PLATAFORMA';
  if n > 0 then raise exception 'FALLA 122: un negocio ve el libro de StylerNow'; end if;
  select count(*) into n from public.libro_movimiento where negocio_id = '00000000-0000-0000-0000-0000000000b1';
  if n = 0 then raise exception 'FALLA 122: el negocio A no ve sus propios movimientos'; end if;
  select coalesce(sum(total), 0) into t from public.libro_totales('00000000-0000-0000-0000-0000000000b1', null, null, 'ANTICIPO', 'CONFIRMADO');
  if t <> 10000 then raise exception 'FALLA 122: total de anticipos confirmados esperado 10000, fue %', t; end if;
  raise notice 'OK 122: el negocio ve solo lo suyo y los totales cuadran';
end $$;
reset role;

-- SuperSU: ve todo y corrige con ajustes vinculados al original.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
do $$
declare v_orig uuid; v_aj uuid; n int;
begin
  select count(*) into n from public.libro_movimiento where entidad = 'PLATAFORMA';
  if n = 0 then raise exception 'FALLA 122: SuperSU no ve el libro de StylerNow'; end if;
  select id into v_orig from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000e5' and estado = 'CONFIRMADO';
  begin
    perform public.libro_registrar_ajuste(v_orig, 1000, 'EGRESO', '');
    raise exception 'FALLA 122: ajuste sin motivo aceptado';
  exception when others then
    if sqlerrm not like '%MOTIVO_REQUERIDO%' then raise; end if;
  end;
  v_aj := public.libro_registrar_ajuste(v_orig, 1000, 'EGRESO', 'Corrección: el valor real del servicio fue 39.000');
  if not exists (select 1 from public.libro_movimiento where id = v_aj and ajusta_movimiento_id = v_orig and categoria = 'AJUSTE') then
    raise exception 'FALLA 122: el ajuste no quedó vinculado al original';
  end if;
  if (select monto from public.libro_movimiento where id = v_orig) <> 40000 then
    raise exception 'FALLA 122: el ajuste alteró el movimiento original';
  end if;
  raise notice 'OK 122: SuperSU ve todo; las correcciones son ajustes vinculados y el original se conserva';
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public.libro_movimiento limit 1;
    raise exception 'FALLA 122: anon lee el libro';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 122: anon no accede al libro';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 122 PASARON'; end $$;
rollback;
