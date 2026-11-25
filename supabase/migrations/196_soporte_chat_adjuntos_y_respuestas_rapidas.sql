-- 196 — Chat de soporte: adjuntos (imagen/PDF), bandeja de SuperSU con prioridad y respuestas rápidas.
-- Extiende la migración 195 (que ya trae plan_caracteristica soporte_chat / soporte_prioritario, tablas, RLS y Realtime).
-- Zero Trust: el negocio y el rol se resuelven en la base (is_barberia_de / is_supersu); el navegador nunca los decide.

-- ───────────────────────── 1. Adjuntos en los mensajes ─────────────────────────
alter table public.soporte_mensaje
  add column if not exists adjunto_url text,
  add column if not exists adjunto_tipo text,
  add column if not exists adjunto_nombre text;

alter table public.soporte_mensaje drop constraint if exists soporte_mensaje_adjunto_tipo_check;
alter table public.soporte_mensaje add constraint soporte_mensaje_adjunto_tipo_check
  check (adjunto_tipo is null or adjunto_tipo in ('IMAGEN', 'PDF'));

alter table public.soporte_mensaje drop constraint if exists soporte_mensaje_adjunto_coherente_check;
alter table public.soporte_mensaje add constraint soporte_mensaje_adjunto_coherente_check
  check ((adjunto_url is null) = (adjunto_tipo is null));

-- El texto puede ir vacío solo si hay adjunto.
alter table public.soporte_mensaje drop constraint if exists soporte_mensaje_cuerpo_check;
alter table public.soporte_mensaje add constraint soporte_mensaje_cuerpo_check
  check (
    length(btrim(cuerpo)) <= 2000
    and (length(btrim(cuerpo)) >= 1 or adjunto_url is not null)
  );

-- ───────────────────────── 2. Ayudas internas ─────────────────────────
-- Negocio al que pertenece una ruta de Storage `<negocio_id>/<conversacion_id>/<uuid>.<ext>`; null si no cumple el formato.
create or replace function public._soporte_ruta_negocio(p_ruta text)
returns uuid
language sql immutable set search_path = public as $$
  select case
    when p_ruta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$'
    then split_part(p_ruta, '/', 1)::uuid
  end;
$$;

create or replace function public._soporte_plan_codigo(p_negocio_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.plan_codigo::text from public.suscripcion s where s.negocio_id = p_negocio_id limit 1),
    (select n.plan_codigo::text from public.negocio n where n.id = p_negocio_id)
  );
$$;

-- ¿Puede quien llama leer/subir en esta ruta del bucket soporte-adjuntos? (dueño con chat en su plan, o SuperSU)
create or replace function public.soporte_ruta_autorizada(p_ruta text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid := public._soporte_ruta_negocio(p_ruta);
begin
  if auth.uid() is null or v_negocio is null then return false; end if;
  if coalesce(public.is_supersu(), false) then return true; end if;
  return coalesce(public.is_barberia_de(v_negocio), false) and public._soporte_plan_incluye(v_negocio, 'soporte_chat');
end;
$$;

-- ───────────────────────── 3. Storage: políticas del chat (el bucket soporte-adjuntos ya existe y es privado) ─────────────────────────
drop policy if exists soporte_chat_adjuntos_select on storage.objects;
create policy soporte_chat_adjuntos_select on storage.objects for select to authenticated
  using (bucket_id = 'soporte-adjuntos' and public.soporte_ruta_autorizada(name));
drop policy if exists soporte_chat_adjuntos_insert on storage.objects;
create policy soporte_chat_adjuntos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'soporte-adjuntos' and public.soporte_ruta_autorizada(name));

-- ───────────────────────── 4. Conversación garantizada (para subir adjuntos antes del primer mensaje) ─────────────────────────
create or replace function public.soporte_asegurar_conversacion(p_negocio_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_negocio_id is null or not exists (select 1 from public.negocio n where n.id = p_negocio_id) then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if not coalesce(public.is_supersu(), false) then
    if not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
    if not public._soporte_plan_incluye(p_negocio_id, 'soporte_chat') then raise exception 'FUNCION_NO_INCLUIDA'; end if;
  end if;
  insert into public.soporte_conversacion (negocio_id) values (p_negocio_id)
  on conflict on constraint soporte_conversacion_negocio_id_key do nothing;
  select c.id into v_id from public.soporte_conversacion c where c.negocio_id = p_negocio_id;
  return v_id;
end;
$$;

-- ───────────────────────── 5. Enviar mensaje con adjunto opcional ─────────────────────────
-- Cambia la lista de parámetros y las columnas devueltas: se elimina la firma anterior para no dejar un overload ambiguo.
drop function if exists public.soporte_enviar_mensaje(uuid, text);

create or replace function public.soporte_enviar_mensaje(
  p_negocio_id uuid,
  p_cuerpo text,
  p_adjunto_url text default null,
  p_adjunto_tipo text default null,
  p_adjunto_nombre text default null
)
returns table (
  id uuid,
  conversacion_id uuid,
  negocio_id uuid,
  remitente_rol text,
  cuerpo text,
  created_at timestamptz,
  alerta_webhook boolean,
  alerta_email_admin boolean,
  alerta_email_negocio boolean,
  prioritario boolean,
  tiene_adjunto boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_cuerpo text := btrim(coalesce(p_cuerpo, ''));
  v_adjunto text := nullif(btrim(coalesce(p_adjunto_url, '')), '');
  v_tipo text := nullif(btrim(coalesce(p_adjunto_tipo, '')), '');
  v_nombre text := left(regexp_replace(coalesce(p_adjunto_nombre, ''), '[[:cntrl:]/\\]', '', 'g'), 160);
  v_ext text;
  v_preview text;
  v_ahora timestamptz := clock_timestamp();
  v_conv public.soporte_conversacion;
  v_msg public.soporte_mensaje;
  v_webhook boolean := false;
  v_email_admin boolean := false;
  v_email_negocio boolean := false;
  v_prioritario boolean;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_negocio_id is null or not exists (select 1 from public.negocio n where n.id = p_negocio_id) then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;

  if coalesce(public.is_supersu(), false) then
    v_rol := 'SUPERSU';
  elsif coalesce(public.is_barberia_de(p_negocio_id), false) then
    if not public._soporte_plan_incluye(p_negocio_id, 'soporte_chat') then
      raise exception 'FUNCION_NO_INCLUIDA';
    end if;
    v_rol := 'BARBERIA';
  else
    raise exception 'NO_AUTORIZADO';
  end if;

  if length(v_cuerpo) > 2000 then raise exception 'MENSAJE_LARGO'; end if;
  if length(v_cuerpo) = 0 and v_adjunto is null then raise exception 'MENSAJE_REQUERIDO'; end if;

  insert into public.soporte_conversacion (negocio_id)
  values (p_negocio_id)
  on conflict on constraint soporte_conversacion_negocio_id_key do nothing;

  select * into v_conv
  from public.soporte_conversacion c
  where c.negocio_id = p_negocio_id
  for update;

  if v_adjunto is not null then
    -- La ruta debe ser de ESTE negocio y ESTA conversación, y el tipo debe coincidir con la extensión.
    if public._soporte_ruta_negocio(v_adjunto) is distinct from p_negocio_id
       or split_part(v_adjunto, '/', 2)::uuid is distinct from v_conv.id then
      raise exception 'ADJUNTO_INVALIDO';
    end if;
    v_ext := lower(substring(v_adjunto from '\.([a-z]+)$'));
    if v_tipo is distinct from (case when v_ext = 'pdf' then 'PDF' else 'IMAGEN' end) then
      raise exception 'ADJUNTO_INVALIDO';
    end if;
    if length(v_nombre) = 0 then v_nombre := 'adjunto.' || v_ext; end if;
  elsif v_tipo is not null then
    raise exception 'ADJUNTO_INVALIDO';
  end if;

  v_preview := case
    when length(v_cuerpo) > 0 then left(regexp_replace(v_cuerpo, '\s+', ' ', 'g'), 160)
    when v_tipo = 'PDF' then '📄 PDF'
    else '📷 Imagen'
  end;

  insert into public.soporte_mensaje (conversacion_id, negocio_id, remitente_rol, remitente_id, cuerpo, adjunto_url, adjunto_tipo, adjunto_nombre)
  values (v_conv.id, p_negocio_id, v_rol, auth.uid(), v_cuerpo, v_adjunto, v_tipo, case when v_adjunto is null then null else v_nombre end)
  returning * into v_msg;

  if v_rol = 'BARBERIA' then
    v_webhook := true;
    v_email_admin := v_conv.ultima_alerta_admin_at is null
      or v_conv.ultima_alerta_admin_at <= v_ahora - interval '10 minutes';
  else
    v_email_negocio := v_conv.ultima_alerta_negocio_at is null
      or v_conv.ultima_alerta_negocio_at <= v_ahora - interval '10 minutes';
  end if;

  update public.soporte_conversacion c
  set ultimo_mensaje_at = v_ahora,
      ultimo_mensaje_preview = v_preview,
      no_leidos_admin = c.no_leidos_admin + case when v_rol = 'BARBERIA' then 1 else 0 end,
      no_leidos_negocio = c.no_leidos_negocio + case when v_rol = 'SUPERSU' then 1 else 0 end,
      ultima_alerta_admin_at = case when v_email_admin then v_ahora else c.ultima_alerta_admin_at end,
      ultima_alerta_negocio_at = case when v_email_negocio then v_ahora else c.ultima_alerta_negocio_at end
  where c.id = v_conv.id;

  v_prioritario := public._soporte_plan_incluye(p_negocio_id, 'soporte_prioritario');

  perform public._auditar(
    'soporte_mensaje', v_msg.id, 'SOPORTE_MENSAJE_ENVIADO', p_negocio_id,
    null,
    jsonb_build_object('conversacion_id', v_conv.id, 'remitente_rol', v_rol, 'longitud', length(v_cuerpo), 'adjunto_tipo', v_tipo),
    null
  );

  return query select v_msg.id, v_conv.id, p_negocio_id, v_rol, v_cuerpo, v_msg.created_at,
    v_webhook, v_email_admin, v_email_negocio, v_prioritario, v_adjunto is not null;
end;
$$;

-- ───────────────────────── 6. Bandeja de SuperSU (prioritarios arriba) ─────────────────────────
create or replace function public.soporte_bandeja_admin()
returns table (
  id uuid,
  negocio_id uuid,
  negocio_nombre text,
  ciudad text,
  plan_codigo text,
  prioritario boolean,
  estado text,
  no_leidos_admin integer,
  ultimo_mensaje_at timestamptz,
  ultimo_mensaje_preview text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query
    select c.id, c.negocio_id, n.nombre::text, n.ciudad::text, public._soporte_plan_codigo(c.negocio_id),
           public._soporte_plan_incluye(c.negocio_id, 'soporte_prioritario'),
           c.estado, c.no_leidos_admin, c.ultimo_mensaje_at, c.ultimo_mensaje_preview, c.created_at
    from public.soporte_conversacion c
    join public.negocio n on n.id = c.negocio_id
    order by public._soporte_plan_incluye(c.negocio_id, 'soporte_prioritario') desc,
             c.ultimo_mensaje_at desc nulls last
    limit 300;
end;
$$;

-- ───────────────────────── 7. Respuestas rápidas (solo SuperSU) ─────────────────────────
create table if not exists public.soporte_respuesta_rapida (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 60),
  atajo text not null unique check (atajo ~ '^/[a-z0-9_-]{2,20}$'),
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 1000),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.soporte_respuesta_rapida enable row level security;
revoke all on public.soporte_respuesta_rapida from public, anon, authenticated;
grant select, insert, update, delete on public.soporte_respuesta_rapida to authenticated;

drop policy if exists soporte_respuesta_rapida_supersu on public.soporte_respuesta_rapida;
create policy soporte_respuesta_rapida_supersu on public.soporte_respuesta_rapida
  for all to authenticated
  using (coalesce(public.is_supersu(), false))
  with check (coalesce(public.is_supersu(), false));

insert into public.soporte_respuesta_rapida (titulo, atajo, cuerpo, orden) values
  ('Saludo inicial', '/hola', '¡Hola! Gracias por escribir a StylerNow. Cuéntame, ¿en qué te puedo ayudar hoy?', 1),
  ('Pagos con Nequi', '/nequi', 'Para recibir anticipos con Nequi entra a Finanzas > Cobros y conecta tu cuenta. Si quieres, mándame un pantallazo de lo que ves y te guío paso a paso.', 2),
  ('Verificación del negocio', '/verificacion', 'Para verificar tu negocio entra a Mi negocio > Verificación y sube los documentos solicitados (cámara de comercio o RUT y una foto de tu fachada). La revisión toma máximo 24 horas hábiles.', 3),
  ('Dudas sobre el plan', '/plan', 'Puedes ver, cambiar o mejorar tu plan en Finanzas > Mi Plan. Los cambios aplican de inmediato y te mostramos el valor proporcional antes de confirmar.', 4),
  ('Reporte de error', '/error', 'Lamento el inconveniente. ¿Me compartes un pantallazo del error y lo que estabas haciendo justo antes? Con eso lo reviso de inmediato.', 5),
  ('Cierre de conversación', '/cierre', '¡Listo! Quedo atento por si necesitas algo más. Cierro esta conversación, pero puedes escribirnos cuando quieras. ¡Que tengas un excelente día!', 6)
on conflict (atajo) do nothing;

-- ───────────────────────── 8. Permisos de las funciones (los tres roles se revocan: public/anon/authenticated son independientes) ─────────────────────────
revoke all on function public._soporte_ruta_negocio(text) from public, anon, authenticated;
revoke all on function public._soporte_plan_codigo(uuid) from public, anon, authenticated;
revoke all on function public.soporte_ruta_autorizada(text) from public, anon, authenticated;
revoke all on function public.soporte_asegurar_conversacion(uuid) from public, anon, authenticated;
revoke all on function public.soporte_enviar_mensaje(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.soporte_bandeja_admin() from public, anon, authenticated;
grant execute on function public.soporte_ruta_autorizada(text) to authenticated;
grant execute on function public.soporte_asegurar_conversacion(uuid) to authenticated;
grant execute on function public.soporte_enviar_mensaje(uuid, text, text, text, text) to authenticated;
grant execute on function public.soporte_bandeja_admin() to authenticated;
-- _soporte_ruta_negocio y _soporte_plan_codigo son internas (las usan funciones security definer): sin acceso directo.
