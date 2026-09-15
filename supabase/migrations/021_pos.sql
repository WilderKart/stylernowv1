-- StylerNow — Migración 021: Módulo 2.8 — POS / Caja (dominio completo)
-- Fuente: 02-UX/09_Business_Panel.md ("Caja/POS"), 03-Business-Rules/
-- 03_Payment_Rules.md ("Saldo — cobrado por el Negocio directamente en
-- Sede: efectivo, datáfono propio, u otro medio ajeno a StylerNow"),
-- 03-Business-Rules/04_Loyalty.md (acumulación/canje de Puntos).
--
-- Hallazgo real durante el diseño de este módulo (igual que
-- `staff_servicio` en el Módulo 2.5): `punto_fidelizacion` tenía tabla y
-- RLS de lectura desde el Módulo 1, pero NINGÚN código otorgaba Puntos
-- todavía — el sistema de fidelización existía en el esquema pero nunca
-- se había activado. Esta migración es la primera vez que se otorgan
-- Puntos de verdad (al completar una venta) y la primera vez que se
-- canjean.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Configuración de Puntos por Negocio (04_Loyalty.md: "El Negocio
--    configura la tasa de canje... y la expiración", con rango 6-24 meses).
-- ════════════════════════════════════════════════════════════════════════

alter table public.negocio
  add column if not exists puntos_valor_100_cop numeric(12,2) not null default 5000 check (puntos_valor_100_cop > 0),
  add column if not exists puntos_expiracion_meses int not null default 12 check (puntos_expiracion_meses between 6 and 24);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Catálogo de Productos físicos — mínimo para POS; Inventario (2.9)
--    extiende esta misma tabla con stock, sin rediseñarla.
-- ════════════════════════════════════════════════════════════════════════

create table public.producto (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  nombre text not null,
  precio numeric(12,2) not null check (precio >= 0),
  estado servicio_estado not null default 'ACTIVO', -- mismo enum ACTIVO/INACTIVO que servicio, mismo significado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index producto_negocio_idx on public.producto(negocio_id);
create trigger trg_updated_at_producto before update on public.producto
  for each row execute function public.set_updated_at();

alter table public.producto enable row level security;

create policy producto_select_interno on public.producto for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy producto_write_barberia_guardian on public.producto for all
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id))
  with check (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id));

-- ════════════════════════════════════════════════════════════════════════
-- 3. Venta de producto durante la atención (02-UX/09_Business_Panel.md:
--    "venta de Servicio adicional o producto físico durante la
--    atención"). Solo lectura directa vía RLS — la escritura pasa
--    siempre por completar_venta_pos(), nunca un INSERT suelto (así el
--    total nunca queda desincronizado del cierre de caja).
-- ════════════════════════════════════════════════════════════════════════

create table public.venta_producto (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  reserva_id uuid not null references public.reserva(id) on delete cascade,
  producto_id uuid not null references public.producto(id),
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  created_at timestamptz not null default now()
);
create index venta_producto_negocio_idx on public.venta_producto(negocio_id);
create index venta_producto_reserva_idx on public.venta_producto(reserva_id);

alter table public.venta_producto enable row level security;

create policy venta_producto_select_interno on public.venta_producto for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- 4. completar_venta_pos() — el corazón del módulo: registra productos,
--    canjea Puntos (FIFO, nunca deja el saldo bajo $0 — 04_Loyalty.md),
--    cobra el Saldo restante (efectivo/datáfono propio — 03_Payment_
--    Rules.md), registra Propina, marca la Reserva COMPLETADA, y OTORGA
--    Puntos nuevos (10 por cada $10.000 del valor del Servicio —
--    04_Loyalty.md). Todo en una sola transacción.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.completar_venta_pos(
  p_reserva_id uuid,
  p_productos jsonb default '[]'::jsonb, -- [{"producto_id": uuid, "cantidad": int}, ...]
  p_metodo_pago_saldo text default 'EFECTIVO', -- 'EFECTIVO' | 'DATAFONO_PROPIO'
  p_propina numeric default 0,
  p_metodo_pago_propina text default 'EFECTIVO',
  p_puntos_a_canjear int default 0
)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_autorizado boolean;
  v_item jsonb;
  v_producto public.producto;
  v_total_productos numeric := 0;
  v_saldo_servicio numeric;
  v_descuento_puntos numeric := 0;
  v_puntos_restantes int := coalesce(p_puntos_a_canjear, 0);
  v_lote record;
  v_consumir int;
  v_saldo_final numeric;
  v_puntos_otorgados int;
begin
  if p_metodo_pago_saldo not in ('EFECTIVO', 'DATAFONO_PROPIO') then
    raise exception 'METODO_PAGO_INVALIDO';
  end if;
  if p_puntos_a_canjear < 0 or p_propina < 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  v_autorizado := public.is_barberia_de(v_reserva.negocio_id)
    or public.is_guardian_de_sede(v_reserva.sede_id)
    or v_reserva.staff_id = auth.uid();
  if not v_autorizado then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_reserva.estado not in ('CONFIRMADA', 'EN_CURSO') then
    raise exception 'RESERVA_NO_COMPLETABLE';
  end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;

  for v_item in select * from jsonb_array_elements(p_productos)
  loop
    select * into v_producto from public.producto
      where id = (v_item ->> 'producto_id')::uuid and negocio_id = v_reserva.negocio_id and estado = 'ACTIVO';
    if not found then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;
    insert into public.venta_producto (negocio_id, reserva_id, producto_id, cantidad, precio_unitario)
    values (v_reserva.negocio_id, p_reserva_id, v_producto.id, (v_item ->> 'cantidad')::int, v_producto.precio);
    v_total_productos := v_total_productos + v_producto.precio * (v_item ->> 'cantidad')::int;
  end loop;

  -- Saldo (03_Payment_Rules.md): resto del Servicio ya descontada la Seña,
  -- más lo vendido en Productos durante la atención.
  v_saldo_servicio := greatest(v_reserva.monto_total - v_reserva.monto_sena, 0) + v_total_productos;

  if p_puntos_a_canjear > 0 then
    for v_lote in
      select * from public.punto_fidelizacion
      where cliente_id = v_reserva.cliente_id and negocio_id = v_reserva.negocio_id
        and cantidad_disponible > 0 and fecha_expiracion > now()
      order by fecha_otorgamiento asc
      for update
    loop
      exit when v_puntos_restantes <= 0;
      v_consumir := least(v_puntos_restantes, v_lote.cantidad_disponible);
      update public.punto_fidelizacion set cantidad_disponible = cantidad_disponible - v_consumir where id = v_lote.id;
      v_puntos_restantes := v_puntos_restantes - v_consumir;
    end loop;
    -- Nunca deja el valor a pagar por debajo de $0 — el excedente de Puntos
    -- solicitado que no alcanzó a cubrirse permanece en el saldo del Cliente
    -- (no se consumió, porque el bucle ya paró de descontar cantidad_disponible).
    v_descuento_puntos := least(
      (p_puntos_a_canjear - v_puntos_restantes)::numeric / 100 * v_negocio.puntos_valor_100_cop,
      v_saldo_servicio
    );
  end if;

  v_saldo_final := greatest(v_saldo_servicio - v_descuento_puntos, 0);

  if v_saldo_final > 0 then
    insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, pasarela)
    values (p_reserva_id, v_reserva.negocio_id, 'SALDO', v_saldo_final, 'APROBADO', p_metodo_pago_saldo);
  end if;

  if p_propina > 0 then
    insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, pasarela, staff_destino_id)
    values (p_reserva_id, v_reserva.negocio_id, 'PROPINA', p_propina, 'APROBADO', p_metodo_pago_propina, v_reserva.staff_id);
  end if;

  update public.reserva set estado = 'COMPLETADA', updated_at = now() where id = p_reserva_id;

  -- Otorgamiento de Puntos (04_Loyalty.md: "10 puntos por cada $10.000 COP
  -- del valor total pagado") — sobre el valor del Servicio (monto_total),
  -- nunca sobre Productos: la regla de acumulación es explícita, "Reserva
  -- completada", no "venta completada".
  v_puntos_otorgados := floor(v_reserva.monto_total / 10000) * 10;
  if v_puntos_otorgados > 0 then
    insert into public.punto_fidelizacion (cliente_id, negocio_id, cantidad, cantidad_disponible, fecha_expiracion, origen)
    values (
      v_reserva.cliente_id, v_reserva.negocio_id, v_puntos_otorgados, v_puntos_otorgados,
      now() + make_interval(months => v_negocio.puntos_expiracion_meses),
      'RESERVA_COMPLETADA:' || p_reserva_id
    );
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values (
    'reserva', p_reserva_id, 'VENTA_POS_COMPLETADA', 'BARBERIA', auth.uid(), v_reserva.negocio_id,
    jsonb_build_object(
      'saldo_cobrado', v_saldo_final, 'propina', p_propina,
      'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes, 'puntos_otorgados', v_puntos_otorgados
    )
  );

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'saldo_cobrado', v_saldo_final,
    'descuento_puntos', v_descuento_puntos,
    'propina', p_propina,
    'puntos_canjeados', p_puntos_a_canjear - v_puntos_restantes,
    'puntos_otorgados', v_puntos_otorgados
  );
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Cierre de caja del día — efectivo vs. digital, total (02-UX/
--    09_Business_Panel.md). "Digital" agrupa todo lo que no es EFECTIVO
--    (datáfono propio, y la Seña ya cobrada por Mercado Pago).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.cierre_caja_dia(p_negocio_id uuid, p_sede_id uuid default null, p_fecha date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_autorizado boolean;
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_inicio timestamptz;
  v_fin timestamptz;
  v_efectivo numeric;
  v_digital numeric;
  v_total numeric;
begin
  if p_sede_id is not null then
    v_autorizado := public.is_barberia_de(p_negocio_id) or public.is_guardian_de_sede(p_sede_id);
  else
    v_autorizado := public.is_barberia_de(p_negocio_id);
  end if;
  if not v_autorizado then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_inicio := v_fecha::timestamp at time zone 'America/Bogota';
  v_fin := (v_fecha + 1)::timestamp at time zone 'America/Bogota';

  select
    coalesce(sum(p.monto) filter (where p.pasarela = 'EFECTIVO'), 0),
    coalesce(sum(p.monto) filter (where p.pasarela <> 'EFECTIVO'), 0),
    coalesce(sum(p.monto), 0)
  into v_efectivo, v_digital, v_total
  from public.pago p
  join public.reserva r on r.id = p.reserva_id
  where p.negocio_id = p_negocio_id
    and p.estado = 'APROBADO'
    and p.tipo in ('SALDO', 'PROPINA', 'SENA')
    and p.created_at >= v_inicio and p.created_at < v_fin
    and (p_sede_id is null or r.sede_id = p_sede_id);

  return jsonb_build_object('fecha', v_fecha, 'efectivo', v_efectivo, 'digital', v_digital, 'total', v_total);
end;
$fn$;

grant execute on function public.completar_venta_pos(uuid, jsonb, text, numeric, text, int) to authenticated;
grant execute on function public.cierre_caja_dia(uuid, uuid, date) to authenticated;
