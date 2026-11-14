-- 133 · Suscripción SaaS: prueba sin cobro automático + pago del plan por Checkout Pro + mora con gracia.
--
-- Decisión del propietario (2026-11-14): prueba gratuita sin tarjeta; al terminar, el dueño paga su plan por
-- Checkout Pro desde /panel/suscripcion; el webhook confirma el pago y activa la suscripción. Sin Preapproval ni
-- cobro recurrente, sin almacenar datos de tarjeta.
--
-- Separación de pagos: un `pago` tipo SUSCRIPCION siempre se cobra en la cuenta de StylerNow
-- (beneficiario_pago = PLATAFORMA, cuenta_cobro inmutable desde la 119); los cobros de reservas siguen en la
-- cuenta del negocio. Cada pago de plan lleva metadata.concepto = 'PLAN' y su propio id, estado y auditoría.
--
-- Ciclo de estados:
--   TRIAL ── vence ──▶ EN_MORA (gracia configurada; sigue recibiendo reservas) ── vence la gracia ──▶ REQUIERE_PLAN
--   ACTIVA ── vence el periodo pagado ──▶ EN_MORA (gracia) ── vence la gracia ──▶ SUSPENDIDA (IMPAGO)
--   cualquiera de esos ── pago aprobado ──▶ ACTIVA (periodo nuevo; los días ya pagados o de prueba no se pierden)
--
-- PREPARADA Y PROBADA EN LOCAL (tests/sql/suscripcion_133.sql). Aplicar en producción solo con autorización.

begin;
set local lock_timeout = '5s';

-- ── Precio del plan, calculado en la base (nunca lo envía el navegador) ──────────────────────────────
-- Mismas reglas que src/lib/planes/precios.ts: anual = mensual × meses pagados del país, sin descuento
-- fundador; mensual con el descuento fundador vigente. Planes "desde" requieren cotización.
create or replace function public._precio_plan_ciclo(p_negocio_id uuid, p_plan public.plan_codigo, p_ciclo text)
 returns numeric
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_pais character(2); v_precio numeric; v_desde boolean; v_meses int; v_pct numeric;
begin
  select coalesce(s.pais_codigo, 'CO') into v_pais from public.suscripcion s where s.negocio_id = p_negocio_id;
  select pp.precio_mensual, pp.es_desde into v_precio, v_desde
    from public.plan_precio pp where pp.plan_codigo = p_plan and pp.pais_codigo = coalesce(v_pais, 'CO') and pp.activo;
  if v_precio is null or v_precio <= 0 then raise exception 'PLAN_SIN_PRECIO'; end if;
  if v_desde then raise exception 'PLAN_REQUIERE_COTIZACION'; end if;
  if p_ciclo = 'ANUAL' then
    select anual_meses_pagados into v_meses from public.pais where codigo = coalesce(v_pais, 'CO');
    return round(v_precio * coalesce(v_meses, 12), 2);
  end if;
  select f.descuento_pct into v_pct from public.suscripcion_fundador f where f.negocio_id = p_negocio_id and f.estado = 'ACTIVO';
  return round(v_precio * (1 - least(greatest(coalesce(v_pct, 0), 0), 100) / 100), 2);
end
$function$;
revoke all on function public._precio_plan_ciclo(uuid, public.plan_codigo, text) from public, anon, authenticated;
grant execute on function public._precio_plan_ciclo(uuid, public.plan_codigo, text) to service_role;

-- ── El dueño solicita pagar (o renovar) su plan ─────────────────────────────────────────────────────
create or replace function public.solicitar_pago_plan(p_negocio_id uuid, p_plan_codigo public.plan_codigo default null, p_ciclo text default null)
 returns public.pago
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio public.negocio; v_s public.suscripcion; v_plan public.plan_codigo; v_ciclo text;
  v_pasarela text; v_monto numeric; v_pago public.pago;
begin
  select * into v_negocio from public.negocio where id = p_negocio_id;
  if not found or not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_negocio.estado <> 'ACTIVO' then raise exception 'NEGOCIO_NO_ACTIVO'; end if;

  select * into v_s from public.suscripcion where negocio_id = p_negocio_id for update;
  if not found then raise exception 'SUSCRIPCION_NO_ENCONTRADA'; end if;
  if v_s.estado = 'CANCELADA' then raise exception 'SUSCRIPCION_CANCELADA'; end if;
  if v_s.estado = 'SUSPENDIDA' and coalesce(v_s.suspendido_causa, 'IMPAGO') <> 'IMPAGO' then raise exception 'SUSPENDIDA_POR_INFRACCION'; end if;
  if v_s.activacion_manual then raise exception 'ACTIVACION_MANUAL_VIGENTE'; end if;
  -- Renovación anticipada: solo dentro de los 7 días previos al fin del periodo pagado.
  if v_s.estado = 'ACTIVA' and v_s.fecha_proximo_cobro is not null and v_s.fecha_proximo_cobro > now() + interval '7 days' then
    raise exception 'AUN_NO_TOCA_RENOVAR';
  end if;

  v_plan := coalesce(p_plan_codigo, v_s.plan_codigo);
  if v_plan is null then raise exception 'PLAN_REQUERIDO'; end if;
  v_ciclo := coalesce(p_ciclo, v_s.ciclo, 'MENSUAL');
  if v_ciclo not in ('MENSUAL', 'ANUAL') then raise exception 'CICLO_INVALIDO'; end if;

  select pasarela into v_pasarela from public.pais where codigo = coalesce(v_s.pais_codigo, 'CO');
  if coalesce(v_pasarela, '') not in ('MERCADOPAGO', 'MERCADO_PAGO') then raise exception 'PAIS_SIN_PASARELA'; end if;

  -- Idempotente: si ya hay un pago de plan pendiente igual, se reutiliza; si hay otro pago de suscripción
  -- pendiente (p. ej. un upgrade), no se abre un segundo cobro.
  select * into v_pago from public.pago
   where negocio_id = p_negocio_id and tipo = 'SUSCRIPCION' and estado = 'PENDIENTE'
   order by created_at desc limit 1;
  if found then
    if v_pago.metadata->>'concepto' = 'PLAN' and v_pago.metadata->>'plan_codigo_nuevo' = v_plan::text
       and v_pago.metadata->>'ciclo' = v_ciclo and v_pago.created_at > now() - interval '2 hours' then
      return v_pago;
    end if;
    raise exception 'PAGO_SUSCRIPCION_EN_PROCESO';
  end if;

  v_monto := public._precio_plan_ciclo(p_negocio_id, v_plan, v_ciclo);

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'SUSCRIPCION', v_monto, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', v_plan, 'plan_codigo_actual', v_s.plan_codigo,
                             'ciclo', v_ciclo, 'estado_previo', v_s.estado))
  returning * into v_pago;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('suscripcion', v_s.id, 'PAGO_PLAN_SOLICITADO', 'BARBERIA', auth.uid(), p_negocio_id,
          jsonb_build_object('pago_id', v_pago.id, 'plan_codigo', v_plan, 'ciclo', v_ciclo, 'monto', v_monto));
  return v_pago;
end
$function$;
revoke all on function public.solicitar_pago_plan(uuid, public.plan_codigo, text) from public, anon, authenticated;
grant execute on function public.solicitar_pago_plan(uuid, public.plan_codigo, text) to authenticated, service_role;

-- ── Pago de plan aprobado (lo confirma aplicar_evento_pago tras re-consultar Mercado Pago) ──────────
create or replace function public.trg_pago_plan_activar()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_s public.suscripcion; v_desde timestamptz; v_intervalo interval; v_plan public.plan_codigo; v_ciclo text;
begin
  select * into v_s from public.suscripcion where negocio_id = new.negocio_id for update;
  if not found then return null; end if;
  v_plan := (new.metadata->>'plan_codigo_nuevo')::public.plan_codigo;
  v_ciclo := coalesce(new.metadata->>'ciclo', v_s.ciclo, 'MENSUAL');
  v_intervalo := case v_ciclo when 'ANUAL' then interval '12 months' else interval '1 month' end;
  -- No se pierden días: si aún queda periodo pagado o de prueba, el nuevo empieza cuando termina.
  v_desde := case
    when v_s.estado = 'ACTIVA' and v_s.fecha_proximo_cobro > now() then v_s.fecha_proximo_cobro
    when v_s.estado = 'TRIAL' and v_s.prueba_fin > now() then v_s.prueba_fin
    else now() end;

  update public.suscripcion set
    estado = 'ACTIVA', plan_codigo = v_plan, ciclo = v_ciclo,
    fecha_inicio_ciclo = v_desde, fecha_proximo_cobro = v_desde + v_intervalo,
    gracia_fin = null, suspendido_causa = null, reintentos_fallo_count = 0, updated_at = now()
  where id = v_s.id;
  update public.negocio set plan_codigo = v_plan, updated_at = now() where id = new.negocio_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_antes, payload_despues)
  values ('suscripcion', v_s.id, 'PLAN_PAGADO', 'SISTEMA', new.negocio_id,
          jsonb_build_object('estado', v_s.estado, 'plan_codigo', v_s.plan_codigo, 'fecha_proximo_cobro', v_s.fecha_proximo_cobro),
          jsonb_build_object('pago_id', new.id, 'monto', new.monto, 'plan_codigo', v_plan, 'ciclo', v_ciclo,
                             'periodo_desde', v_desde, 'periodo_hasta', v_desde + v_intervalo));
  return null;
end
$function$;
revoke all on function public.trg_pago_plan_activar() from public, anon, authenticated;

drop trigger if exists trg_pago_plan_activar on public.pago;
create trigger trg_pago_plan_activar
  after update of estado on public.pago
  for each row
  when (new.tipo = 'SUSCRIPCION' and new.estado = 'APROBADO' and old.estado is distinct from 'APROBADO'
        and new.metadata->>'concepto' = 'PLAN')
  execute function public.trg_pago_plan_activar();

-- ── Mantenimiento diario: prueba y periodo vencidos pasan por la gracia antes de restringir ─────────
create or replace function public.mantenimiento_suscripciones()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_gracia int; v_prueba int := 0; v_periodo int := 0; v_sin_plan int := 0; v_susp int; v_fund int; v_manual int; r record;
begin
  select coalesce(suscripcion_gracia_dias, 3) into v_gracia from public.configuracion_plataforma where id;

  -- Prueba vencida (con o sin tarjeta: no hay cobro automático) → mora con gracia; sigue recibiendo reservas.
  for r in
    update public.suscripcion set estado = 'EN_MORA', gracia_fin = now() + make_interval(days => v_gracia), updated_at = now()
     where estado = 'TRIAL' and prueba_fin <= now() and not activacion_manual
    returning id, negocio_id
  loop
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id)
    values ('suscripcion', r.id, 'PRUEBA_VENCIDA_EN_GRACIA', 'SISTEMA', r.negocio_id);
    v_prueba := v_prueba + 1;
  end loop;

  -- Periodo pagado vencido sin renovación → mora con gracia.
  for r in
    update public.suscripcion set estado = 'EN_MORA', gracia_fin = now() + make_interval(days => v_gracia), updated_at = now()
     where estado = 'ACTIVA' and not activacion_manual and fecha_proximo_cobro is not null and fecha_proximo_cobro <= now()
    returning id, negocio_id
  loop
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id)
    values ('suscripcion', r.id, 'PERIODO_VENCIDO_EN_GRACIA', 'SISTEMA', r.negocio_id);
    v_periodo := v_periodo + 1;
  end loop;

  -- Gracia vencida sin haber pagado nunca un plan (venía de la prueba) → debe elegir y pagar un plan.
  update public.suscripcion s set estado = 'REQUIERE_PLAN', updated_at = now()
   where s.estado = 'EN_MORA' and s.gracia_fin is not null and s.gracia_fin < now()
     and not exists (select 1 from public.pago p where p.negocio_id = s.negocio_id and p.tipo = 'SUSCRIPCION'
                      and p.estado = 'APROBADO' and p.metadata->>'concepto' = 'PLAN');
  get diagnostics v_sin_plan = row_count;

  -- Gracia vencida de un plan que sí se había pagado → suspendida por impago (reactivable pagando).
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'IMPAGO', updated_at = now()
   where estado = 'EN_MORA' and gracia_fin is not null and gracia_fin < now();
  get diagnostics v_susp = row_count;

  update public.suscripcion_fundador set estado = 'FINALIZADO' where estado = 'ACTIVO' and fecha_fin <= now();
  get diagnostics v_fund = row_count;

  update public.suscripcion set estado = 'REQUIERE_PLAN', activacion_manual = false, prueba_inicio = null, prueba_fin = null
   where activacion_manual and manual_hasta is not null and manual_hasta <= now() and estado in ('TRIAL','ACTIVA');
  get diagnostics v_manual = row_count;

  return jsonb_build_object('pruebas_en_gracia', v_prueba, 'periodos_en_gracia', v_periodo,
                            'requieren_plan', v_sin_plan, 'suspendidas', v_susp,
                            'fundadores_finalizados', v_fund, 'manuales_vencidas', v_manual);
end
$function$;
revoke all on function public.mantenimiento_suscripciones() from public, anon, authenticated;
grant execute on function public.mantenimiento_suscripciones() to service_role;

commit;
