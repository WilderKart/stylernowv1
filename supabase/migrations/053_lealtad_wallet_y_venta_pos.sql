-- StylerNow — Migración 053: Dominio LEALTAD (ADR-011) — StylerWallet
-- (helpers internos) y la 4ª extensión de completar_venta_pos() para
-- otorgar Sellos, Cashback y completar Referidos (Cliente y Staff)
-- automáticamente al completar una venta, exactamente en el mismo punto
-- donde ya se otorgan Puntos de fidelización y puntaje de Staff.
--
-- Se corrige antes de usarlo un defecto de diseño del índice de la
-- migración 051: `sello_evento_reserva_unica` era único por `reserva_id`
-- solo, lo que impediría que una misma Reserva otorgue sello en DOS
-- campañas activas simultáneas del mismo Negocio — la unicidad real que
-- pide la Biblia ("un sello por transacción elegible") es por campaña,
-- no globalmente por Reserva.

drop index if exists public.sello_evento_reserva_unica;
create unique index sello_evento_campana_reserva_unica on public.sello_evento(reserva_id, sello_cliente_id)
  where tipo = 'OTORGADO' and reserva_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- StylerWallet — helpers internos (nunca invocables directo, ver ADL-022)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._lealtad_wallet_id(p_cliente_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  select id into v_id from public.lealtad_wallet where cliente_id = p_cliente_id for update;
  if v_id is null then
    insert into public.lealtad_wallet (cliente_id) values (p_cliente_id)
    on conflict (cliente_id) do update set cliente_id = excluded.cliente_id
    returning id into v_id;
  end if;
  return v_id;
end;
$fn$;

create or replace function public._lealtad_acreditar(
  p_cliente_id uuid, p_tipo lealtad_origen, p_monto numeric, p_negocio_id uuid, p_sede_id uuid,
  p_referencia_tipo text, p_referencia_id uuid, p_motivo text
)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_wallet_id uuid;
begin
  v_wallet_id := public._lealtad_wallet_id(p_cliente_id);
  update public.lealtad_wallet set saldo_disponible = saldo_disponible + p_monto, updated_at = now() where id = v_wallet_id;
  insert into public.lealtad_movimiento (wallet_id, tipo, monto, negocio_id, sede_id, referencia_tipo, referencia_id, motivo)
  values (v_wallet_id, p_tipo, p_monto, p_negocio_id, p_sede_id, p_referencia_tipo, p_referencia_id, p_motivo);
end;
$fn$;

revoke all on function public._lealtad_wallet_id(uuid) from public, anon, authenticated;
revoke all on function public._lealtad_acreditar(uuid, lealtad_origen, numeric, uuid, uuid, text, uuid, text) from public, anon, authenticated;

-- Cliente-facing: canjear saldo de StylerWallet (ej. contra el saldo de una
-- Reserva en Caja) — débito auditado, nunca deja el saldo negativo.
create or replace function public.canjear_lealtad_wallet(p_monto numeric, p_referencia_tipo text default null, p_referencia_id uuid default null)
returns numeric
language plpgsql security definer set search_path = public as $fn$
declare
  v_wallet_id uuid;
  v_saldo numeric;
begin
  if p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  select id, saldo_disponible into v_wallet_id, v_saldo from public.lealtad_wallet where cliente_id = auth.uid() for update;
  if v_wallet_id is null or v_saldo < p_monto then raise exception 'SALDO_INSUFICIENTE'; end if;

  update public.lealtad_wallet set saldo_disponible = saldo_disponible - p_monto, updated_at = now() where id = v_wallet_id;
  insert into public.lealtad_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id, motivo)
  values (v_wallet_id, 'CANJE', -p_monto, p_referencia_tipo, p_referencia_id, 'Canje de saldo StylerWallet');

  return v_saldo - p_monto;
end;
$fn$;
grant execute on function public.canjear_lealtad_wallet(numeric, text, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- completar_venta_pos() — 4ª extensión (021 → 022 → 030 → esta).
-- Se agrega, en el mismo punto donde ya se otorgan Puntos/puntaje Staff:
-- Sellos digitales, Cashback, y la finalización de un Referido (Cliente o
-- Staff) cuando esta es la PRIMERA Reserva COMPLETADA del Cliente.
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
  -- Lealtad (ADR-011)
  v_campana record;
  v_sello_cliente_id uuid;
  v_sellos_actuales int;
  v_regla record;
  v_base_cashback numeric;
  v_monto_cashback numeric;
  v_ya_generado_mes numeric;
  v_referido record;
  v_es_primera_reserva boolean;
  v_referido_config public.referido_config;
  v_monto_referido numeric;
  v_staff_referido record;
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

  -- IMPORTANTE: `v_es_primera_reserva` se calcula ANTES del UPDATE de abajo
  -- (que marca esta Reserva como COMPLETADA) — así "primera Reserva" excluye
  -- correctamente la reserva actual de la cuenta de reservas previas.
  select not exists(
    select 1 from public.reserva where cliente_id = v_reserva.cliente_id and estado = 'COMPLETADA' and id <> p_reserva_id
  ) into v_es_primera_reserva;

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

  -- ══════════════════════════════════════════════════════════════════
  -- LEALTAD (ADR-011) — Módulo 5: Sellos digitales. Un sello por
  -- campaña activa cuyo catálogo de servicios (vacío = todos) incluya
  -- al menos un Servicio de esta Reserva, nunca duplicado por Reserva
  -- dentro de la misma campaña (índice único parcial).
  -- ══════════════════════════════════════════════════════════════════
  for v_campana in
    select * from public.sello_campana where negocio_id = v_reserva.negocio_id and estado = 'ACTIVA'
  loop
    if v_campana.servicio_ids = '{}' or exists (
      select 1 from public.reserva_servicio rs where rs.reserva_id = p_reserva_id and rs.servicio_id = any(v_campana.servicio_ids)
    ) then
      insert into public.sello_cliente (campana_id, cliente_id) values (v_campana.id, v_reserva.cliente_id)
      on conflict (campana_id, cliente_id) do nothing;
      select id into v_sello_cliente_id from public.sello_cliente where campana_id = v_campana.id and cliente_id = v_reserva.cliente_id;

      insert into public.sello_evento (sello_cliente_id, reserva_id, tipo, cantidad)
      values (v_sello_cliente_id, p_reserva_id, 'OTORGADO', 1)
      on conflict (reserva_id, sello_cliente_id) where tipo = 'OTORGADO' and reserva_id is not null do nothing;

      if found then
        update public.sello_cliente set sellos_actuales = sellos_actuales + 1, updated_at = now() where id = v_sello_cliente_id;
      end if;
    end if;
  end loop;

  -- ══════════════════════════════════════════════════════════════════
  -- LEALTAD (ADR-011) — Módulo 6: Cashback. % configurado por el Negocio
  -- sobre el valor de Servicios/Productos elegibles — nunca en efectivo,
  -- siempre a StylerWallet, respetando el límite mensual si existe.
  -- ══════════════════════════════════════════════════════════════════
  for v_regla in
    select * from public.cashback_regla where negocio_id = v_reserva.negocio_id and activo = true
  loop
    v_base_cashback := 0;
    if v_regla.servicio_ids = '{}' then
      v_base_cashback := v_base_cashback + greatest(v_reserva.monto_total - v_reserva.monto_sena, 0);
    else
      select coalesce(sum(s.precio), 0) into v_base_cashback
      from public.reserva_servicio rs join public.servicio s on s.id = rs.servicio_id
      where rs.reserva_id = p_reserva_id and rs.servicio_id = any(v_regla.servicio_ids);
    end if;
    if v_regla.producto_ids = '{}' then
      v_base_cashback := v_base_cashback + v_total_productos;
    else
      select v_base_cashback + coalesce(sum(vp.precio_unitario * vp.cantidad), 0) into v_base_cashback
      from public.venta_producto vp where vp.reserva_id = p_reserva_id and vp.producto_id = any(v_regla.producto_ids);
    end if;

    v_monto_cashback := round(v_base_cashback * v_regla.porcentaje / 100, 2);

    if v_regla.limite_mensual is not null then
      select coalesce(sum(monto), 0) into v_ya_generado_mes
      from public.cashback_movimiento
      where regla_id = v_regla.id and cliente_id = v_reserva.cliente_id
        and created_at >= date_trunc('month', now());
      v_monto_cashback := greatest(least(v_monto_cashback, v_regla.limite_mensual - v_ya_generado_mes), 0);
    end if;

    if v_monto_cashback > 0 then
      insert into public.cashback_movimiento (regla_id, cliente_id, reserva_id, monto, estado, fecha_expiracion)
      values (
        v_regla.id, v_reserva.cliente_id, p_reserva_id, v_monto_cashback, 'DISPONIBLE',
        case when v_regla.vigencia_dias is not null then now() + make_interval(days => v_regla.vigencia_dias) else null end
      );
      perform public._lealtad_acreditar(
        v_reserva.cliente_id, 'CASHBACK', v_monto_cashback, v_reserva.negocio_id, v_reserva.sede_id,
        'cashback_regla', v_regla.id, 'Cashback ' || v_regla.porcentaje || '% · ' || v_negocio.nombre
      );
    end if;
  end loop;

  -- ══════════════════════════════════════════════════════════════════
  -- LEALTAD (ADR-011) — Módulo 4/11: completar un Referido (Cliente o de
  -- Staff) cuando esta es la primera Reserva COMPLETADA del Cliente
  -- referido — "instala, reserva, paga. Solo entonces."
  -- ══════════════════════════════════════════════════════════════════
  if v_es_primera_reserva then
    select * into v_referido from public.referido where referido_cliente_id = v_reserva.cliente_id and estado = 'PENDIENTE';
    if found then
      select * into v_referido_config from public.referido_config where negocio_id = v_reserva.negocio_id and activo = true;
      if v_referido_config.negocio_id is not null then
        v_monto_referido := coalesce(v_referido_config.monto, 0)
          + coalesce(round(v_reserva.monto_total * v_referido_config.porcentaje / 100, 2), 0);
        if v_referido_config.limite_mensual is not null then
          select coalesce(sum(monto_recompensa), 0) into v_ya_generado_mes
          from public.referido where referente_cliente_id = v_referido.referente_cliente_id
            and negocio_id = v_reserva.negocio_id and estado = 'COMPLETADO' and completado_at >= date_trunc('month', now());
          v_monto_referido := greatest(least(v_monto_referido, v_referido_config.limite_mensual - v_ya_generado_mes), 0);
        end if;
      else
        v_monto_referido := 0;
      end if;

      update public.referido
      set estado = 'COMPLETADO', reserva_completada_id = p_reserva_id, monto_recompensa = v_monto_referido, completado_at = now()
      where id = v_referido.id;

      if v_monto_referido > 0 then
        perform public._lealtad_acreditar(
          v_referido.referente_cliente_id, 'REFERIDO', v_monto_referido, v_reserva.negocio_id, v_reserva.sede_id,
          'referido', v_referido.id, 'Recompensa por referir a un nuevo Cliente'
        );
      end if;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('referido', v_referido.id, 'REFERIDO_COMPLETADO', 'SISTEMA', v_reserva.negocio_id,
        jsonb_build_object('monto_recompensa', v_monto_referido, 'reserva_id', p_reserva_id));
    end if;

    -- Referido de Staff: mutuamente excluyente con el de Cliente de arriba
    -- (un Cliente referido solo activa UNA de las dos rutas — la que se
    -- haya registrado primero al momento del signup, ver migración 055).
    select * into v_staff_referido from public.staff_referido where cliente_referido_id = v_reserva.cliente_id and estado = 'PENDIENTE';
    if found then
      update public.staff_referido
      set estado = 'COMPLETADO', reserva_completada_id = p_reserva_id, completado_at = now()
      where id = v_staff_referido.id;

      if v_staff_referido.recompensa_tipo = 'PUNTOS' and v_staff_referido.recompensa_monto is not null then
        select id into v_vinculo_id from public.vinculo_staff_negocio
          where staff_id = v_staff_referido.staff_id and negocio_id = v_staff_referido.negocio_id and estado <> 'RETIRADO'
          limit 1;
        if v_vinculo_id is not null and public.temporada_actual_id() is not null then
          insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
          values (v_vinculo_id, public.temporada_actual_id(), 'REFERIDO_STAFF', v_staff_referido.recompensa_monto::int,
            'staff_referido', v_staff_referido.id, 'SISTEMA', 'Cliente referido completó su primera Reserva');
        end if;
      end if;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('staff_referido', v_staff_referido.id, 'STAFF_REFERIDO_COMPLETADO', 'SISTEMA', v_reserva.negocio_id,
        jsonb_build_object('reserva_id', p_reserva_id));
    end if;
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
