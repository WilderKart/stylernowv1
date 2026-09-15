-- StylerNow — Migración 020: agrega `primera_visita` a vista_crm_cliente
-- Necesaria para la plantilla de segmento "Primera visita hace 7 días"
-- (09-CRM-Intelligence/01_CRM_Complete.md) — se detectó al construir el
-- constructor de segmentos que la vista de la migración 019 solo tenía la
-- ÚLTIMA visita, no la primera.

create or replace view public.vista_crm_cliente
with (security_invoker = true) as
select
  r.negocio_id,
  r.cliente_id,
  p.nombre as cliente_nombre,
  p.avatar_url as cliente_foto_url,
  p.telefono as cliente_telefono,
  count(*) filter (where r.estado = 'COMPLETADA') as visitas,
  max(r.hora_inicio) filter (where r.estado = 'COMPLETADA') as ultima_visita,
  coalesce(avg(r.monto_total) filter (where r.estado = 'COMPLETADA'), 0)::numeric(12,2) as ticket_promedio,
  count(*) filter (where r.estado = 'COMPLETADA' and r.hora_inicio > now() - interval '365 days') as visitas_ultimo_anio,
  (
    coalesce(avg(r.monto_total) filter (where r.estado = 'COMPLETADA'), 0)
    * count(*) filter (where r.estado = 'COMPLETADA' and r.hora_inicio > now() - interval '365 days')
    * 2
  )::numeric(12,2) as ltv,
  -- Postgres solo permite AGREGAR columnas al final con CREATE OR REPLACE
  -- VIEW, nunca insertarlas en el medio — de ahí que quede última acá en
  -- vez de junto a `ultima_visita`, donde encajaría mejor semánticamente.
  min(r.hora_inicio) filter (where r.estado = 'COMPLETADA') as primera_visita
from public.reserva r
join public.perfil p on p.id = r.cliente_id
group by r.negocio_id, r.cliente_id, p.nombre, p.avatar_url, p.telefono;

grant select on public.vista_crm_cliente to authenticated;
