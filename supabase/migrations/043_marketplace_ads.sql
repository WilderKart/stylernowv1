-- StylerNow — Migración 043: Fase 6, Módulo 6.2 — Marketplace Ads
-- Fuente: 08-Growth-Monetization/06_Advertising_System.md,
-- 03-Business-Rules/06_Marketplace_Ads.md, 04-Data-Model/03_State_Machines.md
-- (máquina "Campaña Publicitaria").
--
-- Alcance real de este módulo (decisión de secuenciación, no un recorte
-- silencioso — ver docs/TECH_DEBT_REGISTER.md para el detalle de cada
-- ítem diferido):
--   - Formatos Destacado y Pin patrocinado: COMPLETOS de punta a punta
--     (creación, activación con cobro real desde el Wallet, pausa/
--     reanudación/finalización, clics/impresiones reales, atribución de
--     Reservas, métricas). Ambos usan hoy el mismo boost de Score
--     (Patrocinio_normalizado, ya construido en el Módulo 5.2) — la
--     garantía posicional exclusiva del Pin (siempre en las primeras
--     posiciones) y el límite de saturación (2 posiciones consecutivas)
--     quedan diferidos: tocan de nuevo el `ORDER BY` de
--     `marketplace_buscar()`, ya corregido 5 veces esta sesión, y
--     merecen un módulo propio con foco exclusivo en ese riesgo.
--   - Formatos Banner y Promoción Flash: NO se exponen en la UI de
--     creación de este módulo. Banner necesitaría además renderizarse en
--     el carrusel del Home (hoy solo editorial, `banner_home` de la Fase
--     3.2) — construir la creación sin el renderizado sería un botón
--     muerto (Regla de Oro). Flash depende de notificaciones push, que
--     es una Decisión Pendiente sin credencial de Firebase desde la Fase
--     1 (`docs/PENDING_DECISIONS.md`) — su propuesta de valor central no
--     puede funcionar todavía.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Tarifas de referencia (SuperSU) — extiende configuracion_plataforma
--    en vez de crear una tabla nueva para un singleton más.
-- ════════════════════════════════════════════════════════════════════════
alter table public.configuracion_plataforma
  add column if not exists cpc_destacado_cop numeric(10,2) not null default 800,
  add column if not exists cpc_pin_cop numeric(10,2) not null default 1200,
  add column if not exists cpm_pin_cop numeric(10,2) not null default 15000;

-- ════════════════════════════════════════════════════════════════════════
-- 2. campana_publicitaria — columnas nuevas para el ciclo real
-- ════════════════════════════════════════════════════════════════════════
alter table public.campana_publicitaria
  add column if not exists unidad_cobro text not null default 'CPC' check (unidad_cobro in ('CPC', 'CPM')),
  add column if not exists impresiones bigint not null default 0,
  add column if not exists clics bigint not null default 0;

-- Atribución de Reservas a un clic patrocinado (Conversión real, no solo
-- Conversión_normalizada del Score) — negocio_visita_perfil ya existe
-- desde el Módulo 5.2, se extiende con la campaña de origen del clic.
alter table public.negocio_visita_perfil
  add column if not exists campana_id uuid references public.campana_publicitaria(id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Ciclo de vida de la campaña
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.crear_campana_publicitaria(
  p_negocio_id uuid,
  p_formato text,
  p_unidad_cobro text,
  p_presupuesto_diario numeric,
  p_presupuesto_total numeric,
  p_fecha_fin timestamptz,
  p_segmentacion jsonb default '{}'::jsonb
)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_campana public.campana_publicitaria;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_formato not in ('DESTACADO', 'PIN') then raise exception 'FORMATO_NO_DISPONIBLE'; end if;
  if p_unidad_cobro not in ('CPC', 'CPM') then raise exception 'UNIDAD_COBRO_INVALIDA'; end if;
  if p_formato = 'DESTACADO' and p_unidad_cobro <> 'CPC' then raise exception 'DESTACADO_SOLO_CPC'; end if;
  if p_presupuesto_diario is null or p_presupuesto_diario <= 0 then raise exception 'PRESUPUESTO_DIARIO_INVALIDO'; end if;
  -- V1: presupuesto_total es obligatorio para poder reservar el gasto contra
  -- el Wallet de forma segura, sin necesitar un job programado de recorte
  -- diario (ver docs/TECH_DEBT_REGISTER.md) — la Biblia lo describe como
  -- opcional, se documenta la simplificación explícitamente.
  if p_presupuesto_total is null or p_presupuesto_total < p_presupuesto_diario then
    raise exception 'PRESUPUESTO_TOTAL_INVALIDO';
  end if;

  select * into v_negocio from public.negocio where id = p_negocio_id;
  if v_negocio.plan_codigo = 'RAVEN' then raise exception 'PLAN_INSUFICIENTE'; end if;

  insert into public.campana_publicitaria
    (negocio_id, formato, unidad_cobro, presupuesto_diario, presupuesto_total, fecha_fin, segmentacion, estado)
  values
    (p_negocio_id, p_formato, p_unidad_cobro, p_presupuesto_diario, p_presupuesto_total, p_fecha_fin, coalesce(p_segmentacion, '{}'::jsonb), 'BORRADOR')
  returning * into v_campana;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('campana_publicitaria', v_campana.id, 'CAMPANA_CREADA', 'BARBERIA', auth.uid(), p_negocio_id);

  return v_campana;
end;
$fn$;
grant execute on function public.crear_campana_publicitaria(uuid, text, text, numeric, numeric, timestamptz, jsonb) to authenticated;

create or replace function public.activar_campana(p_campana_id uuid)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_wallet public.wallet;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(v_campana.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_campana.estado not in ('BORRADOR', 'PAUSADA') then raise exception 'TRANSICION_INVALIDA'; end if;

  select * into v_wallet from public.wallet where negocio_id = v_campana.negocio_id for update;
  if v_wallet.saldo_disponible < v_campana.presupuesto_diario then
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
grant execute on function public.activar_campana(uuid) to authenticated;

create or replace function public.pausar_campana(p_campana_id uuid, p_motivo text default null)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_autorizado boolean;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;

  v_autorizado := public.is_barberia_de(v_campana.negocio_id) or public.is_supersu();
  if not v_autorizado then raise exception 'NO_AUTORIZADO'; end if;
  if v_campana.estado <> 'ACTIVA' then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.campana_publicitaria set estado = 'PAUSADA', updated_at = now()
  where id = p_campana_id
  returning * into v_campana;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('campana_publicitaria', p_campana_id, 'CAMPANA_PAUSADA',
    case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end, auth.uid(), v_campana.negocio_id, p_motivo);

  return v_campana;
end;
$fn$;
grant execute on function public.pausar_campana(uuid, text) to authenticated;

create or replace function public.finalizar_campana(p_campana_id uuid)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(v_campana.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_campana.estado not in ('ACTIVA', 'PAUSADA', 'BORRADOR') then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.campana_publicitaria set estado = 'FINALIZADA', fecha_fin = now(), updated_at = now()
  where id = p_campana_id
  returning * into v_campana;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('campana_publicitaria', p_campana_id, 'CAMPANA_FINALIZADA', 'BARBERIA', auth.uid(), v_campana.negocio_id);

  return v_campana;
end;
$fn$;
grant execute on function public.finalizar_campana(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Cobro en tiempo real — clic (CPC) e impresiones (CPM), nunca exceden
--    presupuesto_diario ni presupuesto_total (03-Business-Rules/06_
--    Marketplace_Ads.md, invariante 3). Al agotarse, pasa a AGOTADA.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.registrar_clic_patrocinado(p_campana_id uuid, p_negocio_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_tarifa numeric;
  v_wallet_id uuid;
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

  select id into v_wallet_id from public.wallet where negocio_id = p_negocio_id for update;
  if v_wallet_id is null then return; end if;

  update public.wallet set saldo_disponible = saldo_disponible - v_tarifa, updated_at = now() where id = v_wallet_id;
  insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
  values (v_wallet_id, 'CAMPANA', -v_tarifa, 'campana_publicitaria', p_campana_id);

  update public.campana_publicitaria
  set gasto_total = gasto_total + v_tarifa, gasto_hoy = gasto_hoy + v_tarifa, clics = clics + 1, updated_at = now()
  where id = p_campana_id;
end;
$fn$;
grant execute on function public.registrar_clic_patrocinado(uuid, uuid) to anon, authenticated;

create or replace function public.registrar_impresion_patrocinada(p_campana_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_tarifa_cpm numeric;
  v_costo numeric;
  v_wallet_id uuid;
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

  select id into v_wallet_id from public.wallet where negocio_id = v_campana.negocio_id for update;
  if v_wallet_id is null then return; end if;

  update public.wallet set saldo_disponible = saldo_disponible - v_costo, updated_at = now() where id = v_wallet_id;
  insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
  values (v_wallet_id, 'CAMPANA', -v_costo, 'campana_publicitaria', p_campana_id);

  update public.campana_publicitaria
  set gasto_total = gasto_total + v_costo, gasto_hoy = gasto_hoy + v_costo, impresiones = impresiones + 1, updated_at = now()
  where id = p_campana_id;
end;
$fn$;
grant execute on function public.registrar_impresion_patrocinada(uuid) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Métricas (Barbería) — impresiones, clics, CTR, Reservas atribuidas
--    (ventana de 24h desde el clic), costo por Reserva atribuida.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.metricas_campana(p_campana_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_campana public.campana_publicitaria;
  v_reservas_atribuidas int;
begin
  select * into v_campana from public.campana_publicitaria where id = p_campana_id;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(v_campana.negocio_id) and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select count(distinct r.id) into v_reservas_atribuidas
  from public.negocio_visita_perfil v
  join public.reserva r on r.cliente_id = v.cliente_id and r.negocio_id = v.negocio_id
    and r.created_at between v.created_at and v.created_at + interval '24 hours'
  where v.campana_id = p_campana_id;

  return jsonb_build_object(
    'impresiones', v_campana.impresiones,
    'clics', v_campana.clics,
    'ctr', case when v_campana.impresiones > 0 then round((v_campana.clics::numeric / v_campana.impresiones) * 100, 2) else 0 end,
    'reservasAtribuidas', v_reservas_atribuidas,
    'costoPorReserva', case when v_reservas_atribuidas > 0 then round(v_campana.gasto_total / v_reservas_atribuidas, 2) else null end,
    'gastoTotal', v_campana.gasto_total,
    'presupuestoRestante', greatest(coalesce(v_campana.presupuesto_total, 0) - v_campana.gasto_total, 0)
  );
end;
$fn$;
grant execute on function public.metricas_campana(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Métricas agregadas de la plataforma (SuperSU) — 06_Advertising_
--    System.md, Permisos: "ve métricas agregadas de ingresos publicitarios
--    de toda la plataforma".
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.metricas_ads_plataforma()
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_gasto_total numeric;
  v_campanas_activas int;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  select coalesce(sum(gasto_total), 0), count(*) filter (where estado = 'ACTIVA')
    into v_gasto_total, v_campanas_activas
  from public.campana_publicitaria;

  return jsonb_build_object('gastoTotalPlataforma', v_gasto_total, 'campanasActivas', v_campanas_activas);
end;
$fn$;
grant execute on function public.metricas_ads_plataforma() to authenticated;
