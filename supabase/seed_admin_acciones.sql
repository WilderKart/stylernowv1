-- DATOS FICTICIOS para la prueba de las Server Actions de /admin (solo base LOCAL de Docker; no es una migración).
-- Crea objetos en el estado correcto para que cada acción administrativa PUEDA ejecutarse: así, si un actor sin privilegio lograra
-- ejecutarla, el cambio se vería en la base. Idempotente. Se aplica después de seed_datos_ricos + seed_pruebas.
\set ON_ERROR_STOP 1
begin;

-- Cuenta "víctima" con UUID v4 válido (zod exige versión/variante RFC; los ids de las cuentas de prueba no la cumplen).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'victima@pruebas.test', crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;
insert into public.perfil (id, nombre, email, registro_pendiente, password_establecida) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Víctima Prueba', 'victima@pruebas.test', false, true)
on conflict (id) do nothing;

-- Negocios en el estado que exige cada acción (owner: dueno-b).
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0006-0000000005a1', '00000000-0000-0000-0006-0000000000b1', 'Adm Pendiente 1',  'adm-pend-1',  'Cali', 'CO', 'PENDIENTE_APROBACION'),
  ('00000000-0000-0000-0006-0000000005a2', '00000000-0000-0000-0006-0000000000b1', 'Adm Pendiente 2',  'adm-pend-2',  'Cali', 'CO', 'PENDIENTE_APROBACION'),
  ('00000000-0000-0000-0006-0000000005b1', '00000000-0000-0000-0006-0000000000b1', 'Adm Activo 1',     'adm-act-1',   'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000005b2', '00000000-0000-0000-0006-0000000000b1', 'Adm Activo 2',     'adm-act-2',   'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000005b3', '00000000-0000-0000-0006-0000000000b1', 'Adm Activo 3',     'adm-act-3',   'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000005b4', '00000000-0000-0000-0006-0000000000b1', 'Adm Activo 4',     'adm-act-4',   'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0006-0000000005c1', '00000000-0000-0000-0006-0000000000b1', 'Adm Suspendido 1', 'adm-susp-1',  'Cali', 'CO', 'SUSPENDIDO'),
  ('00000000-0000-0000-0006-0000000005c2', '00000000-0000-0000-0006-0000000000b1', 'Adm Suspendido 2', 'adm-susp-2',  'Cali', 'CO', 'SUSPENDIDO')
on conflict (id) do update set estado = excluded.estado, owner_user_id = excluded.owner_user_id;
-- Suscripciones en el estado que exige cada acción (se REPONEN siempre: la prueba consume objetos: aprobar, cancelar, borrar banner…).
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, suspendido_causa) values
  ('00000000-0000-0000-0006-0000000005b1', 'STUDIO', 'ACTIVA',     now() + interval '30 days', null),
  ('00000000-0000-0000-0006-0000000005b2', 'STUDIO', 'ACTIVA',     now() + interval '30 days', null),
  ('00000000-0000-0000-0006-0000000005b3', 'STUDIO', 'ACTIVA',     now() + interval '30 days', null),
  ('00000000-0000-0000-0006-0000000005b4', 'STUDIO', 'ACTIVA',     now() + interval '30 days', null),
  ('00000000-0000-0000-0006-0000000005c1', 'STUDIO', 'EN_MORA',    now() + interval '30 days', null),
  ('00000000-0000-0000-0006-0000000005c2', 'STUDIO', 'SUSPENDIDA', now() + interval '30 days', 'IMPAGO')
on conflict (negocio_id) do update set estado = excluded.estado, suspendido_causa = excluded.suspendido_causa, activacion_manual = false;

insert into public.banner_home (id, imagen_url, texto, activo, orden) values ('00000000-0000-0000-0006-0000000006a1', 'https://ejemplo.test/banner.png', 'Banner prueba', true, 1) on conflict (id) do nothing;
insert into public.ticket_soporte (id, creado_por, negocio_id, asunto) values ('00000000-0000-0000-0006-0000000006b1', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', 'Ticket de prueba') on conflict (id) do nothing;
insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje) select '00000000-0000-0000-0006-0000000006b1', '00000000-0000-0000-0006-0000000000a3', 'CLIENTE', 'Hola, necesito ayuda'
 where not exists (select 1 from public.ticket_mensaje where ticket_id = '00000000-0000-0000-0006-0000000006b1');
insert into public.lealtad_fraude_evento (id, tipo, cliente_id, negocio_id, severidad) values ('00000000-0000-0000-0006-0000000006c1', 'ABUSO_REFERIDO', '00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0006-0000000001a0', 'MEDIA') on conflict (id) do nothing;
commit;
