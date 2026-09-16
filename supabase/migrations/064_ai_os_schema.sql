-- StylerNow — Migración 064: AI OS (ADR-013) — schema completo de los 6
-- sistemas P0: AIProvider (ya existe en TS), Credit Meter, Prompt Builder,
-- Cost Optimizer, AI Memory, AI Pricing Engine.
-- Fuente: instrucción directa del fundador, 2026-09-16 (ver
-- ADR_013_AI_OS_Monetizacion.md).
--
-- Principio oficial: "StylerNow nunca subsidia IA" — toda llamada con
-- costo se financia con créditos del propio Negocio, sea el Cliente
-- quien conversa o el sistema quien automatiza. `credito_ia_lote`/
-- `credito_ia_consumo` existen desde la migración 004 sin ningún
-- consumidor real hasta ahora — mismo patrón "arquitectura lista, nunca
-- conectada" ya encontrado varias veces en este proyecto.

-- ── AI Pricing Engine ───────────────────────────────────────────────────
-- Ningún costo hardcodeado: toda acción de IA tiene su fila acá, editable
-- por SuperSU. `costo_creditos` es lo que se cobra al Negocio; el resto
-- son campos informativos para el AI Cost Simulator.
create table public.ai_accion_costo (
  id uuid primary key default gen_random_uuid(),
  accion text not null unique, -- ej. 'busqueda_natural', 'coach_staff'
  categoria text not null check (categoria in ('CONCIERGE_CLIENTE', 'COACH_STAFF', 'ANALISTA_NEGOCIO', 'CAMPANAS', 'PREDICCION_ABANDONO', 'PRICING_ADVISOR', 'INVENTORY_PREDICTOR', 'MARKETPLACE_AI', 'LEALTAD')),
  nivel_ia int not null check (nivel_ia in (0, 1, 2)),
  costo_proveedor_estimado numeric(12, 4) not null default 0, -- USD estimado por ejecución
  margen_pct numeric(5, 2) not null default 0,
  costo_creditos int not null check (costo_creditos >= 0),
  modelo_preferido text, -- referencia a ai_modelo_config.nombre
  modelo_fallback text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Cost Optimizer ──────────────────────────────────────────────────────
-- Orden de preferencia configurable de proveedores/modelos — nunca
-- hardcodeado en TypeScript. `activo` se apaga solo (o SuperSU lo apaga
-- manualmente) cuando el proveedor no tiene credencial configurada.
create table public.ai_modelo_config (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, -- ej. 'ollama-local', 'openrouter-economico'
  proveedor text not null check (proveedor in ('OLLAMA', 'OPENROUTER', 'GEMINI', 'NEMOTRON', 'PREMIUM')),
  modelo_id text not null, -- id real del modelo en el proveedor
  orden_preferencia int not null,
  costo_por_millon_tokens_usd numeric(10, 4) not null default 0,
  requiere_credencial text, -- nombre de la env var que debe existir; null = siempre disponible
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Paquetes de recarga de créditos ─────────────────────────────────────
create table public.ai_paquete_creditos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creditos int not null check (creditos > 0),
  precio_cop numeric(12, 2), -- null = "Enterprise", cotización manual
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Funciones de IA habilitadas por Plan ────────────────────────────────
-- "Las funciones dependen del plan contratado. Los créditos únicamente
-- limitan cuánto puede usarse ese conjunto de funciones." — nunca add-ons
-- para desbloquear funciones.
create table public.plan_funcion_ia (
  plan_codigo plan_codigo not null references public.plan(codigo),
  funcion text not null,
  habilitado boolean not null default true,
  primary key (plan_codigo, funcion)
);

-- ── AI Memory ────────────────────────────────────────────────────────────
-- Persistente en Supabase, nunca en el modelo. Versionada: cada edición
-- inserta una fila nueva con `version` incremental, la anterior queda
-- `vigente = false` — nunca se sobreescribe una versión ya guardada.
create table public.ai_memoria_negocio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  sede_id uuid references public.sede(id), -- null = memoria a nivel Negocio (multi-sede)
  categoria text not null check (categoria in ('TONO', 'PROMOCIONES', 'CLIENTES_VIP', 'CAMPANAS_EXITOSAS', 'HORARIOS', 'OBJETIVOS', 'CONFIGURACIONES', 'APRENDIZAJES')),
  contenido jsonb not null default '{}'::jsonb,
  version int not null default 1,
  vigente boolean not null default true,
  aprobado boolean not null default false,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index ai_memoria_negocio_idx on public.ai_memoria_negocio(negocio_id, categoria) where vigente = true;

-- ── AI Prompt Library (arquitectura completa, sin Marketplace todavía) ──
create table public.ai_prompt (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('OFICIAL', 'PROPIO', 'COMPARTIDO', 'MARKETPLACE_FUTURO')),
  negocio_id uuid references public.negocio(id), -- null para OFICIAL
  categoria text not null,
  nombre text not null,
  contenido text not null,
  variables jsonb not null default '[]'::jsonb, -- ej. ["nombre_cliente","sede","servicio"]
  version int not null default 1,
  autor_id uuid references auth.users(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_prompt_negocio_idx on public.ai_prompt(negocio_id) where activo = true;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.ai_accion_costo enable row level security;
alter table public.ai_modelo_config enable row level security;
alter table public.ai_paquete_creditos enable row level security;
alter table public.plan_funcion_ia enable row level security;
alter table public.ai_memoria_negocio enable row level security;
alter table public.ai_prompt enable row level security;

-- Catálogos: lectura pública (activo) o interna (todo), escritura solo SuperSU vía RPC.
create policy ai_accion_costo_select on public.ai_accion_costo for select using (activo = true or public.is_supersu());
create policy ai_modelo_config_select on public.ai_modelo_config for select using (public.is_supersu());
create policy ai_paquete_creditos_select on public.ai_paquete_creditos for select using (activo = true or public.is_supersu());
create policy plan_funcion_ia_select on public.plan_funcion_ia for select using (true);

create policy ai_memoria_negocio_select on public.ai_memoria_negocio for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy ai_prompt_select on public.ai_prompt for select
  using (tipo = 'OFICIAL' or (negocio_id is not null and public.tiene_acceso_interno(negocio_id)) or public.is_supersu());
