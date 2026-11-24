-- 191 · (P1-7) CRM: todos los filtros en una sola consulta SQL, con paginación real y total.
--
-- Antes: sede, etiqueta y consentimiento se resolvían como listas de ids con .limit(5000), se intersecaban en JS y se pasaban
-- con .in(...): con más de 5000 filas se perdían resultados (y la URL con miles de ids no cabe). Además el consentimiento se
-- leía de TODOS los perfiles, no de los clientes del negocio.
-- Ahora: SECURITY INVOKER (RLS del usuario intacta) sobre vista_crm_cliente, que ya está acotada por negocio_id.
-- Los patrones de búsqueda llegan ya armados (sin tildes) desde la app.

create or replace function public.crm_clientes_filtrados(
  p_negocio_id uuid,
  p_sede_id uuid default null,
  p_etiqueta text default null,
  p_solo_consentimiento boolean default false,
  p_patron_nombre text default null,
  p_patron_telefono text default null,
  p_ltv_min numeric default null,
  p_ltv_max numeric default null,
  p_ultima_despues timestamptz default null,
  p_ultima_antes timestamptz default null,
  p_primera_despues timestamptz default null,
  p_primera_antes timestamptz default null,
  p_orden text default 'nombre',
  p_offset int default 0,
  p_limite int default 20
)
returns table (fila jsonb, total bigint)
language sql stable security invoker set search_path = public as $$
  select to_jsonb(v), count(*) over ()
  from public.vista_crm_cliente v
  where v.negocio_id = p_negocio_id
    and (p_sede_id is null or exists (
      select 1 from public.reserva r where r.negocio_id = p_negocio_id and r.cliente_id = v.cliente_id and r.sede_id = p_sede_id))
    and (p_etiqueta is null or exists (
      select 1 from public.cliente_etiqueta e where e.negocio_id = p_negocio_id and e.cliente_id = v.cliente_id and e.etiqueta = p_etiqueta))
    and (not coalesce(p_solo_consentimiento, false) or exists (
      select 1 from public.perfil p where p.id = v.cliente_id and p.consentimiento_marketing is true))
    and ((p_patron_nombre is null and p_patron_telefono is null)
         or v.cliente_nombre ilike p_patron_nombre or v.cliente_telefono ilike p_patron_telefono)
    and (p_ltv_min is null or v.ltv >= p_ltv_min)
    and (p_ltv_max is null or v.ltv <= p_ltv_max)
    and (p_ultima_despues is null or v.ultima_visita >= p_ultima_despues)
    and (p_ultima_antes is null or v.ultima_visita <= p_ultima_antes)
    and (p_primera_despues is null or v.primera_visita >= p_primera_despues)
    and (p_primera_antes is null or v.primera_visita <= p_primera_antes)
  order by
    case when p_orden = 'visitas_desc' then v.visitas end desc,
    case when p_orden = 'ltv_desc' then v.ltv end desc,
    case when p_orden = 'ultima_visita_desc' then v.ultima_visita end desc nulls last,
    v.cliente_nombre asc, v.cliente_id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limite, 20), 1), 5000);
$$;
revoke all on function public.crm_clientes_filtrados(uuid, uuid, text, boolean, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, text, int, int) from public, anon, authenticated;
grant execute on function public.crm_clientes_filtrados(uuid, uuid, text, boolean, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, text, int, int) to authenticated;
