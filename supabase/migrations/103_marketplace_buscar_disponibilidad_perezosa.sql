-- Rendimiento de Explorar/Mapa: marketplace_buscar calculaba la disponibilidad de los 7 dias de cada negocio
-- (7 llamadas a slots_disponibles por negocio) aunque el primer dia ya tuviera huecos. Ahora recorre los dias
-- en orden y se detiene en el primero con hora libre. Resultado identico (los dias son crecientes, asi que el
-- minimo global es el minimo del primer dia con disponibilidad). Misma firma, mismo SECURITY DEFINER.
do $$
declare
  v_def text;
  v_nuevo text;
  v_viejo text := $viejo$      select min(sd.hora_inicio) as inicio
      from generate_series(0, 6) as dia_offset
      cross join lateral public.slots_disponibles(
        cs.sede_id,
        array[(select sv.id from public.servicio sv where sv.negocio_id = cs.id and sv.estado = 'ACTIVO' order by sv.precio_base limit 1)],
        (now() at time zone coalesce(cs.zona_horaria, 'America/Bogota'))::date + dia_offset,
        null, 30
      ) sd
      where sd.disponible$viejo$;
  v_reemplazo text := $nuevo$      select dia.minimo as inicio
      from generate_series(0, 6) as dia_offset
      cross join lateral (
        select min(sd.hora_inicio) as minimo
        from public.slots_disponibles(
          cs.sede_id,
          array[(select sv.id from public.servicio sv where sv.negocio_id = cs.id and sv.estado = 'ACTIVO' order by sv.precio_base limit 1)],
          (now() at time zone coalesce(cs.zona_horaria, 'America/Bogota'))::date + dia_offset,
          null, 30
        ) sd
        where sd.disponible
      ) dia
      where dia.minimo is not null
      limit 1$nuevo$;
begin
  v_def := pg_get_functiondef('public.marketplace_buscar(text,text,text,text,integer,integer,double precision,double precision)'::regprocedure);
  v_nuevo := replace(v_def, v_viejo, v_reemplazo);
  if v_nuevo = v_def then
    raise exception 'No se encontro el bloque de disponibilidad en marketplace_buscar';
  end if;
  execute v_nuevo;
end $$;
