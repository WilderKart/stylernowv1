-- StylerNow — Migración 054: Dominio LEALTAD (ADR-011) — Módulo 2: Membresías
-- Fuente: ADR_011_Motor_Lealtad.md, Módulo 2.
--
-- Reusa pago_tipo = 'MEMBRESIA', que existe desde la migración 001 sin
-- ningún consumidor real hasta ahora — mismo patrón "arquitectura lista,
-- nunca conectada" ya encontrado varias veces en el proyecto.

-- ════════════════════════════════════════════════════════════════════════
-- Configuración del Plan — exclusivo Barbería.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_plan_membresia(
  p_negocio_id uuid, p_nombre text, p_precio numeric, p_duracion_meses int,
  p_renovacion_automatica boolean default true, p_servicio_ids uuid[] default '{}',
  p_limite_usos_mes int default null, p_descuento_pct numeric default 0,
  p_prioridad_reserva boolean default false, p_regalo_cumpleanos text default null,
  p_dias_gracia int default 0, p_congelacion_max_dias int default 0
)
returns public.membresia_plan
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.membresia_plan;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_precio <= 0 then raise exception 'PRECIO_INVALIDO'; end if;
  if p_duracion_meses not in (1, 3, 6, 12) then raise exception 'DURACION_INVALIDA'; end if;
  if p_congelacion_max_dias not in (0, 7, 15, 30) then raise exception 'CONGELACION_INVALIDA'; end if;

  insert into public.membresia_plan (
    negocio_id, nombre, precio, duracion_meses, renovacion_automatica, servicio_ids,
    limite_usos_mes, descuento_pct, prioridad_reserva, regalo_cumpleanos, dias_gracia, congelacion_max_dias
  ) values (
    p_negocio_id, p_nombre, p_precio, p_duracion_meses, p_renovacion_automatica, p_servicio_ids,
    p_limite_usos_mes, p_descuento_pct, p_prioridad_reserva, p_regalo_cumpleanos, p_dias_gracia, p_congelacion_max_dias
  ) returning * into v_plan;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('membresia_plan', v_plan.id, 'PLAN_MEMBRESIA_CREADO', 'BARBERIA', auth.uid(), p_negocio_id, jsonb_build_object('nombre', p_nombre, 'precio', p_precio));

  return v_plan;
end;
$fn$;
grant execute on function public.crear_plan_membresia(uuid, text, numeric, int, boolean, uuid[], int, numeric, boolean, text, int, int) to authenticated;

create or replace function public.actualizar_plan_membresia(
  p_plan_id uuid, p_nombre text, p_precio numeric, p_servicio_ids uuid[], p_limite_usos_mes int,
  p_descuento_pct numeric, p_prioridad_reserva boolean, p_regalo_cumpleanos text, p_dias_gracia int, p_congelacion_max_dias int
)
returns public.membresia_plan
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.membresia_plan;
begin
  select * into v_plan from public.membresia_plan where id = p_plan_id;
  if not found or not public.is_barberia_de(v_plan.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_precio <= 0 then raise exception 'PRECIO_INVALIDO'; end if;
  if p_congelacion_max_dias not in (0, 7, 15, 30) then raise exception 'CONGELACION_INVALIDA'; end if;

  -- El precio nuevo aplica solo a renovaciones futuras — las membresías ya
  -- activas de Clientes existentes no se recalculan retroactivamente.
  update public.membresia_plan
  set nombre = p_nombre, precio = p_precio, servicio_ids = p_servicio_ids, limite_usos_mes = p_limite_usos_mes,
      descuento_pct = p_descuento_pct, prioridad_reserva = p_prioridad_reserva, regalo_cumpleanos = p_regalo_cumpleanos,
      dias_gracia = p_dias_gracia, congelacion_max_dias = p_congelacion_max_dias, updated_at = now()
  where id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$fn$;
grant execute on function public.actualizar_plan_membresia(uuid, text, numeric, uuid[], int, numeric, boolean, text, int, int) to authenticated;

create or replace function public.alternar_plan_membresia(p_plan_id uuid, p_activo boolean)
returns public.membresia_plan
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.membresia_plan;
begin
  select * into v_plan from public.membresia_plan where id = p_plan_id;
  if not found or not public.is_barberia_de(v_plan.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.membresia_plan set activo = p_activo, updated_at = now() where id = p_plan_id returning * into v_plan;
  return v_plan;
end;
$fn$;
grant execute on function public.alternar_plan_membresia(uuid, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Suscripción del Cliente — cobro único vía Mercado Pago Checkout Pro,
-- mismo patrón exacto que Upgrade de Plan SaaS (Módulo 6.3).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.suscribirse_membresia(p_plan_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.membresia_plan;
  v_pago public.pago;
begin
  select * into v_plan from public.membresia_plan where id = p_plan_id and activo = true;
  if not found then raise exception 'PLAN_NO_DISPONIBLE'; end if;

  if exists (
    select 1 from public.cliente_membresia
    where cliente_id = auth.uid() and negocio_id = v_plan.negocio_id and estado in ('ACTIVA', 'PROXIMA_A_VENCER', 'SUSPENDIDA')
  ) then
    raise exception 'YA_TIENE_MEMBRESIA_ACTIVA';
  end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_plan.negocio_id, 'MEMBRESIA', v_plan.precio, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('plan_id', p_plan_id, 'cliente_id', auth.uid()))
  returning * into v_pago;

  return v_pago;
end;
$fn$;
grant execute on function public.suscribirse_membresia(uuid) to authenticated;

create or replace function public.cancelar_membresia(p_cliente_membresia_id uuid)
returns public.cliente_membresia
language plpgsql security definer set search_path = public as $fn$
declare
  v_membresia public.cliente_membresia;
begin
  select * into v_membresia from public.cliente_membresia where id = p_cliente_membresia_id;
  if not found or (v_membresia.cliente_id <> auth.uid() and not public.is_barberia_de(v_membresia.negocio_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_membresia.estado in ('CANCELADA', 'VENCIDA') then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.cliente_membresia set estado = 'CANCELADA', updated_at = now() where id = p_cliente_membresia_id
  returning * into v_membresia;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('cliente_membresia', v_membresia.id, 'MEMBRESIA_CANCELADA', case when auth.uid() = v_membresia.cliente_id then 'CLIENTE' else 'BARBERIA' end, auth.uid(), v_membresia.negocio_id);

  return v_membresia;
end;
$fn$;
grant execute on function public.cancelar_membresia(uuid) to authenticated;

create or replace function public.congelar_membresia(p_cliente_membresia_id uuid, p_dias int)
returns public.cliente_membresia
language plpgsql security definer set search_path = public as $fn$
declare
  v_membresia public.cliente_membresia;
  v_plan public.membresia_plan;
begin
  select * into v_membresia from public.cliente_membresia where id = p_cliente_membresia_id;
  if not found or v_membresia.cliente_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_membresia.estado <> 'ACTIVA' then raise exception 'TRANSICION_INVALIDA'; end if;

  select * into v_plan from public.membresia_plan where id = v_membresia.plan_id;
  if v_plan.congelacion_max_dias = 0 or p_dias not in (7, 15, 30) or p_dias > v_plan.congelacion_max_dias then
    raise exception 'DIAS_CONGELACION_INVALIDOS';
  end if;

  update public.cliente_membresia
  set estado = 'SUSPENDIDA', congelada_hasta = now() + make_interval(days => p_dias),
      fecha_proximo_cobro = fecha_proximo_cobro + make_interval(days => p_dias), updated_at = now()
  where id = p_cliente_membresia_id
  returning * into v_membresia;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('cliente_membresia', v_membresia.id, 'MEMBRESIA_CONGELADA', 'CLIENTE', auth.uid(), v_membresia.negocio_id, jsonb_build_object('dias', p_dias));

  return v_membresia;
end;
$fn$;
grant execute on function public.congelar_membresia(uuid, int) to authenticated;

-- Reactiva una membresía congelada cuyo período ya venció (autoservicio o cron futuro).
create or replace function public.reactivar_membresia_congelada(p_cliente_membresia_id uuid)
returns public.cliente_membresia
language plpgsql security definer set search_path = public as $fn$
declare
  v_membresia public.cliente_membresia;
begin
  select * into v_membresia from public.cliente_membresia where id = p_cliente_membresia_id;
  if not found or v_membresia.cliente_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_membresia.estado <> 'SUSPENDIDA' or v_membresia.congelada_hasta is null then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.cliente_membresia set estado = 'ACTIVA', congelada_hasta = null, updated_at = now()
  where id = p_cliente_membresia_id
  returning * into v_membresia;

  return v_membresia;
end;
$fn$;
grant execute on function public.reactivar_membresia_congelada(uuid) to authenticated;

-- Registro manual de uso de un beneficio de Membresía (servicio incluido o
-- descuento aplicado) — Barbería/Guardian/Staff, en el momento del cobro.
-- No se integra dentro de completar_venta_pos()/slots_disponibles: son las
-- dos funciones más críticas y ya verificadas del proyecto (ver
-- TECH_DEBT_REGISTER.md, mismo motivo que servicio_combo en 2.5).
create or replace function public.registrar_uso_membresia(p_cliente_membresia_id uuid, p_reserva_id uuid, p_tipo text, p_monto_beneficio numeric default 0)
returns public.membresia_uso
language plpgsql security definer set search_path = public as $fn$
declare
  v_membresia public.cliente_membresia;
  v_reserva public.reserva;
  v_uso public.membresia_uso;
begin
  if p_tipo not in ('SERVICIO_INCLUIDO', 'DESCUENTO_APLICADO') then raise exception 'TIPO_INVALIDO'; end if;
  select * into v_membresia from public.cliente_membresia where id = p_cliente_membresia_id for update;
  if not found then raise exception 'MEMBRESIA_NO_ENCONTRADA'; end if;
  if not public.tiene_acceso_interno(v_membresia.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_membresia.estado <> 'ACTIVA' then raise exception 'MEMBRESIA_NO_ACTIVA'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id;
  if not found or v_reserva.cliente_id <> v_membresia.cliente_id then raise exception 'RESERVA_NO_CORRESPONDE'; end if;

  if v_membresia.usos_mes_fecha < date_trunc('month', now())::date then
    update public.cliente_membresia set usos_mes_actual = 0, usos_mes_fecha = current_date where id = p_cliente_membresia_id;
    v_membresia.usos_mes_actual := 0;
  end if;

  declare v_limite int; begin
    select limite_usos_mes into v_limite from public.membresia_plan where id = v_membresia.plan_id;
    if v_limite is not null and v_membresia.usos_mes_actual >= v_limite then
      raise exception 'LIMITE_MENSUAL_ALCANZADO';
    end if;
  end;

  insert into public.membresia_uso (cliente_membresia_id, reserva_id, tipo, monto_beneficio)
  values (p_cliente_membresia_id, p_reserva_id, p_tipo, p_monto_beneficio)
  returning * into v_uso;

  update public.cliente_membresia set usos_mes_actual = usos_mes_actual + 1, updated_at = now() where id = p_cliente_membresia_id;

  return v_uso;
end;
$fn$;
grant execute on function public.registrar_uso_membresia(uuid, uuid, text, numeric) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- aplicar_evento_pago() — nueva rama para tipo MEMBRESIA (5ª rama junto a
-- la de Reserva y SUSCRIPCION, migración 049). Mismo riesgo ya corregido
-- proactivamente: sin rama propia, un pago sin reserva_id cae en la
-- lógica de "reserva vencida" y se reembolsaría solo.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.aplicar_evento_pago(
  p_pago_id uuid,
  p_id_transaccion text,
  p_estado pago_estado,
  p_payload jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_pago public.pago;
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_suscripcion public.suscripcion;
  v_plan public.membresia_plan;
  v_membresia public.cliente_membresia;
  v_cliente_id uuid;
  v_comision numeric := 0;
  v_neto numeric := 0;
  v_wallet_id uuid;
begin
  select * into v_pago from public.pago where id = p_pago_id for update;
  if not found then
    return jsonb_build_object('procesado', false, 'motivo', 'PAGO_NO_ENCONTRADO');
  end if;

  if v_pago.estado in ('APROBADO','RECHAZADO','REEMBOLSADO','REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', v_pago.estado);
  end if;

  if v_pago.tipo = 'SUSCRIPCION' then
    if p_estado = 'APROBADO' then
      update public.pago
      set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion,
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;

      update public.suscripcion
      set plan_codigo = (v_pago.metadata->>'plan_codigo_nuevo')::plan_codigo, updated_at = now()
      where negocio_id = v_pago.negocio_id
      returning * into v_suscripcion;

      update public.negocio set plan_codigo = v_suscripcion.plan_codigo, updated_at = now() where id = v_pago.negocio_id;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('suscripcion', v_suscripcion.id, 'UPGRADE_APLICADO', 'SISTEMA', v_pago.negocio_id,
        jsonb_build_object('plan_codigo', v_suscripcion.plan_codigo, 'pago_id', p_pago_id));

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    if p_estado = 'RECHAZADO' then
      update public.pago
      set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  -- LEALTAD (ADR-011, Módulo 2) — Membresías: crea cliente_membresia al
  -- aprobarse el cobro. No toca Wallet/comisión (no es transacción de
  -- Marketplace) ni Reserva alguna.
  if v_pago.tipo = 'MEMBRESIA' then
    if p_estado = 'APROBADO' then
      update public.pago
      set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion,
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;

      v_cliente_id := (v_pago.metadata->>'cliente_id')::uuid;
      select * into v_plan from public.membresia_plan where id = (v_pago.metadata->>'plan_id')::uuid;

      insert into public.cliente_membresia (cliente_id, plan_id, negocio_id, estado, fecha_proximo_cobro)
      values (v_cliente_id, v_plan.id, v_plan.negocio_id, 'ACTIVA', now() + make_interval(months => v_plan.duracion_meses))
      returning * into v_membresia;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('cliente_membresia', v_cliente_id, 'MEMBRESIA_ACTIVADA', 'SISTEMA', v_plan.negocio_id,
        jsonb_build_object('plan_id', v_plan.id, 'pago_id', p_pago_id));

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    if p_estado = 'RECHAZADO' then
      update public.pago
      set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  -- LEALTAD (ADR-011, Módulo 3/10) — Gift Cards: activa la tarjeta al
  -- aprobarse el cobro (ver migración 055 para la creación en PENDIENTE).
  if v_pago.tipo = 'GIFT_CARD' then
    if p_estado = 'APROBADO' then
      update public.pago
      set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion,
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;

      update public.gift_card set estado = 'ACTIVA', updated_at = now()
      where id = (v_pago.metadata->>'gift_card_id')::uuid and estado = 'BLOQUEADA';

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('gift_card', (v_pago.metadata->>'gift_card_id')::uuid, 'GIFT_CARD_ACTIVADA', 'SISTEMA', v_pago.negocio_id,
        jsonb_build_object('pago_id', p_pago_id));

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    if p_estado = 'RECHAZADO' then
      update public.pago
      set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
          payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
      where id = p_pago_id;

      -- La gift card nunca llegó a estar ACTIVA — se elimina, no queda huérfana en BLOQUEADA.
      delete from public.gift_card where id = (v_pago.metadata->>'gift_card_id')::uuid and estado = 'BLOQUEADA';

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;

    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  select * into v_reserva from public.reserva where id = v_pago.reserva_id for update;
  select * into v_negocio from public.negocio where id = v_pago.negocio_id;

  if p_estado = 'APROBADO' then
    v_comision := round(v_pago.monto * coalesce(v_negocio.comision_plataforma_pct, 8) / 100, 2);
    v_neto := v_pago.monto - v_comision;

    update public.pago
    set estado = 'APROBADO',
        id_transaccion_pasarela = p_id_transaccion,
        comision_plataforma_monto = v_comision,
        payload_pasarela = p_payload,
        procesado_at = now(),
        updated_at = now()
    where id = p_pago_id;

    if v_negocio.id is not null then
      select id into v_wallet_id from public.wallet where negocio_id = v_negocio.id for update;
      if v_wallet_id is not null then
        update public.wallet set saldo_disponible = saldo_disponible + v_neto, updated_at = now()
        where id = v_wallet_id;
        insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
        values (v_wallet_id, 'COMISION', v_neto, 'pago', p_pago_id);
      end if;
    end if;

    if v_reserva.id is null or v_reserva.estado <> 'PENDIENTE_PAGO' then
      return jsonb_build_object(
        'procesado', true,
        'requiere_reembolso', true,
        'motivo', 'RESERVA_EXPIRADA',
        'reserva_id', v_reserva.id
      );
    end if;

    update public.reserva
    set estado = 'CONFIRMADA', expira_at = null, updated_at = now()
    where id = v_reserva.id;

    insert into public.evento_auditoria
      (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values
      ('reserva', v_reserva.id, 'RESERVA_CONFIRMADA', 'SISTEMA', v_negocio.id,
       jsonb_build_object('pago_id', p_pago_id, 'id_transaccion', p_id_transaccion));

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  if p_estado = 'RECHAZADO' then
    update public.pago
    set estado = 'RECHAZADO',
        id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
        payload_pasarela = p_payload,
        procesado_at = now(),
        updated_at = now()
    where id = p_pago_id;

    if v_reserva.id is not null and v_reserva.estado = 'PENDIENTE_PAGO' then
      update public.reserva
      set estado = 'CANCELADA',
          cancelado_por = 'PLATAFORMA',
          cancelado_motivo = 'PAGO_RECHAZADO',
          updated_at = now()
      where id = v_reserva.id;
    end if;

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
end;
$fn$;
