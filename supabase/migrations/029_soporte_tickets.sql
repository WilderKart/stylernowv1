-- StylerNow — Migración 029: Fase 3.3 — Soporte (tickets)
-- Fuente: 02-UX/10_Super_Admin.md ("Soporte y Moderación"),
-- 03-Business-Rules/01_Roles.md (matriz "Soporte": crear/ver/responder
-- ticket propio es 🔒 para Cliente/Staff/Guardian/Barbería; "gestionar
-- todos los tickets" es exclusivo 👑 SuperSU).
--
-- Todo write pasa por una RPC SECURITY DEFINER (mismo patrón que el resto
-- del proyecto) — no hay política de INSERT/UPDATE directa, solo SELECT,
-- así el `actor_tipo` y la transición de estado siempre quedan correctos
-- sin depender de que el cliente los mande bien.

create type public.ticket_soporte_estado as enum ('ABIERTO', 'EN_PROCESO', 'RESUELTO');

create table public.ticket_soporte (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid not null references auth.users(id),
  negocio_id uuid references public.negocio(id), -- contexto opcional para que SuperSU triage más rápido
  asunto text not null,
  estado public.ticket_soporte_estado not null default 'ABIERTO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ticket_soporte_creado_por_idx on public.ticket_soporte(creado_por);
create index ticket_soporte_estado_idx on public.ticket_soporte(estado);
create trigger trg_updated_at before update on public.ticket_soporte for each row execute function public.set_updated_at();

create table public.ticket_mensaje (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.ticket_soporte(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  actor_tipo text not null check (actor_tipo in ('CLIENTE', 'STAFF', 'GUARDIAN', 'BARBERIA', 'SUPERSU')),
  mensaje text not null,
  created_at timestamptz not null default now()
);
create index ticket_mensaje_ticket_idx on public.ticket_mensaje(ticket_id, created_at);

alter table public.ticket_soporte enable row level security;
alter table public.ticket_mensaje enable row level security;

create policy ticket_soporte_select_propio on public.ticket_soporte
  for select using (creado_por = auth.uid() or public.is_supersu());
create policy ticket_mensaje_select_propio on public.ticket_mensaje
  for select using (
    public.is_supersu()
    or exists (select 1 from public.ticket_soporte t where t.id = ticket_id and t.creado_por = auth.uid())
  );

-- Determina el actor_tipo de auth.uid() en el contexto de un Negocio dado
-- (o sin contexto, para un futuro caso de Cliente sin Negocio asociado).
create or replace function public.actor_tipo_soporte(p_negocio_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $fn$
begin
  if public.is_supersu() then return 'SUPERSU'; end if;
  if p_negocio_id is not null then
    if public.is_barberia_de(p_negocio_id) then return 'BARBERIA'; end if;
    if exists (
      select 1 from public.vinculo_staff_negocio v
      where v.staff_id = auth.uid() and v.negocio_id = p_negocio_id and v.es_guardian and v.estado = 'ACTIVO'
    ) then return 'GUARDIAN'; end if;
    if public.is_staff_de(p_negocio_id) then return 'STAFF'; end if;
  end if;
  return 'CLIENTE';
end;
$fn$;

create or replace function public.crear_ticket_soporte(p_asunto text, p_mensaje text, p_negocio_id uuid default null)
returns public.ticket_soporte
language plpgsql security definer set search_path = public as $fn$
declare
  v_ticket public.ticket_soporte;
  v_actor_tipo text;
begin
  if p_asunto is null or length(trim(p_asunto)) = 0 then raise exception 'ASUNTO_REQUERIDO'; end if;
  if p_mensaje is null or length(trim(p_mensaje)) = 0 then raise exception 'MENSAJE_REQUERIDO'; end if;

  insert into public.ticket_soporte (creado_por, negocio_id, asunto)
  values (auth.uid(), p_negocio_id, p_asunto)
  returning * into v_ticket;

  v_actor_tipo := public.actor_tipo_soporte(p_negocio_id);
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje)
  values (v_ticket.id, auth.uid(), v_actor_tipo, p_mensaje);

  return v_ticket;
end;
$fn$;
grant execute on function public.crear_ticket_soporte(text, text, uuid) to authenticated;

create or replace function public.responder_ticket_soporte(p_ticket_id uuid, p_mensaje text)
returns public.ticket_mensaje
language plpgsql security definer set search_path = public as $fn$
declare
  v_ticket public.ticket_soporte;
  v_mensaje public.ticket_mensaje;
  v_actor_tipo text;
begin
  select * into v_ticket from public.ticket_soporte where id = p_ticket_id;
  if not found then raise exception 'TICKET_NO_ENCONTRADO'; end if;
  if v_ticket.creado_por <> auth.uid() and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_mensaje is null or length(trim(p_mensaje)) = 0 then raise exception 'MENSAJE_REQUERIDO'; end if;

  v_actor_tipo := public.actor_tipo_soporte(v_ticket.negocio_id);

  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje)
  values (p_ticket_id, auth.uid(), v_actor_tipo, p_mensaje)
  returning * into v_mensaje;

  -- Responder reabre un ticket ya resuelto — evita que una novedad real del
  -- Negocio quede archivada silenciosamente en un ticket "cerrado".
  update public.ticket_soporte
  set estado = case when estado = 'RESUELTO' then 'ABIERTO' else estado end, updated_at = now()
  where id = p_ticket_id;

  return v_mensaje;
end;
$fn$;
grant execute on function public.responder_ticket_soporte(uuid, text) to authenticated;

create or replace function public.actualizar_estado_ticket(p_ticket_id uuid, p_estado public.ticket_soporte_estado)
returns public.ticket_soporte
language plpgsql security definer set search_path = public as $fn$
declare
  v_anterior public.ticket_soporte_estado;
  v_ticket public.ticket_soporte;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  select estado into v_anterior from public.ticket_soporte where id = p_ticket_id;
  if not found then raise exception 'TICKET_NO_ENCONTRADO'; end if;

  update public.ticket_soporte set estado = p_estado, updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('ticket_soporte', p_ticket_id, 'TICKET_ESTADO_CAMBIADO', 'SUPERSU', auth.uid(), v_ticket.negocio_id,
    jsonb_build_object('estado', v_anterior), jsonb_build_object('estado', p_estado));

  return v_ticket;
end;
$fn$;
grant execute on function public.actualizar_estado_ticket(uuid, public.ticket_soporte_estado) to authenticated;
