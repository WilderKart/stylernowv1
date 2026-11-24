-- 187 · Ausencias y horarios del barbero con aprobación de la barbería (planes STUDIO, PRESTIGE y SIGNATURE).
--
-- Regla de negocio:
--   · ESSENTIAL (y el propio propietario en cualquier plan): sin cambios, el barbero edita directo.
--   · Resto de planes: el barbero SOLICITA; la barbería (propietario, o Guardian de su sede) aprueba o rechaza.
--     - Ausencia aprobada  -> se crea el bloqueo en bloqueo_ausencia (el motor de agenda ya lo respeta).
--     - Horario aprobado   -> reemplaza la disponibilidad semanal del barbero en esa sede.
--   · Toda solicitud avisa a la barbería (notificación) y toda decisión avisa al barbero.
-- Cero confianza: el barbero ya no escribe directo en bloqueo_ausencia ni disponibilidad cuando exige aprobación (RLS).

create or replace function public._vinculo_exige_aprobacion(p_vinculo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(n.plan_codigo::text <> 'ESSENTIAL' and v.staff_id <> n.owner_user_id, false)
  from public.vinculo_staff_negocio v join public.negocio n on n.id = v.negocio_id
  where v.id = p_vinculo;
$$;
revoke all on function public._vinculo_exige_aprobacion(uuid) from public, anon, authenticated;
grant execute on function public._vinculo_exige_aprobacion(uuid) to authenticated;  -- las políticas RLS la evalúan como el usuario

create or replace function public._puede_decidir_vinculo(p_vinculo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_barberia_de(v.negocio_id) or public.is_guardian_de_sede(v.sede_activa_id), false)
  from public.vinculo_staff_negocio v where v.id = p_vinculo;
$$;
revoke all on function public._puede_decidir_vinculo(uuid) from public, anon, authenticated;
grant execute on function public._puede_decidir_vinculo(uuid) to authenticated;  -- la evalúan las políticas RLS de las solicitudes

-- El barbero ya no escribe directo cuando el plan exige aprobación (el propietario y ESSENTIAL no cambian).
drop policy if exists bloqueo_ausencia_write_propio on public.bloqueo_ausencia;
create policy bloqueo_ausencia_write_propio on public.bloqueo_ausencia for all to authenticated
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = bloqueo_ausencia.vinculo_id and v.staff_id = (select auth.uid()))
         and not public._vinculo_exige_aprobacion(vinculo_id))
  with check (exists (select 1 from public.vinculo_staff_negocio v where v.id = bloqueo_ausencia.vinculo_id and v.staff_id = (select auth.uid()))
         and not public._vinculo_exige_aprobacion(vinculo_id));

drop policy if exists disponibilidad_write_propio on public.disponibilidad;
create policy disponibilidad_write_propio on public.disponibilidad for all to authenticated
  using (exists (select 1 from public.vinculo_staff_negocio v where v.id = disponibilidad.vinculo_id and v.staff_id = (select auth.uid()))
         and not public._vinculo_exige_aprobacion(vinculo_id))
  with check (exists (select 1 from public.vinculo_staff_negocio v where v.id = disponibilidad.vinculo_id and v.staff_id = (select auth.uid()))
         and not public._vinculo_exige_aprobacion(vinculo_id));

-- ── Solicitudes de ausencia ───────────────────────────────────────────────────────────────
create table if not exists public.solicitud_ausencia (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculo_staff_negocio(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  tipo text not null default 'PERMISO' check (tipo in ('PERMISO', 'VACACIONES', 'INCAPACIDAD', 'OTRO')),
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  motivo text check (motivo is null or length(motivo) <= 500),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
  decidido_por uuid references auth.users(id),
  decidido_at timestamptz,
  motivo_decision text check (motivo_decision is null or length(motivo_decision) <= 500),
  bloqueo_id uuid references public.bloqueo_ausencia(id) on delete set null,
  created_at timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);
create index if not exists solicitud_ausencia_negocio_idx on public.solicitud_ausencia (negocio_id, estado, created_at desc);
create index if not exists solicitud_ausencia_vinculo_idx on public.solicitud_ausencia (vinculo_id, created_at desc);

-- ── Solicitudes de horario ────────────────────────────────────────────────────────────────
create table if not exists public.solicitud_horario (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculo_staff_negocio(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  propuesta jsonb not null,           -- [{ "dia_semana": 1, "hora_inicio": "09:00", "hora_fin": "18:00" }, ...] semana completa
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
  decidido_por uuid references auth.users(id),
  decidido_at timestamptz,
  motivo_decision text check (motivo_decision is null or length(motivo_decision) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists solicitud_horario_negocio_idx on public.solicitud_horario (negocio_id, estado, created_at desc);
create index if not exists solicitud_horario_vinculo_idx on public.solicitud_horario (vinculo_id, created_at desc);

alter table public.solicitud_ausencia enable row level security;
alter table public.solicitud_horario enable row level security;
revoke all on public.solicitud_ausencia, public.solicitud_horario from public, anon, authenticated;
grant select on public.solicitud_ausencia, public.solicitud_horario to authenticated;

drop policy if exists solicitud_ausencia_select on public.solicitud_ausencia;
create policy solicitud_ausencia_select on public.solicitud_ausencia for select to authenticated using (
  exists (select 1 from public.vinculo_staff_negocio v where v.id = vinculo_id and v.staff_id = (select auth.uid()))
  or public._puede_decidir_vinculo(vinculo_id));
drop policy if exists solicitud_horario_select on public.solicitud_horario;
create policy solicitud_horario_select on public.solicitud_horario for select to authenticated using (
  exists (select 1 from public.vinculo_staff_negocio v where v.id = vinculo_id and v.staff_id = (select auth.uid()))
  or public._puede_decidir_vinculo(vinculo_id));

-- Aviso a quien decide (propietario y Guardian de la sede del barbero).
create or replace function public._avisar_decisores(p_vinculo uuid, p_tipo text, p_titulo text, p_cuerpo text, p_dedupe text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vinculo_staff_negocio; r record;
begin
  select * into v from public.vinculo_staff_negocio where id = p_vinculo;
  if not found then return; end if;
  for r in
    select distinct u from (
      select n.owner_user_id as u from public.negocio n where n.id = v.negocio_id
      union
      select g.staff_id from public.vinculo_staff_negocio g
       where g.negocio_id = v.negocio_id and g.es_guardian and g.estado = 'ACTIVO' and g.sede_activa_id = v.sede_activa_id
    ) t where u is not null and u <> v.staff_id
  loop
    perform public._notificar(r.u, p_tipo, p_titulo, p_cuerpo, p_titulo, p_cuerpo, null, v.negocio_id, p_dedupe || ':' || r.u::text);
  end loop;
end $$;
revoke all on function public._avisar_decisores(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public._nombre_vinculo(p_vinculo uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(s.nombre, 'Un barbero') from public.vinculo_staff_negocio v left join public.staff s on s.usuario_id = v.staff_id where v.id = p_vinculo;
$$;
revoke all on function public._nombre_vinculo(uuid) from public, anon, authenticated;

-- ── RPC: ausencias ────────────────────────────────────────────────────────────────────────
-- Devuelve 'APROBADA' (ESSENTIAL / propietario: queda registrada de una) o 'PENDIENTE' (espera a la barbería).
create or replace function public.solicitar_ausencia(
  p_vinculo_id uuid, p_inicio timestamptz, p_fin timestamptz, p_tipo text, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare v public.vinculo_staff_negocio; v_sol uuid; v_bloq uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.vinculo_staff_negocio where id = p_vinculo_id and estado = 'ACTIVO';
  if not found or v.staff_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if p_fin <= p_inicio then raise exception 'RANGO_INVALIDO'; end if;
  if p_fin <= now() then raise exception 'RANGO_EN_EL_PASADO'; end if;
  if coalesce(p_tipo, 'PERMISO') not in ('PERMISO', 'VACACIONES', 'INCAPACIDAD', 'OTRO') then raise exception 'TIPO_INVALIDO'; end if;
  perform public._exigir_operativo(v.negocio_id);

  if not public._vinculo_exige_aprobacion(p_vinculo_id) then
    insert into public.bloqueo_ausencia (vinculo_id, fecha_inicio, fecha_fin, motivo)
    values (p_vinculo_id, p_inicio, p_fin, nullif(btrim(p_motivo), '')) returning id into v_bloq;
    insert into public.solicitud_ausencia (vinculo_id, negocio_id, tipo, fecha_inicio, fecha_fin, motivo, estado, decidido_por, decidido_at, bloqueo_id)
    values (p_vinculo_id, v.negocio_id, coalesce(p_tipo, 'PERMISO'), p_inicio, p_fin, nullif(btrim(p_motivo), ''), 'APROBADA', auth.uid(), now(), v_bloq);
    return 'APROBADA';
  end if;

  if (select count(*) from public.solicitud_ausencia where vinculo_id = p_vinculo_id and estado = 'PENDIENTE') >= 5 then
    raise exception 'DEMASIADAS_SOLICITUDES_PENDIENTES';
  end if;
  insert into public.solicitud_ausencia (vinculo_id, negocio_id, tipo, fecha_inicio, fecha_fin, motivo)
  values (p_vinculo_id, v.negocio_id, coalesce(p_tipo, 'PERMISO'), p_inicio, p_fin, nullif(btrim(p_motivo), '')) returning id into v_sol;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('solicitud_ausencia', v_sol, 'AUSENCIA_SOLICITADA', 'STAFF', auth.uid(), v.negocio_id);
  perform public._avisar_decisores(p_vinculo_id, 'SISTEMA', 'Nueva solicitud de ausencia',
    public._nombre_vinculo(p_vinculo_id) || ' solicitó una ausencia (' || coalesce(p_tipo, 'PERMISO') || '). Revísala en Staff.', 'aus-sol:' || v_sol::text);
  return 'PENDIENTE';
end $$;

-- Aprueba o rechaza. Al aprobar se crea el bloqueo. Si ya hay citas en ese rango se exige confirmar (las citas NO se cancelan solas).
create or replace function public.decidir_solicitud_ausencia(p_solicitud_id uuid, p_aprobar boolean, p_motivo text default null, p_confirmar_con_citas boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.solicitud_ausencia; v public.vinculo_staff_negocio; v_citas int := 0; v_bloq uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into s from public.solicitud_ausencia where id = p_solicitud_id for update;
  if not found then raise exception 'SOLICITUD_NO_ENCONTRADA'; end if;
  if not public._puede_decidir_vinculo(s.vinculo_id) then raise exception 'NO_AUTORIZADO'; end if;
  if s.estado <> 'PENDIENTE' then raise exception 'SOLICITUD_YA_DECIDIDA'; end if;
  select * into v from public.vinculo_staff_negocio where id = s.vinculo_id;
  if not p_aprobar and length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;

  if p_aprobar then
    select count(*) into v_citas from public.reserva r
     where r.staff_id = v.staff_id and r.negocio_id = s.negocio_id
       and r.estado in ('PENDIENTE_PAGO', 'CONFIRMADA') and r.hora_inicio < s.fecha_fin and r.hora_fin > s.fecha_inicio;
    if v_citas > 0 and not p_confirmar_con_citas then
      return jsonb_build_object('estado', 'REQUIERE_CONFIRMACION', 'citas_en_rango', v_citas);
    end if;
    insert into public.bloqueo_ausencia (vinculo_id, fecha_inicio, fecha_fin, motivo)
    values (s.vinculo_id, s.fecha_inicio, s.fecha_fin, coalesce(s.motivo, s.tipo)) returning id into v_bloq;
  end if;

  update public.solicitud_ausencia
     set estado = case when p_aprobar then 'APROBADA' else 'RECHAZADA' end, decidido_por = auth.uid(), decidido_at = now(),
         motivo_decision = nullif(btrim(p_motivo), ''), bloqueo_id = v_bloq
   where id = s.id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('solicitud_ausencia', s.id, case when p_aprobar then 'AUSENCIA_APROBADA' else 'AUSENCIA_RECHAZADA' end, 'BARBERIA', auth.uid(), s.negocio_id, nullif(btrim(p_motivo), ''));
  perform public._notificar(v.staff_id, 'SISTEMA',
    case when p_aprobar then 'Ausencia aprobada' else 'Ausencia rechazada' end,
    case when p_aprobar then 'Tu ausencia quedó registrada y tu agenda está bloqueada en esas fechas.'
         else 'Tu solicitud de ausencia no fue aprobada.' || coalesce(' Motivo: ' || nullif(btrim(p_motivo), ''), '') end,
    case when p_aprobar then 'Absence approved' else 'Absence rejected' end,
    case when p_aprobar then 'Your absence was approved and your schedule is blocked for those dates.' else 'Your absence request was not approved.' end,
    null, s.negocio_id, 'aus-dec:' || s.id::text);
  return jsonb_build_object('estado', case when p_aprobar then 'APROBADA' else 'RECHAZADA' end, 'citas_en_rango', v_citas);
end $$;

create or replace function public.cancelar_solicitud_ausencia(p_solicitud_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.solicitud_ausencia s set estado = 'CANCELADA', decidido_at = now()
   where s.id = p_solicitud_id and s.estado = 'PENDIENTE'
     and exists (select 1 from public.vinculo_staff_negocio v where v.id = s.vinculo_id and v.staff_id = auth.uid());
  if not found then raise exception 'SOLICITUD_NO_CANCELABLE'; end if;
end $$;

-- ── RPC: horario semanal ──────────────────────────────────────────────────────────────────
create or replace function public._validar_semana(p_dias jsonb)
returns void language plpgsql immutable as $$
declare d jsonb;
begin
  if jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) > 28 then raise exception 'HORARIO_INVALIDO'; end if;
  for d in select * from jsonb_array_elements(p_dias) loop
    if (d ->> 'dia_semana')::int not between 0 and 6 or (d ->> 'hora_fin')::time <= (d ->> 'hora_inicio')::time then
      raise exception 'HORARIO_INVALIDO';
    end if;
  end loop;
end $$;

create or replace function public._aplicar_semana(p_vinculo uuid, p_sede uuid, p_dias jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.disponibilidad where vinculo_id = p_vinculo and sede_id = p_sede;
  insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
  select p_vinculo, p_sede, (d ->> 'dia_semana')::int, (d ->> 'hora_inicio')::time, (d ->> 'hora_fin')::time
  from jsonb_array_elements(p_dias) d;
end $$;
revoke all on function public._aplicar_semana(uuid, uuid, jsonb) from public, anon, authenticated;

-- Devuelve 'APROBADA' (ESSENTIAL / propietario: se aplica de una) o 'PENDIENTE' (espera a la barbería).
create or replace function public.solicitar_cambio_horario(p_vinculo_id uuid, p_sede_id uuid, p_dias jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v public.vinculo_staff_negocio; v_sol uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.vinculo_staff_negocio where id = p_vinculo_id and estado = 'ACTIVO';
  if not found or v.staff_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.sede where id = p_sede_id and negocio_id = v.negocio_id) then raise exception 'SEDE_INVALIDA'; end if;
  perform public._validar_semana(p_dias);
  perform public._exigir_operativo(v.negocio_id);

  if not public._vinculo_exige_aprobacion(p_vinculo_id) then
    perform public._aplicar_semana(p_vinculo_id, p_sede_id, p_dias);
    return 'APROBADA';
  end if;

  update public.solicitud_horario set estado = 'CANCELADA', decidido_at = now()
   where vinculo_id = p_vinculo_id and sede_id = p_sede_id and estado = 'PENDIENTE';  -- una sola propuesta vigente
  insert into public.solicitud_horario (vinculo_id, negocio_id, sede_id, propuesta)
  values (p_vinculo_id, v.negocio_id, p_sede_id, p_dias) returning id into v_sol;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('solicitud_horario', v_sol, 'HORARIO_SOLICITADO', 'STAFF', auth.uid(), v.negocio_id);
  perform public._avisar_decisores(p_vinculo_id, 'SISTEMA', 'Cambio de horario por aprobar',
    public._nombre_vinculo(p_vinculo_id) || ' propuso un cambio en su horario. Revísalo en Staff.', 'hor-sol:' || v_sol::text);
  return 'PENDIENTE';
end $$;

create or replace function public.decidir_solicitud_horario(p_solicitud_id uuid, p_aprobar boolean, p_motivo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare s public.solicitud_horario; v public.vinculo_staff_negocio;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into s from public.solicitud_horario where id = p_solicitud_id for update;
  if not found then raise exception 'SOLICITUD_NO_ENCONTRADA'; end if;
  if not public._puede_decidir_vinculo(s.vinculo_id) then raise exception 'NO_AUTORIZADO'; end if;
  if s.estado <> 'PENDIENTE' then raise exception 'SOLICITUD_YA_DECIDIDA'; end if;
  if not p_aprobar and length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into v from public.vinculo_staff_negocio where id = s.vinculo_id;
  if p_aprobar then perform public._aplicar_semana(s.vinculo_id, s.sede_id, s.propuesta); end if;
  update public.solicitud_horario set estado = case when p_aprobar then 'APROBADA' else 'RECHAZADA' end,
         decidido_por = auth.uid(), decidido_at = now(), motivo_decision = nullif(btrim(p_motivo), '') where id = s.id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('solicitud_horario', s.id, case when p_aprobar then 'HORARIO_APROBADO' else 'HORARIO_RECHAZADO' end, 'BARBERIA', auth.uid(), s.negocio_id, nullif(btrim(p_motivo), ''));
  perform public._notificar(v.staff_id, 'SISTEMA',
    case when p_aprobar then 'Horario aprobado' else 'Horario rechazado' end,
    case when p_aprobar then 'Tu nuevo horario ya está activo.' else 'Tu propuesta de horario no fue aprobada.' || coalesce(' Motivo: ' || nullif(btrim(p_motivo), ''), '') end,
    case when p_aprobar then 'Schedule approved' else 'Schedule rejected' end,
    case when p_aprobar then 'Your new schedule is active.' else 'Your schedule proposal was not approved.' end,
    null, s.negocio_id, 'hor-dec:' || s.id::text);
  return case when p_aprobar then 'APROBADA' else 'RECHAZADA' end;
end $$;

create or replace function public.cancelar_solicitud_horario(p_solicitud_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.solicitud_horario s set estado = 'CANCELADA', decidido_at = now()
   where s.id = p_solicitud_id and s.estado = 'PENDIENTE'
     and exists (select 1 from public.vinculo_staff_negocio v where v.id = s.vinculo_id and v.staff_id = auth.uid());
  if not found then raise exception 'SOLICITUD_NO_CANCELABLE'; end if;
end $$;

-- Permisos: solo usuarios con sesión; cada función revalida quién es el actor.
revoke all on function public.solicitar_ausencia(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.decidir_solicitud_ausencia(uuid, boolean, text, boolean) from public, anon, authenticated;
revoke all on function public.cancelar_solicitud_ausencia(uuid) from public, anon, authenticated;
revoke all on function public.solicitar_cambio_horario(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.decidir_solicitud_horario(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.cancelar_solicitud_horario(uuid) from public, anon, authenticated;
revoke all on function public._validar_semana(jsonb) from public, anon, authenticated;
grant execute on function public.solicitar_ausencia(uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.decidir_solicitud_ausencia(uuid, boolean, text, boolean) to authenticated;
grant execute on function public.cancelar_solicitud_ausencia(uuid) to authenticated;
grant execute on function public.solicitar_cambio_horario(uuid, uuid, jsonb) to authenticated;
grant execute on function public.decidir_solicitud_horario(uuid, boolean, text) to authenticated;
grant execute on function public.cancelar_solicitud_horario(uuid) to authenticated;
