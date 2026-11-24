-- 185 · Galería del negocio: hasta 5 fotos (la fachada es la principal por defecto), con reemplazo y borrado.
-- Reglas en la base (cero confianza): máximo 5, siempre una visible y principal, solo el propietario escribe.
-- negocio.foto_principal_url se mantiene sincronizada: la siguen leyendo el marketplace y el perfil público.

create table if not exists public.negocio_foto (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  url text not null check (length(url) <= 2000 and url ~ '^https://res.cloudinary.com/[A-Za-z0-9_-]+/'),   -- solo Cloudinary (igual que negocio.foto_principal_url)
  public_id text,                      -- identificador en Cloudinary (para borrar el archivo al eliminar la foto)
  orden smallint not null default 0 check (orden between 0 and 4),
  es_principal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists negocio_foto_negocio_idx on public.negocio_foto (negocio_id, orden);
create unique index if not exists negocio_foto_una_principal on public.negocio_foto (negocio_id) where es_principal;
create unique index if not exists negocio_foto_orden_unico on public.negocio_foto (negocio_id, orden);

alter table public.negocio_foto enable row level security;
revoke all on public.negocio_foto from public, anon, authenticated;
grant select on public.negocio_foto to anon, authenticated;
drop policy if exists negocio_foto_select on public.negocio_foto;
create policy negocio_foto_select on public.negocio_foto for select to anon, authenticated using (
  exists (select 1 from public.negocio n where n.id = negocio_id and (n.estado = 'ACTIVO' or n.owner_user_id = (select auth.uid())))
);

-- Semilla: la fachada actual pasa a ser la foto principal de la galería.
insert into public.negocio_foto (negocio_id, url, public_id, orden, es_principal)
select n.id, n.foto_principal_url,
       case when position('/negocios/' || n.id::text || '/fachada' in n.foto_principal_url) > 0 then 'negocios/' || n.id::text || '/fachada' end,
       0, true
  from public.negocio n
where n.foto_principal_url is not null
  and not exists (select 1 from public.negocio_foto f where f.negocio_id = n.id);

create or replace function public._galeria_sincronizar(p_negocio uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  select url into v_url from public.negocio_foto where negocio_id = p_negocio and es_principal;
  update public.negocio set foto_principal_url = v_url, updated_at = now()
   where id = p_negocio and foto_principal_url is distinct from v_url;
end $$;
revoke all on function public._galeria_sincronizar(uuid) from public, anon, authenticated;

create or replace function public._galeria_exigir_propietario(p_negocio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.negocio n where n.id = p_negocio and n.owner_user_id = auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;
end $$;
revoke all on function public._galeria_exigir_propietario(uuid) from public, anon, authenticated;

-- El archivo debe estar en la carpeta del propio negocio en Cloudinary (nadie apunta a archivos de otro negocio).
create or replace function public._galeria_validar_archivo(p_negocio uuid, p_url text, p_public_id text)
returns void language plpgsql immutable as $$
begin
  if p_public_id is null or position('negocios/' || p_negocio::text || '/' in p_public_id) <> 1
     or position('/' || p_public_id in p_url) = 0 and position(p_public_id in p_url) = 0 then
    raise exception 'ARCHIVO_INVALIDO';
  end if;
end $$;
revoke all on function public._galeria_validar_archivo(uuid, text, text) from public, anon, authenticated;

-- Agrega una foto (máximo 5). La primera que se sube queda como principal.
create or replace function public.galeria_agregar(p_negocio_id uuid, p_url text, p_public_id text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_n int; v_id uuid; v_orden int;
begin
  perform public._galeria_exigir_propietario(p_negocio_id);
  perform public._galeria_validar_archivo(p_negocio_id, p_url, p_public_id);
  perform 1 from public.negocio where id = p_negocio_id for update;
  select count(*) into v_n from public.negocio_foto where negocio_id = p_negocio_id;
  if v_n >= 5 then raise exception 'GALERIA_LLENA'; end if;
  select min(o) into v_orden from generate_series(0, 4) o
   where not exists (select 1 from public.negocio_foto f where f.negocio_id = p_negocio_id and f.orden = o);
  insert into public.negocio_foto (negocio_id, url, public_id, orden, es_principal)
  values (p_negocio_id, p_url, p_public_id, v_orden, v_n = 0) returning id into v_id;
  perform public._galeria_sincronizar(p_negocio_id);
  return v_id;
end $$;

-- Elige cuál foto es la principal (la que ven primero los clientes).
create or replace function public.galeria_marcar_principal(p_foto_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  select negocio_id into v_neg from public.negocio_foto where id = p_foto_id;
  if v_neg is null then raise exception 'FOTO_NO_ENCONTRADA'; end if;
  perform public._galeria_exigir_propietario(v_neg);
  update public.negocio_foto set es_principal = false where negocio_id = v_neg and es_principal and id <> p_foto_id;
  update public.negocio_foto set es_principal = true where id = p_foto_id;
  perform public._galeria_sincronizar(v_neg);
end $$;

-- Reemplaza el archivo de una foto conservando su lugar. Devuelve el public_id anterior para borrarlo en Cloudinary.
create or replace function public.galeria_reemplazar(p_foto_id uuid, p_url text, p_public_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_neg uuid; v_ant text;
begin
  select negocio_id, public_id into v_neg, v_ant from public.negocio_foto where id = p_foto_id;
  if v_neg is null then raise exception 'FOTO_NO_ENCONTRADA'; end if;
  perform public._galeria_exigir_propietario(v_neg);
  perform public._galeria_validar_archivo(v_neg, p_url, p_public_id);
  update public.negocio_foto set url = p_url, public_id = p_public_id where id = p_foto_id;
  perform public._galeria_sincronizar(v_neg);
  return v_ant;
end $$;

-- Elimina una foto. Nunca deja la galería vacía; si era la principal, la siguiente pasa a serlo.
-- Devuelve el public_id para que el servidor borre el archivo en Cloudinary.
create or replace function public.galeria_eliminar(p_foto_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_neg uuid; v_pid text; v_era boolean; v_n int;
begin
  select negocio_id, public_id, es_principal into v_neg, v_pid, v_era from public.negocio_foto where id = p_foto_id;
  if v_neg is null then raise exception 'FOTO_NO_ENCONTRADA'; end if;
  perform public._galeria_exigir_propietario(v_neg);
  perform 1 from public.negocio where id = v_neg for update;
  select count(*) into v_n from public.negocio_foto where negocio_id = v_neg;
  if v_n <= 1 then raise exception 'GALERIA_NO_PUEDE_QUEDAR_VACIA'; end if;
  delete from public.negocio_foto where id = p_foto_id;
  if v_era then
    update public.negocio_foto set es_principal = true
     where id = (select id from public.negocio_foto where negocio_id = v_neg order by orden limit 1);
  end if;
  perform public._galeria_sincronizar(v_neg);
  return v_pid;
end $$;

-- Permisos: las funciones públicas solo para usuarios con sesión (se revocan los tres roles; son independientes).
revoke all on function public.galeria_agregar(uuid, text, text) from public, anon, authenticated;
revoke all on function public.galeria_marcar_principal(uuid) from public, anon, authenticated;
revoke all on function public.galeria_reemplazar(uuid, text, text) from public, anon, authenticated;
revoke all on function public.galeria_eliminar(uuid) from public, anon, authenticated;
grant execute on function public.galeria_agregar(uuid, text, text) to authenticated;
grant execute on function public.galeria_marcar_principal(uuid) to authenticated;
grant execute on function public.galeria_reemplazar(uuid, text, text) to authenticated;
grant execute on function public.galeria_eliminar(uuid) to authenticated;

-- Si la fachada cambia por otra vía (alta del negocio: fijar_foto_principal_negocio), la galería la sigue:
-- la foto principal de la galería toma esa URL (o se crea si aún no existe).
create or replace function public.trg_negocio_foto_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid text; v_orden int;
begin
  if new.foto_principal_url is null then return new; end if;
  if exists (select 1 from public.negocio_foto where negocio_id = new.id and es_principal and url = new.foto_principal_url) then return new; end if;
  v_pid := case when position('/negocios/' || new.id::text || '/fachada' in new.foto_principal_url) > 0 then 'negocios/' || new.id::text || '/fachada' end;
  if exists (select 1 from public.negocio_foto where negocio_id = new.id and es_principal) then
    update public.negocio_foto set url = new.foto_principal_url, public_id = coalesce(v_pid, public_id) where negocio_id = new.id and es_principal;
  else
    select min(o) into v_orden from generate_series(0, 4) o
     where not exists (select 1 from public.negocio_foto f where f.negocio_id = new.id and f.orden = o);
    if v_orden is not null then
      insert into public.negocio_foto (negocio_id, url, public_id, orden, es_principal) values (new.id, new.foto_principal_url, v_pid, v_orden, true);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_negocio_foto_sync on public.negocio;
create trigger trg_negocio_foto_sync after insert or update of foto_principal_url on public.negocio
  for each row execute function public.trg_negocio_foto_sync();
