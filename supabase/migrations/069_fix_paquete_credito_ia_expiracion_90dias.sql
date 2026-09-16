-- StylerNow — Migración 069: corrige la expiración de un paquete de
-- créditos IA comprado — la migración 068 usaba 365 días, pero
-- `AI_Credit_System.md` (Bible, ya aprobado) fija 90 días para créditos
-- comprados (a diferencia de los del Plan, que expiran a los 30 días al
-- cerrar el ciclo mensual). Encontrado en la auditoría Fase 0 de
-- ADR-013 — la ADR nueva nunca pidió cambiar esta ventana, así que se
-- corrige el código para que coincida con la regla de negocio ya
-- vigente, en vez de dejar una contradicción silenciosa en la Biblia.
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
      update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela), payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  if v_pago.tipo = 'MEMBRESIA' then
    if p_estado = 'APROBADO' then
      update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;

      v_cliente_id := (v_pago.metadata->>'cliente_id')::uuid;
      select * into v_plan from public.membresia_plan where id = (v_pago.metadata->>'plan_id')::uuid;

      insert into public.cliente_membresia (cliente_id, plan_id, negocio_id, estado, fecha_proximo_cobro)
      values (v_cliente_id, v_plan.id, v_plan.negocio_id, 'ACTIVA', now() + make_interval(months => v_plan.duracion_meses))
      returning * into v_membresia;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('cliente_membresia', v_cliente_id, 'MEMBRESIA_ACTIVADA', 'SISTEMA', v_plan.negocio_id, jsonb_build_object('plan_id', v_plan.id, 'pago_id', p_pago_id));

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    if p_estado = 'RECHAZADO' then
      update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela), payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  if v_pago.tipo = 'GIFT_CARD' then
    if p_estado = 'APROBADO' then
      update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;
      update public.gift_card set estado = 'ACTIVA', updated_at = now() where id = (v_pago.metadata->>'gift_card_id')::uuid and estado = 'BLOQUEADA';
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('gift_card', (v_pago.metadata->>'gift_card_id')::uuid, 'GIFT_CARD_ACTIVADA', 'SISTEMA', v_pago.negocio_id, jsonb_build_object('pago_id', p_pago_id));
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    if p_estado = 'RECHAZADO' then
      update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela), payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;
      delete from public.gift_card where id = (v_pago.metadata->>'gift_card_id')::uuid and estado = 'BLOQUEADA';
      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
  end if;

  -- AI OS (ADR-013): paquete de créditos IA — acredita un lote origen
  -- PAQUETE al aprobarse. 90 días de expiración (AI_Credit_System.md,
  -- ya aprobado) — no 365, corregido en la migración 069. Nunca toca
  -- Wallet/comisión ni Reserva.
  if v_pago.tipo = 'PAQUETE_CREDITOS_IA' then
    if p_estado = 'APROBADO' then
      update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;

      insert into public.credito_ia_lote (negocio_id, origen, cantidad, cantidad_disponible, fecha_expiracion)
      values (v_pago.negocio_id, 'PAQUETE', (v_pago.metadata->>'creditos')::int, (v_pago.metadata->>'creditos')::int, now() + interval '90 days');

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('credito_ia_lote', v_pago.negocio_id, 'PAQUETE_CREDITOS_IA_ACREDITADO', 'SISTEMA', v_pago.negocio_id, jsonb_build_object('creditos', v_pago.metadata->>'creditos', 'pago_id', p_pago_id));

      return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
    end if;
    if p_estado = 'RECHAZADO' then
      update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela), payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;
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
    set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, comision_plataforma_monto = v_comision,
        payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
    where id = p_pago_id;

    if v_negocio.id is not null then
      select id into v_wallet_id from public.wallet where negocio_id = v_negocio.id for update;
      if v_wallet_id is not null then
        update public.wallet set saldo_disponible = saldo_disponible + v_neto, updated_at = now() where id = v_wallet_id;
        insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id) values (v_wallet_id, 'COMISION', v_neto, 'pago', p_pago_id);
      end if;
    end if;

    if v_reserva.id is null or v_reserva.estado <> 'PENDIENTE_PAGO' then
      return jsonb_build_object('procesado', true, 'requiere_reembolso', true, 'motivo', 'RESERVA_EXPIRADA', 'reserva_id', v_reserva.id);
    end if;

    update public.reserva set estado = 'CONFIRMADA', expira_at = null, updated_at = now() where id = v_reserva.id;

    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values ('reserva', v_reserva.id, 'RESERVA_CONFIRMADA', 'SISTEMA', v_negocio.id, jsonb_build_object('pago_id', p_pago_id, 'id_transaccion', p_id_transaccion));

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  if p_estado = 'RECHAZADO' then
    update public.pago
    set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela), payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
    where id = p_pago_id;

    if v_reserva.id is not null and v_reserva.estado = 'PENDIENTE_PAGO' then
      update public.reserva set estado = 'CANCELADA', cancelado_por = 'PLATAFORMA', cancelado_motivo = 'PAGO_RECHAZADO', updated_at = now() where id = v_reserva.id;
    end if;

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
end;
$fn$;
