-- 188 · Check-in / check-out solo el día de la cita + reagendar (cliente, o barbería a petición del cliente).
--
-- Problema: un barbero podía hacer check-in y finalizar una cita días antes; eso libera el turno y la agenda queda
-- disponible para otra persona cuando el cliente aún va a llegar. Ahora:
--   · El check-in solo se permite el día de la cita (en la zona horaria de la sede). Completar sin POS una cita que
--     nunca tuvo check-in también exige ser el día de la cita.
--   · Si la cita debe moverse, se REPROGRAMA. El cliente (y la barbería/Guardian desde la agenda del panel) ya cuentan con
--     reprogramar_reserva (migración 018); NO se duplica. Lo nuevo es el camino del BARBERO: puede mover SU cita solo si el
--     cliente lo pidió (queda registrado en auditoría) y se le avisa al cliente.

create or replace function public._reserva_es_hoy(p_reserva_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (r.hora_inicio at time zone coalesce(s.zona_horaria, 'America/Bogota'))::date
       = (now() at time zone coalesce(s.zona_horaria, 'America/Bogota'))::date
  from public.reserva r join public.sede s on s.id = r.sede_id where r.id = p_reserva_id;
$$;
revoke all on function public._reserva_es_hoy(uuid) from public, anon, authenticated;

create or replace function public.iniciar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_reserva public.reserva;
  v_vinculo_id uuid;
  v_minutos_tarde numeric;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if not coalesce(v_reserva.staff_id = auth.uid(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_INICIABLE'; end if;
  -- Solo el día de la cita: evita liberar el turno antes de tiempo. Para mover la cita existe reagendar_reserva.
  if not public._reserva_es_hoy(p_reserva_id) then raise exception 'CHECKIN_SOLO_EL_DIA_DE_LA_CITA'; end if;

  update public.reserva set estado = 'EN_CURSO', checkin_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  -- Puntualidad (03-Business-Rules/05_Staff_Rewards.md): llegada tarde >5min, -10 puntos.
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = v_reserva.staff_id and negocio_id = v_reserva.negocio_id and estado <> 'RETIRADO'
    limit 1;
  v_minutos_tarde := extract(epoch from (now() - v_reserva.hora_inicio)) / 60;
  if v_vinculo_id is not null and public.temporada_actual_id() is not null and v_minutos_tarde > 5 then
    insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
    values (v_vinculo_id, public.temporada_actual_id(), 'LLEGADA_TARDE', -10, 'reserva', p_reserva_id, 'SISTEMA',
      format('Check-in %s minutos tarde', round(v_minutos_tarde)));
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKIN_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$function$;

-- Completar sin POS: una cita CONFIRMADA (sin check-in) solo se completa el día de la cita.
do $$
declare v_def text;
  v_ancla constant text := E'if v_reserva.estado not in (''CONFIRMADA'', ''EN_CURSO'') then\n    raise exception ''RESERVA_NO_COMPLETABLE'';\n  end if;';
begin
  v_def := pg_get_functiondef('public.completar_reserva_sin_pos(uuid)'::regprocedure);
  if position('CHECKIN_SOLO_EL_DIA_DE_LA_CITA' in v_def) > 0 then return; end if;  -- ya migrada
  if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA completar_reserva_sin_pos'; end if;
  execute replace(v_def, v_ancla, v_ancla
    || E'\n  if v_reserva.estado = ''CONFIRMADA'' and not coalesce(public.is_supersu(), false) and not public._reserva_es_hoy(p_reserva_id) then\n'
    || E'    raise exception ''CHECKIN_SOLO_EL_DIA_DE_LA_CITA'';\n  end if;');
end $$;

-- ── Reagendar ─────────────────────────────────────────────────────────────────────────────
-- Horarios libres para mover una cita (mismo barbero, mismos servicios). Solo quien puede reagendarla.
create or replace function public._puede_reagendar(p_reserva public.reserva)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  if p_reserva.staff_id = auth.uid() or public.is_barberia_de(p_reserva.negocio_id) or public.is_guardian_de_sede(p_reserva.sede_id) then
    return 'NEGOCIO';
  end if;
  return null;
end $$;
revoke all on function public._puede_reagendar(public.reserva) from public, anon, authenticated;

create or replace function public.slots_para_reagendar(p_reserva_id uuid, p_fecha date)
returns table (hora_inicio timestamptz, hora_fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare r public.reserva; v_serv uuid[];
begin
  select * into r from public.reserva where id = p_reserva_id;
  if not found or public._puede_reagendar(r) is null then raise exception 'NO_AUTORIZADO'; end if;
  select array_agg(servicio_id) into v_serv from public.reserva_servicio where reserva_id = p_reserva_id;
  return query
    select s.hora_inicio, s.hora_fin
    from public.slots_disponibles(r.sede_id, v_serv, p_fecha, r.staff_id, 15) s
    where s.disponible and s.hora_inicio > now() + interval '1 hour'
    order by s.hora_inicio;
end $$;

create or replace function public.reagendar_reserva(p_reserva_id uuid, p_nuevo_inicio timestamptz, p_cliente_solicito boolean default false)
returns public.reserva language plpgsql security definer set search_path = public as $$
declare
  r public.reserva; v_quien text; v_serv uuid[]; v_slot record; v_dur interval; v_tz text;
begin
  select * into r from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  v_quien := public._puede_reagendar(r);
  if v_quien is null then raise exception 'NO_AUTORIZADO'; end if;
  if r.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_REAGENDABLE'; end if;
  perform public._exigir_operativo(r.negocio_id);

  if not coalesce(p_cliente_solicito, false) then raise exception 'CLIENTE_DEBE_SOLICITARLO'; end if;
  if p_nuevo_inicio <= now() + interval '1 hour' then raise exception 'HORARIO_INVALIDO'; end if;

  select coalesce(s.zona_horaria, 'America/Bogota') into v_tz from public.sede s where s.id = r.sede_id;
  select array_agg(servicio_id) into v_serv from public.reserva_servicio where reserva_id = p_reserva_id;
  select * into v_slot from public.slots_disponibles(r.sede_id, v_serv, (p_nuevo_inicio at time zone v_tz)::date, r.staff_id, 15) s
   where s.hora_inicio = p_nuevo_inicio and s.disponible limit 1;
  if not found then raise exception 'HORARIO_NO_DISPONIBLE'; end if;

  v_dur := r.hora_fin - r.hora_inicio;
  update public.reserva
     set hora_inicio = p_nuevo_inicio, hora_fin = p_nuevo_inicio + v_dur, recurso_id = coalesce(v_slot.recurso_id, r.recurso_id), updated_at = now()
   where id = p_reserva_id
  returning * into r;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('reserva', p_reserva_id, 'RESERVA_REAGENDADA', 'STAFF', auth.uid(), r.negocio_id,
          jsonb_build_object('nuevo_inicio', p_nuevo_inicio, 'solicitado_por_cliente', true));

  -- Aviso al cliente: su cita cambió de horario (a petición suya).
  perform public._notificar(r.cliente_id, 'CITA_REPROGRAMADA', 'Tu cita cambió de horario', 'Tu cita se movió a la nueva hora que acordaste con el negocio.',
    'Your appointment was rescheduled', 'Your appointment was moved to the new time you agreed with the business.', p_reserva_id, r.negocio_id,
    'reag:' || p_reserva_id::text || ':' || extract(epoch from p_nuevo_inicio)::text);
  return r;
end $$;

revoke all on function public.slots_para_reagendar(uuid, date) from public, anon, authenticated;
revoke all on function public.reagendar_reserva(uuid, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.slots_para_reagendar(uuid, date) to authenticated;
grant execute on function public.reagendar_reserva(uuid, timestamptz, boolean) to authenticated;
