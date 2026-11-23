create or replace function public.crear_reserva(
  p_sede_id uuid,
  p_servicio_ids uuid[],
  p_hora_inicio timestamptz,
  p_staff_id uuid default null,
  p_idempotency_key text default null
)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_cliente uuid := auth.uid();
  v_sede public.sede;
  v_negocio public.negocio;
  v_tz text;
  v_fecha date;
  v_slot record;
  v_dur int;
  v_buf_prev int;
  v_buf_post int;
  v_monto_total numeric;
  v_sena numeric;
  v_reserva public.reserva;
begin
  if v_cliente is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtext(v_cliente::text || ':' || p_idempotency_key));
  end if;

  perform public._exigir_operativo_sede(p_sede_id);
  perform public.expirar_reservas_vencidas();

  if p_idempotency_key is not null then
    select * into v_reserva from public.reserva
    where cliente_id = v_cliente and idempotency_key = p_idempotency_key;
    if found then
      return v_reserva;
    end if;
  end if;

  select * into v_sede from public.sede where id = p_sede_id;
  if not found then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;

  select * into v_negocio from public.negocio where id = v_sede.negocio_id;
  if v_negocio.estado <> 'ACTIVO' then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;

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

  v_sena := public.calcular_sena_servicios(v_negocio.id, p_servicio_ids, v_monto_total);

  begin
    insert into public.reserva (
      cliente_id, negocio_id, sede_id, staff_id, recurso_id,
      hora_inicio, hora_fin, estado, monto_total, monto_sena,
      buffer_previo_minutos, buffer_posterior_minutos, expira_at, idempotency_key
    ) values (
      v_cliente, v_negocio.id, p_sede_id, v_slot.staff_id, v_slot.recurso_id,
      p_hora_inicio, v_slot.hora_fin, case when v_sena > 0 then 'PENDIENTE_PAGO'::public.reserva_estado else 'CONFIRMADA'::public.reserva_estado end, v_monto_total, v_sena,
      v_buf_prev, v_buf_post, case when v_sena > 0 then now() + interval '10 minutes' end, p_idempotency_key
    )
    returning * into v_reserva;
  exception
    when unique_violation then
      if p_idempotency_key is not null then
        select * into v_reserva from public.reserva
        where cliente_id = v_cliente and idempotency_key = p_idempotency_key;
        if found then
          return v_reserva;
        end if;
      end if;
      raise;
    when exclusion_violation then
      if p_idempotency_key is not null then
        select * into v_reserva from public.reserva
        where cliente_id = v_cliente and idempotency_key = p_idempotency_key;
        if found then
          return v_reserva;
        end if;
      end if;
      raise exception 'SLOT_NO_DISPONIBLE';
  end;

  insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario)
  select v_reserva.id, s.id, s.precio_base
  from public.servicio s
  where s.id = any(p_servicio_ids) and s.negocio_id = v_negocio.id;

  return v_reserva;
end;
$fn$;
