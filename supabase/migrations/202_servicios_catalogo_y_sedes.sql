-- 202: catálogo de servicios predeterminados, servicios por sede y fin del borrado físico de servicios.
--
-- · `servicio.catalogo_ref`: de qué servicio del catálogo viene (null = propio). Evita duplicar y permite reactivar.
-- · `servicio_sede`: EXCEPCIONES por sede. Sin fila = el servicio se ofrece en esa sede (compatible con todo lo anterior);
--   fila con activo=false = no se ofrece allí. `slots_disponibles` (y por tanto crear_reserva/crear_reserva_manual) lo respeta.
-- · `servicio_crear_desde_catalogo`: crea el servicio, sus sedes y su equipo en UNA transacción, con imagen del catálogo.
-- · Un servicio NUNCA se borra desde la aplicación: se desactiva (baja lógica). Se retira el DELETE a la API.
-- Reversión: 202_servicios_catalogo_y_sedes_REVERSION.sql.txt

alter table public.servicio add column if not exists catalogo_ref text;
create unique index if not exists servicio_catalogo_unico_activo on public.servicio (negocio_id, catalogo_ref)
  where catalogo_ref is not null and estado = 'ACTIVO';

create table if not exists public.servicio_sede (
  servicio_id uuid not null references public.servicio(id) on delete cascade,
  sede_id uuid not null references public.sede(id) on delete cascade,
  activo boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (servicio_id, sede_id)
);
create index if not exists servicio_sede_sede on public.servicio_sede (sede_id);

alter table public.servicio_sede enable row level security;
revoke all on public.servicio_sede from public, anon, authenticated;
grant select on public.servicio_sede to anon, authenticated;
drop policy if exists servicio_sede_select on public.servicio_sede;
-- Lectura: el equipo del negocio y el público (para ocultar el servicio en la sede), solo de servicios y negocios activos.
create policy servicio_sede_select on public.servicio_sede for select using (
  exists (select 1 from public.servicio sv join public.negocio n on n.id = sv.negocio_id
          where sv.id = servicio_sede.servicio_id
            and ((sv.estado = 'ACTIVO' and n.estado = 'ACTIVO') or public.tiene_acceso_interno(sv.negocio_id) or coalesce(public.is_supersu(), false))));

-- La imagen puede ser una URL absoluta (subida del negocio) o una ruta del catálogo propio de la plataforma (/servicios/…).
alter table public.servicio drop constraint if exists servicio_imagen_url_valida;
alter table public.servicio add constraint servicio_imagen_url_valida check (
  imagen_url is null
  or (imagen_url ~ '^https?://' and length(imagen_url) <= 600)
  or (imagen_url ~ '^/servicios/[a-z]+/[A-Za-z0-9%._()\-]+\.webp$' and length(imagen_url) <= 300));

-- ── Sin borrado físico de servicios ──
drop policy if exists servicio_delete_barberia on public.servicio;
revoke delete on public.servicio from public, anon, authenticated;

-- ── Activar / desactivar un servicio en una sede (la ÚNICA vía de escritura de servicio_sede) ──
create or replace function public.servicio_sede_definir(p_servicio uuid, p_sede uuid, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select sv.negocio_id into v_neg from public.servicio sv where sv.id = p_servicio;
  if v_neg is null then raise exception 'SERVICIO_NO_ENCONTRADO'; end if;
  if not exists (select 1 from public.sede where id = p_sede and negocio_id = v_neg) then raise exception 'SEDE_INVALIDA'; end if;
  if not (public.is_admin_de(v_neg) or public.is_guardian_de_sede(p_sede)) then raise exception 'NO_AUTORIZADO'; end if;
  -- Sin fila = se ofrece. Solo se guarda la excepción.
  if p_activo then
    delete from public.servicio_sede where servicio_id = p_servicio and sede_id = p_sede;
  else
    insert into public.servicio_sede (servicio_id, sede_id, activo) values (p_servicio, p_sede, false)
    on conflict (servicio_id, sede_id) do update set activo = false, updated_at = now();
  end if;
  perform public._auditar('servicio', p_servicio, case when p_activo then 'SERVICIO_ACTIVADO_EN_SEDE' else 'SERVICIO_DESACTIVADO_EN_SEDE' end, v_neg, null,
    jsonb_build_object('sede_id', p_sede), null);
end $$;
revoke all on function public.servicio_sede_definir(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.servicio_sede_definir(uuid, uuid, boolean) to authenticated;

-- ── Crear desde el catálogo ──
create or replace function public.servicio_crear_desde_catalogo(
  p_negocio uuid, p_catalogo_ref text, p_nombre text, p_imagen_url text, p_categoria public.categoria_puntaje,
  p_duracion int, p_precio numeric, p_descripcion text, p_sedes uuid[], p_staff uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_s uuid; v_n text := btrim(coalesce(p_nombre, ''));
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio) then raise exception 'NO_AUTORIZADO'; end if;
  if length(v_n) < 2 or length(v_n) > 80 then raise exception 'NOMBRE_INVALIDO'; end if;
  if p_duracion is null or p_duracion < 5 or p_duracion > 480 then raise exception 'DURACION_INVALIDA'; end if;
  if p_precio is null or p_precio < 0 or p_precio > 100000000 then raise exception 'PRECIO_INVALIDO'; end if;
  -- Solo imágenes del catálogo propio de la plataforma: nunca una URL arbitraria enviada por el navegador.
  if p_imagen_url !~ '^/servicios/[a-z]+/[A-Za-z0-9%._()\-]+\.webp$' then raise exception 'IMAGEN_INVALIDA'; end if;
  if p_catalogo_ref !~ '^[a-z]+/[^/]{1,120}$' then raise exception 'CATALOGO_INVALIDO'; end if;
  if coalesce(array_length(p_sedes, 1), 0) = 0 then raise exception 'ELIGE_AL_MENOS_UNA_SEDE'; end if;
  if exists (select 1 from unnest(p_sedes) x where not exists (select 1 from public.sede where id = x and negocio_id = p_negocio)) then raise exception 'SEDE_INVALIDA'; end if;
  if exists (select 1 from unnest(coalesce(p_staff, '{}'::uuid[])) x where not exists (
      select 1 from public.vinculo_staff_negocio v where v.staff_id = x and v.negocio_id = p_negocio and v.estado = 'ACTIVO' and v.presta_servicios)) then raise exception 'PROFESIONAL_INVALIDO'; end if;
  if exists (select 1 from public.servicio where negocio_id = p_negocio and estado = 'ACTIVO' and (catalogo_ref = p_catalogo_ref or lower(nombre) = lower(v_n))) then raise exception 'SERVICIO_YA_AGREGADO'; end if;

  -- Si ya lo tuvo y lo desactivó, se reactiva (no se duplica ni se pierde su historial).
  select id into v_id from public.servicio where negocio_id = p_negocio and catalogo_ref = p_catalogo_ref and estado = 'INACTIVO' limit 1 for update;
  if v_id is not null then
    update public.servicio set estado = 'ACTIVO', duracion_minutos = p_duracion, precio_base = p_precio, descripcion = nullif(btrim(p_descripcion), ''),
      imagen_url = p_imagen_url, updated_at = now() where id = v_id;
    delete from public.servicio_sede where servicio_id = v_id;
  else
    insert into public.servicio (negocio_id, nombre, descripcion, duracion_minutos, precio_base, categoria_puntaje, imagen_url, catalogo_ref)
    values (p_negocio, v_n, nullif(btrim(p_descripcion), ''), p_duracion, p_precio, p_categoria, p_imagen_url, p_catalogo_ref) returning id into v_id;
  end if;

  -- Sedes: solo las elegidas la ofrecen; las demás quedan con excepción (activo=false).
  for v_s in select id from public.sede where negocio_id = p_negocio and not (id = any(p_sedes)) loop
    insert into public.servicio_sede (servicio_id, sede_id, activo) values (v_id, v_s, false) on conflict do nothing;
  end loop;
  -- Quién lo presta (el motor de reservas exige al menos una persona asignada).
  if coalesce(array_length(p_staff, 1), 0) > 0 then
    insert into public.staff_servicio (staff_id, servicio_id) select x, v_id from unnest(p_staff) x on conflict do nothing;
  end if;
  perform public._auditar('servicio', v_id, 'SERVICIO_AGREGADO_DEL_CATALOGO', p_negocio, null,
    jsonb_build_object('catalogo_ref', p_catalogo_ref, 'precio', p_precio, 'duracion', p_duracion, 'sedes', p_sedes), null);
  return v_id;
end $$;
revoke all on function public.servicio_crear_desde_catalogo(uuid, text, text, text, public.categoria_puntaje, int, numeric, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.servicio_crear_desde_catalogo(uuid, text, text, text, public.categoria_puntaje, int, numeric, text, uuid[], uuid[]) to authenticated;

-- ── El motor de reservas respeta el servicio por sede ──
do $$
declare v_def text; v_nuevo text;
  v_a constant text := E'    and s.negocio_id = v_negocio.id\n    and s.estado = ''ACTIVO'';';
  v_b constant text := E'    and s.negocio_id = v_negocio.id\n    and s.estado = ''ACTIVO''\n    and not exists (select 1 from public.servicio_sede ssd where ssd.servicio_id = s.id and ssd.sede_id = p_sede_id and not ssd.activo);';
begin
  v_def := replace(pg_get_functiondef('public.slots_disponibles(uuid,uuid[],date,uuid,integer)'::regprocedure), E'\r', '');
  if position('servicio_sede' in v_def) = 0 then
    if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA slots_disponibles'; end if;
    v_nuevo := replace(v_def, v_a, v_b);
    execute v_nuevo;
  end if;
end $$;
