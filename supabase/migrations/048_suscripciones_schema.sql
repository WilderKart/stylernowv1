-- StylerNow — Migración 048: Fase 6, Módulo 6.3 — Suscripciones (schema)
-- Fuente: 08-Growth-Monetization/04_Subscriptions_Lifecycle.md, 05_Billing_Failures.md,
--         01-PRD/03_Monetization.md (regla de prorrateo).
--
-- Solo columnas y el nuevo valor de enum — sin ninguna función que los use
-- todavía, para no repetir el error de "nuevo valor de enum usado en la
-- misma transacción en que se crea" (Postgres lo rechaza). Las RPCs que
-- consumen esto van en la migración 049, siempre.

-- Nuevo tipo de pago para el cobro (único, prorrateado) de un upgrade de
-- Plan — no es una transacción de Marketplace: no pasa por Wallet ni por
-- comisión de Negocio (ver aplicar_evento_pago en 049).
alter type pago_tipo add value if not exists 'SUSCRIPCION';

-- Metadata genérica del pago — el primer y único consumidor hoy es
-- SUSCRIPCION (guarda a qué plan_codigo se está haciendo upgrade), pero se
-- deja como columna reusable en vez de una específica de una sola feature,
-- igual que `segmentacion` en campana_publicitaria o `payload_*` en
-- evento_auditoria.
alter table public.pago add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Causa de la suspensión actual (04_Subscriptions_Lifecycle.md: "por dos
-- causas posibles: Impago o Infracción"). Se limpia al reactivar.
alter table public.suscripcion add column if not exists suspendido_causa text
  check (suspendido_causa in ('IMPAGO', 'INFRACCION'));
