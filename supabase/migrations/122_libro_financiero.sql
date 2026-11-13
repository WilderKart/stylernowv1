-- 122 · Libro financiero por negocio: registro de eventos inmutable y neutral respecto del proveedor.
--
-- Directiva de continuidad, fase 1 (2026-11-12). Sin aplicar en producción. Aditiva y re-ejecutable.
--
-- Qué es: un REGISTRO VERIFICABLE de lo que pasó con el dinero (pagos, anticipos, reembolsos,
-- gift cards, membresías, ventas en el local, comisiones, ingresos de StylerNow y ajustes),
-- derivado automáticamente de los estados ya confirmados en la base (pago, reembolso).
--
-- Qué NO es: no administra dinero, no calcula saldos disponibles ni retirables, no asume quién
-- custodia los fondos ni qué proveedor se usa (`proveedor` e `id_externo` son texto libre que
-- viene del registro de origen). No cambia la lógica de cobro, retención ni devolución.
--
-- Reglas:
--  * Inmutable: nadie (ni service_role) modifica ni borra filas. Una corrección es un AJUSTE nuevo
--    que referencia al movimiento original (`ajusta_movimiento_id`), con motivo y actor.
--  * Idempotente: cada hecho tiene una clave única (`pago:<id>:CONFIRMADO`, …). Webhooks
--    repetidos o reintentos no duplican movimientos.
--  * Con evidencia: un pago en línea solo se registra CONFIRMADO si la pasarela devolvió un id de
--    transacción; sin él queda REQUIERE_REVISION. Un reembolso solo se registra CONFIRMADO cuando
--    la fila `reembolso` llegó a REEMBOLSADO (que exige la confirmación de la pasarela, 116).
--  * Aislamiento: el negocio ve solo sus movimientos de entidad NEGOCIO; StylerNow (SuperSU) ve todo.
--
-- `sentido`: INGRESO / EGRESO para hechos confirmados con efecto económico para la entidad;
-- INFORMATIVO para hechos sin efecto (pago pendiente o fallido, reserva creada, reembolso solicitado).
-- Los totales económicos se calculan solo con INGRESO/EGRESO en estado CONFIRMADO.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Tabla
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.libro_movimiento (
  id uuid primary key default gen_random_uuid(),
  entidad text not null check (entidad in ('NEGOCIO','PLATAFORMA')),
  negocio_id uuid references public.negocio(id),
  categoria text not null check (categoria in (
    'RESERVA','ANTICIPO','PAGO_SERVICIO','PROPINA','GIFT_CARD','REDENCION_GIFT_CARD','MEMBRESIA',
    'VENTA_LOCAL','REEMBOLSO','COMISION_PLATAFORMA','PAGO_A_STYLERNOW','INGRESO_PLATAFORMA','AJUSTE')),
  evento text not null check (evento in (
    'RESERVA_CREADA','RESERVA_CONFIRMADA','RESERVA_CANCELADA','RESERVA_NO_SHOW','RESERVA_COMPLETADA',
    'PAGO_PENDIENTE','PAGO_CONFIRMADO','PAGO_FALLIDO','PAGO_SIN_EVIDENCIA','PAGO_EN_DISPUTA',
    'REEMBOLSO_SOLICITADO','REEMBOLSO_CONFIRMADO','REEMBOLSO_FALLIDO','REEMBOLSO_EN_REVISION',
    'COMISION_CAUSADA','REDENCION','AJUSTE')),
  sentido text not null check (sentido in ('INGRESO','EGRESO','INFORMATIVO')),
  estado text not null check (estado in ('PENDIENTE','CONFIRMADO','FALLIDO','REQUIERE_REVISION','INFORMATIVO')),
  monto numeric(14,2) not null check (monto >= 0),
  moneda char(3) not null default 'COP',
  ocurrido_at timestamptz not null,          -- cuándo ocurrió el hecho en el sistema de origen
  registrado_at timestamptz not null default now(),
  referencia_tipo text not null,             -- pago | reembolso | reserva | gift_card_redencion | libro_movimiento
  referencia_id uuid not null,
  pago_id uuid,
  reembolso_id uuid,
  reserva_id uuid,
  proveedor text,                            -- según el registro de origen (p. ej. MERCADOPAGO, LOCAL)
  id_externo text,                           -- id de la transacción en el proveedor, si existe
  cuenta_recaudo text,                       -- dónde dice el origen que se recaudó (NEGOCIO/PLATAFORMA); informativo
  actor_tipo text not null default 'SISTEMA',
  actor_id uuid,
  ajusta_movimiento_id uuid references public.libro_movimiento(id),
  motivo text,
  detalle jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  constraint libro_negocio_requerido check (entidad = 'PLATAFORMA' or negocio_id is not null),
  constraint libro_ajuste_con_motivo check (categoria <> 'AJUSTE' or (ajusta_movimiento_id is not null and length(btrim(coalesce(motivo, ''))) > 0))
);

create index if not exists libro_negocio_fecha_idx on public.libro_movimiento (negocio_id, ocurrido_at desc);
create index if not exists libro_entidad_fecha_idx on public.libro_movimiento (entidad, ocurrido_at desc);
create index if not exists libro_categoria_idx on public.libro_movimiento (categoria, estado);
create index if not exists libro_pago_idx on public.libro_movimiento (pago_id) where pago_id is not null;
create index if not exists libro_reserva_idx on public.libro_movimiento (reserva_id) where reserva_id is not null;
create index if not exists libro_reembolso_idx on public.libro_movimiento (reembolso_id) where reembolso_id is not null;
create index if not exists libro_ajusta_idx on public.libro_movimiento (ajusta_movimiento_id) where ajusta_movimiento_id is not null;

drop trigger if exists trg_libro_movimiento_inmutable on public.libro_movimiento;
create trigger trg_libro_movimiento_inmutable before update or delete on public.libro_movimiento
  for each row execute function public.trg_fila_inmutable();

alter table public.libro_movimiento enable row level security;
drop policy if exists libro_select on public.libro_movimiento;
create policy libro_select on public.libro_movimiento for select to authenticated
  using (coalesce(public.is_supersu(), false)
         or (entidad = 'NEGOCIO' and coalesce(public.is_barberia_de(negocio_id), false)));

revoke all on public.libro_movimiento from public, anon;
revoke insert, update, delete, truncate on public.libro_movimiento from authenticated, service_role;
grant select on public.libro_movimiento to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Registro interno (idempotente)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._libro_moneda(p_negocio_id uuid)
returns char(3) language sql stable security definer set search_path = public as $$
  select coalesce((select p.moneda from public.negocio n join public.pais p on p.codigo = n.pais_codigo
                    where n.id = p_negocio_id), 'COP')::char(3);
$$;
revoke all on function public._libro_moneda(uuid) from public, anon, authenticated;

create or replace function public._libro_registrar(
  p_key text, p_entidad text, p_negocio uuid, p_categoria text, p_evento text, p_sentido text, p_estado text,
  p_monto numeric, p_ocurrido timestamptz, p_ref_tipo text, p_ref_id uuid,
  p_pago uuid, p_reembolso uuid, p_reserva uuid, p_proveedor text, p_id_externo text, p_cuenta text,
  p_actor_tipo text, p_actor uuid, p_detalle jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.libro_movimiento (idempotency_key, entidad, negocio_id, categoria, evento, sentido, estado,
    monto, moneda, ocurrido_at, referencia_tipo, referencia_id, pago_id, reembolso_id, reserva_id,
    proveedor, id_externo, cuenta_recaudo, actor_tipo, actor_id, detalle)
  values (p_key, p_entidad, p_negocio, p_categoria, p_evento, p_sentido, p_estado,
    round(greatest(coalesce(p_monto, 0), 0), 2), public._libro_moneda(p_negocio), coalesce(p_ocurrido, now()),
    p_ref_tipo, p_ref_id, p_pago, p_reembolso, p_reserva,
    p_proveedor, nullif(p_id_externo, ''), p_cuenta, coalesce(p_actor_tipo, 'SISTEMA'), p_actor, coalesce(p_detalle, '{}'::jsonb))
  on conflict (idempotency_key) do nothing;
end $$;
revoke all on function public._libro_registrar(text, text, uuid, text, text, text, text, numeric, timestamptz, text, uuid,
  uuid, uuid, uuid, text, text, text, text, uuid, jsonb) from public, anon, authenticated, service_role;

-- Categoría y proveedor normalizados de un pago.
create or replace function public._libro_categoria_pago(p_tipo public.pago_tipo)
returns text language sql immutable set search_path = public as $$
  select case p_tipo
    when 'SENA' then 'ANTICIPO' when 'SALDO' then 'PAGO_SERVICIO' when 'PROPINA' then 'PROPINA'
    when 'GIFT_CARD' then 'GIFT_CARD' when 'MEMBRESIA' then 'MEMBRESIA'
    else 'PAGO_A_STYLERNOW' end;   -- SUSCRIPCION, PAQUETE_CREDITOS_IA, PAQUETE_CONVERSACIONES_WHATSAPP
$$;

create or replace function public._libro_proveedor(p_pasarela text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_pasarela in ('MERCADOPAGO', 'MERCADO_PAGO') then 'MERCADOPAGO'
    when p_pasarela in ('EFECTIVO', 'DATAFONO_PROPIO') then 'LOCAL'
    else nullif(upper(btrim(coalesce(p_pasarela, ''))), '') end;
$$;
revoke all on function public._libro_categoria_pago(public.pago_tipo) from public, anon, authenticated;
revoke all on function public._libro_proveedor(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Pagos → libro
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._libro_desde_pago(p public.pago, p_actor_tipo text, p_actor uuid, p_backfill boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cat text := public._libro_categoria_pago(p.tipo);
  v_prov text := public._libro_proveedor(p.pasarela);
  v_local boolean := coalesce(p.pasarela, '') in ('EFECTIVO', 'DATAFONO_PROPIO');
  v_benef text := public.beneficiario_pago(p.tipo);
  v_cat_neg text;
  v_det jsonb := jsonb_build_object('tipo_pago', p.tipo, 'metodo', p.pasarela, 'backfill', p_backfill);
  v_fecha timestamptz := coalesce(p.procesado_at, p.updated_at, p.created_at);
begin
  if v_local and v_cat in ('PAGO_SERVICIO','PROPINA') then v_cat := 'VENTA_LOCAL'; v_det := v_det || jsonb_build_object('subtipo', p.tipo); end if;
  v_cat_neg := v_cat;

  if p.estado = 'PENDIENTE' then
    perform public._libro_registrar('pago:' || p.id || ':PENDIENTE', case when v_benef = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
      p.negocio_id, v_cat, 'PAGO_PENDIENTE', 'INFORMATIVO', 'PENDIENTE', p.monto, p.created_at, 'pago', p.id,
      p.id, null, p.reserva_id, v_prov, null, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);

  elsif p.estado = 'RECHAZADO' then
    perform public._libro_registrar('pago:' || p.id || ':FALLIDO', case when v_benef = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
      p.negocio_id, v_cat, 'PAGO_FALLIDO', 'INFORMATIVO', 'FALLIDO', p.monto, v_fecha, 'pago', p.id,
      p.id, null, p.reserva_id, v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);

  elsif p.estado = 'EN_DISPUTA' then
    perform public._libro_registrar('pago:' || p.id || ':DISPUTA', case when v_benef = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
      p.negocio_id, v_cat, 'PAGO_EN_DISPUTA', 'INFORMATIVO', 'REQUIERE_REVISION', p.monto, v_fecha, 'pago', p.id,
      p.id, null, p.reserva_id, v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);

  elsif p.estado in ('APROBADO', 'REEMBOLSADO', 'REEMBOLSADO_PARCIAL') then
    -- Un pago reembolsado estuvo aprobado: su confirmación también se registra (el backfill lo necesita).
    if not v_local and coalesce(p.id_transaccion_pasarela, '') = '' then
      perform public._libro_registrar('pago:' || p.id || ':SIN_EVIDENCIA', case when v_benef = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
        p.negocio_id, v_cat, 'PAGO_SIN_EVIDENCIA', 'INFORMATIVO', 'REQUIERE_REVISION', p.monto, v_fecha, 'pago', p.id,
        p.id, null, p.reserva_id, v_prov, null, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);
      return;
    end if;

    if v_benef = 'PLATAFORMA' then
      -- Ingreso de StylerNow y, para el negocio que pagó, el egreso correspondiente.
      perform public._libro_registrar('pago:' || p.id || ':CONFIRMADO:PLATAFORMA', 'PLATAFORMA', p.negocio_id, 'INGRESO_PLATAFORMA',
        'PAGO_CONFIRMADO', 'INGRESO', 'CONFIRMADO', p.monto, v_fecha, 'pago', p.id, p.id, null, p.reserva_id,
        v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);
      if p.negocio_id is not null then
        perform public._libro_registrar('pago:' || p.id || ':CONFIRMADO:NEGOCIO', 'NEGOCIO', p.negocio_id, 'PAGO_A_STYLERNOW',
          'PAGO_CONFIRMADO', 'EGRESO', 'CONFIRMADO', p.monto, v_fecha, 'pago', p.id, p.id, null, p.reserva_id,
          v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);
      end if;
    else
      perform public._libro_registrar('pago:' || p.id || ':CONFIRMADO', 'NEGOCIO', p.negocio_id, v_cat_neg,
        'PAGO_CONFIRMADO', 'INGRESO', 'CONFIRMADO', p.monto, v_fecha, 'pago', p.id, p.id, null, p.reserva_id,
        v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, p_actor_tipo, p_actor, v_det);
      -- Comisión de StylerNow ya fijada en el pago (0 % por defecto: no se registra nada en 0).
      if coalesce(p.comision_plataforma_monto, 0) > 0 then
        perform public._libro_registrar('pago:' || p.id || ':COMISION:NEGOCIO', 'NEGOCIO', p.negocio_id, 'COMISION_PLATAFORMA',
          'COMISION_CAUSADA', 'EGRESO', 'CONFIRMADO', p.comision_plataforma_monto, v_fecha, 'pago', p.id, p.id, null, p.reserva_id,
          v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, 'SISTEMA', null, v_det || jsonb_build_object('pct', p.comision_plataforma_pct));
        perform public._libro_registrar('pago:' || p.id || ':COMISION:PLATAFORMA', 'PLATAFORMA', p.negocio_id, 'COMISION_PLATAFORMA',
          'COMISION_CAUSADA', 'INGRESO', 'CONFIRMADO', p.comision_plataforma_monto, v_fecha, 'pago', p.id, p.id, null, p.reserva_id,
          v_prov, p.id_transaccion_pasarela, p.cuenta_cobro, 'SISTEMA', null, v_det || jsonb_build_object('pct', p.comision_plataforma_pct));
      end if;
    end if;
  end if;
end $$;
revoke all on function public._libro_desde_pago(public.pago, text, uuid, boolean) from public, anon, authenticated, service_role;

create or replace function public.trg_libro_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado
     and new.id_transaccion_pasarela is not distinct from old.id_transaccion_pasarela then
    return new;
  end if;
  perform public._libro_desde_pago(new,
    case when auth.uid() is null then 'SISTEMA' else 'USUARIO' end, auth.uid(), false);
  return new;
end $$;
revoke all on function public.trg_libro_pago() from public, anon, authenticated;

drop trigger if exists trg_libro_pago on public.pago;
create trigger trg_libro_pago after insert or update of estado, id_transaccion_pasarela on public.pago
  for each row execute function public.trg_libro_pago();

-- ════════════════════════════════════════════════════════════════════════
-- 4. Reembolsos → libro
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._libro_desde_reembolso(r public.reembolso, p_backfill boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.pago;
  v_entidad text;
  v_det jsonb := jsonb_build_object('motivo', r.motivo, 'origen', r.origen, 'pct', r.pct, 'intentos', r.intentos, 'backfill', p_backfill);
begin
  select * into v_pago from public.pago where id = r.pago_id;
  v_entidad := case when public.beneficiario_pago(v_pago.tipo) = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end;

  -- Solicitud: siempre, una vez (cualquier estado implica que se solicitó).
  perform public._libro_registrar('reembolso:' || r.id || ':SOLICITADO', v_entidad, r.negocio_id, 'REEMBOLSO',
    'REEMBOLSO_SOLICITADO', 'INFORMATIVO', 'PENDIENTE', r.monto, r.created_at, 'reembolso', r.id,
    r.pago_id, r.id, r.reserva_id, public._libro_proveedor(v_pago.pasarela), v_pago.id_transaccion_pasarela, v_pago.cuenta_cobro,
    'SISTEMA', null, v_det);

  if r.estado = 'REEMBOLSADO' then
    perform public._libro_registrar('reembolso:' || r.id || ':CONFIRMADO', v_entidad, r.negocio_id, 'REEMBOLSO',
      'REEMBOLSO_CONFIRMADO', 'EGRESO', 'CONFIRMADO', r.monto, coalesce(r.confirmado_at, r.updated_at), 'reembolso', r.id,
      r.pago_id, r.id, r.reserva_id, public._libro_proveedor(v_pago.pasarela), r.id_reembolso_pasarela, v_pago.cuenta_cobro,
      'SISTEMA', null, v_det);
  elsif r.estado = 'FALLIDO' then
    perform public._libro_registrar('reembolso:' || r.id || ':FALLIDO:' || r.intentos, v_entidad, r.negocio_id, 'REEMBOLSO',
      'REEMBOLSO_FALLIDO', 'INFORMATIVO', 'FALLIDO', r.monto, r.updated_at, 'reembolso', r.id,
      r.pago_id, r.id, r.reserva_id, public._libro_proveedor(v_pago.pasarela), null, v_pago.cuenta_cobro,
      'SISTEMA', null, v_det || jsonb_build_object('error', left(r.ultimo_error, 200)));
  elsif r.estado = 'REQUIERE_REVISION' then
    perform public._libro_registrar('reembolso:' || r.id || ':REVISION:' || r.intentos, v_entidad, r.negocio_id, 'REEMBOLSO',
      'REEMBOLSO_EN_REVISION', 'INFORMATIVO', 'REQUIERE_REVISION', r.monto, r.updated_at, 'reembolso', r.id,
      r.pago_id, r.id, r.reserva_id, public._libro_proveedor(v_pago.pasarela), null, v_pago.cuenta_cobro,
      'SISTEMA', null, v_det || jsonb_build_object('error', left(r.ultimo_error, 200)));
  end if;
end $$;
revoke all on function public._libro_desde_reembolso(public.reembolso, boolean) from public, anon, authenticated, service_role;

create or replace function public.trg_libro_reembolso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then return new; end if;
  perform public._libro_desde_reembolso(new, false);
  return new;
end $$;
revoke all on function public.trg_libro_reembolso() from public, anon, authenticated;

drop trigger if exists trg_libro_reembolso on public.reembolso;
create trigger trg_libro_reembolso after insert or update of estado on public.reembolso
  for each row execute function public.trg_libro_reembolso();

-- ════════════════════════════════════════════════════════════════════════
-- 5. Reservas y redenciones → libro (informativo: no mueven dinero)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.trg_libro_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_evento text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then return new; end if;
  v_evento := case
    when tg_op = 'INSERT' then 'RESERVA_CREADA'
    when new.estado = 'CONFIRMADA' then 'RESERVA_CONFIRMADA'
    when new.estado = 'CANCELADA' then 'RESERVA_CANCELADA'
    when new.estado = 'NO_SHOW' then 'RESERVA_NO_SHOW'
    when new.estado = 'COMPLETADA' then 'RESERVA_COMPLETADA'
  end;
  if v_evento is null then return new; end if;
  perform public._libro_registrar('reserva:' || new.id || ':' || v_evento, 'NEGOCIO', new.negocio_id, 'RESERVA',
    v_evento, 'INFORMATIVO', 'INFORMATIVO', new.monto_total, now(), 'reserva', new.id, null, null, new.id,
    null, null, null, case when auth.uid() is null then 'SISTEMA' else 'USUARIO' end, auth.uid(),
    jsonb_build_object('monto_sena', new.monto_sena, 'cancelado_por', new.cancelado_por));
  -- Una reserva creada ya confirmada (sin anticipo) deja también su confirmación.
  if tg_op = 'INSERT' and new.estado = 'CONFIRMADA' then
    perform public._libro_registrar('reserva:' || new.id || ':RESERVA_CONFIRMADA', 'NEGOCIO', new.negocio_id, 'RESERVA',
      'RESERVA_CONFIRMADA', 'INFORMATIVO', 'INFORMATIVO', new.monto_total, now(), 'reserva', new.id, null, null, new.id,
      null, null, null, case when auth.uid() is null then 'SISTEMA' else 'USUARIO' end, auth.uid(),
      jsonb_build_object('monto_sena', new.monto_sena));
  end if;
  return new;
end $$;
revoke all on function public.trg_libro_reserva() from public, anon, authenticated;

drop trigger if exists trg_libro_reserva on public.reserva;
create trigger trg_libro_reserva after insert or update of estado on public.reserva
  for each row execute function public.trg_libro_reserva();

create or replace function public.trg_libro_redencion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  select negocio_id into v_neg from public.gift_card where id = new.gift_card_id;
  if v_neg is null then return new; end if;
  perform public._libro_registrar('gift_card_redencion:' || new.id, 'NEGOCIO', v_neg, 'REDENCION_GIFT_CARD',
    'REDENCION', 'INFORMATIVO', 'INFORMATIVO', new.monto, new.created_at, 'gift_card_redencion', new.id,
    null, null, null, null, null, null, 'SISTEMA', null, jsonb_build_object('gift_card_id', new.gift_card_id));
  return new;
end $$;
revoke all on function public.trg_libro_redencion() from public, anon, authenticated;

drop trigger if exists trg_libro_redencion on public.gift_card_redencion;
create trigger trg_libro_redencion after insert on public.gift_card_redencion
  for each row execute function public.trg_libro_redencion();

-- ════════════════════════════════════════════════════════════════════════
-- 6. Ajustes autorizados (SuperSU): nunca editan, siempre agregan
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.libro_registrar_ajuste(
  p_movimiento_id uuid, p_monto numeric, p_sentido text, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.libro_movimiento; v_id uuid; v_key text;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_sentido not in ('INGRESO', 'EGRESO') then raise exception 'SENTIDO_INVALIDO'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  select * into o from public.libro_movimiento where id = p_movimiento_id;
  if not found then raise exception 'MOVIMIENTO_NO_ENCONTRADO'; end if;

  v_key := 'ajuste:' || o.id || ':' || gen_random_uuid();
  insert into public.libro_movimiento (idempotency_key, entidad, negocio_id, categoria, evento, sentido, estado, monto, moneda,
    ocurrido_at, referencia_tipo, referencia_id, pago_id, reembolso_id, reserva_id, proveedor, id_externo, cuenta_recaudo,
    actor_tipo, actor_id, ajusta_movimiento_id, motivo, detalle)
  values (v_key, o.entidad, o.negocio_id, 'AJUSTE', 'AJUSTE', p_sentido, 'CONFIRMADO', round(p_monto, 2), o.moneda,
    now(), 'libro_movimiento', o.id, o.pago_id, o.reembolso_id, o.reserva_id, o.proveedor, o.id_externo, o.cuenta_recaudo,
    'SUPERSU', auth.uid(), o.id, left(p_motivo, 500), jsonb_build_object('categoria_original', o.categoria))
  returning id into v_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values ('libro_movimiento', v_id, 'LIBRO_AJUSTE_REGISTRADO', 'SUPERSU', auth.uid(), o.negocio_id, p_motivo,
          jsonb_build_object('ajusta', o.id, 'monto', round(p_monto, 2), 'sentido', p_sentido));
  return v_id;
end $$;
revoke all on function public.libro_registrar_ajuste(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.libro_registrar_ajuste(uuid, numeric, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Totales (SECURITY INVOKER: respeta la RLS de quien consulta)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.libro_totales(
  p_negocio_id uuid default null, p_desde timestamptz default null, p_hasta timestamptz default null,
  p_categoria text default null, p_estado text default null, p_entidad text default null)
returns table(periodo date, entidad text, categoria text, sentido text, estado text, moneda char(3), cantidad bigint, total numeric)
language sql stable security invoker set search_path = public as $$
  select date_trunc('month', m.ocurrido_at)::date, m.entidad, m.categoria, m.sentido, m.estado, m.moneda,
         count(*), sum(m.monto)
    from public.libro_movimiento m
   where (p_negocio_id is null or m.negocio_id = p_negocio_id)
     and (p_desde is null or m.ocurrido_at >= p_desde)
     and (p_hasta is null or m.ocurrido_at < p_hasta)
     and (p_categoria is null or m.categoria = p_categoria)
     and (p_estado is null or m.estado = p_estado)
     and (p_entidad is null or m.entidad = p_entidad)
   group by 1, 2, 3, 4, 5, 6
   order by 1 desc, 2, 3, 4;
$$;
revoke all on function public.libro_totales(uuid, timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.libro_totales(uuid, timestamptz, timestamptz, text, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 8. Carga histórica (idempotente: re-ejecutar no duplica)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare p public.pago; r public.reembolso; s public.reserva;
begin
  for s in select * from public.reserva loop
    perform public._libro_registrar('reserva:' || s.id || ':RESERVA_CREADA', 'NEGOCIO', s.negocio_id, 'RESERVA',
      'RESERVA_CREADA', 'INFORMATIVO', 'INFORMATIVO', s.monto_total, s.created_at, 'reserva', s.id, null, null, s.id,
      null, null, null, 'SISTEMA', null, jsonb_build_object('backfill', true));
  end loop;
  for p in select * from public.pago loop
    if p.estado <> 'PENDIENTE' then
      -- Un pago que ya no está pendiente estuvo pendiente: se deja el hecho inicial con su fecha.
      perform public._libro_registrar('pago:' || p.id || ':PENDIENTE',
        case when public.beneficiario_pago(p.tipo) = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
        p.negocio_id, public._libro_categoria_pago(p.tipo), 'PAGO_PENDIENTE', 'INFORMATIVO', 'PENDIENTE', p.monto, p.created_at,
        'pago', p.id, p.id, null, p.reserva_id, public._libro_proveedor(p.pasarela), null, p.cuenta_cobro,
        'SISTEMA', null, jsonb_build_object('backfill', true));
    end if;
    perform public._libro_desde_pago(p, 'SISTEMA', null, true);
  end loop;
  if to_regclass('public.reembolso') is not null then
    for r in select * from public.reembolso loop
      perform public._libro_desde_reembolso(r, true);
    end loop;
  end if;
  -- Reembolsos anteriores a la 116 (pago marcado REEMBOLSADO sin fila en `reembolso`): el código
  -- de entonces no guardaba la confirmación de la pasarela, así que NO se registran como
  -- confirmados sino en revisión, para conciliarlos contra el proveedor.
  for p in select * from public.pago pg
            where pg.estado in ('REEMBOLSADO', 'REEMBOLSADO_PARCIAL')
              and not exists (select 1 from public.reembolso re where re.pago_id = pg.id) loop
    perform public._libro_registrar('pago:' || p.id || ':REEMBOLSO_HISTORICO',
      case when public.beneficiario_pago(p.tipo) = 'PLATAFORMA' then 'PLATAFORMA' else 'NEGOCIO' end,
      p.negocio_id, 'REEMBOLSO', 'REEMBOLSO_EN_REVISION', 'INFORMATIVO', 'REQUIERE_REVISION',
      coalesce(p.monto_reembolsado, p.monto), coalesce(p.updated_at, p.created_at), 'pago', p.id, p.id, null, p.reserva_id,
      public._libro_proveedor(p.pasarela), p.id_transaccion_pasarela, p.cuenta_cobro, 'SISTEMA', null,
      jsonb_build_object('backfill', true, 'motivo', p.motivo_reembolso, 'nota', 'reembolso anterior a la 116 sin confirmación guardada'));
  end loop;
end $$;
