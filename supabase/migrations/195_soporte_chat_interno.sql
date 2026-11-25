with matriz(clave, essential, studio, prestige, signature) as (values
  ('soporte_chat', false, true, true, true),
  ('soporte_prioritario', false, false, true, true)
),
filas as (
  select 'ESSENTIAL'::public.plan_codigo as plan_codigo, clave, essential as habilitado from matriz
  union all select 'STUDIO', clave, studio from matriz
  union all select 'PRESTIGE', clave, prestige from matriz
  union all select 'SIGNATURE', clave, signature from matriz
)
insert into public.plan_caracteristica (plan_codigo, clave, habilitado, valor)
select plan_codigo, clave, habilitado, null from filas
on conflict (plan_codigo, clave) do update
  set habilitado = excluded.habilitado, valor = excluded.valor, updated_at = now();

create table if not exists public.soporte_conversacion (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references public.negocio(id) on delete cascade,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA', 'CERRADA')),
  ultimo_mensaje_at timestamptz,
  ultimo_mensaje_preview text,
  no_leidos_admin integer not null default 0 check (no_leidos_admin >= 0),
  no_leidos_negocio integer not null default 0 check (no_leidos_negocio >= 0),
  ultima_alerta_admin_at timestamptz,
  ultima_alerta_negocio_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.soporte_mensaje (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.soporte_conversacion(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  remitente_rol text not null check (remitente_rol in ('BARBERIA', 'SUPERSU')),
  remitente_id uuid not null references auth.users(id),
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 2000),
  leido_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists soporte_mensaje_conversacion_created_idx
  on public.soporte_mensaje (conversacion_id, created_at desc);
create index if not exists soporte_conversacion_admin_idx
  on public.soporte_conversacion (no_leidos_admin, ultimo_mensaje_at desc);

create or replace function public._soporte_plan_incluye(p_negocio_id uuid, p_clave text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select pc.habilitado
      from public.plan_caracteristica pc
      where pc.plan_codigo = coalesce(
        (select s.plan_codigo from public.suscripcion s where s.negocio_id = p_negocio_id limit 1),
        (select n.plan_codigo from public.negocio n where n.id = p_negocio_id)
      )
      and pc.clave = p_clave
    ),
    false
  );
$$;

create or replace function public._soporte_rol(p_negocio_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  if coalesce(public.is_supersu(), false) then return 'SUPERSU'; end if;
  if coalesce(public.is_barberia_de(p_negocio_id), false) then return 'BARBERIA'; end if;
  return null;
end;
$$;

alter table public.soporte_conversacion enable row level security;
alter table public.soporte_mensaje enable row level security;
revoke all on public.soporte_conversacion, public.soporte_mensaje from public, anon, authenticated;
grant select on public.soporte_conversacion, public.soporte_mensaje to authenticated;

drop policy if exists soporte_conversacion_select on public.soporte_conversacion;
create policy soporte_conversacion_select on public.soporte_conversacion
  for select to authenticated using (
    coalesce(public.is_supersu(), false)
    or (
      coalesce(public.is_barberia_de(negocio_id), false)
      and public.negocio_tiene_funcion(negocio_id, 'soporte_chat')
    )
  );

drop policy if exists soporte_mensaje_select on public.soporte_mensaje;
create policy soporte_mensaje_select on public.soporte_mensaje
  for select to authenticated using (
    exists (
      select 1 from public.soporte_conversacion c
      where c.id = soporte_mensaje.conversacion_id
        and (
          coalesce(public.is_supersu(), false)
          or (
            coalesce(public.is_barberia_de(c.negocio_id), false)
            and public.negocio_tiene_funcion(c.negocio_id, 'soporte_chat')
          )
        )
    )
  );

create or replace function public.soporte_enviar_mensaje(p_negocio_id uuid, p_cuerpo text)
returns table (
  id uuid,
  conversacion_id uuid,
  negocio_id uuid,
  remitente_rol text,
  cuerpo text,
  created_at timestamptz,
  alerta_webhook boolean,
  alerta_email_admin boolean,
  alerta_email_negocio boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_cuerpo text := btrim(coalesce(p_cuerpo, ''));
  v_preview text;
  v_ahora timestamptz := clock_timestamp();
  v_conv public.soporte_conversacion;
  v_msg public.soporte_mensaje;
  v_webhook boolean := false;
  v_email_admin boolean := false;
  v_email_negocio boolean := false;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_negocio_id is null or not exists (select 1 from public.negocio n where n.id = p_negocio_id) then
    raise exception 'NEGOCIO_NO_ENCONTRADO';
  end if;

  if coalesce(public.is_supersu(), false) then
    v_rol := 'SUPERSU';
  elsif coalesce(public.is_barberia_de(p_negocio_id), false) then
    if not public._soporte_plan_incluye(p_negocio_id, 'soporte_chat') then
      raise exception 'FUNCION_NO_INCLUIDA';
    end if;
    v_rol := 'BARBERIA';
  else
    raise exception 'NO_AUTORIZADO';
  end if;

  if length(v_cuerpo) = 0 then raise exception 'MENSAJE_REQUERIDO'; end if;
  if length(v_cuerpo) > 2000 then raise exception 'MENSAJE_LARGO'; end if;
  v_preview := left(regexp_replace(v_cuerpo, '\s+', ' ', 'g'), 160);

  insert into public.soporte_conversacion (negocio_id)
  values (p_negocio_id)
  on conflict on constraint soporte_conversacion_negocio_id_key do nothing;

  select * into v_conv
  from public.soporte_conversacion c
  where c.negocio_id = p_negocio_id
  for update;

  insert into public.soporte_mensaje (conversacion_id, negocio_id, remitente_rol, remitente_id, cuerpo)
  values (v_conv.id, p_negocio_id, v_rol, auth.uid(), v_cuerpo)
  returning * into v_msg;

  if v_rol = 'BARBERIA' then
    v_webhook := true;
    v_email_admin := v_conv.ultima_alerta_admin_at is null
      or v_conv.ultima_alerta_admin_at <= v_ahora - interval '10 minutes';
  else
    v_email_negocio := v_conv.ultima_alerta_negocio_at is null
      or v_conv.ultima_alerta_negocio_at <= v_ahora - interval '10 minutes';
  end if;

  update public.soporte_conversacion c
  set ultimo_mensaje_at = v_ahora,
      ultimo_mensaje_preview = v_preview,
      no_leidos_admin = c.no_leidos_admin + case when v_rol = 'BARBERIA' then 1 else 0 end,
      no_leidos_negocio = c.no_leidos_negocio + case when v_rol = 'SUPERSU' then 1 else 0 end,
      ultima_alerta_admin_at = case when v_email_admin then v_ahora else c.ultima_alerta_admin_at end,
      ultima_alerta_negocio_at = case when v_email_negocio then v_ahora else c.ultima_alerta_negocio_at end
  where c.id = v_conv.id;

  perform public._auditar(
    'soporte_mensaje', v_msg.id, 'SOPORTE_MENSAJE_ENVIADO', p_negocio_id,
    null,
    jsonb_build_object('conversacion_id', v_conv.id, 'remitente_rol', v_rol, 'longitud', length(v_cuerpo)),
    null
  );

  return query select v_msg.id, v_conv.id, p_negocio_id, v_rol, v_cuerpo, v_msg.created_at,
    v_webhook, v_email_admin, v_email_negocio;
end;
$$;

create or replace function public.soporte_marcar_leido(p_conversacion_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_conv public.soporte_conversacion;
  v_rol text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_conversacion_id is null then raise exception 'CONVERSACION_NO_ENCONTRADA'; end if;

  select * into v_conv
  from public.soporte_conversacion c
  where c.id = p_conversacion_id
  for update;
  if not found then raise exception 'CONVERSACION_NO_ENCONTRADA'; end if;

  v_rol := public._soporte_rol(v_conv.negocio_id);
  if v_rol is null then raise exception 'NO_AUTORIZADO'; end if;
  if v_rol = 'BARBERIA' and not public._soporte_plan_incluye(v_conv.negocio_id, 'soporte_chat') then
    raise exception 'FUNCION_NO_INCLUIDA';
  end if;

  if v_rol = 'SUPERSU' then
    update public.soporte_conversacion c
    set no_leidos_admin = 0
    where c.id = p_conversacion_id;
    update public.soporte_mensaje m
    set leido_at = now()
    where m.conversacion_id = p_conversacion_id and m.remitente_rol = 'BARBERIA' and m.leido_at is null;
  else
    update public.soporte_conversacion c
    set no_leidos_negocio = 0
    where c.id = p_conversacion_id;
    update public.soporte_mensaje m
    set leido_at = now()
    where m.conversacion_id = p_conversacion_id and m.remitente_rol = 'SUPERSU' and m.leido_at is null;
  end if;

  perform public._auditar(
    'soporte_conversacion', p_conversacion_id, 'SOPORTE_MARCADO_LEIDO', v_conv.negocio_id,
    jsonb_build_object('rol', v_rol), null, null
  );
  return true;
end;
$$;

create or replace function public.soporte_cambiar_estado(p_conversacion_id uuid, p_estado text)
returns public.soporte_conversacion
language plpgsql security definer set search_path = public as $$
declare
  v_conv public.soporte_conversacion;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_estado not in ('ABIERTA', 'CERRADA') then raise exception 'ESTADO_INVALIDO'; end if;

  select * into v_conv
  from public.soporte_conversacion c
  where c.id = p_conversacion_id
  for update;
  if not found then raise exception 'CONVERSACION_NO_ENCONTRADA'; end if;
  if v_conv.estado = p_estado then return v_conv; end if;

  update public.soporte_conversacion c
  set estado = p_estado
  where c.id = p_conversacion_id
  returning * into v_conv;

  perform public._auditar(
    'soporte_conversacion', p_conversacion_id, 'SOPORTE_ESTADO_CAMBIADO', v_conv.negocio_id,
    jsonb_build_object('estado_anterior', case when p_estado = 'CERRADA' then 'ABIERTA' else 'CERRADA' end),
    jsonb_build_object('estado', p_estado),
    null
  );
  return v_conv;
end;
$$;

revoke all on function public._soporte_plan_incluye(uuid, text) from public, anon, authenticated;
revoke all on function public._soporte_rol(uuid) from public, anon, authenticated;
revoke all on function public.soporte_enviar_mensaje(uuid, text) from public, anon, authenticated;
revoke all on function public.soporte_marcar_leido(uuid) from public, anon, authenticated;
revoke all on function public.soporte_cambiar_estado(uuid, text) from public, anon, authenticated;
grant execute on function public.soporte_enviar_mensaje(uuid, text) to authenticated;
grant execute on function public.soporte_marcar_leido(uuid) to authenticated;
grant execute on function public.soporte_cambiar_estado(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'soporte_conversacion'
    ) then
      alter publication supabase_realtime add table public.soporte_conversacion;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'soporte_mensaje'
    ) then
      alter publication supabase_realtime add table public.soporte_mensaje;
    end if;
  end if;
end;
$$;
