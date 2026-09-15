-- StylerNow — Migración 017: Módulo 2.5 — Servicios (dominio completo)
-- Fuente: 02-UX/09_Business_Panel.md ("Servicios y Staff"), 03-Business-
-- Rules/01_Roles.md (matriz "Servicios" — Crear/Cambiar precio exclusivo
-- Barbería, Editar duración/Activar-Desactivar 🏢 Guardian), 03-Business-
-- Rules/02_Booking_Rules.md ("Combos de Servicios").
--
-- CRUD base de `servicio` (RLS + trigger de protección de precio) YA
-- existía desde la migración 006, construido junto al motor de reservas.
-- Esta migración agrega lo que faltaba: cota superior de duración, y
-- Combos como catálogo real (nunca se había construido, aunque el motor
-- de reservas ya soporta reservar varios Servicios juntos sumando sus
-- duraciones — eso no cambia acá).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Duración: cota superior explícita (spec 2.5 pide "mínima y máxima").
--    El mínimo (>0) ya existía desde 002; acá se fija el rango completo.
-- ════════════════════════════════════════════════════════════════════════

alter table public.servicio
  add constraint servicio_duracion_rango check (duracion_minutos between 5 and 480);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Combos de Servicios — catálogo real, no solo un concepto de la Biblia.
--    Un combo es un atajo de selección (ej. "Corte + Barba") que agrupa
--    Servicios existentes. `precio_total_override`/`duracion_minutos_
--    override` permiten la "eficiencia de tiempo real" que menciona
--    02_Booking_Rules.md — quedan documentados como no conectados todavía
--    al motor de disponibilidad (`slots_disponibles` sigue sumando
--    duraciones individuales, ya verificado en producción); conectarlos
--    requeriría tocar ese RPC crítico y se deja registrado en
--    docs/TECH_DEBT_REGISTER.md en vez de arriesgar ese código ya probado.
-- ════════════════════════════════════════════════════════════════════════

create table public.servicio_combo (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio_total_override numeric(12,2) check (precio_total_override is null or precio_total_override >= 0),
  duracion_minutos_override int check (duracion_minutos_override is null or duracion_minutos_override between 5 and 480),
  estado servicio_estado not null default 'ACTIVO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index servicio_combo_negocio_idx on public.servicio_combo(negocio_id);
create trigger trg_updated_at_servicio_combo before update on public.servicio_combo
  for each row execute function public.set_updated_at();

create table public.servicio_combo_item (
  combo_id uuid not null references public.servicio_combo(id) on delete cascade,
  servicio_id uuid not null references public.servicio(id) on delete cascade,
  primary key (combo_id, servicio_id)
);

alter table public.servicio_combo enable row level security;
alter table public.servicio_combo_item enable row level security;

create policy servicio_combo_select_publico on public.servicio_combo for select
  using (estado = 'ACTIVO' and exists (select 1 from public.negocio n where n.id = servicio_combo.negocio_id and n.estado = 'ACTIVO'));
create policy servicio_combo_select_interno on public.servicio_combo for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
-- A diferencia de `servicio` (donde Guardian puede editar duración/activar),
-- un Combo es una decisión de precio/empaquetado — se trata como "Cambiar
-- precio" de la matriz de Roles: exclusivo de Barbería.
create policy servicio_combo_write_barberia on public.servicio_combo for all
  using (public.is_barberia_de(negocio_id)) with check (public.is_barberia_de(negocio_id));

create policy servicio_combo_item_select on public.servicio_combo_item for select
  using (exists (
    select 1 from public.servicio_combo c where c.id = servicio_combo_item.combo_id
      and (c.estado = 'ACTIVO' or public.tiene_acceso_interno(c.negocio_id) or public.is_supersu())
  ));
create policy servicio_combo_item_write_barberia on public.servicio_combo_item for all
  using (exists (select 1 from public.servicio_combo c where c.id = servicio_combo_item.combo_id and public.is_barberia_de(c.negocio_id)))
  with check (exists (select 1 from public.servicio_combo c where c.id = servicio_combo_item.combo_id and public.is_barberia_de(c.negocio_id)));
