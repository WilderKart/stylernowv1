-- 157: onboarding de 4 pasos + verificación del negocio, independiente y posterior (encargo del 2026-11-17).
--
-- 1. negocio.foto_principal_*: fotografía pública de la fachada (Cloudinary, nunca Supabase Storage).
-- 2. completar_onboarding_negocio: cierra el alta SIN exigir servicios (se configuran después, en el panel).
--    No toca estado: aprobar (publicar) sigue siendo decisión de SuperSU; la verificación es otra cosa (distintivo de confianza).
-- 3. Verificación: tres tablas cerradas (solo por funciones), estados independientes, historial inmutable y trazabilidad.
--    Documentos privados: solo su identificador de Cloudinary (carpeta del negocio, tipo authenticated); el acceso lo
--    autoriza el servidor en cada lectura y queda en auditoría.
-- Seguridad: nada se escribe por la API directa; las funciones están revocadas de public/anon/authenticated y concedidas
-- solo a quien corresponde; la identidad llega de auth.uid() (o de p_actor verificado por el servidor en las *_srv).

-- ── 1. Fotografía principal ─────────────────────────────────────────────────────────────
alter table public.negocio
  add column if not exists foto_principal_url text,
  add column if not exists foto_principal_public_id text;
alter table public.negocio drop constraint if exists negocio_foto_principal_cloudinary;
alter table public.negocio add constraint negocio_foto_principal_cloudinary
  check (foto_principal_url is null or foto_principal_url ~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/');

create or replace function public.fijar_foto_principal_negocio(p_negocio_id uuid, p_url text, p_public_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.negocio where id = p_negocio_id and owner_user_id = auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_url !~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/' or coalesce(p_public_id, '') !~ '^negocios/[0-9a-f-]{36}/' then
    raise exception 'FOTO_INVALIDA';
  end if;
  update public.negocio set foto_principal_url = p_url, foto_principal_public_id = p_public_id, updated_at = now()
   where id = p_negocio_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('negocio', p_negocio_id, 'FOTO_PRINCIPAL_ACTUALIZADA', 'BARBERIA', auth.uid(), p_negocio_id);
end $$;
revoke all on function public.fijar_foto_principal_negocio(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fijar_foto_principal_negocio(uuid, text, text) to authenticated;

-- ── 2. Cierre del onboarding (idempotente) ──────────────────────────────────────────────
create or replace function public.completar_onboarding_negocio(p_negocio_id uuid)
returns public.negocio language plpgsql security definer set search_path = public as $$
declare v_neg public.negocio; v_estado text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_neg from public.negocio where id = p_negocio_id and owner_user_id = auth.uid() for update;
  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if v_neg.onboarding_completo then return v_neg; end if;  -- reintento: no repite nada
  if not exists (select 1 from public.sede where negocio_id = p_negocio_id and not cerrada_permanente) then
    raise exception 'FALTA_SEDE';
  end if;
  select s.estado::text into v_estado from public.suscripcion s where s.negocio_id = p_negocio_id;
  if v_estado is null or v_estado not in ('TRIAL', 'ACTIVA') then raise exception 'FALTA_PRUEBA_ACTIVA'; end if;
  update public.negocio set onboarding_completo = true, updated_at = now() where id = p_negocio_id returning * into v_neg;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('negocio', p_negocio_id, 'ONBOARDING_COMPLETADO', 'BARBERIA', auth.uid(), p_negocio_id);
  return v_neg;
end $$;
revoke all on function public.completar_onboarding_negocio(uuid) from public, anon, authenticated;
grant execute on function public.completar_onboarding_negocio(uuid) to authenticated;

-- ── 3. Verificación del negocio ─────────────────────────────────────────────────────────
do $$ begin
  create type public.verificacion_estado as enum
    ('NO_INICIADA', 'PENDIENTE_DOCUMENTACION', 'EN_REVISION', 'VERIFICADA', 'REQUIERE_CORRECCION', 'RECHAZADA', 'REVOCADA');
exception when duplicate_object then null; end $$;

-- Sin FK a auth.users en actores: la cuenta puede eliminarse y la trazabilidad debe sobrevivir (mismo criterio que evidencia_legal).
create table if not exists public.negocio_verificacion (
  negocio_id uuid primary key references public.negocio(id),
  estado public.verificacion_estado not null default 'NO_INICIADA',
  iniciada_at timestamptz,
  enviada_at timestamptz,
  decidida_at timestamptz,
  decidida_por uuid,
  motivo text,
  updated_at timestamptz not null default now()
);

create table if not exists public.verificacion_documento (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  tipo text not null check (tipo in (
    'EXISTENCIA_COMERCIAL', 'RUT', 'MATRICULA_MERCANTIL', 'FOTO_ESTABLECIMIENTO', 'EVIDENCIA_UBICACION',
    'AUTORIZACION_ADMINISTRADOR', 'IDENTIDAD_ADMINISTRADOR', 'ALTERNATIVO_INDEPENDIENTE')),
  public_id text not null unique check (public_id ~ '^verificacion/[0-9a-f-]{36}/'),
  version bigint not null,
  formato text not null check (formato in ('jpg', 'jpeg', 'png', 'webp', 'pdf')),
  bytes integer not null check (bytes > 0),
  subido_por uuid not null,
  subido_at timestamptz not null default now(),
  retirado_at timestamptz
);
create index if not exists verificacion_documento_negocio_idx on public.verificacion_documento (negocio_id) where retirado_at is null;

create table if not exists public.verificacion_evento (
  id bigint generated always as identity primary key,
  negocio_id uuid not null references public.negocio(id),
  actor_id uuid,
  actor_rol text not null check (actor_rol in ('PROPIETARIO', 'SUPERSU', 'SISTEMA')),
  estado_anterior public.verificacion_estado,
  estado_nuevo public.verificacion_estado not null,
  motivo text,
  origen text not null,
  created_at timestamptz not null default now()
);
create index if not exists verificacion_evento_negocio_idx on public.verificacion_evento (negocio_id, id desc);
drop trigger if exists trg_verificacion_evento_inmutable on public.verificacion_evento;
create trigger trg_verificacion_evento_inmutable before update or delete on public.verificacion_evento
  for each row execute function public.trg_fila_inmutable();

-- Tablas cerradas: nadie las toca por la API; solo las funciones definer. (Paridad con producción: default privileges.)
alter table public.negocio_verificacion enable row level security;
alter table public.verificacion_documento enable row level security;
alter table public.verificacion_evento enable row level security;
revoke all on public.negocio_verificacion, public.verificacion_documento, public.verificacion_evento
  from public, anon, authenticated, service_role;

-- Transición + historial + auditoría central, en un solo lugar.
create or replace function public._verif_transicion(
  p_negocio uuid, p_actor uuid, p_rol text, p_nuevo public.verificacion_estado, p_motivo text, p_origen text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ant public.verificacion_estado;
begin
  select estado into v_ant from public.negocio_verificacion where negocio_id = p_negocio for update;
  insert into public.negocio_verificacion (negocio_id, estado, iniciada_at, enviada_at, decidida_at, decidida_por, motivo, updated_at)
  values (p_negocio, p_nuevo,
          case when p_nuevo = 'PENDIENTE_DOCUMENTACION' then now() end,
          case when p_nuevo = 'EN_REVISION' then now() end,
          case when p_nuevo in ('VERIFICADA', 'REQUIERE_CORRECCION', 'RECHAZADA', 'REVOCADA') then now() end,
          case when p_rol = 'SUPERSU' then p_actor end,
          p_motivo, now())
  on conflict (negocio_id) do update set
    estado = excluded.estado,
    iniciada_at = coalesce(public.negocio_verificacion.iniciada_at, excluded.iniciada_at),
    enviada_at = case when excluded.estado = 'EN_REVISION' then now() else public.negocio_verificacion.enviada_at end,
    decidida_at = case when excluded.estado in ('VERIFICADA', 'REQUIERE_CORRECCION', 'RECHAZADA', 'REVOCADA') then now()
                       else public.negocio_verificacion.decidida_at end,
    decidida_por = case when p_rol = 'SUPERSU' then p_actor else public.negocio_verificacion.decidida_por end,
    motivo = coalesce(excluded.motivo, public.negocio_verificacion.motivo),
    updated_at = now();
  insert into public.verificacion_evento (negocio_id, actor_id, actor_rol, estado_anterior, estado_nuevo, motivo, origen)
  values (p_negocio, p_actor, p_rol, coalesce(v_ant, 'NO_INICIADA'), p_nuevo, p_motivo, p_origen);
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues, motivo, origen)
  values ('negocio_verificacion', p_negocio, 'VERIFICACION_' || p_nuevo::text, case when p_rol = 'SUPERSU' then 'SUPERSU' else 'BARBERIA' end,
          p_actor, p_negocio, jsonb_build_object('estado', coalesce(v_ant, 'NO_INICIADA')), jsonb_build_object('estado', p_nuevo),
          p_motivo, 'PANEL');  -- evento_auditoria.origen solo admite PANEL/API/SISTEMA/SQL; el origen fino (CRM/PANEL) queda en verificacion_evento
end $$;
revoke all on function public._verif_transicion(uuid, uuid, text, public.verificacion_estado, text, text) from public, anon, authenticated, service_role;

create or replace function public._verif_es_propietario(p_negocio uuid, p_usuario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.negocio where id = p_negocio and owner_user_id = p_usuario and p_usuario is not null);
$$;
revoke all on function public._verif_es_propietario(uuid, uuid) from public, anon, authenticated, service_role;

-- Propietario: iniciar (solo desde NO_INICIADA).
create or replace function public.iniciar_verificacion_negocio(p_negocio_id uuid)
returns public.verificacion_estado language plpgsql security definer set search_path = public as $$
declare v_est public.verificacion_estado;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._verif_es_propietario(p_negocio_id, auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  select coalesce((select estado from public.negocio_verificacion where negocio_id = p_negocio_id), 'NO_INICIADA') into v_est;
  if v_est = 'PENDIENTE_DOCUMENTACION' then return v_est; end if;  -- reintento idempotente
  if v_est <> 'NO_INICIADA' then raise exception 'TRANSICION_NO_PERMITIDA'; end if;
  perform public._verif_transicion(p_negocio_id, auth.uid(), 'PROPIETARIO', 'PENDIENTE_DOCUMENTACION', null, 'PANEL');
  return 'PENDIENTE_DOCUMENTACION';
end $$;

-- Servidor: registrar un documento ya subido a Cloudinary (el servidor verificó la sesión y pasa p_actor).
create or replace function public.registrar_documento_verificacion_srv(
  p_actor uuid, p_negocio_id uuid, p_tipo text, p_public_id text, p_version bigint, p_formato text, p_bytes integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_est public.verificacion_estado; v_id uuid;
begin
  if not public._verif_es_propietario(p_negocio_id, p_actor) then raise exception 'NO_AUTORIZADO'; end if;
  select estado into v_est from public.negocio_verificacion where negocio_id = p_negocio_id;
  if v_est is null or v_est not in ('PENDIENTE_DOCUMENTACION', 'REQUIERE_CORRECCION') then raise exception 'VERIFICACION_NO_EDITABLE'; end if;
  -- El archivo debe estar bajo la carpeta de ESTE negocio: impide registrar un identificador ajeno (IDOR).
  if p_public_id not like 'verificacion/' || p_negocio_id::text || '/%' then raise exception 'ARCHIVO_AJENO'; end if;
  if (select count(*) from public.verificacion_documento where negocio_id = p_negocio_id and retirado_at is null) >= 20 then
    raise exception 'DEMASIADOS_DOCUMENTOS';
  end if;
  insert into public.verificacion_documento (negocio_id, tipo, public_id, version, formato, bytes, subido_por)
  values (p_negocio_id, p_tipo, p_public_id, p_version, lower(p_formato), p_bytes, p_actor) returning id into v_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('verificacion_documento', v_id, 'DOCUMENTO_VERIFICACION_SUBIDO', 'BARBERIA', p_actor, p_negocio_id, jsonb_build_object('tipo', p_tipo));
  return v_id;
end $$;
revoke all on function public.registrar_documento_verificacion_srv(uuid, uuid, text, text, bigint, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_documento_verificacion_srv(uuid, uuid, text, text, bigint, text, integer) to service_role;

-- Propietario: retirar un documento mientras la verificación sea editable (el archivo se retira por procedimiento, no aquí).
create or replace function public.retirar_documento_verificacion(p_documento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.verificacion_documento; v_est public.verificacion_estado;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.verificacion_documento where id = p_documento_id and retirado_at is null;
  if not found or not public._verif_es_propietario(v.negocio_id, auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  select estado into v_est from public.negocio_verificacion where negocio_id = v.negocio_id;
  if v_est is null or v_est not in ('PENDIENTE_DOCUMENTACION', 'REQUIERE_CORRECCION') then raise exception 'VERIFICACION_NO_EDITABLE'; end if;
  update public.verificacion_documento set retirado_at = now() where id = p_documento_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('verificacion_documento', p_documento_id, 'DOCUMENTO_VERIFICACION_RETIRADO', 'BARBERIA', auth.uid(), v.negocio_id);
end $$;

-- Propietario: enviar a revisión. Basta con tener al menos un documento: qué es suficiente lo decide SuperSU al revisar.
create or replace function public.enviar_verificacion_a_revision(p_negocio_id uuid)
returns public.verificacion_estado language plpgsql security definer set search_path = public as $$
declare v_est public.verificacion_estado;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._verif_es_propietario(p_negocio_id, auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  select estado into v_est from public.negocio_verificacion where negocio_id = p_negocio_id;
  if v_est = 'EN_REVISION' then return v_est; end if;
  if v_est is null or v_est not in ('PENDIENTE_DOCUMENTACION', 'REQUIERE_CORRECCION') then raise exception 'TRANSICION_NO_PERMITIDA'; end if;
  if not exists (select 1 from public.verificacion_documento where negocio_id = p_negocio_id and retirado_at is null) then
    raise exception 'FALTAN_DOCUMENTOS';
  end if;
  perform public._verif_transicion(p_negocio_id, auth.uid(), 'PROPIETARIO', 'EN_REVISION', null, 'PANEL');
  return 'EN_REVISION';
end $$;

-- Propietario: su propio estado (sin identificadores de Cloudinary).
create or replace function public.mi_verificacion_negocio(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.negocio_verificacion;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._verif_es_propietario(p_negocio_id, auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  select * into v from public.negocio_verificacion where negocio_id = p_negocio_id;
  return jsonb_build_object(
    'estado', coalesce(v.estado, 'NO_INICIADA'),
    'motivo', case when v.estado in ('REQUIERE_CORRECCION', 'RECHAZADA', 'REVOCADA') then v.motivo end,
    'enviada_at', v.enviada_at, 'decidida_at', v.decidida_at,
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'formato', d.formato, 'bytes', d.bytes, 'subido_at', d.subido_at)
                                              order by d.subido_at)
                            from public.verificacion_documento d where d.negocio_id = p_negocio_id and d.retirado_at is null), '[]'::jsonb));
end $$;

-- Insignia pública: solo un booleano.
create or replace function public.negocio_verificado(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.negocio_verificacion where negocio_id = p_negocio_id and estado = 'VERIFICADA');
$$;
revoke all on function public.negocio_verificado(uuid) from public, anon, authenticated;
grant execute on function public.negocio_verificado(uuid) to anon, authenticated;

-- Servidor: autorizar la lectura de UN documento (propietario o SuperSU). Cada lectura queda en auditoría.
create or replace function public.autorizar_lectura_documento_srv(p_actor uuid, p_documento_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.verificacion_documento; v_super boolean;
begin
  if p_actor is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.verificacion_documento where id = p_documento_id;
  if not found then raise exception 'NO_AUTORIZADO'; end if;  -- no se distingue "no existe" de "no es tuyo"
  select coalesce(es_supersu, false) into v_super from public.perfil where id = p_actor;
  if not (public._verif_es_propietario(v.negocio_id, p_actor) or coalesce(v_super, false)) then raise exception 'NO_AUTORIZADO'; end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('verificacion_documento', p_documento_id, 'DOCUMENTO_VERIFICACION_LEIDO',
          case when coalesce(v_super, false) then 'SUPERSU' else 'BARBERIA' end, p_actor, v.negocio_id, jsonb_build_object('tipo', v.tipo));
  return jsonb_build_object('public_id', v.public_id, 'version', v.version, 'formato', v.formato);
end $$;
revoke all on function public.autorizar_lectura_documento_srv(uuid, uuid) from public, anon, authenticated;
grant execute on function public.autorizar_lectura_documento_srv(uuid, uuid) to service_role;

-- ── SuperSU ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_verificaciones_listar(
  p_estado text default null, p_q text default null, p_limite int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_total int; v_filas jsonb;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  p_limite := least(greatest(coalesce(p_limite, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  if v_q is not null then v_q := '%' || replace(replace(replace(left(v_q, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  with base as (
    select n.id negocio_id, n.nombre, n.ciudad, n.estado negocio_estado, n.created_at,
           coalesce(v.estado, 'NO_INICIADA'::public.verificacion_estado) verificacion, v.enviada_at, v.decidida_at,
           (select count(*) from public.verificacion_documento d where d.negocio_id = n.id and d.retirado_at is null) documentos
    from public.negocio n left join public.negocio_verificacion v on v.negocio_id = n.id
    where v_q is null or n.nombre ilike v_q or coalesce(n.ciudad, '') ilike v_q
  ), elegido as (select * from base where p_estado is null or p_estado = '' or verificacion::text = p_estado)
  select (select count(*) from elegido),
         coalesce((select jsonb_agg(to_jsonb(e) order by (e.verificacion = 'EN_REVISION') desc, e.enviada_at asc nulls last, e.created_at desc)
                   from (select * from elegido order by (verificacion = 'EN_REVISION') desc, enviada_at asc nulls last, created_at desc
                         limit p_limite offset p_offset) e), '[]'::jsonb)
    into v_total, v_filas;
  return jsonb_build_object('total', v_total, 'filas', v_filas,
    'conteo', (select coalesce(jsonb_object_agg(e, c), '{}'::jsonb) from (
        select coalesce(v.estado, 'NO_INICIADA')::text e, count(*) c
        from public.negocio n left join public.negocio_verificacion v on v.negocio_id = n.id group by 1) t));
end $$;

create or replace function public.admin_verificacion_detalle(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return jsonb_build_object(
    'negocio', (select jsonb_build_object('id', n.id, 'nombre', n.nombre, 'ciudad', n.ciudad, 'estado', n.estado, 'plan', n.plan_codigo,
                  'telefono', n.telefono_contacto, 'foto_principal_url', n.foto_principal_url) from public.negocio n where n.id = p_negocio_id),
    'verificacion', (select to_jsonb(v) - 'negocio_id' from public.negocio_verificacion v where v.negocio_id = p_negocio_id),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'formato', d.formato, 'bytes', d.bytes,
                    'subido_at', d.subido_at, 'retirado_at', d.retirado_at) order by d.subido_at)
                  from public.verificacion_documento d where d.negocio_id = p_negocio_id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'actor_rol', e.actor_rol, 'actor_id', e.actor_id,
                    'estado_anterior', e.estado_anterior, 'estado_nuevo', e.estado_nuevo, 'motivo', e.motivo, 'origen', e.origen,
                    'created_at', e.created_at) order by e.id desc)
                  from public.verificacion_evento e where e.negocio_id = p_negocio_id), '[]'::jsonb));
end $$;

create or replace function public.admin_decidir_verificacion(p_negocio_id uuid, p_nuevo text, p_motivo text)
returns public.verificacion_estado language plpgsql security definer set search_path = public as $$
declare v_ant public.verificacion_estado; v_nuevo public.verificacion_estado;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  begin v_nuevo := p_nuevo::public.verificacion_estado; exception when others then raise exception 'ESTADO_INVALIDO'; end;
  select estado into v_ant from public.negocio_verificacion where negocio_id = p_negocio_id for update;
  if v_ant is null then raise exception 'TRANSICION_NO_PERMITIDA'; end if;
  if not ((v_ant = 'EN_REVISION' and v_nuevo in ('VERIFICADA', 'REQUIERE_CORRECCION', 'RECHAZADA'))
       or (v_ant = 'VERIFICADA' and v_nuevo = 'REVOCADA')) then
    raise exception 'TRANSICION_NO_PERMITIDA';
  end if;
  perform public._verif_transicion(p_negocio_id, auth.uid(), 'SUPERSU', v_nuevo, btrim(p_motivo), 'CRM');
  return v_nuevo;
end $$;

-- Permisos de las funciones públicas de esta migración.
revoke all on function public.admin_verificaciones_listar(text, text, int, int) from public, anon, authenticated;
revoke all on function public.admin_verificacion_detalle(uuid) from public, anon, authenticated;
revoke all on function public.admin_decidir_verificacion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.iniciar_verificacion_negocio(uuid) from public, anon, authenticated;
revoke all on function public.retirar_documento_verificacion(uuid) from public, anon, authenticated;
revoke all on function public.enviar_verificacion_a_revision(uuid) from public, anon, authenticated;
revoke all on function public.mi_verificacion_negocio(uuid) from public, anon, authenticated;
grant execute on function public.admin_verificaciones_listar(text, text, int, int) to authenticated;
grant execute on function public.admin_verificacion_detalle(uuid) to authenticated;
grant execute on function public.admin_decidir_verificacion(uuid, text, text) to authenticated;
grant execute on function public.iniciar_verificacion_negocio(uuid) to authenticated;
grant execute on function public.retirar_documento_verificacion(uuid) to authenticated;
grant execute on function public.enviar_verificacion_a_revision(uuid) to authenticated;
grant execute on function public.mi_verificacion_negocio(uuid) to authenticated;

-- negocio se lee por permisos de COLUMNA: sin esto, anon/authenticated no pueden seleccionar las columnas nuevas.
-- La URL de la fachada es pública (igual que logo_url); su identificador se deduce de ella, así que no es un secreto.
grant select (foto_principal_url) on public.negocio to anon, authenticated;
