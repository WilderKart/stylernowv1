-- 132 · Alinea el repositorio con producción en admin_set_plan_precio (deriva de la 086).
--
-- En producción la función ya tiene `es_desde = coalesce(p_es_desde, es_desde)` para Colombia: si el
-- Super Admin no envía p_es_desde, se conserva el valor actual en vez de dejarlo en NULL. Esa corrección
-- se aplicó directo en producción y nunca llegó a los archivos. Esta migración la trae al repositorio.
-- En producción es un no-op (mismo cuerpo; solo cambian comentarios). Firma y permisos no cambian.
-- PREPARADA Y PROBADA EN LOCAL. Aplicar en producción solo con autorización.

create or replace function public.admin_set_plan_precio(
  p_plan public.plan_codigo, p_pais character, p_precio_mensual numeric, p_es_desde boolean,
  p_precio_staff_extra numeric, p_precio_sede_extra numeric, p_activo boolean)
 returns public.plan_precio
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.plan_precio;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_pais = 'CO' then
    update public.plan set precio_mensual = p_precio_mensual, staff_addon_precio = p_precio_staff_extra,
           sede_addon_precio = p_precio_sede_extra, updated_at = now() where codigo = p_plan;
    update public.plan_precio set es_desde = coalesce(p_es_desde, es_desde), activo = coalesce(p_activo, activo), updated_by = auth.uid()
     where plan_codigo = p_plan and pais_codigo = 'CO' returning * into v;
  else
    insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, es_desde, precio_staff_extra, precio_sede_extra, activo, updated_by)
    values (p_plan, p_pais, p_precio_mensual, coalesce(p_es_desde, false), p_precio_staff_extra, p_precio_sede_extra, coalesce(p_activo, true), auth.uid())
    on conflict (plan_codigo, pais_codigo) do update set
      precio_mensual = excluded.precio_mensual, es_desde = excluded.es_desde, precio_staff_extra = excluded.precio_staff_extra,
      precio_sede_extra = excluded.precio_sede_extra, activo = excluded.activo, updated_at = now(), updated_by = auth.uid()
    returning * into v;
  end if;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id)
  values ('plan_precio', 'PRECIO_ACTUALIZADO_' || p_plan::text || '_' || p_pais, 'SUPERSU', auth.uid());
  return v;
end
$function$;
