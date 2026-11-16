-- PASO 1 · EXPANDIR: crear la función ai_acciones_costo_admin(). No quita permisos ni toca tablas ni filas.
-- CÓMO USARLO (Supabase → SQL Editor): ejecuta los TRES bloques por separado y en orden, seleccionando el texto de cada bloque y pulsando «Run» (no uses «Run» sin selección: correría todo junto).
--   BLOQUE A (solo lectura): verificación previa. Compara con «ESPERADO». Si no coincide, NO continúes y avísame.
--   BLOQUE B: aplica el cambio dentro de begin/commit (si algo falla, no queda nada a medias).
--   BLOQUE C (solo lectura): verificación posterior. Compara con «ESPERADO».
-- Antes del primer paso ya debes haber ejecutado y GUARDADO captura_estado_previo.sql. La captura NO sustituye un respaldo completo de producción.
-- Reversión: drop function if exists public.ai_acciones_costo_admin();  (solo si el código nuevo AÚN no está desplegado)

-- ===================== BLOQUE A · verificación previa (solo lectura) =====================
select to_regprocedure('public.ai_acciones_costo_admin()') is null as la_funcion_aun_no_existe;
-- ESPERADO: la_funcion_aun_no_existe = true   (si ya existe = false, avísame antes de seguir)

-- ===================== BLOQUE B · aplicar (contenido EXACTO de 01_cuerpo.sql) =====================
begin;
-- (paso 1) Crea ai_acciones_costo_admin(); idéntica a la de la migración 139 (que usa create or replace, así que reaplicarla luego no cambia nada).
create or replace function public.ai_acciones_costo_admin()
returns setof public.ai_accion_costo
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query select * from public.ai_accion_costo order by categoria, accion;
end $$;
revoke all on function public.ai_acciones_costo_admin() from public, anon;
grant execute on function public.ai_acciones_costo_admin() to authenticated;
commit;

-- ===================== BLOQUE C · verificación posterior (solo lectura) =====================
select
  to_regprocedure('public.ai_acciones_costo_admin()') is not null as existe,
  has_function_privilege('authenticated', 'public.ai_acciones_costo_admin()', 'EXECUTE') as authenticated_la_ejecuta,
  not has_function_privilege('anon', 'public.ai_acciones_costo_admin()', 'EXECUTE') as anon_no_la_ejecuta,
  not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.ai_acciones_costo_admin()'::regprocedure and a.grantee = 0) as public_no_la_ejecuta,
  (select count(*) from public.ai_accion_costo) as filas_ai_accion_costo_intactas;
-- ESPERADO: las cuatro primeras columnas = true; filas_ai_accion_costo_intactas = el mismo número que tenías en la sección G de la captura.
