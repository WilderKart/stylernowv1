-- 155 · Centro de Cumplimiento y PQRS — adjuntos privados y consultas del SuperAdmin (dashboard, bandejas, detalle).
--
-- Adjuntos: bucket PRIVADO `casos-adjuntos` sin ninguna política en storage.objects → ni anon ni authenticated leen ni escriben; solo el
-- servidor (service_role) sube y genera enlaces firmados de corta vida para el SuperAdmin. Tipos permitidos verificados por contenido
-- (firma binaria) en el servidor: PDF, PNG, JPEG. Máximo 5 MB y 5 archivos por caso. No hay antivirus: ver INFORME (riesgo residual).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('casos-adjuntos', 'casos-adjuntos', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'];

create table if not exists public.caso_adjunto (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.ticket_soporte(id),
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'),
  nombre_original text not null check (length(nombre_original) between 1 and 120),
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  bytes integer not null check (bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por_tipo text not null check (subido_por_tipo in ('SOLICITANTE', 'SUPERSU', 'USUARIO')),
  subido_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists caso_adjunto_ticket_idx on public.caso_adjunto (ticket_id);
drop trigger if exists trg_caso_adjunto_inmutable on public.caso_adjunto;
create trigger trg_caso_adjunto_inmutable before update or delete on public.caso_adjunto for each row execute function public.trg_fila_inmutable();
alter table public.caso_adjunto enable row level security;
revoke all on public.caso_adjunto from public, anon, authenticated;
grant select on public.caso_adjunto to authenticated;
drop policy if exists caso_adjunto_supersu on public.caso_adjunto;
create policy caso_adjunto_supersu on public.caso_adjunto for select to authenticated using (coalesce(public.is_supersu(), false));

create or replace function public.caso_registrar_adjunto(p_ticket uuid, p_path text, p_nombre text, p_mime text, p_bytes integer, p_sha256 text,
  p_actor_tipo text, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.ticket_soporte where id = p_ticket) then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if (select count(*) from public.caso_adjunto where ticket_id = p_ticket) >= 5 then raise exception 'DEMASIADOS_ADJUNTOS'; end if;
  insert into public.caso_adjunto (ticket_id, storage_path, nombre_original, mime, bytes, sha256, subido_por_tipo, subido_por)
  values (p_ticket, p_path, p_nombre, p_mime, p_bytes, p_sha256, p_actor_tipo, p_actor) returning id into v_id;
  perform public._caso_log(p_ticket, 'ADJUNTO', null, null, p_actor, case p_actor_tipo when 'SUPERSU' then 'SUPERSU' when 'SOLICITANTE' then 'SOLICITANTE' else 'USUARIO' end,
    jsonb_build_object('adjunto_id', v_id, 'mime', p_mime, 'bytes', p_bytes, 'sha256', p_sha256), p_actor_tipo <> 'SUPERSU');
  return v_id;
end $$;
revoke all on function public.caso_registrar_adjunto(uuid, text, text, text, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.caso_registrar_adjunto(uuid, text, text, text, integer, text, text, uuid) to service_role;

-- ¿El SuperSU puede pedir el enlace firmado de este adjunto? (el servidor lo firma; esta función autoriza y audita el acceso)
create or replace function public.caso_autorizar_descarga(p_adjunto uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); a public.caso_adjunto;
begin
  select * into a from public.caso_adjunto where id = p_adjunto;
  if not found then raise exception 'ADJUNTO_NO_ENCONTRADO'; end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('caso_adjunto', a.id, 'CASO_ADJUNTO_DESCARGADO', 'SUPERSU', v_actor, null, null, jsonb_build_object('ticket_id', a.ticket_id));
  return a.storage_path;
end $$;
revoke all on function public.caso_autorizar_descarga(uuid) from public, anon, authenticated;
grant execute on function public.caso_autorizar_descarga(uuid) to authenticated;

-- ── Dashboard ──────────────────────────────────────────────────────────────
create or replace function public.caso_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._caso_exigir_supersu();
  with a as (select t.*, c.categoria from public.ticket_soporte t left join public.caso_tipo c on c.codigo = t.tipo_codigo),
  ab as (select * from a where estado_caso not in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO'))
  select jsonb_build_object(
    'abiertos', (select count(*) from ab),
    'sin_asignar', (select count(*) from ab where responsable_id is null),
    'criticos', (select count(*) from ab where prioridad = 'CRITICA'),
    'proximos_vencer', (select count(*) from ab where fecha_limite > now() and fecha_limite <= now() + interval '72 hours'),
    'vencidos', (select count(*) from ab where fecha_limite < now() and estado_caso <> 'ESPERANDO_SOLICITANTE'),
    'pendientes_respuesta', (select count(*) from ab where estado_respuesta <> 'RESPONDIDO'),
    'en_investigacion', (select count(*) from ab where estado_caso in ('EN_REVISION', 'EN_GESTION', 'ESCALADO')),
    'pendientes_resolucion', (select count(*) from a where estado_caso = 'RESPONDIDO'),
    'pendientes_cierre', (select count(*) from a where estado_caso = 'RESUELTO'),
    'esperando_solicitante', (select count(*) from ab where estado_caso = 'ESPERANDO_SOLICITANTE'),
    'por_categoria', coalesce((select jsonb_object_agg(categoria, n) from (select coalesce(categoria, 'SIN_TIPO') categoria, count(*) n from ab group by 1) x), '{}'),
    'por_responsable', coalesce((select jsonb_object_agg(coalesce(p.nombre, 'Sin asignar'), n) from (select responsable_id, count(*) n from ab group by 1) x left join public.perfil p on p.id = x.responsable_id), '{}'),
    'por_canal', coalesce((select jsonb_object_agg(canal, n) from (select canal, count(*) n from ab group by 1) x), '{}'),
    'por_mes', coalesce((select jsonb_object_agg(mes, n) from (select to_char(recibido_at at time zone 'America/Bogota', 'YYYY-MM') mes, count(*) n
                         from a where recibido_at > now() - interval '6 months' group by 1) x), '{}'),
    'alertas_crm_sin_leer', (select count(*) from public.cumplimiento_notificacion where canal = 'CRM' and leida_at is null),
    'sms', jsonb_build_object('habilitado', coalesce((select (valor)::text = 'true' from public.cumplimiento_config where clave = 'sms_habilitado'), false),
                              'pendientes_por_deshabilitado', (select count(*) from public.cumplimiento_notificacion where canal = 'SMS' and estado = 'CANAL_NO_HABILITADO'))
  ) into r;
  return r;
end $$;
revoke all on function public.caso_dashboard() from public, anon, authenticated;
grant execute on function public.caso_dashboard() to authenticated;

-- ── Bandejas y filtros ─────────────────────────────────────────────────────
create or replace function public.caso_listar(p_bandeja text default 'TODOS', p_filtros jsonb default '{}', p_limite integer default 50, p_offset integer default 0)
returns table (id uuid, numero text, asunto text, tipo_codigo text, tipo_nombre text, categoria text, canal text, prioridad text, estado_caso text,
  estado_respuesta text, responsable_id uuid, responsable text, recibido_at timestamptz, fecha_limite timestamptz, plazo_origen text,
  vencido boolean, horas_restantes numeric, negocio_id uuid, proxima_accion text, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_busca text := nullif(trim(p_filtros ->> 'numero'), '');
begin
  perform public._caso_exigir_supersu();
  return query
  with b as (
    select t.*, c.nombre tn, c.categoria cat, p.nombre rn,
           t.estado_caso not in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO') as abierto
      from public.ticket_soporte t left join public.caso_tipo c on c.codigo = t.tipo_codigo left join public.perfil p on p.id = t.responsable_id)
  select b.id, b.numero_radicacion, b.asunto, b.tipo_codigo, b.tn, b.cat, b.canal, b.prioridad, b.estado_caso, b.estado_respuesta, b.responsable_id,
         b.rn, b.recibido_at, b.fecha_limite, b.plazo_origen,
         (b.abierto and b.fecha_limite < now() and b.estado_caso <> 'ESPERANDO_SOLICITANTE'),
         case when b.fecha_limite is null then null else round(extract(epoch from (b.fecha_limite - now())) / 3600.0, 1) end,
         b.negocio_id, b.proxima_accion, count(*) over ()
    from b
   where case upper(coalesce(p_bandeja, 'TODOS'))
           when 'SIN_ASIGNAR' then b.abierto and b.responsable_id is null
           when 'CRITICOS' then b.abierto and b.prioridad = 'CRITICA'
           when 'PROXIMOS' then b.abierto and b.fecha_limite > now() and b.fecha_limite <= now() + interval '72 hours'
           when 'VENCIDOS' then b.abierto and b.fecha_limite < now() and b.estado_caso <> 'ESPERANDO_SOLICITANTE'
           when 'DATOS' then b.cat = 'DATOS_PERSONALES'
           when 'CONSUMIDOR' then b.cat = 'CONSUMIDOR'
           when 'PQRS' then b.cat = 'PQRS'
           when 'INCIDENTES' then b.cat = 'SEGURIDAD'
           when 'RESUELTOS' then b.estado_caso = 'RESUELTO'
           when 'CERRADOS' then b.estado_caso = 'CERRADO'
           when 'TODOS' then true
           else false end
     and (p_filtros ->> 'tipo' is null or b.tipo_codigo = p_filtros ->> 'tipo')
     and (p_filtros ->> 'estado' is null or b.estado_caso = p_filtros ->> 'estado')
     and (p_filtros ->> 'prioridad' is null or b.prioridad = p_filtros ->> 'prioridad')
     and (p_filtros ->> 'canal' is null or b.canal = p_filtros ->> 'canal')
     and (p_filtros ->> 'responsable' is null or (p_filtros ->> 'responsable') = 'NINGUNO' and b.responsable_id is null
          or b.responsable_id::text = p_filtros ->> 'responsable')
     and (p_filtros ->> 'negocio' is null or b.negocio_id::text = p_filtros ->> 'negocio')
     and (p_filtros ->> 'usuario' is null or b.creado_por::text = p_filtros ->> 'usuario')
     and (p_filtros ->> 'desde' is null or b.recibido_at >= (p_filtros ->> 'desde')::timestamptz)
     and (p_filtros ->> 'hasta' is null or b.recibido_at <= (p_filtros ->> 'hasta')::timestamptz)
     and (v_busca is null or b.numero_radicacion = upper(v_busca))
   order by public._caso_prioridad_orden(b.prioridad) desc, b.fecha_limite nulls last, b.recibido_at
   limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.caso_listar(text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.caso_listar(text, jsonb, integer, integer) to authenticated;

-- ── Detalle ────────────────────────────────────────────────────────────────
create or replace function public.caso_detalle(p_ticket uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.ticket_soporte; r public.caso_plazo_regla;
begin
  perform public._caso_exigir_supersu();
  select * into t from public.ticket_soporte where id = p_ticket;
  if not found then return null; end if;
  select * into r from public.caso_plazo_regla where id = t.regla_id;
  return jsonb_build_object(
    'ticket', to_jsonb(t),
    'tipo', (select to_jsonb(c) from public.caso_tipo c where c.codigo = t.tipo_codigo),
    'regla', case when r.id is null then null else jsonb_build_object('norma', r.norma, 'articulo', r.articulo, 'fuente_url', r.fuente_url,
      'plazo', r.plazo, 'unidad', r.unidad, 'estado_verificacion', r.estado_verificacion, 'prorroga_max', r.prorroga_max,
      'observaciones', r.observaciones) end,
    'solicitante', (select to_jsonb(s) - 'politica_texto_id' from public.caso_solicitante s where s.ticket_id = t.id),
    'responsable', (select nombre from public.perfil where id = t.responsable_id),
    'mensajes', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.ticket_mensaje m where m.ticket_id = t.id), '[]'),
    'historial', coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.caso_historial h where h.ticket_id = t.id), '[]'),
    'adjuntos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre_original, 'mime', a.mime, 'bytes', a.bytes, 'sha256', a.sha256,
                          'subido_por_tipo', a.subido_por_tipo, 'at', a.created_at) order by a.created_at) from public.caso_adjunto a where a.ticket_id = t.id), '[]'),
    'notificaciones', coalesce((select jsonb_agg(jsonb_build_object('canal', n.canal, 'regla', n.regla, 'estado', n.estado, 'destinatario_tipo', n.destinatario_tipo,
                          'intentos', n.intentos, 'error', n.ultimo_error, 'at', n.created_at) order by n.created_at desc)
                          from public.cumplimiento_notificacion n where n.ticket_id = t.id), '[]'));
end $$;
revoke all on function public.caso_detalle(uuid) from public, anon, authenticated;
grant execute on function public.caso_detalle(uuid) to authenticated;

-- Alertas del CRM (campana del Centro).
create or replace function public.cumplimiento_alertas_crm(p_limite integer default 30)
returns table (id uuid, ticket_id uuid, numero text, regla text, prioridad text, created_at timestamptz, leida boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._caso_exigir_supersu();
  return query select n.id, n.ticket_id, n.datos ->> 'numero', n.regla, n.datos ->> 'prioridad', n.created_at, n.leida_at is not null
    from public.cumplimiento_notificacion n where n.canal = 'CRM' order by n.created_at desc limit least(greatest(p_limite, 1), 100);
end $$;
revoke all on function public.cumplimiento_alertas_crm(integer) from public, anon, authenticated;
grant execute on function public.cumplimiento_alertas_crm(integer) to authenticated;
