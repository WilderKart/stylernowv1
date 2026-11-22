-- 173: Barberos adicionales (FASE 2A) — RPC del PROPIETARIO (cotizar, iniciar, renovar, cancelar renovación, consultar) y de servidor.
--
-- Permisos: SOLO el propietario (is_barberia_de). BUSINESS_ADMIN y cualquier otro rol reciben NO_AUTORIZADO. La autorización va
-- DENTRO de cada función con coalesce(...,false) (NULL no lanza). El precio sale SIEMPRE de la base (adicional_precio_plan); el
-- navegador solo envía cantidad y el total que vio, y si no coincide con el de la base se rechaza (PRECIO_CAMBIO).
-- Flujo manual por Checkout Pro: iniciar → pago SUSCRIPCION (concepto STAFF_EXTRA, beneficiario PLATAFORMA) → el servidor crea la
-- preferencia → el webhook/conciliación confirma con Mercado Pago (174). Nada se activa por lo que diga el frontend.
-- Rollback: 173_adicionales_rpc_propietario_REVERSION.sql.txt.

-- ── Validación y cotización comunes (interna) ───────────────────────────────────────────────────
create or replace function public._adicional_cotizacion(p_negocio_id uuid, p_cantidad int, p_excluir_lote uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.adicional_config; v_neg public.negocio; v_pais char(2); v_se text; v_precio numeric; v_moneda text;
  v_contratados int; v_fin timestamptz;
begin
  select * into c from public.adicional_config where id;
  if not c.habilitado then raise exception 'ADICIONALES_DESHABILITADOS'; end if;
  select * into v_neg from public.negocio where id = p_negocio_id;
  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if v_neg.estado <> 'ACTIVO' then raise exception 'NEGOCIO_NO_ACTIVO'; end if;
  select s.estado::text, coalesce(s.pais_codigo, 'CO') into v_se, v_pais from public.suscripcion s where s.negocio_id = p_negocio_id;
  if v_se is null or v_se not in ('ACTIVA', 'TRIAL') then raise exception 'SUSCRIPCION_NO_VIGENTE'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_cantidad > c.max_por_lote then raise exception 'MAXIMO_POR_LOTE_EXCEDIDO'; end if;
  select p.precio_mensual, p.moneda into v_precio, v_moneda from public.adicional_precio_plan p
   where p.pais_codigo = v_pais and p.plan_codigo = v_neg.plan_codigo and p.activo;
  if v_precio is null then raise exception 'ADICIONAL_SIN_PRECIO'; end if;
  select coalesce(sum(l.cantidad), 0)::int into v_contratados from public.adicional_lote l
   where l.negocio_id = p_negocio_id and (p_excluir_lote is null or l.id <> p_excluir_lote)
     and (l.estado in ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO', 'ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO')
          or (l.estado = 'CANCELADO' and l.vigente_hasta > now()));
  if v_contratados + p_cantidad > c.max_por_negocio then raise exception 'MAXIMO_POR_NEGOCIO_EXCEDIDO'; end if;
  v_fin := public.adicional_fin_periodo(now());
  return jsonb_build_object(
    'negocio_id', p_negocio_id, 'pais_codigo', v_pais, 'plan_codigo', v_neg.plan_codigo, 'cantidad', p_cantidad,
    'precio_unitario', v_precio, 'total', round(v_precio * p_cantidad, 2), 'moneda', v_moneda,
    'periodo_dias', c.periodo_dias, 'vence_si_paga_hoy', v_fin,
    'gracia_dias', c.gracia_dias, 'gracia_hasta', v_fin + make_interval(days => c.gracia_dias),
    'avisos_dias_antes', to_jsonb(c.avisos_dias_antes),
    'max_por_lote', c.max_por_lote, 'max_por_negocio', c.max_por_negocio, 'contratados', v_contratados,
    'puede_contratar_hasta', least(c.max_por_lote, c.max_por_negocio - v_contratados),
    'reembolso_automatico', false, 'cancelacion_efecto', 'FIN_PERIODO');
end $$;
revoke all on function public._adicional_cotizacion(uuid, int, uuid) from public, anon, authenticated;

create or replace function public.adicional_cotizar(p_negocio_id uuid, p_cantidad int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  return public._adicional_cotizacion(p_negocio_id, p_cantidad);
end $$;
revoke all on function public.adicional_cotizar(uuid, int) from public, anon, authenticated;
grant execute on function public.adicional_cotizar(uuid, int) to authenticated;

-- ── Iniciar la contratación (crea lote + pago pendiente; el servidor crea la preferencia) ──────────
create or replace function public.adicional_iniciar(p_negocio_id uuid, p_cantidad int, p_total_esperado numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cot jsonb; v_prev public.adicional_lote; v_lote public.adicional_lote; v_pago public.pago; v_total numeric; v_reutiliza boolean := false;
begin
  if auth.uid() is null or not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._cupo_bloquear(p_negocio_id);                               -- serializa contrataciones del negocio (máximos)

  -- Un checkout abierto reciente del mismo tamaño y precio se reutiliza (idempotente); cualquier otro abierto se cierra.
  for v_prev in select * from public.adicional_lote
                 where negocio_id = p_negocio_id and periodo_n = 0 and origen = 'CHECKOUT_PRO'
                   and estado in ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO') order by created_at desc loop
    v_cot := public._adicional_cotizacion(p_negocio_id, p_cantidad, v_prev.id);
    if v_prev.cantidad = p_cantidad and v_prev.precio_unitario = (v_cot ->> 'precio_unitario')::numeric
       and v_prev.estado = 'CHECKOUT_INICIADO' and v_prev.created_at > now() - interval '2 hours' and not v_reutiliza then
      v_reutiliza := true; v_lote := v_prev;
    else
      perform public._adicional_cerrar_checkout(v_prev.id, 'PROPIETARIO', auth.uid(), 'REEMPLAZADO_POR_NUEVA_CONTRATACION');
    end if;
  end loop;

  v_cot := public._adicional_cotizacion(p_negocio_id, p_cantidad, case when v_reutiliza then v_lote.id end);
  v_total := (v_cot ->> 'total')::numeric;
  if p_total_esperado is null or p_total_esperado <> v_total then raise exception 'PRECIO_CAMBIO'; end if;

  if v_reutiliza then
    select * into v_pago from public.pago where id = v_lote.pago_vigente_id;
    return jsonb_build_object('lote_id', v_lote.id, 'pago_id', v_pago.id, 'monto', v_pago.monto, 'reutilizado', true);
  end if;

  insert into public.adicional_lote (negocio_id, pais_codigo, plan_codigo, cantidad, precio_unitario, total, moneda, creado_por)
  values (p_negocio_id, v_cot ->> 'pais_codigo', (v_cot ->> 'plan_codigo')::public.plan_codigo, p_cantidad,
          (v_cot ->> 'precio_unitario')::numeric, v_total, v_cot ->> 'moneda', auth.uid())
  returning * into v_lote;
  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'SUSCRIPCION', v_total, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'STAFF_EXTRA', 'lote_id', v_lote.id, 'periodo_n', 1, 'cantidad', p_cantidad,
                             'precio_unitario', v_lote.precio_unitario))
  returning * into v_pago;
  insert into public.adicional_cobro (lote_id, negocio_id, periodo_n, monto, pago_id) values (v_lote.id, p_negocio_id, 1, v_total, v_pago.id);
  update public.adicional_lote set pago_vigente_id = v_pago.id where id = v_lote.id;
  perform public._adicional_historial(v_lote.id, 'CONTRATACION_INICIADA', 'PROPIETARIO', auth.uid(), null, v_pago.id, null,
                                      jsonb_build_object('cantidad', p_cantidad, 'precio_unitario', v_lote.precio_unitario, 'total', v_total));
  perform public._adicional_transicionar(v_lote.id, 'CHECKOUT_INICIADO', 'CHECKOUT_INICIADO', 'PROPIETARIO', auth.uid(), null, v_pago.id);
  return jsonb_build_object('lote_id', v_lote.id, 'pago_id', v_pago.id, 'monto', v_total, 'reutilizado', false);
end $$;
revoke all on function public.adicional_iniciar(uuid, int, numeric) from public, anon, authenticated;
grant execute on function public.adicional_iniciar(uuid, int, numeric) to authenticated;

-- Cierra un checkout sin pago (nunca ocupó cupo): lote → CANCELADO, cobro anulado, pago pendiente → RECHAZADO (un pago tardío
-- sobre él irá a la cola de revisión, no se pierde).
create or replace function public._adicional_cerrar_checkout(p_lote uuid, p_actor_tipo text, p_actor uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_l public.adicional_lote;
begin
  select * into v_l from public.adicional_lote where id = p_lote;
  if v_l.periodo_n = 0 and v_l.estado in ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO', 'PAGO_PENDIENTE') then
    perform public._adicional_transicionar(p_lote, case when p_actor_tipo = 'SISTEMA' then 'EXPIRADO_SIN_PAGO' else 'CANCELADO' end,
      case when p_actor_tipo = 'SISTEMA' then 'CHECKOUT_EXPIRADO' else 'CHECKOUT_CERRADO' end, p_actor_tipo, p_actor, p_motivo, v_l.pago_vigente_id);
  end if;
  update public.adicional_cobro set estado = 'ANULADO', updated_at = now() where lote_id = p_lote and estado = 'PENDIENTE';
  update public.pago set estado = 'RECHAZADO', motivo_reembolso = null, updated_at = now(), procesado_at = now(),
         metadata = metadata || jsonb_build_object('cerrado_por', p_motivo)
   where id in (select pago_id from public.adicional_cobro where lote_id = p_lote and estado = 'ANULADO') and estado = 'PENDIENTE';
end $$;
revoke all on function public._adicional_cerrar_checkout(uuid, text, uuid, text) from public, anon, authenticated;

-- El servidor no pudo crear la preferencia de Mercado Pago: se cierra lo recién abierto (el propietario puede reintentar).
create or replace function public.adicional_checkout_fallido_srv(p_lote_id uuid, p_actor uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_l public.adicional_lote;
begin
  select * into v_l from public.adicional_lote where id = p_lote_id;
  if not found or p_actor is null or not coalesce(exists (select 1 from public.negocio n where n.id = v_l.negocio_id and n.owner_user_id = p_actor), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  perform public._adicional_cerrar_checkout(p_lote_id, 'PROPIETARIO', p_actor, coalesce(p_motivo, 'PREFERENCIA_NO_CREADA'));
end $$;
revoke all on function public.adicional_checkout_fallido_srv(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.adicional_checkout_fallido_srv(uuid, uuid, text) to service_role;

-- ── Renovar (periodo siguiente, al precio CONGELADO del lote) ─────────────────────────────────────
create or replace function public.adicional_renovar(p_lote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_l public.adicional_lote; c public.adicional_config; v_pago public.pago; v_cobro public.adicional_cobro; v_se text; v_n int;
begin
  select * into v_l from public.adicional_lote where id = p_lote_id;
  if not found or auth.uid() is null or not coalesce(public.is_barberia_de(v_l.negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._cupo_bloquear(v_l.negocio_id);
  select * into v_l from public.adicional_lote where id = p_lote_id for update;
  select * into c from public.adicional_config where id;
  if not c.habilitado then raise exception 'ADICIONALES_DESHABILITADOS'; end if;
  if v_l.origen <> 'CHECKOUT_PRO' then raise exception 'LOTE_MANUAL_NO_RENOVABLE'; end if;
  if v_l.cancelar_renovacion or v_l.estado not in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO') then raise exception 'LOTE_NO_RENOVABLE'; end if;
  select s.estado::text into v_se from public.suscripcion s where s.negocio_id = v_l.negocio_id;
  if v_se is null or v_se = 'CANCELADA' then raise exception 'SUSCRIPCION_NO_VIGENTE'; end if;
  if v_l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') and public.adicional_dias_para(v_l.vigente_hasta) > coalesce((select max(x) from unnest(c.avisos_dias_antes) x), 0) then
    raise exception 'AUN_NO_TOCA_RENOVAR';
  end if;
  v_n := v_l.periodo_n + 1;

  -- Un cobro abierto del mismo periodo se reutiliza si es reciente; si es viejo se anula y se abre otro.
  select * into v_cobro from public.adicional_cobro where lote_id = p_lote_id and estado = 'PENDIENTE' order by created_at desc limit 1;
  if found then
    select * into v_pago from public.pago where id = v_cobro.pago_id;
    if v_pago.estado = 'PENDIENTE' and v_cobro.created_at > now() - interval '2 hours' and v_cobro.monto = v_l.total then
      return jsonb_build_object('lote_id', p_lote_id, 'pago_id', v_pago.id, 'monto', v_pago.monto, 'periodo_n', v_cobro.periodo_n, 'reutilizado', true);
    end if;
    update public.adicional_cobro set estado = 'ANULADO', updated_at = now() where id = v_cobro.id;
    update public.pago set estado = 'RECHAZADO', updated_at = now(), procesado_at = now(),
           metadata = metadata || jsonb_build_object('cerrado_por', 'REEMPLAZADO_POR_RENOVACION') where id = v_cobro.pago_id and estado = 'PENDIENTE';
  end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_l.negocio_id, 'SUSCRIPCION', v_l.total, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'STAFF_EXTRA', 'lote_id', v_l.id, 'periodo_n', v_n, 'cantidad', v_l.cantidad,
                             'precio_unitario', v_l.precio_unitario, 'renovacion', true))
  returning * into v_pago;
  insert into public.adicional_cobro (lote_id, negocio_id, periodo_n, monto, pago_id) values (v_l.id, v_l.negocio_id, v_n, v_l.total, v_pago.id);
  update public.adicional_lote set pago_vigente_id = v_pago.id where id = v_l.id;
  perform public._adicional_historial(v_l.id, 'RENOVACION_INICIADA', 'PROPIETARIO', auth.uid(), null, v_pago.id, null,
                                      jsonb_build_object('periodo_n', v_n, 'total', v_l.total), v_l.estado, v_l.estado, v_l.cantidad, v_l.cantidad);
  return jsonb_build_object('lote_id', p_lote_id, 'pago_id', v_pago.id, 'monto', v_pago.monto, 'periodo_n', v_n, 'reutilizado', false);
end $$;
revoke all on function public.adicional_renovar(uuid) from public, anon, authenticated;
grant execute on function public.adicional_renovar(uuid) to authenticated;

-- ── Cancelar renovación futura (el periodo ya pagado NO se reembolsa; el cupo dura hasta vigente_hasta) ─
create or replace function public.adicional_cancelar_renovacion(p_lote_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_l public.adicional_lote;
begin
  select * into v_l from public.adicional_lote where id = p_lote_id;
  if not found or auth.uid() is null or not coalesce(public.is_barberia_de(v_l.negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._cupo_bloquear(v_l.negocio_id);
  select * into v_l from public.adicional_lote where id = p_lote_id for update;
  if v_l.estado = 'CANCELADO' then return jsonb_build_object('lote_id', p_lote_id, 'estado', 'CANCELADO', 'ya_cancelado', true); end if;
  if v_l.estado = 'PAGO_PENDIENTE' then raise exception 'PAGO_EN_PROCESO'; end if;
  if v_l.estado in ('EXPIRADO_SIN_PAGO', 'REEMBOLSADO', 'PAGO_CONFIRMADO') then raise exception 'LOTE_NO_CANCELABLE'; end if;
  if v_l.periodo_n = 0 then
    perform public._adicional_cerrar_checkout(p_lote_id, 'PROPIETARIO', auth.uid(), coalesce(p_motivo, 'CANCELADO_POR_PROPIETARIO'));
  else
    -- Un cobro de renovación abierto se cierra; el cupo ya pagado se conserva hasta el fin del periodo.
    update public.adicional_cobro set estado = 'ANULADO', updated_at = now() where lote_id = p_lote_id and estado = 'PENDIENTE';
    update public.pago set estado = 'RECHAZADO', updated_at = now(), procesado_at = now(),
           metadata = metadata || jsonb_build_object('cerrado_por', 'RENOVACION_CANCELADA')
     where id in (select pago_id from public.adicional_cobro where lote_id = p_lote_id and estado = 'ANULADO') and estado = 'PENDIENTE';
    perform public._adicional_transicionar(p_lote_id, 'CANCELADO', 'RENOVACION_CANCELADA', 'PROPIETARIO', auth.uid(), p_motivo);
    perform public._adicional_notificar(p_lote_id, 'ADICIONAL_CANCELADO', 'cancelado:' || v_l.periodo_n);
  end if;
  select * into v_l from public.adicional_lote where id = p_lote_id;
  return jsonb_build_object('lote_id', p_lote_id, 'estado', v_l.estado, 'cupo_hasta', v_l.vigente_hasta, 'ya_cancelado', false);
end $$;
revoke all on function public.adicional_cancelar_renovacion(uuid, text) from public, anon, authenticated;
grant execute on function public.adicional_cancelar_renovacion(uuid, text) to authenticated;

-- ── Consulta del propietario: capacidad, lotes, pagos ──────────────────────────────────────────────
create or replace function public.adicional_mis_lotes(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.adicional_config; v_max int; v_lotes jsonb; v_cap jsonb; v_precio jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from public.adicional_config where id;
  v_max := coalesce((select max(x) from unnest(c.avisos_dias_antes) x), 0);
  v_cap := public._capacidad_profesional(p_negocio_id);
  begin v_precio := public._adicional_cotizacion(p_negocio_id, 1); exception when others then v_precio := jsonb_build_object('error', sqlerrm); end;
  select coalesce(jsonb_agg(x order by (x ->> 'contratado_at') desc), '[]'::jsonb) into v_lotes from (
    select jsonb_build_object(
      'id', l.id, 'cantidad', l.cantidad, 'precio_unitario', l.precio_unitario, 'total', l.total, 'moneda', l.moneda,
      'estado', l.estado, 'estado_etiqueta', d.etiqueta_es, 'origen', l.origen,
      'contratado_at', l.contratado_at, 'inicio_periodo_at', l.inicio_periodo_at, 'vigente_hasta', l.vigente_hasta, 'gracia_fin', l.gracia_fin,
      'dias_para_vencer', case when l.vigente_hasta is null then null else public.adicional_dias_para(l.vigente_hasta) end,
      'periodo_n', l.periodo_n, 'cancelar_renovacion', l.cancelar_renovacion,
      'aporta_cupo', (l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') or (l.estado = 'EN_GRACIA' and l.gracia_fin > now()) or (l.estado = 'CANCELADO' and l.vigente_hasta > now())),
      'puede_renovar', (l.origen = 'CHECKOUT_PRO' and not l.cancelar_renovacion
                        and (l.estado in ('EN_GRACIA', 'SUSPENDIDO')
                             or (l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') and public.adicional_dias_para(l.vigente_hasta) <= v_max))),
      'puede_cancelar', (l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO', 'CHECKOUT_INICIADO', 'PENDIENTE_CONTRATACION')),
      'pago_pendiente_id', (select cb.pago_id from public.adicional_cobro cb where cb.lote_id = l.id and cb.estado = 'PENDIENTE' order by cb.created_at desc limit 1),
      'cobros', coalesce((select jsonb_agg(jsonb_build_object('id', cb.id, 'periodo_n', cb.periodo_n, 'monto', cb.monto, 'estado', cb.estado,
                           'creado_at', cb.created_at, 'periodo_desde', cb.periodo_desde, 'periodo_hasta', cb.periodo_hasta, 'mp_payment_id', cb.mp_payment_id)
                           order by cb.periodo_n desc, cb.created_at desc)
                          from public.adicional_cobro cb where cb.lote_id = l.id), '[]'::jsonb)) as x
    from public.adicional_lote l join public.adicional_estado_def d on d.codigo = l.estado
    where l.negocio_id = p_negocio_id and l.estado <> 'PENDIENTE_CONTRATACION') q;
  return jsonb_build_object('capacidad', v_cap, 'precio_actual', v_precio, 'lotes', v_lotes,
    'config', jsonb_build_object('gracia_dias', c.gracia_dias, 'periodo_dias', c.periodo_dias, 'avisos_dias_antes', to_jsonb(c.avisos_dias_antes),
                                 'max_por_lote', c.max_por_lote, 'max_por_negocio', c.max_por_negocio, 'habilitado', c.habilitado));
end $$;
revoke all on function public.adicional_mis_lotes(uuid) from public, anon, authenticated;
grant execute on function public.adicional_mis_lotes(uuid) to authenticated;

-- ── Webhook: Mercado Pago informa «pendiente» (solo servidor) ────────────────────────────────────────
create or replace function public.adicional_marcar_pago_pendiente_srv(p_pago_id uuid, p_id_transaccion text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_p public.pago; v_l public.adicional_lote;
begin
  select * into v_p from public.pago where id = p_pago_id;
  if not found or v_p.tipo <> 'SUSCRIPCION' or coalesce(v_p.metadata ->> 'concepto', '') <> 'STAFF_EXTRA' or v_p.estado <> 'PENDIENTE' then return false; end if;
  select * into v_l from public.adicional_lote where id = nullif(v_p.metadata ->> 'lote_id', '')::uuid and negocio_id = v_p.negocio_id;
  if not found or v_l.estado <> 'CHECKOUT_INICIADO' or v_l.pago_vigente_id is distinct from v_p.id then return false; end if;
  perform public._adicional_transicionar(v_l.id, 'PAGO_PENDIENTE', 'PAGO_PENDIENTE', 'WEBHOOK', null, null, v_p.id,
                                         jsonb_build_object('mp_ref', p_id_transaccion));
  return true;
end $$;
revoke all on function public.adicional_marcar_pago_pendiente_srv(uuid, text) from public, anon, authenticated;
grant execute on function public.adicional_marcar_pago_pendiente_srv(uuid, text) to service_role;
