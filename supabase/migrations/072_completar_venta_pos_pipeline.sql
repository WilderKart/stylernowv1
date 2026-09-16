-- StylerNow — Migración 072: `completar_venta_pos()` pasa a ser un
-- orquestador delgado. Fase crítica (validación, Productos/Inventario de
-- la venta, Membresía, canje de Puntos, Pago, marcar Reserva COMPLETADA)
-- se mantiene INLINE sin cambios de comportamiento — determina el monto
-- cobrado, así que un fallo ahí debe abortar toda la venta, nunca
-- aislarse. Todo lo que antes eran bloques satélite (Puntos otorgados,
-- Puntaje Staff, Sellos, Cashback, Referidos, VIP, Auditoría resumen)
-- ahora se ejecuta a través de `ejecutar_pipeline_venta_completada()`
-- (migración 070/071) — mismo resultado observable, aislamiento de
-- fallos real entre handlers, y extensible sin volver a tocar esta
-- función (agregar un handler nuevo es una fila en
-- `venta_pipeline_handler`, no una 6ª extensión de esta función).
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
  v_es_primera_reserva boolean;
  -- Lealtad transversal — Membresía (fase crítica: afecta el monto cobrado)
  v_membresia record;
  v_rs record;
  v_descuento_membresia numeric := 0;
  v_beneficio_servicio numeric;
  v_tipo_uso_membresia text;
  v_hubo_servicio_incluido boolean := false;
  v_evento jsonb;
  v_resultado_pipeline jsonb;
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

  -- Membresía (Lealtad transversal, ADR-011) — descuento por Servicio,
  -- calculado ANTES del canje de Puntos para que este último aplique
  -- sobre lo que realmente queda por cobrar.
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

  -- ══════════════════════════════════════════════════════════════════
  -- Fin de la fase crítica — el cobro ya está confirmado e irreversible
  -- desde acá. Todo lo que sigue es el Pipeline de Eventos
  -- `venta_completada`: cada handler corre aislado (un fallo no deshace
  -- el cobro ni afecta a los demás handlers, ver migración 070).
  -- ══════════════════════════════════════════════════════════════════
  v_evento := jsonb_build_object(
    'reserva_id', p_reserva_id,
    'negocio_id', v_reserva.negocio_id,
    'sede_id', v_reserva.sede_id,
    'cliente_id', v_reserva.cliente_id,
    'staff_id', v_reserva.staff_id,
    'monto_total', v_reserva.monto_total,
    'monto_sena', v_reserva.monto_sena,
    'total_productos', v_total_productos,
    'saldo_cobrado', v_saldo_final,
    'descuento_puntos', v_descuento_puntos,
    'descuento_membresia', v_descuento_membresia,
    'propina', p_propina,
    'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes,
    'puntos_otorgados', v_puntos_otorgados,
    'es_primera_reserva', v_es_primera_reserva
  );

  v_resultado_pipeline := public.ejecutar_pipeline_venta_completada(v_evento);

  return v_evento || jsonb_build_object('pipeline', v_resultado_pipeline);
end;
$fn$;
