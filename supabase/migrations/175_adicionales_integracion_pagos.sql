-- 175: Barberos adicionales (FASE 2A) — separación EXPLÍCITA por concepto en el flujo de pagos.
--
-- Hallazgos del diseño que esta migración corrige:
--  (2) aplicar_evento_pago, rama SUSCRIPCION, hacía plan_codigo = metadata.plan_codigo_nuevo: con un STAFF_EXTRA habría dejado el plan en NULL.
--  (3) solicitar_pago_plan (133) y solicitar_upgrade_plan (049) rechazaban cualquier pago SUSCRIPCION pendiente: un adicional pendiente
--      habría bloqueado pagar el plan.
-- Ahora: STAFF_EXTRA va por su ruta lógica (_adicional_aplicar_pago), independiente de PLAN/UPGRADE; el concepto desconocido no se aplica
-- ni se reembolsa (queda en auditoría); y los dos RPC de plan filtran por concepto.
--
-- _adicional_aplicar_pago NO se basa en el prefijo de la referencia: valida concepto, lote, negocio, cobro/periodo, importe esperado
-- (pago = cobro = lote), importe informado por Mercado Pago, estado del lote e id de transacción. Todo pago que no cuadre NO activa nada,
-- NO se reembolsa solo y entra a la cola adicional_pago_revision (auditada) para decisión humana.
-- Rollback: 175_adicionales_integracion_pagos_REVERSION.sql.txt.

create or replace function public._adicional_revisar_pago(p_pago public.pago, p_lote uuid, p_motivo text, p_mp_ref text, p_detalle jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.adicional_pago_revision (pago_id, lote_id, negocio_id, motivo, detalle)
  values (p_pago.id, (select l.id from public.adicional_lote l where l.id = p_lote), p_pago.negocio_id, p_motivo,
          coalesce(p_detalle, '{}'::jsonb) || jsonb_build_object('mp_ref', p_mp_ref, 'monto', p_pago.monto, 'lote_indicado', p_lote))
  on conflict (pago_id, motivo, coalesce(detalle ->> 'mp_ref', '')) do nothing
  returning id into v_id;
  if v_id is not null then      -- solo la primera vez: los reintentos del webhook no inflan la auditoría
    perform public._auditar('pago', p_pago.id, 'ADICIONAL_PAGO_EN_REVISION', p_pago.negocio_id, null,
                            jsonb_build_object('motivo', p_motivo, 'lote_id', p_lote, 'mp_ref', p_mp_ref), p_motivo);
  end if;
  return jsonb_build_object('procesado', false, 'motivo', 'ADICIONAL_EN_REVISION', 'detalle', p_motivo, 'requiere_reembolso', false);
end $$;
revoke all on function public._adicional_revisar_pago(public.pago, uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public._adicional_aplicar_pago(p_pago public.pago, p_id_transaccion text, p_estado public.pago_estado, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lote_id uuid; v_l public.adicional_lote; v_c public.adicional_cobro; v_ref text := nullif(btrim(p_id_transaccion), '');
  v_mp numeric; v_se text; v_primero boolean; v_desde timestamptz; v_hasta timestamptz; v_antes text; v_n int;
begin
  begin v_lote_id := nullif(p_pago.metadata ->> 'lote_id', '')::uuid; exception when others then v_lote_id := null; end;
  if p_pago.negocio_id is null or v_lote_id is null then
    return public._adicional_revisar_pago(p_pago, null, 'LOTE_NO_INDICADO', v_ref);
  end if;
  perform public._cupo_bloquear(p_pago.negocio_id);
  select * into v_l from public.adicional_lote where id = v_lote_id for update;
  if not found then return public._adicional_revisar_pago(p_pago, v_lote_id, 'LOTE_NO_ENCONTRADO', v_ref); end if;
  if v_l.negocio_id <> p_pago.negocio_id then return public._adicional_revisar_pago(p_pago, v_lote_id, 'LOTE_DE_OTRO_NEGOCIO', v_ref); end if;
  select * into v_c from public.adicional_cobro where pago_id = p_pago.id and lote_id = v_l.id;
  if not found then return public._adicional_revisar_pago(p_pago, v_lote_id, 'COBRO_NO_CORRESPONDE', v_ref); end if;
  if coalesce(p_pago.metadata ->> 'periodo_n', '') <> v_c.periodo_n::text then
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'PERIODO_NO_COINCIDE', v_ref);
  end if;
  if p_pago.monto <> v_c.monto or v_c.monto <> v_l.total then
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'IMPORTE_NO_COINCIDE', v_ref,
      jsonb_build_object('pago', p_pago.monto, 'cobro', v_c.monto, 'lote', v_l.total));
  end if;

  -- Pago ya cerrado: idempotencia, duplicados y pagos tardíos.
  if p_pago.estado in ('REEMBOLSADO', 'REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', p_pago.estado);
  end if;
  if p_pago.estado = 'APROBADO' then
    if p_estado <> 'APROBADO' or p_pago.id_transaccion_pasarela is not distinct from v_ref then
      return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', p_pago.estado);
    end if;
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'COBRO_DUPLICADO', v_ref);   -- otro pago de MP sobre el mismo cobro
  end if;
  if p_pago.estado = 'RECHAZADO' then
    if p_estado <> 'APROBADO' then return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', p_pago.estado); end if;
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'PAGO_TARDIO_SOBRE_COBRO_CERRADO', v_ref);
  end if;

  -- Pago PENDIENTE en nuestra base.
  if p_estado = 'RECHAZADO' then
    -- Un rechazo no cierra el cobro: Checkout Pro permite reintentar con otro medio sobre la misma preferencia.
    perform public._adicional_historial(v_l.id, 'PAGO_RECHAZADO_MP', 'WEBHOOK', null, null, p_pago.id, coalesce(v_ref, 'sin-id'),
      jsonb_build_object('status_detail', p_payload ->> 'status_detail'), v_l.estado, v_l.estado, v_l.cantidad, v_l.cantidad);
    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null, 'adicional', 'RECHAZO_REGISTRADO');
  end if;
  if p_estado <> 'APROBADO' then return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO'); end if;

  if v_ref is null then return public._adicional_revisar_pago(p_pago, v_lote_id, 'SIN_ID_PASARELA', v_ref); end if;
  begin v_mp := nullif(p_payload ->> 'transaction_amount', '')::numeric; exception when others then v_mp := null; end;
  if v_mp is not null and abs(round(p_pago.monto) - v_mp) > 1 then
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'IMPORTE_PASARELA_NO_COINCIDE', v_ref, jsonb_build_object('pasarela', v_mp));
  end if;
  if exists (select 1 from public.pago x where x.id_transaccion_pasarela = v_ref and x.id <> p_pago.id)
     or exists (select 1 from public.adicional_cobro x where x.mp_payment_id = v_ref and x.id <> v_c.id) then
    return public._adicional_revisar_pago(p_pago, v_lote_id, 'ID_PASARELA_YA_USADO', v_ref);
  end if;
  if v_c.estado <> 'PENDIENTE' then return public._adicional_revisar_pago(p_pago, v_lote_id, 'COBRO_NO_PENDIENTE', v_ref); end if;
  select s.estado::text into v_se from public.suscripcion s where s.negocio_id = p_pago.negocio_id;
  if v_se is null or v_se = 'CANCELADA' then return public._adicional_revisar_pago(p_pago, v_lote_id, 'SUSCRIPCION_PRINCIPAL_CANCELADA', v_ref); end if;

  v_primero := (v_c.periodo_n = 1 and v_l.periodo_n = 0);
  if v_primero then
    if v_l.estado not in ('CHECKOUT_INICIADO', 'PAGO_PENDIENTE') then
      return public._adicional_revisar_pago(p_pago, v_lote_id, 'LOTE_ESTADO_INVALIDO', v_ref, jsonb_build_object('estado', v_l.estado));
    end if;
  else
    if v_c.periodo_n <> v_l.periodo_n + 1 or v_l.estado not in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO') or v_l.cancelar_renovacion then
      return public._adicional_revisar_pago(p_pago, v_lote_id, 'LOTE_ESTADO_INVALIDO', v_ref, jsonb_build_object('estado', v_l.estado));
    end if;
  end if;

  -- ── Todo cuadra: se confirma el pago y se activan SOLO los cupos de este lote ──
  update public.pago set estado = 'APROBADO', id_transaccion_pasarela = v_ref, payload_pasarela = p_payload, procesado_at = now(), updated_at = now()
   where id = p_pago.id;
  v_antes := v_l.estado;
  if v_primero then
    perform public._adicional_transicionar(v_l.id, 'PAGO_CONFIRMADO', 'PAGO_CONFIRMADO', 'WEBHOOK', null, null, p_pago.id, jsonb_build_object('mp_ref', v_ref));
    v_desde := now();
  else
    v_desde := case when v_antes in ('ACTIVO', 'PROXIMO_A_RENOVAR') and v_l.vigente_hasta > now() then v_l.vigente_hasta else now() end;  -- no se pierden días pagados
  end if;
  v_hasta := public.adicional_fin_periodo(v_desde);
  update public.adicional_lote set inicio_periodo_at = v_desde, vigente_hasta = v_hasta, periodo_n = v_c.periodo_n, gracia_fin = null,
         ultimo_aviso_dias = null, pago_vigente_id = null where id = v_l.id;
  update public.adicional_cobro set estado = 'APROBADO', mp_payment_id = v_ref, periodo_desde = v_desde, periodo_hasta = v_hasta, updated_at = now() where id = v_c.id;
  if v_primero or v_antes <> 'ACTIVO' then
    perform public._adicional_transicionar(v_l.id, 'ACTIVO',
      case when v_primero then 'ACTIVADO' when v_antes in ('EN_GRACIA', 'SUSPENDIDO') then 'REACTIVADO' else 'RENOVADO' end,
      'WEBHOOK', null, null, p_pago.id, jsonb_build_object('mp_ref', v_ref, 'periodo_n', v_c.periodo_n, 'vigente_hasta', v_hasta));
  else
    perform public._adicional_historial(v_l.id, 'RENOVADO', 'WEBHOOK', null, null, p_pago.id, v_ref,
      jsonb_build_object('periodo_n', v_c.periodo_n, 'vigente_hasta', v_hasta), 'ACTIVO', 'ACTIVO', v_l.cantidad, v_l.cantidad);
  end if;
  perform public._adicional_notificar(v_l.id,
    case when v_primero then 'ADICIONAL_ACTIVADO' when v_antes in ('EN_GRACIA', 'SUSPENDIDO') then 'ADICIONAL_REACTIVADO' else 'ADICIONAL_RENOVADO' end,
    'pago:' || v_c.periodo_n::text);
  perform public._auditar('pago', p_pago.id, 'ADICIONAL_PAGO_APLICADO', p_pago.negocio_id, null,
    jsonb_build_object('lote_id', v_l.id, 'cantidad', v_l.cantidad, 'periodo_n', v_c.periodo_n, 'vigente_hasta', v_hasta, 'mp_ref', v_ref), null);
  return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null, 'adicional', 'ACTIVADO', 'lote_id', v_l.id);
end $$;
revoke all on function public._adicional_aplicar_pago(public.pago, text, public.pago_estado, jsonb) from public, anon, authenticated;

-- ── aplicar_evento_pago: ruta propia para STAFF_EXTRA; concepto desconocido no se aplica ──────────────
do $$
declare v_def text; v_nuevo text;
  v_a constant text := E'  if v_pago.estado in (''APROBADO'',''RECHAZADO'',''REEMBOLSADO'',''REEMBOLSADO_PARCIAL'') then';
begin
  v_def := pg_get_functiondef('public.aplicar_evento_pago(uuid,text,pago_estado,jsonb)'::regprocedure);
  if position('_adicional_aplicar_pago' in v_def) > 0 then return; end if;   -- ya migrada
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA aplicar_evento_pago'; end if;
  v_nuevo := replace(v_def, v_a,
    E'  -- Barberos adicionales (migración 175): ruta lógica propia, sin tocar la del plan.\n'
    || E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', '''') = ''STAFF_EXTRA'' then\n'
    || E'    return public._adicional_aplicar_pago(v_pago, p_id_transaccion, p_estado, p_payload);\n'
    || E'  end if;\n'
    || E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', ''UPGRADE'') not in (''PLAN'', ''UPGRADE'') then\n'
    || E'    if not exists (select 1 from public.evento_auditoria where entidad_id = p_pago_id and accion = ''PAGO_CONCEPTO_DESCONOCIDO'') then\n'
    || E'      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)\n'
    || E'      values (''pago'', p_pago_id, ''PAGO_CONCEPTO_DESCONOCIDO'', ''SISTEMA'', v_pago.negocio_id, jsonb_build_object(''concepto'', v_pago.metadata->>''concepto'', ''id_transaccion'', p_id_transaccion));\n'
    || E'    end if;\n'
    || E'    return jsonb_build_object(''procesado'', false, ''motivo'', ''CONCEPTO_DESCONOCIDO'', ''requiere_reembolso'', false);\n'
    || E'  end if;\n\n' || v_a);
  execute v_nuevo;
end $$;

-- ── Un adicional pendiente no bloquea pagar ni mejorar el plan ───────────────────────────────────
do $$
declare v_def text; v_nuevo text; v_f text;
  v_a constant text := 'tipo = ''SUSCRIPCION'' and estado = ''PENDIENTE''';
begin
  foreach v_f in array array['public.solicitar_pago_plan(uuid,plan_codigo,text)', 'public.solicitar_upgrade_plan(uuid,plan_codigo)'] loop
    v_def := pg_get_functiondef(v_f::regprocedure);
    if position('STAFF_EXTRA' in v_def) > 0 then continue; end if;
    if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', v_f; end if;
    v_nuevo := replace(v_def, v_a, v_a || ' and coalesce(metadata->>''concepto'', '''') <> ''STAFF_EXTRA''');
    execute v_nuevo;
  end loop;
end $$;
