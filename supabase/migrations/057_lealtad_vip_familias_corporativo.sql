-- StylerNow — Migración 057: Dominio LEALTAD (ADR-011) — Módulos 7, 8, 9:
-- Club VIP, Paquetes familiares, Suscripciones corporativas.

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 7 — Club VIP
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_nivel_vip(p_negocio_id uuid, p_nombre text, p_orden int, p_beneficios text default null, p_umbral_automatico_gasto numeric default null)
returns public.vip_nivel
language plpgsql security definer set search_path = public as $fn$
declare
  v_nivel public.vip_nivel;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_orden <= 0 then raise exception 'ORDEN_INVALIDO'; end if;

  insert into public.vip_nivel (negocio_id, nombre, orden, beneficios, umbral_automatico_gasto)
  values (p_negocio_id, p_nombre, p_orden, p_beneficios, p_umbral_automatico_gasto)
  returning * into v_nivel;

  return v_nivel;
end;
$fn$;
grant execute on function public.crear_nivel_vip(uuid, text, int, text, numeric) to authenticated;

-- Semilla razonable de los 4 niveles que describe la Biblia — la Barbería
-- los renombra/ajusta después con crear_nivel_vip/actualizar (no hay
-- "actualizar_nivel_vip" porque renombrar es infrecuente; se borra y
-- recrea si hace falta, dado el volumen bajo esperado de niveles por Negocio).
create or replace function public.sembrar_niveles_vip_default(p_negocio_id uuid)
returns setof public.vip_nivel
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if exists (select 1 from public.vip_nivel where negocio_id = p_negocio_id) then raise exception 'NIVELES_YA_EXISTEN'; end if;

  return query
    insert into public.vip_nivel (negocio_id, nombre, orden)
    values
      (p_negocio_id, 'VIP Bronze', 1), (p_negocio_id, 'VIP Silver', 2),
      (p_negocio_id, 'VIP Gold', 3), (p_negocio_id, 'VIP Black', 4)
    returning *;
end;
$fn$;
grant execute on function public.sembrar_niveles_vip_default(uuid) to authenticated;

create or replace function public.asignar_vip(p_cliente_id uuid, p_negocio_id uuid, p_nivel_id uuid)
returns public.vip_miembro
language plpgsql security definer set search_path = public as $fn$
declare
  v_miembro public.vip_miembro;
  v_anterior uuid;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.vip_nivel where id = p_nivel_id and negocio_id = p_negocio_id) then raise exception 'NIVEL_NO_ENCONTRADO'; end if;

  select nivel_id into v_anterior from public.vip_miembro where cliente_id = p_cliente_id and negocio_id = p_negocio_id;

  insert into public.vip_miembro (cliente_id, negocio_id, nivel_id, origen, asignado_por)
  values (p_cliente_id, p_negocio_id, p_nivel_id, 'MANUAL', auth.uid())
  on conflict (cliente_id, negocio_id) do update set nivel_id = excluded.nivel_id, origen = 'MANUAL', asignado_por = auth.uid(), updated_at = now()
  returning * into v_miembro;

  insert into public.vip_historial (vip_miembro_id, nivel_anterior_id, nivel_nuevo_id, motivo)
  values (v_miembro.id, v_anterior, p_nivel_id, 'Asignación manual por Barbería');

  return v_miembro;
end;
$fn$;
grant execute on function public.asignar_vip(uuid, uuid, uuid) to authenticated;

create or replace function public.degradar_vip(p_vip_miembro_id uuid, p_nivel_nuevo_id uuid, p_motivo text)
returns public.vip_miembro
language plpgsql security definer set search_path = public as $fn$
declare
  v_miembro public.vip_miembro;
begin
  select * into v_miembro from public.vip_miembro where id = p_vip_miembro_id;
  if not found or not public.is_barberia_de(v_miembro.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.vip_nivel where id = p_nivel_nuevo_id and negocio_id = v_miembro.negocio_id) then raise exception 'NIVEL_NO_ENCONTRADO'; end if;

  insert into public.vip_historial (vip_miembro_id, nivel_anterior_id, nivel_nuevo_id, motivo)
  values (p_vip_miembro_id, v_miembro.nivel_id, p_nivel_nuevo_id, p_motivo);

  update public.vip_miembro set nivel_id = p_nivel_nuevo_id, origen = 'MANUAL', asignado_por = auth.uid(), updated_at = now()
  where id = p_vip_miembro_id
  returning * into v_miembro;

  return v_miembro;
end;
$fn$;
grant execute on function public.degradar_vip(uuid, uuid, text) to authenticated;

-- Acceso automático por umbral de gasto — calcula el gasto histórico total
-- del Cliente en el Negocio (suma de monto_total de Reservas COMPLETADA) y
-- lo asciende al nivel automático más alto que alcance, si es superior al
-- actual. Pensada para ejecutarse tras cada venta (llamada explícita desde
-- Caja/POS, no dentro de completar_venta_pos() — mismo criterio de no
-- tocar esa función una 5ª vez sin necesidad estricta).
create or replace function public.evaluar_ascenso_vip_automatico(p_cliente_id uuid, p_negocio_id uuid)
returns public.vip_miembro
language plpgsql security definer set search_path = public as $fn$
declare
  v_gasto_total numeric;
  v_nivel_objetivo public.vip_nivel;
  v_miembro public.vip_miembro;
  v_anterior uuid;
begin
  if not public.tiene_acceso_interno(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  select coalesce(sum(monto_total), 0) into v_gasto_total
  from public.reserva where cliente_id = p_cliente_id and negocio_id = p_negocio_id and estado = 'COMPLETADA';

  select * into v_nivel_objetivo from public.vip_nivel
  where negocio_id = p_negocio_id and umbral_automatico_gasto is not null and umbral_automatico_gasto <= v_gasto_total
  order by orden desc limit 1;

  if v_nivel_objetivo.id is null then
    return null;
  end if;

  select nivel_id into v_anterior from public.vip_miembro where cliente_id = p_cliente_id and negocio_id = p_negocio_id;
  if v_anterior is not null and v_anterior in (select id from public.vip_nivel where negocio_id = p_negocio_id and orden >= v_nivel_objetivo.orden) then
    select * into v_miembro from public.vip_miembro where cliente_id = p_cliente_id and negocio_id = p_negocio_id;
    return v_miembro;
  end if;

  insert into public.vip_miembro (cliente_id, negocio_id, nivel_id, origen)
  values (p_cliente_id, p_negocio_id, v_nivel_objetivo.id, 'AUTOMATICO')
  on conflict (cliente_id, negocio_id) do update set nivel_id = excluded.nivel_id, origen = 'AUTOMATICO', updated_at = now()
  returning * into v_miembro;

  insert into public.vip_historial (vip_miembro_id, nivel_anterior_id, nivel_nuevo_id, motivo)
  values (v_miembro.id, v_anterior, v_nivel_objetivo.id, 'Ascenso automático por gasto acumulado ($' || v_gasto_total || ')');

  return v_miembro;
end;
$fn$;
grant execute on function public.evaluar_ascenso_vip_automatico(uuid, uuid) to authenticated;

create or replace function public.mi_nivel_vip(p_negocio_id uuid)
returns table (nivel_nombre text, orden int, beneficios text)
language sql stable security definer set search_path = public as $fn$
  select vn.nombre, vn.orden, vn.beneficios
  from public.vip_miembro vm join public.vip_nivel vn on vn.id = vm.nivel_id
  where vm.cliente_id = auth.uid() and vm.negocio_id = p_negocio_id;
$fn$;
grant execute on function public.mi_nivel_vip(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 8 — Paquetes familiares
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_grupo_familiar(p_nombre text default 'Mi familia', p_negocio_id uuid default null, p_limite_miembros int default 4, p_descuento_familiar_pct numeric default 0)
returns public.familia_grupo
language plpgsql security definer set search_path = public as $fn$
declare
  v_grupo public.familia_grupo;
begin
  if exists (select 1 from public.familia_miembro where cliente_id = auth.uid()) then raise exception 'YA_PERTENECE_A_UNA_FAMILIA'; end if;

  insert into public.familia_grupo (titular_cliente_id, negocio_id, nombre, limite_miembros, descuento_familiar_pct)
  values (auth.uid(), p_negocio_id, p_nombre, greatest(p_limite_miembros, 1), p_descuento_familiar_pct)
  returning * into v_grupo;

  insert into public.familia_miembro (familia_id, cliente_id, parentesco) values (v_grupo.id, auth.uid(), 'Titular');

  return v_grupo;
end;
$fn$;
grant execute on function public.crear_grupo_familiar(text, uuid, int, numeric) to authenticated;

create or replace function public.agregar_miembro_familiar(p_familia_id uuid, p_cliente_id uuid, p_parentesco text default null)
returns public.familia_miembro
language plpgsql security definer set search_path = public as $fn$
declare
  v_grupo public.familia_grupo;
  v_conteo int;
  v_miembro public.familia_miembro;
begin
  select * into v_grupo from public.familia_grupo where id = p_familia_id;
  if not found or v_grupo.titular_cliente_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if exists (select 1 from public.familia_miembro where cliente_id = p_cliente_id) then raise exception 'CLIENTE_YA_EN_UNA_FAMILIA'; end if;

  select count(*) into v_conteo from public.familia_miembro where familia_id = p_familia_id;
  if v_conteo >= v_grupo.limite_miembros then raise exception 'LIMITE_MIEMBROS_ALCANZADO'; end if;

  insert into public.familia_miembro (familia_id, cliente_id, parentesco) values (p_familia_id, p_cliente_id, p_parentesco)
  returning * into v_miembro;

  return v_miembro;
end;
$fn$;
grant execute on function public.agregar_miembro_familiar(uuid, uuid, text) to authenticated;

create or replace function public.quitar_miembro_familiar(p_familia_id uuid, p_cliente_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_grupo public.familia_grupo;
begin
  select * into v_grupo from public.familia_grupo where id = p_familia_id;
  if not found or v_grupo.titular_cliente_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if p_cliente_id = v_grupo.titular_cliente_id then raise exception 'NO_SE_PUEDE_QUITAR_AL_TITULAR'; end if;

  delete from public.familia_miembro where familia_id = p_familia_id and cliente_id = p_cliente_id;
end;
$fn$;
grant execute on function public.quitar_miembro_familiar(uuid, uuid) to authenticated;

create or replace function public.mi_familia()
returns public.familia_grupo
language sql stable security definer set search_path = public as $fn$
  select g.* from public.familia_grupo g
  join public.familia_miembro m on m.familia_id = g.id
  where m.cliente_id = auth.uid();
$fn$;
grant execute on function public.mi_familia() to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 9 — Suscripciones corporativas
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_cuenta_corporativa(p_nombre_empresa text, p_contacto_email text, p_cupos_totales int, p_vigencia_fin date, p_negocio_id uuid default null, p_nit text default null)
returns public.corporativo_cuenta
language plpgsql security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
begin
  if not public.is_supersu() and (p_negocio_id is null or not public.is_barberia_de(p_negocio_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_cupos_totales <= 0 then raise exception 'CUPOS_INVALIDOS'; end if;
  if p_vigencia_fin <= current_date then raise exception 'VIGENCIA_INVALIDA'; end if;

  insert into public.corporativo_cuenta (nombre_empresa, nit, contacto_email, cupos_totales, vigencia_fin, negocio_id)
  values (p_nombre_empresa, p_nit, p_contacto_email, p_cupos_totales, p_vigencia_fin, p_negocio_id)
  returning * into v_cuenta;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('corporativo_cuenta', v_cuenta.id, 'CUENTA_CORPORATIVA_CREADA', case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end, auth.uid(), p_negocio_id,
    jsonb_build_object('empresa', p_nombre_empresa, 'cupos', p_cupos_totales));

  return v_cuenta;
end;
$fn$;
grant execute on function public.crear_cuenta_corporativa(text, text, int, date, uuid, text) to authenticated;

create or replace function public.asignar_admin_corporativo(p_cuenta_id uuid, p_admin_user_id uuid)
returns public.corporativo_cuenta
language plpgsql security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not (public.is_supersu() or (v_cuenta.negocio_id is not null and public.is_barberia_de(v_cuenta.negocio_id))) then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.corporativo_cuenta set admin_user_id = p_admin_user_id where id = p_cuenta_id returning * into v_cuenta;
  return v_cuenta;
end;
$fn$;
grant execute on function public.asignar_admin_corporativo(uuid, uuid) to authenticated;

create or replace function public.agregar_empleado_corporativo(p_cuenta_id uuid, p_cliente_id uuid)
returns public.corporativo_miembro
language plpgsql security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
  v_conteo int;
  v_miembro public.corporativo_miembro;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or v_cuenta.admin_user_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if not v_cuenta.activo or v_cuenta.vigencia_fin < current_date then raise exception 'CUENTA_NO_VIGENTE'; end if;

  select count(*) into v_conteo from public.corporativo_miembro where cuenta_id = p_cuenta_id and activo = true;
  if v_conteo >= v_cuenta.cupos_totales then raise exception 'CUPOS_AGOTADOS'; end if;

  insert into public.corporativo_miembro (cuenta_id, cliente_id) values (p_cuenta_id, p_cliente_id)
  on conflict (cuenta_id, cliente_id) do update set activo = true
  returning * into v_miembro;

  return v_miembro;
end;
$fn$;
grant execute on function public.agregar_empleado_corporativo(uuid, uuid) to authenticated;

create or replace function public.retirar_empleado_corporativo(p_cuenta_id uuid, p_cliente_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or v_cuenta.admin_user_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;

  update public.corporativo_miembro set activo = false where cuenta_id = p_cuenta_id and cliente_id = p_cliente_id;
end;
$fn$;
grant execute on function public.retirar_empleado_corporativo(uuid, uuid) to authenticated;

-- Registro de consumo del beneficio corporativo — igual criterio que
-- registrar_uso_membresia: manual en el punto de servicio, no integrado a
-- completar_venta_pos()/slots_disponibles.
create or replace function public.registrar_consumo_corporativo(p_miembro_id uuid, p_reserva_id uuid, p_monto numeric default 0)
returns public.corporativo_consumo
language plpgsql security definer set search_path = public as $fn$
declare
  v_miembro public.corporativo_miembro;
  v_cuenta public.corporativo_cuenta;
  v_reserva public.reserva;
  v_consumo public.corporativo_consumo;
begin
  select * into v_miembro from public.corporativo_miembro where id = p_miembro_id;
  if not found or not v_miembro.activo then raise exception 'MIEMBRO_NO_ACTIVO'; end if;
  select * into v_cuenta from public.corporativo_cuenta where id = v_miembro.cuenta_id;
  if v_cuenta.negocio_id is null or not public.tiene_acceso_interno(v_cuenta.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id;
  if not found or v_reserva.cliente_id <> v_miembro.cliente_id then raise exception 'RESERVA_NO_CORRESPONDE'; end if;
  if v_cuenta.sedes_permitidas <> '{}' and not (v_reserva.sede_id = any(v_cuenta.sedes_permitidas)) then raise exception 'SEDE_NO_PERMITIDA'; end if;

  insert into public.corporativo_consumo (miembro_id, reserva_id, monto) values (p_miembro_id, p_reserva_id, p_monto)
  returning * into v_consumo;

  return v_consumo;
end;
$fn$;
grant execute on function public.registrar_consumo_corporativo(uuid, uuid, numeric) to authenticated;

create or replace function public.reportes_corporativo(p_cuenta_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
  v_resultado jsonb;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not (v_cuenta.admin_user_id = auth.uid() or public.is_supersu() or (v_cuenta.negocio_id is not null and public.is_barberia_de(v_cuenta.negocio_id))) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select jsonb_build_object(
    'empleadosActivos', (select count(*) from public.corporativo_miembro where cuenta_id = p_cuenta_id and activo = true),
    'cuposTotales', v_cuenta.cupos_totales,
    'consumoTotal', (select coalesce(sum(cc.monto), 0) from public.corporativo_consumo cc join public.corporativo_miembro cm on cm.id = cc.miembro_id where cm.cuenta_id = p_cuenta_id),
    'reservasConsumidas', (select count(*) from public.corporativo_consumo cc join public.corporativo_miembro cm on cm.id = cc.miembro_id where cm.cuenta_id = p_cuenta_id)
  ) into v_resultado;

  return v_resultado;
end;
$fn$;
grant execute on function public.reportes_corporativo(uuid) to authenticated;
