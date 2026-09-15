-- StylerNow — Migración 019: Módulo 2.7 — CRM (dominio completo)
-- Fuente: 03-Business-Rules/07_CRM.md (reglas de negocio y aislamiento),
-- 09-CRM-Intelligence/01_CRM_Complete.md (diseño de producto: lista,
-- detalle, segmentación), 01-PRD/05_KPIs.md (fórmula de LTV).
--
-- El bucket de Storage `crm-fotos` y su RLS YA existían desde la
-- migración 007 (previstos, nunca usados) — esta migración es la primera
-- vez que algo los consume de verdad.
--
-- "Riesgo de abandono" (03-Business-Rules/07_CRM.md) depende de
-- 09-CRM-Intelligence/04_AI_Business.md — IA de Fase 6, fuera de alcance:
-- no se inventa un score falso, la ficha del Cliente lo muestra como "no
-- disponible todavía" en vez de un número inventado.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Notas — texto libre privado del Negocio (nunca visible al Cliente).
-- ════════════════════════════════════════════════════════════════════════

create table public.cliente_nota (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  cliente_id uuid not null references public.perfil(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);
create index cliente_nota_negocio_cliente_idx on public.cliente_nota(negocio_id, cliente_id);

alter table public.cliente_nota enable row level security;

-- 01_Roles.md, sección Clientes (CRM): "Agregar notas" es 🏢 Guardian / 🌐
-- Barbería — nunca visible al propio Cliente (07_CRM.md: "privado, nunca
-- visible al Cliente ni a otros Negocios").
create policy cliente_nota_select_interno on public.cliente_nota for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id) or public.is_supersu());
create policy cliente_nota_insert on public.cliente_nota for insert
  with check ((public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id)) and autor_id = auth.uid());
create policy cliente_nota_delete on public.cliente_nota for delete
  using (autor_id = auth.uid() or public.is_barberia_de(negocio_id));

-- ════════════════════════════════════════════════════════════════════════
-- 2. Etiquetas manuales — las automáticas (ej. "VIP" por LTV) se calculan
--    en cada lectura, nunca se guardan acá (07_CRM.md, caso límite: "no
--    quedan pegadas" tras un reembolso que baja el LTV).
-- ════════════════════════════════════════════════════════════════════════

create table public.cliente_etiqueta (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  cliente_id uuid not null references public.perfil(id) on delete cascade,
  etiqueta text not null,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (negocio_id, cliente_id, etiqueta)
);
create index cliente_etiqueta_negocio_cliente_idx on public.cliente_etiqueta(negocio_id, cliente_id);

alter table public.cliente_etiqueta enable row level security;

create policy cliente_etiqueta_select_interno on public.cliente_etiqueta for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id) or public.is_supersu());
create policy cliente_etiqueta_insert on public.cliente_etiqueta for insert
  with check ((public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id)) and creado_por = auth.uid());
create policy cliente_etiqueta_delete on public.cliente_etiqueta for delete
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id));

-- ════════════════════════════════════════════════════════════════════════
-- 3. Fotos de resultados — metadata sobre el bucket `crm-fotos` ya
--    existente. El `check (consentimiento)` hace imposible insertar una
--    fila sin consentimiento explícito: no es una casilla de UI opcional,
--    es una restricción real de la base (07_CRM.md: "con consentimiento
--    explícito del Cliente capturado en el momento de la carga").
-- ════════════════════════════════════════════════════════════════════════

create table public.reserva_foto (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  cliente_id uuid not null references public.perfil(id) on delete cascade,
  url text not null,
  consentimiento boolean not null,
  subido_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint reserva_foto_requiere_consentimiento check (consentimiento = true)
);
create index reserva_foto_reserva_idx on public.reserva_foto(reserva_id);
create index reserva_foto_cliente_idx on public.reserva_foto(negocio_id, cliente_id);

alter table public.reserva_foto enable row level security;

create policy reserva_foto_select on public.reserva_foto for select
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id) or cliente_id = auth.uid() or public.is_supersu());
create policy reserva_foto_insert on public.reserva_foto for insert
  with check (
    (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id))
    and subido_por = auth.uid()
    and exists (select 1 from public.reserva r where r.id = reserva_id and r.estado = 'COMPLETADA' and r.cliente_id = reserva_foto.cliente_id)
  );
create policy reserva_foto_delete on public.reserva_foto for delete
  using (public.is_barberia_de(negocio_id) or public.is_guardian_de_negocio(negocio_id));

-- ════════════════════════════════════════════════════════════════════════
-- 4. Vista agregada para el listado (foto, nombre, visitas, LTV, última
--    visita) — security_invoker=true: hereda el RLS real de `reserva` y
--    `perfil` (ya existente), no es una puerta de autorización propia.
--    LTV = Ticket promedio × frecuencia anual × 2 (01-PRD/05_KPIs.md,
--    "LTV de Cliente (aproximado)"), calculado UNA sola vez acá — ninguna
--    pantalla lo recalcula distinto.
-- ════════════════════════════════════════════════════════════════════════

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
  )::numeric(12,2) as ltv
from public.reserva r
join public.perfil p on p.id = r.cliente_id
group by r.negocio_id, r.cliente_id, p.nombre, p.avatar_url, p.telefono;

grant select on public.vista_crm_cliente to authenticated;
comment on view public.vista_crm_cliente is
  'Lectura agregada para el Módulo 2.7 (CRM). security_invoker=true: hereda RLS real de reserva/perfil, no es autorización propia.';
