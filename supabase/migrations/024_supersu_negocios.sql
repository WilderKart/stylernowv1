-- StylerNow — Migración 024: Fase 3, Módulo 3.1 — SuperSU: Dashboard
-- global y Gestión de Negocios
-- Fuente: 02-UX/10_Super_Admin.md, 04-Data-Model/03_State_Machines.md
-- (máquina "Negocio": PENDIENTE_APROBACION → ACTIVO/RECHAZADO, ACTIVO ⇄
-- SUSPENDIDO, ACTIVO/SUSPENDIDO → CANCELADO terminal).
--
-- Hallazgo crítico de esta sesión, más grave que los de staff_servicio
-- (2.5) o punto_fidelizacion (2.8): **no existía NINGUNA forma de que un
-- Negocio pasara de PENDIENTE_APROBACION a ACTIVO.** El Panel Negocio
-- (Módulo 2.1) ya le muestra al dueño el mensaje "tu negocio está en
-- revisión", pero nadie del lado de StylerNow tenía cómo aprobarlo — la
-- política RLS `negocio_update_barberia` ya permitía is_supersu() desde
-- la migración 006, pero no existía ninguna pantalla ni RPC auditado que
-- la usara. Hasta esta migración, cualquier Negocio registrado en
-- producción quedaría permanentemente atascado.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Transiciones de estado de Negocio, todas exclusivas de SuperSU.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.aprobar_negocio(p_negocio_id uuid)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'PENDIENTE_APROBACION' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'ACTIVO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_APROBADO', 'SUPERSU', auth.uid(), p_negocio_id,
    jsonb_build_object('estado', 'PENDIENTE_APROBACION'), jsonb_build_object('estado', 'ACTIVO'));

  return v_negocio;
end;
$fn$;

create or replace function public.rechazar_negocio(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'PENDIENTE_APROBACION' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'RECHAZADO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_RECHAZADO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', 'PENDIENTE_APROBACION'), jsonb_build_object('estado', 'RECHAZADO'));

  return v_negocio;
end;
$fn$;

-- Suspender/cancelar cascada las Reservas futuras confirmadas con reembolso
-- 100% (QA-BIZ-102) reutilizando cancelar_reserva() tal cual — nunca se
-- duplica la lógica de reembolso ya verificada en el Módulo 1.
create or replace function public.suspender_negocio(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_reserva record;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'ACTIVO' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'SUSPENDIDO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  for v_reserva in
    select id from public.reserva
    where negocio_id = p_negocio_id and estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and hora_inicio > now()
  loop
    perform public.cancelar_reserva(v_reserva.id, 'Negocio suspendido: ' || p_motivo);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_SUSPENDIDO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', 'ACTIVO'), jsonb_build_object('estado', 'SUSPENDIDO'));

  return v_negocio;
end;
$fn$;

create or replace function public.reactivar_negocio_supersu(p_negocio_id uuid)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado <> 'SUSPENDIDO' then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'ACTIVO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_REACTIVADO', 'SUPERSU', auth.uid(), p_negocio_id,
    jsonb_build_object('estado', 'SUSPENDIDO'), jsonb_build_object('estado', 'ACTIVO'));

  return v_negocio;
end;
$fn$;

create or replace function public.cancelar_negocio_supersu(p_negocio_id uuid, p_motivo text)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_reserva record;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  select * into v_negocio from public.negocio where id = p_negocio_id for update;
  if not found then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;
  if v_negocio.estado not in ('ACTIVO', 'SUSPENDIDO') then
    raise exception 'TRANSICION_INVALIDA';
  end if;

  update public.negocio set estado = 'CANCELADO', updated_at = now() where id = p_negocio_id
  returning * into v_negocio;

  for v_reserva in
    select id from public.reserva
    where negocio_id = p_negocio_id and estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and hora_inicio > now()
  loop
    perform public.cancelar_reserva(v_reserva.id, 'Negocio dado de baja: ' || p_motivo);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'NEGOCIO_CANCELADO', 'SUPERSU', auth.uid(), p_negocio_id, p_motivo,
    jsonb_build_object('estado', v_negocio.estado), jsonb_build_object('estado', 'CANCELADO'));

  return v_negocio;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Dashboard global — Negocios activos, MRR, citas del mes, ciudades
--    activas (02-UX/10_Super_Admin.md).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.admin_dashboard_resumen()
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_negocios_activos int;
  v_negocios_pendientes int;
  v_mrr numeric;
  v_citas_mes int;
  v_ciudades_activas int;
  v_inicio_mes timestamptz := date_trunc('month', now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota';
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select count(*) into v_negocios_activos from public.negocio where estado = 'ACTIVO';
  select count(*) into v_negocios_pendientes from public.negocio where estado = 'PENDIENTE_APROBACION';
  select count(distinct ciudad) into v_ciudades_activas from public.negocio where estado = 'ACTIVO';

  select coalesce(sum(p.precio_mensual), 0) into v_mrr
  from public.suscripcion s
  join public.plan p on p.codigo = s.plan_codigo
  where s.estado = 'ACTIVA';

  select count(*) into v_citas_mes
  from public.reserva
  where estado = 'COMPLETADA' and hora_inicio >= v_inicio_mes;

  return jsonb_build_object(
    'negocios_activos', v_negocios_activos,
    'negocios_pendientes', v_negocios_pendientes,
    'ciudades_activas', v_ciudades_activas,
    'mrr', v_mrr,
    'citas_completadas_mes', v_citas_mes
  );
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Reportar una reseña (06-Security/03_Fraud.md, vector 1) — le faltaba
--    a la cola de moderación un camino real de entrada: `resena_estado`
--    ya tenía el valor REPORTADA desde el Módulo 1, pero ninguna política
--    ni acción lo usaba todavía. Un Negocio puede reportar una reseña
--    sobre sí mismo (ej. lenguaje abusivo, contenido falso); la
--    moderación real (Eliminar/Mantener) la resuelve SuperSU.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reportar_resena(p_resena_id uuid, p_motivo text)
returns public.resena
language plpgsql security definer set search_path = public as $fn$
declare
  v_resena public.resena;
begin
  select * into v_resena from public.resena where id = p_resena_id;
  if not found or not public.tiene_acceso_interno(v_resena.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_resena.estado <> 'VISIBLE' then
    raise exception 'RESENA_NO_REPORTABLE';
  end if;

  update public.resena set estado = 'REPORTADA', updated_at = now() where id = p_resena_id
  returning * into v_resena;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('resena', p_resena_id, 'RESENA_REPORTADA', 'BARBERIA', auth.uid(), v_resena.negocio_id, p_motivo);

  return v_resena;
end;
$fn$;

create or replace function public.moderar_resena(p_resena_id uuid, p_accion text, p_motivo text default null)
returns public.resena
language plpgsql security definer set search_path = public as $fn$
declare
  v_resena public.resena;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_accion not in ('MANTENER', 'ELIMINAR') then
    raise exception 'ACCION_INVALIDA';
  end if;

  select * into v_resena from public.resena where id = p_resena_id;
  if not found then
    raise exception 'RESENA_NO_ENCONTRADA';
  end if;
  if v_resena.estado <> 'REPORTADA' then
    raise exception 'RESENA_NO_EN_COLA';
  end if;

  update public.resena
  set estado = case when p_accion = 'ELIMINAR' then 'ELIMINADA' else 'VISIBLE' end,
      moderado_por = auth.uid(), moderado_motivo = p_motivo, updated_at = now()
  where id = p_resena_id
  returning * into v_resena;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('resena', p_resena_id, 'RESENA_MODERADA_' || p_accion, 'SUPERSU', auth.uid(), v_resena.negocio_id, p_motivo);

  return v_resena;
end;
$fn$;

grant execute on function public.aprobar_negocio(uuid) to authenticated;
grant execute on function public.rechazar_negocio(uuid, text) to authenticated;
grant execute on function public.suspender_negocio(uuid, text) to authenticated;
grant execute on function public.reactivar_negocio_supersu(uuid) to authenticated;
grant execute on function public.cancelar_negocio_supersu(uuid, text) to authenticated;
grant execute on function public.admin_dashboard_resumen() to authenticated;
grant execute on function public.reportar_resena(uuid, text) to authenticated;
grant execute on function public.moderar_resena(uuid, text, text) to authenticated;
