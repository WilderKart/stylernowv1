-- StylerNow — Migración 011: soporte para el wizard de registro de Negocio
-- Fuente: 02-UX/02_Onboarding.md (wizard de 4 pasos), 01-PRD/03_Monetization.md
-- (todo Negocio tiene un Plan desde su creación)

-- ── Columnas que faltaban para el wizard ───────────────────────────────────
alter table public.negocio
  add column if not exists telefono_contacto text,
  add column if not exists email_contacto text,
  -- Distingue "todavía llenando el wizard" de "genuinamente enviado a SuperSU".
  -- negocio.estado ya nace en PENDIENTE_APROBACION al crear la fila (paso 1),
  -- pero eso no basta para que la cola de aprobación de SuperSU (Fase 3) no
  -- se llene de borradores a medio completar.
  add column if not exists onboarding_completo boolean not null default false;

create index if not exists negocio_onboarding_pendiente_idx
  on public.negocio(created_at) where onboarding_completo = false;

-- ── Suscripción inicial ─────────────────────────────────────────────────────
-- `suscripcion` solo admite escritura de SuperSU (migración 006): una Barbería
-- no puede insertar su propia fila directo. Este RPC es el único puente,
-- validando que quien lo llama sea efectivamente el dueño del Negocio y que
-- el Plan elegido sea de autoservicio (Allfather se cotiza aparte, sin
-- flujo de autoservicio — 01-PRD/03_Monetization.md).
create or replace function public.crear_suscripcion_inicial(
  p_negocio_id uuid,
  p_plan_codigo plan_codigo
)
returns public.suscripcion
language plpgsql security definer set search_path = public as $fn$
declare
  v_suscripcion public.suscripcion;
begin
  if p_plan_codigo = 'ALLFATHER' then
    raise exception 'ALLFATHER_REQUIERE_COTIZACION';
  end if;

  if not exists (
    select 1 from public.negocio where id = p_negocio_id and owner_user_id = auth.uid()
  ) then
    raise exception 'NO_AUTORIZADO';
  end if;

  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro)
  values (p_negocio_id, p_plan_codigo, 'ACTIVA', now() + interval '30 days')
  on conflict (negocio_id) do update
    set plan_codigo = excluded.plan_codigo
  returning * into v_suscripcion;

  update public.negocio set plan_codigo = p_plan_codigo where id = p_negocio_id;

  return v_suscripcion;
end;
$fn$;

-- ── Envío a aprobación ──────────────────────────────────────────────────────
-- 02-UX/02_Onboarding.md: "al completar el paso 3 como mínimo, el Negocio
-- puede enviarse a aprobación" — exige al menos 1 Sede y 1 Servicio, server-side,
-- no solo deshabilitando el botón en la UI.
create or replace function public.enviar_negocio_a_aprobacion(p_negocio_id uuid)
returns public.negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
begin
  if not exists (
    select 1 from public.negocio where id = p_negocio_id and owner_user_id = auth.uid()
  ) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if not exists (
    select 1 from public.sede
    where negocio_id = p_negocio_id and not cerrada_permanente
  ) then
    raise exception 'FALTA_SEDE';
  end if;

  if not exists (
    select 1 from public.servicio where negocio_id = p_negocio_id and estado = 'ACTIVO'
  ) then
    raise exception 'FALTA_SERVICIO';
  end if;

  if not exists (select 1 from public.suscripcion where negocio_id = p_negocio_id) then
    raise exception 'FALTA_PLAN';
  end if;

  update public.negocio
  set onboarding_completo = true
  where id = p_negocio_id
  returning * into v_negocio;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('negocio', p_negocio_id, 'ENVIADO_A_APROBACION', 'BARBERIA', auth.uid(), p_negocio_id);

  return v_negocio;
end;
$fn$;

grant execute on function public.crear_suscripcion_inicial(uuid, plan_codigo) to authenticated;
grant execute on function public.enviar_negocio_a_aprobacion(uuid) to authenticated;

-- ── Invitación de Staff (paso 4, opcional, del wizard) ─────────────────────
-- 02-UX/02_Onboarding.md: onboarding de Staff es un flujo separado del de
-- Negocio. Esta tabla registra la INTENCIÓN de invitar; la aceptación
-- (crear el vinculo_staff_negocio real cuando la persona invitada inicia
-- sesión) se construye en el Módulo 2.4 — Gestión de Staff, sin romper esto.
create type invitacion_staff_estado as enum ('PENDIENTE', 'ACEPTADA', 'EXPIRADA', 'CANCELADA');

create table public.invitacion_staff (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  email text not null,
  estado invitacion_staff_estado not null default 'PENDIENTE',
  invitado_por uuid not null references auth.users(id),
  expira_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (negocio_id, email)
);
create index invitacion_staff_negocio_idx on public.invitacion_staff(negocio_id);
create index invitacion_staff_email_idx on public.invitacion_staff(email) where estado = 'PENDIENTE';

alter table public.invitacion_staff enable row level security;

create policy invitacion_staff_select_negocio on public.invitacion_staff for select
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
create policy invitacion_staff_insert_negocio on public.invitacion_staff for insert
  with check (public.is_barberia_de(negocio_id) and invitado_por = auth.uid());
create policy invitacion_staff_delete_negocio on public.invitacion_staff for delete
  using (public.is_barberia_de(negocio_id));
-- Quien recibió la invitación puede verla por su propio email para poder
-- aceptarla (Módulo 2.4) sin que eso abra lectura de invitaciones ajenas.
create policy invitacion_staff_select_propia on public.invitacion_staff for select
  using (email = (select email from public.perfil where id = auth.uid()));
