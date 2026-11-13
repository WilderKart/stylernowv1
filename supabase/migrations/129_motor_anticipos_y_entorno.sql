-- 129 · Motor de anticipos independiente del proveedor + separación de entorno (sandbox/producción).
--
-- Directiva "Anticipos, Mercado Pago Sandbox y devoluciones", etapas 2, 4 y 8 (2026-11-12).
-- Sin aplicar en producción. Aditiva y re-ejecutable.
--
-- Anticipos (independientes de Mercado Pago):
--  * `negocio.anticipo_modo`: OBLIGATORIO (comportamiento actual, default), OPCIONAL (el cliente elige
--    pagarlo o reservar sin anticipo) o NINGUNO.
--  * Reglas por servicio: `servicio.anticipo_pct` / `servicio.anticipo_monto_fijo` (anulan la regla del
--    negocio para ese servicio). `calcular_sena_servicios` calcula el anticipo de la reserva completa.
--  * Validación de la configuración en la base (porcentaje 0–100, montos ≥ 0, máximo ≥ mínimo) para
--    cualquier vía de escritura, y RPC auditada `configurar_anticipo` para el panel.
--  * `confirmar_reserva_sin_anticipo`: solo con modo OPCIONAL, solo el cliente dueño de la reserva.
--  * La reserva sigue confirmándose ÚNICAMENTE con pago verificado por el proveedor (o sin anticipo).
--
-- Entorno: `pago.entorno` (SANDBOX/PRODUCCION), fijado por el servidor al crear el cobro e inmutable.
-- El libro financiero guarda en `detalle` el entorno, el medio de pago, la comisión del proveedor y el
-- neto recibido según la respuesta del proveedor (evidencia; StylerNow no calcula ni retiene nada).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Configuración del anticipo
-- ════════════════════════════════════════════════════════════════════════

alter table public.negocio add column if not exists anticipo_modo text not null default 'OBLIGATORIO';
alter table public.negocio drop constraint if exists negocio_anticipo_modo_valido;
alter table public.negocio add constraint negocio_anticipo_modo_valido
  check (anticipo_modo in ('OBLIGATORIO', 'OPCIONAL', 'NINGUNO'));
-- NOT VALID: se exige en toda escritura nueva sin reprocesar los datos existentes.
alter table public.negocio drop constraint if exists negocio_anticipo_valores_validos;
alter table public.negocio add constraint negocio_anticipo_valores_validos check (
  (sena_pct is null or sena_pct between 0 and 100)
  and (sena_monto_fijo is null or sena_monto_fijo >= 0)
  and sena_minimo >= 0 and sena_maximo >= sena_minimo) not valid;

-- En producción `negocio` se lee por columnas (114): la columna nueva necesita su permiso explícito,
-- igual que las demás columnas públicas del anticipo (sena_pct, sena_minimo, pago_completo_en_app…).
grant select (anticipo_modo) on public.negocio to anon, authenticated;

alter table public.servicio
  add column if not exists anticipo_pct numeric(5,2),
  add column if not exists anticipo_monto_fijo numeric(12,2);
alter table public.servicio drop constraint if exists servicio_anticipo_valido;
alter table public.servicio add constraint servicio_anticipo_valido check (
  (anticipo_pct is null or anticipo_pct between 0 and 100)
  and (anticipo_monto_fijo is null or anticipo_monto_fijo >= 0)) not valid;

create or replace function public.configurar_anticipo(
  p_negocio_id uuid, p_modo text, p_pct numeric, p_monto_fijo numeric, p_minimo numeric, p_maximo numeric,
  p_pago_completo boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (coalesce(public.is_barberia_de(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_modo not in ('OBLIGATORIO', 'OPCIONAL', 'NINGUNO') then raise exception 'ANTICIPO_MODO_INVALIDO'; end if;
  if (p_pct is not null and (p_pct < 0 or p_pct > 100)) or (p_monto_fijo is not null and p_monto_fijo < 0)
     or p_minimo is null or p_maximo is null or p_minimo < 0 or p_maximo < p_minimo then
    raise exception 'ANTICIPO_VALORES_INVALIDOS';
  end if;

  select jsonb_build_object('modo', anticipo_modo, 'pct', sena_pct, 'fijo', sena_monto_fijo, 'minimo', sena_minimo,
                            'maximo', sena_maximo, 'pago_completo', pago_completo_en_app)
    into v_antes from public.negocio where id = p_negocio_id for update;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;

  -- Aplica a reservas nuevas: las ya creadas conservan el anticipo con que se crearon.
  update public.negocio
     set anticipo_modo = p_modo, sena_pct = p_pct, sena_monto_fijo = p_monto_fijo,
         sena_minimo = round(p_minimo, 0), sena_maximo = round(p_maximo, 0), pago_completo_en_app = coalesce(p_pago_completo, false)
   where id = p_negocio_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'ANTICIPO_CONFIGURADO',
          case when coalesce(public.is_supersu(), false) then 'SUPERSU' else 'BARBERIA' end, auth.uid(), p_negocio_id, p_motivo, v_antes,
          jsonb_build_object('modo', p_modo, 'pct', p_pct, 'fijo', p_monto_fijo, 'minimo', round(p_minimo, 0),
                             'maximo', round(p_maximo, 0), 'pago_completo', coalesce(p_pago_completo, false)));
end $$;
revoke all on function public.configurar_anticipo(uuid, text, numeric, numeric, numeric, numeric, boolean, text) from public, anon, authenticated;
grant execute on function public.configurar_anticipo(uuid, text, numeric, numeric, numeric, numeric, boolean, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Cálculo del anticipo de una reserva (negocio + reglas por servicio)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.calcular_sena_servicios(p_negocio_id uuid, p_servicio_ids uuid[], p_monto_total numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  n public.negocio;
  v_override numeric := 0;
  v_subtotal_sin_regla numeric := 0;
  v_hay_override boolean := false;
  v numeric;
begin
  select * into n from public.negocio where id = p_negocio_id;
  if not found then raise exception 'NEGOCIO_NO_DISPONIBLE'; end if;
  if n.anticipo_modo = 'NINGUNO' then return 0; end if;
  if not public.negocio_cobra_en_linea(p_negocio_id) then return 0; end if;  -- 119: nunca a la cuenta de StylerNow
  if n.pago_completo_en_app then return p_monto_total; end if;

  select coalesce(sum(case when s.anticipo_monto_fijo is not null then least(s.anticipo_monto_fijo, s.precio_base)
                           when s.anticipo_pct is not null then round(s.precio_base * s.anticipo_pct / 100) end), 0),
         coalesce(sum(case when s.anticipo_monto_fijo is null and s.anticipo_pct is null then s.precio_base end), 0),
         bool_or(s.anticipo_monto_fijo is not null or s.anticipo_pct is not null)
    into v_override, v_subtotal_sin_regla, v_hay_override
    from public.servicio s
   where s.id = any(coalesce(p_servicio_ids, '{}')) and s.negocio_id = p_negocio_id;

  if not coalesce(v_hay_override, false) then
    return public.calcular_sena(p_negocio_id, p_monto_total);   -- regla del negocio (comportamiento previo)
  end if;

  v := v_override;
  if v_subtotal_sin_regla > 0 then
    v := v + coalesce(n.sena_monto_fijo, round(v_subtotal_sin_regla * coalesce(n.sena_pct, 20) / 100));
  end if;
  v := greatest(v, n.sena_minimo);
  v := least(v, n.sena_maximo);
  return least(v, p_monto_total);   -- nunca supera el total
end $$;
revoke all on function public.calcular_sena_servicios(uuid, uuid[], numeric) from public;
grant execute on function public.calcular_sena_servicios(uuid, uuid[], numeric) to anon, authenticated, service_role;

-- crear_reserva / crear_reserva_manual pasan a usar el cálculo con reglas por servicio (parche verificado).
do $$
declare r record; v_def text; v_viejo text := 'public.calcular_sena(v_negocio.id, v_monto_total)';
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('crear_reserva', 'crear_reserva_manual')
  loop
    v_def := pg_get_functiondef(r.oid);
    if position('calcular_sena_servicios' in v_def) > 0 then continue; end if;
    if position(v_viejo in v_def) = 0 then
      raise exception '%: no se encontró el cálculo del anticipo; revisar el parche de la 129 a mano', r.proname;
    end if;
    execute replace(v_def, v_viejo, 'public.calcular_sena_servicios(v_negocio.id, p_servicio_ids, v_monto_total)');
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Anticipo opcional: el cliente reserva sin pagarlo
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.confirmar_reserva_sin_anticipo(p_reserva_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reserva; v_modo text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id for update;
  if not found or r.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if r.estado <> 'PENDIENTE_PAGO' then raise exception 'RESERVA_NO_PAGABLE'; end if;
  if r.expira_at is not null and r.expira_at < now() then raise exception 'RESERVA_NO_PAGABLE'; end if;
  select anticipo_modo into v_modo from public.negocio where id = r.negocio_id;
  if v_modo is distinct from 'OPCIONAL' then raise exception 'ANTICIPO_OBLIGATORIO'; end if;
  -- Un pago ya aprobado manda: no se "des-paga" una reserva.
  if exists (select 1 from public.pago where reserva_id = r.id and tipo = 'SENA' and estado = 'APROBADO') then
    raise exception 'PAGO_YA_PROCESADO';
  end if;

  update public.reserva set estado = 'CONFIRMADA', monto_sena = 0, expira_at = null, updated_at = now() where id = r.id;
  -- Si después llega la aprobación de un cobro iniciado, aplicar_evento_pago lo reembolsa (reserva no pendiente).
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('reserva', r.id, 'RESERVA_CONFIRMADA_SIN_ANTICIPO', 'CLIENTE', auth.uid(), r.negocio_id,
          jsonb_build_object('anticipo_calculado', r.monto_sena));
end $$;
revoke all on function public.confirmar_reserva_sin_anticipo(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_reserva_sin_anticipo(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Entorno del pago (sandbox / producción)
-- ════════════════════════════════════════════════════════════════════════

alter table public.pago add column if not exists entorno text;
alter table public.pago drop constraint if exists pago_entorno_valido;
alter table public.pago add constraint pago_entorno_valido check (entorno is null or entorno in ('SANDBOX', 'PRODUCCION'));

create or replace function public.trg_pago_entorno_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  if old.entorno is not null and new.entorno is distinct from old.entorno then
    raise exception 'PAGO_CAMPO_INMUTABLE';
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_entorno_inmutable() from public, anon, authenticated;
drop trigger if exists trg_pago_entorno_inmutable on public.pago;
create trigger trg_pago_entorno_inmutable before update on public.pago
  for each row execute function public.trg_pago_entorno_inmutable();

-- ════════════════════════════════════════════════════════════════════════
-- 5. Libro: evidencia del proveedor en el detalle (entorno, medio, comisión del proveedor, neto)
-- ════════════════════════════════════════════════════════════════════════

-- Extrae del payload guardado por el servidor (respuesta de la API del proveedor) solo datos financieros.
create or replace function public._libro_evidencia_pago(p public.pago)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'entorno', p.entorno,
    'metodo_pago', p.payload_pasarela->>'payment_method_id',
    'tipo_metodo', p.payload_pasarela->>'payment_type_id',
    'live_mode', p.payload_pasarela->'live_mode',
    'comision_proveedor', (select sum((f->>'amount')::numeric) from jsonb_array_elements(coalesce(p.payload_pasarela->'fee_details', '[]'::jsonb)) f
                            where coalesce(f->>'type', '') <> 'application_fee'),
    'comision_stylernow_proveedor', (select sum((f->>'amount')::numeric) from jsonb_array_elements(coalesce(p.payload_pasarela->'fee_details', '[]'::jsonb)) f
                            where f->>'type' = 'application_fee'),
    'valor_neto_proveedor', (p.payload_pasarela->>'net_received_amount')::numeric,
    'cuenta_vendedor', p.payload_pasarela->>'collector_id'));
$$;
revoke all on function public._libro_evidencia_pago(public.pago) from public, anon, authenticated;

-- Re-define _libro_desde_pago (misma firma que la 122) agregando la evidencia al detalle.
do $$
declare v_def text := pg_get_functiondef('public._libro_desde_pago(public.pago,text,uuid,boolean)'::regprocedure);
begin
  if position('_libro_evidencia_pago' in v_def) > 0 then return; end if;
  if position('v_det jsonb := jsonb_build_object(''tipo_pago'', p.tipo, ''metodo'', p.pasarela, ''backfill'', p_backfill);' in v_def) = 0 then
    raise exception '_libro_desde_pago cambió: revisar el parche de la 129 a mano';
  end if;
  execute replace(v_def,
    'v_det jsonb := jsonb_build_object(''tipo_pago'', p.tipo, ''metodo'', p.pasarela, ''backfill'', p_backfill);',
    'v_det jsonb := jsonb_build_object(''tipo_pago'', p.tipo, ''metodo'', p.pasarela, ''backfill'', p_backfill) || public._libro_evidencia_pago(p);');
end $$;
revoke all on function public._libro_desde_pago(public.pago, text, uuid, boolean) from public, anon, authenticated, service_role;
