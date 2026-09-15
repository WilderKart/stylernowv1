-- StylerNow — Migración 016: Módulo 2.2 — Dashboard del Panel Negocio
-- Fuente: 02-UX/09_Business_Panel.md ("Resumen del día: citas de hoy,
-- ingresos del día, % de ocupación, próxima cita, línea de tiempo del día,
-- ranking de Staff de la semana"), 01-PRD/05_KPIs.md (fórmulas exactas —
-- completado en esta misma sesión, ver esa sección nueva "KPIs del Resumen
-- del día"), 08-Growth-Monetization/02_Commissions.md (fórmula de comisión
-- de Staff).
--
-- "Línea de tiempo del día" no tiene RPC propio: es un SELECT directo sobre
-- `reserva`, ya protegido por las políticas `reserva_select_barberia` /
-- `reserva_select_guardian` de la migración 006 — no hace falta duplicar
-- esa autorización acá.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Resumen del día: citas, ingresos, % de ocupación, próxima cita.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.dashboard_resumen_dia(p_negocio_id uuid, p_sede_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_autorizado boolean;
  v_hoy date;
  v_inicio_dia timestamptz;
  v_fin_dia timestamptz;
  v_dia_semana int;
  v_citas_hoy int;
  v_ingresos_hoy numeric;
  v_capacidad_min numeric;
  v_reservado_min numeric;
  v_ocupacion_pct numeric;
  v_proxima jsonb;
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_hoy := (now() at time zone 'America/Bogota')::date;
  v_inicio_dia := v_hoy::timestamp at time zone 'America/Bogota';
  v_fin_dia := (v_hoy + 1)::timestamp at time zone 'America/Bogota';
  v_dia_semana := extract(dow from v_hoy)::int; -- 0=domingo, coincide con disponibilidad.dia_semana

  select count(*), coalesce(sum(monto_total) filter (where estado = 'COMPLETADA'), 0)
  into v_citas_hoy, v_ingresos_hoy
  from public.reserva
  where negocio_id = p_negocio_id
    and (p_sede_id is null or sede_id = p_sede_id)
    and hora_inicio >= v_inicio_dia and hora_inicio < v_fin_dia
    and estado <> 'CANCELADA';

  -- Minutos reservados hoy — un NO_SHOW igual ocupó la agenda, cuenta.
  select coalesce(sum(extract(epoch from (hora_fin - hora_inicio)) / 60), 0)
  into v_reservado_min
  from public.reserva
  where negocio_id = p_negocio_id
    and (p_sede_id is null or sede_id = p_sede_id)
    and hora_inicio >= v_inicio_dia and hora_inicio < v_fin_dia
    and estado <> 'CANCELADA';

  -- Capacidad: minutos de disponibilidad configurada hoy por Staff ACTIVO,
  -- descontando la franja completa si se solapa con un bloqueo de ausencia
  -- (simplificación V1 documentada en 01-PRD/05_KPIs.md).
  select coalesce(sum(extract(epoch from (d.hora_fin - d.hora_inicio)) / 60), 0)
  into v_capacidad_min
  from public.disponibilidad d
  join public.vinculo_staff_negocio v on v.id = d.vinculo_id
  where v.negocio_id = p_negocio_id
    and v.estado = 'ACTIVO'
    and (p_sede_id is null or v.sede_activa_id = p_sede_id)
    and d.dia_semana = v_dia_semana
    and not exists (
      select 1 from public.bloqueo_ausencia b
      where b.vinculo_id = d.vinculo_id
        and b.fecha_inicio < ((v_hoy::timestamp + d.hora_fin) at time zone 'America/Bogota')
        and b.fecha_fin > ((v_hoy::timestamp + d.hora_inicio) at time zone 'America/Bogota')
    );

  v_ocupacion_pct := case when v_capacidad_min > 0 then round((v_reservado_min / v_capacidad_min) * 100, 1) else null end;

  select jsonb_build_object(
    'reserva_id', r.id, 'hora_inicio', r.hora_inicio, 'staff_nombre', s.nombre, 'sede_id', r.sede_id
  )
  into v_proxima
  from public.reserva r
  left join public.staff s on s.usuario_id = r.staff_id
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'CONFIRMADA'
    and r.hora_inicio >= now()
  order by r.hora_inicio asc
  limit 1;

  return jsonb_build_object(
    'citas_hoy', v_citas_hoy,
    'ingresos_hoy', v_ingresos_hoy,
    'ocupacion_pct', v_ocupacion_pct,
    'capacidad_minutos', v_capacidad_min,
    'reservado_minutos', v_reservado_min,
    'proxima_cita', v_proxima
  );
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Ranking de Staff de la semana, por comisión generada.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.dashboard_ranking_staff_semana(p_negocio_id uuid, p_sede_id uuid default null)
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
  v_inicio_semana timestamptz;
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_inicio_semana := date_trunc('week', now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota';

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
    and r.hora_inicio >= v_inicio_semana
  where v.negocio_id = p_negocio_id
    and v.estado in ('ACTIVO', 'SUSPENDIDO')
    and (p_sede_id is null or v.sede_activa_id = p_sede_id)
  group by v.id, s.nombre, s.foto_url, sd.nombre
  order by comision_generada desc, reservas_completadas desc
  limit 10;
end;
$fn$;

grant execute on function public.dashboard_resumen_dia(uuid, uuid) to authenticated;
grant execute on function public.dashboard_ranking_staff_semana(uuid, uuid) to authenticated;
