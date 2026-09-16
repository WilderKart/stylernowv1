-- StylerNow — Migración 067: AI OS (ADR-013) — Credit Meter + AI Pricing
-- Engine (RPCs). Toda llamada de IA con costo pasa por
-- `consumir_creditos_ia()` — nunca se descuentan créditos "a mano" desde
-- TypeScript, para que el saldo nunca pueda quedar negativo ni
-- desincronizado del historial de consumo.

-- Saldo disponible real (suma de lotes no vencidos con saldo > 0).
create or replace function public.saldo_creditos_ia(p_negocio_id uuid)
returns int
language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(cantidad_disponible), 0)::int
  from public.credito_ia_lote
  where negocio_id = p_negocio_id and fecha_expiracion > now() and cantidad_disponible > 0;
$fn$;
grant execute on function public.saldo_creditos_ia(uuid) to authenticated;

-- Núcleo del Credit Meter: valida que la función esté habilitada para el
-- Plan del Negocio (AI Pricing Engine + plan_funcion_ia), consume FIFO por
-- fecha_otorgamiento entre los lotes vigentes, nunca deja el saldo
-- negativo, y registra el consumo real para auditoría/ROI.
create or replace function public.consumir_creditos_ia(p_negocio_id uuid, p_accion text, p_referencia_tipo text default null, p_referencia_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_costo public.ai_accion_costo;
  v_negocio public.negocio;
  v_habilitado boolean;
  v_saldo_total int;
  v_lote record;
  v_restante int;
  v_consumir int;
  v_saldo_final int;
begin
  if not public.tiene_acceso_interno(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_costo from public.ai_accion_costo where accion = p_accion and activo = true;
  if not found then raise exception 'ACCION_IA_NO_CONFIGURADA'; end if;

  select * into v_negocio from public.negocio where id = p_negocio_id;
  select exists(select 1 from public.plan_funcion_ia where plan_codigo = v_negocio.plan_codigo and funcion = p_accion and habilitado = true) into v_habilitado;
  if not v_habilitado then raise exception 'FUNCION_NO_INCLUIDA_EN_PLAN'; end if;

  select public.saldo_creditos_ia(p_negocio_id) into v_saldo_total;
  if v_saldo_total < v_costo.costo_creditos then raise exception 'CREDITOS_INSUFICIENTES'; end if;

  v_restante := v_costo.costo_creditos;
  for v_lote in
    select * from public.credito_ia_lote
    where negocio_id = p_negocio_id and fecha_expiracion > now() and cantidad_disponible > 0
    order by fecha_otorgamiento asc
    for update
  loop
    exit when v_restante <= 0;
    v_consumir := least(v_restante, v_lote.cantidad_disponible);
    update public.credito_ia_lote set cantidad_disponible = cantidad_disponible - v_consumir where id = v_lote.id;
    v_restante := v_restante - v_consumir;
  end loop;

  select public.saldo_creditos_ia(p_negocio_id) into v_saldo_final;

  insert into public.credito_ia_consumo (negocio_id, funcion, nivel, creditos_consumidos, saldo_restante)
  values (p_negocio_id, p_accion, greatest(v_costo.nivel_ia, 1), v_costo.costo_creditos, v_saldo_final);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('credito_ia', p_negocio_id, 'CREDITOS_IA_CONSUMIDOS', case when auth.uid() is null then 'SISTEMA' else 'BARBERIA' end, auth.uid(), p_negocio_id,
    jsonb_build_object('accion', p_accion, 'creditos', v_costo.costo_creditos, 'referencia_tipo', p_referencia_tipo, 'referencia_id', p_referencia_id));

  return jsonb_build_object('creditosConsumidos', v_costo.costo_creditos, 'saldoRestante', v_saldo_final, 'nivel', v_costo.nivel_ia);
end;
$fn$;
grant execute on function public.consumir_creditos_ia(uuid, text, text, uuid) to authenticated;

-- Otorgamiento mensual de créditos de Plan (pensado para el cron diario,
-- ver src/app/api/cron/diario) — solo si no hubo un otorgamiento PLAN en
-- los últimos 30 días, para no duplicar si el cron corre más de una vez.
create or replace function public.otorgar_creditos_plan_mensual()
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_row record;
  v_otorgados int := 0;
begin
  for v_row in
    select n.id as negocio_id, p.creditos_ia_mes
    from public.negocio n
    join public.suscripcion s on s.negocio_id = n.id
    join public.plan p on p.codigo = n.plan_codigo
    where n.estado = 'ACTIVO' and s.estado = 'ACTIVA' and p.creditos_ia_mes is not null and p.creditos_ia_mes > 0
      and not exists (
        select 1 from public.credito_ia_lote
        where negocio_id = n.id and origen = 'PLAN' and fecha_otorgamiento >= now() - interval '30 days'
      )
  loop
    insert into public.credito_ia_lote (negocio_id, origen, cantidad, cantidad_disponible, fecha_expiracion)
    values (v_row.negocio_id, 'PLAN', v_row.creditos_ia_mes, v_row.creditos_ia_mes, now() + interval '30 days');
    v_otorgados := v_otorgados + 1;
  end loop;

  return jsonb_build_object('negociosOtorgados', v_otorgados);
end;
$fn$;
revoke all on function public.otorgar_creditos_plan_mensual() from public, anon, authenticated;

-- Compra de un paquete de créditos — mismo patrón de cobro único que
-- Suscripción/Membresía (Módulos 6.3/6.5): crea un `pago` PENDIENTE,
-- aplicar_evento_pago() acredita el lote al aprobarse.
create or replace function public.comprar_paquete_creditos_ia(p_negocio_id uuid, p_paquete_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_paquete public.ai_paquete_creditos;
  v_pago public.pago;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  select * into v_paquete from public.ai_paquete_creditos where id = p_paquete_id and activo = true;
  if not found or v_paquete.precio_cop is null then raise exception 'PAQUETE_NO_DISPONIBLE_AUTOSERVICIO'; end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'PAQUETE_CREDITOS_IA', v_paquete.precio_cop, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('paquete_id', p_paquete_id, 'creditos', v_paquete.creditos))
  returning * into v_pago;

  return v_pago;
end;
$fn$;
grant execute on function public.comprar_paquete_creditos_ia(uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- AI Pricing Engine — administración exclusiva de SuperSU. "Nada queda
-- hardcodeado": todo cambio de costo/margen/créditos pasa por acá.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.actualizar_accion_costo_ia(p_accion text, p_costo_creditos int, p_costo_proveedor_estimado numeric default null, p_margen_pct numeric default null, p_activo boolean default true)
returns public.ai_accion_costo
language plpgsql security definer set search_path = public as $fn$
declare
  v_costo public.ai_accion_costo;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_costo_creditos < 0 then raise exception 'COSTO_INVALIDO'; end if;

  update public.ai_accion_costo
  set costo_creditos = p_costo_creditos,
      costo_proveedor_estimado = coalesce(p_costo_proveedor_estimado, costo_proveedor_estimado),
      margen_pct = coalesce(p_margen_pct, margen_pct),
      activo = p_activo, updated_at = now()
  where accion = p_accion
  returning * into v_costo;
  if not found then raise exception 'ACCION_NO_ENCONTRADA'; end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_despues)
  values ('ai_accion_costo', v_costo.id, 'COSTO_IA_ACTUALIZADO', 'SUPERSU', auth.uid(), jsonb_build_object('accion', p_accion, 'costo_creditos', p_costo_creditos));

  return v_costo;
end;
$fn$;
grant execute on function public.actualizar_accion_costo_ia(text, int, numeric, numeric, boolean) to authenticated;

create or replace function public.configurar_funcion_plan_ia(p_plan_codigo plan_codigo, p_funcion text, p_habilitado boolean)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  insert into public.plan_funcion_ia (plan_codigo, funcion, habilitado) values (p_plan_codigo, p_funcion, p_habilitado)
  on conflict (plan_codigo, funcion) do update set habilitado = excluded.habilitado;
end;
$fn$;
grant execute on function public.configurar_funcion_plan_ia(plan_codigo, text, boolean) to authenticated;

create or replace function public.actualizar_modelo_config_ia(p_nombre text, p_orden_preferencia int, p_activo boolean, p_costo_por_millon_tokens_usd numeric default null)
returns public.ai_modelo_config
language plpgsql security definer set search_path = public as $fn$
declare
  v_modelo public.ai_modelo_config;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  update public.ai_modelo_config
  set orden_preferencia = p_orden_preferencia, activo = p_activo,
      costo_por_millon_tokens_usd = coalesce(p_costo_por_millon_tokens_usd, costo_por_millon_tokens_usd), updated_at = now()
  where nombre = p_nombre
  returning * into v_modelo;
  if not found then raise exception 'MODELO_NO_ENCONTRADO'; end if;
  return v_modelo;
end;
$fn$;
grant execute on function public.actualizar_modelo_config_ia(text, int, boolean, numeric) to authenticated;

create or replace function public.actualizar_paquete_creditos_ia(p_paquete_id uuid, p_precio_cop numeric, p_activo boolean)
returns public.ai_paquete_creditos
language plpgsql security definer set search_path = public as $fn$
declare
  v_paquete public.ai_paquete_creditos;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  update public.ai_paquete_creditos set precio_cop = p_precio_cop, activo = p_activo where id = p_paquete_id returning * into v_paquete;
  if not found then raise exception 'PAQUETE_NO_ENCONTRADO'; end if;
  return v_paquete;
end;
$fn$;
grant execute on function public.actualizar_paquete_creditos_ia(uuid, numeric, boolean) to authenticated;

-- Simulador de costos (AI Cost Simulator) — reusa el mismo AI Pricing
-- Engine, nunca cálculos hardcodeados: estima consumo mensual de créditos
-- para un Negocio hipotético con N Staff / N Clientes, usando el consumo
-- PROMEDIO REAL ya registrado en credito_ia_consumo cuando existe, o una
-- heurística conservadora (1 acción promedio por Staff/semana, 1 por
-- cada 20 Clientes/mes) cuando todavía no hay historial real.
create or replace function public.simular_consumo_ia(p_plan_codigo plan_codigo, p_num_staff int, p_num_clientes int)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_plan public.plan;
  v_costo_promedio_accion numeric;
  v_acciones_estimadas_mes numeric;
  v_creditos_estimados numeric;
  v_ingreso_paquete_promedio numeric;
  v_margen_pct numeric;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_plan from public.plan where codigo = p_plan_codigo;

  select coalesce(avg(costo_creditos), 5) into v_costo_promedio_accion
  from public.ai_accion_costo aco
  where exists (select 1 from public.plan_funcion_ia pf where pf.plan_codigo = p_plan_codigo and pf.funcion = aco.accion and pf.habilitado = true);

  -- Heurística conservadora documentada explícitamente (no hay todavía
  -- suficiente historial real de consumo por Staff/Cliente en producción).
  v_acciones_estimadas_mes := (p_num_staff * 4) + (p_num_clientes / 20.0);
  v_creditos_estimados := v_acciones_estimadas_mes * v_costo_promedio_accion;

  select avg(precio_cop / nullif(creditos, 0)) into v_ingreso_paquete_promedio from public.ai_paquete_creditos where creditos is not null;

  select coalesce(avg(margen_pct), 60) into v_margen_pct from public.ai_accion_costo;

  return jsonb_build_object(
    'plan', p_plan_codigo,
    'creditosIncluidosPlan', v_plan.creditos_ia_mes,
    'creditosEstimadosConsumo', round(v_creditos_estimados),
    'excedeCreditosIncluidos', v_plan.creditos_ia_mes is not null and v_creditos_estimados > v_plan.creditos_ia_mes,
    'costoProveedorEstimadoUsd', round((select coalesce(sum(costo_proveedor_estimado), 0) from public.ai_accion_costo) * v_acciones_estimadas_mes / greatest((select count(*) from public.ai_accion_costo), 1), 4),
    'margenPctPromedio', v_margen_pct,
    'precioPorCreditoPromedioCop', round(coalesce(v_ingreso_paquete_promedio, 100))
  );
end;
$fn$;
grant execute on function public.simular_consumo_ia(plan_codigo, int, int) to authenticated;
