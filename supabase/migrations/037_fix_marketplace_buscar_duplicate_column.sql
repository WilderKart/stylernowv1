-- StylerNow — Migración 037: corrige "column reference distancia_km is
-- ambiguous" en marketplace_buscar()
--
-- Bug real, distinto de los dos anteriores: la CTE `puntuado` seleccionaba
-- `cd.*` (que ya trae `distancia_km` heredado de `con_sede`) Y además
-- `cd.distancia_km` explícito en la misma lista — dos columnas con el
-- mismo nombre en la misma CTE. `normalizado` referenciaba `p.distancia_km`
-- sin poder saber cuál de las dos. Se corrige quitando la selección
-- redundante (ya viene incluida en `cd.*`).

create or replace function public.marketplace_buscar(
  p_texto text default null,
  p_ciudad text default null,
  p_categoria text default null,
  p_orden text default 'RELEVANCIA',
  p_limite int default 20,
  p_offset int default 0,
  p_lat double precision default null,
  p_lng double precision default null
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
  proxima_disponibilidad timestamptz,
  patrocinado boolean
)
language plpgsql stable set search_path = public as $fn$
declare
  v_radio_km numeric := 10;
  v_conteo int := 0;
  v_promedio_plataforma numeric;
  v_confianza numeric := 5;
begin
  select coalesce(avg(resena.calificacion), 4) into v_promedio_plataforma
  from public.resena where resena.estado = 'VISIBLE';

  if p_lat is not null and p_lng is not null then
    loop
      select count(*) into v_conteo
      from public.negocio n
      join public.sede sd on sd.negocio_id = n.id and not sd.cerrada_permanente
      where n.estado = 'ACTIVO'
        and n.elegibilidad_marketplace
        and coalesce((select ch.habilitada from public.ciudad_habilitada ch where ch.ciudad = n.ciudad), true)
        and (p_categoria is null or p_categoria = any(n.categoria))
        and (p_texto is null or p_texto = '' or n.nombre ilike '%' || p_texto || '%' or coalesce(n.descripcion, '') ilike '%' || p_texto || '%')
        and 6371 * acos(greatest(-1, least(1,
              cos(radians(p_lat)) * cos(radians(sd.latitud)) * cos(radians(sd.longitud) - radians(p_lng))
              + sin(radians(p_lat)) * sin(radians(sd.latitud))
            ))) <= v_radio_km;
      exit when v_conteo >= 3 or v_radio_km >= 50;
      v_radio_km := v_radio_km + 5;
    end loop;
  end if;

  return query
  with base as (
    select
      n.id, n.nombre, n.slug, n.ciudad, n.categoria, n.descripcion, n.logo_url, n.created_at,
      (select round(avg(re.calificacion)::numeric, 2) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as calificacion,
      (select count(*) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as total_resenas,
      (select count(*) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE' and re.created_at >= now() - interval '12 months') as votos_12m,
      (select coalesce(avg(re.calificacion), 0) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE' and re.created_at >= now() - interval '12 months') as promedio_12m,
      (select min(sv.precio_base) from public.servicio sv
        where sv.negocio_id = n.id and sv.estado = 'ACTIVO') as precio_desde,
      (select count(*) from public.negocio_visita_perfil v where v.negocio_id = n.id and v.created_at >= now() - interval '90 days') as visitas_90d,
      (select count(*) from public.reserva r where r.negocio_id = n.id and r.estado = 'COMPLETADA' and r.hora_inicio >= now() - interval '90 days') as completadas_90d,
      exists (
        select 1 from public.campana_publicitaria c
        where c.negocio_id = n.id and c.estado = 'ACTIVA'
          and (c.presupuesto_total is null or c.gasto_total < c.presupuesto_total)
          and (c.fecha_inicio is null or c.fecha_inicio <= now())
          and (c.fecha_fin is null or c.fecha_fin >= now())
      ) as patrocinado
    from public.negocio n
    where n.estado = 'ACTIVO'
      and n.elegibilidad_marketplace
      and coalesce((select ch.habilitada from public.ciudad_habilitada ch where ch.ciudad = n.ciudad), true)
      and (p_ciudad is null or p_lat is not null or n.ciudad ilike p_ciudad)
      and (p_categoria is null or p_categoria = any(n.categoria))
      and (
        p_texto is null or p_texto = ''
        or n.nombre ilike '%' || p_texto || '%'
        or coalesce(n.descripcion, '') ilike '%' || p_texto || '%'
      )
  ),
  con_sede as (
    select
      b.*,
      sede.id as sede_id, sede.zona_horaria,
      sede.distancia_km,
      coalesce(sede.staff_total, 0) as staff_total,
      coalesce(sede.staff_experto, 0) as staff_experto
    from base b
    left join lateral (
      select
        s.id, s.zona_horaria,
        case when p_lat is not null and p_lng is not null then
          6371 * acos(greatest(-1, least(1,
            cos(radians(p_lat)) * cos(radians(s.latitud)) * cos(radians(s.longitud) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(s.latitud))
          )))
        else null end as distancia_km,
        (select count(*) from public.vinculo_staff_negocio v where v.sede_activa_id = s.id and v.estado = 'ACTIVO') as staff_total,
        (select count(*) from public.vinculo_staff_negocio v
          join public.nivel_staff_consolidado nc on nc.vinculo_id = v.id
          where v.sede_activa_id = s.id and v.estado = 'ACTIVO' and nc.nivel in ('EXPERT', 'MASTER')
          and nc.temporada_id = (select temporada.id from public.temporada order by temporada.fecha_inicio desc limit 1)
        ) as staff_experto
      from public.sede s
      where s.negocio_id = b.id and not s.cerrada_permanente and not s.cerrada_temporalmente
      order by
        case when p_lat is not null and p_lng is not null then
          6371 * acos(greatest(-1, least(1,
            cos(radians(p_lat)) * cos(radians(s.latitud)) * cos(radians(s.longitud) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(s.latitud))
          )))
        else null end asc nulls last,
        s.es_principal desc, s.created_at
      limit 1
    ) sede on true
    where p_lat is null or p_lng is null or sede.distancia_km is null or sede.distancia_km <= v_radio_km
  ),
  con_disponibilidad as (
    select
      cs.*,
      prox.inicio as proxima_disponibilidad
    from con_sede cs
    left join lateral (
      select min(sd.hora_inicio) as inicio
      from generate_series(0, 6) as dia_offset
      cross join lateral public.slots_disponibles(
        cs.sede_id,
        array[(select sv.id from public.servicio sv where sv.negocio_id = cs.id and sv.estado = 'ACTIVO' order by sv.precio_base limit 1)],
        (now() at time zone coalesce(cs.zona_horaria, 'America/Bogota'))::date + dia_offset,
        null, 30
      ) sd
      where sd.disponible
    ) prox on true
  ),
  puntuado as (
    select
      cd.*,
      (((cd.votos_12m::numeric / (cd.votos_12m + v_confianza)) * cd.promedio_12m
        + (v_confianza / (cd.votos_12m + v_confianza)) * v_promedio_plataforma) - 1) / 4 as rating_normalizado,
      case
        when cd.proxima_disponibilidad is null then 0
        else greatest(0, least(1, 1 - (extract(epoch from (cd.proxima_disponibilidad - now())) / 3600 - 48) / (168 - 48)))
      end as disponibilidad_normalizada,
      case when cd.visitas_90d > 0 then cd.completadas_90d::numeric / cd.visitas_90d else 0 end as conversion_cruda,
      case when cd.staff_total > 0 then cd.staff_experto::numeric / cd.staff_total else 0 end as calidad_de_staff,
      case when cd.patrocinado then 1 else 0 end as patrocinio_normalizado
    from con_disponibilidad cd
  ),
  normalizado as (
    select
      p.*,
      case
        when p.distancia_km is null then 1
        when max(p.distancia_km) over () = min(p.distancia_km) over () then 1
        else 1 - (p.distancia_km - min(p.distancia_km) over ()) / (max(p.distancia_km) over () - min(p.distancia_km) over ())
      end as proximidad_normalizada,
      case
        when max(p.conversion_cruda) over () = min(p.conversion_cruda) over () then p.conversion_cruda
        else (p.conversion_cruda - min(p.conversion_cruda) over ()) / (max(p.conversion_cruda) over () - min(p.conversion_cruda) over ())
      end as conversion_normalizada
    from puntuado p
  ),
  final as (
    select
      nz.*,
      0.25 * nz.rating_normalizado
      + 0.20 * nz.proximidad_normalizada
      + 0.20 * nz.disponibilidad_normalizada
      + 0.15 * nz.conversion_normalizada
      + 0.10 * nz.calidad_de_staff
      + 0.10 * nz.patrocinio_normalizado as score
    from normalizado nz
  )
  select
    f.id, f.nombre, f.slug, f.ciudad, f.categoria, f.descripcion, f.logo_url,
    coalesce(f.calificacion, 0), f.total_resenas, f.precio_desde,
    f.sede_id, f.proxima_disponibilidad, f.patrocinado
  from final f
  order by
    case when p_orden = 'CALIFICACION' then f.calificacion end desc nulls last,
    case when p_orden = 'PRECIO' then f.precio_desde end asc nulls last,
    case when p_orden = 'RECIENTE' then f.created_at end desc,
    round(f.score, 3) desc,
    f.rating_normalizado desc,
    f.created_at asc,
    md5(f.id::text || coalesce(p_texto, '') || coalesce(p_ciudad, '') || coalesce(p_categoria, '')) asc
  limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;
