-- StylerNow — Migración 041: Fase 6, Módulo 6.1 — Wallet: comisión de
-- plataforma real
-- Fuente: 08-Growth-Monetization/02_Commissions.md.
--
-- Hallazgo real, encontrado leyendo el schema al planear la Fase 6 (el
-- sistema de Ads que depende de esto): `wallet`/`wallet_movimiento`
-- existen desde la migración 003, `handle_new_negocio()` crea la fila de
-- `wallet` de cada Negocio automáticamente desde la migración 007 — pero
-- CERO filas se insertaron jamás en `wallet_movimiento`, y ningún UPDATE
-- tocó `wallet.saldo_disponible` en toda la base de código.
-- `aplicar_evento_pago()` ya calculaba `v_comision` y la guardaba en
-- `pago.comision_plataforma_monto` (para auditoría/reporte), pero nunca
-- acreditaba el monto neto al Wallet del Negocio — exactamente el mismo
-- patrón de "arquitectura lista, nunca conectada" que ya se encontró con
-- la aprobación de Negocio (Módulo 3.1), el sistema de puntaje de Staff
-- (Módulo 4) y las visitas del Marketplace (Módulo 5.2).
--
-- Se corrige: (1) `aplicar_evento_pago()` acredita `monto - comisión` al
-- Wallet en el mismo momento en que el pago pasa a APROBADO, con un
-- `wallet_movimiento` real; (2) `revertir_comision_wallet()` (nueva)
-- revierte proporcionalmente ese crédito cuando un pago se reembolsa
-- (total o parcial) — los tres lugares del código que marcan un `pago`
-- como REEMBOLSADO/REEMBOLSADO_PARCIAL (todos en TypeScript, con el
-- cliente admin: `sincronizar.ts` dos veces, `reserva/[id]/actions.ts`
-- una vez) la llaman justo después de actualizar el estado del pago.

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
  v_comision numeric := 0;
  v_neto numeric := 0;
  v_wallet_id uuid;
begin
  select * into v_pago from public.pago where id = p_pago_id for update;
  if not found then
    return jsonb_build_object('procesado', false, 'motivo', 'PAGO_NO_ENCONTRADO');
  end if;

  -- Idempotencia: un pago ya en estado terminal no vuelve a producir efectos de negocio.
  if v_pago.estado in ('APROBADO','RECHAZADO','REEMBOLSADO','REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', v_pago.estado);
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

    -- Wallet: crédito neto (monto - comisión de plataforma) — 02_Commissions.md:
    -- "el Negocio recibe el monto neto en su wallet, nunca recibe el bruto para
    -- luego pagar la comisión manualmente". Se salta para PROPINA (100% Staff,
    -- nunca pasa por acá con tipo SENA/SALDO) y para pagos sin negocio_id.
    if v_negocio.id is not null then
      select id into v_wallet_id from public.wallet where negocio_id = v_negocio.id for update;
      if v_wallet_id is not null then
        update public.wallet set saldo_disponible = saldo_disponible + v_neto, updated_at = now()
        where id = v_wallet_id;
        insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
        values (v_wallet_id, 'COMISION', v_neto, 'pago', p_pago_id);
      end if;
    end if;

    -- 03_Payment_Rules.md: pago que confirma DESPUÉS de la expiración → reembolso total.
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

    -- El horario vuelve a estar disponible de inmediato para otro Cliente.
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

-- ════════════════════════════════════════════════════════════════════════
-- Reversión proporcional de la comisión al reembolsar (02_Commissions.md,
-- caso límite: "la comisión retenida también se revierte... nunca queda
-- una comisión cobrada sobre una transacción que terminó en $0"). Sin
-- chequeo de rol propio: solo se invoca desde código de servidor con el
-- cliente admin (service_role), nunca se otorga a anon/authenticated.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.revertir_comision_wallet(p_pago_id uuid, p_monto_reembolsado numeric)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_pago public.pago;
  v_pct numeric;
  v_comision_revertir numeric;
  v_neto_revertir numeric;
  v_wallet_id uuid;
begin
  if p_monto_reembolsado <= 0 then return; end if;

  select * into v_pago from public.pago where id = p_pago_id;
  if not found or v_pago.monto <= 0 then return; end if;

  v_pct := least(p_monto_reembolsado / v_pago.monto, 1);
  v_comision_revertir := round(coalesce(v_pago.comision_plataforma_monto, 0) * v_pct, 2);
  v_neto_revertir := p_monto_reembolsado - v_comision_revertir;

  select id into v_wallet_id from public.wallet where negocio_id = v_pago.negocio_id for update;
  if v_wallet_id is null then return; end if;

  -- Puede dejar saldo temporalmente negativo a propósito (se compensa en la
  -- siguiente liquidación) — nunca se recorta a 0, per el caso límite de la Biblia.
  update public.wallet set saldo_disponible = saldo_disponible - v_neto_revertir, updated_at = now()
  where id = v_wallet_id;

  insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
  values (v_wallet_id, 'REEMBOLSO_COMISION', -v_neto_revertir, 'pago', p_pago_id);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('wallet', v_wallet_id, 'COMISION_REVERTIDA', 'SISTEMA', v_pago.negocio_id,
    jsonb_build_object('pago_id', p_pago_id, 'monto_reembolsado', p_monto_reembolsado, 'neto_revertido', v_neto_revertir));
end;
$fn$;

revoke all on function public.revertir_comision_wallet(uuid, numeric) from public;
