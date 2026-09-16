-- StylerNow — Migración 062: Lealtad transversal (pedido del fundador,
-- 2026-09-16) — 5ª extensión de completar_venta_pos() para consumir
-- automáticamente el beneficio de Membresía (Servicio incluido y/o
-- descuento) en el momento de cobrar la Reserva, cerrando el recorrido
-- completo: Membresía activa → Reserva → consumo automático → Sellos →
-- Cashback → StylerWallet → ascenso VIP — todo en una sola transacción
-- ya verificada, sin tocar slots_disponibles/creación de Reserva.
--
-- Cálculo por Servicio (no agregado): si el plan tiene servicio_ids no
-- vacío, cada Servicio de la Reserva que esté en esa lista queda 100%
-- incluido (se descuenta su precio_congelado_unitario completo); el
-- resto de Servicios de la misma Reserva recibe el descuento_pct del
-- plan si tiene uno configurado. Si servicio_ids está vacío, TODOS los
-- Servicios de la Reserva quedan incluidos (mismo criterio ya usado en
-- Sellos/Cashback: array vacío = aplica a todo).

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
  v_campana record;
  v_sello_cliente_id uuid;
  v_regla record;
  v_base_cashback numeric;
  v_monto_cashback numeric;
  v_ya_generado_mes numeric;
  v_referido record;
  v_es_primera_reserva boolean;
  v_referido_config public.referido_config;
  v_monto_referido numeric;
  v_staff_referido record;
  -- Lealtad transversal — Membresía
  v_membresia record;
  v_rs record;
  v_descuento_membresia numeric := 0;
  v_beneficio_servicio numeric;
  v_tipo_uso_membresia text;
  v_hubo_servicio_incluido boolean := false;
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

  -- ══════════════════════════════════════════════════════════════════
  -- LEALTAD TRANSVERSAL — Módulo 2: consumo automático de Membresía.
  -- Se calcula ANTES del canje de Puntos, sobre el saldo bruto, para que
  -- el descuento de Puntos (si el Cliente también canjea) se aplique
  -- sobre lo que realmente queda por cobrar.
  -- ══════════════════════════════════════════════════════════════════
  select cm.*, mp.servicio_ids as plan_servicio_ids, mp.descuento_pct as plan_descuento_pct, mp.limite_usos_mes as plan_limite_usos_mes
  into v_membresia
  from public.cliente_membresia cm
  join public.membresia_plan mp on mp.id = cm.plan_id
  where cm.cliente_id = v_reserva.cliente_id and cm.negocio_id = v_reserva.negocio_id and cm.estado = 'ACTIVA'
  limit 1;

  if v_membresia.id is not null then
    if v_membresia.usos_mes_fecha < date_trunc('month', now())::date then
      update public.cliente_membresia set usos_mes_actual = 0, usos_mes_fecha = current_date where id = v_membresia.id;
      v_membresia.usos_mes_actual := 0;
    end if;

    if v_membresia.plan_limite_usos_mes is null or v_membresia.usos_mes_actual < v_membresia.plan_limite_usos_mes then
      for v_rs in
        select rs.servicio_id, rs.precio_congelado_unitario
        from public.reserva_servicio rs where rs.reserva_id = p_reserva_id
      loop
        if v_membresia.plan_servicio_ids = '{}' or v_rs.servicio_id = any(v_membresia.plan_servicio_ids) then
          v_beneficio_servicio := v_rs.precio_congelado_unitario;
          v_hubo_servicio_incluido := true;
        elsif coalesce(v_membresia.plan_descuento_pct, 0) > 0 then
          v_beneficio_servicio := round(v_rs.precio_congelado_unitario * v_membresia.plan_descuento_pct / 100, 2);
        else
          v_beneficio_servicio := 0;
        end if;
        v_descuento_membresia := v_descuento_membresia + v_beneficio_servicio;
      end loop;

      v_descuento_membresia := least(v_descuento_membresia, v_saldo_servicio);

      if v_descuento_membresia > 0 then
        v_saldo_servicio := v_saldo_servicio - v_descuento_membresia;
        v_tipo_uso_membresia := case when v_hubo_servicio_incluido then 'SERVICIO_INCLUIDO' else 'DESCUENTO_APLICADO' end;

        insert into public.membresia_uso (cliente_membresia_id, reserva_id, tipo, monto_beneficio)
        values (v_membresia.id, p_reserva_id, v_tipo_uso_membresia, v_descuento_membresia);

        update public.cliente_membresia set usos_mes_actual = usos_mes_actual + 1, updated_at = now() where id = v_membresia.id;
      end if;
    end if;
  end if;

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

  for v_regla in
    select * from public.cashback_regla where negocio_id = v_reserva.negocio_id and activo = true
  loop
    v_base_cashback := 0;
    if v_regla.servicio_ids = '{}' then
      v_base_cashback := v_base_cashback + greatest(v_reserva.monto_total - v_reserva.monto_sena, 0);
    else
      select coalesce(sum(rs.precio_congelado_unitario), 0) into v_base_cashback
      from public.reserva_servicio rs
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
      'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes, 'puntos_otorgados', v_puntos_otorgados,
      'descuento_membresia', v_descuento_membresia
    )
  );

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'saldo_cobrado', v_saldo_final,
    'descuento_puntos', v_descuento_puntos,
    'descuento_membresia', v_descuento_membresia,
    'propina', p_propina,
    'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes,
    'puntos_otorgados', v_puntos_otorgados
  );
end;
$fn$;
