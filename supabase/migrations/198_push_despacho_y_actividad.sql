-- 198 — Notificaciones push de punta a punta.
--
--  1. Claves VAPID en Vault: el servidor las genera una vez y las guarda cifradas en la base; no hace falta pegar secretos en Vercel.
--     (Si VAPID_* existe como variable de entorno, esa tiene prioridad: ver src/lib/notificaciones/claves-vapid.ts.)
--  2. Despacho inmediato: al encolarse un aviso (outbox), la base le avisa a la app con pg_net para que lo envíe en segundos.
--     Antes solo se procesaba una vez al día (/api/cron/diario); ese cron se conserva como red de seguridad.
--  3. Eventos nuevos: mensajes de soporte (ambos sentidos) y actividad/auditoría del negocio hecha por OTRA persona.
--
-- Zero Trust: todas las funciones nuevas son SECURITY DEFINER y SOLO service_role puede ejecutarlas (se revocan public, anon y
-- authenticated: los tres son independientes). El secreto del despacho se genera dentro de la base y nunca sale en un log ni en
-- una variable de entorno. Los triggers jamás hacen fallar la operación que los dispara.

create extension if not exists pg_net with schema extensions;

-- ── 1. Secretos en Vault ──────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notif_despacho') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notif_despacho',
      'Secreto con el que la base autoriza el despacho inmediato de notificaciones (Authorization: Bearer).');
  end if;
  if not exists (select 1 from vault.secrets where name = 'notif_despacho_url') then
    -- En local se cambia por http://host.docker.internal:3100; ver tests/sql/push_despacho.sql.
    perform vault.create_secret('https://app.stylernow.com', 'notif_despacho_url', 'Origen de la app a la que la base avisa de avisos nuevos.');
  end if;
end $$;

create or replace function public.notif_despacho_secreto()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'notif_despacho' limit 1;
$$;
revoke all on function public.notif_despacho_secreto() from public, anon, authenticated;
grant execute on function public.notif_despacho_secreto() to service_role;

-- Par VAPID: lo lee el servidor (service_role) y se guarda UNA sola vez (si ya hay uno, no se pisa).
create or replace function public.push_vapid_leer()
returns table (publica text, privada text)
language sql stable security definer set search_path = public, vault as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_publica' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_privada' limit 1);
$$;
revoke all on function public.push_vapid_leer() from public, anon, authenticated;
grant execute on function public.push_vapid_leer() to service_role;

create or replace function public.push_vapid_guardar(p_publica text, p_privada text)
returns boolean language plpgsql security definer set search_path = public, vault as $$
begin
  -- Formato base64url de web-push: pública 65 bytes (87 caracteres), privada 32 bytes (43 caracteres).
  if p_publica is null or p_privada is null or p_publica !~ '^[A-Za-z0-9_-]{87}$' or p_privada !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'CLAVES_VAPID_INVALIDAS';
  end if;
  perform pg_advisory_xact_lock(hashtext('push_vapid'));
  if exists (select 1 from vault.secrets where name in ('vapid_publica', 'vapid_privada')) then
    return false;
  end if;
  perform vault.create_secret(p_publica, 'vapid_publica', 'Clave pública VAPID (web push).');
  perform vault.create_secret(p_privada, 'vapid_privada', 'Clave privada VAPID (web push).');
  return true;
end $$;
revoke all on function public.push_vapid_guardar(text, text) from public, anon, authenticated;
grant execute on function public.push_vapid_guardar(text, text) to service_role;

-- ── 2. Despacho inmediato ─────────────────────────────────────────────────
-- Un solo aviso por sentencia (aunque se encolen muchas filas). pg_net envía DESPUÉS del commit, con la fila ya visible.
create or replace function public.trg_notif_outbox_despachar()
returns trigger language plpgsql security definer set search_path = public, vault, net as $$
declare
  v_secreto text;
  v_url text;
begin
  begin
    if not exists (select 1 from nuevas where estado = 'PENDIENTE' and canal in ('EMAIL', 'PUSH', 'PANEL')) then
      return null;
    end if;
    select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'notif_despacho' limit 1;
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notif_despacho_url' limit 1;
    if v_secreto is null or v_url is null then return null; end if;
    perform net.http_post(
      url := rtrim(v_url, '/') || '/api/notificaciones/despachar',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secreto),
      body := '{}'::jsonb,
      timeout_milliseconds := 8000);
  exception when others then
    null; -- el cron diario recoge lo pendiente; nunca se rompe el INSERT
  end;
  return null;
end $$;
revoke all on function public.trg_notif_outbox_despachar() from public, anon, authenticated;

drop trigger if exists notif_outbox_despachar on public.notificacion_outbox;
create trigger notif_outbox_despachar
  after insert on public.notificacion_outbox
  referencing new table as nuevas
  for each statement execute function public.trg_notif_outbox_despachar();

-- ── 3. Eventos y plantillas nuevas ────────────────────────────────────────
insert into public.notificacion_evento (codigo, categoria, audiencia, esencial, descripcion_es, descripcion_en) values
  ('SOPORTE_MENSAJE_NEGOCIO', 'TRANSACCIONAL', 'NEGOCIO', false, 'Respuesta del equipo de soporte', 'Reply from the support team'),
  ('SOPORTE_MENSAJE_ADMIN',   'TRANSACCIONAL', 'NEGOCIO', false, 'Mensaje nuevo en el chat de soporte', 'New message in the support chat'),
  ('NEGOCIO_ACTIVIDAD',       'TRANSACCIONAL', 'NEGOCIO', false, 'Actividad en tu negocio (auditoría)', 'Activity in your business (audit)'),
  ('AVISO_PRUEBA',            'TRANSACCIONAL', 'NEGOCIO', true,  'Prueba de avisos en este dispositivo', 'Alerts test on this device')
on conflict (codigo) do nothing;

with filas (codigo, canal, idioma, asunto, cuerpo) as (values
  ('SOPORTE_MENSAJE_NEGOCIO', 'PUSH', 'es', 'Soporte StylerNow', '{{extracto}}'),
  ('SOPORTE_MENSAJE_NEGOCIO', 'PUSH', 'en', 'StylerNow Support', '{{extracto}}'),
  ('SOPORTE_MENSAJE_ADMIN',   'PUSH', 'es', '{{negocio}} escribió en soporte', '{{extracto}}'),
  ('SOPORTE_MENSAJE_ADMIN',   'PUSH', 'en', '{{negocio}} wrote in support', '{{extracto}}'),
  ('NEGOCIO_ACTIVIDAD',       'PUSH', 'es', 'Actividad en tu negocio', '{{detalle}}'),
  ('NEGOCIO_ACTIVIDAD',       'PUSH', 'en', 'Activity in your business', '{{detalle}}'),
  ('AVISO_PRUEBA',            'PUSH', 'es', 'Prueba de avisos', 'Si ves esto, los avisos de StylerNow funcionan en este dispositivo.'),
  ('AVISO_PRUEBA',            'PUSH', 'en', 'Alerts test', 'If you see this, StylerNow alerts work on this device.'))
insert into public.notificacion_plantilla (codigo, canal, idioma, negocio_id, asunto, cuerpo, version, activa)
select f.codigo, f.canal, f.idioma, null, f.asunto, f.cuerpo, 1, true from filas f
where not exists (select 1 from public.notificacion_plantilla t
                  where t.codigo = f.codigo and t.canal = f.canal and t.idioma = f.idioma and t.negocio_id is null);

-- ── 4. Productor: mensajes de soporte ─────────────────────────────────────
-- Barbería escribe → avisa a SuperSU. SuperSU responde → avisa al dueño del negocio. Un aviso por mensaje (idempotente).
create or replace function public.trg_notif_soporte_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_neg_nombre text;
  v_dueno uuid;
  v_extracto text;
  v_u uuid;
begin
  begin
    select n.nombre, n.owner_user_id into v_neg_nombre, v_dueno from public.negocio n where n.id = new.negocio_id;
    v_extracto := case
      when length(btrim(new.cuerpo)) > 0 then left(regexp_replace(btrim(new.cuerpo), '\s+', ' ', 'g'), 90)
      when new.adjunto_tipo = 'PDF' then '📄 PDF'
      else '📷 Imagen' end;
    if new.remitente_rol = 'BARBERIA' then
      for v_u in select p.id from public.perfil p where p.es_supersu loop
        perform public._notif_encolar_canales('SOPORTE_MENSAJE_ADMIN', v_u, new.negocio_id,
          jsonb_build_object('negocio', coalesce(v_neg_nombre, 'Un negocio'), 'extracto', v_extracto, 'ruta', '/admin/soporte'),
          'soporte:' || new.id::text, array['PUSH']);
      end loop;
    elsif new.remitente_rol = 'SUPERSU' then
      perform public._notif_encolar_canales('SOPORTE_MENSAJE_NEGOCIO', v_dueno, new.negocio_id,
        jsonb_build_object('extracto', v_extracto, 'ruta', '/panel/soporte'),
        'soporte:' || new.id::text, array['PUSH']);
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.trg_notif_soporte_mensaje() from public, anon, authenticated;

drop trigger if exists notif_soporte_mensaje on public.soporte_mensaje;
create trigger notif_soporte_mensaje
  after insert on public.soporte_mensaje
  for each row execute function public.trg_notif_soporte_mensaje();

-- ── 5. Productor: actividad y auditoría del negocio ───────────────────────
-- Avisa al DUEÑO de lo que hizo otra persona (staff, SuperSU o el sistema). Lo que hace el propio dueño no se le notifica.
-- Se omiten las lecturas, los avisos de soporte (ya tienen el suyo), los registros de seguridad sin negocio y lo ejecutado por
-- SQL/migraciones. Acciones iguales en un mismo negocio se agrupan en ventanas de 2 minutos (una edición masiva = un aviso).
create or replace function public.trg_notif_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dueno uuid;
  v_quien text;
  v_que text;
begin
  begin
    if new.negocio_id is null or coalesce(new.origen, '') = 'SQL' then return new; end if;
    if new.accion in ('SOPORTE_MENSAJE_ENVIADO', 'SOPORTE_MARCADO_LEIDO', 'CALLBACK_INVALIDO', 'OAUTH_ERROR')
       or new.accion ~ 'LEIDO' then
      return new;
    end if;
    select n.owner_user_id into v_dueno from public.negocio n where n.id = new.negocio_id;
    if v_dueno is null or new.actor_id = v_dueno then return new; end if;

    v_quien := case
      when new.actor_id is null then 'El sistema'
      when exists (select 1 from public.perfil p where p.id = new.actor_id and p.es_supersu) then 'StylerNow'
      else coalesce((select nullif(btrim(p.nombre), '') from public.perfil p where p.id = new.actor_id), 'Alguien de tu equipo') end;
    -- «PERFIL_ACTUALIZADO» → «Perfil actualizado»
    v_que := upper(left(replace(lower(new.accion), '_', ' '), 1)) || substr(replace(lower(new.accion), '_', ' '), 2);

    perform public._notif_encolar_canales('NEGOCIO_ACTIVIDAD', v_dueno, new.negocio_id,
      jsonb_build_object('detalle', left(v_que || ' · ' || v_quien, 140), 'ruta', '/panel/auditoria'),
      'auditoria:' || new.negocio_id::text || ':' || new.accion || ':' || floor(extract(epoch from new.created_at) / 120)::bigint::text,
      array['PUSH']);
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.trg_notif_auditoria() from public, anon, authenticated;

drop trigger if exists notif_auditoria on public.evento_auditoria;
create trigger notif_auditoria
  after insert on public.evento_auditoria
  for each row execute function public.trg_notif_auditoria();
