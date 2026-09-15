-- StylerNow — Migración 014: corrección de max(uuid) reintroducido en 013
--
-- La migración 013 reescribió slots_disponibles() para respetar excepciones
-- de horario, pero copió una versión vieja del cálculo de tipo de Recurso
-- que usaba max(uuid) — función que no existe en Postgres (ya se había
-- corregido una vez en la migración 009 con array_agg + filter). Encontrado
-- por la prueba real end-to-end de Módulo 2.3, no a simple vista.

create or replace function public.slots_disponibles(
  p_sede_id uuid,
  p_servicio_ids uuid[],
  p_fecha date,
  p_staff_id uuid default null,
  p_granularidad_minutos int default 15
)
returns table (
  hora_inicio timestamptz,
  hora_fin timestamptz,
  staff_id uuid,
  recurso_id uuid,
  disponible boolean
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_sede public.sede;
  v_negocio public.negocio;
  v_tz text;
  v_dur int;
  v_buf_prev int;
  v_buf_post int;
  v_tipo_recurso uuid;
  v_n_servicios int;
  v_dia int;
  v_clave text;
  v_min_inicio timestamptz;
  v_max_inicio timestamptz;
  v_excepcion public.sede_horario_excepcion;
  v_hay_excepcion boolean;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found or v_sede.cerrada_permanente or v_sede.cerrada_temporalmente then
    return;
  end if;

  select * into v_negocio from public.negocio where id = v_sede.negocio_id;
  if not found or v_negocio.estado <> 'ACTIVO' then
    return;
  end if;

  v_tz := coalesce(v_sede.zona_horaria, 'America/Bogota');

  -- Excepción del día (festivo, cierre puntual, horario especial). Un
  -- `cerrado = true` corta toda la sede ese día sin evaluar nada más.
  select * into v_excepcion
  from public.sede_horario_excepcion
  where sede_id = p_sede_id and fecha = p_fecha;
  -- Se captura ahora: los SELECT siguientes (conteo de servicios, etc.)
  -- pisan `found` con su propio resultado antes de llegar al CTE de abajo.
  v_hay_excepcion := found;

  if v_hay_excepcion and v_excepcion.cerrado then
    return;
  end if;

  select count(*),
         coalesce(sum(s.duracion_minutos), 0),
         coalesce(sum(s.buffer_previo_minutos), 0),
         coalesce(sum(s.buffer_posterior_minutos), 0),
         -- max(uuid) no existe en Postgres (bug ya corregido una vez en la
         -- migración 009 — reintroducido acá al copiar una versión vieja de
         -- esta función; encontrado ahora por la prueba real, no a ojo).
         (array_agg(s.requiere_recurso_tipo_id) filter (where s.requiere_recurso_tipo_id is not null))[1]
    into v_n_servicios, v_dur, v_buf_prev, v_buf_post, v_tipo_recurso
  from public.servicio s
  where s.id = any(p_servicio_ids)
    and s.negocio_id = v_negocio.id
    and s.estado = 'ACTIVO';

  if v_n_servicios = 0 or v_n_servicios <> coalesce(array_length(p_servicio_ids, 1), 0) then
    return;
  end if;

  v_min_inicio := now() + make_interval(mins => v_negocio.min_anticipacion_minutos);
  v_max_inicio := now() + make_interval(days => v_negocio.max_anticipacion_dias);

  v_dia := extract(dow from p_fecha)::int;
  v_clave := (array['dom','lun','mar','mie','jue','vie','sab'])[v_dia + 1];

  return query
  with sede_ventanas as (
    -- Horario especial de la excepción tiene prioridad sobre el semanal.
    select v_excepcion.hora_inicio_especial as h_ini, v_excepcion.hora_fin_especial as h_fin
    where v_hay_excepcion and not v_excepcion.cerrado
    union all
    select (elem ->> 0)::time, (elem ->> 1)::time
    from jsonb_array_elements(coalesce(v_sede.horario_base -> v_clave, '[]'::jsonb)) as elem
    where not v_hay_excepcion and v_sede.horario_base <> '{}'::jsonb
    union all
    select '00:00'::time, '23:59:59'::time
    where not v_hay_excepcion and v_sede.horario_base = '{}'::jsonb
  ),
  staff_cand as (
    select v.id as vinculo_id, v.staff_id
    from public.vinculo_staff_negocio v
    where v.negocio_id = v_negocio.id
      and v.estado = 'ACTIVO'
      and (v.sede_activa_id = p_sede_id or v.sede_activa_id is null)
      and (p_staff_id is null or v.staff_id = p_staff_id)
      and not exists (
        select 1 from unnest(p_servicio_ids) as sid
        where not exists (
          select 1 from public.staff_servicio ss
          where ss.staff_id = v.staff_id and ss.servicio_id = sid
        )
      )
  ),
  ventanas as (
    select sc.vinculo_id, sc.staff_id,
           greatest(d.hora_inicio, sv.h_ini) as h_ini,
           least(d.hora_fin, sv.h_fin) as h_fin
    from staff_cand sc
    join public.disponibilidad d
      on d.vinculo_id = sc.vinculo_id and d.sede_id = p_sede_id and d.dia_semana = v_dia
    cross join sede_ventanas sv
    where greatest(d.hora_inicio, sv.h_ini) < least(d.hora_fin, sv.h_fin)
  ),
  slots as (
    select v.vinculo_id, v.staff_id, gs.inicio
    from ventanas v
    cross join lateral generate_series(
      timezone(v_tz, (p_fecha + v.h_ini)::timestamp) + make_interval(mins => v_buf_prev),
      timezone(v_tz, (p_fecha + v.h_fin)::timestamp) - make_interval(mins => v_dur + v_buf_post),
      make_interval(mins => greatest(p_granularidad_minutos, 5))
    ) as gs(inicio)
  ),
  evaluados as (
    select s.vinculo_id, s.staff_id, s.inicio,
           tstzrange(
             s.inicio - make_interval(mins => v_buf_prev),
             s.inicio + make_interval(mins => v_dur + v_buf_post),
             '[)'
           ) as bloque
    from slots s
  ),
  con_estado as (
    select
      e.inicio, e.staff_id, e.vinculo_id,
      (
        select r.id from public.recurso r
        where v_tipo_recurso is not null
          and r.sede_id = p_sede_id
          and r.recurso_tipo_id = v_tipo_recurso
          and r.estado = 'DISPONIBLE'
          and not exists (
            select 1 from public.reserva rr
            where rr.recurso_id = r.id
              and rr.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO')
              and rr.rango && e.bloque
          )
        limit 1
      ) as recurso_id,
      (
        e.inicio >= v_min_inicio and e.inicio <= v_max_inicio
        and not exists (
          select 1 from public.reserva rr
          where rr.staff_id = e.staff_id
            and rr.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO')
            and rr.rango && e.bloque
        )
        and not exists (
          select 1 from public.bloqueo_ausencia ba
          where ba.vinculo_id = e.vinculo_id
            and tstzrange(ba.fecha_inicio, ba.fecha_fin, '[)') && e.bloque
        )
      ) as libre_staff
    from evaluados e
  ),
  nivel as (
    select nc.vinculo_id,
           max(case nc.nivel when 'MASTER' then 3 when 'EXPERT' then 2 else 1 end) as rango_nivel
    from public.nivel_staff_consolidado nc
    group by nc.vinculo_id
  ),
  carga as (
    select r.staff_id, count(*) as reservas_dia
    from public.reserva r
    where r.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO','COMPLETADA')
      and (r.hora_inicio at time zone v_tz)::date = p_fecha
    group by r.staff_id
  ),
  elegido as (
    select
      c.inicio, c.staff_id, c.recurso_id,
      (c.libre_staff and (v_tipo_recurso is null or c.recurso_id is not null)) as ok,
      row_number() over (
        partition by c.inicio
        order by
          (c.libre_staff and (v_tipo_recurso is null or c.recurso_id is not null)) desc,
          coalesce(n.rango_nivel, 0) desc,
          coalesce(cg.reservas_dia, 0) asc,
          random()
      ) as rn
    from con_estado c
    left join nivel n on n.vinculo_id = c.vinculo_id
    left join carga cg on cg.staff_id = c.staff_id
  )
  select el.inicio, el.inicio + make_interval(mins => v_dur), el.staff_id, el.recurso_id, el.ok
  from elegido el
  where el.rn = 1
  order by el.inicio;
end;
$fn$;

grant execute on function public.slots_disponibles(uuid, uuid[], date, uuid, int) to anon, authenticated;
