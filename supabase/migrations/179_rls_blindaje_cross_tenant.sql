-- 179 — Fase 1 de hardening (SOC 2 CC6.1 / ISO 27001 A.9.4): blindaje cross-tenant.
--
-- Hallazgo CR-1 / SEC-6: `servicio_update_barberia_guardian` (006) autorizaba por
-- `is_barberia_de(negocio_id) or is_guardian_de_negocio(negocio_id)` sin una policy
-- restrictiva que exigiera que la fila NUEVA siguiera en un negocio del actor. Se
-- cierra con el mismo patrón ya usado en la 125 §7 para `sede`.
--
-- Barrido exhaustivo (lo que faltaba): cualquier tabla con columna `negocio_id` que
-- tenga una policy `for update` / `for all` para anon/authenticated podía, en teoría,
-- reasignar la fila a otro tenant si su `using` dependía de columnas inmutables (PK)
-- en vez del propio `negocio_id`. Se agrega un disparador genérico que rechaza
-- cambiar `negocio_id` cuando quien escribe es un usuario anon/authenticated.
--
-- Aditiva y reversible: `drop policy servicio_update_mismo_negocio` + `drop trigger`
-- (o correr `rollback` de esta migración). NO cambia ninguna fila ni dato.
--
-- ════════════════════════════════════════════════════════════════════════════
-- 1 · [CR-1] servicio: el dueño/guardián no puede mover un servicio de negocio
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists servicio_update_mismo_negocio on public.servicio;
create policy servicio_update_mismo_negocio on public.servicio as restrictive for update to anon, authenticated
  using (true)
  with check (
       coalesce(public.is_barberia_de(negocio_id), false)
    or coalesce(public.is_guardian_de_negocio(negocio_id), false)
    or coalesce(public.is_supersu(), false)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · Disparador genérico: `negocio_id` nunca cambia por UPDATE directo del usuario
-- ════════════════════════════════════════════════════════════════════════════
-- Solo actúa cuando `current_user` es anon/authenticated (PostgREST directo). Las
-- funciones SECURITY DEFINER (current_user = dueño) y service_role pasan como siempre,
-- así no se rompe ningún flujo legítimo del motor (reservas, POS, pagos, onboarding).
create or replace function public.proteger_negocio_id_inmutable()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if coalesce(public.is_supersu(), false) then return new; end if;
  if new.negocio_id is distinct from old.negocio_id then
    -- Se usa el SQLSTATE de permiso (42501) para que un intento cross-tenant se comporte
    -- igual que la barrera RLS que ya existía (tests y manejadores de error esperan eso),
    -- conservando un mensaje explícito para la auditoría.
    raise exception 'TENANT_NO_PERMITIDO' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$fn$;
revoke all on function public.proteger_negocio_id_inmutable() from public, anon, authenticated;

-- Se adjunta a cada tabla que (a) tenga `negocio_id` y (b) tenga una policy de
-- UPDATE/ALL alcanzable por anon/authenticated. El conjunto es determinista y se
-- calcula del catálogo, no de una lista a mano que se desactualice.
do $barrido$
declare
  t record;
begin
  for t in
    select distinct c.relname as tabla
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'negocio_id'
                         and a.attnum > 0 and not a.attisdropped
     where n.nspname = 'public' and c.relkind = 'r'
       and exists (
         select 1 from pg_policies p
          where p.schemaname = 'public'
            and p.tablename = c.relname
            and p.cmd in ('UPDATE', 'ALL')
            and ('anon' = any(p.roles) or 'authenticated' = any(p.roles) or 'public' = any(p.roles))
       )
  loop
    execute format('drop trigger if exists trg_negocio_id_inmutable on public.%I', t.tabla);
    execute format(
      'create trigger trg_negocio_id_inmutable before update on public.%I '
      'for each row execute function public.proteger_negocio_id_inmutable()', t.tabla);
  end loop;
end
$barrido$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota de auditoría (no ejecutar aquí): para listar el estado de todas las policies
-- `for update` / `for all` y ver cuáles carecen de `with check`, usar la vista
-- `pg_policies` (columna `with_check`). Un `with_check IS NULL` en un cmd='UPDATE'
-- significa que Postgres reutiliza el `using` sobre la fila nueva — seguro SOLO si
-- ese `using` referencia la columna de tenant mutable. El disparador de arriba hace
-- esa garantía explícita sin depender del contenido de cada policy.
-- Consulta de revisión (ver tests/sql/rls_cross_tenant.sql §0).
-- ─────────────────────────────────────────────────────────────────────────────
