-- 092: Idioma/region (C11), permisos (C12), registro (C17).
-- Solo es/en y CO/US/MX/ES (Brasil/portugues descartado).
alter table public.perfil
  add column if not exists pais text check (pais in ('CO','US','MX','ES')),
  add column if not exists locale text not null default 'es' check (locale in ('es','en'));

create table public.cliente_preferencia (
  usuario_id uuid primary key references public.perfil(id) on delete cascade,
  permiso_ubicacion text check (permiso_ubicacion in ('PERMITIDO','MAS_TARDE')),
  permiso_notificaciones text check (permiso_notificaciones in ('PERMITIDO','MAS_TARDE')),
  onboarding_completo boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.cliente_preferencia enable row level security;
revoke all on public.cliente_preferencia from public, anon, authenticated;
grant select on public.cliente_preferencia to authenticated;
create policy cliente_preferencia_select_propia on public.cliente_preferencia
  for select to authenticated using (usuario_id = auth.uid());

create or replace function public.actualizar_idioma_region(p_pais text, p_locale text)
returns table (pais text, locale text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_pais is null or upper(p_pais) not in ('CO','US','MX','ES') then raise exception 'PAIS_INVALIDO'; end if;
  if p_locale is null or lower(p_locale) not in ('es','en') then raise exception 'IDIOMA_INVALIDO'; end if;
  update public.perfil set pais = upper(p_pais), locale = lower(p_locale) where id = auth.uid();
  if not found then raise exception 'PERFIL_NO_ENCONTRADO'; end if;
  return query select pf.pais, pf.locale from public.perfil pf where pf.id = auth.uid();
end $$;
revoke all on function public.actualizar_idioma_region(text, text) from public, anon, authenticated;
grant execute on function public.actualizar_idioma_region(text, text) to authenticated;

create or replace function public.guardar_permisos(p_ubicacion text, p_notificaciones text, p_completar boolean default true)
returns public.cliente_preferencia
language plpgsql security definer set search_path = public as $$
declare v public.cliente_preferencia;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_ubicacion is not null and p_ubicacion not in ('PERMITIDO','MAS_TARDE') then raise exception 'PERMISO_INVALIDO'; end if;
  if p_notificaciones is not null and p_notificaciones not in ('PERMITIDO','MAS_TARDE') then raise exception 'PERMISO_INVALIDO'; end if;
  insert into public.cliente_preferencia (usuario_id, permiso_ubicacion, permiso_notificaciones, onboarding_completo)
  values (auth.uid(), p_ubicacion, p_notificaciones, coalesce(p_completar, false))
  on conflict (usuario_id) do update set
    permiso_ubicacion = coalesce(excluded.permiso_ubicacion, public.cliente_preferencia.permiso_ubicacion),
    permiso_notificaciones = coalesce(excluded.permiso_notificaciones, public.cliente_preferencia.permiso_notificaciones),
    onboarding_completo = public.cliente_preferencia.onboarding_completo or excluded.onboarding_completo,
    updated_at = now()
  returning * into v;
  return v;
end $$;
revoke all on function public.guardar_permisos(text, text, boolean) from public, anon, authenticated;
grant execute on function public.guardar_permisos(text, text, boolean) to authenticated;

create or replace function public.obtener_preferencias()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select jsonb_build_object(
    'pais', p.pais, 'locale', p.locale, 'nombre', p.nombre,
    'permiso_ubicacion', cp.permiso_ubicacion,
    'permiso_notificaciones', cp.permiso_notificaciones,
    'onboarding_completo', coalesce(cp.onboarding_completo, false))
  into v from public.perfil p left join public.cliente_preferencia cp on cp.usuario_id = p.id
  where p.id = auth.uid();
  return v;
end $$;
revoke all on function public.obtener_preferencias() from public, anon, authenticated;
grant execute on function public.obtener_preferencias() to authenticated;

-- C17: nombre, pais y casilla opcional de marketing (NUNCA premarcada: sin valor => false).
create or replace function public.completar_registro(
  p_nombre text, p_pais text, p_marketing boolean default false, p_locale text default 'es')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_nombre text := trim(coalesce(p_nombre, '')); t record;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if length(v_nombre) < 2 or length(v_nombre) > 80 then raise exception 'NOMBRE_INVALIDO'; end if;
  if p_pais is null or upper(p_pais) not in ('CO','US','MX','ES') then raise exception 'PAIS_INVALIDO'; end if;
  if p_locale is null or lower(p_locale) not in ('es','en') then raise exception 'IDIOMA_INVALIDO'; end if;
  update public.perfil set nombre = v_nombre, pais = upper(p_pais), locale = lower(p_locale),
         consentimiento_datos_at = coalesce(consentimiento_datos_at, now())
  where id = auth.uid();
  if not found then raise exception 'PERFIL_NO_ENCONTRADO'; end if;
  -- Aceptacion de la ultima version de cada texto legal (Terminos y Politica).
  for t in select distinct on (tipo) id from public.texto_legal order by tipo, version desc loop
    insert into public.aceptacion_legal (usuario_id, texto_legal_id) values (auth.uid(), t.id)
    on conflict do nothing;
  end loop;
  perform public._consentimiento_registrar(auth.uid(), 'marketing_email', coalesce(p_marketing, false), 'registro');
  return jsonb_build_object('ok', true, 'pais', upper(p_pais), 'locale', lower(p_locale));
end $$;
revoke all on function public.completar_registro(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.completar_registro(text, text, boolean, text) to authenticated;
