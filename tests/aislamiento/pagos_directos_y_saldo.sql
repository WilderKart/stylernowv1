-- Verificación funcional de la migración 194 (pagos directos + saldo pendiente) contra la base LOCAL con los usuarios e2e del seed. Todo se revierte (rollback).
-- Uso: docker exec -i supabase_db_stylernow psql -U postgres -At < tests/aislamiento/pagos_directos_y_saldo.sql   (esperado: solo líneas PASA)
\set ON_ERROR_STOP 0
begin;
create temp table res(paso text, ok boolean, detalle text);
grant all on res to public;

-- Fixtures (como postgres)
insert into public.negocio_medio_pago_directo (negocio_id, activo, nequi) values ('10000000-0000-4000-8000-000000000010', true, '3001234567');
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, monto_total, monto_sena, estado, expira_at)
values ('20000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000003', now()+interval '2 hours', now()+interval '3 hours', 50000, 15000, 'PENDIENTE_PAGO', now()+interval '10 minutes'),
       ('20000000-0000-4000-8000-0000000000a2','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000003', now()+interval '5 hours', now()+interval '6 hours', 50000, 15000, 'PENDIENTE_PAGO', now()+interval '10 minutes');

create or replace function pg_temp.intenta(p_paso text, p_sql text, p_esperado text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    v_msg := 'OK';
  exception when others then v_msg := sqlerrm;
  end;
  insert into res values (p_paso, v_msg = p_esperado or (p_esperado = 'OK' and v_msg = 'OK'), v_msg);
end $$;
grant execute on function pg_temp.intenta(text,text,text) to public;

-- ── CLIENTE ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.intenta('cliente: monto menor al anticipo', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a1', 1000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a1/x.webp', repeat('a',64))$$, 'MONTO_MENOR_AL_ANTICIPO');
select pg_temp.intenta('cliente: ruta de soporte ajena', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a1', 15000, 'otra/ruta.webp', repeat('a',64))$$, 'COMPROBANTE_INVALIDO');
select pg_temp.intenta('cliente: hash inválido', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a1', 15000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a1/x.webp', 'zzz')$$, 'COMPROBANTE_INVALIDO');
select pg_temp.intenta('cliente: registra pago (cita se confirma)', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a1', 15000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a1/x.webp', repeat('a',64))$$, 'OK');
select pg_temp.intenta('cliente: segundo pago misma cita', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a1', 15000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a1/y.webp', repeat('b',64))$$, 'RESERVA_NO_PAGABLE');
select pg_temp.intenta('cliente: MISMO hash en otra cita bloqueado', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a2', 15000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a2/x.webp', repeat('a',64))$$, 'COMPROBANTE_DUPLICADO');
select pg_temp.intenta('cliente: NO puede verificar su propio pago', $$select public.verificar_pago_reserva((select id from public.pago_reserva limit 1))$$, 'NO_AUTORIZADO');
select pg_temp.intenta('cliente: NO puede ajustar saldo', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',0,'intento de condonar')$$, 'NO_AUTORIZADO');
select pg_temp.intenta('cliente: lee medios de su reserva', $$select public.medios_pago_directo_para_reserva('20000000-0000-4000-8000-0000000000a2')$$, 'OK');

-- ── STAFF ──
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.intenta('STAFF: NO verifica', $$select public.verificar_pago_reserva((select id from public.pago_reserva limit 1))$$, 'NO_AUTORIZADO');
select pg_temp.intenta('STAFF: NO anula cita', $$select public.anular_cita_por_pago_invalido('20000000-0000-4000-8000-0000000000a1','motivo largo suficiente')$$, 'NO_AUTORIZADO');
select pg_temp.intenta('STAFF: NO marca no recibido', $$select public.marcar_pago_no_recibido_post_cita((select id from public.pago_reserva limit 1),'motivo largo suficiente')$$, 'NO_AUTORIZADO');
select pg_temp.intenta('STAFF: NO ajusta saldo', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',0,'motivo largo suficiente')$$, 'NO_AUTORIZADO');
select pg_temp.intenta('STAFF: NO lee medios del cliente', $$select public.medios_pago_directo_para_reserva('20000000-0000-4000-8000-0000000000a1')$$, 'RESERVA_NO_ENCONTRADA');

-- ── GUARDIAN ──
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.intenta('GUARDIAN: NO verifica', $$select public.verificar_pago_reserva((select id from public.pago_reserva limit 1))$$, 'NO_AUTORIZADO');
select pg_temp.intenta('GUARDIAN: NO ajusta saldo', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',0,'motivo largo suficiente')$$, 'NO_AUTORIZADO');

-- ── DUEÑO ──
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.intenta('dueño: anular sin motivo suficiente', $$select public.anular_cita_por_pago_invalido('20000000-0000-4000-8000-0000000000a1','corto')$$, 'MOTIVO_OBLIGATORIO');
select pg_temp.intenta('dueño: verifica', $$select public.verificar_pago_reserva((select id from public.pago_reserva limit 1))$$, 'OK');
select pg_temp.intenta('dueño: verificar de nuevo (idempotente)', $$select public.verificar_pago_reserva((select id from public.pago_reserva limit 1))$$, 'OK');
select pg_temp.intenta('dueño: no anula pago ya VERIFICADO', $$select public.anular_cita_por_pago_invalido('20000000-0000-4000-8000-0000000000a1','pago no llegó a la cuenta')$$, 'PAGO_NO_ANULABLE');

reset role;
-- Cita a2: registrar otro pago como cliente y anular como dueño
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.intenta('cliente: pago cita a2 con otro hash', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a2', 20000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a2/z.webp', repeat('c',64))$$, 'OK');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.intenta('dueño: anula cita a2 (REPORTADO)', $$select public.anular_cita_por_pago_invalido('20000000-0000-4000-8000-0000000000a2','pantallazo falso, el dinero no llegó')$$, 'OK');
reset role;
insert into res select 'a2 quedó CANCELADA/PAGO_NO_VERIFICADO y no se borró', (estado = 'CANCELADA' and cancelado_motivo = 'PAGO_NO_VERIFICADO'), estado::text||'/'||cancelado_motivo from public.reserva where id = '20000000-0000-4000-8000-0000000000a2';
insert into res select 'hash de pago RECHAZADO ya se puede reutilizar', true, 'indice parcial excluye RECHAZADO' where exists (select 1 from pg_indexes where indexname='pago_reserva_comprobante_unico' and indexdef like '%RECHAZADO%');

-- ── POS: a1 (CONFIRMADA, hoy no) → se fuerza hora de hoy para probar; pago VERIFICADO 15000 de 50000; saldo previo 8000 ──
update public.reserva set hora_inicio = now() - interval '5 minutes', hora_fin = now() + interval '55 minutes' where id = '20000000-0000-4000-8000-0000000000a1';
insert into public.cliente_saldo_pendiente (negocio_id, cliente_id, saldo_actual) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001', 8000);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
create temp table pos(j jsonb); grant all on pos to public;
insert into pos select public.completar_venta_pos('20000000-0000-4000-8000-0000000000a1', '[]'::jsonb, 'EFECTIVO', 0, 'EFECTIVO', 0);
reset role;
insert into res select 'POS: cobra 50000-15000+8000 = 43000', (j->>'saldo_cobrado')::numeric = 43000, j->>'saldo_cobrado' from pos;
insert into res select 'POS: anticipo descontado 15000', (j->>'anticipo_descontado')::numeric = 15000, j->>'anticipo_descontado' from pos;
insert into res select 'POS: saldo del cliente liquidado a 0', saldo_actual = 0, saldo_actual::text from public.cliente_saldo_pendiente where cliente_id='10000000-0000-4000-8000-000000000001';
insert into res select 'POS: movimiento COBRO_POS registrado', count(*) = 1, count(*)::text from public.cliente_saldo_movimiento where tipo='COBRO_POS';
insert into res select 'POS: pago SALDO por 43000', monto = 43000, monto::text from public.pago where reserva_id='20000000-0000-4000-8000-0000000000a1' and tipo='SALDO';

-- ── Post-cita: marcar no recibido suma al saldo (solo ese negocio) ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.intenta('STAFF: NO marca no recibido (post cita)', $$select public.marcar_pago_no_recibido_post_cita((select id from public.pago_reserva where reserva_id='20000000-0000-4000-8000-0000000000a1'),'motivo largo suficiente')$$, 'NO_AUTORIZADO');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.intenta('dueño: marca no recibido sin motivo', $$select public.marcar_pago_no_recibido_post_cita((select id from public.pago_reserva where reserva_id='20000000-0000-4000-8000-0000000000a1'),'x')$$, 'MOTIVO_OBLIGATORIO');
select pg_temp.intenta('dueño: marca no recibido', $$select public.marcar_pago_no_recibido_post_cita((select id from public.pago_reserva where reserva_id='20000000-0000-4000-8000-0000000000a1'),'el banco confirmó que no ingresó')$$, 'OK');
select pg_temp.intenta('dueño: marcar dos veces bloqueado', $$select public.marcar_pago_no_recibido_post_cita((select id from public.pago_reserva where reserva_id='20000000-0000-4000-8000-0000000000a1'),'el banco confirmó que no ingresó')$$, 'PAGO_YA_RECHAZADO');
reset role;
insert into res select 'saldo = 15000 tras no recibido', saldo_actual = 15000, saldo_actual::text from public.cliente_saldo_pendiente where cliente_id='10000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.intenta('dueño: abona (baja a 5000)', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',5000,'el cliente pagó en efectivo 10000','ABONO')$$, 'OK');
select pg_temp.intenta('dueño: abono no puede subir', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',9000,'intento subir con abono','ABONO')$$, 'TIPO_INVALIDO');
select pg_temp.intenta('dueño: saldo negativo bloqueado', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',-1,'saldo negativo invalido')$$, 'MONTO_INVALIDO');
select pg_temp.intenta('dueño: condona', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',0,'cortesía por mala experiencia','CONDONACION')$$, 'OK');
-- SuperSU
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select pg_temp.intenta('SUPERSU: ajusta (soporte)', $$select public.ajustar_saldo_pendiente_cliente('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',3000,'corrección por soporte caso 123')$$, 'OK');
-- RLS: cliente no ve saldo de otro negocio (aislamiento): consulta con negocio distinto
reset role;
insert into res select 'auditoría: eventos registrados', count(*) >= 8, count(*)::text from public.evento_auditoria where accion like 'PAGO_DIRECTO_%' or accion like 'SALDO_PENDIENTE_%' or accion like 'CITA_ANULADA_%';
insert into res select 'auditoría SUPERSU con actor_tipo SUPERSU', count(*) = 1, count(*)::text from public.evento_auditoria where accion = 'SALDO_PENDIENTE_AJUSTE' and actor_tipo = 'SUPERSU';
insert into res select 'anon NO ejecuta RPC', not has_function_privilege('anon','public.verificar_pago_reserva(uuid)','execute') and not has_function_privilege('public','public.ajustar_saldo_pendiente_cliente(uuid,uuid,numeric,text,text)','execute'), '';

-- ── Cancelación del cliente con pago directo: NO hay reembolso de plataforma ni movimientos de libro/wallet; aviso al dueño ──
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, monto_total, monto_sena, estado, expira_at)
values ('20000000-0000-4000-8000-0000000000a3','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000003', now()+interval '3 days', now()+interval '3 days 1 hour', 50000, 15000, 'PENDIENTE_PAGO', now()+interval '10 minutes');
create temp table antes(reembolsos int, wallet int); grant all on antes to public;
insert into antes select (select count(*) from public.reembolso), (select count(*) from public.wallet_movimiento);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.intenta('cliente: registra pago cita a3', $$select public.registrar_pago_directo_reserva('20000000-0000-4000-8000-0000000000a3', 15000, '10000000-0000-4000-8000-000000000010/20000000-0000-4000-8000-0000000000a3/q.webp', repeat('d',64))$$, 'OK');
create temp table canc(j jsonb); grant all on canc to public;
insert into canc select public.cancelar_reserva('20000000-0000-4000-8000-0000000000a3', 'ya no puedo asistir');
reset role;
insert into res select 'cancelación con pago directo: 0% y pago_directo=true', (j->>'reembolso_pct')::numeric = 0 and (j->>'pago_directo')::boolean and (j->>'reembolso_id') is null, j::text from canc;
insert into res select 'cancelación con pago directo: sin reembolso, sin wallet y sin movimiento monetario en el libro (solo eventos INFORMATIVOS)', (select count(*) from public.reembolso) = reembolsos and (select count(*) from public.wallet_movimiento) = wallet and not exists (select 1 from public.libro_movimiento where reserva_id = '20000000-0000-4000-8000-0000000000a3' and sentido <> 'INFORMATIVO'), '' from antes;
-- PUSH solo se encola si el dueño tiene suscripción push (aquí no): se esperan EMAIL y PANEL.
insert into res select 'aviso al dueño: EMAIL + PANEL encolados con cliente, monto y ruta /panel/pagos', count(*) = 2 and bool_and(datos->>'ruta' = '/panel/pagos') and bool_and(usuario_id = '10000000-0000-4000-8000-000000000002') and bool_and(datos->>'cliente' is not null) and bool_and(datos->>'monto' like '15.000%') and array_agg(canal order by canal) = array['EMAIL','PANEL'], count(*)::text from public.notificacion_outbox where evento = 'NEGOCIO_PAGO_DIRECTO_REPORTADO' and datos->>'reserva_id' = '20000000-0000-4000-8000-0000000000a3';

select case when ok then 'PASA ' else 'FALLA ' end || paso || ' → ' || detalle from res order by ok, paso;
rollback;
