-- DATOS AMPLIOS DE PRUEBA para la base LOCAL (negocios A y B con datos en decenas de tablas).
-- Derivado de tests/sql/aislamiento_multiempresa.sql (misma siembra, ids con prefijo 0006). Se aplica ANTES de seed_pruebas.sql,
-- que asigna contraseñas/correos reales a las cuentas. No incluye objetos de Storage (los archivos irán a Cloudinary).
\set ON_ERROR_STOP 1
begin;
-- Negocio B (…01b0): dueño b1, staff b2, cliente b3.   c9: autenticado sin relación con nadie.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0006-0000000000a1', 'sem-dueno-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000a2', 'sem-staff-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000a3', 'sem-cliente-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000b1', 'sem-dueno-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000b2', 'sem-staff-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000b3', 'sem-cliente-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0006-0000000000c9', 'sem-intruso@test.local', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, email) values
  ('00000000-0000-0000-0006-0000000000a1', 'Dueño A', 'sem-dueno-a@test.local'),
  ('00000000-0000-0000-0006-0000000000a2', 'Staff A', 'sem-staff-a@test.local'),
  ('00000000-0000-0000-0006-0000000000a3', 'Cliente A', 'sem-cliente-a@test.local'),
  ('00000000-0000-0000-0006-0000000000b1', 'Dueño B', 'sem-dueno-b@test.local'),
  ('00000000-0000-0000-0006-0000000000b2', 'Staff B', 'sem-staff-b@test.local'),
  ('00000000-0000-0000-0006-0000000000b3', 'Cliente B', 'sem-cliente-b@test.local'),
  ('00000000-0000-0000-0006-0000000000c9', 'Intruso', 'sem-intruso@test.local')
on conflict (id) do nothing;

-- Ambos ACTIVOS: así lo público (marketplace) es visible y se prueba que lo interno no lo es.
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000000a1', 'Negocio A', 'sem-negocio-a', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b1', 'Negocio B', 'sem-negocio-b', 'Cali', 'CO', 'ACTIVO');
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000001b0');
-- Wallet con id conocido (handle_new_negocio la crea con id aleatorio).
update public.wallet set id = '00000000-0000-0000-0006-0000000008a9' where negocio_id = '00000000-0000-0000-0006-0000000001a0';
update public.wallet set id = '00000000-0000-0000-0006-0000000008b9' where negocio_id = '00000000-0000-0000-0006-0000000001b0';
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at) values
  ('00000000-0000-0000-0006-0000000001a0', 'CONECTADA', 'SANDBOX', 'sem-a', 'v1.iv.tag.datos', now() + interval '180 days', now()),
  ('00000000-0000-0000-0006-0000000001b0', 'CONECTADA', 'SANDBOX', 'sem-b', 'v1.iv.tag.datos', now() + interval '180 days', now());

insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0006-0000000002a0', '00000000-0000-0000-0006-0000000001a0', 'Sede A', 'Cra 1', 'Cali'),
  ('00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000001b0', 'Sede B', 'Cra 2', 'Cali');
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('00000000-0000-0000-0006-0000000003a0', '00000000-0000-0000-0006-0000000001a0', 'Corte A', 30, 30000, 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000003b0', '00000000-0000-0000-0006-0000000001b0', 'Corte B', 30, 30000, 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000003b1', '00000000-0000-0000-0006-0000000001b0', 'Interno B', 30, 1, 'INACTIVO');

insert into public.staff (usuario_id, nombre) values
  ('00000000-0000-0000-0006-0000000000a2', 'Staff A'), ('00000000-0000-0000-0006-0000000000b2', 'Staff B')
on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0006-0000000002a1', '00000000-0000-0000-0006-0000000000a2', '00000000-0000-0000-0006-0000000001a0',
   '00000000-0000-0000-0006-0000000002a0', 'ACTIVO', true, 40, now()),
  ('00000000-0000-0000-0006-0000000002b1', '00000000-0000-0000-0006-0000000000b2', '00000000-0000-0000-0006-0000000001b0',
   '00000000-0000-0000-0006-0000000002b0', 'ACTIVO', false, 40, now());

insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0006-0000000004a0', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0',
   '00000000-0000-0000-0006-0000000002a0', '00000000-0000-0000-0006-0000000000a2', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000),
  ('00000000-0000-0000-0006-0000000004b0', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0',
   '00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000000b2', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000),
  -- Sin staff asignado: el caso del P0 de autorización NULL.
  ('00000000-0000-0000-0006-0000000004b1', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0',
   '00000000-0000-0000-0006-0000000002b0', null, now() + interval '40 hours', now() + interval '41 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0006-0000000004b2', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0',
   '00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000000b2', now() - interval '50 hours', now() - interval '49 hours', 'COMPLETADA', 30000, 0);
insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario) values
  ('00000000-0000-0000-0006-0000000004a0', '00000000-0000-0000-0006-0000000003a0', 30000),
  ('00000000-0000-0000-0006-0000000004b0', '00000000-0000-0000-0006-0000000003b0', 30000),
  ('00000000-0000-0000-0006-0000000004b2', '00000000-0000-0000-0006-0000000003b0', 30000);

insert into public.aceptacion_politica_reserva (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, zona_horaria, monto_sena, hora_inicio_reserva) values
  ('00000000-0000-0000-0006-0000000004a0', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', '{}', 'acepto', 'v1', 'America/Bogota', 6000, now() + interval '30 hours'),
  ('00000000-0000-0000-0006-0000000004b0', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0', '{}', 'acepto', 'v1', 'America/Bogota', 6000, now() + interval '30 hours');
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, id_transaccion_pasarela, comision_plataforma_monto) values
  ('00000000-0000-0000-0006-0000000005a0', '00000000-0000-0000-0006-0000000004a0', '00000000-0000-0000-0006-0000000001a0', 'SENA', 6000, 'APROBADO', 'sem-tx-a', 0),
  ('00000000-0000-0000-0006-0000000005b0', '00000000-0000-0000-0006-0000000004b0', '00000000-0000-0000-0006-0000000001b0', 'SENA', 6000, 'APROBADO', 'sem-tx-b', 0);
insert into public.reembolso (id, pago_id, reserva_id, negocio_id, cliente_id, monto, pct, motivo, origen, idempotency_key) values
  ('00000000-0000-0000-0006-0000000008b4', '00000000-0000-0000-0006-0000000005b0', '00000000-0000-0000-0006-0000000004b0',
   '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b3', 600, 10, 'CORTESIA_COMERCIAL', 'AJUSTE', 'sem-reembolso-b');

insert into public.cliente_nota (id, negocio_id, cliente_id, autor_id, texto) values
  ('00000000-0000-0000-0006-0000000006a0', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000000a1', 'Nota A'),
  ('00000000-0000-0000-0006-0000000006b0', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000000b1', 'Nota privada B');
insert into public.cliente_etiqueta (id, negocio_id, cliente_id, etiqueta, creado_por) values
  ('00000000-0000-0000-0006-0000000006a1', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000000a3', 'frecuente', '00000000-0000-0000-0006-0000000000a1'),
  ('00000000-0000-0000-0006-0000000006b1', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b3', 'vip', '00000000-0000-0000-0006-0000000000b1');
insert into public.reserva_foto (id, reserva_id, negocio_id, cliente_id, url, consentimiento, subido_por, momento) values
  ('00000000-0000-0000-0006-0000000006b2', '00000000-0000-0000-0006-0000000004b2', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b3',
   '00000000-0000-0000-0006-0000000001b0/00000000-0000-0000-0006-0000000000b3/despues.jpg', true, '00000000-0000-0000-0006-0000000000b1', 'DESPUES');

insert into public.producto (id, negocio_id, nombre, precio) values
  ('00000000-0000-0000-0006-0000000007a0', '00000000-0000-0000-0006-0000000001a0', 'Cera A', 20000),
  ('00000000-0000-0000-0006-0000000007b0', '00000000-0000-0000-0006-0000000001b0', 'Cera B', 20000);
insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo) values
  ('00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000007a0', '00000000-0000-0000-0006-0000000002a0', 10, 1),
  ('00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000007b0', '00000000-0000-0000-0006-0000000002b0', 10, 1);
insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, actor_id) values
  ('00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000007b0', 'ENTRADA', 10, '00000000-0000-0000-0006-0000000000b1');

insert into public.wallet_movimiento (id, wallet_id, tipo, monto, referencia_tipo, referencia_id) values
  ('00000000-0000-0000-0006-0000000008a8', '00000000-0000-0000-0006-0000000008a9', 'AJUSTE', 1, 'prueba', gen_random_uuid()),
  ('00000000-0000-0000-0006-0000000008b8', '00000000-0000-0000-0006-0000000008b9', 'AJUSTE', 1, 'prueba', gen_random_uuid());
insert into public.egreso_caja (id, negocio_id, sede_id, monto, concepto, categoria, registrado_por) values
  ('00000000-0000-0000-0006-0000000008b0', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', 5000, 'Aseo B', 'ASEO', '00000000-0000-0000-0006-0000000000b1');
insert into public.gift_card (id, codigo, pin_hash, negocio_id, monto_original, saldo_actual, comprador_id) values
  ('00000000-0000-0000-0006-0000000008b1', 'SEMB000001', 'x', '00000000-0000-0000-0006-0000000001b0', 50000, 50000, '00000000-0000-0000-0006-0000000000b3');
insert into public.membresia_plan (id, negocio_id, nombre, precio, duracion_meses, activo) values
  ('00000000-0000-0000-0006-0000000008b2', '00000000-0000-0000-0006-0000000001b0', 'Plan interno B', 80000, 1, false);
insert into public.cliente_membresia (id, cliente_id, plan_id, negocio_id, fecha_proximo_cobro) values
  ('00000000-0000-0000-0006-0000000008b3', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000008b2', '00000000-0000-0000-0006-0000000001b0', now() + interval '30 days');
-- Cuenta corporativa recién creada: sin admin asignado (así nace en crear_cuenta_corporativa).
insert into public.corporativo_cuenta (id, nombre_empresa, contacto_email, cupos_totales, vigencia_fin, negocio_id) values
  ('00000000-0000-0000-0006-0000000008b5', 'Empresa B', 'rrhh@empresa-b.test', 10, current_date + 90, '00000000-0000-0000-0006-0000000001b0');
insert into public.invitacion_staff (id, negocio_id, email, invitado_por, comision_pct) values
  ('00000000-0000-0000-0006-0000000008b6', '00000000-0000-0000-0006-0000000001b0', 'sem-invitado-b@test.local', '00000000-0000-0000-0006-0000000000b1', 40);

insert into public.whatsapp_plantilla (id, negocio_id, nombre, categoria, cuerpo) values
  ('00000000-0000-0000-0006-0000000009b0', '00000000-0000-0000-0006-0000000001b0', 'ais_plantilla_b', 'MARKETING', 'Hola {{1}}');
insert into public.whatsapp_mensaje (id, negocio_id, plantilla_id, cliente_id, telefono, categoria) values
  ('00000000-0000-0000-0006-0000000009b1', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000009b0',
   '00000000-0000-0000-0006-0000000000b3', '573001112233', 'MARKETING');
insert into public.evento_auditoria (id, entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id) values
  ('00000000-0000-0000-0006-0000000009b2', 'negocio', '00000000-0000-0000-0006-0000000001b0', 'PRUEBA_AISLAMIENTO', 'BARBERIA',
   '00000000-0000-0000-0006-0000000000b1', '00000000-0000-0000-0006-0000000001b0');

commit;
