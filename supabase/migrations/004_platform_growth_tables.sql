-- StylerNow — Migración 004: plataforma, monetización, IA, WhatsApp
-- Fuente: 01-PRD/03_Monetization.md, AI_Credit_System.md, WhatsApp_Delivery_Engine.md,
--         08-Growth-Monetization/*, 04-Data-Model/04_Audit.md, 10-Operations/01_Feature_Flags.md

-- ── Plan (fila de configuración, editable solo por SuperSU) ───────────────
create table public.plan (
  codigo plan_codigo primary key,
  nombre text not null,
  precio_mensual numeric(12,2), -- null para ALLFATHER (personalizado)
  limite_sedes int, -- null = ilimitado (Allfather)
  staff_incluido int,
  staff_addon_precio numeric(12,2),
  sede_addon_precio numeric(12,2),
  guardian_disponible boolean not null default false,
  marketplace_ads_disponible boolean not null default false,
  creditos_ia_mes int, -- null = personalizado
  conversaciones_whatsapp_mes int, -- null = personalizado
  updated_at timestamptz not null default now()
);

insert into public.plan (codigo, nombre, precio_mensual, limite_sedes, staff_incluido, staff_addon_precio, sede_addon_precio, guardian_disponible, marketplace_ads_disponible, creditos_ia_mes, conversaciones_whatsapp_mes)
values
  ('RAVEN', 'Raven', 69900, 1, 1, 20000, null, false, false, 100, 20),
  ('JARL', 'Jarl', 149900, 1, 5, 20000, null, true, true, 600, 100),
  ('VALHALLA', 'Valhalla', 349900, 5, 10, 15000, 50000, true, true, 2500, 500),
  ('ALLFATHER', 'Allfather', null, null, null, null, null, true, true, null, null);

-- Raven: tope absoluto de 2 Staff (1 incluido + máx. 1 adicional) — 01-PRD/03_Monetization.md
alter table public.plan add column staff_tope_absoluto int;
update public.plan set staff_tope_absoluto = 2 where codigo = 'RAVEN';

-- ── Suscripción ───────────────────────────────────────────────────────────
create table public.suscripcion (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references public.negocio(id),
  plan_codigo plan_codigo not null references public.plan(codigo),
  estado suscripcion_estado not null default 'ACTIVA',
  fecha_inicio_ciclo timestamptz not null default now(),
  fecha_proximo_cobro timestamptz not null,
  plan_codigo_destino plan_codigo references public.plan(codigo), -- downgrade programado
  reintentos_fallo_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Campaña publicitaria ──────────────────────────────────────────────────
create table public.campana_publicitaria (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  formato text not null check (formato in ('DESTACADO','PIN','BANNER','FLASH')),
  presupuesto_diario numeric(12,2) not null,
  presupuesto_total numeric(12,2),
  gasto_total numeric(12,2) not null default 0,
  gasto_hoy numeric(12,2) not null default 0,
  gasto_hoy_fecha date not null default current_date,
  estado campana_estado not null default 'BORRADOR',
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  segmentacion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campana_negocio_idx on public.campana_publicitaria(negocio_id);

-- ── Créditos IA (AI_Credit_System.md) ──────────────────────────────────────
create table public.credito_ia_lote (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  origen text not null check (origen in ('PLAN','PAQUETE')),
  cantidad int not null check (cantidad > 0),
  cantidad_disponible int not null check (cantidad_disponible >= 0),
  fecha_otorgamiento timestamptz not null default now(),
  fecha_expiracion timestamptz not null,
  created_at timestamptz not null default now()
);
create index credito_ia_negocio_idx on public.credito_ia_lote(negocio_id) where cantidad_disponible > 0;
create index credito_ia_expiracion_idx on public.credito_ia_lote(fecha_expiracion);

create table public.credito_ia_consumo (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  funcion text not null, -- 'AI_STAFF_INSIGHTS' | 'AI_OCUPACION' | 'AI_RIESGO_ABANDONO' | 'AI_SUGERENCIA_CAMPANA'
  nivel int not null check (nivel in (1,2)),
  creditos_consumidos int not null check (creditos_consumidos > 0),
  saldo_restante int not null,
  created_at timestamptz not null default now()
);
create index credito_ia_consumo_negocio_idx on public.credito_ia_consumo(negocio_id);

-- ── Conversaciones WhatsApp (WhatsApp_Delivery_Engine.md) ──────────────────
create table public.whatsapp_conversacion_lote (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  origen text not null check (origen in ('PLAN','PAQUETE')),
  cantidad int not null check (cantidad > 0),
  cantidad_disponible int not null check (cantidad_disponible >= 0),
  fecha_otorgamiento timestamptz not null default now(),
  fecha_expiracion timestamptz not null,
  created_at timestamptz not null default now()
);
create index whatsapp_lote_negocio_idx on public.whatsapp_conversacion_lote(negocio_id) where cantidad_disponible > 0;

create table public.notificacion_envio (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id),
  evento text not null, -- catálogo de 02-UX/11_Notifications.md
  categoria text not null, -- clasificación de WhatsApp_Delivery_Engine.md
  canal text not null check (canal in ('PUSH','EMAIL','WHATSAPP_API','WA_ME','PANEL_INTERNO')),
  negocio_id uuid references public.negocio(id),
  referencia_tipo text,
  referencia_id uuid,
  enviado_at timestamptz not null default now(),
  leido_at timestamptz
);
create index notificacion_destinatario_idx on public.notificacion_envio(destinatario_id, enviado_at desc);

-- ── Auditoría (04-Data-Model/04_Audit.md) ──────────────────────────────────
create table public.evento_auditoria (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null,
  entidad_id uuid,
  accion text not null,
  actor_tipo text not null check (actor_tipo in ('CLIENTE','STAFF','GUARDIAN','BARBERIA','SUPERSU','SISTEMA')),
  actor_id uuid references auth.users(id),
  impersonated_by uuid references auth.users(id), -- modo impersonación de SuperSU
  payload_antes jsonb,
  payload_despues jsonb,
  motivo text,
  negocio_id uuid references public.negocio(id), -- desnormalizado para RLS eficiente
  created_at timestamptz not null default now()
);
create index auditoria_negocio_idx on public.evento_auditoria(negocio_id);
create index auditoria_actor_idx on public.evento_auditoria(actor_id);
create index auditoria_entidad_idx on public.evento_auditoria(entidad_tipo, entidad_id);

-- ── Feature Flags (10-Operations/01_Feature_Flags.md) ─────────────────────
create table public.feature_flag (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  alcance text not null check (alcance in ('GLOBAL','CIUDAD','PLAN','NEGOCIO')),
  alcance_valor text, -- ciudad, plan_codigo o negocio_id según 'alcance'
  activo boolean not null default false,
  fecha_revision date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Textos legales versionados (06-Security/04_Compliance_Colombia.md) ────
create table public.texto_legal (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('TERMINOS','POLITICA_DATOS')),
  version int not null,
  contenido text not null,
  cambio_material boolean not null default false,
  publicado_at timestamptz not null default now(),
  unique (tipo, version)
);

create table public.aceptacion_legal (
  usuario_id uuid not null references auth.users(id),
  texto_legal_id uuid not null references public.texto_legal(id),
  aceptado_at timestamptz not null default now(),
  primary key (usuario_id, texto_legal_id)
);
