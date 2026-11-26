-- 200 · Publicidad con saldo prepagado por Mercado Pago y sedes adicionales de pago.
--
-- 1) PUBLICIDAD. Hasta ahora el gasto de las campañas se descontaba del Wallet de comisiones, dinero que no entra a StylerNow.
--    Ahora la barbería RECARGA un saldo publicitario propio pagando por Mercado Pago (cuenta de la plataforma, cobro directo) y las
--    campañas consumen de ese saldo por clic o impresión. Cuando el saldo no alcanza, la campaña pasa a AGOTADA; al recargar se
--    reactiva. El saldo no vence por mes: dura lo que dure el consumo.
--      · ads_paquete_recarga  → montos de recarga (editable por SuperSU/SQL)
--      · ads_saldo / ads_saldo_movimiento → saldo y libro de movimientos (solo lectura para el dueño)
--      · ads_iniciar_recarga(negocio, paquete) → cobro pendiente (pago.tipo SUSCRIPCION, concepto ADS_RECARGA)
--      · activar_campana / registrar_clic_patrocinado / registrar_impresion_patrocinada → consumen de ads_saldo
-- 2) SEDES ADICIONALES. Una sede por encima de las del plan se paga cada mes (Essential y Studio 90.000, Prestige 50.000), con tope
--    por plan (Essential 1, Studio 2, Prestige 5): quien necesite más sube de plan.
--      · negocio_addon SEDE_EXTRA (cantidad, hasta) + limite_sedes_negocio() = sedes del plan + extras vigentes
--      · sede_extra_iniciar_pago(negocio, modo) → AGREGAR una sede extra / RENOVAR el mes de las existentes
--      · crear_sede y cupo_plan_negocio usan el límite efectivo
-- Ambos conceptos viajan en pago.tipo = 'SUSCRIPCION' con metadata.concepto y se aplican desde aplicar_evento_pago (idempotente).
-- Reversión: ver 200_publicidad_saldo_prepagado_y_sedes_extra_REVERSION.sql.txt.

-- ── Precios de sede adicional (COP) ──────────────────────────────────────────────────────────────────
update public.plan set sede_addon_precio = 90000 where codigo in ('ESSENTIAL', 'STUDIO');
update public.plan set sede_addon_precio = 50000 where codigo = 'PRESTIGE';

-- ── 1. Publicidad: tablas ────────────────────────────────────────────────────────────────────────────
create table if not exists public.ads_paquete_recarga (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  monto_cop numeric(12,2) not null check (monto_cop >= 10000),
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.ads_paquete_recarga (nombre, monto_cop, orden)
select v.nombre, v.monto, v.orden
from (values ('Recarga 50.000', 50000::numeric, 1), ('Recarga 100.000', 100000::numeric, 2), ('Recarga 200.000', 200000::numeric, 3)) as v(nombre, monto, orden)
where not exists (select 1 from public.ads_paquete_recarga);
alter table public.ads_paquete_recarga enable row level security;
drop policy if exists ads_paquete_select on public.ads_paquete_recarga;
create policy ads_paquete_select on public.ads_paquete_recarga for select to authenticated using (activo or public.is_supersu());
revoke all on public.ads_paquete_recarga from public, anon, authenticated;
grant select on public.ads_paquete_recarga to authenticated;

create table if not exists public.ads_saldo (
  negocio_id uuid primary key references public.negocio(id),
  saldo_disponible numeric(14,4) not null default 0 check (saldo_disponible >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.ads_saldo_movimiento (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  tipo text not null check (tipo in ('RECARGA', 'CAMPANA', 'AJUSTE')),
  monto numeric(14,4) not null,
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ads_saldo_mov_negocio_idx on public.ads_saldo_movimiento (negocio_id, created_at desc);
alter table public.ads_saldo enable row level security;
alter table public.ads_saldo_movimiento enable row level security;
drop policy if exists ads_saldo_select on public.ads_saldo;
create policy ads_saldo_select on public.ads_saldo for select to authenticated using (public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists ads_saldo_mov_select on public.ads_saldo_movimiento;
create policy ads_saldo_mov_select on public.ads_saldo_movimiento for select to authenticated using (public.is_barberia_de(negocio_id) or public.is_supersu());
revoke all on public.ads_saldo, public.ads_saldo_movimiento from public, anon, authenticated;
grant select on public.ads_saldo, public.ads_saldo_movimiento to authenticated;

-- ── 1b. Publicidad: iniciar recarga y aplicar el pago ────────────────────────────────────────────────
create or replace function public.ads_iniciar_recarga(p_negocio_id uuid, p_paquete_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare k public.ads_paquete_recarga; v_pago public.pago;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  perform public._exigir_operativo(p_negocio_id);
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  select * into k from public.ads_paquete_recarga where id = p_paquete_id and activo;
  if not found then raise exception 'PAQUETE_NO_DISPONIBLE'; end if;

  select * into v_pago from public.pago
   where tipo = 'SUSCRIPCION' and estado = 'PENDIENTE' and negocio_id = p_negocio_id
     and metadata->>'concepto' = 'ADS_RECARGA' and metadata->>'paquete_id' = k.id::text
   order by created_at desc limit 1;
  if found then return v_pago; end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'SUSCRIPCION', k.monto_cop, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'ADS_RECARGA', 'paquete_id', k.id, 'monto_recarga', k.monto_cop))
  returning * into v_pago;
  return v_pago;
end $fn$;
revoke all on function public.ads_iniciar_recarga(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ads_iniciar_recarga(uuid, uuid) to authenticated;

create or replace function public._ads_recarga_aplicar_pago(p_pago public.pago, p_id_transaccion text, p_estado public.pago_estado, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_monto numeric;
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

  -- Se acredita lo que se COBRÓ (nunca más): el importe pagado debe cubrir el monto de la recarga del cobro.
  begin v_monto := nullif(p_pago.metadata->>'monto_recarga', '')::numeric; exception when others then v_monto := null; end;
  if p_pago.negocio_id is null or v_monto is null or v_monto <= 0 or p_pago.monto < v_monto then
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values ('pago', p_pago.id, 'ADS_RECARGA_A_REVISION', 'SISTEMA', p_pago.negocio_id,
            jsonb_build_object('monto_cobrado', p_pago.monto, 'monto_recarga', v_monto, 'id_transaccion', p_id_transaccion));
    return jsonb_build_object('procesado', false, 'motivo', 'IMPORTE_NO_COINCIDE', 'requiere_reembolso', false);
  end if;

  update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload,
         procesado_at = now(), updated_at = now() where id = p_pago.id;
  insert into public.ads_saldo (negocio_id, saldo_disponible) values (p_pago.negocio_id, v_monto)
  on conflict (negocio_id) do update set saldo_disponible = public.ads_saldo.saldo_disponible + excluded.saldo_disponible, updated_at = now();
  insert into public.ads_saldo_movimiento (negocio_id, tipo, monto, referencia_tipo, referencia_id)
  values (p_pago.negocio_id, 'RECARGA', v_monto, 'pago', p_pago.id);
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('ads_saldo', p_pago.negocio_id, 'ADS_RECARGA_ACREDITADA', 'SISTEMA', p_pago.negocio_id, jsonb_build_object('pago_id', p_pago.id, 'monto', v_monto));
  return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
end $fn$;
revoke all on function public._ads_recarga_aplicar_pago(public.pago, text, public.pago_estado, jsonb) from public, anon, authenticated;

-- ── 1c. Publicidad: las campañas consumen del saldo publicitario ─────────────────────────────────────
create or replace function public.activar_campana(p_campana_id uuid)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_saldo numeric;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(v_campana.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_campana.estado not in ('BORRADOR', 'PAUSADA', 'AGOTADA') then raise exception 'TRANSICION_INVALIDA'; end if;

  -- Hace falta saldo publicitario para cubrir al menos un día de presupuesto.
  select saldo_disponible into v_saldo from public.ads_saldo where negocio_id = v_campana.negocio_id for update;
  if coalesce(v_saldo, 0) < v_campana.presupuesto_diario then
    raise exception 'SALDO_INSUFICIENTE';
  end if;

  update public.campana_publicitaria
  set estado = 'ACTIVA', fecha_inicio = coalesce(fecha_inicio, now()), updated_at = now()
  where id = p_campana_id
  returning * into v_campana;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('campana_publicitaria', p_campana_id, 'CAMPANA_ACTIVADA', 'BARBERIA', auth.uid(), v_campana.negocio_id);

  return v_campana;
end;
$fn$;

create or replace function public.registrar_clic_patrocinado(p_campana_id uuid, p_negocio_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_tarifa numeric;
  v_saldo numeric;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id and negocio_id = p_negocio_id for update;
  if not found or v_campana.estado <> 'ACTIVA' then return; end if;
  if v_campana.unidad_cobro <> 'CPC' then return; end if;

  -- Corte a medianoche (America/Bogota): un nuevo día reinicia gasto_hoy.
  if v_campana.gasto_hoy_fecha < (now() at time zone 'America/Bogota')::date then
    update public.campana_publicitaria set gasto_hoy = 0, gasto_hoy_fecha = (now() at time zone 'America/Bogota')::date
    where id = p_campana_id;
    v_campana.gasto_hoy := 0;
  end if;

  select case when v_campana.formato = 'PIN' then cpc_pin_cop else cpc_destacado_cop end
    into v_tarifa from public.configuracion_plataforma where id = true;

  if v_campana.gasto_hoy + v_tarifa > v_campana.presupuesto_diario
     or v_campana.gasto_total + v_tarifa > coalesce(v_campana.presupuesto_total, v_campana.gasto_total + v_tarifa) then
    update public.campana_publicitaria set estado = 'AGOTADA', updated_at = now() where id = p_campana_id;
    return;
  end if;

  -- Se consume del saldo publicitario; si no alcanza para este clic, la campaña se detiene hasta que recargue.
  select saldo_disponible into v_saldo from public.ads_saldo where negocio_id = p_negocio_id for update;
  if coalesce(v_saldo, 0) < v_tarifa then
    update public.campana_publicitaria set estado = 'AGOTADA', updated_at = now() where id = p_campana_id;
    return;
  end if;

  update public.ads_saldo set saldo_disponible = saldo_disponible - v_tarifa, updated_at = now() where negocio_id = p_negocio_id;
  insert into public.ads_saldo_movimiento (negocio_id, tipo, monto, referencia_tipo, referencia_id)
  values (p_negocio_id, 'CAMPANA', -v_tarifa, 'campana_publicitaria', p_campana_id);

  update public.campana_publicitaria
  set gasto_total = gasto_total + v_tarifa, gasto_hoy = gasto_hoy + v_tarifa, clics = clics + 1, updated_at = now()
  where id = p_campana_id;
end;
$fn$;

create or replace function public.registrar_impresion_patrocinada(p_campana_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_tarifa_cpm numeric;
  v_costo numeric;
  v_saldo numeric;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id for update;
  if not found or v_campana.estado <> 'ACTIVA' or v_campana.unidad_cobro <> 'CPM' then
    -- Las impresiones de campañas CPC igual se cuentan para CTR, sin cobro.
    update public.campana_publicitaria set impresiones = impresiones + 1 where id = p_campana_id and estado = 'ACTIVA';
    return;
  end if;

  if v_campana.gasto_hoy_fecha < (now() at time zone 'America/Bogota')::date then
    update public.campana_publicitaria set gasto_hoy = 0, gasto_hoy_fecha = (now() at time zone 'America/Bogota')::date
    where id = p_campana_id;
    v_campana.gasto_hoy := 0;
  end if;

  select cpm_pin_cop into v_tarifa_cpm from public.configuracion_plataforma where id = true;
  v_costo := round(v_tarifa_cpm / 1000, 4);

  if v_campana.gasto_hoy + v_costo > v_campana.presupuesto_diario
     or v_campana.gasto_total + v_costo > coalesce(v_campana.presupuesto_total, v_campana.gasto_total + v_costo) then
    update public.campana_publicitaria set estado = 'AGOTADA', impresiones = impresiones + 1, updated_at = now() where id = p_campana_id;
    return;
  end if;

  select saldo_disponible into v_saldo from public.ads_saldo where negocio_id = v_campana.negocio_id for update;
  if coalesce(v_saldo, 0) < v_costo then
    update public.campana_publicitaria set estado = 'AGOTADA', impresiones = impresiones + 1, updated_at = now() where id = p_campana_id;
    return;
  end if;

  update public.ads_saldo set saldo_disponible = saldo_disponible - v_costo, updated_at = now() where negocio_id = v_campana.negocio_id;
  insert into public.ads_saldo_movimiento (negocio_id, tipo, monto, referencia_tipo, referencia_id)
  values (v_campana.negocio_id, 'CAMPANA', -v_costo, 'campana_publicitaria', p_campana_id);

  update public.campana_publicitaria
  set gasto_total = gasto_total + v_costo, gasto_hoy = gasto_hoy + v_costo, impresiones = impresiones + 1, updated_at = now()
  where id = p_campana_id;
end;
$fn$;

-- ── 2. Sedes adicionales ─────────────────────────────────────────────────────────────────────────────
-- Tope de sedes extra por plan: quien necesite más sube de plan.
create or replace function public._tope_sedes_extra(p_plan text)
returns int language sql immutable as $$
  select case p_plan when 'ESSENTIAL' then 1 when 'STUDIO' then 2 when 'PRESTIGE' then 5 else 0 end
$$;
revoke all on function public._tope_sedes_extra(text) from public, anon, authenticated;

-- Sedes extra VIGENTES (activas y sin vencer) del negocio.
create or replace function public._sedes_extra_vigentes(p_negocio_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select a.cantidad from public.negocio_addon a
                    where a.negocio_id = p_negocio_id and a.addon_codigo = 'SEDE_EXTRA' and a.activo
                      and (a.hasta is null or a.hasta > now())), 0)
$$;
revoke all on function public._sedes_extra_vigentes(uuid) from public, anon, authenticated;

-- Límite efectivo de sedes = las del plan + las extras vigentes. NULL = sin tope.
create or replace function public.limite_sedes_negocio(p_negocio_id uuid)
returns int
language plpgsql stable security definer set search_path = public as $fn$
declare v_lim int;
begin
  if not (public.is_barberia_de(p_negocio_id) or public.is_admin_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or public.is_supersu()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  select p.limite_sedes into v_lim from public.plan p join public.negocio n on n.plan_codigo = p.codigo where n.id = p_negocio_id;
  if v_lim is null then return null; end if;
  return v_lim + public._sedes_extra_vigentes(p_negocio_id);
end $fn$;
revoke all on function public.limite_sedes_negocio(uuid) from public, anon, authenticated;
grant execute on function public.limite_sedes_negocio(uuid) to authenticated;

create or replace function public.sede_extra_iniciar_pago(p_negocio_id uuid, p_modo text default 'AGREGAR')
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.plan; v_extra int; v_precio numeric; v_unidades int; v_monto numeric; v_pago public.pago;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_modo not in ('AGREGAR', 'RENOVAR') then raise exception 'MODO_INVALIDO'; end if;
  perform public._exigir_operativo(p_negocio_id);
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  select p.* into v_plan from public.plan p join public.negocio n on n.plan_codigo = p.codigo where n.id = p_negocio_id;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;
  v_precio := v_plan.sede_addon_precio;
  if v_precio is null or v_precio <= 0 or public._tope_sedes_extra(v_plan.codigo::text) = 0 then raise exception 'PLAN_SIN_SEDES_EXTRA'; end if;

  select coalesce(a.cantidad, 0) into v_extra from public.negocio_addon a
   where a.negocio_id = p_negocio_id and a.addon_codigo = 'SEDE_EXTRA' and a.activo and (a.hasta is null or a.hasta > now());
  v_extra := coalesce(v_extra, 0);
  if p_modo = 'AGREGAR' then
    if v_extra + 1 > public._tope_sedes_extra(v_plan.codigo::text) then raise exception 'TOPE_SEDES_EXTRA'; end if;
    v_unidades := 1;
  else
    select coalesce(a.cantidad, 0) into v_extra from public.negocio_addon a where a.negocio_id = p_negocio_id and a.addon_codigo = 'SEDE_EXTRA' and a.activo;
    if coalesce(v_extra, 0) <= 0 then raise exception 'SIN_SEDES_EXTRA_QUE_RENOVAR'; end if;
    v_unidades := v_extra;
  end if;
  v_monto := v_precio * v_unidades;

  select * into v_pago from public.pago
   where tipo = 'SUSCRIPCION' and estado = 'PENDIENTE' and negocio_id = p_negocio_id
     and metadata->>'concepto' = 'SEDE_EXTRA' and metadata->>'modo' = p_modo and monto = v_monto
   order by created_at desc limit 1;
  if found then return v_pago; end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'SUSCRIPCION', v_monto, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'SEDE_EXTRA', 'modo', p_modo, 'unidades', v_unidades, 'precio_unitario', v_precio, 'plan_codigo', v_plan.codigo))
  returning * into v_pago;
  return v_pago;
end $fn$;
revoke all on function public.sede_extra_iniciar_pago(uuid, text) from public, anon, authenticated;
grant execute on function public.sede_extra_iniciar_pago(uuid, text) to authenticated;

create or replace function public._sede_extra_aplicar_pago(p_pago public.pago, p_id_transaccion text, p_estado public.pago_estado, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_modo text; v_unid int; v_precio numeric; v_plan text; v_cant int; v_hasta timestamptz;
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

  v_modo := p_pago.metadata->>'modo';
  begin v_unid := (p_pago.metadata->>'unidades')::int; v_precio := (p_pago.metadata->>'precio_unitario')::numeric; exception when others then v_unid := null; end;
  select n.plan_codigo::text into v_plan from public.negocio n where n.id = p_pago.negocio_id;
  -- El importe debe cubrir las unidades cobradas al precio del cobro; el plan del negocio debe admitir sedes extra.
  if p_pago.negocio_id is null or v_modo not in ('AGREGAR', 'RENOVAR') or v_unid is null or v_unid <= 0 or v_precio is null
     or p_pago.monto < v_precio * v_unid or public._tope_sedes_extra(v_plan) = 0 then
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values ('pago', p_pago.id, 'SEDE_EXTRA_PAGO_A_REVISION', 'SISTEMA', p_pago.negocio_id,
            jsonb_build_object('monto', p_pago.monto, 'modo', v_modo, 'unidades', v_unid, 'id_transaccion', p_id_transaccion));
    return jsonb_build_object('procesado', false, 'motivo', 'IMPORTE_NO_COINCIDE', 'requiere_reembolso', false);
  end if;

  update public.pago set estado = 'APROBADO', id_transaccion_pasarela = p_id_transaccion, payload_pasarela = p_payload,
         procesado_at = now(), updated_at = now() where id = p_pago.id;

  if v_modo = 'AGREGAR' then
    -- Una sede más; el grupo completo queda vigente un mes desde hoy (o desde su vencimiento si aún estaba vigente).
    insert into public.negocio_addon (negocio_id, addon_codigo, cantidad, activo, desde, hasta)
    values (p_pago.negocio_id, 'SEDE_EXTRA', 1, true, now(), now() + interval '1 month')
    on conflict (negocio_id, addon_codigo) do update
      set cantidad = case when public.negocio_addon.activo and coalesce(public.negocio_addon.hasta, now()) > now() then public.negocio_addon.cantidad + 1 else 1 end,
          desde = case when public.negocio_addon.activo and coalesce(public.negocio_addon.hasta, now()) > now() then public.negocio_addon.desde else now() end,
          activo = true,
          hasta = greatest(coalesce(public.negocio_addon.hasta, now()), now()) + interval '1 month'
    returning cantidad, hasta into v_cant, v_hasta;
  else
    update public.negocio_addon set activo = true, hasta = greatest(coalesce(hasta, now()), now()) + interval '1 month'
     where negocio_id = p_pago.negocio_id and addon_codigo = 'SEDE_EXTRA'
    returning cantidad, hasta into v_cant, v_hasta;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('negocio_addon', p_pago.negocio_id, 'SEDE_EXTRA_APLICADA', 'SISTEMA', p_pago.negocio_id,
          jsonb_build_object('pago_id', p_pago.id, 'modo', v_modo, 'cantidad', v_cant, 'vigente_hasta', v_hasta));
  return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', null);
end $fn$;
revoke all on function public._sede_extra_aplicar_pago(public.pago, text, public.pago_estado, jsonb) from public, anon, authenticated;

-- crear_sede: el límite es el efectivo (plan + extras vigentes).
create or replace function public.crear_sede(p_negocio_id uuid, p_nombre text, p_direccion text, p_ciudad text, p_horario_base jsonb, p_latitud double precision default null, p_longitud double precision default null)
returns public.sede
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.plan;
  v_negocio public.negocio;
  v_conteo int;
  v_es_primera boolean;
  v_sede public.sede;
begin
  perform public._exigir_operativo(p_negocio_id);
  select * into v_negocio from public.negocio where id = p_negocio_id;
  if not found or not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select count(*) into v_conteo from public.sede
  where negocio_id = p_negocio_id and not cerrada_permanente;
  v_es_primera := v_conteo = 0;

  select p.* into v_plan from public.plan p where p.codigo = v_negocio.plan_codigo;
  if v_plan.limite_sedes is not null and v_conteo >= v_plan.limite_sedes + public._sedes_extra_vigentes(p_negocio_id) then
    raise exception 'PLAN_LIMIT_EXCEEDED';
  end if;

  insert into public.sede (negocio_id, nombre, direccion, ciudad, horario_base, latitud, longitud, es_principal)
  values (p_negocio_id, p_nombre, p_direccion, p_ciudad, p_horario_base, p_latitud, p_longitud, v_es_primera)
  returning * into v_sede;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('sede', v_sede.id, 'SEDE_CREADA', 'BARBERIA', auth.uid(), p_negocio_id,
          jsonb_build_object('nombre', p_nombre, 'es_principal', v_es_primera));

  return v_sede;
end;
$fn$;

-- cupo_plan_negocio: el tope de sedes que se muestra es el efectivo.
do $$
declare v_def text; v_nuevo text;
  v_a constant text := '''sedes_tope'', v_plan.limite_sedes,';
begin
  v_def := replace(pg_get_functiondef('public.cupo_plan_negocio(uuid)'::regprocedure), E'\r', '');
  if position('_sedes_extra_vigentes' in v_def) > 0 then return; end if;
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA cupo_plan_negocio'; end if;
  v_nuevo := replace(v_def, v_a, '''sedes_tope'', case when v_plan.limite_sedes is null then null else v_plan.limite_sedes + public._sedes_extra_vigentes(p_negocio_id) end,');
  execute v_nuevo;
end $$;

-- ── 3. aplicar_evento_pago y bloqueos de pagos pendientes ────────────────────────────────────────────
do $$
declare v_def text; v_nuevo text;
  v_a constant text := E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', ''UPGRADE'') not in (''PLAN'', ''UPGRADE'') then';
begin
  v_def := replace(pg_get_functiondef('public.aplicar_evento_pago(uuid,text,pago_estado,jsonb)'::regprocedure), E'\r', '');
  if position('_sede_extra_aplicar_pago' in v_def) > 0 then return; end if;   -- ya migrada
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA aplicar_evento_pago'; end if;
  v_nuevo := replace(v_def, v_a,
    E'  -- Publicidad prepagada y sedes adicionales (migración 200): ruta propia.\n'
    || E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', '''') = ''ADS_RECARGA'' then\n'
    || E'    return public._ads_recarga_aplicar_pago(v_pago, p_id_transaccion, p_estado, p_payload);\n'
    || E'  end if;\n'
    || E'  if v_pago.tipo = ''SUSCRIPCION'' and coalesce(v_pago.metadata->>''concepto'', '''') = ''SEDE_EXTRA'' then\n'
    || E'    return public._sede_extra_aplicar_pago(v_pago, p_id_transaccion, p_estado, p_payload);\n'
    || E'  end if;\n' || v_a);
  execute v_nuevo;
end $$;

do $$
declare v_def text; v_nuevo text; v_f text;
  v_a constant text := 'not in (''STAFF_EXTRA'', ''MI_MARCA'')';
begin
  foreach v_f in array array['public.solicitar_pago_plan(uuid,plan_codigo,text)', 'public.solicitar_upgrade_plan(uuid,plan_codigo)'] loop
    v_def := replace(pg_get_functiondef(v_f::regprocedure), E'\r', '');
    if position('SEDE_EXTRA' in v_def) > 0 then continue; end if;
    if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', v_f; end if;
    v_nuevo := replace(v_def, v_a, 'not in (''STAFF_EXTRA'', ''MI_MARCA'', ''SEDE_EXTRA'', ''ADS_RECARGA'')');
    execute v_nuevo;
  end loop;
end $$;
