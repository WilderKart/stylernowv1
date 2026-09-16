-- StylerNow — Migración 056: Dominio LEALTAD (ADR-011) — Módulos 4, 5, 6,
-- 11: Referidos (Cliente y Staff), Sellos digitales, Cashback.
-- La finalización automática de estos tres (al completar la primera
-- Reserva pagada) ya vive en completar_venta_pos() desde la migración
-- 053 — acá van la generación del código, el registro del referido al
-- signup, y toda la configuración por Negocio.

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 4 — Referidos de Cliente
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.obtener_mi_codigo_referido()
returns public.referido_codigo
language plpgsql security definer set search_path = public as $fn$
declare
  v_codigo public.referido_codigo;
begin
  select * into v_codigo from public.referido_codigo where cliente_id = auth.uid();
  if not found then
    insert into public.referido_codigo (cliente_id, codigo)
    values (auth.uid(), upper(substr(replace(auth.uid()::text, '-', ''), 1, 8)))
    returning * into v_codigo;
  end if;
  return v_codigo;
end;
$fn$;
grant execute on function public.obtener_mi_codigo_referido() to authenticated;

-- Se llama una sola vez, en el signup del Cliente nuevo (antes de su
-- primera Reserva) — un Cliente solo puede haber sido referido una vez
-- (unique en referido.referido_cliente_id), y nunca puede referirse a sí
-- mismo (motor antifraude, ABUSO_REFERIDO).
create or replace function public.registrar_referido(p_codigo text, p_negocio_id uuid default null)
returns public.referido
language plpgsql security definer set search_path = public as $fn$
declare
  v_codigo public.referido_codigo;
  v_referido public.referido;
begin
  select * into v_codigo from public.referido_codigo where codigo = upper(trim(p_codigo));
  if not found then raise exception 'CODIGO_INVALIDO'; end if;
  if v_codigo.cliente_id = auth.uid() then
    insert into public.lealtad_fraude_evento (tipo, cliente_id, negocio_id, severidad, payload)
    values ('ABUSO_REFERIDO', auth.uid(), p_negocio_id, 'ALTA', jsonb_build_object('motivo', 'AUTO_REFERIDO', 'codigo', p_codigo));
    raise exception 'NO_PUEDES_REFERIRTE_A_TI_MISMO';
  end if;
  if exists (select 1 from public.referido where referido_cliente_id = auth.uid())
     or exists (select 1 from public.staff_referido where cliente_referido_id = auth.uid()) then
    raise exception 'YA_FUE_REFERIDO';
  end if;

  insert into public.referido (referido_codigo_id, referente_cliente_id, referido_cliente_id, negocio_id)
  values (v_codigo.id, v_codigo.cliente_id, auth.uid(), p_negocio_id)
  returning * into v_referido;

  return v_referido;
end;
$fn$;
grant execute on function public.registrar_referido(text, uuid) to authenticated;

create or replace function public.mis_referidos()
returns table (id uuid, estado referido_estado, monto_recompensa numeric, created_at timestamptz, completado_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select r.id, r.estado, r.monto_recompensa, r.created_at, r.completado_at
  from public.referido r where r.referente_cliente_id = auth.uid()
  order by r.created_at desc;
$fn$;
grant execute on function public.mis_referidos() to authenticated;

create or replace function public.configurar_referidos(p_negocio_id uuid, p_monto numeric, p_porcentaje numeric, p_limite_mensual int, p_vigencia_dias int, p_activo boolean)
returns public.referido_config
language plpgsql security definer set search_path = public as $fn$
declare
  v_config public.referido_config;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(p_monto, 0) = 0 and coalesce(p_porcentaje, 0) = 0 then raise exception 'RECOMPENSA_REQUERIDA'; end if;

  insert into public.referido_config (negocio_id, monto, porcentaje, limite_mensual, vigencia_dias, activo)
  values (p_negocio_id, p_monto, p_porcentaje, p_limite_mensual, coalesce(p_vigencia_dias, 90), p_activo)
  on conflict (negocio_id) do update set
    monto = excluded.monto, porcentaje = excluded.porcentaje, limite_mensual = excluded.limite_mensual,
    vigencia_dias = excluded.vigencia_dias, activo = excluded.activo
  returning * into v_config;

  return v_config;
end;
$fn$;
grant execute on function public.configurar_referidos(uuid, numeric, numeric, int, int, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 11 — Referidos de Staff (mismo signup, tabla separada — un
-- Cliente activa UNA sola ruta, nunca ambas, chequeado arriba y en
-- completar_venta_pos()).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.registrar_referido_staff(p_negocio_id uuid, p_cliente_referido_id uuid, p_recompensa_tipo text, p_recompensa_monto numeric)
returns public.staff_referido
language plpgsql security definer set search_path = public as $fn$
declare
  v_staff_referido public.staff_referido;
begin
  if not public.is_staff_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_recompensa_tipo not in ('DINERO', 'PUNTOS', 'RECONOCIMIENTO') then raise exception 'RECOMPENSA_TIPO_INVALIDO'; end if;
  if exists (select 1 from public.referido where referido_cliente_id = p_cliente_referido_id)
     or exists (select 1 from public.staff_referido where cliente_referido_id = p_cliente_referido_id) then
    raise exception 'CLIENTE_YA_REFERIDO';
  end if;

  insert into public.staff_referido (staff_id, negocio_id, cliente_referido_id, recompensa_tipo, recompensa_monto)
  values (auth.uid(), p_negocio_id, p_cliente_referido_id, p_recompensa_tipo, p_recompensa_monto)
  returning * into v_staff_referido;

  return v_staff_referido;
end;
$fn$;
grant execute on function public.registrar_referido_staff(uuid, uuid, text, numeric) to authenticated;

create or replace function public.mis_referidos_staff(p_negocio_id uuid)
returns table (id uuid, estado referido_estado, recompensa_tipo text, recompensa_monto numeric, created_at timestamptz, completado_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select sr.id, sr.estado, sr.recompensa_tipo, sr.recompensa_monto, sr.created_at, sr.completado_at
  from public.staff_referido sr where sr.staff_id = auth.uid() and sr.negocio_id = p_negocio_id
  order by sr.created_at desc;
$fn$;
grant execute on function public.mis_referidos_staff(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 5 — Sellos digitales (otorgamiento automático ya vive en
-- completar_venta_pos(), migración 053)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_campana_sellos(p_negocio_id uuid, p_nombre text, p_sellos_requeridos int, p_recompensa_descripcion text, p_servicio_ids uuid[] default '{}', p_vencimiento_dias int default null)
returns public.sello_campana
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.sello_campana;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_sellos_requeridos <= 0 then raise exception 'SELLOS_REQUERIDOS_INVALIDO'; end if;

  insert into public.sello_campana (negocio_id, nombre, servicio_ids, sellos_requeridos, recompensa_descripcion, vencimiento_dias)
  values (p_negocio_id, p_nombre, p_servicio_ids, p_sellos_requeridos, p_recompensa_descripcion, p_vencimiento_dias)
  returning * into v_campana;

  return v_campana;
end;
$fn$;
grant execute on function public.crear_campana_sellos(uuid, text, int, text, uuid[], int) to authenticated;

create or replace function public.alternar_campana_sellos(p_campana_id uuid, p_estado campana_sellos_estado)
returns public.sello_campana
language plpgsql security definer set search_path = public as $fn$
declare
  v_campana public.sello_campana;
begin
  select * into v_campana from public.sello_campana where id = p_campana_id;
  if not found or not public.is_barberia_de(v_campana.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.sello_campana set estado = p_estado, updated_at = now() where id = p_campana_id returning * into v_campana;
  return v_campana;
end;
$fn$;
grant execute on function public.alternar_campana_sellos(uuid, campana_sellos_estado) to authenticated;

create or replace function public.mis_sellos(p_negocio_id uuid default null)
returns table (campana_id uuid, campana_nombre text, negocio_id uuid, negocio_nombre text, sellos_actuales int, sellos_requeridos int, recompensa_descripcion text)
language sql stable security definer set search_path = public as $fn$
  select sc.id, sc.nombre, sc.negocio_id, n.nombre, s.sellos_actuales, sc.sellos_requeridos, sc.recompensa_descripcion
  from public.sello_cliente s
  join public.sello_campana sc on sc.id = s.campana_id
  join public.negocio n on n.id = sc.negocio_id
  where s.cliente_id = auth.uid() and (p_negocio_id is null or sc.negocio_id = p_negocio_id)
  order by s.updated_at desc;
$fn$;
grant execute on function public.mis_sellos(uuid) to authenticated;

-- Canje manual de la recompensa cuando el Cliente alcanza el umbral —
-- Barbería/Guardian/Staff lo confirma en el momento de la entrega física
-- del beneficio (no hay un "beneficio digital automático" único posible,
-- ya que recompensa_descripcion es texto libre configurado por el Negocio).
create or replace function public.canjear_sellos(p_sello_cliente_id uuid)
returns public.sello_cliente
language plpgsql security definer set search_path = public as $fn$
declare
  v_sello_cliente public.sello_cliente;
  v_campana public.sello_campana;
begin
  select * into v_sello_cliente from public.sello_cliente where id = p_sello_cliente_id for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  select * into v_campana from public.sello_campana where id = v_sello_cliente.campana_id;
  if not public.tiene_acceso_interno(v_campana.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_sello_cliente.sellos_actuales < v_campana.sellos_requeridos then raise exception 'SELLOS_INSUFICIENTES'; end if;

  update public.sello_cliente set sellos_actuales = sellos_actuales - v_campana.sellos_requeridos, updated_at = now()
  where id = p_sello_cliente_id
  returning * into v_sello_cliente;

  insert into public.sello_evento (sello_cliente_id, tipo, cantidad) values (p_sello_cliente_id, 'CANJEADO', v_campana.sellos_requeridos);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('sello_cliente', p_sello_cliente_id, 'SELLOS_CANJEADOS', 'BARBERIA', auth.uid(), v_campana.negocio_id, jsonb_build_object('recompensa', v_campana.recompensa_descripcion));

  return v_sello_cliente;
end;
$fn$;
grant execute on function public.canjear_sellos(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 6 — Cashback (otorgamiento automático ya vive en
-- completar_venta_pos(), migración 053)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_regla_cashback(p_negocio_id uuid, p_porcentaje numeric, p_servicio_ids uuid[] default '{}', p_producto_ids uuid[] default '{}', p_limite_mensual numeric default null, p_vigencia_dias int default null)
returns public.cashback_regla
language plpgsql security definer set search_path = public as $fn$
declare
  v_regla public.cashback_regla;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_porcentaje <= 0 or p_porcentaje > 100 then raise exception 'PORCENTAJE_INVALIDO'; end if;

  insert into public.cashback_regla (negocio_id, porcentaje, servicio_ids, producto_ids, limite_mensual, vigencia_dias)
  values (p_negocio_id, p_porcentaje, p_servicio_ids, p_producto_ids, p_limite_mensual, p_vigencia_dias)
  returning * into v_regla;

  return v_regla;
end;
$fn$;
grant execute on function public.crear_regla_cashback(uuid, numeric, uuid[], uuid[], numeric, int) to authenticated;

create or replace function public.alternar_regla_cashback(p_regla_id uuid, p_activo boolean)
returns public.cashback_regla
language plpgsql security definer set search_path = public as $fn$
declare
  v_regla public.cashback_regla;
begin
  select * into v_regla from public.cashback_regla where id = p_regla_id;
  if not found or not public.is_barberia_de(v_regla.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.cashback_regla set activo = p_activo where id = p_regla_id returning * into v_regla;
  return v_regla;
end;
$fn$;
grant execute on function public.alternar_regla_cashback(uuid, boolean) to authenticated;

create or replace function public.mi_cashback()
returns table (id uuid, negocio_id uuid, negocio_nombre text, monto numeric, estado cashback_estado, created_at timestamptz, fecha_expiracion timestamptz)
language sql stable security definer set search_path = public as $fn$
  select cm.id, cr.negocio_id, n.nombre, cm.monto, cm.estado, cm.created_at, cm.fecha_expiracion
  from public.cashback_movimiento cm
  join public.cashback_regla cr on cr.id = cm.regla_id
  join public.negocio n on n.id = cr.negocio_id
  where cm.cliente_id = auth.uid()
  order by cm.created_at desc;
$fn$;
grant execute on function public.mi_cashback() to authenticated;
