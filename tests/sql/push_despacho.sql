-- Prueba de la migración 198 (push: despacho inmediato, soporte y actividad). Ejecutar contra la base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/push_despacho.sql
-- Antes (una vez), para que el aviso de despacho no apunte a producción:
--   select vault.update_secret(id, 'http://host.docker.internal:3100') from vault.secrets where name = 'notif_despacho_url';
-- Todo corre dentro de una transacción que se revierte (pg_net no llega a enviar nada).
begin;

insert into auth.users (id, email, aud, role) values
  ('f1111111-1111-4111-8111-111111111111', 'push_dueno@t.l', 'authenticated', 'authenticated'),
  ('f2222222-2222-4222-8222-222222222222', 'push_staff@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('f1111111-1111-4111-8111-111111111111', 'Dueño Push', false),
  ('f2222222-2222-4222-8222-222222222222', 'Ana Barbera', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = false;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo) values
  ('fffffff1-1111-4111-8111-111111111111', 'f1111111-1111-4111-8111-111111111111', 'Barbería Push', 'push-test', 'Cali', 'CO', 'STUDIO');

-- Suscripciones falsas (formato válido) para el dueño y para el SuperSU de la base local.
select set_config('t.super', coalesce((select id::text from public.perfil where es_supersu limit 1), ''), true);
insert into public.notificacion_push_suscripcion (usuario_id, endpoint, p256dh, auth) values
  ('f1111111-1111-4111-8111-111111111111', 'https://fcm.googleapis.com/fcm/send/prueba-dueno-0001',
   'BP' || repeat('A', 85), repeat('B', 22)),
  (current_setting('t.super')::uuid, 'https://fcm.googleapis.com/fcm/send/prueba-super-0001',
   'BP' || repeat('C', 85), repeat('D', 22));

do $$
declare
  v_super uuid := nullif(current_setting('t.super', true), '')::uuid;
  v_conv uuid;
  v_n integer;
  v_estado text;
begin
  if v_super is null then raise exception 'La base local no tiene un SuperSU para la prueba'; end if;

  -- ── Soporte: barbería → SuperSU ─────────────────────────────────────────
  insert into public.soporte_conversacion (negocio_id) values ('fffffff1-1111-4111-8111-111111111111') returning id into v_conv;
  insert into public.soporte_mensaje (conversacion_id, negocio_id, remitente_rol, remitente_id, cuerpo)
    values (v_conv, 'fffffff1-1111-4111-8111-111111111111', 'BARBERIA', 'f1111111-1111-4111-8111-111111111111', 'Hola, necesito ayuda con mi llave');
  select count(*) into v_n from public.notificacion_outbox
    where evento = 'SOPORTE_MENSAJE_ADMIN' and usuario_id = v_super and canal = 'PUSH' and estado = 'PENDIENTE';
  if v_n <> 1 then raise exception 'FALLO: el mensaje de la barbería debe avisar al SuperSU (hay %)', v_n; end if;

  -- ── Soporte: SuperSU → dueño ────────────────────────────────────────────
  insert into public.soporte_mensaje (conversacion_id, negocio_id, remitente_rol, remitente_id, cuerpo)
    values (v_conv, 'fffffff1-1111-4111-8111-111111111111', 'SUPERSU', v_super, '¡Hola! Entra a Finanzas > Pagos');
  select count(*) into v_n from public.notificacion_outbox
    where evento = 'SOPORTE_MENSAJE_NEGOCIO' and usuario_id = 'f1111111-1111-4111-8111-111111111111' and canal = 'PUSH' and estado = 'PENDIENTE';
  if v_n <> 1 then raise exception 'FALLO: la respuesta del SuperSU debe avisar al dueño (hay %)', v_n; end if;
  -- El texto va recortado y sin datos sensibles.
  select o.datos ->> 'extracto' into v_estado from public.notificacion_outbox o where o.evento = 'SOPORTE_MENSAJE_NEGOCIO' limit 1;
  if v_estado is distinct from '¡Hola! Entra a Finanzas > Pagos' then raise exception 'FALLO: extracto inesperado: %', v_estado; end if;

  -- ── Actividad / auditoría ───────────────────────────────────────────────
  -- Otra persona (staff) cambia algo del negocio → avisa al dueño.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, origen)
    values ('negocio', 'fffffff1-1111-4111-8111-111111111111', 'PERFIL_ACTUALIZADO', 'STAFF', 'f2222222-2222-4222-8222-222222222222', 'fffffff1-1111-4111-8111-111111111111', 'PANEL');
  select count(*) into v_n from public.notificacion_outbox
    where evento = 'NEGOCIO_ACTIVIDAD' and usuario_id = 'f1111111-1111-4111-8111-111111111111' and canal = 'PUSH';
  if v_n <> 1 then raise exception 'FALLO: lo que hace otra persona debe avisar al dueño (hay %)', v_n; end if;
  select o.datos ->> 'detalle' into v_estado from public.notificacion_outbox o where o.evento = 'NEGOCIO_ACTIVIDAD' limit 1;
  if v_estado is distinct from 'Perfil actualizado · Ana Barbera' then raise exception 'FALLO: detalle inesperado: %', v_estado; end if;

  -- La misma acción en el mismo negocio dentro de 2 minutos no repite el aviso.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, origen)
    values ('negocio', 'fffffff1-1111-4111-8111-111111111111', 'PERFIL_ACTUALIZADO', 'STAFF', 'f2222222-2222-4222-8222-222222222222', 'fffffff1-1111-4111-8111-111111111111', 'PANEL');
  select count(*) into v_n from public.notificacion_outbox where evento = 'NEGOCIO_ACTIVIDAD';
  if v_n <> 1 then raise exception 'FALLO: debe agrupar acciones iguales (hay %)', v_n; end if;

  -- Lo que hace el propio dueño no se le avisa.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, origen)
    values ('servicio', 'fffffff1-1111-4111-8111-111111111111', 'SERVICIO_CREADO', 'BARBERIA', 'f1111111-1111-4111-8111-111111111111', 'fffffff1-1111-4111-8111-111111111111', 'PANEL');
  select count(*) into v_n from public.notificacion_outbox where evento = 'NEGOCIO_ACTIVIDAD';
  if v_n <> 1 then raise exception 'FALLO: no se debe avisar al dueño de sus propios cambios (hay %)', v_n; end if;

  -- Lecturas, soporte y SQL/migraciones se omiten.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, origen) values
    ('documento', 'fffffff1-1111-4111-8111-111111111111', 'DOCUMENTO_VERIFICACION_LEIDO', 'STAFF', 'f2222222-2222-4222-8222-222222222222', 'fffffff1-1111-4111-8111-111111111111', 'PANEL'),
    ('soporte_mensaje', 'fffffff1-1111-4111-8111-111111111111', 'SOPORTE_MENSAJE_ENVIADO', 'STAFF', 'f2222222-2222-4222-8222-222222222222', 'fffffff1-1111-4111-8111-111111111111', 'PANEL'),
    ('sede', 'fffffff1-1111-4111-8111-111111111111', 'SEDE_CREADA', 'STAFF', 'f2222222-2222-4222-8222-222222222222', 'fffffff1-1111-4111-8111-111111111111', 'SQL');
  select count(*) into v_n from public.notificacion_outbox where evento = 'NEGOCIO_ACTIVIDAD';
  if v_n <> 1 then raise exception 'FALLO: lecturas, soporte y SQL no deben avisar (hay %)', v_n; end if;

  -- Un aviso encolado queda PENDIENTE (lo envía el worker; ENVIADO exige evidencia del proveedor).
  select count(*) into v_n from public.notificacion_outbox where canal = 'PUSH' and estado <> 'PENDIENTE';
  if v_n <> 0 then raise exception 'FALLO: los avisos nuevos deben quedar PENDIENTES'; end if;
end $$;

-- ── Permisos: solo service_role ejecuta las funciones nuevas ───────────────
do $$
declare
  f text;
  r text;
begin
  foreach f in array array['public.notif_despacho_secreto()', 'public.push_vapid_leer()', 'public.push_vapid_guardar(text, text)'] loop
    foreach r in array array['public', 'anon', 'authenticated'] loop
      if has_function_privilege(case r when 'public' then 'public' else r end, f, 'execute') then
        raise exception 'FALLO: % puede ejecutar %', r, f;
      end if;
    end loop;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'FALLO: service_role debe poder ejecutar %', f; end if;
  end loop;

  -- El par VAPID solo se guarda una vez y con formato válido.
  begin
    perform public.push_vapid_guardar('corta', 'x');
    raise exception 'FALLO: aceptó claves con formato inválido';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  raise notice 'OK push despacho, soporte y actividad';
end $$;
rollback;
