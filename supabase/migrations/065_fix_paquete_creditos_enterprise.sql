-- StylerNow — Migración 065: corrige un bug real encontrado al sembrar
-- datos iniciales del AI OS (la migración de seed original, que nunca
-- llegó a aplicarse por este mismo error, se renombra a 066): la fila
-- "Enterprise" (cotización personalizada, sin créditos fijos) violaba
-- `creditos int not null check (creditos > 0)` de la migración 064 — se
-- relaja a nullable, consistente con `precio_cop` (que ya era nullable
-- para el mismo caso).

alter table public.ai_paquete_creditos alter column creditos drop not null;
alter table public.ai_paquete_creditos drop constraint ai_paquete_creditos_creditos_check;
alter table public.ai_paquete_creditos add constraint ai_paquete_creditos_creditos_check check (creditos is null or creditos > 0);
