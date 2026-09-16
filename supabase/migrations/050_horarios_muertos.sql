-- StylerNow — Migración 050: Fase 6 — IA Operacional, Función 4
-- (Horarios muertos y oportunidades)
-- Fuente: 09-CRM-Intelligence/04_AI_Business.md, Función 4.
--
-- Nivel 0 explícito de la Biblia: "conteo estadístico simple... resuelto
-- enteramente con reglas fijas, sin modelo de IA ni consumo de créditos"
-- — la única de las 4 funciones de este documento que NO depende de una
-- credencial de proveedor de LLM (bloqueada en PENDING_DECISIONS.md). Se
-- construye ahora en su totalidad; las otras 3 quedan para cuando el
-- fundador provea esa credencial.
--
-- La Biblia describe su salida como alimentando también "una sugerencia
-- de activar una Promoción Flash en esa franja específica" — Flash sigue
-- bloqueada (depende del motor de Push/Firebase, Módulo 6.2/
-- PENDING_DECISIONS.md), así que esta función expone el insight puro,
-- sin ningún botón de acción que no tendría efecto real (Regla de Oro).

create or replace function public.detectar_horarios_muertos(p_negocio_id uuid)
returns table (
  vinculo_id uuid,
  staff_nombre text,
  sede_id uuid,
  sede_nombre text,
  dia_semana int,
  hora_inicio time,
  hora_fin time,
  horas_disponibles numeric,
  horas_reservadas numeric,
  ocupacion_pct numeric
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_es_guardian boolean;
  v_sede_guardian uuid;
  v_row record;
  v_ocurrencias int;
  v_ausencia_horas numeric;
  v_horas_disp numeric;
  v_horas_res numeric;
begin
  select exists(
    select 1 from public.vinculo_staff_negocio
    where staff_id = auth.uid() and negocio_id = p_negocio_id and es_guardian = true and estado = 'ACTIVO'
  ) into v_es_guardian;

  if not (public.is_barberia_de(p_negocio_id) or v_es_guardian) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_es_guardian then
    select sede_activa_id into v_sede_guardian from public.vinculo_staff_negocio
    where staff_id = auth.uid() and negocio_id = p_negocio_id and es_guardian = true and estado = 'ACTIVO'
    limit 1;
  end if;

  for v_row in
    select d.vinculo_id, d.sede_id, d.dia_semana, d.hora_inicio as hi, d.hora_fin as hf,
           s.nombre as staff_nombre, sd.nombre as sede_nombre, v.staff_id
    from public.disponibilidad d
    join public.vinculo_staff_negocio v on v.id = d.vinculo_id
    join public.staff s on s.usuario_id = v.staff_id
    join public.sede sd on sd.id = d.sede_id
    where v.negocio_id = p_negocio_id and v.estado = 'ACTIVO'
      and (not v_es_guardian or d.sede_id = v_sede_guardian)
  loop
    -- Últimas 8 semanas (56 días): cuántas veces cayó ese día de la semana.
    select count(*) into v_ocurrencias
    from generate_series(current_date - 56, current_date - 1, interval '1 day') gs
    where extract(dow from gs) = v_row.dia_semana;

    if v_ocurrencias = 0 then
      continue;
    end if;

    -- Horas bloqueadas por ausencia que se solapan con cada ocurrencia real de la franja.
    select coalesce(sum(
      greatest(0, extract(epoch from (
        least(gs::timestamptz + v_row.hf, ba.fecha_fin) - greatest(gs::timestamptz + v_row.hi, ba.fecha_inicio)
      )) / 3600.0)
    ), 0) into v_ausencia_horas
    from generate_series(current_date - 56, current_date - 1, interval '1 day') gs
    join public.bloqueo_ausencia ba on ba.vinculo_id = v_row.vinculo_id
      and ba.fecha_inicio < gs::timestamptz + v_row.hf and ba.fecha_fin > gs::timestamptz + v_row.hi
    where extract(dow from gs) = v_row.dia_semana;

    v_horas_disp := v_ocurrencias * (extract(epoch from (v_row.hf - v_row.hi)) / 3600.0) - v_ausencia_horas;
    if v_horas_disp <= 0 then
      continue;
    end if;

    select coalesce(sum(extract(epoch from (r.hora_fin - r.hora_inicio)) / 3600.0), 0) into v_horas_res
    from public.reserva r
    where r.staff_id = v_row.staff_id and r.sede_id = v_row.sede_id
      and r.estado <> 'CANCELADA'
      and r.hora_inicio >= current_date - 56 and r.hora_inicio < current_date
      and extract(dow from r.hora_inicio) = v_row.dia_semana
      and r.hora_inicio::time >= v_row.hi and r.hora_inicio::time < v_row.hf;

    -- Solo franjas con muestra suficiente (>= 4h disponibles en 8 semanas) y
    -- ocupación sistemáticamente baja (< 30%) — evita falsos positivos sobre
    -- una franja recién creada o con una sola observación.
    if v_horas_disp >= 4 and (v_horas_res / v_horas_disp) < 0.30 then
      vinculo_id := v_row.vinculo_id;
      staff_nombre := v_row.staff_nombre;
      sede_id := v_row.sede_id;
      sede_nombre := v_row.sede_nombre;
      dia_semana := v_row.dia_semana;
      hora_inicio := v_row.hi;
      hora_fin := v_row.hf;
      horas_disponibles := round(v_horas_disp, 1);
      horas_reservadas := round(v_horas_res, 1);
      ocupacion_pct := round((v_horas_res / v_horas_disp) * 100, 1);
      return next;
    end if;
  end loop;

  return;
end;
$fn$;

grant execute on function public.detectar_horarios_muertos(uuid) to authenticated;
