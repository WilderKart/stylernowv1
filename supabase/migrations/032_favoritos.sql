-- StylerNow — Migración 032: Fase 5.1 — Favoritos (Marketplace Premium)
-- Fuente: 02-UX/04_Marketplace.md ("Favoritos": el Cliente puede guardar un
-- Negocio para acceso rápido, sin límite de cantidad; persisten entre
-- sesiones). "Compartir" no necesita tabla ni RPC — reutiliza el mismo
-- `slug` ya indexado por SEO, es un link público existente.

create table public.favorito_negocio (
  cliente_id uuid not null references public.perfil(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, negocio_id)
);
create index favorito_negocio_cliente_idx on public.favorito_negocio(cliente_id, created_at desc);

alter table public.favorito_negocio enable row level security;
create policy favorito_negocio_propio on public.favorito_negocio for all
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());
