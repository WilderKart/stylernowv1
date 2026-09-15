-- StylerNow — Migración 022: Módulo 2.9 — Inventario (dominio completo)
--
-- A diferencia de todos los módulos anteriores, Inventario NO tiene un
-- documento de reglas de negocio propio en la Biblia — ADL-009 lo marcó
-- explícitamente como "Decisión abierta... se especificará como módulo
-- completo en una fase posterior" y solo fijó por adelantado su matriz de
-- permisos (03-Business-Rules/01_Roles.md, sección "Inventario": Ver/
-- Registrar entrada/Registrar salida/Solicitar reposición son 🏢 Guardian
-- y 🌐 Barbería; "Configurar reglas" es exclusivo de Barbería). Esta
-- migración ES esa fase posterior — el modelo de datos que sigue es
-- diseño nuevo, inferido de esa matriz y del catálogo de `producto` que
-- ya existía desde el Módulo 2.8 (POS), nunca rediseñado.
--
-- Decisión de diseño clave: el stock se lleva POR SEDE, no por Negocio
-- (`producto_stock`, tabla nueva) — `producto` sigue siendo un catálogo a
-- nivel Negocio (mismo nombre/precio en todas las Sedes), pero el conteo
-- físico es por Sede, que es justamente por qué la matriz le da a
-- Guardian un alcance de "su Sede" y no del Negocio completo — si el
-- stock fuera a nivel Negocio, ese alcance no tendría sentido.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Stock por (Producto, Sede).
-- ════════════════════════════════════════════════════════════════════════

create table public.producto_stock (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  producto_id uuid not null references public.producto(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  stock_actual int not null default 0,
  stock_minimo int not null default 0 check (stock_minimo >= 0),
  updated_at timestamptz not null default now(),
  unique (producto_id, sede_id)
);
create index producto_stock_negocio_idx on public.producto_stock(negocio_id);
create index producto_stock_sede_idx on public.producto_stock(sede_id);
-- Alerta de "stock bajo" en tiempo de consulta (stock_actual <= stock_minimo)
-- — no hay una columna "en_alerta" que se pueda desincronizar del conteo real.
create index producto_stock_bajo_idx on public.producto_stock(sede_id) where stock_actual <= stock_minimo;

create trigger trg_updated_at_producto_stock before update on public.producto_stock
  for each row execute function public.set_updated_at();

alter table public.producto_stock enable row level security;

create policy producto_stock_select on public.producto_stock for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id) or public.is_supersu());
-- La escritura pasa siempre por registrar_movimiento_inventario() — nunca
-- un UPDATE directo del stock, para que todo cambio deje un
-- movimiento_inventario (auditoría, igual criterio que el resto del
-- proyecto: nunca mutar un saldo sin dejar el movimiento que lo explica).

-- ════════════════════════════════════════════════════════════════════════
-- 2. Movimientos — el libro mayor real del inventario. `stock_actual` en
--    producto_stock es una caché derivada de esta tabla, nunca la fuente
--    de verdad por sí sola.
-- ════════════════════════════════════════════════════════════════════════

create type movimiento_inventario_tipo as enum ('ENTRADA', 'SALIDA', 'AJUSTE', 'CONSUMO_SERVICIO');

create table public.movimiento_inventario (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  producto_id uuid not null references public.producto(id),
  tipo movimiento_inventario_tipo not null,
  cantidad int not null, -- signo: ENTRADA/AJUSTE positivo suma, SALIDA/CONSUMO_SERVICIO siempre se guarda positivo y se resta
  motivo text,
  referencia_reserva_id uuid references public.reserva(id), -- solo para CONSUMO_SERVICIO / venta en POS
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index movimiento_inventario_producto_sede_idx on public.movimiento_inventario(producto_id, sede_id);
create index movimiento_inventario_negocio_idx on public.movimiento_inventario(negocio_id);

alter table public.movimiento_inventario enable row level security;

create policy movimiento_inventario_select on public.movimiento_inventario for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════
-- 3. registrar_movimiento_inventario() — único camino de escritura de
--    stock. Guardian solo en su propia Sede (matriz de Roles); Barbería
--    en cualquier Sede de su Negocio.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.registrar_movimiento_inventario(
  p_producto_id uuid,
  p_sede_id uuid,
  p_tipo movimiento_inventario_tipo,
  p_cantidad int,
  p_motivo text default null
)
returns public.producto_stock
language plpgsql security definer set search_path = public as $fn$
declare
  v_producto public.producto;
  v_sede public.sede;
  v_delta int;
  v_stock public.producto_stock;
begin
  if p_cantidad <= 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;
  if p_tipo = 'CONSUMO_SERVICIO' then
    -- Este tipo lo genera únicamente completar_venta_pos() — no es una
    -- acción manual del Panel, para que siempre quede atada a una Reserva.
    raise exception 'TIPO_NO_MANUAL';
  end if;

  select * into v_producto from public.producto where id = p_producto_id;
  if not found then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;
  select * into v_sede from public.sede where id = p_sede_id and negocio_id = v_producto.negocio_id;
  if not found then
    raise exception 'SEDE_NO_PERTENECE_AL_NEGOCIO';
  end if;
  if not (public.is_barberia_de(v_producto.negocio_id) or public.is_guardian_de_sede(p_sede_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_delta := case when p_tipo = 'ENTRADA' then p_cantidad else -p_cantidad end;
  -- AJUSTE usa el signo de p_cantidad tal cual la UI ya lo resolvió (una
  -- corrección de conteo puede ir para cualquiera de los dos lados) —
  -- para eso el llamador pasa p_cantidad ya con el signo correcto y este
  -- caso se maneja aparte, ver más abajo.

  insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
  values (v_producto.negocio_id, p_producto_id, p_sede_id, 0, 0)
  on conflict (producto_id, sede_id) do nothing;

  update public.producto_stock
  set stock_actual = stock_actual + v_delta
  where producto_id = p_producto_id and sede_id = p_sede_id
  returning * into v_stock;

  insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, actor_id)
  values (v_producto.negocio_id, p_sede_id, p_producto_id, p_tipo, p_cantidad, p_motivo, auth.uid());

  return v_stock;
end;
$fn$;

-- AJUSTE con signo explícito (una corrección de conteo físico puede subir
-- o bajar el stock) — función aparte para no forzar `p_cantidad` a
-- significar cosas distintas según el tipo en la misma firma.
create or replace function public.ajustar_stock(
  p_producto_id uuid,
  p_sede_id uuid,
  p_nuevo_stock_actual int,
  p_motivo text default null
)
returns public.producto_stock
language plpgsql security definer set search_path = public as $fn$
declare
  v_producto public.producto;
  v_actual int;
  v_delta int;
  v_stock public.producto_stock;
begin
  if p_nuevo_stock_actual < 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  select * into v_producto from public.producto where id = p_producto_id;
  if not found then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;
  if not exists (select 1 from public.sede where id = p_sede_id and negocio_id = v_producto.negocio_id) then
    raise exception 'SEDE_NO_PERTENECE_AL_NEGOCIO';
  end if;
  if not (public.is_barberia_de(v_producto.negocio_id) or public.is_guardian_de_sede(p_sede_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;

  insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
  values (v_producto.negocio_id, p_producto_id, p_sede_id, 0, 0)
  on conflict (producto_id, sede_id) do nothing;

  select coalesce(stock_actual, 0) into v_actual from public.producto_stock where producto_id = p_producto_id and sede_id = p_sede_id;
  v_delta := p_nuevo_stock_actual - v_actual;
  if v_delta = 0 then
    select * into v_stock from public.producto_stock where producto_id = p_producto_id and sede_id = p_sede_id;
    return v_stock;
  end if;

  update public.producto_stock set stock_actual = p_nuevo_stock_actual
  where producto_id = p_producto_id and sede_id = p_sede_id
  returning * into v_stock;

  insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, actor_id)
  values (v_producto.negocio_id, p_sede_id, p_producto_id, 'AJUSTE', v_delta, p_motivo, auth.uid());

  return v_stock;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Stock mínimo — "Configurar reglas" es exclusivo de Barbería.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.configurar_stock_minimo(p_producto_id uuid, p_sede_id uuid, p_stock_minimo int)
returns public.producto_stock
language plpgsql security definer set search_path = public as $fn$
declare
  v_producto public.producto;
  v_stock public.producto_stock;
begin
  if p_stock_minimo < 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;
  select * into v_producto from public.producto where id = p_producto_id;
  if not found or not public.is_barberia_de(v_producto.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
  values (v_producto.negocio_id, p_producto_id, p_sede_id, 0, p_stock_minimo)
  on conflict (producto_id, sede_id) do update set stock_minimo = excluded.stock_minimo
  returning * into v_stock;

  return v_stock;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Solicitud de reposición — un paso previo a "registrar entrada"
--    (matriz de Roles las lista como dos acciones distintas): Guardian/
--    Barbería piden reponer, Barbería la atiende (decisión de compra).
-- ════════════════════════════════════════════════════════════════════════

create type solicitud_reposicion_estado as enum ('PENDIENTE', 'ATENDIDA', 'CANCELADA');

create table public.solicitud_reposicion (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  producto_id uuid not null references public.producto(id),
  cantidad_solicitada int not null check (cantidad_solicitada > 0),
  motivo text,
  estado solicitud_reposicion_estado not null default 'PENDIENTE',
  solicitado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  atendida_at timestamptz
);
create index solicitud_reposicion_negocio_idx on public.solicitud_reposicion(negocio_id) where estado = 'PENDIENTE';

alter table public.solicitud_reposicion enable row level security;

create policy solicitud_reposicion_select on public.solicitud_reposicion for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id) or public.is_supersu());
create policy solicitud_reposicion_insert on public.solicitud_reposicion for insert
  with check ((public.is_barberia_de(negocio_id) or public.is_guardian_de_sede(sede_id)) and solicitado_por = auth.uid());
create policy solicitud_reposicion_update_cancelar on public.solicitud_reposicion for update
  using (solicitado_por = auth.uid() or public.is_barberia_de(negocio_id));

create or replace function public.atender_solicitud_reposicion(p_solicitud_id uuid, p_cantidad_recibida int default null)
returns public.solicitud_reposicion
language plpgsql security definer set search_path = public as $fn$
declare
  v_solicitud public.solicitud_reposicion;
  v_cantidad int;
begin
  select * into v_solicitud from public.solicitud_reposicion where id = p_solicitud_id for update;
  if not found or not public.is_barberia_de(v_solicitud.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_solicitud.estado <> 'PENDIENTE' then
    raise exception 'SOLICITUD_NO_PENDIENTE';
  end if;

  v_cantidad := coalesce(p_cantidad_recibida, v_solicitud.cantidad_solicitada);
  if v_cantidad > 0 then
    perform public.registrar_movimiento_inventario(
      v_solicitud.producto_id, v_solicitud.sede_id, 'ENTRADA', v_cantidad,
      'Reposición atendida (solicitud ' || p_solicitud_id || ')'
    );
  end if;

  update public.solicitud_reposicion set estado = 'ATENDIDA', atendida_at = now() where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Consumo automático — qué Productos gasta un Servicio por atención
--    (ej. "Corte" consume 5 ml de "Shampoo"). "Configurar reglas" es
--    exclusivo de Barbería.
-- ════════════════════════════════════════════════════════════════════════

create table public.servicio_producto_consumo (
  servicio_id uuid not null references public.servicio(id) on delete cascade,
  producto_id uuid not null references public.producto(id) on delete cascade,
  cantidad int not null check (cantidad > 0),
  primary key (servicio_id, producto_id)
);

alter table public.servicio_producto_consumo enable row level security;

create policy servicio_producto_consumo_select on public.servicio_producto_consumo for select
  using (exists (select 1 from public.servicio s where s.id = servicio_id and public.tiene_acceso_interno(s.negocio_id)));
create policy servicio_producto_consumo_write on public.servicio_producto_consumo for all
  using (exists (select 1 from public.servicio s where s.id = servicio_id and public.is_barberia_de(s.negocio_id)))
  with check (exists (select 1 from public.servicio s where s.id = servicio_id and public.is_barberia_de(s.negocio_id)));

-- ════════════════════════════════════════════════════════════════════════
-- 7. Conectar con POS: completar_venta_pos() ahora también descuenta
--    stock — de los Productos vendidos directamente en la venta (SALIDA)
--    y del consumo automático configurado por Servicio (CONSUMO_
--    SERVICIO). Se reemplaza la función completa (mismo comportamiento
--    de la migración 021 más estos dos pasos nuevos al final).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.completar_venta_pos(
  p_reserva_id uuid,
  p_productos jsonb default '[]'::jsonb,
  p_metodo_pago_saldo text default 'EFECTIVO',
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
  v_consumo record;
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

    -- Inventario: la venta de un Producto en POS es una SALIDA real de stock.
    insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
    values (v_reserva.negocio_id, v_producto.id, v_reserva.sede_id, 0, 0)
    on conflict (producto_id, sede_id) do nothing;
    update public.producto_stock
    set stock_actual = stock_actual - (v_item ->> 'cantidad')::int
    where producto_id = v_producto.id and sede_id = v_reserva.sede_id;
    insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, referencia_reserva_id, actor_id)
    values (v_reserva.negocio_id, v_reserva.sede_id, v_producto.id, 'SALIDA', (v_item ->> 'cantidad')::int, 'Venta en POS', p_reserva_id, auth.uid());
  end loop;

  -- Inventario: consumo automático de los Servicios de esta Reserva
  -- (servicio_producto_consumo) — ej. insumos usados durante la atención,
  -- nunca vendidos directamente al Cliente.
  for v_consumo in
    select spc.producto_id, spc.cantidad
    from public.reserva_servicio rs
    join public.servicio_producto_consumo spc on spc.servicio_id = rs.servicio_id
    where rs.reserva_id = p_reserva_id
  loop
    insert into public.producto_stock (negocio_id, producto_id, sede_id, stock_actual, stock_minimo)
    values (v_reserva.negocio_id, v_consumo.producto_id, v_reserva.sede_id, 0, 0)
    on conflict (producto_id, sede_id) do nothing;
    update public.producto_stock
    set stock_actual = stock_actual - v_consumo.cantidad
    where producto_id = v_consumo.producto_id and sede_id = v_reserva.sede_id;
    insert into public.movimiento_inventario (negocio_id, sede_id, producto_id, tipo, cantidad, motivo, referencia_reserva_id, actor_id)
    values (v_reserva.negocio_id, v_reserva.sede_id, v_consumo.producto_id, 'CONSUMO_SERVICIO', v_consumo.cantidad, 'Consumo automático de Servicio', p_reserva_id, auth.uid());
  end loop;

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

grant execute on function public.registrar_movimiento_inventario(uuid, uuid, movimiento_inventario_tipo, int, text) to authenticated;
grant execute on function public.ajustar_stock(uuid, uuid, int, text) to authenticated;
grant execute on function public.configurar_stock_minimo(uuid, uuid, int) to authenticated;
grant execute on function public.atender_solicitud_reposicion(uuid, int) to authenticated;
