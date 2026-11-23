-- 184_sincronia_b1_fidelidad_ads_gates.sql
-- B1: fidelidad idempotente al completar cita fuera de POS + alineacion Ads v3 + guards.
-- No aplica DB remota; solo repo. Requiere revision antes de aplicar.

begin;
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Ads v3: ads extra disponible en todos los planes (docs/PLANES_CORREGIDOS_v3.md).
--    109 renombro RAVEN->ESSENTIAL y su replace reescribio RPCs 043/047; aqui se
--    elimina el gate de plan en crear_campana_publicitaria para alinear con v3.
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_nuevo text;
begin
  v_def := pg_get_functiondef('public.crear_campana_publicitaria(uuid,text,text,numeric,numeric,timestamptz,jsonb)'::regprocedure);
  -- v3: Ads extra disponible en todos los planes; se elimina gate por plan_codigo.
  v_nuevo := regexp_replace(
    v_def,
    E'\\s*if\\s+v_negocio\\.plan_codigo\\s*(=|in)\\s*\\(?\\s*''(ESSENTIAL|RAVEN)''(?:\\s*,\\s*''(ESSENTIAL|RAVEN)'')?\\s*\\)?\\s*then\\s*raise exception ''PLAN_INSUFICIENTE'';\\s*end if;',
    E'\n  -- v3: Ads extra disponible en todos los planes; el gate comercial se controla por producto/config, no por plan.',
    'in'
  );
  if v_nuevo = v_def then
    raise notice 'crear_campana_publicitaria: no se encontr? gate de plan para parchear (posiblemente ya alineada)';
  else
    execute v_nuevo;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Idempotencia defensiva para handlers de pipeline venta_completada.
--    completar_venta_pos ya evita doble COMPLETADA, pero completar fuera de POS
--    y reintentos deben no duplicar awards.
-- ---------------------------------------------------------------------------

-- Puntos: origen RESERVA_COMPLETADA:<reserva_id> debe ser unico.
create unique index if not exists ux_punto_fidelizacion_reserva_origen
  on public.punto_fidelizacion (negocio_id, cliente_id, origen)
  where origen like 'RESERVA_COMPLETADA:%';

-- Cashback: un movimiento por regla+cliente+reserva.
create unique index if not exists ux_cashback_movimiento_regla_cliente_reserva
  on public.cashback_movimiento (regla_id, cliente_id, reserva_id)
  where reserva_id is not null;

-- Puntaje staff: evitar duplicado por vinculo+temporada+referencia reserva.
create unique index if not exists ux_puntaje_staff_reserva_servicio
  on public.puntaje_staff_evento (vinculo_id, temporada_id, referencia_tipo, referencia_id, motivo)
  where referencia_tipo = 'reserva_servicio' and referencia_id is not null;

create or replace function public._pipeline_puntos_fidelizacion_otorgar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_puntos_otorgados int := (p_evento->>'puntos_otorgados')::int;
  v_origen text := 'RESERVA_COMPLETADA:' || (p_evento->>'reserva_id');
begin
  if v_puntos_otorgados <= 0 then return; end if;
  if exists (
    select 1 from public.punto_fidelizacion
    where negocio_id = (p_evento->>'negocio_id')::uuid
      and cliente_id = (p_evento->>'cliente_id')::uuid
      and origen = v_origen
  ) then return; end if;
  select * into v_negocio from public.negocio where id = (p_evento->>'negocio_id')::uuid;
  insert into public.punto_fidelizacion (cliente_id, negocio_id, cantidad, cantidad_disponible, fecha_expiracion, origen)
  values (
    (p_evento->>'cliente_id')::uuid, (p_evento->>'negocio_id')::uuid, v_puntos_otorgados, v_puntos_otorgados,
    now() + make_interval(months => v_negocio.puntos_expiracion_meses),
    v_origen
  )
  on conflict (negocio_id, cliente_id, origen) where origen like 'RESERVA_COMPLETADA:%' do nothing;
end;
$fn$;

create or replace function public._pipeline_puntaje_staff_otorgar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo_id uuid;
  v_servicio_pts record;
  v_puntos_categoria int;
begin
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = (p_evento->>'staff_id')::uuid and negocio_id = (p_evento->>'negocio_id')::uuid and estado <> 'RETIRADO'
    limit 1;
  if v_vinculo_id is null or public.temporada_actual_id() is null then
    return;
  end if;

  for v_servicio_pts in
    select sv.id as servicio_id, sv.nombre, sv.categoria_puntaje
    from public.reserva_servicio rs
    join public.servicio sv on sv.id = rs.servicio_id
    where rs.reserva_id = (p_evento->>'reserva_id')::uuid
  loop
    v_puntos_categoria := case v_servicio_pts.categoria_puntaje
      when 'PREMIUM' then 25
      when 'COMPLEMENTARIO' then 8
      else 10
    end;
    if exists (
      select 1 from public.puntaje_staff_evento
      where vinculo_id = v_vinculo_id
        and temporada_id = public.temporada_actual_id()
        and referencia_tipo = 'reserva_servicio'
        and referencia_id = (p_evento->>'reserva_id')::uuid
        and motivo = v_servicio_pts.nombre
    ) then
      continue;
    end if;
    insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
    values (v_vinculo_id, public.temporada_actual_id(), 'SERVICIO_' || v_servicio_pts.categoria_puntaje::text, v_puntos_categoria,
      'reserva_servicio', (p_evento->>'reserva_id')::uuid, 'SISTEMA', v_servicio_pts.nombre)
    on conflict (vinculo_id, temporada_id, referencia_tipo, referencia_id, motivo)
      where referencia_tipo = 'reserva_servicio' and referencia_id is not null do nothing;
  end loop;
end;
$fn$;

create or replace function public._pipeline_cashback_otorgar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_regla record;
  v_base_cashback numeric;
  v_monto_cashback numeric;
  v_ya_generado_mes numeric;
  v_reserva_id uuid := (p_evento->>'reserva_id')::uuid;
  v_cliente_id uuid := (p_evento->>'cliente_id')::uuid;
  v_monto_total numeric := (p_evento->>'monto_total')::numeric;
  v_monto_sena numeric := (p_evento->>'monto_sena')::numeric;
  v_total_productos numeric := (p_evento->>'total_productos')::numeric;
begin
  select * into v_negocio from public.negocio where id = (p_evento->>'negocio_id')::uuid;

  for v_regla in
    select * from public.cashback_regla where negocio_id = (p_evento->>'negocio_id')::uuid and activo = true
  loop
    if exists (
      select 1 from public.cashback_movimiento
      where regla_id = v_regla.id and cliente_id = v_cliente_id and reserva_id = v_reserva_id
    ) then
      continue;
    end if;
    v_base_cashback := 0;
    if v_regla.servicio_ids = '{}' then
      v_base_cashback := v_base_cashback + greatest(v_monto_total - v_monto_sena, 0);
    else
      select coalesce(sum(rs.precio_congelado_unitario), 0) into v_base_cashback
      from public.reserva_servicio rs
      where rs.reserva_id = v_reserva_id and rs.servicio_id = any(v_regla.servicio_ids);
    end if;
    if v_regla.producto_ids = '{}' then
      v_base_cashback := v_base_cashback + v_total_productos;
    else
      select v_base_cashback + coalesce(sum(vp.precio_unitario * vp.cantidad), 0) into v_base_cashback
      from public.venta_producto vp where vp.reserva_id = v_reserva_id and vp.producto_id = any(v_regla.producto_ids);
    end if;

    v_monto_cashback := round(v_base_cashback * v_regla.porcentaje / 100, 2);

    if v_regla.limite_mensual is not null then
      select coalesce(sum(monto), 0) into v_ya_generado_mes
      from public.cashback_movimiento
      where regla_id = v_regla.id and cliente_id = v_cliente_id
        and created_at >= date_trunc('month', now());
      v_monto_cashback := greatest(least(v_monto_cashback, v_regla.limite_mensual - v_ya_generado_mes), 0);
    end if;

    if v_monto_cashback > 0 then
      insert into public.cashback_movimiento (regla_id, cliente_id, reserva_id, monto, estado, fecha_expiracion)
      values (
        v_regla.id, v_cliente_id, v_reserva_id, v_monto_cashback, 'DISPONIBLE',
        case when v_regla.vigencia_dias is not null then now() + make_interval(days => v_regla.vigencia_dias) else null end
      )
      on conflict (regla_id, cliente_id, reserva_id) where reserva_id is not null do nothing;
      if found then
        perform public._lealtad_acreditar(
          v_cliente_id, 'CASHBACK', v_monto_cashback, (p_evento->>'negocio_id')::uuid, (p_evento->>'sede_id')::uuid,
          'cashback_regla', v_regla.id, 'Cashback ' || v_regla.porcentaje || '% · ' || v_negocio.nombre
        );
      end if;
    end if;
  end loop;
end;
$fn$;

-- Auditoria de venta: idempotente por reserva+accion.
create or replace function public._pipeline_auditoria_venta(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if exists (
    select 1 from public.evento_auditoria
    where entidad_tipo = 'reserva'
      and entidad_id = (p_evento->>'reserva_id')::uuid
      and accion = 'VENTA_POS_COMPLETADA'
  ) then
    return;
  end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values (
    'reserva', (p_evento->>'reserva_id')::uuid, 'VENTA_POS_COMPLETADA', 'BARBERIA', auth.uid(), (p_evento->>'negocio_id')::uuid,
    p_evento
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3) Completar cita fuera de POS (idempotente, sin cobro/productos).
--    Usa el mismo pipeline venta_completada con montos de productos/cobro en 0.
-- ---------------------------------------------------------------------------
create or replace function public.completar_reserva_sin_pos(p_reserva_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_actor uuid := auth.uid();
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_autorizado boolean;
  v_es_primera boolean;
  v_puntos_otorgados int;
  v_evento jsonb;
  v_resultado_pipeline jsonb;
begin
  if v_actor is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  v_autorizado := public.is_barberia_de(v_reserva.negocio_id)
    or public.is_guardian_de_sede(v_reserva.sede_id)
    or v_reserva.staff_id = v_actor
    or coalesce(public.is_supersu(), false);
  if not v_autorizado then raise exception 'NO_AUTORIZADO'; end if;

  perform public._exigir_operativo_reserva(p_reserva_id);

  if v_reserva.estado = 'COMPLETADA' then
    return jsonb_build_object('ok', true, 'idempotente', true, 'reserva_id', p_reserva_id, 'pipeline', '[]'::jsonb);
  end if;
  if v_reserva.estado not in ('CONFIRMADA', 'EN_CURSO') then
    raise exception 'RESERVA_NO_COMPLETABLE';
  end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;
  select not exists(
    select 1 from public.reserva where cliente_id = v_reserva.cliente_id and estado = 'COMPLETADA' and id <> p_reserva_id
  ) into v_es_primera;

  update public.reserva set estado = 'COMPLETADA', updated_at = now() where id = p_reserva_id;
  v_puntos_otorgados := floor(coalesce(v_reserva.monto_total, 0) / 10000) * 10;

  v_evento := jsonb_build_object(
    'reserva_id', p_reserva_id,
    'negocio_id', v_reserva.negocio_id,
    'sede_id', v_reserva.sede_id,
    'cliente_id', v_reserva.cliente_id,
    'staff_id', v_reserva.staff_id,
    'monto_total', coalesce(v_reserva.monto_total, 0),
    'monto_sena', coalesce(v_reserva.monto_sena, 0),
    'total_productos', 0,
    'saldo_cobrado', 0,
    'descuento_puntos', 0,
    'descuento_membresia', 0,
    'propina', 0,
    'puntos_canjeados', 0,
    'puntos_otorgados', v_puntos_otorgados,
    'es_primera_reserva', v_es_primera,
    'fuente', 'agenda_sin_pos'
  );

  v_resultado_pipeline := public.ejecutar_pipeline_evento('venta_completada', v_evento);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  select 'reserva', p_reserva_id, 'RESERVA_COMPLETADA_SIN_POS',
    case when coalesce(public.is_supersu(), false) then 'SISTEMA' else 'STAFF' end,
    v_actor, v_reserva.negocio_id, v_evento
  where not exists (
    select 1 from public.evento_auditoria ea
    where ea.entidad_tipo = 'reserva' and ea.entidad_id = p_reserva_id and ea.accion = 'RESERVA_COMPLETADA_SIN_POS'
  );

  return v_evento || jsonb_build_object('ok', true, 'idempotente', false, 'pipeline', v_resultado_pipeline);
end;
$fn$;

revoke all on function public.completar_reserva_sin_pos(uuid) from public, anon;
grant execute on function public.completar_reserva_sin_pos(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4) Alertas antifraude visibles para el negocio (solo lectura interna).
-- ---------------------------------------------------------------------------
create or replace function public.listar_eventos_fraude_negocio(p_negocio_id uuid, p_revisado boolean default false)
returns setof public.lealtad_fraude_evento
language plpgsql stable security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (
    coalesce(public.is_supersu(), false)
    or public.is_barberia_de(p_negocio_id)
    or public.is_guardian_de_negocio(p_negocio_id)
  ) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return query
    select *
    from public.lealtad_fraude_evento
    where negocio_id = p_negocio_id and revisado = coalesce(p_revisado, false)
    order by created_at desc
    limit 100;
end;
$fn$;

revoke all on function public.listar_eventos_fraude_negocio(uuid, boolean) from public, anon;
grant execute on function public.listar_eventos_fraude_negocio(uuid, boolean) to authenticated, service_role;

commit;
