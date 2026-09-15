-- StylerNow — Migración 026: Fase 3.2 — SuperSU: Configuración global
-- Fuente: 02-UX/10_Super_Admin.md ("Planes y Configuración global"),
-- 08-Growth-Monetization/02_Commissions.md, 01_Marketplace_Algorithm.md,
-- 08-Growth-Monetization/04_Subscriptions_Lifecycle.md,
-- 06-Security/04_Compliance_Colombia.md.
--
-- Alcance de este módulo: comisión de plataforma (global, en tiempo real),
-- ciudades habilitadas (visibilidad de descubrimiento, nunca suspende un
-- Negocio), banners del Home, edición de Planes SaaS, publicación
-- versionada de textos legales. "Crear" un Plan nuevo no se construye:
-- plan_codigo es un enum con los 4 tramos ya seedeados en la migración 004
-- y la Biblia de Monetización no define un quinto tramo — crear uno
-- requeriría extender el enum sin ningún caso de uso real todavía.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Comisión de plataforma — valor global (singleton, en tiempo real)
-- ════════════════════════════════════════════════════════════════════════
-- negocio.comision_plataforma_pct (migración 002) es una columna por
-- Negocio, pero hoy nada la diferencia entre negocios — todos nacen con el
-- mismo default (8.00) y nunca se edita. Esta tabla singleton guarda el
-- valor global que SuperSU controla; al cambiarlo se actualiza en el mismo
-- momento la columna de TODOS los Negocios, así el siguiente pago que se
-- apruebe en cualquiera de ellos usa el nuevo valor de inmediato — sin
-- recalcular pagos ya aprobados (booking_engine.sql lee el valor vigente
-- del Negocio recién en el momento de aprobar el pago, nunca antes).
create table public.configuracion_plataforma (
  id boolean primary key default true,
  comision_plataforma_pct_default numeric(5,2) not null default 8.00
    check (comision_plataforma_pct_default between 3 and 15),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint configuracion_plataforma_singleton check (id)
);
insert into public.configuracion_plataforma (id) values (true);

alter table public.configuracion_plataforma enable row level security;
create policy configuracion_plataforma_select_supersu on public.configuracion_plataforma
  for select using (public.is_supersu());

create or replace function public.actualizar_comision_plataforma_global(p_pct numeric)
returns public.configuracion_plataforma
language plpgsql security definer set search_path = public as $fn$
declare
  v_anterior numeric;
  v_config public.configuracion_plataforma;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_pct is null or p_pct < 3 or p_pct > 15 then
    raise exception 'COMISION_FUERA_DE_RANGO';
  end if;

  select comision_plataforma_pct_default into v_anterior from public.configuracion_plataforma where id = true;

  update public.configuracion_plataforma
  set comision_plataforma_pct_default = p_pct, updated_at = now(), updated_by = auth.uid()
  where id = true
  returning * into v_config;

  update public.negocio set comision_plataforma_pct = p_pct;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_antes, payload_despues)
  values ('configuracion_plataforma', null, 'COMISION_PLATAFORMA_ACTUALIZADA', 'SUPERSU', auth.uid(),
    jsonb_build_object('comision_pct', v_anterior), jsonb_build_object('comision_pct', p_pct));

  return v_config;
end;
$fn$;
grant execute on function public.actualizar_comision_plataforma_global(numeric) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Ciudades habilitadas — visibilidad de descubrimiento, no suspensión
-- ════════════════════════════════════════════════════════════════════════
create table public.ciudad_habilitada (
  ciudad text primary key,
  habilitada boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
-- Toda ciudad con Negocio existente hoy arranca habilitada — deshabilitar
-- es una acción explícita nueva de SuperSU, nunca un estado de partida.
insert into public.ciudad_habilitada (ciudad)
  select distinct ciudad from public.negocio
  on conflict (ciudad) do nothing;

alter table public.ciudad_habilitada enable row level security;
create policy ciudad_habilitada_select_publico on public.ciudad_habilitada
  for select using (true);

create or replace function public.actualizar_ciudad_habilitada(p_ciudad text, p_habilitada boolean)
returns public.ciudad_habilitada
language plpgsql security definer set search_path = public as $fn$
declare
  v_row public.ciudad_habilitada;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_ciudad is null or length(trim(p_ciudad)) = 0 then
    raise exception 'CIUDAD_REQUERIDA';
  end if;

  insert into public.ciudad_habilitada (ciudad, habilitada, updated_by)
  values (p_ciudad, p_habilitada, auth.uid())
  on conflict (ciudad) do update set habilitada = p_habilitada, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_despues)
  values ('ciudad_habilitada', null, case when p_habilitada then 'CIUDAD_HABILITADA' else 'CIUDAD_DESHABILITADA' end,
    'SUPERSU', auth.uid(), jsonb_build_object('ciudad', p_ciudad));

  return v_row;
end;
$fn$;
grant execute on function public.actualizar_ciudad_habilitada(text, boolean) to authenticated;

-- marketplace_buscar (013) y el listado de ciudades del Home (page.tsx) deben
-- respetar esta bandera de inmediato: se re-crea agregando el filtro, sin
-- duplicar el resto de la lógica ya verificada.
create or replace function public.marketplace_buscar(
  p_texto text default null,
  p_ciudad text default null,
  p_categoria text default null,
  p_orden text default 'RELEVANCIA',
  p_limite int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  nombre text,
  slug text,
  ciudad text,
  categoria text[],
  descripcion text,
  logo_url text,
  calificacion numeric,
  total_resenas bigint,
  precio_desde numeric,
  sede_id uuid,
  proxima_disponibilidad timestamptz
)
language sql stable set search_path = public as $fn$
  with base as (
    select
      n.id, n.nombre, n.slug, n.ciudad, n.categoria, n.descripcion, n.logo_url, n.created_at,
      (select round(avg(re.calificacion)::numeric, 2) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as calificacion,
      (select count(*) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as total_resenas,
      (select min(sv.precio_base) from public.servicio sv
        where sv.negocio_id = n.id and sv.estado = 'ACTIVO') as precio_desde
    from public.negocio n
    where n.estado = 'ACTIVO'
      and n.elegibilidad_marketplace
      and coalesce((select ch.habilitada from public.ciudad_habilitada ch where ch.ciudad = n.ciudad), true)
      and (p_ciudad is null or n.ciudad ilike p_ciudad)
      and (p_categoria is null or p_categoria = any(n.categoria))
      and (
        p_texto is null or p_texto = ''
        or n.nombre ilike '%' || p_texto || '%'
        or coalesce(n.descripcion, '') ilike '%' || p_texto || '%'
      )
  ),
  ordenado as (
    select * from base
    order by
      case when p_orden = 'CALIFICACION' then calificacion end desc nulls last,
      case when p_orden = 'PRECIO' then precio_desde end asc nulls last,
      case when p_orden = 'RECIENTE' then created_at end desc,
      calificacion desc nulls last,
      created_at desc
    limit greatest(coalesce(p_limite, 20), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    o.id, o.nombre, o.slug, o.ciudad, o.categoria, o.descripcion, o.logo_url,
    coalesce(o.calificacion, 0), o.total_resenas, o.precio_desde,
    sede.id, prox.inicio
  from ordenado o
  left join lateral (
    select s.id, s.zona_horaria
    from public.sede s
    where s.negocio_id = o.id
      and not s.cerrada_permanente
      and not s.cerrada_temporalmente
    order by s.es_principal desc, s.created_at
    limit 1
  ) sede on true
  left join lateral (
    select min(sd.hora_inicio) as inicio
    from public.slots_disponibles(
      sede.id,
      array[(
        select sv.id from public.servicio sv
        where sv.negocio_id = o.id and sv.estado = 'ACTIVO'
        order by sv.precio_base
        limit 1
      )],
      (now() at time zone coalesce(sede.zona_horaria, 'America/Bogota'))::date,
      null,
      30
    ) sd
    where sd.disponible
  ) prox on true;
$fn$;
grant execute on function public.marketplace_buscar(text, text, text, text, int, int) to anon, authenticated;

create or replace function public.marketplace_ciudades_disponibles()
returns table (ciudad text)
language sql stable set search_path = public as $fn$
  select distinct n.ciudad
  from public.negocio n
  where n.estado = 'ACTIVO'
    and n.elegibilidad_marketplace
    and coalesce((select ch.habilitada from public.ciudad_habilitada ch where ch.ciudad = n.ciudad), true)
  order by n.ciudad;
$fn$;
grant execute on function public.marketplace_ciudades_disponibles() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Banners del Home
-- ════════════════════════════════════════════════════════════════════════
create table public.banner_home (
  id uuid primary key default gen_random_uuid(),
  imagen_url text not null,
  texto text,
  url_destino text,
  vigencia_desde timestamptz,
  vigencia_hasta timestamptz,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint banner_home_vigencia check (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta > vigencia_desde)
);
create trigger trg_updated_at before update on public.banner_home for each row execute function public.set_updated_at();

alter table public.banner_home enable row level security;
create policy banner_home_select_publico on public.banner_home
  for select using (
    activo
    and (vigencia_desde is null or vigencia_desde <= now())
    and (vigencia_hasta is null or vigencia_hasta >= now())
  );
create policy banner_home_select_supersu on public.banner_home
  for select using (public.is_supersu());

create or replace function public.crear_banner_home(
  p_imagen_url text, p_texto text, p_url_destino text,
  p_vigencia_desde timestamptz, p_vigencia_hasta timestamptz, p_orden int
)
returns public.banner_home
language plpgsql security definer set search_path = public as $fn$
declare v_row public.banner_home;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_imagen_url is null or length(trim(p_imagen_url)) = 0 then raise exception 'IMAGEN_REQUERIDA'; end if;

  insert into public.banner_home (imagen_url, texto, url_destino, vigencia_desde, vigencia_hasta, orden, updated_by)
  values (p_imagen_url, p_texto, p_url_destino, p_vigencia_desde, p_vigencia_hasta, coalesce(p_orden, 0), auth.uid())
  returning * into v_row;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('banner_home', v_row.id, 'BANNER_CREADO', 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.crear_banner_home(text, text, text, timestamptz, timestamptz, int) to authenticated;

create or replace function public.actualizar_banner_home(
  p_id uuid, p_imagen_url text, p_texto text, p_url_destino text,
  p_vigencia_desde timestamptz, p_vigencia_hasta timestamptz, p_orden int, p_activo boolean
)
returns public.banner_home
language plpgsql security definer set search_path = public as $fn$
declare v_row public.banner_home;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  update public.banner_home set
    imagen_url = coalesce(p_imagen_url, imagen_url),
    texto = p_texto,
    url_destino = p_url_destino,
    vigencia_desde = p_vigencia_desde,
    vigencia_hasta = p_vigencia_hasta,
    orden = coalesce(p_orden, orden),
    activo = coalesce(p_activo, activo),
    updated_by = auth.uid()
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'BANNER_NO_ENCONTRADO'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('banner_home', v_row.id, 'BANNER_ACTUALIZADO', 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.actualizar_banner_home(uuid, text, text, text, timestamptz, timestamptz, int, boolean) to authenticated;

create or replace function public.eliminar_banner_home(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  delete from public.banner_home where id = p_id;
  if not found then raise exception 'BANNER_NO_ENCONTRADO'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('banner_home', p_id, 'BANNER_ELIMINADO', 'SUPERSU', auth.uid());
end;
$fn$;
grant execute on function public.eliminar_banner_home(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Gestión de Planes SaaS (editar — crear queda fuera, ver nota de alcance)
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.actualizar_plan(
  p_codigo plan_codigo, p_precio_mensual numeric, p_limite_sedes int,
  p_staff_incluido int, p_staff_addon_precio numeric, p_sede_addon_precio numeric,
  p_guardian_disponible boolean, p_marketplace_ads_disponible boolean,
  p_creditos_ia_mes int, p_conversaciones_whatsapp_mes int
)
returns public.plan
language plpgsql security definer set search_path = public as $fn$
declare v_row public.plan;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  update public.plan set
    precio_mensual = p_precio_mensual,
    limite_sedes = p_limite_sedes,
    staff_incluido = p_staff_incluido,
    staff_addon_precio = p_staff_addon_precio,
    sede_addon_precio = p_sede_addon_precio,
    guardian_disponible = coalesce(p_guardian_disponible, guardian_disponible),
    marketplace_ads_disponible = coalesce(p_marketplace_ads_disponible, marketplace_ads_disponible),
    creditos_ia_mes = p_creditos_ia_mes,
    conversaciones_whatsapp_mes = p_conversaciones_whatsapp_mes,
    updated_at = now()
  where codigo = p_codigo
  returning * into v_row;

  if not found then raise exception 'PLAN_NO_ENCONTRADO'; end if;

  -- 02-UX/10_Super_Admin.md: nunca retroactivo a una suscripción ya facturada
  -- en el ciclo actual — no se toca `suscripcion` acá, solo el catálogo de
  -- Plan; la próxima renovación de cada suscripción ya lee el valor nuevo.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('plan', null, 'PLAN_ACTUALIZADO_' || p_codigo::text, 'SUPERSU', auth.uid());

  return v_row;
end;
$fn$;
grant execute on function public.actualizar_plan(plan_codigo, numeric, int, int, numeric, numeric, boolean, boolean, int, int) to authenticated;

-- Lectura de Planes ya es pública (negocio la necesita al registrarse) —
-- se confirma la política existente sigue cubriendo /admin sin duplicarla.

-- ════════════════════════════════════════════════════════════════════════
-- 5. Textos legales — publicación versionada por SuperSU
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.publicar_texto_legal(p_tipo text, p_contenido text, p_cambio_material boolean)
returns public.texto_legal
language plpgsql security definer set search_path = public as $fn$
declare
  v_version int;
  v_row public.texto_legal;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_tipo not in ('TERMINOS', 'POLITICA_DATOS') then raise exception 'TIPO_INVALIDO'; end if;
  if p_contenido is null or length(trim(p_contenido)) = 0 then raise exception 'CONTENIDO_REQUERIDO'; end if;

  select coalesce(max(version), 0) + 1 into v_version from public.texto_legal where tipo = p_tipo;

  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values (p_tipo, v_version, p_contenido, coalesce(p_cambio_material, false))
  returning * into v_row;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_despues)
  values ('texto_legal', v_row.id, 'TEXTO_LEGAL_PUBLICADO', 'SUPERSU', auth.uid(),
    jsonb_build_object('tipo', p_tipo, 'version', v_version, 'cambio_material', v_row.cambio_material));

  return v_row;
end;
$fn$;
grant execute on function public.publicar_texto_legal(text, text, boolean) to authenticated;
