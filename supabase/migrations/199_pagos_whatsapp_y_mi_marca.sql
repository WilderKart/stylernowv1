-- 199 · Pagos de la barbería a StylerNow por Mercado Pago: recargas de WhatsApp y add-on «Mi Marca».
--
-- Hasta ahora solo se podían pagar por Mercado Pago el plan, los barberos adicionales y los créditos de IA.
-- Esta migración deja pagables, con el mismo cobro directo 1 a 1 a la cuenta de la plataforma (sin split):
--   · Recargas de conversaciones de WhatsApp  → pago.tipo = 'PAQUETE_CONVERSACIONES_WHATSAPP'
--   · Add-on Mi Marca (mensual)               → pago.tipo = 'SUSCRIPCION' con metadata.concepto = 'MI_MARCA'
--
-- Qué hace:
--  1. whatsapp_iniciar_pago_recarga(compra): crea (o reutiliza) el cobro pendiente de una solicitud de recarga del propietario.
--  2. mi_marca_iniciar_pago(negocio): crea (o reutiliza) el cobro pendiente de Mi Marca al precio vigente del país.
--  3. _whatsapp_recarga_aplicar_pago / _mi_marca_aplicar_pago: aplican el resultado del pago (idempotentes), llamadas SOLO
--     desde aplicar_evento_pago (webhook firmado o conciliación): acreditan el lote de WhatsApp / activan Mi Marca un mes.
--  4. aplicar_evento_pago: ruta propia para esos dos conceptos (antes un pago de WhatsApp caería en la lógica de reservas).
--  5. Un cobro de Mi Marca pendiente no bloquea pagar ni mejorar el plan (mismo criterio que los barberos adicionales).
--
-- Reversión: ver 199_pagos_whatsapp_y_mi_marca_REVERSION.sql.txt. No toca datos existentes.

-- ── 1. Iniciar el cobro de una recarga de WhatsApp ───────────────────────────────────────────────────
create or replace function public.whatsapp_iniciar_pago_recarga(p_compra_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare c public.whatsapp_compra_recarga; v_pago public.pago;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into c from public.whatsapp_compra_recarga where id = p_compra_id for update;
  if not found then raise exception 'COMPRA_NO_ENCONTRADA'; end if;
  perform public._exigir_operativo(c.negocio_id);
  if not public.is_barberia_de(c.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if c.estado <> 'PENDIENTE_PAGO' then raise exception 'TRANSICION_INVALIDA'; end if;

  -- Reintento o doble clic: se reutiliza el cobro pendiente de esta misma solicitud.
  select * into v_pago from public.pago
   where tipo = 'PAQUETE_CONVERSACIONES_WHATSAPP' and estado = 'PENDIENTE' and negocio_id = c.negocio_id
     and metadata->>'compra_id' = c.id::text
   order by created_at desc limit 1;
  if found then return v_pago; end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (c.negocio_id, 'PAQUETE_CONVERSACIONES_WHATSAPP', c.precio, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('compra_id', c.id, 'conversaciones', c.conversaciones))
  returning * into v_pago;
  return v_pago;
end $fn$;
revoke all on function public.whatsapp_iniciar_pago_recarga(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_iniciar_pago_recarga(uuid) to authenticated;

-- ── 2. Iniciar el cobro de Mi Marca ──────────────────────────────────────────────────────────────────
create or replace function public.mi_marca_iniciar_pago(p_negocio_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare v_pais text; v_precio numeric; v_pago public.pago;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  perform public._exigir_operativo(p_negocio_id);
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  select pais_codigo into v_pais from public.negocio where id = p_negocio_id;
  select precio_mensual into v_precio from public.addon_precio where addon_codigo = 'MI_MARCA' and pais_codigo = v_pais;
  if v_precio is null or v_precio <= 0 then raise exception 'ADDON_SIN_PRECIO'; end if;

  select * into v_pago from public.pago
   where tipo = 'SUSCRIPCION' and estado = 'PENDIENTE' and negocio_id = p_negocio_id
     and metadata->>'concepto' = 'MI_MARCA'
   order by created_at desc limit 1;
  if found then return v_pago; end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'SUSCRIPCION', v_precio, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'MI_MARCA', 'addon_codigo', 'MI_MARCA', 'meses', 1))
  returning * into v_pago;
  return v_pago;
end $fn$;
revoke all on function public.mi_marca_iniciar_pago(uuid) from public, anon, authenticated;
grant execute on function public.mi_marca_iniciar_pago(uuid) to authenticated;

-- ── 3. Aplicar el resultado del pago (solo desde aplicar_evento_pago) ───────────────────────────────
create or replace function public._whatsapp_recarga_aplicar_pago(p_pago public.pago, p_id_transaccion text, p_estado public.pago_estado, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_compra_id uuid;
begin
  if p_pago.estado in ('APROBADO', 'RECHAZADO', 'REEMBOLSADO', 'REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', p_pago.estado);
  end if;
  begin v_compra_id := nullif(p_pago.metadata->>'compra_id', '')::uuid; exception when others then v_compra_id := null; end;

  if p_estado = 'RECHAZADO' then
    -- La solicitud sigue PENDIENTE_PAGO: la persona puede intentar de nuevo (se creará un cobro nuevo).
    update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
           payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago.id;
    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
  end if;
  if p_estado <> 'APROBADO' then return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO'); end if;

  if v_compra_id is null or p_pago.negocio_id is null then
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values ('pago', p_pago.id, 'WHATSAPP_PAGO_SIN_COMPRA', 'SISTEMA', p_pago.negocio_id, jsonb_build_object('id_transaccion', p_id_transaccion));
    return jsonb_build_object('procesado', false, 'motivo', 'COMPRA_NO_INDICADA', 'requiere_reembolso', false);
  end if;

  update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload,
         procesado_at = now(), updated_at = now() where id = p_pago.id;
  -- whatsapp_acreditar_recarga valida negocio, monto y que el pago no se haya usado en otra compra.
  perform public.whatsapp_acreditar_recarga(v_compra_id, p_pago.id);
  return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
end $fn$;
revoke all on function public._whatsapp_recarga_aplicar_pago(public.pago, text, public.pago_estado, jsonb) from public, anon, authenticated;

create or replace function public._mi_marca_aplicar_pago(p_pago public.pago, p_id_transaccion text, p_estado public.pago_estado, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_pais text; v_precio numeric; v_hasta timestamptz;
begin
  if p_pago.estado in ('APROBADO', 'RECHAZADO', 'REEMBOLSADO', 'REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', p_pago.estado);
  end if;
  if p_estado = 'RECHAZADO' then
    update public.pago set estado = 'RECHAZADO', id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
           payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago.id;
    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
  end if;
  if p_estado <> 'APROBADO' then return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO'); end if;

  -- El importe pagado debe cubrir el precio vigente: si no, no se activa y queda a revisión.
  select pais_codigo into v_pais from public.negocio where id = p_pago.negocio_id;
  select precio_mensual into v_precio from public.addon_precio where addon_codigo = 'MI_MARCA' and pais_codigo = v_pais;
  if p_pago.negocio_id is null or v_precio is null or p_pago.monto < v_precio then
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values ('pago', p_pago.id, 'MI_MARCA_PAGO_A_REVISION', 'SISTEMA', p_pago.negocio_id,
            jsonb_build_object('monto', p_pago.monto, 'precio', v_precio, 'id_transaccion', p_id_transaccion));
    return jsonb_build_object('procesado', false, 'motivo', 'IMPORTE_NO_COINCIDE', 'requiere_reembolso', false);
  end if;

  update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload,
         procesado_at = now(), updated_at = now() where id = p_pago.id;

  -- Activa un mes; si ya estaba vigente, extiende desde su vencimiento (no pierde días pagados).
  insert into public.negocio_addon (negocio_id, addon_codigo, cantidad, activo, desde, hasta)
  values (p_pago.negocio_id, 'MI_MARCA', 1, true, now(), now() + interval '1 month')
  on conflict (negocio_id, addon_codigo) do update
    set activo = true,
        desde = case when public.negocio_addon.activo and coalesce(public.negocio_addon.hasta, now()) > now() then public.negocio_addon.desde else now() end,
        hasta = greatest(coalesce(public.negocio_addon.hasta, now()), now()) + interval '1 month'
  returning hasta into v_hasta;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('negocio_addon', p_pago.negocio_id, 'MI_MARCA_ACTIVADA', 'SISTEMA', p_pago.negocio_id,
          jsonb_build_object('pago_id', p_pago.id, 'vigente_hasta', v_hasta));
  return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
end $fn$;
revoke all on function public._mi_marca_aplicar_pago(public.pago, text, public.pago_estado, jsonb) from public, anon, authenticated;

-- ── 4. aplicar_evento_pago: rutas propias para WhatsApp y Mi Marca ───────────────────────────────────
do $$
declare v_def text; v_nuevo text;
  v_a constant text := E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', ''UPGRADE'') not in (''PLAN'', ''UPGRADE'') then';
begin
  v_def := replace(pg_get_functiondef('public.aplicar_evento_pago(uuid,text,pago_estado,jsonb)'::regprocedure), E'\r', '');
  if position('_whatsapp_recarga_aplicar_pago' in v_def) > 0 then return; end if;   -- ya migrada
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA aplicar_evento_pago'; end if;
  v_nuevo := replace(v_def, v_a,
    E'  -- Recargas de WhatsApp y Mi Marca (migración 199): ruta propia, sin tocar la de reservas ni la del plan.\n'
    || E'  if v_pago.tipo = ''PAQUETE_CONVERSACIONES_WHATSAPP'' then\n'
    || E'    return public._whatsapp_recarga_aplicar_pago(v_pago, p_id_transaccion, p_estado, p_payload);\n'
    || E'  end if;\n'
    || E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', '''') = ''MI_MARCA'' then\n'
    || E'    return public._mi_marca_aplicar_pago(v_pago, p_id_transaccion, p_estado, p_payload);\n'
    || E'  end if;\n' || v_a);
  execute v_nuevo;
end $$;

-- ── 5. Un cobro de Mi Marca pendiente no bloquea pagar ni mejorar el plan ───────────────────────────
do $$
declare v_def text; v_nuevo text; v_f text;
  v_a constant text := '<> ''STAFF_EXTRA''';
begin
  foreach v_f in array array['public.solicitar_pago_plan(uuid,plan_codigo,text)', 'public.solicitar_upgrade_plan(uuid,plan_codigo)'] loop
    v_def := replace(pg_get_functiondef(v_f::regprocedure), E'\r', '');
    if position('MI_MARCA' in v_def) > 0 then continue; end if;
    if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', v_f; end if;
    v_nuevo := replace(v_def, v_a, 'not in (''STAFF_EXTRA'', ''MI_MARCA'')');
    execute v_nuevo;
  end loop;
end $$;
