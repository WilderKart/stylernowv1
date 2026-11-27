-- 205: recuperar una reserva cuyo bloqueo temporal expiró (sin perder el turno ni el comprobante).
--
-- Antes: al vencer el bloqueo (10 min), `registrar_pago_directo_reserva`, `aceptar_politica_reserva` y el cobro respondían
-- RESERVA_NO_PAGABLE («la reserva expiró o cambió de estado») aunque el horario siguiera libre; y un comprobante de una transferencia ya
-- hecha se rechazaba. Ahora la expiración solo significa «perdiste el BLOQUEO», no el turno:
--
--   · `reserva_estado_recuperacion(reserva)`  → diagnóstico en servidor (VIGENTE / DISPONIBLE / NO_DISPONIBLE / PAGO_REPORTADO_* …)
--   · `reserva_recuperar(reserva, nueva_hora?, nuevo_staff?)` → re-adquiere el MISMO turno (o mueve la MISMA reserva a otro) de forma atómica
--   · `reserva_alternativas(reserva)` → horarios alternativos vigentes para el mismo servicio/sede
--   · `registrar_pago_directo_reserva` (parche) → acepta el comprobante aunque el bloqueo haya vencido: si el turno sigue libre lo
--     re-adquiere y confirma; si ya no, CONSERVA el comprobante (REPORTADO) y deja la reserva lista para reubicar sin volver a pagar.
--
-- Concurrencia: la reserva se bloquea FOR UPDATE y el turno se re-adquiere con un UPDATE que pasa por las restricciones EXCLUDE de la tabla
-- (reserva_sin_solape_staff / _recurso). Si otro cliente lo tomó entre la consulta y la adquisición, el UPDATE falla con exclusion_violation y
-- se responde NO_DISPONIBLE. No hay tablas, estados ni reservas nuevas: se reutiliza la misma fila (cero duplicados).
-- Reversión: 205_recuperar_reserva_bloqueo_expirado_REVERSION.sql.txt

-- ── Disponibilidad real de UNA reserva en una hora (reglas completas del motor: servicio activo y en la sede, profesional, horario…) ──
create or replace function public._reserva_cupo(p_reserva_id uuid, p_hora timestamptz, p_staff uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reserva; v_serv uuid[]; v_tz text; v_slot record;
begin
  select * into r from public.reserva where id = p_reserva_id;
  if not found then return jsonb_build_object('disponible', false, 'motivo', 'NO_ENCONTRADA'); end if;
  begin
    perform public._exigir_operativo(r.negocio_id);
  exception when others then
    return jsonb_build_object('disponible', false, 'motivo', 'NEGOCIO_NO_OPERATIVO');
  end;
  select array_agg(servicio_id) into v_serv from public.reserva_servicio where reserva_id = p_reserva_id;
  if coalesce(array_length(v_serv, 1), 0) = 0 then return jsonb_build_object('disponible', false, 'motivo', 'SERVICIO_NO_DISPONIBLE'); end if;
  select coalesce(s.zona_horaria, 'America/Bogota') into v_tz from public.sede s where s.id = r.sede_id;

  select * into v_slot from public.slots_disponibles(r.sede_id, v_serv, (p_hora at time zone coalesce(v_tz, 'America/Bogota'))::date, p_staff, 15) s
   where s.hora_inicio = p_hora and s.disponible limit 1;
  if found then
    return jsonb_build_object('disponible', true, 'staff_id', v_slot.staff_id, 'recurso_id', v_slot.recurso_id, 'hora_fin', v_slot.hora_fin);
  end if;
  -- Por qué no: se informa la causa más específica posible (el cliente solo ve un texto amable; esto sirve para decidir qué mostrar).
  if exists (select 1 from public.servicio sv where sv.id = any(v_serv) and sv.estado <> 'ACTIVO')
     or exists (select 1 from public.servicio_sede ss where ss.servicio_id = any(v_serv) and ss.sede_id = r.sede_id and not ss.activo) then
    return jsonb_build_object('disponible', false, 'motivo', 'SERVICIO_NO_DISPONIBLE');
  end if;
  if p_staff is not null and not exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p_staff and v.negocio_id = r.negocio_id and v.estado = 'ACTIVO' and v.presta_servicios) then
    return jsonb_build_object('disponible', false, 'motivo', 'PROFESIONAL_NO_DISPONIBLE');
  end if;
  return jsonb_build_object('disponible', false, 'motivo', 'HORARIO_OCUPADO');
end $$;
revoke all on function public._reserva_cupo(uuid, timestamptz, uuid) from public, anon, authenticated;

-- ── Núcleo transaccional ──
create or replace function public._reserva_recuperar_interno(p_reserva_id uuid, p_nueva_hora timestamptz, p_nuevo_staff uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.reserva; v_hora timestamptz; v_staff uuid; v_cupo jsonb; v_pago boolean; v_dur interval; v_estado public.reserva_estado;
  v_antes jsonb;
begin
  select * into r from public.reserva where id = p_reserva_id for update;       -- serializa reintentos/doble clic del MISMO cliente
  if not found then return jsonb_build_object('resultado', 'NO_ENCONTRADA'); end if;

  if r.estado in ('CONFIRMADA', 'EN_CURSO', 'COMPLETADA') then
    return jsonb_build_object('resultado', 'YA_CONFIRMADA', 'estado', r.estado);
  end if;
  -- Bloqueo todavía vigente y sin pedir otra hora: nada que recuperar (idempotente).
  if r.estado = 'PENDIENTE_PAGO' and (r.expira_at is null or r.expira_at >= now()) and (p_nueva_hora is null or p_nueva_hora = r.hora_inicio) then
    return jsonb_build_object('resultado', 'VIGENTE', 'estado', r.estado, 'expira_at', r.expira_at, 'hora_inicio', r.hora_inicio);
  end if;
  -- Un bloqueo vencido que aún figura como pendiente se cierra primero (igual que crear_reserva), para que no ocupe su propio turno.
  if r.estado = 'PENDIENTE_PAGO' and r.expira_at is not null and r.expira_at < now() then
    perform public.expirar_reservas_vencidas();
    select * into r from public.reserva where id = p_reserva_id;
  end if;
  -- Solo se recupera lo que se perdió por EXPIRAR el bloqueo (o una reserva vigente que pide moverse). Una cancelación real no se revierte.
  if not ((r.estado = 'CANCELADA' and r.cancelado_motivo = 'PAGO_EXPIRADO') or (r.estado = 'PENDIENTE_PAGO' and p_nueva_hora is not null)) then
    return jsonb_build_object('resultado', 'NO_RECUPERABLE', 'estado', r.estado);
  end if;

  v_hora := coalesce(p_nueva_hora, r.hora_inicio);
  v_staff := coalesce(p_nuevo_staff, r.staff_id);
  v_cupo := public._reserva_cupo(r.id, v_hora, v_staff);
  if not (v_cupo ->> 'disponible')::boolean then
    return jsonb_build_object('resultado', 'NO_DISPONIBLE', 'motivo', v_cupo ->> 'motivo');
  end if;

  -- Un comprobante ya reportado se CONSERVA: la reserva recuperada queda confirmada (regla del pago directo) sin pedir otro pago.
  v_pago := exists (select 1 from public.pago_reserva pr where pr.reserva_id = r.id and pr.metodo = 'TRANSFERENCIA_DIRECTA' and pr.estado in ('REPORTADO', 'VERIFICADO'));
  v_estado := case when v_pago then 'CONFIRMADA'::public.reserva_estado else 'PENDIENTE_PAGO'::public.reserva_estado end;
  v_antes := jsonb_build_object('estado', r.estado, 'hora_inicio', r.hora_inicio, 'staff_id', r.staff_id);

  begin
    update public.reserva
       set hora_inicio = v_hora, hora_fin = (v_cupo ->> 'hora_fin')::timestamptz,
           staff_id = (v_cupo ->> 'staff_id')::uuid, recurso_id = nullif(v_cupo ->> 'recurso_id', '')::uuid,
           estado = v_estado, cancelado_por = null, cancelado_motivo = null,
           expira_at = case when v_pago then null else now() + interval '10 minutes' end, updated_at = now()
     where id = r.id
    returning * into r;
  exception when exclusion_violation then
    -- Otro cliente adquirió el turno entre la consulta y este UPDATE: la restricción de solape decide, no esta función.
    return jsonb_build_object('resultado', 'NO_DISPONIBLE', 'motivo', 'HORARIO_OCUPADO');
  end;

  perform public._auditar('reserva', r.id, case when v_pago then 'RESERVA_RECUPERADA_CON_PAGO_REPORTADO' else 'RESERVA_BLOQUEO_RECUPERADO' end, r.negocio_id, v_antes,
    jsonb_build_object('estado', r.estado, 'hora_inicio', r.hora_inicio, 'staff_id', r.staff_id, 'misma_hora', p_nueva_hora is null), null);
  return jsonb_build_object('resultado', 'RECUPERADA', 'estado', r.estado, 'expira_at', r.expira_at, 'hora_inicio', r.hora_inicio,
                            'hora_fin', r.hora_fin, 'con_pago', v_pago);
end $$;
revoke all on function public._reserva_recuperar_interno(uuid, timestamptz, uuid) from public, anon, authenticated;

-- ── API del cliente ──
create or replace function public.reserva_estado_recuperacion(p_reserva_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.reserva; v_pago boolean; v_cupo jsonb; v_disp boolean;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id and cliente_id = auth.uid();
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  if r.estado in ('CONFIRMADA', 'EN_CURSO', 'COMPLETADA') then return jsonb_build_object('situacion', 'YA_CONFIRMADA'); end if;
  if r.estado = 'PENDIENTE_PAGO' and (r.expira_at is null or r.expira_at >= now()) then
    return jsonb_build_object('situacion', 'VIGENTE', 'expira_at', r.expira_at);
  end if;
  if r.estado = 'PENDIENTE_PAGO' then               -- vencida pero aún figuraba pendiente
    perform public.expirar_reservas_vencidas();
    select * into r from public.reserva where id = p_reserva_id;
  end if;
  if not (r.estado = 'CANCELADA' and r.cancelado_motivo = 'PAGO_EXPIRADO') then return jsonb_build_object('situacion', 'NO_RECUPERABLE'); end if;

  v_pago := exists (select 1 from public.pago_reserva pr where pr.reserva_id = r.id and pr.metodo = 'TRANSFERENCIA_DIRECTA' and pr.estado in ('REPORTADO', 'VERIFICADO'));
  v_cupo := public._reserva_cupo(r.id, r.hora_inicio, r.staff_id);
  v_disp := (v_cupo ->> 'disponible')::boolean;
  return jsonb_build_object(
    'situacion', case when v_pago and v_disp then 'PAGO_REPORTADO_DISPONIBLE' when v_pago then 'PAGO_REPORTADO_NO_DISPONIBLE'
                      when v_disp then 'DISPONIBLE' else 'NO_DISPONIBLE' end,
    'motivo', v_cupo ->> 'motivo', 'hora_inicio', r.hora_inicio, 'hay_pago_reportado', v_pago);
end $$;

create or replace function public.reserva_recuperar(p_reserva_id uuid, p_nueva_hora timestamptz default null, p_nuevo_staff uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.reserva where id = p_reserva_id and cliente_id = auth.uid()) then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if p_nueva_hora is not null and p_nueva_hora <= now() + interval '15 minutes' then
    return jsonb_build_object('resultado', 'NO_DISPONIBLE', 'motivo', 'HORARIO_OCUPADO');
  end if;
  return public._reserva_recuperar_interno(p_reserva_id, p_nueva_hora, p_nuevo_staff);
end $$;

-- Horarios alternativos (próximos días) para el mismo servicio y sede: primero con el mismo profesional, luego con cualquiera.
create or replace function public.reserva_alternativas(p_reserva_id uuid, p_dias int default 4)
returns table (hora_inicio timestamptz, staff_id uuid, staff_nombre text)
language plpgsql stable security definer set search_path = public as $$
declare r public.reserva; v_serv uuid[]; v_tz text; v_n int := least(greatest(coalesce(p_dias, 4), 1), 10);
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into r from public.reserva where id = p_reserva_id and cliente_id = auth.uid();
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  select array_agg(servicio_id) into v_serv from public.reserva_servicio where reserva_id = p_reserva_id;
  select coalesce(s.zona_horaria, 'America/Bogota') into v_tz from public.sede s where s.id = r.sede_id;
  v_tz := coalesce(v_tz, 'America/Bogota');
  return query
    select u.hora_inicio, u.staff_id, u.nombre
    from (
      select distinct on (c.hora_inicio, c.staff_id) c.hora_inicio, c.staff_id, c.nombre, c.mismo
      from (
        select s.hora_inicio, s.staff_id, st.nombre, (s.staff_id is not distinct from r.staff_id) as mismo
        from generate_series(0, v_n - 1) as d(i)
        cross join lateral public.slots_disponibles(r.sede_id, v_serv, (now() at time zone v_tz)::date + d.i, r.staff_id, 15) s
        left join public.staff st on st.usuario_id = s.staff_id
        where s.disponible and s.hora_inicio > now() + interval '30 minutes' and s.hora_inicio <> r.hora_inicio
        union all
        select s.hora_inicio, s.staff_id, st.nombre, (s.staff_id is not distinct from r.staff_id) as mismo
        from generate_series(0, v_n - 1) as d(i)
        cross join lateral public.slots_disponibles(r.sede_id, v_serv, (now() at time zone v_tz)::date + d.i, null, 15) s
        left join public.staff st on st.usuario_id = s.staff_id
        where s.disponible and s.hora_inicio > now() + interval '30 minutes' and s.hora_inicio <> r.hora_inicio
      ) c
      order by c.hora_inicio, c.staff_id
    ) u
    order by u.mismo desc, u.hora_inicio
    limit 8;
end $$;

revoke all on function public.reserva_estado_recuperacion(uuid), public.reserva_recuperar(uuid, timestamptz, uuid), public.reserva_alternativas(uuid, int) from public, anon, authenticated;
grant execute on function public.reserva_estado_recuperacion(uuid), public.reserva_recuperar(uuid, timestamptz, uuid), public.reserva_alternativas(uuid, int) to authenticated;

-- ── Parche: el comprobante de una transferencia ya hecha NUNCA se rechaza por haber vencido el bloqueo ──
do $$
declare v_def text;
  v_d1 constant text := 'declare r public.reserva; m public.negocio_medio_pago_directo; v_id uuid; v_ref text; v_owner uuid;';
  v_g1 constant text := E'  if r.estado <> ''PENDIENTE_PAGO'' or (r.expira_at is not null and r.expira_at < now()) then raise exception ''RESERVA_NO_PAGABLE''; end if;';
  v_u1 constant text := E'  begin\n    update public.reserva set estado = ''CONFIRMADA'', expira_at = null, updated_at = now() where id = r.id;\n  exception when exclusion_violation then\n    raise exception ''HORARIO_NO_DISPONIBLE'';\n  end;';
begin
  v_def := replace(pg_get_functiondef('public.registrar_pago_directo_reserva(uuid,numeric,text,text)'::regprocedure), E'\r', '');
  if position('v_recuperada' in v_def) > 0 then return; end if;     -- ya parchada
  if position(v_d1 in v_def) = 0 or position(v_g1 in v_def) = 0 or position(v_u1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA registrar_pago_directo_reserva'; end if;
  v_def := replace(v_def, v_d1, v_d1 || E'\n  v_expirada boolean; v_recuperada boolean := true; v_rec jsonb;');
  v_def := replace(v_def, v_g1,
    E'  v_expirada := (r.estado = ''PENDIENTE_PAGO'' and r.expira_at is not null and r.expira_at < now()) or (r.estado = ''CANCELADA'' and r.cancelado_motivo = ''PAGO_EXPIRADO'');\n'
    || E'  if r.estado <> ''PENDIENTE_PAGO'' and not v_expirada then raise exception ''RESERVA_NO_PAGABLE''; end if;\n'
    || E'  if v_expirada then\n'
    || E'    -- Venció el bloqueo pero el cliente ya transfirió: se intenta re-adquirir el MISMO turno; si ya no está libre, el comprobante se conserva igual.\n'
    || E'    v_rec := public._reserva_recuperar_interno(r.id, null, null);\n'
    || E'    v_recuperada := (v_rec ->> ''resultado'') in (''RECUPERADA'', ''VIGENTE'');\n'
    || E'    select * into r from public.reserva where id = r.id;\n'
    || E'  end if;');
  v_def := replace(v_def, v_u1,
    E'  if v_recuperada then\n  begin\n    update public.reserva set estado = ''CONFIRMADA'', expira_at = null, updated_at = now() where id = r.id;\n  exception when exclusion_violation then\n    raise exception ''HORARIO_NO_DISPONIBLE'';\n  end;\n  end if;');
  execute v_def;
end $$;

-- ── Parche: aceptar la política (paso previo al pago) tampoco debe rechazar una reserva que SOLO perdió su bloqueo ──
do $$
declare v_def text;
  v_a constant text := E'  if v_reserva.estado <> ''PENDIENTE_PAGO'' then raise exception ''RESERVA_NO_PAGABLE''; end if;';
begin
  v_def := replace(pg_get_functiondef('public.aceptar_politica_reserva(uuid)'::regprocedure), E'\r', '');
  if position('PAGO_EXPIRADO' in v_def) > 0 then return; end if;     -- ya parchada
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA aceptar_politica_reserva'; end if;
  execute replace(v_def, v_a,
    E'  if v_reserva.estado <> ''PENDIENTE_PAGO'' and not (v_reserva.estado = ''CANCELADA'' and v_reserva.cancelado_motivo = ''PAGO_EXPIRADO'') then raise exception ''RESERVA_NO_PAGABLE''; end if;');
end $$;
