-- 170: Barberos adicionales (FASE 2A) — modelo de datos: lotes, periodos cobrados, historial, estados, revisión de pagos y reembolsos.
--
-- Un LOTE es una contratación: N cupos adicionales a un precio unitario CONGELADO (total = N × precio) con su propio periodo de 30 días.
-- Un cambio de precio posterior (adicional_precio_plan) nunca toca lotes existentes. Sin descuento Founder.
-- Máquina de estados ÚNICA en la base (adicional_estado_def + adicional_transicion): el mismo vocabulario en backend, interfaz, CRM y
-- webhooks. Nadie escribe `estado` directo: solo _adicional_transicionar (172), que valida la tabla de transiciones.
-- Cupos: son fungibles (un lote aporta `cantidad` al tope de capacidad); no se atan a profesionales concretos.
-- Rollback: 170_adicionales_modelo_lotes_REVERSION.sql.txt.

-- ── Estados y transiciones permitidas ───────────────────────────────────────────────────────
create table if not exists public.adicional_estado_def (
  codigo text primary key,
  etiqueta_es text not null,
  etiqueta_en text not null,
  aporta_cupo boolean not null default false,      -- referencia; el cálculo real vive en _adicionales_activos (172)
  terminal boolean not null default false,
  orden int not null
);
insert into public.adicional_estado_def (codigo, etiqueta_es, etiqueta_en, aporta_cupo, terminal, orden) values
  ('PENDIENTE_CONTRATACION', 'Pendiente de contratación', 'Pending contract',      false, false, 10),
  ('CHECKOUT_INICIADO',      'Checkout iniciado',         'Checkout started',       false, false, 20),
  ('PAGO_PENDIENTE',         'Pago pendiente',            'Payment pending',        false, false, 30),
  ('PAGO_CONFIRMADO',        'Pago confirmado',           'Payment confirmed',      false, false, 40),
  ('ACTIVO',                 'Activo',                    'Active',                 true,  false, 50),
  ('PROXIMO_A_RENOVAR',      'Próximo a renovar',         'Renewal due soon',       true,  false, 60),
  ('EN_GRACIA',              'En gracia',                 'In grace period',        true,  false, 70),
  ('SUSPENDIDO',             'Suspendido',                'Suspended',              false, false, 80),
  ('CANCELADO',              'Cancelado (sin renovación)','Cancelled (no renewal)', false, true,  90),
  ('EXPIRADO_SIN_PAGO',      'Expirado sin pago',         'Expired unpaid',         false, true,  100),
  ('REEMBOLSADO',            'Reembolsado',               'Refunded',               false, true,  110)
on conflict (codigo) do nothing;

create table if not exists public.adicional_transicion (
  desde text not null references public.adicional_estado_def(codigo),
  hacia text not null references public.adicional_estado_def(codigo),
  actores text[] not null check (actores <@ array['PROPIETARIO','SUPERSU','SISTEMA','WEBHOOK'] and cardinality(actores) > 0),
  primary key (desde, hacia)
);
insert into public.adicional_transicion (desde, hacia, actores) values
  ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO',   '{PROPIETARIO}'),
  ('PENDIENTE_CONTRATACION', 'CANCELADO',           '{PROPIETARIO,SUPERSU}'),
  ('PENDIENTE_CONTRATACION', 'EXPIRADO_SIN_PAGO',   '{SISTEMA}'),
  ('CHECKOUT_INICIADO',      'PAGO_PENDIENTE',      '{WEBHOOK}'),
  ('CHECKOUT_INICIADO',      'PAGO_CONFIRMADO',     '{WEBHOOK}'),
  ('CHECKOUT_INICIADO',      'CANCELADO',           '{PROPIETARIO,SUPERSU}'),
  ('CHECKOUT_INICIADO',      'EXPIRADO_SIN_PAGO',   '{SISTEMA}'),
  ('PAGO_PENDIENTE',         'PAGO_CONFIRMADO',     '{WEBHOOK}'),
  ('PAGO_PENDIENTE',         'CANCELADO',           '{PROPIETARIO,SUPERSU}'),
  ('PAGO_PENDIENTE',         'EXPIRADO_SIN_PAGO',   '{SISTEMA}'),
  ('PAGO_CONFIRMADO',        'ACTIVO',              '{WEBHOOK,SUPERSU}'),
  ('ACTIVO',                 'PROXIMO_A_RENOVAR',   '{SISTEMA}'),
  ('ACTIVO',                 'EN_GRACIA',           '{SISTEMA}'),
  ('ACTIVO',                 'SUSPENDIDO',          '{SUPERSU}'),
  ('ACTIVO',                 'CANCELADO',           '{PROPIETARIO,SUPERSU,SISTEMA}'),
  ('PROXIMO_A_RENOVAR',      'ACTIVO',              '{WEBHOOK,SUPERSU}'),
  ('PROXIMO_A_RENOVAR',      'EN_GRACIA',           '{SISTEMA}'),
  ('PROXIMO_A_RENOVAR',      'SUSPENDIDO',          '{SUPERSU}'),
  ('PROXIMO_A_RENOVAR',      'CANCELADO',           '{PROPIETARIO,SUPERSU,SISTEMA}'),
  ('EN_GRACIA',              'ACTIVO',              '{WEBHOOK,SUPERSU}'),
  ('EN_GRACIA',              'SUSPENDIDO',          '{SISTEMA,SUPERSU}'),
  ('EN_GRACIA',              'CANCELADO',           '{PROPIETARIO,SUPERSU}'),
  ('SUSPENDIDO',             'ACTIVO',              '{WEBHOOK,SUPERSU}'),
  ('SUSPENDIDO',             'CANCELADO',           '{PROPIETARIO,SUPERSU}'),
  ('ACTIVO',                 'REEMBOLSADO',         '{SUPERSU}'),
  ('PROXIMO_A_RENOVAR',      'REEMBOLSADO',         '{SUPERSU}'),
  ('EN_GRACIA',              'REEMBOLSADO',         '{SUPERSU}'),
  ('SUSPENDIDO',             'REEMBOLSADO',         '{SUPERSU}'),
  ('CANCELADO',              'REEMBOLSADO',         '{SUPERSU}')
on conflict (desde, hacia) do nothing;

-- Catálogos de solo lectura por RPC (admin_adicional_config_obtener): sin acceso directo de la API.
alter table public.adicional_estado_def enable row level security;
alter table public.adicional_transicion enable row level security;
revoke all on public.adicional_estado_def, public.adicional_transicion from public, anon, authenticated;

-- ── Lote ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.adicional_lote (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete restrict,
  pais_codigo char(2) not null references public.pais(codigo),
  plan_codigo public.plan_codigo not null,                       -- plan del negocio al contratar (solo informativo)
  cantidad int not null check (cantidad >= 1),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),  -- CONGELADO al contratar
  total numeric(12,2) not null,
  moneda text not null default 'COP',
  estado text not null default 'PENDIENTE_CONTRATACION' references public.adicional_estado_def(codigo),
  origen text not null default 'CHECKOUT_PRO' check (origen in ('CHECKOUT_PRO', 'MANUAL_SUPERADMIN')),
  contratado_at timestamptz not null default clock_timestamp(),
  inicio_periodo_at timestamptz,
  vigente_hasta timestamptz,                                      -- vencimiento del periodo pagado
  gracia_fin timestamptz,
  periodo_n int not null default 0 check (periodo_n >= 0),        -- periodos pagados
  cancelar_renovacion boolean not null default false,
  cancelado_at timestamptz,
  suspendido_at timestamptz,
  ultimo_aviso_dias int,                                          -- último umbral de aviso enviado en el periodo vigente
  pago_vigente_id uuid references public.pago(id),                -- pago de checkout en curso
  manual_tipo text check (manual_tipo is null or manual_tipo in ('CORTESIA', 'TRANSFERENCIA', 'CONTINGENCIA_PASARELA', 'AJUSTE')),
  manual_motivo text,
  manual_por uuid references auth.users(id),
  manual_referencia text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  constraint adicional_lote_total_coherente check (total = round(cantidad * precio_unitario, 2)),
  constraint adicional_lote_pago_precio check (origen = 'MANUAL_SUPERADMIN' or precio_unitario > 0)
);
create index if not exists adicional_lote_negocio_idx on public.adicional_lote (negocio_id, estado);
create index if not exists adicional_lote_vence_idx on public.adicional_lote (vigente_hasta) where estado in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA');

alter table public.adicional_lote enable row level security;
revoke all on public.adicional_lote from public, anon, authenticated;
grant select on public.adicional_lote to authenticated;
drop policy if exists adicional_lote_select on public.adicional_lote;
-- Solo el propietario (is_barberia_de) y SuperAdmin leen lotes. BUSINESS_ADMIN NO (decisión: lo comercial es del propietario).
create policy adicional_lote_select on public.adicional_lote for select to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));

-- Guardia: `estado` solo cambia desde _adicional_transicionar; precio/negocio/moneda nunca; cantidad/total solo con el ajuste de SuperAdmin.
create or replace function public.trg_adicional_lote_guardia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado and coalesce(current_setting('app.adicional_transicion', true), '') <> 'on' then
    raise exception 'ADICIONAL_ESTADO_SOLO_POR_TRANSICION';
  end if;
  if new.negocio_id is distinct from old.negocio_id or new.precio_unitario is distinct from old.precio_unitario
     or new.moneda is distinct from old.moneda or new.pais_codigo is distinct from old.pais_codigo
     or new.contratado_at is distinct from old.contratado_at or new.origen is distinct from old.origen then
    raise exception 'ADICIONAL_LOTE_CAMPO_INMUTABLE';
  end if;
  if (new.cantidad is distinct from old.cantidad or new.total is distinct from old.total)
     and coalesce(current_setting('app.adicional_ajuste', true), '') <> 'on' then
    raise exception 'ADICIONAL_LOTE_CAMPO_INMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.trg_adicional_lote_guardia() from public, anon, authenticated;
drop trigger if exists trg_adicional_lote_guardia on public.adicional_lote;
create trigger trg_adicional_lote_guardia before update on public.adicional_lote
  for each row execute function public.trg_adicional_lote_guardia();
drop trigger if exists trg_adicional_lote_nodelete on public.adicional_lote;
create trigger trg_adicional_lote_nodelete before delete on public.adicional_lote
  for each row execute function public.trg_fila_inmutable();

-- ── Periodos cobrados (puente con `pago`) ──────────────────────────────────────────────────────
create table if not exists public.adicional_cobro (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.adicional_lote(id) on delete restrict,
  negocio_id uuid not null references public.negocio(id) on delete restrict,
  periodo_n int not null check (periodo_n >= 1),
  monto numeric(12,2) not null check (monto > 0),
  pago_id uuid not null unique references public.pago(id),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO', 'ANULADO')),
  mp_payment_id text unique,
  periodo_desde timestamptz,
  periodo_hasta timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now()
);
-- Idempotencia de un periodo por ESQUEMA: un solo cobro vivo (pendiente o aprobado) por (lote, periodo).
create unique index if not exists adicional_cobro_periodo_vivo_uq on public.adicional_cobro (lote_id, periodo_n) where estado in ('PENDIENTE', 'APROBADO');
create index if not exists adicional_cobro_negocio_idx on public.adicional_cobro (negocio_id, created_at desc);
alter table public.adicional_cobro enable row level security;
revoke all on public.adicional_cobro from public, anon, authenticated;
grant select on public.adicional_cobro to authenticated;
drop policy if exists adicional_cobro_select on public.adicional_cobro;
create policy adicional_cobro_select on public.adicional_cobro for select to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));

-- ── Historial (append-only) ───────────────────────────────────────────────────────────────────
create table if not exists public.adicional_historial (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.adicional_lote(id) on delete restrict,
  negocio_id uuid not null references public.negocio(id) on delete restrict,
  evento text not null,
  estado_antes text,
  estado_despues text,
  cantidad_antes int,
  cantidad_despues int,
  actor_tipo text not null check (actor_tipo in ('PROPIETARIO', 'SUPERSU', 'SISTEMA', 'WEBHOOK')),
  actor_id uuid references auth.users(id),
  motivo text,
  pago_id uuid references public.pago(id),
  mp_ref text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists adicional_historial_lote_idx on public.adicional_historial (lote_id, created_at);
-- Evita duplicar el mismo evento de pago (webhook repetido): una sola fila por (lote, evento, mp_ref).
create unique index if not exists adicional_historial_evento_mp_uq on public.adicional_historial (lote_id, evento, mp_ref) where mp_ref is not null;
alter table public.adicional_historial enable row level security;
revoke all on public.adicional_historial from public, anon, authenticated;
grant select on public.adicional_historial to authenticated;
drop policy if exists adicional_historial_select on public.adicional_historial;
create policy adicional_historial_select on public.adicional_historial for select to authenticated
  using (coalesce(public.is_barberia_de(negocio_id), false) or coalesce(public.is_supersu(), false));
drop trigger if exists trg_adicional_historial_inmutable on public.adicional_historial;
create trigger trg_adicional_historial_inmutable before update or delete on public.adicional_historial
  for each row execute function public.trg_fila_inmutable();

-- ── Pagos que no se pueden aplicar solos: cola de revisión (nunca se reembolsa a ciegas) ───────────
create table if not exists public.adicional_pago_revision (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pago(id),
  lote_id uuid references public.adicional_lote(id),
  negocio_id uuid references public.negocio(id),
  motivo text not null,
  detalle jsonb not null default '{}'::jsonb,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'RESUELTO')),
  resuelto_por uuid references auth.users(id),
  resuelto_at timestamptz,
  resolucion text,
  created_at timestamptz not null default now()
);
create unique index if not exists adicional_pago_revision_uq on public.adicional_pago_revision (pago_id, motivo, coalesce(detalle ->> 'mp_ref', ''));
alter table public.adicional_pago_revision enable row level security;
revoke all on public.adicional_pago_revision from public, anon, authenticated;
grant select on public.adicional_pago_revision to authenticated;
drop policy if exists adicional_pago_revision_select on public.adicional_pago_revision;
create policy adicional_pago_revision_select on public.adicional_pago_revision for select to authenticated using (coalesce(public.is_supersu(), false));

-- ── Reembolsos de adicionales (registro y decisión auditados; NO hay reembolso automático) ─────────
create table if not exists public.adicional_reembolso (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references public.adicional_lote(id),
  cobro_id uuid references public.adicional_cobro(id),
  pago_id uuid references public.pago(id),
  negocio_id uuid not null references public.negocio(id),
  monto numeric(12,2) not null check (monto > 0),
  causa text not null check (causa in ('COBRO_DUPLICADO', 'COBRO_INCORRECTO', 'ERROR_TECNICO', 'PAGO_NO_RECONOCIDO', 'OBLIGACION_LEGAL', 'OTRO')),
  estado text not null default 'SOLICITADO' check (estado in ('SOLICITADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'EJECUTADO_MANUAL')),
  detalle text,
  solicitado_por uuid references auth.users(id),
  decidido_por uuid references auth.users(id),
  decision_motivo text,
  decidido_at timestamptz,
  referencia_ejecucion text,        -- id del reembolso en Mercado Pago, anotado por el operador
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now()
);
create unique index if not exists adicional_reembolso_abierto_uq on public.adicional_reembolso (pago_id) where estado in ('SOLICITADO', 'EN_REVISION', 'APROBADO');
alter table public.adicional_reembolso enable row level security;
revoke all on public.adicional_reembolso from public, anon, authenticated;
grant select on public.adicional_reembolso to authenticated;
drop policy if exists adicional_reembolso_select on public.adicional_reembolso;
create policy adicional_reembolso_select on public.adicional_reembolso for select to authenticated using (coalesce(public.is_supersu(), false));

-- ── Registro de corridas del cron (una por día de Bogotá) ──────────────────────────────────────────
create table if not exists public.adicional_mantenimiento_corrida (
  fecha date primary key,
  ejecutado_at timestamptz not null default now(),
  resultado jsonb not null default '{}'::jsonb
);
alter table public.adicional_mantenimiento_corrida enable row level security;
revoke all on public.adicional_mantenimiento_corrida from public, anon, authenticated;

-- Auditoría de cambios de las tablas editables.
drop trigger if exists trg_auditar_adicional_lote on public.adicional_lote;
create trigger trg_auditar_adicional_lote after insert or update on public.adicional_lote
  for each row execute function public._trg_auditar_cambio('adicional_lote', 'negocio_id', '*', '-');
drop trigger if exists trg_auditar_adicional_reembolso on public.adicional_reembolso;
create trigger trg_auditar_adicional_reembolso after insert or update on public.adicional_reembolso
  for each row execute function public._trg_auditar_cambio('adicional_reembolso', 'negocio_id', '*', '-');

-- Índices de claves foráneas (regla de rendimiento de la migración 131: toda FK con índice).
create index if not exists adicional_transicion_hacia_idx on public.adicional_transicion (hacia);
create index if not exists adicional_lote_pago_vigente_idx on public.adicional_lote (pago_vigente_id);
create index if not exists adicional_lote_manual_por_idx on public.adicional_lote (manual_por);
create index if not exists adicional_lote_creado_por_idx on public.adicional_lote (creado_por);
create index if not exists adicional_lote_estado_idx on public.adicional_lote (estado);
create index if not exists adicional_lote_pais_idx on public.adicional_lote (pais_codigo);
create index if not exists adicional_historial_pago_idx on public.adicional_historial (pago_id);
create index if not exists adicional_historial_negocio_idx on public.adicional_historial (negocio_id);
create index if not exists adicional_historial_actor_idx on public.adicional_historial (actor_id);
create index if not exists adicional_pago_revision_resuelto_idx on public.adicional_pago_revision (resuelto_por);
create index if not exists adicional_pago_revision_lote_idx on public.adicional_pago_revision (lote_id);
create index if not exists adicional_pago_revision_negocio_idx on public.adicional_pago_revision (negocio_id);
create index if not exists adicional_reembolso_negocio_idx on public.adicional_reembolso (negocio_id);
create index if not exists adicional_reembolso_solicito_idx on public.adicional_reembolso (solicitado_por);
create index if not exists adicional_reembolso_decidio_idx on public.adicional_reembolso (decidido_por);
create index if not exists adicional_reembolso_lote_idx on public.adicional_reembolso (lote_id);
create index if not exists adicional_reembolso_cobro_idx on public.adicional_reembolso (cobro_id);
