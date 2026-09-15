-- StylerNow — Migración 023: Módulo 2.10 — Reportes (cierra la Fase 2)
-- Fuente: 02-UX/09_Business_Panel.md ("Reportes": gráfico de ingresos por
-- semana/mes, servicios más vendidos, ranking de Staff, reseñas recibidas
-- con opción de responder públicamente), 07-QA/04_Business.md (QA-BIZ-
-- 086 a 089).
--
-- Responder una reseña NO necesita RPC ni RLS nueva: `resena.
-- respuesta_negocio` y la política `resena_update_respuesta_negocio`
-- (tiene_acceso_interno) ya existían desde el Módulo 1 — esta es la
-- primera vez que algo las usa de verdad.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Ranking de Staff por comisión generada, con rango de fechas real —
--    generaliza dashboard_ranking_staff_semana() (migración 016), que
--    pasa a ser un envoltorio delgado sobre esta misma función en vez de
--    duplicar la lógica (Regla de Oro).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reportes_ranking_staff(
  p_negocio_id uuid,
  p_sede_id uuid default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null
)
returns table (
  vinculo_id uuid,
  nombre text,
  foto_url text,
  sede_nombre text,
  comision_generada numeric,
  reservas_completadas int
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_autorizado boolean;
  v_desde timestamptz := coalesce(p_desde, date_trunc('week', now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota');
  v_hasta timestamptz := coalesce(p_hasta, now());
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    v.id as vinculo_id,
    s.nombre,
    s.foto_url,
    sd.nombre as sede_nombre,
    coalesce(sum(r.monto_total * coalesce(v.comision_pct, 0) / 100), 0) as comision_generada,
    count(r.id)::int as reservas_completadas
  from public.vinculo_staff_negocio v
  join public.staff s on s.usuario_id = v.staff_id
  left join public.sede sd on sd.id = v.sede_activa_id
  left join public.reserva r on r.staff_id = v.staff_id
    and r.negocio_id = v.negocio_id
    and r.estado = 'COMPLETADA'
    and r.hora_inicio >= v_desde and r.hora_inicio < v_hasta
  where v.negocio_id = p_negocio_id
    and v.estado in ('ACTIVO', 'SUSPENDIDO')
    and (p_sede_id is null or v.sede_activa_id = p_sede_id)
  group by v.id, s.nombre, s.foto_url, sd.nombre
  order by comision_generada desc, reservas_completadas desc
  limit 20;
end;
$fn$;

create or replace function public.dashboard_ranking_staff_semana(p_negocio_id uuid, p_sede_id uuid default null)
returns table (
  vinculo_id uuid,
  nombre text,
  foto_url text,
  sede_nombre text,
  comision_generada numeric,
  reservas_completadas int
)
language sql stable security definer set search_path = public as $fn$
  select * from public.reportes_ranking_staff(p_negocio_id, p_sede_id, null, null);
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Ingresos por semana/mes (QA-BIZ-086) — misma convención de GMV que
--    Dashboard/CRM: solo Reservas COMPLETADA cuentan como ingreso real.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reportes_ingresos_periodo(
  p_negocio_id uuid,
  p_sede_id uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_agrupacion text default 'semana' -- 'semana' | 'mes'
)
returns table (
  periodo date,
  ingresos numeric,
  citas_completadas int
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_autorizado boolean;
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Bogota')::date - interval '12 weeks');
  v_hasta date := coalesce(p_hasta, (now() at time zone 'America/Bogota')::date);
  v_unidad text := case when p_agrupacion = 'mes' then 'month' else 'week' end;
begin
  if p_agrupacion not in ('semana', 'mes') then
    raise exception 'AGRUPACION_INVALIDA';
  end if;
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    date_trunc(v_unidad, r.hora_inicio at time zone 'America/Bogota')::date as periodo,
    coalesce(sum(r.monto_total), 0) as ingresos,
    count(*)::int as citas_completadas
  from public.reserva r
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'COMPLETADA'
    and (r.hora_inicio at time zone 'America/Bogota')::date >= v_desde
    and (r.hora_inicio at time zone 'America/Bogota')::date <= v_hasta
  group by 1
  order by 1;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Servicios más vendidos (QA-BIZ-087).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reportes_servicios_top(
  p_negocio_id uuid,
  p_sede_id uuid default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  servicio_id uuid,
  nombre text,
  veces_vendido int,
  ingresos numeric
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_autorizado boolean;
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Bogota')::date - interval '90 days');
  v_hasta date := coalesce(p_hasta, (now() at time zone 'America/Bogota')::date);
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    sv.id as servicio_id,
    sv.nombre,
    count(*)::int as veces_vendido,
    coalesce(sum(rs.precio_congelado_unitario), 0) as ingresos
  from public.reserva_servicio rs
  join public.reserva r on r.id = rs.reserva_id
  join public.servicio sv on sv.id = rs.servicio_id
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'COMPLETADA'
    and (r.hora_inicio at time zone 'America/Bogota')::date >= v_desde
    and (r.hora_inicio at time zone 'America/Bogota')::date <= v_hasta
  group by sv.id, sv.nombre
  order by veces_vendido desc, ingresos desc
  limit 20;
end;
$fn$;

grant execute on function public.reportes_ranking_staff(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.reportes_ingresos_periodo(uuid, uuid, date, date, text) to authenticated;
grant execute on function public.reportes_servicios_top(uuid, uuid, date, date) to authenticated;
