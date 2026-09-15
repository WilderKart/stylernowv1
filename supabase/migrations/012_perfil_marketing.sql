-- StylerNow — Migración 012: datos de perfil para marketing segmentado
-- Fuente: pedido explícito del fundador — más detalle del Cliente para
-- sugerencias de Marketplace y campañas futuras, sin bloquear el uso de la
-- app (el checkbox de marketing y fecha_nacimiento ya existían desde 002;
-- solo faltaba un lugar para los intereses).

alter table public.perfil
  add column if not exists categorias_interes text[] not null default '{}';

comment on column public.perfil.categorias_interes is
  'Verticales de interés del Cliente (mismos valores que negocio.categoria) — para sugerencias de Marketplace y segmentación de campañas. Opcional, incentivado en /perfil.';
