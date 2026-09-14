-- StylerNow — Migración 002: identidad y entidades núcleo
-- Fuente: StylerNow_Project_Bible_V3/04-Data-Model/01_Entities.md, 02_Relationships.md
--
-- Nota de mapeo: el `perfil` de esta migración es la tabla de identidad base 1:1 con
-- auth.users. Cubre lo que la Biblia describe como entidad `cliente` (Glossary.md: todo
-- usuario autenticado puede actuar como Cliente) más el flag `es_supersu`. Se documenta
-- aquí porque la Biblia describe la entidad de datos, no el nombre exacto de la tabla física.

-- ── Identidad base (1:1 con auth.users) ──────────────────────────────────────
create table public.perfil (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  avatar_url text,
  fecha_nacimiento date,
  es_supersu boolean not null default false, -- provisionado solo manualmente (06-Security)
  consentimiento_datos_at timestamptz,
  consentimiento_marketing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.perfil is 'Identidad base de cualquier usuario autenticado. Sirve como la entidad "Cliente" del Glossary.';

-- ── Negocio (Barbería) ────────────────────────────────────────────────────
create table public.negocio (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id), -- la cuenta "Barbería"
  nombre text not null,
  slug text not null unique,
  categoria text[] not null default '{}', -- multi-vertical: ['barberia','spa',...], nunca un tipo de dato distinto
  descripcion text,
  logo_url text,
  identificacion_fiscal text, -- genérico (ADL-008), no asume solo NIT/Cédula
  ciudad text not null,
  estado negocio_estado not null default 'PENDIENTE_APROBACION',
  plan_codigo plan_codigo not null default 'RAVEN',
  comision_plataforma_pct numeric(5,2) not null default 8.00 check (comision_plataforma_pct between 3 and 15),
  elegibilidad_marketplace boolean not null default true, -- 06-Security/03_Fraud.md, sanción de plataforma
  pago_completo_en_app boolean not null default false, -- 03-Business-Rules/03_Payment_Rules.md
  sena_pct numeric(5,2) default 20.00,
  sena_monto_fijo numeric(12,2),
  sena_minimo numeric(12,2) not null default 10000,
  sena_maximo numeric(12,2) not null default 50000,
  ventana_reembolso_total_horas int not null default 24,
  ventana_reembolso_parcial_horas int not null default 2 check (ventana_reembolso_parcial_horas >= 0),
  reembolso_parcial_pct numeric(5,2) not null default 50.00,
  min_anticipacion_minutos int not null default 0,
  max_anticipacion_dias int not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ventana_reembolso_total_minima check (ventana_reembolso_total_horas >= 6)
);
comment on table public.negocio is 'Bible: Glossary.md "Negocio" · rol de cuenta "Barbería" (ADR-002)';
create index negocio_owner_idx on public.negocio(owner_user_id);
create index negocio_ciudad_idx on public.negocio(ciudad) where estado = 'ACTIVO';
create index negocio_categoria_idx on public.negocio using gin(categoria);
create index negocio_nombre_trgm_idx on public.negocio using gin(nombre gin_trgm_ops);

-- ── Sede ──────────────────────────────────────────────────────────────────
create table public.sede (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  nombre text not null,
  direccion text not null,
  ciudad text not null,
  latitud double precision,
  longitud double precision,
  zona_horaria text not null default 'America/Bogota',
  horario_base jsonb not null default '{}'::jsonb, -- { "lun": [["09:00","20:00"]], ... }
  cerrada_temporalmente boolean not null default false,
  cerrada_permanente boolean not null default false, -- soft delete (04-Data-Model/05_Data_Retention.md)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sede_negocio_idx on public.sede(negocio_id);

-- ── Recursos (ADL-002: Recurso físico independiente del Staff) ─────────────
create table public.recurso_tipo (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  nombre text not null -- ej. "camilla", "cabina", "silla"
);

create table public.recurso (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sede(id) on delete cascade,
  recurso_tipo_id uuid not null references public.recurso_tipo(id),
  nombre text not null,
  estado recurso_estado not null default 'DISPONIBLE'
);
create index recurso_sede_idx on public.recurso(sede_id);

-- ── Servicio ──────────────────────────────────────────────────────────────
create table public.servicio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  nombre text not null,
  descripcion text,
  duracion_minutos int not null check (duracion_minutos > 0),
  precio_base numeric(12,2) not null check (precio_base >= 0),
  categoria_puntaje categoria_puntaje not null default 'ESTANDAR',
  requiere_recurso_tipo_id uuid references public.recurso_tipo(id),
  buffer_previo_minutos int not null default 0,
  buffer_posterior_minutos int not null default 0,
  estado servicio_estado not null default 'ACTIVO', -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index servicio_negocio_idx on public.servicio(negocio_id);

-- ── Staff (perfil profesional, 1:1 con auth.users) ─────────────────────────
create table public.staff (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  foto_url text,
  especialidad text, -- valor de dato libre (Glossary: "barbero" nunca es un tipo, solo un valor)
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Vínculo Staff–Negocio (1:1 activo por Staff — ADL-009) ─────────────────
create table public.vinculo_staff_negocio (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(usuario_id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_activa_id uuid references public.sede(id),
  es_guardian boolean not null default false, -- perfil operativo (Guardian_Lifecycle.md), NO es una cuenta
  estado vinculo_estado not null default 'INVITADO',
  comision_pct numeric(5,2) check (comision_pct between 20 and 80),
  fecha_ingreso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vinculo_staff_idx on public.vinculo_staff_negocio(staff_id);
create index vinculo_negocio_idx on public.vinculo_staff_negocio(negocio_id);
create index vinculo_sede_activa_idx on public.vinculo_staff_negocio(sede_activa_id);
-- ADL-009: un Staff nunca tiene dos vínculos no-RETIRADO simultáneos
create unique index vinculo_staff_unico_activo on public.vinculo_staff_negocio(staff_id)
  where estado <> 'RETIRADO';
-- Guardian_Lifecycle.md: precondición — Guardian exige sede_activa_id no nula
alter table public.vinculo_staff_negocio
  add constraint guardian_requiere_sede_activa
  check (not es_guardian or sede_activa_id is not null);

create table public.staff_servicio (
  staff_id uuid not null references public.staff(usuario_id) on delete cascade,
  servicio_id uuid not null references public.servicio(id) on delete cascade,
  primary key (staff_id, servicio_id)
);

create table public.disponibilidad (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculo_staff_negocio(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=domingo
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio)
);
create index disponibilidad_vinculo_idx on public.disponibilidad(vinculo_id);

create table public.bloqueo_ausencia (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculo_staff_negocio(id) on delete cascade,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  motivo text,
  check (fecha_fin > fecha_inicio)
);
create index bloqueo_ausencia_vinculo_idx on public.bloqueo_ausencia(vinculo_id);

-- ── updated_at trigger genérico ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array['perfil','negocio','sede','servicio','staff','vinculo_staff_negocio'])
  loop
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
