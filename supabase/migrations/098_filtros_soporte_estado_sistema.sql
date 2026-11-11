-- 098: Filtros del marketplace (C06), soporte del cliente (C13), estados del sistema (C16).

-- C06: marketplace_buscar NO cambia de firma; este envoltorio agrega distancia, calificacion minima y abierto hoy.
-- "Abierto hoy" = la proxima disponibilidad real (slots_disponibles) cae en el dia de hoy en la zona de la sede.
create or replace function public.marketplace_buscar_filtrado(
  p_texto text default null, p_ciudad text default null, p_categoria text default null,
  p_orden text default 'RELEVANCIA', p_limite integer default 20, p_offset integer default 0,
  p_lat double precision default null, p_lng double precision default null,
  p_radio_km numeric default null, p_calif_min numeric default null, p_abierto_hoy boolean default false)
returns table (id uuid, nombre text, slug text, ciudad text, categoria text[], descripcion text, logo_url text,
               calificacion numeric, total_resenas bigint, precio_desde numeric, sede_id uuid,
               proxima_disponibilidad timestamptz, patrocinado boolean, campana_id uuid,
               sede_latitud double precision, sede_longitud double precision,
               distancia_km numeric, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with base as (
    select m.*, sd.zona_horaria,
      case when p_lat is not null and p_lng is not null and m.sede_latitud is not null and m.sede_longitud is not null then
        round((6371 * acos(greatest(-1, least(1,
          cos(radians(p_lat)) * cos(radians(m.sede_latitud)) * cos(radians(m.sede_longitud) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(m.sede_latitud))))))::numeric, 2) end as dist
    from public.marketplace_buscar(p_texto, p_ciudad, p_categoria, p_orden, 200, 0, p_lat, p_lng)
         with ordinality as m(id, nombre, slug, ciudad, categoria, descripcion, logo_url, calificacion,
              total_resenas, precio_desde, sede_id, proxima_disponibilidad, patrocinado, campana_id,
              sede_latitud, sede_longitud, ord)
    left join public.sede sd on sd.id = m.sede_id
  ), filtrado as (
    select b.* from base b
    where (p_radio_km is null or b.dist is null or b.dist <= p_radio_km)
      and (p_calif_min is null or b.calificacion >= p_calif_min)
      and (not coalesce(p_abierto_hoy, false) or (
            b.proxima_disponibilidad is not null
            and (b.proxima_disponibilidad at time zone coalesce(b.zona_horaria, 'America/Bogota'))::date
                = (now() at time zone coalesce(b.zona_horaria, 'America/Bogota'))::date))
  )
  select f.id, f.nombre, f.slug, f.ciudad, f.categoria, f.descripcion, f.logo_url, f.calificacion,
         f.total_resenas, f.precio_desde, f.sede_id, f.proxima_disponibilidad, f.patrocinado, f.campana_id,
         f.sede_latitud, f.sede_longitud, f.dist, count(*) over ()
  from filtrado f order by f.ord
  limit greatest(coalesce(p_limite, 20), 1) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.marketplace_buscar_filtrado(text, text, text, text, integer, integer, double precision, double precision, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.marketplace_buscar_filtrado(text, text, text, text, integer, integer, double precision, double precision, numeric, numeric, boolean) to anon, authenticated;

-- C13: tickets del cliente. Categoria (CITA|PAGO|CUENTA|OTRO) va como prefijo del asunto: "[PAGO] ...".
create or replace function public.cliente_crear_ticket(p_categoria text, p_mensaje text, p_reserva_id uuid default null)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_cat text := upper(coalesce(p_categoria, '')); v_msg text := trim(coalesce(p_mensaje, '')); v_cod text;
  v_asunto text; v public.ticket_soporte;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if v_cat not in ('CITA','PAGO','CUENTA','OTRO') then raise exception 'CATEGORIA_INVALIDA'; end if;
  if length(v_msg) < 5 then raise exception 'MENSAJE_REQUERIDO'; end if;
  if length(v_msg) > 2000 then raise exception 'MENSAJE_LARGO'; end if;
  if p_reserva_id is not null then
    select upper(substr(replace(r.id::text, '-', ''), 1, 6)) into v_cod
    from public.reserva r where r.id = p_reserva_id and r.cliente_id = auth.uid();
    if v_cod is null then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
    v_msg := 'Cita ' || v_cod || E'\n' || v_msg;
  end if;
  if (select count(*) from public.ticket_soporte t
      where t.creado_por = auth.uid() and t.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'DEMASIADOS_TICKETS';
  end if;
  v_asunto := '[' || v_cat || '] ' || left(regexp_replace(v_msg, '\s+', ' ', 'g'), 70);
  v := public.crear_ticket_soporte(v_asunto, v_msg, null);
  return v;
end $$;
revoke all on function public.cliente_crear_ticket(text, text, uuid) from public, anon, authenticated;
grant execute on function public.cliente_crear_ticket(text, text, uuid) to authenticated;

create or replace function public.cliente_listar_tickets(p_limite integer default 30)
returns table (ticket_id uuid, codigo text, categoria text, asunto text, estado text,
               created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select t.id, '#T-' || upper(substr(replace(t.id::text, '-', ''), 1, 4)),
         coalesce(substring(t.asunto from '^\[([A-Z]+)\]'), 'OTRO'),
         regexp_replace(t.asunto, '^\[[A-Z]+\]\s*', ''),
         t.estado::text, t.created_at, t.updated_at
  from public.ticket_soporte t
  where t.creado_por = auth.uid() and t.negocio_id is null
  order by t.created_at desc limit least(greatest(coalesce(p_limite, 30), 1), 100);
end $$;
revoke all on function public.cliente_listar_tickets(integer) from public, anon, authenticated;
grant execute on function public.cliente_listar_tickets(integer) to authenticated;

create or replace function public.cliente_ticket_mensajes(p_ticket_id uuid)
returns table (id uuid, actor_tipo text, mensaje text, es_mio boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.ticket_soporte t where t.id = p_ticket_id and t.creado_por = auth.uid()) then
    raise exception 'TICKET_NO_ENCONTRADO';
  end if;
  return query
  select m.id, m.actor_tipo, m.mensaje, m.autor_id = auth.uid(), m.created_at
  from public.ticket_mensaje m where m.ticket_id = p_ticket_id order by m.created_at asc;
end $$;
revoke all on function public.cliente_ticket_mensajes(uuid) from public, anon, authenticated;
grant execute on function public.cliente_ticket_mensajes(uuid) to authenticated;

-- C16: estado del sistema. Flag de mantenimiento en la configuracion global, legible publicamente via RPC.
alter table public.configuracion_plataforma
  add column if not exists mantenimiento_activo boolean not null default false,
  add column if not exists mantenimiento_inicio timestamptz,
  add column if not exists mantenimiento_fin_estimado timestamptz,
  add column if not exists mantenimiento_mensaje text,
  add column if not exists app_version_actual text,
  add column if not exists app_version_minima text;

create or replace function public.estado_sistema()
returns table (mantenimiento boolean, inicio timestamptz, fin_estimado timestamptz, mensaje text,
               version_actual text, version_minima text, ahora timestamptz)
language sql stable security definer set search_path = public as $$
  select c.mantenimiento_activo, c.mantenimiento_inicio, c.mantenimiento_fin_estimado, c.mantenimiento_mensaje,
         c.app_version_actual, c.app_version_minima, now()
  from public.configuracion_plataforma c where c.id;
$$;
revoke all on function public.estado_sistema() from public, anon, authenticated;
grant execute on function public.estado_sistema() to anon, authenticated, service_role;

create or replace function public.supersu_configurar_sistema(
  p_mantenimiento boolean, p_inicio timestamptz default null, p_fin_estimado timestamptz default null,
  p_mensaje text default null, p_version_actual text default null, p_version_minima text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_mantenimiento is null then raise exception 'VALOR_INVALIDO'; end if;
  if p_fin_estimado is not null and p_inicio is not null and p_fin_estimado < p_inicio then
    raise exception 'FECHAS_INVALIDAS';
  end if;
  update public.configuracion_plataforma set
    mantenimiento_activo = p_mantenimiento,
    mantenimiento_inicio = case when p_mantenimiento then coalesce(p_inicio, now()) else null end,
    mantenimiento_fin_estimado = case when p_mantenimiento then p_fin_estimado else null end,
    mantenimiento_mensaje = case when p_mantenimiento then left(p_mensaje, 300) else null end,
    app_version_actual = coalesce(p_version_actual, app_version_actual),
    app_version_minima = coalesce(p_version_minima, app_version_minima),
    updated_at = now(), updated_by = auth.uid()
  where id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_despues)
  values ('configuracion_plataforma', auth.uid(), 'SISTEMA_CONFIGURADO', 'SUPERSU', auth.uid(),
          jsonb_build_object('mantenimiento', p_mantenimiento, 'fin_estimado', p_fin_estimado));
end $$;
revoke all on function public.supersu_configurar_sistema(boolean, timestamptz, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.supersu_configurar_sistema(boolean, timestamptz, timestamptz, text, text, text) to authenticated;
