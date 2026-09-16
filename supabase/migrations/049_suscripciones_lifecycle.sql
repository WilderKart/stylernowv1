-- StylerNow — Migración 049: Fase 6, Módulo 6.3 — Suscripciones: ciclo de
-- vida (upgrade/downgrade/suspensión/reactivación/cancelación) y el lado
-- manual de fallos de cobro.
-- Fuente: 08-Growth-Monetization/04_Subscriptions_Lifecycle.md,
--         05_Billing_Failures.md, 01-PRD/03_Monetization.md.
--
-- Alcance deliberadamente recortado (documentado en TECH_DEBT_REGISTER.md
-- y PENDING_DECISIONS.md, no un olvido): el calendario automático de
-- reintentos Día 0/1/3/7/10 de 05_Billing_Failures.md requiere cobro
-- recurrente contra un medio de pago guardado — Mercado Pago Checkout Pro
-- (lo único integrado hoy, `src/lib/pagos/mercadopago.ts`) solo genera
-- preferencias de cobro único, no tiene ningún concepto de tarjeta
-- guardada ni de "Preapproval"/suscripción automática de la pasarela. Sin
-- eso, cualquier "intento de cobro automático en Día 0/3/7" sería un
-- efecto simulado, no real — se construye en su lugar el lado 100% real y
-- útil hoy: el Upgrade (cobro único prorrateado, sí puede ser real vía
-- Checkout Pro), el Downgrade programado con re-validación, y el camino
-- manual de SuperSU para marcar EN_MORA / forzar reactivación por pago
-- externo (Caso límite explícito de la Biblia, no depende del calendario
-- automático).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Upgrade — inmediato, prorrateado, cobro único vía Mercado Pago.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.solicitar_upgrade_plan(p_negocio_id uuid, p_plan_codigo_nuevo plan_codigo)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_suscripcion public.suscripcion;
  v_plan_actual public.plan;
  v_plan_nuevo public.plan;
  v_dias_restantes numeric;
  v_monto numeric;
  v_pago public.pago;
begin
  select * into v_negocio from public.negocio where id = p_negocio_id;
  if not found or not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_negocio.estado <> 'ACTIVO' then
    raise exception 'NEGOCIO_NO_ACTIVO';
  end if;

  select * into v_suscripcion from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found or v_suscripcion.estado <> 'ACTIVA' then
    raise exception 'SUSCRIPCION_NO_ACTIVA';
  end if;

  if p_plan_codigo_nuevo = 'ALLFATHER' then
    raise exception 'ALLFATHER_REQUIERE_COTIZACION';
  end if;
  if p_plan_codigo_nuevo = v_suscripcion.plan_codigo then
    raise exception 'YA_ESTA_EN_ESE_PLAN';
  end if;
  if exists (select 1 from public.pago where negocio_id = p_negocio_id and tipo = 'SUSCRIPCION' and estado = 'PENDIENTE') then
    raise exception 'UPGRADE_YA_EN_PROCESO';
  end if;

  select * into v_plan_actual from public.plan where codigo = v_suscripcion.plan_codigo;
  select * into v_plan_nuevo from public.plan where codigo = p_plan_codigo_nuevo;

  if v_plan_nuevo.precio_mensual is null or v_plan_actual.precio_mensual is null
     or v_plan_nuevo.precio_mensual <= v_plan_actual.precio_mensual then
    raise exception 'NO_ES_UPGRADE';
  end if;

  -- 01-PRD/03_Monetization.md: "se prorratea por día calendario restante del
  -- ciclo de facturación (30 días)". El ciclo actual NO se reinicia — el
  -- Negocio ya pagó por él; el upgrade solo cobra la diferencia del tramo
  -- que falta, y el próximo cobro completo llega en fecha_proximo_cobro tal
  -- cual estaba.
  v_dias_restantes := greatest(0, least(30, ceil(extract(epoch from (v_suscripcion.fecha_proximo_cobro - now())) / 86400.0)));
  v_monto := round((v_plan_nuevo.precio_mensual - v_plan_actual.precio_mensual) * v_dias_restantes / 30.0);
  if v_monto <= 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (
    p_negocio_id, 'SUSCRIPCION', v_monto, 'PENDIENTE', 'MERCADOPAGO',
    jsonb_build_object(
      'plan_codigo_nuevo', p_plan_codigo_nuevo,
      'plan_codigo_actual', v_suscripcion.plan_codigo,
      'dias_restantes', v_dias_restantes
    )
  )
  returning * into v_pago;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values (
    'suscripcion', v_suscripcion.id, 'UPGRADE_SOLICITADO', 'BARBERIA', auth.uid(), p_negocio_id,
    jsonb_build_object('plan_codigo', v_suscripcion.plan_codigo),
    jsonb_build_object('plan_codigo_destino', p_plan_codigo_nuevo, 'monto_prorrateado', v_monto, 'pago_id', v_pago.id)
  );

  return v_pago;
end;
$fn$;

grant execute on function public.solicitar_upgrade_plan(uuid, plan_codigo) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. `aplicar_evento_pago()` — rama nueva para tipo SUSCRIPCION.
--    IMPORTANTE: sin esta rama, un pago de upgrade caía en la lógica de
--    Reserva ya existente, que trata "sin reserva asociada" como "reserva
--    vencida" y devuelve `requiere_reembolso: true` — habría reembolsado
--    automáticamente TODO upgrade real. Se corrige proactivamente antes de
--    verificar, no como bug encontrado en producción.
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

  -- Suscripción SaaS (upgrade de Plan): cobro directo a la plataforma, nunca
  -- pasa por Wallet/comisión de Negocio (no es una transacción de
  -- Marketplace) ni tiene Reserva asociada — rama aislada, retorna antes de
  -- tocar cualquier lógica de Reserva.
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

-- ════════════════════════════════════════════════════════════════════════
-- 3. Downgrade — programado al siguiente ciclo, re-validado el día de
--    ejecución (04_Subscriptions_Lifecycle.md, Casos límite).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.solicitar_downgrade_plan(p_negocio_id uuid, p_plan_codigo_destino plan_codigo)
returns public.suscripcion
language plpgsql security definer set search_path = public as $fn$
declare
  v_suscripcion public.suscripcion;
  v_plan_actual public.plan;
  v_plan_destino public.plan;
  v_sedes_activas int;
  v_staff_activo int;
begin
  if not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_suscripcion from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found or v_suscripcion.estado <> 'ACTIVA' then
    raise exception 'SUSCRIPCION_NO_ACTIVA';
  end if;

  if p_plan_codigo_destino = 'ALLFATHER' then
    raise exception 'ALLFATHER_REQUIERE_COTIZACION';
  end if;

  select * into v_plan_actual from public.plan where codigo = v_suscripcion.plan_codigo;
  select * into v_plan_destino from public.plan where codigo = p_plan_codigo_destino;

  if v_plan_destino.precio_mensual is null or v_plan_actual.precio_mensual is null
     or v_plan_destino.precio_mensual >= v_plan_actual.precio_mensual then
    raise exception 'NO_ES_DOWNGRADE';
  end if;

  select count(*) into v_sedes_activas from public.sede
  where negocio_id = p_negocio_id and not cerrada_permanente and not cerrada_temporalmente;
  if v_plan_destino.limite_sedes is not null and v_sedes_activas > v_plan_destino.limite_sedes then
    raise exception 'EXCEDE_LIMITE_SEDES';
  end if;

  select count(*) into v_staff_activo from public.vinculo_staff_negocio
  where negocio_id = p_negocio_id and estado = 'ACTIVO';
  if v_plan_destino.staff_tope_absoluto is not null and v_staff_activo > v_plan_destino.staff_tope_absoluto then
    raise exception 'EXCEDE_LIMITE_STAFF';
  end if;

  update public.suscripcion
  set plan_codigo_destino = p_plan_codigo_destino, updated_at = now()
  where negocio_id = p_negocio_id
  returning * into v_suscripcion;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('suscripcion', v_suscripcion.id, 'DOWNGRADE_PROGRAMADO', 'BARBERIA', auth.uid(), p_negocio_id,
    jsonb_build_object('plan_codigo_destino', p_plan_codigo_destino, 'efectivo_desde', v_suscripcion.fecha_proximo_cobro));

  return v_suscripcion;
end;
$fn$;

create or replace function public.cancelar_downgrade_programado(p_negocio_id uuid)
returns public.suscripcion
language plpgsql security definer set search_path = public as $fn$
declare
  v_suscripcion public.suscripcion;
begin
  if not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.suscripcion set plan_codigo_destino = null, updated_at = now()
  where negocio_id = p_negocio_id and plan_codigo_destino is not null
  returning * into v_suscripcion;
  if not found then
    raise exception 'SIN_DOWNGRADE_PROGRAMADO';
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('suscripcion', v_suscripcion.id, 'DOWNGRADE_CANCELADO_POR_BARBERIA', 'BARBERIA', auth.uid(), p_negocio_id);

  return v_suscripcion;
end;
$fn$;

grant execute on function public.solicitar_downgrade_plan(uuid, plan_codigo) to authenticated;
grant execute on function public.cancelar_downgrade_programado(uuid) to authenticated;

-- Ejecución diaria (pensada para un cron — ver src/app/api/cron/diario) de
-- todo downgrade cuyo ciclo ya venció, re-validando límites en ese momento
-- exacto, nunca confiando en la validación hecha al solicitarlo.
create or replace function public.ejecutar_downgrades_programados()
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_row record;
  v_plan_destino public.plan;
  v_sedes_activas int;
  v_staff_activo int;
  v_ejecutados int := 0;
  v_cancelados int := 0;
begin
  for v_row in
    select * from public.suscripcion
    where plan_codigo_destino is not null and fecha_proximo_cobro <= now() and estado = 'ACTIVA'
    for update
  loop
    select * into v_plan_destino from public.plan where codigo = v_row.plan_codigo_destino;

    select count(*) into v_sedes_activas from public.sede
    where negocio_id = v_row.negocio_id and not cerrada_permanente and not cerrada_temporalmente;
    select count(*) into v_staff_activo from public.vinculo_staff_negocio
    where negocio_id = v_row.negocio_id and estado = 'ACTIVO';

    if (v_plan_destino.limite_sedes is not null and v_sedes_activas > v_plan_destino.limite_sedes)
       or (v_plan_destino.staff_tope_absoluto is not null and v_staff_activo > v_plan_destino.staff_tope_absoluto) then
      update public.suscripcion set plan_codigo_destino = null, updated_at = now() where id = v_row.id;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('suscripcion', v_row.id, 'DOWNGRADE_CANCELADO_POR_LIMITE', 'SISTEMA', v_row.negocio_id,
        jsonb_build_object('plan_codigo_destino_cancelado', v_row.plan_codigo_destino));

      insert into public.notificacion_envio (destinatario_id, evento, categoria, canal, negocio_id)
      select n.owner_user_id, 'DOWNGRADE_CANCELADO_POR_LIMITE', 'SUSCRIPCION', 'PANEL_INTERNO', v_row.negocio_id
      from public.negocio n where n.id = v_row.negocio_id;

      v_cancelados := v_cancelados + 1;
    else
      update public.suscripcion
      set plan_codigo = v_row.plan_codigo_destino,
          plan_codigo_destino = null,
          fecha_inicio_ciclo = now(),
          fecha_proximo_cobro = now() + interval '30 days',
          updated_at = now()
      where id = v_row.id;

      update public.negocio set plan_codigo = v_row.plan_codigo_destino, updated_at = now() where id = v_row.negocio_id;

      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
      values ('suscripcion', v_row.id, 'DOWNGRADE_EJECUTADO', 'SISTEMA', v_row.negocio_id,
        jsonb_build_object('plan_codigo', v_row.plan_codigo_destino));

      v_ejecutados := v_ejecutados + 1;
    end if;
  end loop;

  return jsonb_build_object('ejecutados', v_ejecutados, 'cancelados_por_limite', v_cancelados);
end;
$fn$;

-- Mismo patrón de ADL-022: sin chequeo interno de rol propio (itera sobre
-- TODOS los negocios, no tiene un "dueño" a quien pedirle auth.uid()) —
-- la única defensa es que ningún rol de producto pueda invocarla.
revoke all on function public.ejecutar_downgrades_programados() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Suspensión / Reactivación / Cancelación — se EXTIENDEN las RPCs ya
--    existentes desde la migración 024 (Módulo 3.1), agregando lo que
--    04_Subscriptions_Lifecycle.md especifica y que no existía cuando se
--    escribieron (no existía Wallet, Ads ni la columna suspendido_causa):
--    sincronizar suscripcion.estado, pausar campañas activas, cancelar
--    lista_espera. Requiere drop+create porque suspender_negocio agrega un
--    parámetro nuevo (ADL-020/021: create or replace con parámetro nuevo
--    deja un overload silencioso).
-- ════════════════════════════════════════════════════════════════════════

drop function if exists public.suspender_negocio(uuid, text);

create function public.suspender_negocio(p_negocio_id uuid, p_motivo text, p_causa text default 'INFRACCION')
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_reserva record;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  if p_causa not in ('IMPAGO', 'INFRACCION') then
    raise exception 'CAUSA_INVALIDA';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'ACTIVO' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'SUSPENDIDO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = p_causa, updated_at = now()
  where negocio_id = p_negocio_id;

  update public.campana_publicitaria set estado = 'PAUSADA', updated_at = now()
  where negocio_id = p_negocio_id and estado = 'ACTIVA';

  update public.lista_espera set estado = 'CANCELADA'
  where negocio_id = p_negocio_id and estado in ('ACTIVA', 'NOTIFICADA');

  for v_reserva in
    select id from public.reserva
    where negocio_id = p_negocio_id and estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and hora_inicio > now()
  loop
    perform public.cancelar_reserva(v_reserva.id, 'Negocio suspendido: ' || p_motivo);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_SUSPENDIDO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', 'ACTIVO'), jsonb_build_object('estado', 'SUSPENDIDO', 'causa', p_causa));

  return v_negocio;
end;
$fn$;

grant execute on function public.suspender_negocio(uuid, text, text) to authenticated;

drop function if exists public.reactivar_negocio_supersu(uuid);

create function public.reactivar_negocio_supersu(p_negocio_id uuid)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'SUSPENDIDO' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'ACTIVO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  -- Reactivación por infracción: nunca automática (04_Subscriptions_Lifecycle.md).
  -- Las campañas quedan PAUSADA a propósito — la Barbería las reanuda a mano
  -- (activar_campana), nunca se reactiva gasto publicitario sin que lo pida.
  update public.suscripcion set estado = 'ACTIVA', suspendido_causa = null, updated_at = now()
  where negocio_id = p_negocio_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_REACTIVADO', 'SUPERSU', auth.uid(), p_negocio_id,
    jsonb_build_object('estado', 'SUSPENDIDO'), jsonb_build_object('estado', 'ACTIVO'));

  return v_negocio;
end;
$fn$;

grant execute on function public.reactivar_negocio_supersu(uuid) to authenticated;

drop function if exists public.cancelar_negocio_supersu(uuid, text);

create function public.cancelar_negocio_supersu(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_reserva record;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado not in ('ACTIVO', 'SUSPENDIDO') then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'CANCELADO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  -- Terminal (04_Subscriptions_Lifecycle.md: "sin reactivación posible") —
  -- a diferencia de la suspensión, las campañas se FINALIZAN, no se pausan.
  update public.suscripcion set estado = 'CANCELADA', plan_codigo_destino = null, updated_at = now()
  where negocio_id = p_negocio_id;

  update public.campana_publicitaria set estado = 'FINALIZADA', updated_at = now()
  where negocio_id = p_negocio_id and estado in ('BORRADOR', 'ACTIVA', 'PAUSADA', 'AGOTADA');

  update public.lista_espera set estado = 'CANCELADA'
  where negocio_id = p_negocio_id and estado in ('ACTIVA', 'NOTIFICADA');

  for v_reserva in
    select id from public.reserva
    where negocio_id = p_negocio_id and estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and hora_inicio > now()
  loop
    perform public.cancelar_reserva(v_reserva.id, 'Negocio dado de baja: ' || p_motivo);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_CANCELADO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', v_negocio.estado), jsonb_build_object('estado', 'CANCELADO'));

  return v_negocio;
end;
$fn$;

grant execute on function public.cancelar_negocio_supersu(uuid, text) to authenticated;

-- Autoservicio de la propia Barbería (04_Subscriptions_Lifecycle.md:
-- "Solicitada por la Barbería o ejecutada por SuperSU") — mismo efecto de
-- cascada, factorizado para no duplicar la lógica.
create or replace function public.cancelar_negocio_propio(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_reserva record;
begin
  if not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado not in ('ACTIVO', 'SUSPENDIDO') then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'CANCELADO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  update public.suscripcion set estado = 'CANCELADA', plan_codigo_destino = null, updated_at = now()
  where negocio_id = p_negocio_id;

  update public.campana_publicitaria set estado = 'FINALIZADA', updated_at = now()
  where negocio_id = p_negocio_id and estado in ('BORRADOR', 'ACTIVA', 'PAUSADA', 'AGOTADA');

  update public.lista_espera set estado = 'CANCELADA'
  where negocio_id = p_negocio_id and estado in ('ACTIVA', 'NOTIFICADA');

  for v_reserva in
    select id from public.reserva
    where negocio_id = p_negocio_id and estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and hora_inicio > now()
  loop
    perform public.cancelar_reserva(v_reserva.id, 'Negocio dado de baja por su dueño: ' || p_motivo);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_CANCELADO', 'BARBERIA', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', v_negocio.estado), jsonb_build_object('estado', 'CANCELADO'));

  return v_negocio;
end;
$fn$;

grant execute on function public.cancelar_negocio_propio(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Fallos de cobro — lado manual de SuperSU (05_Billing_Failures.md).
--    El calendario automático Día 0/1/3/7/10 queda fuera de alcance (ver
--    encabezado); esto cubre lo que SÍ es real sin él: marcar EN_MORA a
--    mano (ej. la pasarela avisó un fallo por otro medio) y el Caso límite
--    explícito de "pagó por transferencia manual, SuperSU fuerza
--    reactivación" — ninguno de los dos depende del cobro recurrente.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.marcar_negocio_en_mora(p_negocio_id uuid, p_motivo text)
returns public.suscripcion
language plpgsql security definer set search_path = public as $fn$
declare
  v_suscripcion public.suscripcion;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  select * into v_suscripcion from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found or v_suscripcion.estado <> 'ACTIVA' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  -- 05_Billing_Failures.md Día 0: el Negocio sigue operando con normalidad
  -- durante EN_MORA — no se toca negocio.estado acá.
  update public.suscripcion
  set estado = 'EN_MORA', reintentos_fallo_count = reintentos_fallo_count + 1, updated_at = now()
  where negocio_id = p_negocio_id
  returning * into v_suscripcion;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('suscripcion', v_suscripcion.id, 'SUSCRIPCION_EN_MORA', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', 'ACTIVA'), jsonb_build_object('estado', 'EN_MORA'));

  return v_suscripcion;
end;
$fn$;

grant execute on function public.marcar_negocio_en_mora(uuid, text) to authenticated;

create or replace function public.forzar_reactivacion_pago_externo(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_suscripcion public.suscripcion;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  select * into v_suscripcion from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found or v_suscripcion.estado not in ('EN_MORA', 'SUSPENDIDA') then
    raise exception 'TRANSICION_INVALIDA';
  end if;
  if v_suscripcion.estado = 'SUSPENDIDA' and v_suscripcion.suspendido_causa = 'INFRACCION' then
    raise exception 'SUSPENSION_POR_INFRACCION_REQUIERE_REACTIVACION_EXPLICITA';
  end if;

  update public.suscripcion
  set estado = 'ACTIVA', suspendido_causa = null, reintentos_fallo_count = 0,
      fecha_proximo_cobro = now() + interval '30 days', updated_at = now()
  where negocio_id = p_negocio_id;

  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if v_negocio.estado = 'SUSPENDIDO' then
    update public.negocio set estado = 'ACTIVO', updated_at = now() where id = p_negocio_id
    returning * into v_negocio;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values ('suscripcion', v_suscripcion.id, 'REACTIVACION_FORZADA_PAGO_EXTERNO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', 'ACTIVA'));

  return v_negocio;
end;
$fn$;

grant execute on function public.forzar_reactivacion_pago_externo(uuid, text) to authenticated;
