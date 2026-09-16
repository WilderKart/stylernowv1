-- StylerNow — Migración 068: AI OS (ADR-013) — AI Memory, Prompt Builder/
-- Library, y la 6ª rama de aplicar_evento_pago() para acreditar un
-- paquete de créditos IA al aprobarse el cobro.

-- ── AI Memory ────────────────────────────────────────────────────────────
create or replace function public.guardar_memoria_ia(p_negocio_id uuid, p_categoria text, p_contenido jsonb, p_sede_id uuid default null)
returns public.ai_memoria_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_version int;
  v_memoria public.ai_memoria_negocio;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.ai_memoria_negocio set vigente = false
  where negocio_id = p_negocio_id and categoria = p_categoria and coalesce(sede_id::text, '') = coalesce(p_sede_id::text, '') and vigente = true
  returning version into v_version;

  insert into public.ai_memoria_negocio (negocio_id, sede_id, categoria, contenido, version, creado_por)
  values (p_negocio_id, p_sede_id, p_categoria, p_contenido, coalesce(v_version, 0) + 1, auth.uid())
  returning * into v_memoria;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('ai_memoria_negocio', v_memoria.id, 'MEMORIA_IA_GUARDADA', 'BARBERIA', auth.uid(), p_negocio_id, jsonb_build_object('categoria', p_categoria, 'version', v_memoria.version));

  return v_memoria;
end;
$fn$;
grant execute on function public.guardar_memoria_ia(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.aprobar_memoria_ia(p_memoria_id uuid)
returns public.ai_memoria_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_memoria public.ai_memoria_negocio;
begin
  select * into v_memoria from public.ai_memoria_negocio where id = p_memoria_id;
  if not found or not public.is_barberia_de(v_memoria.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.ai_memoria_negocio set aprobado = true where id = p_memoria_id returning * into v_memoria;
  return v_memoria;
end;
$fn$;
grant execute on function public.aprobar_memoria_ia(uuid) to authenticated;

-- "Olvidar" = el Negocio puede borrar información de su propia memoria —
-- a diferencia del resto del proyecto (nunca se borra un movimiento
-- financiero/auditoría), acá SÍ se permite un DELETE real porque el
-- propio ADR-013 exige "el propietario podrá... olvidar información" como
-- una operación genuina de borrado, no un soft-delete disfrazado.
create or replace function public.olvidar_memoria_ia(p_memoria_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_memoria public.ai_memoria_negocio;
begin
  select * into v_memoria from public.ai_memoria_negocio where id = p_memoria_id;
  if not found or not public.is_barberia_de(v_memoria.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes)
  values ('ai_memoria_negocio', p_memoria_id, 'MEMORIA_IA_OLVIDADA', 'BARBERIA', auth.uid(), v_memoria.negocio_id, to_jsonb(v_memoria));

  delete from public.ai_memoria_negocio where id = p_memoria_id;
end;
$fn$;
grant execute on function public.olvidar_memoria_ia(uuid) to authenticated;

create or replace function public.restaurar_version_memoria_ia(p_memoria_id_historica uuid)
returns public.ai_memoria_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_historica public.ai_memoria_negocio;
  v_nueva public.ai_memoria_negocio;
  v_version_actual int;
begin
  select * into v_historica from public.ai_memoria_negocio where id = p_memoria_id_historica;
  if not found or not public.is_barberia_de(v_historica.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.ai_memoria_negocio set vigente = false
  where negocio_id = v_historica.negocio_id and categoria = v_historica.categoria
    and coalesce(sede_id::text, '') = coalesce(v_historica.sede_id::text, '') and vigente = true
  returning version into v_version_actual;

  insert into public.ai_memoria_negocio (negocio_id, sede_id, categoria, contenido, version, creado_por)
  values (v_historica.negocio_id, v_historica.sede_id, v_historica.categoria, v_historica.contenido, coalesce(v_version_actual, 0) + 1, auth.uid())
  returning * into v_nueva;

  return v_nueva;
end;
$fn$;
grant execute on function public.restaurar_version_memoria_ia(uuid) to authenticated;

create or replace function public.listar_memoria_ia(p_negocio_id uuid)
returns setof public.ai_memoria_negocio
language sql stable security definer set search_path = public as $fn$
  select * from public.ai_memoria_negocio
  where negocio_id = p_negocio_id and vigente = true and public.tiene_acceso_interno(p_negocio_id)
  order by categoria;
$fn$;
grant execute on function public.listar_memoria_ia(uuid) to authenticated;

create or replace function public.historial_memoria_ia(p_negocio_id uuid, p_categoria text)
returns setof public.ai_memoria_negocio
language sql stable security definer set search_path = public as $fn$
  select * from public.ai_memoria_negocio
  where negocio_id = p_negocio_id and categoria = p_categoria and public.tiene_acceso_interno(p_negocio_id)
  order by version desc;
$fn$;
grant execute on function public.historial_memoria_ia(uuid, text) to authenticated;

-- ── AI Prompt Builder / Library (arquitectura completa, sin Marketplace) ─
create or replace function public.crear_prompt_ia(p_negocio_id uuid, p_tipo text, p_categoria text, p_nombre text, p_contenido text, p_variables jsonb default '[]'::jsonb)
returns public.ai_prompt
language plpgsql security definer set search_path = public as $fn$
declare
  v_prompt public.ai_prompt;
begin
  if p_tipo not in ('PROPIO', 'COMPARTIDO') then raise exception 'TIPO_NO_PERMITIDO_DESDE_NEGOCIO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  insert into public.ai_prompt (tipo, negocio_id, categoria, nombre, contenido, variables, autor_id)
  values (p_tipo, p_negocio_id, p_categoria, p_nombre, p_contenido, p_variables, auth.uid())
  returning * into v_prompt;

  return v_prompt;
end;
$fn$;
grant execute on function public.crear_prompt_ia(uuid, text, text, text, text, jsonb) to authenticated;

create or replace function public.listar_prompts_ia(p_negocio_id uuid)
returns setof public.ai_prompt
language sql stable security definer set search_path = public as $fn$
  select * from public.ai_prompt
  where activo = true and (tipo = 'OFICIAL' or (negocio_id = p_negocio_id and public.tiene_acceso_interno(p_negocio_id)))
  order by tipo, nombre;
$fn$;
grant execute on function public.listar_prompts_ia(uuid) to authenticated;

create or replace function public.crear_prompt_oficial_ia(p_categoria text, p_nombre text, p_contenido text, p_variables jsonb default '[]'::jsonb)
returns public.ai_prompt
language plpgsql security definer set search_path = public as $fn$
declare
  v_prompt public.ai_prompt;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  insert into public.ai_prompt (tipo, negocio_id, categoria, nombre, contenido, variables, autor_id)
  values ('OFICIAL', null, p_categoria, p_nombre, p_contenido, p_variables, auth.uid())
  returning * into v_prompt;
  return v_prompt;
end;
$fn$;
grant execute on function public.crear_prompt_oficial_ia(text, text, text, jsonb) to authenticated;

-- ── aplicar_evento_pago() — 6ª rama: paquetes de créditos IA ────────────
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
  -- PAQUETE al aprobarse. Nunca toca Wallet/comisión ni Reserva.
  if v_pago.tipo = 'PAQUETE_CREDITOS_IA' then
    if p_estado = 'APROBADO' then
      update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload, procesado_at = now(), updated_at = now() where id = p_pago_id;

      insert into public.credito_ia_lote (negocio_id, origen, cantidad, cantidad_disponible, fecha_expiracion)
      values (v_pago.negocio_id, 'PAQUETE', (v_pago.metadata->>'creditos')::int, (v_pago.metadata->>'creditos')::int, now() + interval '365 days');

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
