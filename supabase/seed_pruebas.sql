-- SEMILLA DE PRUEBAS (solo base LOCAL de Docker, datos ficticios). NO es una migración y NO se aplica sola.
-- La aplica scripts/entorno-local/sembrar.sh, que inyecta la contraseña (:'pw') desde un archivo local ignorado por Git.
-- Cuentas (todas @pruebas.test, dominio reservado que no existe):
--   super · dueno-a · guardian-a · pro-a1 · pro-a2 · cliente-a · dueno-b · pro-b1 · cliente-b · intruso
-- Negocio A "Barbería A" (Cali): dueño, guardián de sede, 2 profesionales, 1 cliente.
-- Negocio B "Barbería B" (Cali): dueño, 1 profesional, 1 cliente.  intruso: autenticado sin relación con nadie.
-- Idempotente: se puede volver a correr.
\set ON_ERROR_STOP 1
begin;

create temp table _u (id uuid, alias text, nombre text, supersu boolean) on commit drop;
insert into _u values
  ('00000000-0000-0000-0006-0000000000f0', 'super',     'Super Admin Prueba', true),
  ('00000000-0000-0000-0006-0000000000a1', 'dueno-a',   'Dueño A',            false),
  ('00000000-0000-0000-0006-0000000000a2', 'guardian-a','Guardián A',         false),
  ('00000000-0000-0000-0006-0000000000a4', 'pro-a1',    'Profesional A1',     false),
  ('00000000-0000-0000-0006-0000000000a5', 'pro-a2',    'Profesional A2',     false),
  ('00000000-0000-0000-0006-0000000000a3', 'cliente-a', 'Cliente A',          false),
  ('00000000-0000-0000-0006-0000000000b1', 'dueno-b',   'Dueño B',            false),
  ('00000000-0000-0000-0006-0000000000b2', 'pro-b1',    'Profesional B1',     false),
  ('00000000-0000-0000-0006-0000000000b3', 'cliente-b', 'Cliente B',          false),
  ('00000000-0000-0000-0006-0000000000b4', 'guardian-b','Guardián B',         false),
  ('00000000-0000-0000-0006-0000000000c9', 'intruso',   'Intruso',            false);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', alias || '@pruebas.test',
  crypt(:'pw', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
from _u
on conflict (id) do update set instance_id = excluded.instance_id, aud = 'authenticated', role = 'authenticated', encrypted_password = excluded.encrypted_password, email = excluded.email, email_confirmed_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data, raw_user_meta_data = excluded.raw_user_meta_data, created_at = coalesce(auth.users.created_at, now()), updated_at = now(), confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '', email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = '';

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', alias || '@pruebas.test', 'email_verified', true), now(), now(), now()
from _u
on conflict (provider_id, provider) do nothing;

insert into public.perfil (id, nombre, email, es_supersu, registro_pendiente, password_establecida)
select id, nombre, alias || '@pruebas.test', supersu, false, true from _u
on conflict (id) do update set nombre = excluded.nombre, email = excluded.email, es_supersu = excluded.es_supersu, registro_pendiente = false;

-- Negocios activos con suscripción ACTIVA (el trigger de alta crea wallet y suscripción).
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000000a1', 'Barbería A', 'prueba-barberia-a', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000000b1', 'Barbería B', 'prueba-barberia-b', 'Cali', 'CO', 'ACTIVO')
on conflict (id) do nothing;
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000001b0');

insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0006-0000000002a0', '00000000-0000-0000-0006-0000000001a0', 'Sede A', 'Cra 1 # 1-1', 'Cali'),
  ('00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000001b0', 'Sede B', 'Cra 2 # 2-2', 'Cali')
on conflict (id) do nothing;

insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('00000000-0000-0000-0006-0000000003a0', '00000000-0000-0000-0006-0000000001a0', 'Corte A', 30, 30000, 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000003b0', '00000000-0000-0000-0006-0000000001b0', 'Corte B', 30, 30000, 'ACTIVO')
on conflict (id) do nothing;

insert into public.staff (usuario_id, nombre) values
  ('00000000-0000-0000-0006-0000000000a2', 'Guardián A'), ('00000000-0000-0000-0006-0000000000a4', 'Profesional A1'),
  ('00000000-0000-0000-0006-0000000000a5', 'Profesional A2'), ('00000000-0000-0000-0006-0000000000b2', 'Profesional B1'), ('00000000-0000-0000-0006-0000000000b4', 'Guardián B')
on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0006-0000000002a1', '00000000-0000-0000-0006-0000000000a2', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', 'ACTIVO', true,  40, now()),
  ('00000000-0000-0000-0006-0000000002a2', '00000000-0000-0000-0006-0000000000a4', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', 'ACTIVO', false, 40, now()),
  ('00000000-0000-0000-0006-0000000002a3', '00000000-0000-0000-0006-0000000000a5', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', 'ACTIVO', false, 40, now()),
  ('00000000-0000-0000-0006-0000000002b1', '00000000-0000-0000-0006-0000000000b2', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', 'ACTIVO', false, 40, now()),
  ('00000000-0000-0000-0006-0000000002b2', '00000000-0000-0000-0006-0000000000b4', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', 'ACTIVO', true, 40, now())
on conflict (id) do nothing;

-- Una reserva por profesional (A1, A2, B1) y una sin profesional en cada negocio (caso NULL del hotfix).
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0006-0000000004a1', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', '00000000-0000-0000-0006-0000000000a4', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0006-0000000004a2', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', '00000000-0000-0000-0006-0000000000a5', now() + interval '32 hours', now() + interval '33 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0006-0000000004a3', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', '00000000-0000-0000-0006-0000000002a0', null,                                   now() + interval '34 hours', now() + interval '35 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0006-0000000004b1', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', '00000000-0000-0000-0006-0000000000b2', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 0),
  ('00000000-0000-0000-0006-0000000004b3', '00000000-0000-0000-0006-0000000000b3', '00000000-0000-0000-0006-0000000001b0', '00000000-0000-0000-0006-0000000002b0', null,                                   now() + interval '34 hours', now() + interval '35 hours', 'CONFIRMADA', 30000, 0)
on conflict (id) do nothing;
insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario) values
  ('00000000-0000-0000-0006-0000000004a1', '00000000-0000-0000-0006-0000000003a0', 30000),
  ('00000000-0000-0000-0006-0000000004a2', '00000000-0000-0000-0006-0000000003a0', 30000),
  ('00000000-0000-0000-0006-0000000004a3', '00000000-0000-0000-0006-0000000003a0', 30000),
  ('00000000-0000-0000-0006-0000000004b1', '00000000-0000-0000-0006-0000000003b0', 30000),
  ('00000000-0000-0000-0006-0000000004b3', '00000000-0000-0000-0006-0000000003b0', 30000)
on conflict do nothing;

commit;
