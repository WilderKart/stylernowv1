-- StylerNow — Migración 030: Fase 4 — App Staff
-- Fuente: 02-UX/08_Staff_App.md, 03-Business-Rules/05_Staff_Rewards.md,
-- 03-Business-Rules/09_No_Show_Policy.md.
--
-- Hallazgo real, encontrado leyendo el schema antes de escribir código (no
-- a través de una prueba): el sistema completo de Nivel PRO/EXPERT/MASTER
-- tiene tabla, enum, RLS y hasta una insignia en el Panel Negocio desde la
-- Fase 1/Módulo 2.4 — pero jamás se insertó una sola fila en
-- `puntaje_staff_evento` ni en `temporada`. El sistema de puntaje está
-- construido pero completamente inerte. Este módulo lo enciende para las
-- categorías que se conectan de forma natural con lo que Fase 4 ya
-- construye (Puntualidad vía check-in, Producción vía finalización de
-- Reserva) — Calidad vía reseña 5 estrellas también se conecta acá por ser
-- igual de directa. "Cliente recurrente" y "Referido" (Calidad) y los
-- bonos agregados de "día/semana 100% puntual" quedan diferidos: requieren
-- lógica de detección o un job programado (rollover de temporada) que no
-- existen todavía — se documentan en TECH_DEBT_REGISTER.md, no se inventan
-- acá.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Temporada — enciende el sistema: sin ninguna fila, Nivel no puede
--    funcionar. El rollover automático (cerrar/consolidar y abrir la
--    siguiente) es una Decisión de infraestructura (pg_cron o Edge
--    Function programada) fuera del alcance de esta migración.
-- ════════════════════════════════════════════════════════════════════════
insert into public.temporada (fecha_inicio, fecha_fin, estado)
select date_trunc('quarter', now()), date_trunc('quarter', now()) + interval '3 months' - interval '1 second', 'EN_CURSO'
where not exists (select 1 from public.temporada where estado = 'EN_CURSO');

create or replace function public.temporada_actual_id()
returns uuid
language sql stable security definer set search_path = public as $fn$
  select id from public.temporada where estado = 'EN_CURSO' order by fecha_inicio desc limit 1;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Check-in / Check-out — la Agenda nunca tuvo esto: `checkin_at`/
--    `checkout_at` existen en `reserva` desde la migración 003 y
--    `EN_CURSO` existe en el enum desde la 001, pero ninguna RPC los usaba.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.iniciar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
  v_vinculo_id uuid;
  v_minutos_tarde numeric;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if v_reserva.staff_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_INICIABLE'; end if;

  update public.reserva set estado = 'EN_CURSO', checkin_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  -- Puntualidad (03-Business-Rules/05_Staff_Rewards.md): llegada tarde >5min,
  -- -10 puntos. El bono "día/semana 100% puntual" es un agregado que
  -- requiere un cierre periódico — no se calcula acá (ver TECH_DEBT_REGISTER).
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = v_reserva.staff_id and negocio_id = v_reserva.negocio_id and estado <> 'RETIRADO'
    limit 1;
  v_minutos_tarde := extract(epoch from (now() - v_reserva.hora_inicio)) / 60;
  if v_vinculo_id is not null and public.temporada_actual_id() is not null and v_minutos_tarde > 5 then
    insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
    values (v_vinculo_id, public.temporada_actual_id(), 'LLEGADA_TARDE', -10, 'reserva', p_reserva_id, 'SISTEMA',
      format('Check-in %s minutos tarde', round(v_minutos_tarde)));
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKIN_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$fn$;
grant execute on function public.iniciar_atencion_reserva(uuid) to authenticated;

create or replace function public.finalizar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if v_reserva.staff_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'EN_CURSO' then raise exception 'RESERVA_NO_FINALIZABLE'; end if;

  -- No cambia `estado`: la finalización real (COMPLETADA) sigue pasando por
  -- completar_venta_pos() en Caja (2.8) — check-out solo marca que el
  -- servicio en sí ya terminó, antes del cobro.
  update public.reserva set checkout_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKOUT_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$fn$;
grant execute on function public.finalizar_atencion_reserva(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Producción — otorga puntos al completar una Reserva en Caja. Extiende
--    completar_venta_pos() (021 → 022 → esta) en vez de duplicar su lógica
--    de finalización en una función paralela.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.completar_venta_pos(
  p_reserva_id uuid,
  p_productos jsonb default '[]'::jsonb,
  p_metodo_pago_saldo text default 'EFECTIVO',
  p_propina numeric default 0,
  p_metodo_pago_propina text default 'EFECTIVO',
  p_puntos_a_canjear int default 0
)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_autorizado boolean;
  v_item jsonb;
  v_producto public.producto;
  v_total_productos numeric := 0;
  v_saldo_servicio numeric;
  v_descuento_puntos numeric := 0;
  v_puntos_restantes int := coalesce(p_puntos_a_canjear, 0);
  v_lote record;
  v_consumir int;
  v_saldo_final numeric;
  v_puntos_otorgados int;
  v_consumo record;
  v_vinculo_id uuid;
  v_servicio_pts record;
  v_puntos_categoria int;
begin
  if p_metodo_pago_saldo not in ('EFECTIVO', 'DATAFONO_PROPIO') then
    raise exception 'METODO_PAGO_INVALIDO';
  end if;
  if p_puntos_a_canjear < 0 or p_propina < 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  v_autorizado := public.is_barberia_de(v_reserva.negocio_id)
    or public.is_guardian_de_sede(v_reserva.sede_id)
    or v_reserva.staff_id = auth.uid();
  if not v_autorizado then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_reserva.estado not in ('CONFIRMADA', 'EN_CURSO') then
    raise exception 'RESERVA_NO_COMPLETABLE';
  end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;

  for v_item in select * from jsonb_array_elements(p_productos)
  loop
    select * into v_producto from public.producto
      where id = (v_item ->> 'producto_id')::uuid and negocio_id = v_reserva.negocio_id and estado = 'ACTIVO';
    if not found then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;
    insert into public.venta_producto (negocio_id, reserva_id, producto_id, cantidad, precio_unitario)
    values (v_reserva.negocio_id, p_reserva_id, v_producto.id, (v_item ->> 'cantidad')::int, v_producto.precio);
    v_total_productos := v_total_productos + v_producto.precio * (v_item ->> 'cantidad')::int;

    insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
    values (v_reserva.negocio_id, v_producto.id, v_reserva.sede_id, 0, 0)
    on conflict (producto_id, sede_id) do nothing;
    update public.producto_stock
    set stock_actual = stock_actual - (v_item ->> 'cantidad')::int
    where producto_id = v_producto.id and sede_id = v_reserva.sede_id;
    insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, referencia_reserva_id, actor_id)
    values (v_reserva.negocio_id, v_reserva.sede_id, v_producto.id, 'SALIDA', (v_item ->> 'cantidad')::int, 'Venta en POS', p_reserva_id, auth.uid());
  end loop;

  for v_consumo in
    select spc.producto_id, spc.cantidad
    from public.reserva_servicio rs
    join public.servicio_producto_consumo spc on spc.servicio_id = rs.servicio_id
    where rs.reserva_id = p_reserva_id
  loop
    insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
    values (v_reserva.negocio_id, v_consumo.producto_id, v_reserva.sede_id, 0, 0)
    on conflict (producto_id, sede_id) do nothing;
    update public.producto_stock
    set stock_actual = stock_actual - v_consumo.cantidad
    where producto_id = v_consumo.producto_id and sede_id = v_reserva.sede_id;
    insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, referencia_reserva_id, actor_id)
    values (v_reserva.negocio_id, v_reserva.sede_id, v_consumo.producto_id, 'CONSUMO_SERVICIO', v_consumo.cantidad, 'Consumo automático de Servicio', p_reserva_id, auth.uid());
  end loop;

  v_saldo_servicio := greatest(v_reserva.monto_total - v_reserva.monto_sena, 0) + v_total_productos;

  if p_puntos_a_canjear > 0 then
    for v_lote in
      select * from public.punto_fidelizacion
      where cliente_id = v_reserva.cliente_id and negocio_id = v_reserva.negocio_id
        and cantidad_disponible > 0 and fecha_expiracion > now()
      order by fecha_otorgamiento asc
      for update
    loop
      exit when v_puntos_restantes <= 0;
      v_consumir := least(v_puntos_restantes, v_lote.cantidad_disponible);
      update public.punto_fidelizacion set cantidad_disponible = cantidad_disponible - v_consumir where id = v_lote.id;
      v_puntos_restantes := v_puntos_restantes - v_consumir;
    end loop;
    v_descuento_puntos := least(
      (p_puntos_a_canjear - v_puntos_restantes)::numeric / 100 * v_negocio.puntos_valor_100_cop,
      v_saldo_servicio
    );
  end if;

  v_saldo_final := greatest(v_saldo_servicio - v_descuento_puntos, 0);

  if v_saldo_final > 0 then
    insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, pasarela)
    values (p_reserva_id, v_reserva.negocio_id, 'SALDO', v_saldo_final, 'APROBADO', p_metodo_pago_saldo);
  end if;

  if p_propina > 0 then
    insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, pasarela, staff_destino_id)
    values (p_reserva_id, v_reserva.negocio_id, 'PROPINA', p_propina, 'APROBADO', p_metodo_pago_propina, v_reserva.staff_id);
  end if;

  update public.reserva set estado = 'COMPLETADA', updated_at = now() where id = p_reserva_id;

  v_puntos_otorgados := floor(v_reserva.monto_total / 10000) * 10;
  if v_puntos_otorgados > 0 then
    insert into public.punto_fidelizacion (cliente_id, negocio_id, cantidad, cantidad_disponible, fecha_expiracion, origen)
    values (
      v_reserva.cliente_id, v_reserva.negocio_id, v_puntos_otorgados, v_puntos_otorgados,
      now() + make_interval(months => v_negocio.puntos_expiracion_meses),
      'RESERVA_COMPLETADA:' || p_reserva_id
    );
  end if;

  -- Producción (03-Business-Rules/05_Staff_Rewards.md): ESTANDAR +10,
  -- PREMIUM +25, COMPLEMENTARIO +8 por cada Servicio de la Reserva. El bono
  -- "combo completo +18" no se calcula acá (requiere detectar si el
  -- conjunto exacto de Servicios coincide con un combo — ver
  -- TECH_DEBT_REGISTER, mismo motivo ya documentado para 2.5/2.9).
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = v_reserva.staff_id and negocio_id = v_reserva.negocio_id and estado <> 'RETIRADO'
    limit 1;
  if v_vinculo_id is not null and public.temporada_actual_id() is not null then
    for v_servicio_pts in
      select sv.id as servicio_id, sv.nombre, sv.categoria_puntaje
      from public.reserva_servicio rs
      join public.servicio sv on sv.id = rs.servicio_id
      where rs.reserva_id = p_reserva_id
    loop
      v_puntos_categoria := case v_servicio_pts.categoria_puntaje
        when 'PREMIUM' then 25
        when 'COMPLEMENTARIO' then 8
        else 10
      end;
      insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
      values (v_vinculo_id, public.temporada_actual_id(), 'SERVICIO_' || v_servicio_pts.categoria_puntaje::text, v_puntos_categoria,
        'reserva_servicio', v_reserva.id, 'SISTEMA', v_servicio_pts.nombre);
    end loop;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values (
    'reserva', p_reserva_id, 'VENTA_POS_COMPLETADA', 'BARBERIA', auth.uid(), v_reserva.negocio_id,
    jsonb_build_object(
      'saldo_cobrado', v_saldo_final, 'propina', p_propina,
      'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes, 'puntos_otorgados', v_puntos_otorgados
    )
  );

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'saldo_cobrado', v_saldo_final,
    'descuento_puntos', v_descuento_puntos,
    'propina', p_propina,
    'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes,
    'puntos_otorgados', v_puntos_otorgados
  );
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Calidad — reseña de 5 estrellas, +15 puntos al Staff atendido. Trigger
--    (no una RPC nueva) para que funcione sin importar desde dónde se cree
--    la reseña — la creación de `resena` ya es un INSERT directo del
--    Cliente (RLS, Módulo 1), nunca pasó por una RPC.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.otorgar_puntos_resena_calidad()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo_id uuid;
begin
  if new.calificacion = 5 and new.staff_id is not null and public.temporada_actual_id() is not null then
    select id into v_vinculo_id from public.vinculo_staff_negocio
      where staff_id = new.staff_id and negocio_id = new.negocio_id and estado <> 'RETIRADO'
      limit 1;
    if v_vinculo_id is not null then
      insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo)
      values (v_vinculo_id, public.temporada_actual_id(), 'RESENA_5_ESTRELLAS', 15, 'resena', new.id, 'SISTEMA');
    end if;
  end if;
  return new;
end;
$fn$;

create trigger trg_puntos_resena_calidad after insert on public.resena
for each row execute function public.otorgar_puntos_resena_calidad();

-- ════════════════════════════════════════════════════════════════════════
-- 5. Mi Nivel — lectura en vivo del propio puntaje, sin duplicar la fórmula
--    (se lee directo de puntaje_staff_evento/nivel_staff_consolidado).
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.staff_mi_nivel_actual()
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_vinculo_id uuid;
  v_temporada_id uuid;
  v_puntaje_total int;
  v_desglose jsonb;
  v_eventos jsonb;
  v_nivel_actual nivel_staff;
  v_historial jsonb;
begin
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = auth.uid() and estado <> 'RETIRADO'
    order by created_at desc limit 1;
  if v_vinculo_id is null then
    raise exception 'SIN_VINCULO_ACTIVO';
  end if;

  v_temporada_id := public.temporada_actual_id();

  select coalesce(sum(puntos_delta), 0) into v_puntaje_total
    from public.puntaje_staff_evento where vinculo_id = v_vinculo_id and temporada_id = v_temporada_id;

  v_nivel_actual := case
    when v_puntaje_total >= 3000 then 'MASTER'
    when v_puntaje_total >= 1000 then 'EXPERT'
    else 'PRO'
  end;

  select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb) into v_desglose
  from (
    select
      case
        when evento in ('SERVICIO_ESTANDAR', 'SERVICIO_PREMIUM', 'SERVICIO_COMPLEMENTARIO') then 'PRODUCCION'
        when evento in ('RESENA_5_ESTRELLAS', 'CLIENTE_RECURRENTE', 'REFERIDO') then 'CALIDAD'
        when evento in ('LLEGADA_TARDE', 'PUNTUALIDAD_DIA', 'PUNTUALIDAD_SEMANA', 'NO_SHOW_STAFF', 'QUEJA_VALIDA') then 'PUNTUALIDAD'
        else 'OTRO'
      end as categoria,
      sum(puntos_delta) as total
    from public.puntaje_staff_evento
    where vinculo_id = v_vinculo_id and temporada_id = v_temporada_id
    group by 1
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('evento', evento, 'puntosDelta', puntos_delta, 'motivo', motivo, 'createdAt', created_at) order by created_at desc), '[]'::jsonb)
    into v_eventos
  from (
    select * from public.puntaje_staff_evento
    where vinculo_id = v_vinculo_id and temporada_id = v_temporada_id
    order by created_at desc limit 20
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('temporadaId', temporada_id, 'puntajeFinal', puntaje_final, 'nivel', nivel) order by temporada_id desc), '[]'::jsonb)
    into v_historial
  from public.nivel_staff_consolidado where vinculo_id = v_vinculo_id;

  return jsonb_build_object(
    'nivelActual', v_nivel_actual,
    'puntajeTemporadaActual', v_puntaje_total,
    'desglosePorCategoria', v_desglose,
    'eventosRecientes', v_eventos,
    'historialTemporadas', v_historial
  );
end;
$fn$;
grant execute on function public.staff_mi_nivel_actual() to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Mis Ganancias — extiende reportes_ranking_staff() con un parámetro
--    opcional de auto-servicio en vez de duplicar la fórmula de comisión.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.reportes_ranking_staff(
  p_negocio_id uuid,
  p_sede_id uuid default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_vinculo_id uuid default null
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
  if p_vinculo_id is not null then
    v_autorizado := exists (
      select 1 from public.vinculo_staff_negocio v
      where v.id = p_vinculo_id and v.negocio_id = p_negocio_id and v.staff_id = auth.uid()
    );
  elsif p_sede_id is not null then
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
    and (p_vinculo_id is null or v.id = p_vinculo_id)
  group by v.id, s.nombre, s.foto_url, sd.nombre
  order by comision_generada desc, reservas_completadas desc
  limit 20;
end;
$fn$;
grant execute on function public.reportes_ranking_staff(uuid, uuid, timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.staff_mis_propinas(p_desde timestamptz default null, p_hasta timestamptz default null)
returns numeric
language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(monto), 0) from public.pago
  where staff_destino_id = auth.uid()
    and tipo = 'PROPINA'
    and estado = 'APROBADO'
    and created_at >= coalesce(p_desde, date_trunc('week', now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota')
    and created_at < coalesce(p_hasta, now());
$fn$;
grant execute on function public.staff_mis_propinas(timestamptz, timestamptz) to authenticated;
