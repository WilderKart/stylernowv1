-- PASO 1 de la liberación controlada (EXPANDIR). Solo CREA la función ai_acciones_costo_admin(); no quita ningún permiso ni cambia ninguna tabla.
-- Es idéntica a la que crea la migración 139 (139 usa create or replace: reaplicarla después no cambia nada).
-- Efecto sobre el código actual de producción: ninguno (no lo llama). Efecto sobre el código nuevo: lo habilita.
-- Reversión: drop function if exists public.ai_acciones_costo_admin();
create or replace function public.ai_acciones_costo_admin()
returns setof public.ai_accion_costo
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query select * from public.ai_accion_costo order by categoria, accion;
end $$;
revoke all on function public.ai_acciones_costo_admin() from public, anon;
grant execute on function public.ai_acciones_costo_admin() to authenticated;
