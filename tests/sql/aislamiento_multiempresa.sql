-- Pruebas de aislamiento multiempresa (Fase 5 de la Directiva) y regresión de la migración 125.
--
-- Se corren contra la base LOCAL (supabase start), nunca contra producción:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/aislamiento_multiempresa.sql
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos (ni las funciones
-- auxiliares _t_*, que se crean dentro de la transacción).
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado; ON_ERROR_STOP corta en el primero.
--
-- Actores contra los datos del negocio B: dueño A, staff (guardián) A, cliente A, un autenticado
-- sin relación (intruso) y anon. Se prueba SELECT / UPDATE / DELETE / INSERT tabla por tabla,
-- storage.objects, las RPC que reciben ids de negocio/sede/reserva/cliente/cuenta, y que el
-- acceso legítimo (A sobre A) sigue funcionando.

begin;

-- ── Paridad con producción ──────────────────────────────────────────────────
-- En producción los default privileges de Supabase otorgan todo sobre las tablas públicas a
-- anon, authenticated y service_role (la CLI local nueva no). Se emulan y después se REAPLICAN
-- los revokes explícitos de 116, 117, 119, 120 y 125, para probar la postura real: lo que frena
-- a un rol de API es la RLS / los triggers, no la falta de un GRANT que en producción sí existe.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- 116
revoke insert, update, delete, truncate on public.aceptacion_politica_reserva from public, anon, authenticated;
revoke insert, update, delete, truncate on public.reembolso, public.reembolso_evento from public, anon, authenticated;
revoke usage on sequence public.reembolso_evento_id_seq from public, anon, authenticated;
revoke all on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from anon;
revoke insert, update, delete, truncate on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from service_role;
-- 117
revoke all on public.comision_cambio_programado from public, anon;
revoke insert, update, delete, truncate on public.comision_cambio_programado from authenticated, service_role;
do $$
declare t text;
begin
  foreach t in array array['wallet_movimiento','lealtad_movimiento','cashback_movimiento','evento_auditoria',
                           'credito_ia_consumo','gift_card_redencion','membresia_uso'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke update, delete, truncate on public.%I from public, anon, authenticated, service_role', t);
    end if;
  end loop;
  foreach t in array array['pago','wallet','wallet_movimiento','lealtad_wallet','lealtad_movimiento','cashback_movimiento',
                           'gift_card','gift_card_redencion','membresia_uso','credito_ia_consumo','credito_ia_lote',
                           'solicitud_devolucion_saldo','suscripcion_fundador','prueba_uso','evento_auditoria',
                           'configuracion_plataforma'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', t);
    end if;
  end loop;
end $$;
revoke delete, truncate on public.pago from public, anon, authenticated, service_role;
-- 119
revoke all on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from public, anon, authenticated;
revoke insert, update, delete, truncate on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from service_role;
revoke all on public.webhook_evento from public, anon;
revoke insert, update, delete, truncate on public.webhook_evento from authenticated;
-- 120
revoke all on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta from public, anon, authenticated;
grant select on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta to authenticated;
revoke insert, update, delete on public.whatsapp_conversacion_lote from public, anon, authenticated;
-- 125
revoke insert, update, delete, truncate on public.reserva_servicio from public, anon, authenticated;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
-- Negocio A (…01a0): dueño a1, staff guardián a2, cliente a3.
-- Negocio B (…01b0): dueño b1, staff b2, cliente b3.   c9: autenticado sin relación con nadie.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0005-0000000000a1', 'ais-dueno-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000a2', 'ais-staff-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000a3', 'ais-cliente-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000b1', 'ais-dueno-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000b2', 'ais-staff-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000b3', 'ais-cliente-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0005-0000000000c9', 'ais-intruso@test.local', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, email) values
  ('00000000-0000-0000-0005-0000000000a1', 'Dueño A', 'ais-dueno-a@test.local'),
  ('00000000-0000-0000-0005-0000000000a2', 'Staff A', 'ais-staff-a@test.local'),
  ('00000000-0000-0000-0005-0000000000a3', 'Cliente A', 'ais-cliente-a@test.local'),
  ('00000000-0000-0000-0005-0000000000b1', 'Dueño B', 'ais-dueno-b@test.local'),
  ('00000000-0000-0000-0005-0000000000b2', 'Staff B', 'ais-staff-b@test.local'),
  ('00000000-0000-0000-0005-0000000000b3', 'Cliente B', 'ais-cliente-b@test.local'),
  ('00000000-0000-0000-0005-0000000000c9', 'Intruso', 'ais-intruso@test.local')
on conflict (id) do nothing;

-- Ambos ACTIVOS: así lo público (marketplace) es visible y se prueba que lo interno no lo es.
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000000a1', 'Negocio A', 'ais-negocio-a', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b1', 'Negocio B', 'ais-negocio-b', 'Cali', 'CO', 'ACTIVO');
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000001b0');
-- Wallet con id conocido (handle_new_negocio la crea con id aleatorio).
update public.wallet set id = '00000000-0000-0000-0005-0000000008a9' where negocio_id = '00000000-0000-0000-0005-0000000001a0';
update public.wallet set id = '00000000-0000-0000-0005-0000000008b9' where negocio_id = '00000000-0000-0000-0005-0000000001b0';
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at) values
  ('00000000-0000-0000-0005-0000000001a0', 'CONECTADA', 'SANDBOX', 'ais-a', 'v1.iv.tag.datos', now() + interval '180 days', now()),
  ('00000000-0000-0000-0005-0000000001b0', 'CONECTADA', 'SANDBOX', 'ais-b', 'v1.iv.tag.datos', now() + interval '180 days', now());

insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0005-0000000002a0', '00000000-0000-0000-0005-0000000001a0', 'Sede A', 'Cra 1', 'Cali'),
  ('00000000-0000-0000-0005-0000000002b0', '00000000-0000-0000-0005-0000000001b0', 'Sede B', 'Cra 2', 'Cali');
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('00000000-0000-0000-0005-0000000003a0', '00000000-0000-0000-0005-0000000001a0', 'Corte A', 30, 30000, 'ACTIVO'),
  ('00000000-0000-0000-0005-0000000003b0', '00000000-0000-0000-0005-0000000001b0', 'Corte B', 30, 30000, 'ACTIVO'),
  ('00000000-0000-0000-0005-0000000003b1', '00000000-0000-0000-0005-0000000001b0', 'Interno B', 30, 1, 'INACTIVO');

insert into public.staff (usuario_id, nombre) values
  ('00000000-0000-0000-0005-0000000000a2', 'Staff A'), ('00000000-0000-0000-0005-0000000000b2', 'Staff B')
on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0005-0000000002a1', '00000000-0000-0000-0005-0000000000a2', '00000000-0000-0000-0005-0000000001a0',
   '00000000-0000-0000-0005-0000000002a0', 'ACTIVO', true, 40, now()),
  ('00000000-0000-0000-0005-0000000002b1', '00000000-0000-0000-0005-0000000000b2', '00000000-0000-0000-0005-0000000001b0',
   '00000000-0000-0000-0005-0000000002b0', 'ACTIVO', false, 40, now());

insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0005-0000000004a0', '00000000-0000-0000-0005-0000000000a3', '00000000-0000-0000-0005-0000000001a0',
   '00000000-0000-0000-0005-0000000002a0', '00000000-0000-0000-0005-0000000000a2', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000),
  ('00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0',
   '00000000-0000-0000-0005-0000000002b0', '00000000-0000-0000-0005-0000000000b2', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000),
  -- Sin staff asignado: el caso del P0 de autorización NULL.
  ('00000000-0000-0000-0005-0000000004b1', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0',
   '00000000-0000-0000-0005-0000000002b0', null, now() + interval '40 hours', now() + interval '41 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0005-0000000004b2', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0',
   '00000000-0000-0000-0005-0000000002b0', '00000000-0000-0000-0005-0000000000b2', now() - interval '50 hours', now() - interval '49 hours', 'COMPLETADA', 30000, 0);
insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario) values
  ('00000000-0000-0000-0005-0000000004a0', '00000000-0000-0000-0005-0000000003a0', 30000),
  ('00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000003b0', 30000),
  ('00000000-0000-0000-0005-0000000004b2', '00000000-0000-0000-0005-0000000003b0', 30000);

insert into public.aceptacion_politica_reserva (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, zona_horaria, monto_sena, hora_inicio_reserva) values
  ('00000000-0000-0000-0005-0000000004a0', '00000000-0000-0000-0005-0000000000a3', '00000000-0000-0000-0005-0000000001a0', '{}', 'acepto', 'v1', 'America/Bogota', 6000, now() + interval '30 hours'),
  ('00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0', '{}', 'acepto', 'v1', 'America/Bogota', 6000, now() + interval '30 hours');
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, id_transaccion_pasarela, comision_plataforma_monto) values
  ('00000000-0000-0000-0005-0000000005a0', '00000000-0000-0000-0005-0000000004a0', '00000000-0000-0000-0005-0000000001a0', 'SENA', 6000, 'APROBADO', 'ais-tx-a', 0),
  ('00000000-0000-0000-0005-0000000005b0', '00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000001b0', 'SENA', 6000, 'APROBADO', 'ais-tx-b', 0);
insert into public.reembolso (id, pago_id, reserva_id, negocio_id, cliente_id, monto, pct, motivo, origen, idempotency_key) values
  ('00000000-0000-0000-0005-0000000008b4', '00000000-0000-0000-0005-0000000005b0', '00000000-0000-0000-0005-0000000004b0',
   '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', 600, 10, 'CORTESIA_COMERCIAL', 'AJUSTE', 'ais-reembolso-b');

insert into public.cliente_nota (id, negocio_id, cliente_id, autor_id, texto) values
  ('00000000-0000-0000-0005-0000000006a0', '00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000000a3', '00000000-0000-0000-0005-0000000000a1', 'Nota A'),
  ('00000000-0000-0000-0005-0000000006b0', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000000b1', 'Nota privada B');
insert into public.cliente_etiqueta (id, negocio_id, cliente_id, etiqueta, creado_por) values
  ('00000000-0000-0000-0005-0000000006a1', '00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000000a3', 'frecuente', '00000000-0000-0000-0005-0000000000a1'),
  ('00000000-0000-0000-0005-0000000006b1', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', 'vip', '00000000-0000-0000-0005-0000000000b1');
insert into public.reserva_foto (id, reserva_id, negocio_id, cliente_id, url, consentimiento, subido_por, momento) values
  ('00000000-0000-0000-0005-0000000006b2', '00000000-0000-0000-0005-0000000004b2', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3',
   '00000000-0000-0000-0005-0000000001b0/00000000-0000-0000-0005-0000000000b3/despues.jpg', true, '00000000-0000-0000-0005-0000000000b1', 'DESPUES');

insert into public.producto (id, negocio_id, nombre, precio) values
  ('00000000-0000-0000-0005-0000000007a0', '00000000-0000-0000-0005-0000000001a0', 'Cera A', 20000),
  ('00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000001b0', 'Cera B', 20000);
insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo) values
  ('00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000007a0', '00000000-0000-0000-0005-0000000002a0', 10, 1),
  ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000002b0', 10, 1);
insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, actor_id) values
  ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', '00000000-0000-0000-0005-0000000007b0', 'ENTRADA', 10, '00000000-0000-0000-0005-0000000000b1');

insert into public.wallet_movimiento (id, wallet_id, tipo, monto, referencia_tipo, referencia_id) values
  ('00000000-0000-0000-0005-0000000008a8', '00000000-0000-0000-0005-0000000008a9', 'AJUSTE', 1, 'prueba', gen_random_uuid()),
  ('00000000-0000-0000-0005-0000000008b8', '00000000-0000-0000-0005-0000000008b9', 'AJUSTE', 1, 'prueba', gen_random_uuid());
insert into public.egreso_caja (id, negocio_id, sede_id, monto, concepto, categoria, registrado_por) values
  ('00000000-0000-0000-0005-0000000008b0', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', 5000, 'Aseo B', 'ASEO', '00000000-0000-0000-0005-0000000000b1');
insert into public.gift_card (id, codigo, pin_hash, negocio_id, monto_original, saldo_actual, comprador_id) values
  ('00000000-0000-0000-0005-0000000008b1', 'AISB000001', 'x', '00000000-0000-0000-0005-0000000001b0', 50000, 50000, '00000000-0000-0000-0005-0000000000b3');
insert into public.membresia_plan (id, negocio_id, nombre, precio, duracion_meses, activo) values
  ('00000000-0000-0000-0005-0000000008b2', '00000000-0000-0000-0005-0000000001b0', 'Plan interno B', 80000, 1, false);
insert into public.cliente_membresia (id, cliente_id, plan_id, negocio_id, fecha_proximo_cobro) values
  ('00000000-0000-0000-0005-0000000008b3', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000008b2', '00000000-0000-0000-0005-0000000001b0', now() + interval '30 days');
-- Cuenta corporativa recién creada: sin admin asignado (así nace en crear_cuenta_corporativa).
insert into public.corporativo_cuenta (id, nombre_empresa, contacto_email, cupos_totales, vigencia_fin, negocio_id) values
  ('00000000-0000-0000-0005-0000000008b5', 'Empresa B', 'rrhh@empresa-b.test', 10, current_date + 90, '00000000-0000-0000-0005-0000000001b0');
insert into public.invitacion_staff (id, negocio_id, email, invitado_por, comision_pct) values
  ('00000000-0000-0000-0005-0000000008b6', '00000000-0000-0000-0005-0000000001b0', 'ais-invitado-b@test.local', '00000000-0000-0000-0005-0000000000b1', 40);

insert into public.whatsapp_plantilla (id, negocio_id, nombre, categoria, cuerpo) values
  ('00000000-0000-0000-0005-0000000009b0', '00000000-0000-0000-0005-0000000001b0', 'ais_plantilla_b', 'MARKETING', 'Hola {{1}}');
insert into public.whatsapp_mensaje (id, negocio_id, plantilla_id, cliente_id, telefono, categoria) values
  ('00000000-0000-0000-0005-0000000009b1', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000009b0',
   '00000000-0000-0000-0005-0000000000b3', '573001112233', 'MARKETING');
insert into public.evento_auditoria (id, entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id) values
  ('00000000-0000-0000-0005-0000000009b2', 'negocio', '00000000-0000-0000-0005-0000000001b0', 'PRUEBA_AISLAMIENTO', 'BARBERIA',
   '00000000-0000-0000-0005-0000000000b1', '00000000-0000-0000-0005-0000000001b0');

-- Storage: objetos de B en cada bucket con políticas.
insert into storage.objects (bucket_id, name, owner) values
  ('crm-fotos', '00000000-0000-0000-0005-0000000001b0/00000000-0000-0000-0005-0000000000b3/despues.jpg', '00000000-0000-0000-0005-0000000000b1'),
  ('soporte-adjuntos', '00000000-0000-0000-0005-0000000000b1/factura.pdf', '00000000-0000-0000-0005-0000000000b1'),
  ('avatars', '00000000-0000-0000-0005-0000000000b1/avatar.png', '00000000-0000-0000-0005-0000000000b1'),
  ('negocio-media', '00000000-0000-0000-0005-0000000001b0/logo.png', '00000000-0000-0000-0005-0000000000b1');

-- ── Auxiliares (INVOKER: ejecutan con el rol y el JWT del actor) ─────────────
-- Lectura: cuántas filas de B ve el actor (-1 = ni siquiera tiene privilegio).
create function public._t_contar(q text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute q into n;
  return n;
exception when insufficient_privilege then return -1;
end $f$;

-- UPDATE/DELETE: 'OK' si no tocó filas o no hay privilegio. Un error de trigger de fila significa
-- que la RLS dejó pasar la fila (la frenó otra barrera): se reporta como FALLA de aislamiento.
create function public._t_modificar(q text) returns text language plpgsql as $f$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return case when n = 0 then 'OK' else 'FILAS=' || n end;
exception
  when insufficient_privilege then return 'OK';
  when others then return 'ERROR ' || sqlstate || ': ' || left(sqlerrm, 80);
end $f$;

-- INSERT: 'OK' si lo frena la RLS o la falta de privilegio; 'OK*' si lo frena otra regla (trigger).
create function public._t_insertar(q text) returns text language plpgsql as $f$
begin
  execute q;
  return 'INSERTADO';
exception
  when insufficient_privilege then return 'OK';
  when others then return 'OK* ' || left(sqlerrm, 70);
end $f$;

-- RPC: 'R|…' debe rechazar; 'V|…' (set-returning) debe venir vacía; 'F|…' escalar falso/0/NULL.
create function public._t_rpc(q text) returns text language plpgsql as $f$
declare v_modo text := split_part(q, '|', 1); v_call text := substr(q, 3); v_txt text; v_n bigint;
begin
  if v_modo = 'V' then
    execute format('select count(*) from %s x', v_call) into v_n;
    return case when v_n = 0 then 'OK' else 'FILAS=' || v_n end;
  end if;
  execute format('select (%s)::text', v_call) into v_txt;
  if v_modo = 'F' and coalesce(v_txt, 'false') in ('false', '0', '{}', '[]') then return 'OK'; end if;
  return 'NO_RECHAZO -> ' || left(coalesce(v_txt, '<null>'), 80);
exception when others then
  if sqlerrm ~ '(NO_AUTORIZADO|NO_AUTENTICADO|FUNCION_NO_INCLUIDA|NO_ENCONTRAD|SEDE_INVALIDA|SEDE_NO_PERTENECE|MIEMBRO_NO_ACTIVO)'
     or sqlstate = '42501' then
    return 'OK';
  end if;
  return 'REVISAR ' || sqlstate || ': ' || left(sqlerrm, 80);
end $f$;

-- Lecturas sobre los datos de B (deben devolver 0 filas).
create function public._t_lecturas_b() returns text[] language sql immutable as $f$ select array[
  $q$select count(*) from public.reserva where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.reserva_servicio where reserva_id in ('00000000-0000-0000-0005-0000000004b0','00000000-0000-0000-0005-0000000004b1','00000000-0000-0000-0005-0000000004b2')$q$,
  $q$select count(*) from public.pago where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.cliente_nota where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.cliente_etiqueta where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.vista_crm_cliente where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.reserva_foto where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.wallet where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.wallet_movimiento where id = '00000000-0000-0000-0005-0000000008b8'$q$,
  $q$select count(*) from public.reembolso where id = '00000000-0000-0000-0005-0000000008b4'$q$,
  $q$select count(*) from public.aceptacion_politica_reserva where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.servicio where id = '00000000-0000-0000-0005-0000000003b1'$q$,
  $q$select count(*) from public.producto where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.producto_stock where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.movimiento_inventario where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.egreso_caja where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.gift_card where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.membresia_plan where id = '00000000-0000-0000-0005-0000000008b2'$q$,
  $q$select count(*) from public.cliente_membresia where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.corporativo_cuenta where id = '00000000-0000-0000-0005-0000000008b5'$q$,
  $q$select count(*) from public.invitacion_staff where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.whatsapp_plantilla where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.whatsapp_mensaje where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.evento_auditoria where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.conexion_pago_negocio where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$select count(*) from public.perfil where id = '00000000-0000-0000-0005-0000000000b3'$q$,
  $q$select count(*) from public.configuracion_plataforma$q$,
  $q$select count(*) from storage.objects where bucket_id = 'crm-fotos' and name like '00000000-0000-0000-0005-0000000001b0/%'$q$,
  $q$select count(*) from storage.objects where bucket_id = 'soporte-adjuntos' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$,
  $q$select count(*) from storage.objects where bucket_id = 'avatars' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$
] $f$;

-- UPDATE y DELETE sobre los datos de B (deben tocar 0 filas).
create function public._t_escrituras_b() returns text[] language sql immutable as $f$ select array[
  $q$update public.reserva set updated_at = now() where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.pago set metadata = '{}' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.cliente_nota set texto = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.cliente_etiqueta set etiqueta = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.reserva_foto set compartida = true where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.reserva_servicio set precio_congelado_unitario = 0 where reserva_id = '00000000-0000-0000-0005-0000000004b0'$q$,
  $q$update public.wallet set saldo_disponible = 999999 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.wallet_movimiento set monto = 999 where id = '00000000-0000-0000-0005-0000000008b8'$q$,
  $q$update public.reembolso set estado = 'SOLICITADO' where id = '00000000-0000-0000-0005-0000000008b4'$q$,
  $q$update public.aceptacion_politica_reserva set texto_aceptado = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.servicio set precio_base = 1 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.producto set precio = 1 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.producto_stock set stock_actual = 0 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.sede set nombre = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.vinculo_staff_negocio set estado = 'RETIRADO' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.egreso_caja set concepto = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.gift_card set saldo_actual = 999999 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.membresia_plan set precio = 1 where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.cliente_membresia set fecha_proximo_cobro = now() where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.corporativo_cuenta set admin_user_id = auth.uid() where id = '00000000-0000-0000-0005-0000000008b5'$q$,
  $q$update public.invitacion_staff set email = 'hack@test.local' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.whatsapp_plantilla set cuerpo = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.whatsapp_mensaje set telefono = '5700000000' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.evento_auditoria set motivo = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.negocio set nombre = 'hack' where id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.perfil set nombre = 'hack' where id = '00000000-0000-0000-0005-0000000000b3'$q$,
  $q$update public.conexion_pago_negocio set ultimo_error = 'hack' where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$update public.configuracion_plataforma set prueba_dias = 1 where id$q$,
  $q$update public.plan set nombre = 'hack' where true$q$,
  $q$update public.plan_precio set precio_mensual = 1 where true$q$,
  $q$update public.pais set activo = false where true$q$,
  $q$update storage.objects set name = name || '.x' where bucket_id = 'crm-fotos' and name like '00000000-0000-0000-0005-0000000001b0/%'$q$,
  $q$update storage.objects set name = name || '.x' where bucket_id = 'soporte-adjuntos' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$,
  $q$update storage.objects set name = name || '.x' where bucket_id = 'avatars' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$,
  $q$update storage.objects set name = name || '.x' where bucket_id = 'negocio-media' and name like '00000000-0000-0000-0005-0000000001b0/%'$q$,
  $q$delete from public.reserva where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.pago where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.cliente_nota where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.cliente_etiqueta where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.reserva_foto where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.reserva_servicio where reserva_id = '00000000-0000-0000-0005-0000000004b0'$q$,
  $q$delete from public.wallet where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.wallet_movimiento where id = '00000000-0000-0000-0005-0000000008b8'$q$,
  $q$delete from public.reembolso where id = '00000000-0000-0000-0005-0000000008b4'$q$,
  $q$delete from public.aceptacion_politica_reserva where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.servicio where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.producto where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.producto_stock where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.sede where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.egreso_caja where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.gift_card where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.membresia_plan where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.cliente_membresia where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.corporativo_cuenta where id = '00000000-0000-0000-0005-0000000008b5'$q$,
  $q$delete from public.invitacion_staff where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.whatsapp_plantilla where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.whatsapp_mensaje where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.evento_auditoria where negocio_id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.negocio where id = '00000000-0000-0000-0005-0000000001b0'$q$,
  $q$delete from public.perfil where id = '00000000-0000-0000-0005-0000000000b3'$q$,
  $q$delete from public.plan_precio where true$q$,
  $q$delete from public.pais where true$q$,
  $q$delete from storage.objects where bucket_id = 'crm-fotos' and name like '00000000-0000-0000-0005-0000000001b0/%'$q$,
  $q$delete from storage.objects where bucket_id = 'soporte-adjuntos' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$,
  $q$delete from storage.objects where bucket_id = 'avatars' and name like '00000000-0000-0000-0005-0000000000b1/%'$q$,
  $q$delete from storage.objects where bucket_id = 'negocio-media' and name like '00000000-0000-0000-0005-0000000001b0/%'$q$
] $f$;

-- INSERT dentro de B (deben rechazarse).
create function public._t_inserciones_b() returns text[] language sql immutable as $f$ select array[
  $q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, monto_total, monto_sena) values (coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000b3'), '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', now() + interval '60 hours', now() + interval '61 hours', 0, 0)$q$,
  $q$insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario) values ('00000000-0000-0000-0005-0000000004b1', '00000000-0000-0000-0005-0000000003b0', 0)$q$,
  $q$insert into public.pago (reserva_id, negocio_id, tipo, monto, estado) values ('00000000-0000-0000-0005-0000000004b1', '00000000-0000-0000-0005-0000000001b0', 'SALDO', 1, 'APROBADO')$q$,
  $q$insert into public.cliente_nota (negocio_id, cliente_id, autor_id, texto) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', auth.uid(), 'hack')$q$,
  $q$insert into public.cliente_etiqueta (negocio_id, cliente_id, etiqueta, creado_por) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', 'hack', auth.uid())$q$,
  $q$insert into public.reserva_foto (reserva_id, negocio_id, cliente_id, url, consentimiento, subido_por, momento) values ('00000000-0000-0000-0005-0000000004b2', '00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', 'x.jpg', true, auth.uid(), 'ANTES')$q$,
  $q$insert into public.servicio (negocio_id, nombre, duracion_minutos, precio_base) values ('00000000-0000-0000-0005-0000000001b0', 'hack', 30, 1)$q$,
  $q$insert into public.producto (negocio_id, nombre, precio) values ('00000000-0000-0000-0005-0000000001b0', 'hack', 1)$q$,
  $q$insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000002a0', 1, 0)$q$,
  $q$insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, actor_id) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', '00000000-0000-0000-0005-0000000007b0', 'ENTRADA', 1, coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000b1'))$q$,
  $q$insert into public.sede (negocio_id, nombre, direccion, ciudad) values ('00000000-0000-0000-0005-0000000001b0', 'hack', 'x', 'Cali')$q$,
  $q$insert into public.vinculo_staff_negocio (staff_id, negocio_id, estado) values (coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000c9'), '00000000-0000-0000-0005-0000000001b0', 'ACTIVO')$q$,
  $q$insert into public.egreso_caja (negocio_id, sede_id, monto, concepto, categoria, registrado_por) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', 1, 'hack', 'OTRO', coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000b1'))$q$,
  $q$insert into public.gift_card (codigo, pin_hash, negocio_id, monto_original, saldo_actual) values ('AISHACK' || substr(md5(random()::text), 1, 4), 'x', '00000000-0000-0000-0005-0000000001b0', 1, 1)$q$,
  $q$insert into public.membresia_plan (negocio_id, nombre, precio, duracion_meses) values ('00000000-0000-0000-0005-0000000001b0', 'hack', 1, 1)$q$,
  $q$insert into public.cliente_membresia (cliente_id, plan_id, negocio_id, fecha_proximo_cobro) values (coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000c9'), '00000000-0000-0000-0005-0000000008b2', '00000000-0000-0000-0005-0000000001b0', now())$q$,
  $q$insert into public.wallet_movimiento (wallet_id, tipo, monto) values ('00000000-0000-0000-0005-0000000008b9', 'AJUSTE', 1)$q$,
  $q$insert into public.reembolso (pago_id, monto, pct, motivo, origen, idempotency_key) values ('00000000-0000-0000-0005-0000000005b0', 1, 10, 'CORTESIA_COMERCIAL', 'AJUSTE', 'ais-hack-' || md5(random()::text))$q$,
  $q$insert into public.aceptacion_politica_reserva (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, zona_horaria, monto_sena, hora_inicio_reserva) values ('00000000-0000-0000-0005-0000000004b1', '00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0', '{}', 'x', 'x', 'UTC', 0, now())$q$,
  $q$insert into public.invitacion_staff (negocio_id, email, invitado_por, comision_pct) values ('00000000-0000-0000-0005-0000000001b0', 'hack@test.local', coalesce(auth.uid(), '00000000-0000-0000-0005-0000000000b1'), 40)$q$,
  $q$insert into public.corporativo_cuenta (nombre_empresa, contacto_email, cupos_totales, vigencia_fin, negocio_id) values ('hack', 'h@test.local', 1, current_date + 1, '00000000-0000-0000-0005-0000000001b0')$q$,
  $q$insert into public.whatsapp_plantilla (negocio_id, nombre, categoria, cuerpo) values ('00000000-0000-0000-0005-0000000001b0', 'ais_hack', 'MARKETING', 'x')$q$,
  $q$insert into public.whatsapp_mensaje (negocio_id, plantilla_id, cliente_id, telefono, categoria) values ('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000009b0', '00000000-0000-0000-0005-0000000000b3', '573000000000', 'MARKETING')$q$,
  $q$insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, negocio_id) values ('negocio', 'HACK', 'BARBERIA', '00000000-0000-0000-0005-0000000001b0')$q$,
  $q$insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual) values ('ESSENTIAL', 'MX', 1)$q$,
  $q$insert into public.pais (codigo, nombre, moneda) values ('ZZ', 'Hack', 'ZZZ')$q$,
  $q$insert into storage.objects (bucket_id, name) values ('crm-fotos', '00000000-0000-0000-0005-0000000001b0/00000000-0000-0000-0005-0000000000b3/hack.jpg')$q$,
  $q$insert into storage.objects (bucket_id, name) values ('soporte-adjuntos', '00000000-0000-0000-0005-0000000000b1/hack.pdf')$q$,
  $q$insert into storage.objects (bucket_id, name) values ('negocio-media', '00000000-0000-0000-0005-0000000001b0/hack.png')$q$,
  $q$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0005-0000000000b1/hack.png')$q$
] $f$;

-- RPC con ids de B (las de acceso público —marketplace, perfil público, cálculo de anticipo— no van aquí).
create function public._t_rpcs_b() returns text[] language sql immutable as $f$ select array[
  $q$R|public.aceptar_politica_reserva('00000000-0000-0000-0005-0000000004b0')$q$,
  $q$R|public.cancelar_reserva('00000000-0000-0000-0005-0000000004b0', 'x')$q$,
  $q$R|public.reprogramar_reserva('00000000-0000-0000-0005-0000000004b0', now() + interval '5 days', 'x')$q$,
  $q$R|public.reasignar_staff_reserva('00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000000b2', 'x')$q$,
  $q$R|public.marcar_no_show('00000000-0000-0000-0005-0000000004b0', 'x')$q$,
  $q$R|public.marcar_llegada('00000000-0000-0000-0005-0000000004b0', 0, 0)$q$,
  $q$R|public.iniciar_atencion_reserva('00000000-0000-0000-0005-0000000004b1')$q$,
  $q$R|public.finalizar_atencion_reserva('00000000-0000-0000-0005-0000000004b1')$q$,
  $q$R|public.completar_venta_pos('00000000-0000-0000-0005-0000000004b0', '[]', 'EFECTIVO', 0, null, 0)$q$,
  $q$R|public.crear_pago_sena('00000000-0000-0000-0005-0000000004b0')$q$,
  $q$R|public.mi_cita_detalle('00000000-0000-0000-0005-0000000004b0')$q$,
  $q$R|public.calificar_visita('00000000-0000-0000-0005-0000000004b2', 5, 'x')$q$,
  $q$R|public.chat_enviar('00000000-0000-0000-0005-0000000004b0', 'hola')$q$,
  $q$R|public.chat_listar('00000000-0000-0000-0005-0000000004b0', 10, null)$q$,
  $q$R|public.chat_marcar_leido('00000000-0000-0000-0005-0000000004b0')$q$,
  $q$R|public.crear_reserva_manual('00000000-0000-0000-0005-0000000002b0', array['00000000-0000-0000-0005-0000000003b0']::uuid[], now() + interval '3 days', '00000000-0000-0000-0005-0000000000b3', null)$q$,
  $q$R|public.cerrar_sede('00000000-0000-0000-0005-0000000002b0', false, 'x')$q$,
  $q$R|public.reabrir_sede('00000000-0000-0000-0005-0000000002b0')$q$,
  $q$R|public.establecer_sede_principal('00000000-0000-0000-0005-0000000002b0')$q$,
  $q$R|public.crear_sede('00000000-0000-0000-0005-0000000001b0', 'x', 'x', 'Cali', '{}', null, null)$q$,
  $q$R|public.cierre_caja_dia('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', current_date)$q$,
  $q$R|public.cierre_caja_dia('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002a0', current_date)$q$,
  $q$R|public.registrar_egreso_caja('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002b0', 1000, 'hack', 'OTRO')$q$,
  $q$R|public.registrar_egreso_caja('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002a0', 1000, 'hack', 'OTRO')$q$,
  $q$R|public.ajustar_stock('00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000002b0', 0, 'x')$q$,
  $q$R|public.registrar_movimiento_inventario('00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000002b0', 'ENTRADA', 1, 'x')$q$,
  $q$R|public.configurar_stock_minimo('00000000-0000-0000-0005-0000000007b0', '00000000-0000-0000-0005-0000000002b0', 1)$q$,
  $q$R|public.dashboard_resumen_dia('00000000-0000-0000-0005-0000000001b0', null)$q$,
  $q$R|public.dashboard_resumen_dia('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002a0')$q$,
  $q$R|public.dashboard_ranking_staff_semana('00000000-0000-0000-0005-0000000001b0', null)$q$,
  $q$R|public.reportes_ingresos_periodo('00000000-0000-0000-0005-0000000001b0', null, current_date - 30, current_date, 'mes')$q$,
  $q$R|public.reportes_ingresos_periodo('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002a0', current_date - 30, current_date, 'mes')$q$,
  $q$R|public.reportes_ranking_staff('00000000-0000-0000-0005-0000000001b0', null, null, null, null)$q$,
  $q$R|public.reportes_servicios_top('00000000-0000-0000-0005-0000000001b0', null, current_date - 30, current_date)$q$,
  $q$R|public.reportes_servicios_top('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000002a0', current_date - 30, current_date)$q$,
  $q$R|public.detectar_horarios_muertos('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.metricas_lealtad_negocio('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.marketplace_mi_posicion('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.saldo_creditos_ia('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.consumir_creditos_ia('00000000-0000-0000-0005-0000000001b0', 'x', null, null)$q$,
  $q$R|public.comprar_paquete_creditos_ia('00000000-0000-0000-0005-0000000001b0', gen_random_uuid())$q$,
  $q$R|public.guardar_memoria_ia('00000000-0000-0000-0005-0000000001b0', 'TONO', '{}', null)$q$,
  $q$R|public.crear_prompt_ia('00000000-0000-0000-0005-0000000001b0', 'PROPIO', 'x', 'x', 'x', '[]')$q$,
  $q$V|public.listar_memoria_ia('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$V|public.historial_memoria_ia('00000000-0000-0000-0005-0000000001b0', 'TONO')$q$,
  $q$V|public.listar_prompts_ia('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$V|public.listar_sugerencias_recompensa('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.conexion_pago_estado('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.conexion_desconectar('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.configurar_politica_cancelacion('00000000-0000-0000-0005-0000000001b0', 24, 2, 50, 'x')$q$,
  $q$R|public.configurar_referidos('00000000-0000-0000-0005-0000000001b0', 1000, null, 1, 30, true)$q$,
  $q$R|public.crear_invitacion_staff('00000000-0000-0000-0005-0000000001b0', 'nuevo@test.local', null, 40)$q$,
  $q$R|public.crear_campana_publicitaria('00000000-0000-0000-0005-0000000001b0', 'DESTACADO', 'CPC', 10000, 100000, now() + interval '7 days', '{}')$q$,
  $q$R|public.crear_campana_sellos('00000000-0000-0000-0005-0000000001b0', 'x', 5, 'x', null, 30)$q$,
  $q$R|public.crear_nivel_vip('00000000-0000-0000-0005-0000000001b0', 'x', 1, 'x', null)$q$,
  $q$R|public.sembrar_niveles_vip_default('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.asignar_vip('00000000-0000-0000-0005-0000000000b3', '00000000-0000-0000-0005-0000000001b0', gen_random_uuid())$q$,
  $q$R|public.crear_plan_membresia('00000000-0000-0000-0005-0000000001b0', 'x', 1000, 1, false, null, null, null, false, null, null, null)$q$,
  $q$R|public.registrar_uso_membresia('00000000-0000-0000-0005-0000000008b3', '00000000-0000-0000-0005-0000000004b0', 'SERVICIO_INCLUIDO', 1)$q$,
  $q$R|public.crear_regla_cashback('00000000-0000-0000-0005-0000000001b0', 5, null, null, null, 30)$q$,
  $q$R|public.crear_regla_recompensa('00000000-0000-0000-0005-0000000001b0', 'CUMPLEANOS', 0, '{}', '{}', true)$q$,
  $q$R|public.registrar_referido_staff('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000000b3', 'DESCUENTO', 1)$q$,
  $q$R|public.guardar_marca_negocio('00000000-0000-0000-0005-0000000001b0', 'x', null, null, '#000000', '#ffffff', false)$q$,
  $q$R|public.elegir_pais_negocio('00000000-0000-0000-0005-0000000001b0', 'CO')$q$,
  $q$R|public.enviar_negocio_a_aprobacion('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.crear_suscripcion_inicial('00000000-0000-0000-0005-0000000001b0', 'ESSENTIAL')$q$,
  $q$R|public.solicitar_upgrade_plan('00000000-0000-0000-0005-0000000001b0', 'SIGNATURE')$q$,
  $q$R|public.solicitar_downgrade_plan('00000000-0000-0000-0005-0000000001b0', 'ESSENTIAL')$q$,
  $q$R|public.cancelar_downgrade_programado('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.cancelar_negocio_propio('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.whatsapp_panel_resumen('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.whatsapp_segmento_contar('00000000-0000-0000-0005-0000000001b0', '{}')$q$,
  $q$R|public.whatsapp_campana_crear('00000000-0000-0000-0005-0000000001b0', '00000000-0000-0000-0005-0000000009b0', 'x', '{}', null)$q$,
  $q$R|public.whatsapp_plantilla_guardar('00000000-0000-0000-0005-0000000009b0', '00000000-0000-0000-0005-0000000001b0', 'ais_hack', 'es', 'MARKETING', 'hola', '[]')$q$,
  $q$R|public.whatsapp_solicitar_recarga('00000000-0000-0000-0005-0000000001b0', gen_random_uuid())$q$,
  $q$R|public.crear_lote_gift_cards_corporativo('00000000-0000-0000-0005-0000000008b5', 1, 1000)$q$,
  $q$R|public.reportes_corporativo('00000000-0000-0000-0005-0000000008b5')$q$,
  $q$R|public.agregar_empleado_corporativo('00000000-0000-0000-0005-0000000008b5', '00000000-0000-0000-0005-0000000000c9')$q$,
  $q$R|public.retirar_empleado_corporativo('00000000-0000-0000-0005-0000000008b5', '00000000-0000-0000-0005-0000000000b3')$q$,
  $q$R|public.crear_ticket_soporte('x', 'x', '00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.admin_programar_comision('00000000-0000-0000-0005-0000000001b0', 5, now() + interval '1 day', 'x')$q$,
  $q$R|public.aprobar_negocio('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.rechazar_negocio('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.suspender_negocio('00000000-0000-0000-0005-0000000001b0', 'x', 'OTRO')$q$,
  $q$R|public.reactivar_negocio_supersu('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$R|public.cancelar_negocio_supersu('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.marcar_negocio_en_mora('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.forzar_reactivacion_pago_externo('00000000-0000-0000-0005-0000000001b0', 'x')$q$,
  $q$R|public.admin_activar_negocio_manual('00000000-0000-0000-0005-0000000001b0', 'ACTIVA', 'SIGNATURE', 'CORTESIA', 'x', 30, null)$q$,
  $q$F|public.is_barberia_de('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$F|public.is_staff_de('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$F|public.tiene_acceso_interno('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$F|public.is_guardian_de_negocio('00000000-0000-0000-0005-0000000001b0')$q$,
  $q$F|public.is_guardian_de_sede('00000000-0000-0000-0005-0000000002b0')$q$,
  $q$F|public.negocio_tiene_funcion('00000000-0000-0000-0005-0000000001b0', 'my_look')$q$
] $f$;

-- Corre las cuatro baterías como el actor de la sesión y falla con el detalle si algo se filtra.
create function public._t_bateria(p_actor text) returns void language plpgsql as $f$
declare q text; r text; n bigint; fallas text[] := '{}'; otras text[] := '{}';
begin
  foreach q in array public._t_lecturas_b() loop
    n := public._t_contar(q);
    if n > 0 then fallas := fallas || format('VE %s fila(s): %s', n, q); end if;
  end loop;
  foreach q in array public._t_escrituras_b() loop
    r := public._t_modificar(q);
    if r <> 'OK' then fallas := fallas || format('%s: %s', r, q); end if;
  end loop;
  foreach q in array public._t_inserciones_b() loop
    r := public._t_insertar(q);
    if r = 'INSERTADO' then fallas := fallas || ('INSERTÓ: ' || q);
    elsif r like 'OK*%' then otras := otras || (substr(r, 5) || ' <- ' || left(split_part(q, '(', 1), 60)); end if;
  end loop;
  foreach q in array public._t_rpcs_b() loop
    r := public._t_rpc(q);
    if r <> 'OK' then fallas := fallas || format('%s: %s', r, substr(q, 3)); end if;
  end loop;
  if cardinality(fallas) > 0 then
    raise exception E'FALLA aislamiento (%): %\n%', p_actor, cardinality(fallas), array_to_string(fallas, E'\n');
  end if;
  if cardinality(otras) > 0 then
    raise notice E'INFO (%): inserciones frenadas por un trigger, no por RLS/privilegio:\n%', p_actor, array_to_string(otras, E'\n');
  end if;
  raise notice 'OK aislamiento (%): % lecturas, % escrituras, % inserciones y % RPC sobre B rechazadas',
    p_actor, cardinality(public._t_lecturas_b()), cardinality(public._t_escrituras_b()),
    cardinality(public._t_inserciones_b()), cardinality(public._t_rpcs_b());
end $f$;

-- El borrado directo en storage.objects lo frena un trigger de Supabase; se habilita para que la
-- barrera probada sea la política RLS de cada bucket.
select set_config('storage.allow_delete_query', 'true', true);

-- ── 1. Aislamiento: cada actor contra B ─────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a1","role":"authenticated"}', true);
select public._t_bateria('dueño A');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a2","role":"authenticated"}', true);
select public._t_bateria('staff guardián A');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a3","role":"authenticated"}', true);
select public._t_bateria('cliente A');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000c9","role":"authenticated"}', true);
select public._t_bateria('autenticado sin relación');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public._t_bateria('anon');
reset role;

-- ── 2. Regresión de los hallazgos corregidos en 125 ─────────────────────────
set local role authenticated;
-- 2a. P0: reserva sin staff → nadie ajeno inicia/finaliza la atención.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000c9","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.iniciar_atencion_reserva('00000000-0000-0000-0005-0000000004b1');
    raise exception 'FALLA 125: un tercero inició la atención de una reserva sin staff';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 125: autorización NULL de iniciar/finalizar_atencion_reserva cerrada';
end $$;

-- 2b. P1: perfil.email no se edita → la invitación de staff de B no se puede robar.
do $$ begin
  begin
    update public.perfil set email = 'ais-invitado-b@test.local' where id = auth.uid();
    raise exception 'FALLA 125: el usuario cambió su perfil.email';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  if exists (select 1 from public.invitacion_staff where id = '00000000-0000-0000-0005-0000000008b6') then
    raise exception 'FALLA 125: el intruso ve la invitación de otro correo';
  end if;
  begin
    perform public.responder_invitacion('00000000-0000-0000-0005-0000000008b6', true);
    raise exception 'FALLA 125: el intruso aceptó una invitación ajena';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 125: perfil.email inmutable por la API; invitaciones ajenas inaccesibles';
end $$;

-- 2c. P1: alta de negocio por la API nunca elige estado ni plan; el dueño no cambia `estado`.
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, estado, plan_codigo)
values ('00000000-0000-0000-0005-0000000001c0', '00000000-0000-0000-0005-0000000000c9', 'Autoactivado', 'ais-autoactivado', 'Cali', 'ACTIVO', 'SIGNATURE');
do $$ begin
  begin
    update public.negocio set estado = 'ACTIVO' where id = '00000000-0000-0000-0005-0000000001c0';
    raise exception 'FALLA 125: el dueño cambió el estado de su negocio';
  exception when others then
    if sqlerrm not like '%NEGOCIO_COLUMNA_PROTEGIDA%' then raise; end if;
  end;
  raise notice 'OK 125: estado del negocio protegido en UPDATE';
end $$;
reset role;
do $$ begin
  if (select estado::text || '/' || plan_codigo::text from public.negocio where id = '00000000-0000-0000-0005-0000000001c0')
     <> 'PENDIENTE_APROBACION/ESSENTIAL' then
    raise exception 'FALLA 125: un negocio nacido por la API eligió su estado o su plan';
  end if;
  raise notice 'OK 125: alta por la API nace PENDIENTE_APROBACION / ESSENTIAL';
end $$;

-- 2d. P1: el cliente no toca buffers de su reserva ni inserta líneas de servicio.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000b3","role":"authenticated"}', true);
do $$ begin
  begin
    update public.reserva set buffer_posterior_minutos = 100000 where id = '00000000-0000-0000-0005-0000000004b0';
    raise exception 'FALLA 125: el cliente amplió el bloqueo de agenda de su reserva';
  exception when others then
    if sqlerrm not like '%RESERVA_EDICION_DIRECTA_NO_PERMITIDA%' then raise; end if;
  end;
  begin
    insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario)
    values ('00000000-0000-0000-0005-0000000004b0', '00000000-0000-0000-0005-0000000003a0', 9999999);
    raise exception 'FALLA 125: el cliente insertó una línea de servicio con precio libre';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 125: buffers de reserva y líneas de servicio solo por funciones';
end $$;

-- 2e. P2: el guardián no mueve su sede a otro negocio (pero sí la edita).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a2","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin
    update public.sede set negocio_id = '00000000-0000-0000-0005-0000000001b0' where id = '00000000-0000-0000-0005-0000000002a0';
    raise exception 'FALLA 125: un guardián movió su sede a otro negocio';
  exception when insufficient_privilege then null;
  end;
  update public.sede set nombre = 'Sede A (editada)' where id = '00000000-0000-0000-0005-0000000002a0';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA 125: el guardián ya no puede editar su sede (% filas)', n; end if;
  raise notice 'OK 125: el guardián edita su sede pero no la cambia de negocio';
end $$;
reset role;

-- ── 3. Acceso legítimo: A sobre A sigue funcionando ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a1","role":"authenticated"}', true);
do $$
declare n int;
begin
  if (select count(*) from public.reserva where id = '00000000-0000-0000-0005-0000000004a0') <> 1
     or (select count(*) from public.pago where id = '00000000-0000-0000-0005-0000000005a0') <> 1
     or (select count(*) from public.cliente_nota where id = '00000000-0000-0000-0005-0000000006a0') <> 1
     or (select count(*) from public.cliente_etiqueta where id = '00000000-0000-0000-0005-0000000006a1') <> 1
     or (select count(*) from public.vista_crm_cliente where negocio_id = '00000000-0000-0000-0005-0000000001a0') <> 1
     or (select count(*) from public.wallet_movimiento where id = '00000000-0000-0000-0005-0000000008a8') <> 1
     or (select count(*) from public.producto where id = '00000000-0000-0000-0005-0000000007a0') <> 1
     or (select count(*) from public.perfil where id = '00000000-0000-0000-0005-0000000000a3') <> 1
     or (select count(*) from public.aceptacion_politica_reserva where reserva_id = '00000000-0000-0000-0005-0000000004a0') <> 1 then
    raise exception 'FALLA legítimo: el dueño A no ve sus propios datos';
  end if;
  -- Las notas no se editan (no hay política UPDATE): se agregan.
  insert into public.cliente_nota (negocio_id, cliente_id, autor_id, texto)
  values ('00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000000a3', auth.uid(), 'Segunda nota A');
  update public.producto set precio = 21000 where id = '00000000-0000-0000-0005-0000000007a0';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA legítimo: el dueño A no puede editar su producto'; end if;
  perform public.saldo_creditos_ia('00000000-0000-0000-0005-0000000001a0');
  perform public.dashboard_resumen_dia('00000000-0000-0000-0005-0000000001a0', null);
  raise notice 'OK legítimo: el dueño A lee y edita lo suyo';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a2","role":"authenticated"}', true);
do $$
declare r public.reserva;
begin
  if (select count(*) from public.reserva where id = '00000000-0000-0000-0005-0000000004a0') <> 1
     or (select count(*) from public.producto where id = '00000000-0000-0000-0005-0000000007a0') <> 1 then
    raise exception 'FALLA legítimo: el staff A no ve su agenda o el inventario de su negocio';
  end if;
  r := public.iniciar_atencion_reserva('00000000-0000-0000-0005-0000000004a0');
  if r.estado <> 'EN_CURSO' then raise exception 'FALLA legítimo: el staff asignado no pudo iniciar la atención'; end if;
  r := public.finalizar_atencion_reserva('00000000-0000-0000-0005-0000000004a0');
  if r.checkout_at is null then raise exception 'FALLA legítimo: el staff asignado no pudo finalizar la atención'; end if;
  perform public.dashboard_resumen_dia('00000000-0000-0000-0005-0000000001a0', '00000000-0000-0000-0005-0000000002a0');
  raise notice 'OK legítimo: el staff A atiende su reserva y el guardián ve el resumen de su sede';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.reserva where id = '00000000-0000-0000-0005-0000000004a0') <> 1
     or (select count(*) from public.pago where id = '00000000-0000-0000-0005-0000000005a0') <> 1
     or (select count(*) from public.aceptacion_politica_reserva where reserva_id = '00000000-0000-0000-0005-0000000004a0') <> 1 then
    raise exception 'FALLA legítimo: el cliente A no ve su reserva, su pago o su aceptación';
  end if;
  raise notice 'OK legítimo: el cliente A ve lo suyo';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0005-0000000000b1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'crm-fotos' and name like '00000000-0000-0000-0005-0000000001b0/%') <> 1
     or (select count(*) from storage.objects where bucket_id = 'soporte-adjuntos' and name like '00000000-0000-0000-0005-0000000000b1/%') <> 1
     or (select count(*) from public.reembolso where id = '00000000-0000-0000-0005-0000000008b4') <> 1 then
    raise exception 'FALLA legítimo: el dueño B no ve sus archivos o sus reembolsos';
  end if;
  raise notice 'OK legítimo: el dueño B ve sus fotos CRM, adjuntos y reembolsos';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE AISLAMIENTO MULTIEMPRESA PASARON'; end $$;
rollback;
