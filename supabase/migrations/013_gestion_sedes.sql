-- StylerNow — Migración 013: Módulo 2.3 — Gestión de Sedes (dominio completo)
-- Fuente: 02-UX/09_Business_Panel.md, 03-Business-Rules/01_Roles.md (matriz
-- de permisos: crear/eliminar Sede y trasladar Staff son EXCLUSIVOS de
-- Barbería, nunca de Guardian), 01-PRD/03_Monetization.md (límite de Sedes
-- por Plan).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Sede principal (arquitectura multi-sede desde el día uno)
-- ════════════════════════════════════════════════════════════════════════

alter table public.sede add column if not exists es_principal boolean not null default false;

-- Máximo una sede principal por negocio (índice parcial: no molesta a las
-- que no son principales, ni siquiera exige unicidad entre negocios).
create unique index if not exists sede_principal_unica_por_negocio
  on public.sede(negocio_id) where es_principal;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Horario — excepciones, festivos, cierres temporales, horario especial
-- ════════════════════════════════════════════════════════════════════════
-- `sede.horario_base` (ya existía) sigue siendo el horario semanal general.
-- Esta tabla cubre lo que NO es recurrente: un festivo puntual, un cierre
-- por remodelación, un horario especial de fin de año, etc. Sin esto,
-- slots_disponibles() nunca podría reflejar "cerrado el 25 de diciembre"
-- sin tocar el horario semanal completo.

create table public.sede_horario_excepcion (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sede(id) on delete cascade,
  fecha date not null,
  cerrado boolean not null default true,
  hora_inicio_especial time, -- solo si cerrado = false (horario especial ese día)
  hora_fin_especial time,
  motivo text,
  created_at timestamptz not null default now(),
  unique (sede_id, fecha),
  check (cerrado or (hora_inicio_especial is not null and hora_fin_especial is not null)),
  check (cerrado or hora_fin_especial > hora_inicio_especial)
);
create index sede_horario_excepcion_fecha_idx on public.sede_horario_excepcion(sede_id, fecha);

alter table public.sede_horario_excepcion enable row level security;

create policy sede_horario_excepcion_select_publico on public.sede_horario_excepcion for select
  using (exists (
    select 1 from public.sede s join public.negocio n on n.id = s.negocio_id
    where s.id = sede_id and n.estado = 'ACTIVO'
  ));
create policy sede_horario_excepcion_select_interno on public.sede_horario_excepcion for select
  using (exists (
    select 1 from public.sede s where s.id = sede_id
      and (public.tiene_acceso_interno(s.negocio_id) or public.is_supersu())
  ));
create policy sede_horario_excepcion_write_barberia_guardian on public.sede_horario_excepcion for all
  using (exists (
    select 1 from public.sede s where s.id = sede_id
      and (public.is_barberia_de(s.negocio_id) or public.is_guardian_de_sede(s.id))
  ))
  with check (exists (
    select 1 from public.sede s where s.id = sede_id
      and (public.is_barberia_de(s.negocio_id) or public.is_guardian_de_sede(s.id))
  ));

-- ════════════════════════════════════════════════════════════════════════
-- 3. slots_disponibles() debe respetar las excepciones — si no, la Fase 2.3
-- quedaría con "arquitectura pendiente" (el propio pedido lo prohíbe
-- explícitamente).
-- ════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════
-- 4. Crear Sede — enforza el límite de Sedes del Plan (01-PRD/03_
-- Monetization.md: límite duro, 403 PLAN_LIMIT_EXCEEDED)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_sede(
  p_negocio_id uuid,
  p_nombre text,
  p_direccion text,
  p_ciudad text,
  p_horario_base jsonb,
  p_latitud double precision default null,
  p_longitud double precision default null
)
returns public.sede
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.plan;
  v_negocio public.negocio;
  v_conteo int;
  v_es_primera boolean;
  v_sede public.sede;
begin
  select * into v_negocio from public.negocio where id = p_negocio_id;
  if not found or not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select count(*) into v_conteo from public.sede
  where negocio_id = p_negocio_id and not cerrada_permanente;
  v_es_primera := v_conteo = 0;

  select p.* into v_plan from public.plan p where p.codigo = v_negocio.plan_codigo;
  if v_plan.limite_sedes is not null and v_conteo >= v_plan.limite_sedes then
    raise exception 'PLAN_LIMIT_EXCEEDED';
  end if;

  insert into public.sede (negocio_id, nombre, direccion, ciudad, horario_base, latitud, longitud, es_principal)
  values (p_negocio_id, p_nombre, p_direccion, p_ciudad, p_horario_base, p_latitud, p_longitud, v_es_primera)
  returning * into v_sede;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('sede', v_sede.id, 'SEDE_CREADA', 'BARBERIA', auth.uid(), p_negocio_id,
          jsonb_build_object('nombre', p_nombre, 'es_principal', v_es_primera));

  return v_sede;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Cerrar / reabrir Sede — con las validaciones que evitan dejar citas
--    huérfanas o un negocio sin ninguna sede operativa.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.cerrar_sede(p_sede_id uuid, p_permanente boolean, p_motivo text default null)
returns public.sede
language plpgsql security definer set search_path = public as $fn$
declare
  v_sede public.sede;
  v_otras_operativas int;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found or not public.is_barberia_de(v_sede.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  -- Nunca cerrar/eliminar la única Sede operativa del Negocio: dejaría al
  -- Negocio sin dónde recibir Reservas nuevas.
  select count(*) into v_otras_operativas
  from public.sede
  where negocio_id = v_sede.negocio_id
    and id <> p_sede_id
    and not cerrada_permanente
    and not cerrada_temporalmente;
  if v_otras_operativas = 0 then
    raise exception 'ULTIMA_SEDE_OPERATIVA';
  end if;

  if exists (
    select 1 from public.reserva r
    where r.sede_id = p_sede_id
      and r.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO')
      and r.hora_inicio > now()
  ) then
    raise exception 'SEDE_CON_RESERVAS_ACTIVAS';
  end if;

  update public.sede
  set cerrada_temporalmente = not p_permanente,
      cerrada_permanente = p_permanente,
      es_principal = case when p_permanente then false else es_principal end
  where id = p_sede_id
  returning * into v_sede;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('sede', p_sede_id, case when p_permanente then 'SEDE_ELIMINADA' else 'SEDE_CERRADA_TEMPORAL' end,
          'BARBERIA', auth.uid(), v_sede.negocio_id, p_motivo);

  return v_sede;
end;
$fn$;

create or replace function public.reabrir_sede(p_sede_id uuid)
returns public.sede
language plpgsql security definer set search_path = public as $fn$
declare
  v_sede public.sede;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found or not public.is_barberia_de(v_sede.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.sede
  set cerrada_temporalmente = false, cerrada_permanente = false
  where id = p_sede_id
  returning * into v_sede;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('sede', p_sede_id, 'SEDE_REABIERTA', 'BARBERIA', auth.uid(), v_sede.negocio_id);

  return v_sede;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Sede principal
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.establecer_sede_principal(p_sede_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_sede public.sede;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found or not public.is_barberia_de(v_sede.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_sede.cerrada_permanente or v_sede.cerrada_temporalmente then
    raise exception 'SEDE_NO_OPERATIVA';
  end if;

  update public.sede set es_principal = false where negocio_id = v_sede.negocio_id and es_principal;
  update public.sede set es_principal = true where id = p_sede_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('sede', p_sede_id, 'SEDE_MARCADA_PRINCIPAL', 'BARBERIA', auth.uid(), v_sede.negocio_id);
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Traslado de Staff entre Sedes (03-Business-Rules/01_Roles.md: acción
--    exclusiva de Barbería). El nivel PRO/EXPERT/MASTER y el historial de
--    puntaje están indexados por `vinculo_id`, que NO cambia en un traslado
--    — se conservan automáticamente sin tocar una sola fila de esas tablas.
--    El alcance de Guardian se recalcula solo, porque is_guardian_de_sede()
--    ya evalúa sede_activa_id en vivo: mover la sede_activa ES lo que hace
--    que pierda el alcance viejo y gane el nuevo, sin ningún paso extra.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.trasladar_staff(p_vinculo_id uuid, p_nueva_sede_id uuid)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
  v_sede_nueva public.sede;
  v_sede_anterior_id uuid;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_sede_nueva from public.sede where id = p_nueva_sede_id;
  if not found or v_sede_nueva.negocio_id <> v_vinculo.negocio_id then
    raise exception 'SEDE_NO_PERTENECE_AL_NEGOCIO';
  end if;
  if v_sede_nueva.cerrada_permanente or v_sede_nueva.cerrada_temporalmente then
    raise exception 'SEDE_DESTINO_NO_OPERATIVA';
  end if;

  v_sede_anterior_id := v_vinculo.sede_activa_id;

  update public.vinculo_staff_negocio
  set sede_activa_id = p_nueva_sede_id
  where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values (
    'vinculo_staff_negocio', p_vinculo_id, 'STAFF_TRASLADADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id,
    jsonb_build_object('sede_id', v_sede_anterior_id),
    jsonb_build_object('sede_id', p_nueva_sede_id)
  );

  return v_vinculo;
end;
$fn$;

grant execute on function public.crear_sede(uuid, text, text, text, jsonb, double precision, double precision) to authenticated;
grant execute on function public.cerrar_sede(uuid, boolean, text) to authenticated;
grant execute on function public.reabrir_sede(uuid) to authenticated;
grant execute on function public.establecer_sede_principal(uuid) to authenticated;
grant execute on function public.trasladar_staff(uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 8. Marketplace: la tarjeta de un Negocio debe mostrar su Sede PRINCIPAL,
--    no "la primera que se creó" (antes: order by created_at limit 1).
-- ════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════
-- 9. Staff visible por Sede (soporte para el detalle de Sede en el Panel):
--    lista quién tiene esa sede como sede_activa, con su Nivel.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.staff_de_sede(p_sede_id uuid)
returns table (
  vinculo_id uuid,
  staff_id uuid,
  nombre text,
  foto_url text,
  especialidad text,
  es_guardian boolean,
  nivel nivel_staff
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not exists (
    select 1 from public.sede s where s.id = p_sede_id and public.tiene_acceso_interno(s.negocio_id)
  ) and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    v.id, s.usuario_id, s.nombre, s.foto_url, s.especialidad, v.es_guardian,
    (
      select nc.nivel from public.nivel_staff_consolidado nc
      join public.temporada t on t.id = nc.temporada_id
      where nc.vinculo_id = v.id
      order by t.fecha_fin desc
      limit 1
    )
  from public.vinculo_staff_negocio v
  join public.staff s on s.usuario_id = v.staff_id
  where v.sede_activa_id = p_sede_id and v.estado = 'ACTIVO'
  order by s.nombre;
end;
$fn$;

grant execute on function public.staff_de_sede(uuid) to authenticated;
