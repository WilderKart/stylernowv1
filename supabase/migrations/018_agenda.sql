-- StylerNow — Migración 018: Módulo 2.6 — Agenda (dominio completo)
-- Fuente: 02-UX/09_Business_Panel.md ("Agenda"), 03-Business-Rules/
-- 02_Booking_Rules.md (7 validaciones de disponibilidad, reprogramación,
-- reasignación, combos), 03-Business-Rules/01_Roles.md (Reservas: Staff
-- propias, Guardian su Sede, Barbería todo el Negocio).
--
-- `slots_disponibles()`, `crear_reserva()`, `cancelar_reserva()` YA existen
-- (008/009) y no se tocan — son la autoridad de disponibilidad, ya
-- verificada dos veces en sesiones anteriores. Esta migración agrega lo
-- que faltaba para que el Panel pueda operar la Agenda: crear una cita en
-- nombre de un Cliente ("reserva telefónica", con las MISMAS 7
-- validaciones, sin atajos), reprogramar, y reasignar Staff.
--
-- `bloqueo_ausencia` (bloquear horario) NO necesita RPC nueva: su RLS
-- (`bloqueo_ausencia_write_propio` / `_write_barberia_guardian`, migración
-- 006) ya permite el INSERT/DELETE directo que la UI necesita.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Crear una Reserva en nombre de un Cliente ya registrado ("reserva
--    telefónica") — reutiliza slots_disponibles(), nunca una validación
--    paralela. El Cliente debe existir en `perfil` (ver docs/PENDING_
--    DECISIONS.md: crear una cuenta para un walk-in sin ningún registro
--    todavía es una decisión de negocio abierta, no bloqueante).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_reserva_manual(
  p_sede_id uuid,
  p_servicio_ids uuid[],
  p_hora_inicio timestamptz,
  p_cliente_id uuid,
  p_staff_id uuid default null
)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_sede public.sede;
  v_negocio public.negocio;
  v_tz text;
  v_fecha date;
  v_slot record;
  v_monto_total numeric;
  v_dur int;
  v_buf_prev int;
  v_buf_post int;
  v_sena numeric;
  v_reserva public.reserva;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;
  if not (public.is_barberia_de(v_sede.negocio_id) or public.is_guardian_de_sede(p_sede_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if not exists (select 1 from public.perfil where id = p_cliente_id) then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  select * into v_negocio from public.negocio where id = v_sede.negocio_id;
  if v_negocio.estado <> 'ACTIVO' then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;

  perform public.expirar_reservas_vencidas();

  v_tz := coalesce(v_sede.zona_horaria, 'America/Bogota');
  v_fecha := (p_hora_inicio at time zone v_tz)::date;

  select * into v_slot
  from public.slots_disponibles(p_sede_id, p_servicio_ids, v_fecha, p_staff_id)
  where slots_disponibles.hora_inicio = p_hora_inicio
    and slots_disponibles.disponible;
  if not found then
    raise exception 'SLOT_NO_DISPONIBLE';
  end if;

  select coalesce(sum(s.precio_base), 0),
         coalesce(sum(s.duracion_minutos), 0),
         coalesce(sum(s.buffer_previo_minutos), 0),
         coalesce(sum(s.buffer_posterior_minutos), 0)
    into v_monto_total, v_dur, v_buf_prev, v_buf_post
  from public.servicio s
  where s.id = any(p_servicio_ids) and s.negocio_id = v_negocio.id and s.estado = 'ACTIVO';

  v_sena := public.calcular_sena(v_negocio.id, v_monto_total);

  begin
    -- expira_at con más margen que el flujo online (10 min): acá no hay un
    -- Cliente completando el pago en el momento, el Staff necesita tiempo
    -- para cobrar la Seña después de agendar la llamada.
    insert into public.reserva (
      cliente_id, negocio_id, sede_id, staff_id, recurso_id,
      hora_inicio, hora_fin, estado, monto_total, monto_sena,
      buffer_previo_minutos, buffer_posterior_minutos, expira_at
    ) values (
      p_cliente_id, v_negocio.id, p_sede_id, v_slot.staff_id, v_slot.recurso_id,
      p_hora_inicio, v_slot.hora_fin, 'PENDIENTE_PAGO', v_monto_total, v_sena,
      v_buf_prev, v_buf_post, now() + interval '24 hours'
    )
    returning * into v_reserva;
  exception
    when exclusion_violation then
      raise exception 'SLOT_NO_DISPONIBLE';
  end;

  insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario)
  select v_reserva.id, s.id, s.precio_base
  from public.servicio s
  where s.id = any(p_servicio_ids) and s.negocio_id = v_negocio.id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('reserva', v_reserva.id, 'RESERVA_CREADA_MANUAL', 'BARBERIA', auth.uid(), v_negocio.id,
    jsonb_build_object('cliente_id', p_cliente_id, 'sede_id', p_sede_id));

  return v_reserva;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Reprogramación — mismas 7 validaciones sobre el nuevo horario,
--    conserva id/Seña/historial. Cliente (dentro de la ventana de
--    reembolso parcial) o Negocio (sin ventana — puede reprogramar en
--    cualquier momento por indisponibilidad sobrevenida del Staff).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reprogramar_reserva(
  p_reserva_id uuid,
  p_nueva_hora_inicio timestamptz,
  p_motivo text default null
)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_actor uuid := auth.uid();
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_sede public.sede;
  v_es_cliente boolean;
  v_es_negocio boolean;
  v_horas numeric;
  v_servicio_ids uuid[];
  v_tz text;
  v_fecha date;
  v_slot record;
  v_hora_anterior timestamptz;
begin
  if v_actor is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;
  select * into v_sede from public.sede where id = v_reserva.sede_id;

  v_es_cliente := v_reserva.cliente_id = v_actor;
  v_es_negocio := public.is_barberia_de(v_reserva.negocio_id) or public.is_guardian_de_sede(v_reserva.sede_id);

  if not (v_es_cliente or v_es_negocio or public.is_supersu()) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_reserva.estado <> 'CONFIRMADA' then
    raise exception 'RESERVA_NO_REPROGRAMABLE';
  end if;

  -- El Cliente solo puede auto-reprogramar dentro de la misma ventana en la
  -- que todavía obtendría algún reembolso si cancelara — 02_Booking_Rules.md:
  -- "hasta el límite de tiempo definido por la política de cancelación". El
  -- Negocio no tiene esa restricción (indisponibilidad sobrevenida del Staff).
  if v_es_cliente and not v_es_negocio then
    v_horas := extract(epoch from (v_reserva.hora_inicio - now())) / 3600;
    if v_horas < v_negocio.ventana_reembolso_parcial_horas then
      raise exception 'FUERA_DE_VENTANA_REPROGRAMACION';
    end if;
  end if;

  select array_agg(servicio_id) into v_servicio_ids from public.reserva_servicio where reserva_id = p_reserva_id;

  v_tz := coalesce(v_sede.zona_horaria, 'America/Bogota');
  v_fecha := (p_nueva_hora_inicio at time zone v_tz)::date;

  select * into v_slot
  from public.slots_disponibles(v_reserva.sede_id, v_servicio_ids, v_fecha, v_reserva.staff_id)
  where slots_disponibles.hora_inicio = p_nueva_hora_inicio
    and slots_disponibles.disponible;
  if not found then
    raise exception 'SLOT_NO_DISPONIBLE';
  end if;

  v_hora_anterior := v_reserva.hora_inicio;

  update public.reserva
  set hora_inicio = p_nueva_hora_inicio, hora_fin = v_slot.hora_fin, updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values (
    'reserva', p_reserva_id, 'RESERVA_REPROGRAMADA',
    case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end,
    v_actor, v_reserva.negocio_id, p_motivo,
    jsonb_build_object('hora_inicio', v_hora_anterior), jsonb_build_object('hora_inicio', p_nueva_hora_inicio)
  );

  return v_reserva;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Reasignación de Staff — exclusiva de Barbería/Guardian de la Sede.
--    Mismo horario, nuevo Staff, solo si ese Staff cumple las 7 reglas
--    para ese mismo slot (incluida su propia disponibilidad/bloqueos).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reasignar_staff_reserva(
  p_reserva_id uuid,
  p_nuevo_staff_id uuid,
  p_motivo text default null
)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
  v_sede public.sede;
  v_servicio_ids uuid[];
  v_tz text;
  v_fecha date;
  v_slot record;
  v_staff_anterior uuid;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;
  if not (public.is_barberia_de(v_reserva.negocio_id) or public.is_guardian_de_sede(v_reserva.sede_id)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_reserva.estado not in ('PENDIENTE_PAGO', 'CONFIRMADA') then
    raise exception 'RESERVA_NO_REASIGNABLE';
  end if;

  select * into v_sede from public.sede where id = v_reserva.sede_id;
  select array_agg(servicio_id) into v_servicio_ids from public.reserva_servicio where reserva_id = p_reserva_id;
  v_tz := coalesce(v_sede.zona_horaria, 'America/Bogota');
  v_fecha := (v_reserva.hora_inicio at time zone v_tz)::date;

  select * into v_slot
  from public.slots_disponibles(v_reserva.sede_id, v_servicio_ids, v_fecha, p_nuevo_staff_id)
  where slots_disponibles.hora_inicio = v_reserva.hora_inicio
    and slots_disponibles.disponible;
  if not found then
    raise exception 'STAFF_NO_DISPONIBLE';
  end if;

  v_staff_anterior := v_reserva.staff_id;

  update public.reserva
  set staff_id = p_nuevo_staff_id, updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values (
    'reserva', p_reserva_id, 'RESERVA_REASIGNADA', 'BARBERIA', auth.uid(), v_reserva.negocio_id, p_motivo,
    jsonb_build_object('staff_id', v_staff_anterior), jsonb_build_object('staff_id', p_nuevo_staff_id)
  );

  return v_reserva;
end;
$fn$;

grant execute on function public.crear_reserva_manual(uuid, uuid[], timestamptz, uuid, uuid) to authenticated;
grant execute on function public.reprogramar_reserva(uuid, timestamptz, text) to authenticated;
grant execute on function public.reasignar_staff_reserva(uuid, uuid, text) to authenticated;
