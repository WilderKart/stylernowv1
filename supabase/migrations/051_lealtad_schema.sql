-- StylerNow — Migración 051: Dominio LEALTAD (ADR-011), schema completo
-- Fuente: ADR_011_Motor_Lealtad.md, 03-Business-Rules/04_Lealtad.md
--
-- 12 sistemas de recompensa que comparten un mismo motor. Solo schema en
-- esta migración (tablas, enums, índices) — ninguna RPC todavía, para
-- poder usar los enums nuevos con seguridad en la migración siguiente
-- (precedente: migración 015, un valor de enum SÍ puede usarse en la
-- misma migración en este proyecto, pero se separa igual por prolijidad
-- dado el tamaño de este dominio).
--
-- Aislamiento de dinero explícito (ADR-011): `lealtad_wallet` es un
-- dominio de saldo completamente distinto de `wallet` (comisión de
-- plataforma por Negocio, Módulo 6.1) y de `credito_ia_lote` (consumo de
-- IA por Negocio) — nunca se fusionan.

-- ── Enums ───────────────────────────────────────────────────────────────

create type lealtad_origen as enum (
  'GIFT_CARD', 'REFERIDO', 'CASHBACK', 'PROMOCION', 'SELLO_CONVERTIDO', 'VIP_BONO', 'CANJE'
);

create type membresia_estado as enum (
  'ACTIVA', 'PROXIMA_A_VENCER', 'SUSPENDIDA', 'CANCELADA', 'VENCIDA'
);

create type gift_card_estado as enum (
  'ACTIVA', 'BLOQUEADA', 'CANJEADA', 'VENCIDA'
);

create type referido_estado as enum (
  'PENDIENTE', 'COMPLETADO', 'EXPIRADO'
);

create type campana_sellos_estado as enum (
  'ACTIVA', 'PAUSADA', 'FINALIZADA'
);

create type cashback_estado as enum (
  'PENDIENTE', 'DISPONIBLE', 'UTILIZADO', 'EXPIRADO'
);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 1 — StylerWallet (núcleo del dominio)
-- ════════════════════════════════════════════════════════════════════════

create table public.lealtad_wallet (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.perfil(id),
  saldo_disponible numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nunca se borra un movimiento (mismo principio que wallet_movimiento).
create table public.lealtad_movimiento (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.lealtad_wallet(id),
  tipo lealtad_origen not null,
  monto numeric(12,2) not null, -- negativo = canje/consumo
  negocio_id uuid references public.negocio(id),
  sede_id uuid references public.sede(id),
  referencia_tipo text,
  referencia_id uuid,
  motivo text,
  created_at timestamptz not null default now()
);
create index lealtad_movimiento_wallet_idx on public.lealtad_movimiento(wallet_id);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 2 — Membresías
-- ════════════════════════════════════════════════════════════════════════

create table public.membresia_plan (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  nombre text not null,
  precio numeric(12,2) not null check (precio > 0),
  duracion_meses int not null check (duracion_meses in (1, 3, 6, 12)),
  renovacion_automatica boolean not null default true,
  servicio_ids uuid[] not null default '{}',
  limite_usos_mes int,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  prioridad_reserva boolean not null default false,
  regalo_cumpleanos text,
  dias_gracia int not null default 0 check (dias_gracia >= 0),
  congelacion_max_dias int not null default 0 check (congelacion_max_dias in (0, 7, 15, 30)),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membresia_plan_negocio_idx on public.membresia_plan(negocio_id) where activo = true;

create table public.cliente_membresia (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  plan_id uuid not null references public.membresia_plan(id),
  negocio_id uuid not null references public.negocio(id),
  estado membresia_estado not null default 'ACTIVA',
  fecha_inicio timestamptz not null default now(),
  fecha_proximo_cobro timestamptz not null,
  congelada_hasta timestamptz,
  usos_mes_actual int not null default 0,
  usos_mes_fecha date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cliente_membresia_cliente_idx on public.cliente_membresia(cliente_id);
create index cliente_membresia_negocio_idx on public.cliente_membresia(negocio_id);

create table public.membresia_uso (
  id uuid primary key default gen_random_uuid(),
  cliente_membresia_id uuid not null references public.cliente_membresia(id),
  reserva_id uuid references public.reserva(id),
  tipo text not null check (tipo in ('SERVICIO_INCLUIDO', 'DESCUENTO_APLICADO')),
  monto_beneficio numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index membresia_uso_cliente_membresia_idx on public.membresia_uso(cliente_membresia_id);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 3 y 10 — Gift Cards (individuales y empresariales, misma tabla)
-- ════════════════════════════════════════════════════════════════════════

create table public.gift_card (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  pin_hash text not null,
  negocio_id uuid not null references public.negocio(id),
  comprador_id uuid references public.perfil(id),
  destinatario_email text,
  destinatario_telefono text,
  monto_original numeric(12,2) not null check (monto_original > 0),
  saldo_actual numeric(12,2) not null,
  estado gift_card_estado not null default 'ACTIVA',
  fecha_expiracion timestamptz,
  -- Módulo 10 — Gift Cards empresariales: mismo modelo, con el origen corporativo.
  corporativo_cuenta_id uuid, -- FK agregada tras crear corporativo_cuenta más abajo
  lote_id uuid, -- agrupa una compra masiva empresarial
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gift_card_negocio_idx on public.gift_card(negocio_id);
create index gift_card_comprador_idx on public.gift_card(comprador_id);

create table public.gift_card_redencion (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_card(id),
  cliente_id uuid not null references public.perfil(id),
  monto numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 4 y 11 — Referidos (Cliente y Staff)
-- ════════════════════════════════════════════════════════════════════════

create table public.referido_codigo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.perfil(id),
  codigo text not null unique,
  created_at timestamptz not null default now()
);

create table public.referido (
  id uuid primary key default gen_random_uuid(),
  referido_codigo_id uuid not null references public.referido_codigo(id),
  referente_cliente_id uuid not null references public.perfil(id),
  referido_cliente_id uuid not null unique references public.perfil(id),
  negocio_id uuid references public.negocio(id),
  estado referido_estado not null default 'PENDIENTE',
  reserva_completada_id uuid references public.reserva(id),
  monto_recompensa numeric(12,2),
  created_at timestamptz not null default now(),
  completado_at timestamptz
);
create index referido_referente_idx on public.referido(referente_cliente_id);

create table public.referido_config (
  negocio_id uuid primary key references public.negocio(id),
  monto numeric(12,2),
  porcentaje numeric(5,2),
  limite_mensual int,
  vigencia_dias int not null default 90,
  activo boolean not null default true
);

-- Módulo 11 — Referidos de Staff: tabla separada (recompensa distinta,
-- nunca duplicada con la del Cliente — se valida en la RPC, ver migración
-- siguiente, ya que Postgres no soporta un unique constraint entre tablas).
create table public.staff_referido (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(usuario_id),
  negocio_id uuid not null references public.negocio(id),
  cliente_referido_id uuid not null unique references public.perfil(id),
  estado referido_estado not null default 'PENDIENTE',
  reserva_completada_id uuid references public.reserva(id),
  recompensa_tipo text check (recompensa_tipo in ('DINERO', 'PUNTOS', 'RECONOCIMIENTO')),
  recompensa_monto numeric(12,2),
  created_at timestamptz not null default now(),
  completado_at timestamptz
);
create index staff_referido_staff_idx on public.staff_referido(staff_id);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 5 — Sellos digitales
-- ════════════════════════════════════════════════════════════════════════

create table public.sello_campana (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  nombre text not null,
  servicio_ids uuid[] not null default '{}', -- vacío = cualquier servicio
  sellos_requeridos int not null check (sellos_requeridos > 0),
  recompensa_descripcion text not null,
  vencimiento_dias int,
  estado campana_sellos_estado not null default 'ACTIVA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sello_campana_negocio_idx on public.sello_campana(negocio_id);

create table public.sello_cliente (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.sello_campana(id),
  cliente_id uuid not null references public.perfil(id),
  sellos_actuales int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campana_id, cliente_id)
);

create table public.sello_evento (
  id uuid primary key default gen_random_uuid(),
  sello_cliente_id uuid not null references public.sello_cliente(id),
  reserva_id uuid references public.reserva(id),
  tipo text not null check (tipo in ('OTORGADO', 'CANJEADO')),
  cantidad int not null default 1,
  created_at timestamptz not null default now()
);
-- Un sello por transacción elegible — nunca se duplica el otorgamiento de una misma Reserva.
create unique index sello_evento_reserva_unica on public.sello_evento(reserva_id)
  where tipo = 'OTORGADO' and reserva_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 6 — Cashback
-- ════════════════════════════════════════════════════════════════════════

create table public.cashback_regla (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  servicio_ids uuid[] not null default '{}',
  producto_ids uuid[] not null default '{}',
  limite_mensual numeric(12,2),
  vigencia_dias int,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index cashback_regla_negocio_idx on public.cashback_regla(negocio_id) where activo = true;

create table public.cashback_movimiento (
  id uuid primary key default gen_random_uuid(),
  regla_id uuid not null references public.cashback_regla(id),
  cliente_id uuid not null references public.perfil(id),
  reserva_id uuid references public.reserva(id),
  monto numeric(12,2) not null,
  estado cashback_estado not null default 'PENDIENTE',
  fecha_expiracion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cashback_movimiento_cliente_idx on public.cashback_movimiento(cliente_id);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 7 — Club VIP
-- ════════════════════════════════════════════════════════════════════════

create table public.vip_nivel (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  nombre text not null,
  orden int not null,
  beneficios text,
  umbral_automatico_gasto numeric(12,2),
  created_at timestamptz not null default now(),
  unique (negocio_id, orden)
);

create table public.vip_miembro (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  nivel_id uuid not null references public.vip_nivel(id),
  origen text not null check (origen in ('MANUAL', 'AUTOMATICO')),
  asignado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, negocio_id)
);

create table public.vip_historial (
  id uuid primary key default gen_random_uuid(),
  vip_miembro_id uuid not null references public.vip_miembro(id),
  nivel_anterior_id uuid references public.vip_nivel(id),
  nivel_nuevo_id uuid not null references public.vip_nivel(id),
  motivo text,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 8 — Paquetes familiares
-- ════════════════════════════════════════════════════════════════════════

create table public.familia_grupo (
  id uuid primary key default gen_random_uuid(),
  titular_cliente_id uuid not null references public.perfil(id),
  negocio_id uuid references public.negocio(id),
  nombre text not null default 'Mi familia',
  limite_miembros int not null default 4 check (limite_miembros > 0),
  saldo_compartido numeric(12,2) not null default 0,
  descuento_familiar_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.familia_miembro (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familia_grupo(id),
  cliente_id uuid not null unique references public.perfil(id),
  parentesco text,
  created_at timestamptz not null default now(),
  unique (familia_id, cliente_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 9 — Suscripciones corporativas
-- ════════════════════════════════════════════════════════════════════════

create table public.corporativo_cuenta (
  id uuid primary key default gen_random_uuid(),
  nombre_empresa text not null,
  nit text,
  contacto_email text not null,
  admin_user_id uuid references auth.users(id),
  cupos_totales int not null check (cupos_totales > 0),
  vigencia_inicio date not null default current_date,
  vigencia_fin date not null,
  sedes_permitidas uuid[] not null default '{}',
  negocio_id uuid references public.negocio(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gift_card
  add constraint gift_card_corporativo_fk foreign key (corporativo_cuenta_id) references public.corporativo_cuenta(id);

create table public.corporativo_miembro (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.corporativo_cuenta(id),
  cliente_id uuid not null references public.perfil(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cuenta_id, cliente_id)
);

create table public.corporativo_consumo (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references public.corporativo_miembro(id),
  reserva_id uuid references public.reserva(id),
  monto numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 12 — Motor de recompensas automáticas (reglas + IA vía OpenRouter)
-- ════════════════════════════════════════════════════════════════════════

create table public.recompensa_regla (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  disparador text not null check (disparador in ('CLIENTE_INACTIVO', 'CUMPLEANOS', 'OBJETIVO_LOGRADO', 'RIESGO_ABANDONO', 'MEJOR_HORARIO')),
  nivel_ia int not null default 0 check (nivel_ia in (0, 1, 2)),
  condicion jsonb not null default '{}'::jsonb,
  accion jsonb not null default '{}'::jsonb,
  requiere_confirmacion boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recompensa_sugerencia (
  id uuid primary key default gen_random_uuid(),
  regla_id uuid not null references public.recompensa_regla(id),
  negocio_id uuid not null references public.negocio(id),
  cliente_id uuid references public.perfil(id),
  descripcion text not null,
  justificacion text,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'CONFIRMADA', 'DESCARTADA')),
  costo_credito_ia int not null default 0,
  created_at timestamptz not null default now(),
  resuelta_at timestamptz
);
create index recompensa_sugerencia_negocio_idx on public.recompensa_sugerencia(negocio_id) where estado = 'PENDIENTE';

-- ════════════════════════════════════════════════════════════════════════
-- Motor antifraude — solo lo verificable sin infraestructura nueva
-- (dispositivo/IP requeriría fingerprinting cliente-side + captura de IP
-- en cada request, no existente en el proyecto — ver TECH_DEBT_REGISTER.md;
-- canje duplicado y abuso de referido son checks 100% de base de datos,
-- construidos completos en la migración de RPCs).
-- ════════════════════════════════════════════════════════════════════════

create table public.lealtad_fraude_evento (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('DISPOSITIVO_REPETIDO', 'IP_SOSPECHOSA', 'CANJE_DUPLICADO', 'ABUSO_REFERIDO', 'MULTIPLES_CUENTAS')),
  cliente_id uuid references public.perfil(id),
  negocio_id uuid references public.negocio(id),
  severidad text not null default 'MEDIA' check (severidad in ('BAJA', 'MEDIA', 'ALTA')),
  payload jsonb not null default '{}'::jsonb,
  revisado boolean not null default false,
  created_at timestamptz not null default now()
);
create index lealtad_fraude_evento_negocio_idx on public.lealtad_fraude_evento(negocio_id);
