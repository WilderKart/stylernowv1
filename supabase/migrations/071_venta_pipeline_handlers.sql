-- StylerNow — Migración 071: handlers del Pipeline de Eventos de Venta —
-- extrae, SIN CAMBIAR el comportamiento, cada bloque satélite que hoy
-- vive inline en `completar_venta_pos()` (migración 062) a una función
-- independiente `_pipeline_*(p_evento jsonb) returns void`. La migración
-- 072 reescribe `completar_venta_pos()` para llamar al orquestador en
-- vez de repetir esta lógica inline.
--
-- Cada handler recibe el evento `venta_completada` ya armado (reserva_id,
-- negocio_id, sede_id, cliente_id, staff_id, montos, descuento_membresia,
-- es_primera_reserva) y vuelve a consultar `reserva_servicio`/
-- `venta_producto` por `reserva_id` cuando lo necesita — esas filas ya
-- están confirmadas en la misma transacción (fase crítica de
-- `completar_venta_pos()` corre antes que el pipeline).

-- ── Puntos de fidelización (otorgamiento, no canje — el canje sigue en
-- la fase crítica porque afecta el monto cobrado) ──────────────────────
create or replace function public._pipeline_puntos_fidelizacion_otorgar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_puntos_otorgados int := (p_evento->>'puntos_otorgados')::int;
begin
  if v_puntos_otorgados > 0 then
    select * into v_negocio from public.negocio where id = (p_evento->>'negocio_id')::uuid;
    insert into public.punto_fidelizacion (cliente_id, negocio_id, cantidad, cantidad_disponible, fecha_expiracion, origen)
    values (
      (p_evento->>'cliente_id')::uuid, (p_evento->>'negocio_id')::uuid, v_puntos_otorgados, v_puntos_otorgados,
      now() + make_interval(months => v_negocio.puntos_expiracion_meses),
      'RESERVA_COMPLETADA:' || (p_evento->>'reserva_id')
    );
  end if;
end;
$fn$;

-- ── Puntaje de Staff (PRO/EXPERT/MASTER) por Servicio vendido ──────────
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
    insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
    values (v_vinculo_id, public.temporada_actual_id(), 'SERVICIO_' || v_servicio_pts.categoria_puntaje::text, v_puntos_categoria,
      'reserva_servicio', (p_evento->>'reserva_id')::uuid, 'SISTEMA', v_servicio_pts.nombre);
  end loop;
end;
$fn$;

-- ── Sellos digitales ────────────────────────────────────────────────────
create or replace function public._pipeline_sellos_otorgar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana record;
  v_sello_cliente_id uuid;
  v_reserva_id uuid := (p_evento->>'reserva_id')::uuid;
  v_cliente_id uuid := (p_evento->>'cliente_id')::uuid;
begin
  for v_campana in
    select * from public.sello_campana where negocio_id = (p_evento->>'negocio_id')::uuid and estado = 'ACTIVA'
  loop
    if v_campana.servicio_ids = '{}' or exists (
      select 1 from public.reserva_servicio rs where rs.reserva_id = v_reserva_id and rs.servicio_id = any(v_campana.servicio_ids)
    ) then
      insert into public.sello_cliente (campana_id, cliente_id) values (v_campana.id, v_cliente_id)
      on conflict (campana_id, cliente_id) do nothing;
      select id into v_sello_cliente_id from public.sello_cliente where campana_id = v_campana.id and cliente_id = v_cliente_id;

      insert into public.sello_evento (sello_cliente_id, reserva_id, tipo, cantidad)
      values (v_sello_cliente_id, v_reserva_id, 'OTORGADO', 1)
      on conflict (reserva_id, sello_cliente_id) where tipo = 'OTORGADO' and reserva_id is not null do nothing;

      if found then
        update public.sello_cliente set sellos_actuales = sellos_actuales + 1, updated_at = now() where id = v_sello_cliente_id;
      end if;
    end if;
  end loop;
end;
$fn$;

-- ── Cashback ────────────────────────────────────────────────────────────
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
      );
      perform public._lealtad_acreditar(
        v_cliente_id, 'CASHBACK', v_monto_cashback, (p_evento->>'negocio_id')::uuid, (p_evento->>'sede_id')::uuid,
        'cashback_regla', v_regla.id, 'Cashback ' || v_regla.porcentaje || '% · ' || v_negocio.nombre
      );
    end if;
  end loop;
end;
$fn$;

-- ── Referidos de Cliente ────────────────────────────────────────────────
create or replace function public._pipeline_referidos_cliente_completar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_referido record;
  v_referido_config public.referido_config;
  v_monto_referido numeric;
  v_ya_generado_mes numeric;
  v_reserva_id uuid := (p_evento->>'reserva_id')::uuid;
  v_negocio_id uuid := (p_evento->>'negocio_id')::uuid;
  v_sede_id uuid := (p_evento->>'sede_id')::uuid;
  v_cliente_id uuid := (p_evento->>'cliente_id')::uuid;
  v_monto_total numeric := (p_evento->>'monto_total')::numeric;
begin
  if not (p_evento->>'es_primera_reserva')::boolean then
    return;
  end if;

  select * into v_referido from public.referido where referido_cliente_id = v_cliente_id and estado = 'PENDIENTE';
  if not found then
    return;
  end if;

  select * into v_referido_config from public.referido_config where negocio_id = v_negocio_id and activo = true;
  if v_referido_config.negocio_id is not null then
    v_monto_referido := coalesce(v_referido_config.monto, 0)
      + coalesce(round(v_monto_total * v_referido_config.porcentaje / 100, 2), 0);
    if v_referido_config.limite_mensual is not null then
      select coalesce(sum(monto_recompensa), 0) into v_ya_generado_mes
      from public.referido where referente_cliente_id = v_referido.referente_cliente_id
        and negocio_id = v_negocio_id and estado = 'COMPLETADO' and completado_at >= date_trunc('month', now());
      v_monto_referido := greatest(least(v_monto_referido, v_referido_config.limite_mensual - v_ya_generado_mes), 0);
    end if;
  else
    v_monto_referido := 0;
  end if;

  update public.referido
  set estado = 'COMPLETADO', reserva_completada_id = v_reserva_id, monto_recompensa = v_monto_referido, completado_at = now()
  where id = v_referido.id;

  if v_monto_referido > 0 then
    perform public._lealtad_acreditar(
      v_referido.referente_cliente_id, 'REFERIDO', v_monto_referido, v_negocio_id, v_sede_id,
      'referido', v_referido.id, 'Recompensa por referir a un nuevo Cliente'
    );
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('referido', v_referido.id, 'REFERIDO_COMPLETADO', 'SISTEMA', v_negocio_id,
    jsonb_build_object('monto_recompensa', v_monto_referido, 'reserva_id', v_reserva_id));
end;
$fn$;

-- ── Referidos de Staff ──────────────────────────────────────────────────
create or replace function public._pipeline_referidos_staff_completar(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_staff_referido record;
  v_vinculo_id uuid;
  v_reserva_id uuid := (p_evento->>'reserva_id')::uuid;
  v_negocio_id uuid := (p_evento->>'negocio_id')::uuid;
  v_cliente_id uuid := (p_evento->>'cliente_id')::uuid;
begin
  if not (p_evento->>'es_primera_reserva')::boolean then
    return;
  end if;

  select * into v_staff_referido from public.staff_referido where cliente_referido_id = v_cliente_id and estado = 'PENDIENTE';
  if not found then
    return;
  end if;

  update public.staff_referido
  set estado = 'COMPLETADO', reserva_completada_id = v_reserva_id, completado_at = now()
  where id = v_staff_referido.id;

  if v_staff_referido.recompensa_tipo = 'PUNTOS' and v_staff_referido.recompensa_monto is not null then
    select id into v_vinculo_id from public.vinculo_staff_negocio
      where staff_id = v_staff_referido.staff_id and negocio_id = v_staff_referido.negocio_id and estado <> 'RETIRADO'
      limit 1;
    if v_vinculo_id is not null and public.temporada_actual_id() is not null then
      insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
      values (v_vinculo_id, public.temporada_actual_id(), 'REFERIDO_STAFF', v_staff_referido.recompensa_monto::int,
        'staff_referido', v_staff_referido.id, 'SISTEMA', 'Cliente referido completó su primera Reserva');
    end if;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
  values ('staff_referido', v_staff_referido.id, 'STAFF_REFERIDO_COMPLETADO', 'SISTEMA', v_negocio_id,
    jsonb_build_object('reserva_id', v_reserva_id));
end;
$fn$;

-- ── VIP: ascenso automático por gasto acumulado ─────────────────────────
-- Antes vivía en `src/app/panel/pos/actions.ts` como una 2ª llamada RPC
-- separada, "best-effort" desde TypeScript (ver commit 9ed79c9). Migrar
-- acá cierra la ventana donde un fallo de red entre las dos llamadas
-- podía saltarse la evaluación de ascenso — ahora es parte de la misma
-- transacción, con el mismo aislamiento de fallos que cualquier handler.
create or replace function public._pipeline_vip_evaluar_ascenso(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform public.evaluar_ascenso_vip_automatico(
    (p_evento->>'cliente_id')::uuid,
    (p_evento->>'negocio_id')::uuid
  );
end;
$fn$;

-- ── Auditoría resumen de la venta ────────────────────────────────────────
create or replace function public._pipeline_auditoria_venta(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values (
    'reserva', (p_evento->>'reserva_id')::uuid, 'VENTA_POS_COMPLETADA', 'BARBERIA', auth.uid(), (p_evento->>'negocio_id')::uuid,
    p_evento
  );
end;
$fn$;

-- ── Registro de handlers (orden = orden de ejecución actual, con huecos
-- para insertar nuevos handlers sin renumerar) ──────────────────────────
insert into public.venta_pipeline_handler (nombre, descripcion, funcion_sql, orden) values
  ('puntos_fidelizacion', 'Otorga Puntos de fidelización por el monto de la venta', '_pipeline_puntos_fidelizacion_otorgar', 10),
  ('puntaje_staff', 'Otorga puntaje de Temporada al Staff por cada Servicio vendido', '_pipeline_puntaje_staff_otorgar', 20),
  ('sellos', 'Otorga Sellos digitales de campañas activas (Lealtad)', '_pipeline_sellos_otorgar', 30),
  ('cashback', 'Calcula y acredita Cashback al StylerWallet (Lealtad)', '_pipeline_cashback_otorgar', 40),
  ('referidos_cliente', 'Completa el Referido de Cliente si es su primera Reserva (Lealtad)', '_pipeline_referidos_cliente_completar', 50),
  ('referidos_staff', 'Completa el Referido de Staff si es la primera Reserva del referido (Lealtad)', '_pipeline_referidos_staff_completar', 60),
  ('vip_ascenso', 'Reevalúa el ascenso VIP automático por gasto acumulado (Lealtad)', '_pipeline_vip_evaluar_ascenso', 70),
  ('auditoria_venta', 'Registra el evento de auditoría resumen de la venta', '_pipeline_auditoria_venta', 999);
