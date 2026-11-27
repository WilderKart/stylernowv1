-- 203: qué negocios (de una lista) están verificados, para mostrar la insignia en las tarjetas del Marketplace.
-- Solo devuelve ids de negocios ACTIVOS con verificación VERIFICADA: el mismo dato público que ya expone negocio_verificado(uuid),
-- sin documentos ni detalles. Tope de 200 ids por llamada.
-- Reversión: drop function public.negocios_verificados(uuid[]);

create or replace function public.negocios_verificados(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select nv.negocio_id
  from public.negocio_verificacion nv
  join public.negocio n on n.id = nv.negocio_id and n.estado = 'ACTIVO'
  where cardinality(p_ids) <= 200 and nv.negocio_id = any(p_ids) and nv.estado = 'VERIFICADA';
$$;
revoke all on function public.negocios_verificados(uuid[]) from public, anon, authenticated;
grant execute on function public.negocios_verificados(uuid[]) to anon, authenticated;
