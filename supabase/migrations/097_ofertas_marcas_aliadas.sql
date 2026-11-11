-- 097: Ofertas de negocios cercanos y beneficios de marcas aliadas (C10).
-- Los beneficios de marcas solo se muestran con consentimiento vigente 'beneficios_marcas' (091).

create table public.oferta_negocio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  titulo text not null check (length(titulo) between 3 and 80),
  descripcion text check (length(descripcion) <= 300),
  tipo_descuento text not null check (tipo_descuento in ('PORCENTAJE','DOS_POR_UNO','MONTO')),
  valor numeric check (valor is null or valor > 0),
  dias_semana integer[] check (dias_semana is null or dias_semana <@ array[0,1,2,3,4,5,6]),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  check (tipo_descuento = 'DOS_POR_UNO' or valor is not null)
);
create index oferta_negocio_vigentes_idx on public.oferta_negocio (activa, vigente_hasta);
create index oferta_negocio_negocio_idx on public.oferta_negocio (negocio_id);
alter table public.oferta_negocio enable row level security;
revoke all on public.oferta_negocio from public, anon;
grant select, insert, update, delete on public.oferta_negocio to authenticated;
create policy oferta_select on public.oferta_negocio for select to authenticated using (
  (activa and vigente_desde <= current_date and (vigente_hasta is null or vigente_hasta >= current_date)
    and exists (select 1 from public.negocio n where n.id = oferta_negocio.negocio_id and n.estado = 'ACTIVO'))
  or public.tiene_acceso_interno(negocio_id) or public.is_supersu());
create policy oferta_insert_dueno on public.oferta_negocio for insert to authenticated
  with check (public.is_barberia_de(negocio_id));
create policy oferta_update_dueno on public.oferta_negocio for update to authenticated
  using (public.is_barberia_de(negocio_id)) with check (public.is_barberia_de(negocio_id));
create policy oferta_delete_dueno on public.oferta_negocio for delete to authenticated
  using (public.is_barberia_de(negocio_id));

create table public.marca_aliada (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(nombre) between 2 and 80),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.beneficio_marca (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marca_aliada(id) on delete cascade,
  titulo text not null check (length(titulo) between 3 and 80),
  descripcion text check (length(descripcion) <= 300),
  pais text check (pais in ('CO','US','MX','ES')),
  vigente_hasta date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.marca_aliada enable row level security;
alter table public.beneficio_marca enable row level security;
revoke all on public.marca_aliada, public.beneficio_marca from public, anon, authenticated;
grant select, insert, update, delete on public.marca_aliada, public.beneficio_marca to authenticated;
create policy marca_aliada_supersu on public.marca_aliada for all to authenticated
  using (public.is_supersu()) with check (public.is_supersu());
create policy beneficio_marca_supersu on public.beneficio_marca for all to authenticated
  using (public.is_supersu()) with check (public.is_supersu());

create or replace function public.ofertas_cercanas(
  p_lat double precision default null, p_lng double precision default null,
  p_radio_km numeric default 2, p_limite integer default 20)
returns table (oferta_id uuid, negocio_id uuid, negocio_nombre text, slug text, sede_id uuid,
               titulo text, descripcion text, tipo_descuento text, valor numeric,
               dias_semana integer[], vigente_hasta date, distancia_km numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select x.* from (
    select o.id, n.id as nid, n.nombre, n.slug, sd.id as sid, o.titulo, o.descripcion, o.tipo_descuento, o.valor,
           o.dias_semana, o.vigente_hasta,
           case when p_lat is not null and p_lng is not null and sd.latitud is not null then
             round((6371 * acos(greatest(-1, least(1,
               cos(radians(p_lat)) * cos(radians(sd.latitud)) * cos(radians(sd.longitud) - radians(p_lng))
               + sin(radians(p_lat)) * sin(radians(sd.latitud))))))::numeric, 2) end as dist
    from public.oferta_negocio o
    join public.negocio n on n.id = o.negocio_id and n.estado = 'ACTIVO'
    join lateral (select s.* from public.sede s where s.negocio_id = n.id
                  and not s.cerrada_permanente and not s.cerrada_temporalmente
                  order by case when p_lat is not null and s.latitud is not null then
                    (s.latitud - p_lat) ^ 2 + (s.longitud - p_lng) ^ 2 end nulls last, s.es_principal desc limit 1) sd on true
    where o.activa and o.vigente_desde <= current_date and (o.vigente_hasta is null or o.vigente_hasta >= current_date)
  ) x
  where p_lat is null or p_lng is null or x.dist is null or x.dist <= coalesce(p_radio_km, 2)
  order by x.dist nulls last, x.vigente_hasta nulls last
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
end $$;
revoke all on function public.ofertas_cercanas(double precision, double precision, numeric, integer) from public, anon, authenticated;
grant execute on function public.ofertas_cercanas(double precision, double precision, numeric, integer) to authenticated;

-- {activo, total, items[]}: los items solo se devuelven si hay consentimiento vigente.
create or replace function public.beneficios_marcas()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_on boolean; v_pais text; v_total int; v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  v_on := public._consentimiento_vigente(auth.uid(), 'beneficios_marcas');
  select pais into v_pais from public.perfil where id = auth.uid();
  select count(*) into v_total from public.beneficio_marca b join public.marca_aliada m on m.id = b.marca_id
   where b.activo and m.activa and (b.vigente_hasta is null or b.vigente_hasta >= current_date)
     and (b.pais is null or v_pais is null or b.pais = v_pais);
  if v_on then
    select coalesce(jsonb_agg(jsonb_build_object('beneficio_id', b.id, 'marca', m.nombre, 'titulo', b.titulo,
             'descripcion', b.descripcion, 'vigente_hasta', b.vigente_hasta) order by b.created_at desc), '[]'::jsonb)
      into v_items
    from public.beneficio_marca b join public.marca_aliada m on m.id = b.marca_id
    where b.activo and m.activa and (b.vigente_hasta is null or b.vigente_hasta >= current_date)
      and (b.pais is null or v_pais is null or b.pais = v_pais);
  end if;
  return jsonb_build_object('activo', v_on, 'total', v_total, 'items', v_items);
end $$;
revoke all on function public.beneficios_marcas() from public, anon, authenticated;
grant execute on function public.beneficios_marcas() to authenticated;

create or replace function public.beneficios_marcas_consentir(p_otorgado boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_otorgado is null then raise exception 'VALOR_INVALIDO'; end if;
  perform public._consentimiento_registrar(auth.uid(), 'beneficios_marcas', p_otorgado, 'ofertas');
  return public.beneficios_marcas();
end $$;
revoke all on function public.beneficios_marcas_consentir(boolean) from public, anon, authenticated;
grant execute on function public.beneficios_marcas_consentir(boolean) to authenticated;
