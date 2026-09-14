-- StylerNow — Migración 008: motor de disponibilidad, Reserva y Pago
-- Fuente: 03-Business-Rules/02_Booking_Rules.md (7 validaciones, lock, CUALQUIERA_DISPONIBLE)
--         03-Business-Rules/03_Payment_Rules.md (Seña, expiración 10 min, reembolsos)
--         05-API/03_Bookings.md, 05-API/04_Payments.md, 05-API/06_Webhooks.md (idempotencia)
--
-- Zero-trust: ninguna de estas funciones acepta montos, precios ni Staff enviados por el
-- cliente. Todo se recalcula desde la base de datos con la identidad de `auth.uid()`.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Ajustes de esquema
-- ════════════════════════════════════════════════════════════════════════

-- Los buffers son parte del bloque ocupado del Staff/Recurso pero NO son visibles al
-- Cliente (02_Booking_Rules.md). Se guardan aparte para que `hora_inicio`/`hora_fin`
-- sigan siendo la ventana real del Servicio y el `rango` del lock incluya los buffers.
alter table public.reserva
  add column if not exists buffer_previo_minutos int not null default 0,
  add column if not exists buffer_posterior_minutos int not null default 0,
  add column if not exists bloqueo_inicio timestamptz,     -- ventana real ocupada, con buffers
  add column if not exists bloqueo_fin timestamptz,
  add column if not exists expira_at timestamptz,          -- ventana de 10 min en PENDIENTE_PAGO
  add column if not exists idempotency_key text;           -- 05-API/01_Standards.md

alter table public.reserva drop constraint if exists reserva_sin_solape_staff;
alter table public.reserva drop constraint if exists reserva_sin_solape_recurso;
drop index if exists public.reserva_staff_rango_gist;
alter table public.reserva drop column if exists rango;

-- `timestamptz ± interval` es STABLE, no IMMUTABLE (depende de la zona de sesión), así
-- que no puede ir dentro de una columna generada. El bloque se materializa en un trigger
-- BEFORE, que corre antes de que se compute la columna generada.
create or replace function public.reserva_calcular_bloqueo()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.bloqueo_inicio := new.hora_inicio - make_interval(mins => coalesce(new.buffer_previo_minutos, 0));
  new.bloqueo_fin    := new.hora_fin    + make_interval(mins => coalesce(new.buffer_posterior_minutos, 0));
  return new;
end;
$fn$;

drop trigger if exists trg_reserva_bloqueo on public.reserva;
create trigger trg_reserva_bloqueo
  before insert or update on public.reserva
  for each row execute function public.reserva_calcular_bloqueo();

-- Las filas previas a esta migración tienen buffers en 0, así que el coalesce las deja
-- exactamente igual que antes: no hace falta backfill.
alter table public.reserva add column rango tstzrange
  generated always as (
    tstzrange(
      coalesce(bloqueo_inicio, hora_inicio),
      coalesce(bloqueo_fin, hora_fin),
      '[)'
    )
  ) stored;

-- El lock ahora incluye PENDIENTE_PAGO: una Reserva sin pagar retiene el horario durante
-- su ventana de 10 minutos (03_Payment_Rules.md). `expirar_reservas_vencidas()` libera las
-- vencidas antes de cada intento de reserva, así el lock nunca retiene de más.
alter table public.reserva add constraint reserva_sin_solape_staff
  exclude using gist (staff_id with =, rango with &&)
  where (estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO'));

alter table public.reserva add constraint reserva_sin_solape_recurso
  exclude using gist (recurso_id with =, rango with &&)
  where (estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO') and recurso_id is not null);

create unique index if not exists reserva_idempotency_idx
  on public.reserva(cliente_id, idempotency_key) where idempotency_key is not null;

create index if not exists reserva_expira_idx
  on public.reserva(expira_at) where estado = 'PENDIENTE_PAGO';

-- ── Pago: datos de pasarela ──────────────────────────────────────────────
alter table public.pago
  add column if not exists id_preferencia_pasarela text,   -- preference_id de Mercado Pago
  add column if not exists payload_pasarela jsonb,         -- último evento crudo, para auditoría
  add column if not exists monto_reembolsado numeric(12,2) not null default 0,
  add column if not exists es_huerfano boolean not null default false, -- 06_Webhooks.md, caso límite
  add column if not exists procesado_at timestamptz;

alter table public.pago alter column pasarela set default 'MERCADO_PAGO';

create index if not exists pago_preferencia_idx on public.pago(id_preferencia_pasarela);

comment on column public.pago.id_transaccion_pasarela is
  'Clave de idempotencia del webhook (05-API/06_Webhooks.md): un mismo id nunca produce dos efectos de negocio.';

-- ════════════════════════════════════════════════════════════════════════
-- 2. Cálculo de la Seña (03-Business-Rules/03_Payment_Rules.md)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.calcular_sena(p_negocio_id uuid, p_monto_total numeric)
returns numeric
language plpgsql stable security definer set search_path = public as $fn$
declare
  n public.negocio;
  v numeric;
begin
  select * into n from public.negocio where id = p_negocio_id;
  if not found then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;

  -- El Negocio puede habilitar el cobro del 100% en app (componente "Saldo").
  if n.pago_completo_en_app then
    return p_monto_total;
  end if;

  v := coalesce(n.sena_monto_fijo, round(p_monto_total * coalesce(n.sena_pct, 20) / 100));
  v := greatest(v, n.sena_minimo);
  v := least(v, n.sena_maximo);
  -- La Seña nunca supera el valor total del Servicio, ni siquiera por efecto del mínimo.
  return least(v, p_monto_total);
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Expiración automática de Reservas sin pagar (10 minutos)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.expirar_reservas_vencidas()
returns int
language plpgsql security definer set search_path = public as $fn$
declare
  v_ids uuid[];
begin
  with vencidas as (
    update public.reserva
    set estado = 'CANCELADA',
        cancelado_por = 'PLATAFORMA',
        cancelado_motivo = 'PAGO_EXPIRADO',
        updated_at = now()
    where estado = 'PENDIENTE_PAGO'
      and expira_at is not null
      and expira_at < now()
    returning id
  )
  select array_agg(id) into v_ids from vencidas;

  if v_ids is not null then
    update public.pago
    set estado = 'RECHAZADO', updated_at = now()
    where reserva_id = any(v_ids) and estado = 'PENDIENTE';
  end if;

  return coalesce(array_length(v_ids, 1), 0);
end;
$fn$;

comment on function public.expirar_reservas_vencidas is
  '03-Business-Rules/03_Payment_Rules.md: toda Reserva PENDIENTE_PAGO expira a los 10 minutos.';

-- ════════════════════════════════════════════════════════════════════════
-- 4. Disponibilidad — las 7 validaciones de 02_Booking_Rules.md
-- ════════════════════════════════════════════════════════════════════════
--
-- Devuelve TODOS los slots de la jornada con un flag `disponible`, no solo los libres:
-- 02-UX/05_Booking.md exige mostrar los ocupados tachados, nunca ausentes.
-- Con `p_staff_id` nulo aplica CUALQUIERA_DISPONIBLE y elige Staff por
-- (1) mayor Nivel, (2) menor carga del día, (3) azar como desempate final.

create or replace function public.slots_disponibles(
  p_sede_id uuid,
  p_servicio_ids uuid[],
  p_fecha date,
  p_staff_id uuid default null,
  p_granularidad_minutos int default 15
)
returns table (
  hora_inicio timestamptz,
  hora_fin timestamptz,
  staff_id uuid,
  recurso_id uuid,
  disponible boolean
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_sede public.sede;
  v_negocio public.negocio;
  v_tz text;
  v_dur int;
  v_buf_prev int;
  v_buf_post int;
  v_tipo_recurso uuid;
  v_n_servicios int;
  v_dia int;
  v_clave text;
  v_min_inicio timestamptz;
  v_max_inicio timestamptz;
begin
  select * into v_sede from public.sede where id = p_sede_id;
  if not found or v_sede.cerrada_permanente or v_sede.cerrada_temporalmente then
    return;
  end if;

  select * into v_negocio from public.negocio where id = v_sede.negocio_id;
  if not found or v_negocio.estado <> 'ACTIVO' then
    return;
  end if;

  v_tz := coalesce(v_sede.zona_horaria, 'America/Bogota');

  -- Duración y buffers del combo. Un Servicio inactivo o de otro Negocio invalida la consulta.
  select count(*),
         coalesce(sum(s.duracion_minutos), 0),
         coalesce(sum(s.buffer_previo_minutos), 0),
         coalesce(sum(s.buffer_posterior_minutos), 0),
         max(s.requiere_recurso_tipo_id)
    into v_n_servicios, v_dur, v_buf_prev, v_buf_post, v_tipo_recurso
  from public.servicio s
  where s.id = any(p_servicio_ids)
    and s.negocio_id = v_negocio.id
    and s.estado = 'ACTIVO';

  if v_n_servicios = 0 or v_n_servicios <> coalesce(array_length(p_servicio_ids, 1), 0) then
    return;
  end if;

  -- Reglas 6 y 7: anticipación mínima y ventana máxima de reserva anticipada.
  v_min_inicio := now() + make_interval(mins => v_negocio.min_anticipacion_minutos);
  v_max_inicio := now() + make_interval(days => v_negocio.max_anticipacion_dias);

  v_dia := extract(dow from p_fecha)::int;                    -- 0 = domingo
  v_clave := (array['dom','lun','mar','mie','jue','vie','sab'])[v_dia + 1];

  return query
  with sede_ventanas as (
    -- Regla 5: horario de apertura de la Sede. `horario_base` vacío = sin restricción de
    -- Sede (manda el horario del Staff); clave de día ausente con horario cargado = cerrada.
    select (elem ->> 0)::time as h_ini, (elem ->> 1)::time as h_fin
    from jsonb_array_elements(coalesce(v_sede.horario_base -> v_clave, '[]'::jsonb)) as elem
    where v_sede.horario_base <> '{}'::jsonb
    union all
    select '00:00'::time, '23:59:59'::time
    where v_sede.horario_base = '{}'::jsonb
  ),
  staff_cand as (
    -- Staff con vínculo ACTIVO en esta Sede que presta TODOS los Servicios del combo.
    -- Si ninguno los cubre todos, el resultado es vacío (combo sin Staff único).
    select v.id as vinculo_id, v.staff_id
    from public.vinculo_staff_negocio v
    where v.negocio_id = v_negocio.id
      and v.estado = 'ACTIVO'
      and (v.sede_activa_id = p_sede_id or v.sede_activa_id is null)
      and (p_staff_id is null or v.staff_id = p_staff_id)
      and not exists (
        select 1 from unnest(p_servicio_ids) as sid
        where not exists (
          select 1 from public.staff_servicio ss
          where ss.staff_id = v.staff_id and ss.servicio_id = sid
        )
      )
  ),
  ventanas as (
    -- Regla 2 ∩ Regla 5: intersección de la jornada del Staff con la apertura de la Sede.
    select sc.vinculo_id, sc.staff_id,
           greatest(d.hora_inicio, sv.h_ini) as h_ini,
           least(d.hora_fin, sv.h_fin) as h_fin
    from staff_cand sc
    join public.disponibilidad d
      on d.vinculo_id = sc.vinculo_id and d.sede_id = p_sede_id and d.dia_semana = v_dia
    cross join sede_ventanas sv
    where greatest(d.hora_inicio, sv.h_ini) < least(d.hora_fin, sv.h_fin)
  ),
  slots as (
    -- El bloque completo (servicio + buffers) debe caber dentro de la ventana laboral.
    select v.vinculo_id, v.staff_id, gs.inicio
    from ventanas v
    cross join lateral generate_series(
      timezone(v_tz, (p_fecha + v.h_ini)::timestamp) + make_interval(mins => v_buf_prev),
      timezone(v_tz, (p_fecha + v.h_fin)::timestamp) - make_interval(mins => v_dur + v_buf_post),
      make_interval(mins => greatest(p_granularidad_minutos, 5))
    ) as gs(inicio)
  ),
  evaluados as (
    select s.vinculo_id, s.staff_id, s.inicio,
           tstzrange(
             s.inicio - make_interval(mins => v_buf_prev),
             s.inicio + make_interval(mins => v_dur + v_buf_post),
             '[)'
           ) as bloque
    from slots s
  ),
  con_estado as (
    select
      e.inicio,
      e.staff_id,
      e.vinculo_id,
      -- Regla 4: Recurso libre del tipo requerido, si algún Servicio lo exige.
      (
        select r.id from public.recurso r
        where v_tipo_recurso is not null
          and r.sede_id = p_sede_id
          and r.recurso_tipo_id = v_tipo_recurso
          and r.estado = 'DISPONIBLE'
          and not exists (
            select 1 from public.reserva rr
            where rr.recurso_id = r.id
              and rr.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO')
              and rr.rango && e.bloque
          )
        limit 1
      ) as recurso_id,
      (
        e.inicio >= v_min_inicio and e.inicio <= v_max_inicio           -- reglas 6 y 7
        -- Regla 1: sin solape con otra Reserva activa del mismo Staff.
        and not exists (
          select 1 from public.reserva rr
          where rr.staff_id = e.staff_id
            and rr.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO')
            and rr.rango && e.bloque
        )
        -- Regla 3: sin bloqueo de ausencia activo en el rango.
        and not exists (
          select 1 from public.bloqueo_ausencia ba
          where ba.vinculo_id = e.vinculo_id
            and tstzrange(ba.fecha_inicio, ba.fecha_fin, '[)') && e.bloque
        )
      ) as libre_staff
    from evaluados e
  ),
  nivel as (
    select nc.vinculo_id,
           max(case nc.nivel when 'MASTER' then 3 when 'EXPERT' then 2 else 1 end) as rango_nivel
    from public.nivel_staff_consolidado nc
    group by nc.vinculo_id
  ),
  carga as (
    select r.staff_id, count(*) as reservas_dia
    from public.reserva r
    where r.estado in ('PENDIENTE_PAGO','CONFIRMADA','EN_CURSO','COMPLETADA')
      and (r.hora_inicio at time zone v_tz)::date = p_fecha
    group by r.staff_id
  ),
  elegido as (
    select
      c.inicio,
      c.staff_id,
      c.recurso_id,
      (c.libre_staff and (v_tipo_recurso is null or c.recurso_id is not null)) as ok,
      row_number() over (
        partition by c.inicio
        order by
          (c.libre_staff and (v_tipo_recurso is null or c.recurso_id is not null)) desc,
          coalesce(n.rango_nivel, 0) desc,
          coalesce(cg.reservas_dia, 0) asc,
          random()
      ) as rn
    from con_estado c
    left join nivel n on n.vinculo_id = c.vinculo_id
    left join carga cg on cg.staff_id = c.staff_id
  )
  select
    el.inicio,
    el.inicio + make_interval(mins => v_dur),
    el.staff_id,
    el.recurso_id,
    el.ok
  from elegido el
  where el.rn = 1
  order by el.inicio;
end;
$fn$;

comment on function public.slots_disponibles is
  '03-Business-Rules/02_Booking_Rules.md: las 7 validaciones de disponibilidad + CUALQUIERA_DISPONIBLE.';

-- ════════════════════════════════════════════════════════════════════════
-- 5. Creación de Reserva (PENDIENTE_PAGO) con lock de base de datos
-- ════════════════════════════════════════════════════════════════════════

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

  -- Libera horarios de Reservas sin pagar ya vencidas antes de evaluar disponibilidad.
  perform public.expirar_reservas_vencidas();

  -- 05-API/03_Bookings.md: un reintento con la misma Idempotency-Key devuelve la original.
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

  -- Re-validación server-side: el slot debe seguir cumpliendo las 7 reglas AHORA.
  select * into v_slot
  from public.slots_disponibles(p_sede_id, p_servicio_ids, v_fecha, p_staff_id)
  where slots_disponibles.hora_inicio = p_hora_inicio
    and slots_disponibles.disponible;

  if not found then
    raise exception 'SLOT_NO_DISPONIBLE';
  end if;

  -- Precio y duración se leen de la base, nunca del cliente.
  select coalesce(sum(s.precio_base), 0),
         coalesce(sum(s.duracion_minutos), 0),
         coalesce(sum(s.buffer_previo_minutos), 0),
         coalesce(sum(s.buffer_posterior_minutos), 0)
    into v_monto_total, v_dur, v_buf_prev, v_buf_post
  from public.servicio s
  where s.id = any(p_servicio_ids) and s.negocio_id = v_negocio.id and s.estado = 'ACTIVO';

  v_sena := public.calcular_sena(v_negocio.id, v_monto_total);

  begin
    insert into public.reserva (
      cliente_id, negocio_id, sede_id, staff_id, recurso_id,
      hora_inicio, hora_fin, estado, monto_total, monto_sena,
      buffer_previo_minutos, buffer_posterior_minutos, expira_at, idempotency_key
    ) values (
      v_cliente, v_negocio.id, p_sede_id, v_slot.staff_id, v_slot.recurso_id,
      p_hora_inicio, v_slot.hora_fin, 'PENDIENTE_PAGO', v_monto_total, v_sena,
      v_buf_prev, v_buf_post, now() + interval '10 minutes', p_idempotency_key
    )
    returning * into v_reserva;
  exception
    when exclusion_violation then
      -- Condición de carrera genuina: otro Cliente tomó el slot en la misma fracción.
      raise exception 'SLOT_NO_DISPONIBLE';
  end;

  -- Business_Rules_Bible.md: el precio queda congelado al momento de reservar.
  insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario)
  select v_reserva.id, s.id, s.precio_base
  from public.servicio s
  where s.id = any(p_servicio_ids) and s.negocio_id = v_negocio.id;

  return v_reserva;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Iniciación del cobro de Seña (05-API/04_Payments.md)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_pago_sena(p_reserva_id uuid)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_cliente uuid := auth.uid();
  v_reserva public.reserva;
  v_pago public.pago;
begin
  if v_cliente is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  select * into v_reserva from public.reserva
  where id = p_reserva_id and cliente_id = v_cliente;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  if exists (
    select 1 from public.pago
    where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'APROBADO'
  ) then
    raise exception 'PAGO_YA_PROCESADO';
  end if;

  if v_reserva.estado <> 'PENDIENTE_PAGO' then
    raise exception 'RESERVA_NO_PAGABLE';
  end if;

  -- Reutiliza el pago PENDIENTE existente: reintentar el cobro no crea un segundo cargo.
  select * into v_pago from public.pago
  where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'PENDIENTE'
  order by created_at desc limit 1;

  if found then
    return v_pago;
  end if;

  insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, pasarela)
  values (p_reserva_id, v_reserva.negocio_id, 'SENA', v_reserva.monto_sena, 'PENDIENTE', 'MERCADO_PAGO')
  returning * into v_pago;

  return v_pago;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Aplicación idempotente de un evento de pasarela (05-API/06_Webhooks.md)
-- ════════════════════════════════════════════════════════════════════════
--
-- Se invoca exclusivamente desde el Route Handler del webhook con service_role, después
-- de re-consultar el pago contra la API de la pasarela — nunca se confía en el cuerpo
-- del webhook como fuente de verdad del estado.

create or replace function public.aplicar_evento_pago(
  p_pago_id uuid,
  p_id_transaccion text,
  p_estado pago_estado,
  p_payload jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_pago public.pago;
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_comision numeric := 0;
begin
  select * into v_pago from public.pago where id = p_pago_id for update;
  if not found then
    return jsonb_build_object('procesado', false, 'motivo', 'PAGO_NO_ENCONTRADO');
  end if;

  -- Idempotencia: un pago ya en estado terminal no vuelve a producir efectos de negocio.
  if v_pago.estado in ('APROBADO','RECHAZADO','REEMBOLSADO','REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_PROCESADO', 'estado', v_pago.estado);
  end if;

  select * into v_reserva from public.reserva where id = v_pago.reserva_id for update;
  select * into v_negocio from public.negocio where id = v_pago.negocio_id;

  if p_estado = 'APROBADO' then
    v_comision := round(v_pago.monto * coalesce(v_negocio.comision_plataforma_pct, 8) / 100, 2);

    update public.pago
    set estado = 'APROBADO',
        id_transaccion_pasarela = p_id_transaccion,
        comision_plataforma_monto = v_comision,
        payload_pasarela = p_payload,
        procesado_at = now(),
        updated_at = now()
    where id = p_pago_id;

    -- 03_Payment_Rules.md: pago que confirma DESPUÉS de la expiración → reembolso total.
    if v_reserva.id is null or v_reserva.estado <> 'PENDIENTE_PAGO' then
      return jsonb_build_object(
        'procesado', true,
        'requiere_reembolso', true,
        'motivo', 'RESERVA_EXPIRADA',
        'reserva_id', v_reserva.id
      );
    end if;

    update public.reserva
    set estado = 'CONFIRMADA', expira_at = null, updated_at = now()
    where id = v_reserva.id;

    insert into public.evento_auditoria
      (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues)
    values
      ('reserva', v_reserva.id, 'RESERVA_CONFIRMADA', 'SISTEMA', v_negocio.id,
       jsonb_build_object('pago_id', p_pago_id, 'id_transaccion', p_id_transaccion));

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  if p_estado = 'RECHAZADO' then
    update public.pago
    set estado = 'RECHAZADO',
        id_transaccion_pasarela = coalesce(p_id_transaccion, id_transaccion_pasarela),
        payload_pasarela = p_payload,
        procesado_at = now(),
        updated_at = now()
    where id = p_pago_id;

    -- El horario vuelve a estar disponible de inmediato para otro Cliente.
    if v_reserva.id is not null and v_reserva.estado = 'PENDIENTE_PAGO' then
      update public.reserva
      set estado = 'CANCELADA',
          cancelado_por = 'PLATAFORMA',
          cancelado_motivo = 'PAGO_RECHAZADO',
          updated_at = now()
      where id = v_reserva.id;
    end if;

    return jsonb_build_object('procesado', true, 'requiere_reembolso', false, 'reserva_id', v_reserva.id);
  end if;

  return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_SOPORTADO');
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. Cancelación con cálculo de reembolso (03-Business-Rules/03_Payment_Rules.md)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.cancelar_reserva(
  p_reserva_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_actor uuid := auth.uid();
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_es_cliente boolean;
  v_es_negocio boolean;
  v_horas numeric;
  v_pct numeric;
  v_pago public.pago;
  v_tiene_pago boolean;
  v_monto_reembolso numeric := 0;
  v_motivo_catalogo text;
begin
  if v_actor is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;

  v_es_cliente := v_reserva.cliente_id = v_actor;
  v_es_negocio := public.is_barberia_de(v_reserva.negocio_id)
               or public.is_guardian_de_sede(v_reserva.sede_id)
               or v_reserva.staff_id = v_actor;

  if not (v_es_cliente or v_es_negocio or public.is_supersu()) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_reserva.estado in ('COMPLETADA','CANCELADA','NO_SHOW') then
    raise exception 'RESERVA_NO_CANCELABLE';
  end if;

  v_horas := extract(epoch from (v_reserva.hora_inicio - now())) / 3600;

  if v_es_cliente and not v_es_negocio then
    -- Ventanas configurables por Negocio; los topes de plataforma ya los valida el esquema.
    if v_horas >= v_negocio.ventana_reembolso_total_horas then
      v_pct := 100;
      v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_TOTAL';
    elsif v_horas >= v_negocio.ventana_reembolso_parcial_horas then
      v_pct := v_negocio.reembolso_parcial_pct;
      v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_PARCIAL';
    else
      v_pct := 0;
      v_motivo_catalogo := null;
    end if;
  else
    -- Cancelación iniciada por el Negocio o la plataforma: 100%, siempre, sin excepción.
    v_pct := 100;
    v_motivo_catalogo := 'CANCELACION_NEGOCIO';
  end if;

  update public.reserva
  set estado = 'CANCELADA',
      cancelado_por = case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'NEGOCIO' end,
      cancelado_motivo = p_motivo,
      updated_at = now()
  where id = p_reserva_id;

  select * into v_pago from public.pago
  where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'APROBADO'
  order by created_at desc limit 1;
  v_tiene_pago := found;

  if v_tiene_pago and v_pct > 0 then
    v_monto_reembolso := round(v_pago.monto * v_pct / 100, 2);
  end if;

  insert into public.evento_auditoria
    (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values
    ('reserva', p_reserva_id, 'RESERVA_CANCELADA',
     case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end,
     v_actor, v_negocio.id, p_motivo,
     jsonb_build_object('reembolso_pct', v_pct, 'reembolso_monto', v_monto_reembolso));

  -- El reembolso contra la pasarela lo ejecuta el servidor tras esta transición
  -- (05-API/04_Payments.md): aquí se devuelve el monto autorizado, el `pago` sigue
  -- APROBADO hasta que la pasarela confirme la devolución.
  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'pago_id', case when v_tiene_pago then v_pago.id else null end,
    'reembolso_pct', v_pct,
    'reembolso_monto', v_monto_reembolso,
    'motivo_catalogo', v_motivo_catalogo
  );
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. Grants — cada rol solo puede invocar lo que le corresponde
-- ════════════════════════════════════════════════════════════════════════

revoke all on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) from public;
revoke all on function public.expirar_reservas_vencidas() from public;

grant execute on function public.slots_disponibles(uuid, uuid[], date, uuid, int) to anon, authenticated;
grant execute on function public.calcular_sena(uuid, numeric) to anon, authenticated;
grant execute on function public.crear_reserva(uuid, uuid[], timestamptz, uuid, text) to authenticated;
grant execute on function public.crear_pago_sena(uuid) to authenticated;
grant execute on function public.cancelar_reserva(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 10. Descubrimiento del Marketplace (02-UX/04_Marketplace.md)
-- ════════════════════════════════════════════════════════════════════════
--
-- El orden por Score de 08-Growth-Monetization/01_Marketplace_Algorithm.md es un
-- módulo posterior; aquí se implementa la capa visual: búsqueda, filtros y los
-- datos de tarjeta (rating, precio desde, próxima disponibilidad).
-- `proxima_disponibilidad` se calcula por lateral SOLO sobre la página ya limitada.

create or replace function public.marketplace_buscar(
  p_texto text default null,
  p_ciudad text default null,
  p_categoria text default null,
  p_orden text default 'RELEVANCIA',
  p_limite int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  nombre text,
  slug text,
  ciudad text,
  categoria text[],
  descripcion text,
  logo_url text,
  calificacion numeric,
  total_resenas bigint,
  precio_desde numeric,
  sede_id uuid,
  proxima_disponibilidad timestamptz
)
language sql stable set search_path = public as $fn$
  with base as (
    select
      n.id, n.nombre, n.slug, n.ciudad, n.categoria, n.descripcion, n.logo_url, n.created_at,
      (select round(avg(re.calificacion)::numeric, 2) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as calificacion,
      (select count(*) from public.resena re
        where re.negocio_id = n.id and re.estado = 'VISIBLE') as total_resenas,
      (select min(sv.precio_base) from public.servicio sv
        where sv.negocio_id = n.id and sv.estado = 'ACTIVO') as precio_desde
    from public.negocio n
    where n.estado = 'ACTIVO'
      and n.elegibilidad_marketplace                                   -- 06-Security/03_Fraud.md
      and (p_ciudad is null or n.ciudad ilike p_ciudad)
      and (p_categoria is null or p_categoria = any(n.categoria))
      and (
        p_texto is null or p_texto = ''
        or n.nombre ilike '%' || p_texto || '%'
        or coalesce(n.descripcion, '') ilike '%' || p_texto || '%'
      )
  ),
  ordenado as (
    select * from base
    order by
      case when p_orden = 'CALIFICACION' then calificacion end desc nulls last,
      case when p_orden = 'PRECIO' then precio_desde end asc nulls last,
      case when p_orden = 'RECIENTE' then created_at end desc,
      calificacion desc nulls last,
      created_at desc
    limit greatest(coalesce(p_limite, 20), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    o.id, o.nombre, o.slug, o.ciudad, o.categoria, o.descripcion, o.logo_url,
    coalesce(o.calificacion, 0), o.total_resenas, o.precio_desde,
    sede.id, prox.inicio
  from ordenado o
  left join lateral (
    select s.id, s.zona_horaria
    from public.sede s
    where s.negocio_id = o.id
      and not s.cerrada_permanente
      and not s.cerrada_temporalmente
    order by s.created_at
    limit 1
  ) sede on true
  left join lateral (
    -- Próxima disponibilidad de hoy, evaluada sobre el Servicio más económico:
    -- es una señal de tarjeta, no el calendario completo (ese es 05_Booking.md).
    select min(sd.hora_inicio) as inicio
    from public.slots_disponibles(
      sede.id,
      array[(
        select sv.id from public.servicio sv
        where sv.negocio_id = o.id and sv.estado = 'ACTIVO'
        order by sv.precio_base
        limit 1
      )],
      (now() at time zone coalesce(sede.zona_horaria, 'America/Bogota'))::date,
      null,
      30
    ) sd
    where sd.disponible
  ) prox on true;
$fn$;

comment on function public.marketplace_buscar is
  '02-UX/04_Marketplace.md: descubrimiento con búsqueda, filtros y datos de tarjeta.';

-- ════════════════════════════════════════════════════════════════════════
-- 11. Perfil público: Staff y reseñas
-- ════════════════════════════════════════════════════════════════════════
--
-- `vinculo_staff_negocio` no tiene política de lectura pública (expone comisiones),
-- y `perfil` tampoco (datos del Cliente). Estas dos funciones proyectan únicamente
-- las columnas que el perfil público puede mostrar.

create or replace function public.negocio_staff_publico(p_negocio_id uuid)
returns table (
  staff_id uuid,
  nombre text,
  foto_url text,
  especialidad text,
  nivel nivel_staff,
  servicio_ids uuid[]
)
language sql stable security definer set search_path = public as $fn$
  select
    s.usuario_id,
    s.nombre,
    s.foto_url,
    s.especialidad,
    (
      select nc.nivel from public.nivel_staff_consolidado nc
      join public.temporada t on t.id = nc.temporada_id
      where nc.vinculo_id = v.id
      order by t.fecha_fin desc
      limit 1
    ),
    coalesce(
      (select array_agg(ss.servicio_id) from public.staff_servicio ss where ss.staff_id = s.usuario_id),
      '{}'::uuid[]
    )
  from public.vinculo_staff_negocio v
  join public.staff s on s.usuario_id = v.staff_id
  join public.negocio n on n.id = v.negocio_id
  where v.negocio_id = p_negocio_id
    and v.estado = 'ACTIVO'
    and n.estado = 'ACTIVO'
  order by s.nombre;
$fn$;

create or replace function public.negocio_resenas_publicas(
  p_negocio_id uuid,
  p_limite int default 10
)
returns table (
  id uuid,
  calificacion int,
  comentario text,
  respuesta_negocio text,
  created_at timestamptz,
  cliente_nombre text,
  staff_nombre text
)
language sql stable security definer set search_path = public as $fn$
  select
    r.id,
    r.calificacion,
    r.comentario,
    r.respuesta_negocio,
    r.created_at,
    -- Solo el primer nombre: la reseña es pública, la identidad del Cliente no.
    split_part(coalesce(p.nombre, 'Cliente'), ' ', 1),
    st.nombre
  from public.resena r
  join public.negocio n on n.id = r.negocio_id
  left join public.perfil p on p.id = r.cliente_id
  left join public.staff st on st.usuario_id = r.staff_id
  where r.negocio_id = p_negocio_id
    and r.estado = 'VISIBLE'
    and n.estado = 'ACTIVO'
  order by r.created_at desc
  limit greatest(coalesce(p_limite, 10), 1);
$fn$;

grant execute on function public.marketplace_buscar(text, text, text, text, int, int) to anon, authenticated;
grant execute on function public.negocio_staff_publico(uuid) to anon, authenticated;
grant execute on function public.negocio_resenas_publicas(uuid, int) to anon, authenticated;
