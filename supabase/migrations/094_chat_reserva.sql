-- 094: Chat por reserva entre cliente y negocio (C04). Mensajes APPEND-ONLY.
-- Participantes: cliente de la reserva + dueno / guardian del negocio / staff asignado a la reserva.
create table public.chat_conversacion (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reserva(id) on delete cascade,
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.chat_mensaje (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.chat_conversacion(id) on delete cascade,
  autor_id uuid not null references public.perfil(id),
  autor_rol text not null check (autor_rol in ('CLIENTE','NEGOCIO')),
  cuerpo text not null check (length(cuerpo) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index chat_mensaje_conv_idx on public.chat_mensaje (conversacion_id, created_at desc);
create index chat_mensaje_autor_idx on public.chat_mensaje (autor_id, created_at desc);
create table public.chat_lectura (
  conversacion_id uuid not null references public.chat_conversacion(id) on delete cascade,
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  leido_hasta timestamptz not null,
  primary key (conversacion_id, usuario_id)
);

-- Rol del usuario actual en la reserva: 'CLIENTE' | 'NEGOCIO' | null (sin acceso).
create or replace function public._chat_rol(p_reserva_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare r public.reserva;
begin
  if auth.uid() is null then return null; end if;
  select * into r from public.reserva where id = p_reserva_id;
  if not found then return null; end if;
  if r.cliente_id = auth.uid() then return 'CLIENTE'; end if;
  if public.is_barberia_de(r.negocio_id) or public.is_guardian_de_negocio(r.negocio_id)
     or r.staff_id = auth.uid() then
    return 'NEGOCIO';
  end if;
  return null;
end $$;
revoke all on function public._chat_rol(uuid) from public, anon, authenticated;
grant execute on function public._chat_rol(uuid) to authenticated, service_role;

alter table public.chat_conversacion enable row level security;
alter table public.chat_mensaje enable row level security;
alter table public.chat_lectura enable row level security;
revoke all on public.chat_conversacion, public.chat_mensaje, public.chat_lectura from public, anon, authenticated;
grant select on public.chat_conversacion, public.chat_mensaje, public.chat_lectura to authenticated;
create policy chat_conversacion_select on public.chat_conversacion
  for select to authenticated using (public._chat_rol(reserva_id) is not null);
create policy chat_mensaje_select on public.chat_mensaje
  for select to authenticated using (exists (
    select 1 from public.chat_conversacion c
    where c.id = chat_mensaje.conversacion_id and public._chat_rol(c.reserva_id) is not null));
create policy chat_lectura_select_propia on public.chat_lectura
  for select to authenticated using (usuario_id = auth.uid());

create or replace function public.chat_mensaje_inmutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then raise exception 'CHAT_INMUTABLE'; end if;
  if pg_trigger_depth() <= 1 then raise exception 'CHAT_INMUTABLE'; end if;
  return old;
end $$;
revoke all on function public.chat_mensaje_inmutable() from public, anon, authenticated;
create trigger chat_mensaje_inmutable_trg before update or delete on public.chat_mensaje
  for each row execute function public.chat_mensaje_inmutable();

create or replace function public.chat_enviar(p_reserva_id uuid, p_cuerpo text)
returns table (id uuid, autor_rol text, es_mio boolean, cuerpo text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_rol text; r public.reserva; v_conv uuid; v_txt text := trim(coalesce(p_cuerpo, ''));
  v_msg public.chat_mensaje; v_neg text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  v_rol := public._chat_rol(p_reserva_id);
  if v_rol is null then raise exception 'NO_AUTORIZADO'; end if;
  if length(v_txt) = 0 then raise exception 'MENSAJE_VACIO'; end if;
  if length(v_txt) > 1000 then raise exception 'MENSAJE_LARGO'; end if;
  select re.* into r from public.reserva re where re.id = p_reserva_id;
  if r.estado in ('CANCELADA','PENDIENTE_PAGO','NO_SHOW')
     or (r.estado = 'COMPLETADA' and r.hora_fin < now() - interval '72 hours') then
    raise exception 'CHAT_CERRADO';
  end if;
  if (select count(*) from public.chat_mensaje m
      where m.autor_id = auth.uid() and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'DEMASIADOS_MENSAJES';
  end if;

  insert into public.chat_conversacion (reserva_id, cliente_id, negocio_id)
  values (r.id, r.cliente_id, r.negocio_id)
  on conflict (reserva_id) do nothing;
  select c.id into v_conv from public.chat_conversacion c where c.reserva_id = r.id;

  insert into public.chat_mensaje (conversacion_id, autor_id, autor_rol, cuerpo)
  values (v_conv, auth.uid(), v_rol, v_txt) returning * into v_msg;

  -- El autor ya leyo hasta aqui.
  insert into public.chat_lectura (conversacion_id, usuario_id, leido_hasta)
  values (v_conv, auth.uid(), v_msg.created_at)
  on conflict (conversacion_id, usuario_id) do update set leido_hasta = excluded.leido_hasta;

  -- Aviso al cliente cuando escribe el negocio (una notificacion sin leer por conversacion).
  if v_rol = 'NEGOCIO' then
    select n.nombre into v_neg from public.negocio n where n.id = r.negocio_id;
    if not exists (select 1 from public.notificacion_usuario nu
                   where nu.usuario_id = r.cliente_id and nu.tipo = 'CHAT_MENSAJE'
                     and nu.reserva_id = r.id and nu.leida_at is null) then
      perform public._notificar(r.cliente_id, 'CHAT_MENSAJE', v_neg || ' te escribió',
        left(v_txt, 140), v_neg || ' sent you a message', left(v_txt, 140), r.id, r.negocio_id, null);
    end if;
  end if;

  return query select v_msg.id, v_msg.autor_rol, true, v_msg.cuerpo, v_msg.created_at;
end $$;
revoke all on function public.chat_enviar(uuid, text) from public, anon, authenticated;
grant execute on function public.chat_enviar(uuid, text) to authenticated;

-- Ultimos p_limite mensajes (orden cronologico ascendente). p_antes pagina hacia atras.
create or replace function public.chat_listar(p_reserva_id uuid, p_limite integer default 50, p_antes timestamptz default null)
returns table (id uuid, autor_rol text, es_mio boolean, cuerpo text, created_at timestamptz, leido_por_otro boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_conv uuid; v_rol text; v_otro_leido timestamptz;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  v_rol := public._chat_rol(p_reserva_id);
  if v_rol is null then raise exception 'NO_AUTORIZADO'; end if;
  select c.id into v_conv from public.chat_conversacion c where c.reserva_id = p_reserva_id;
  if v_conv is null then return; end if;
  -- Lectura del "otro lado": cualquier participante que no sea yo y tenga el rol opuesto.
  select max(l.leido_hasta) into v_otro_leido
  from public.chat_lectura l where l.conversacion_id = v_conv and l.usuario_id <> auth.uid();
  return query
  select x.id, x.autor_rol, x.autor_id = auth.uid(), x.cuerpo, x.created_at,
         (x.autor_id = auth.uid() and v_otro_leido is not null and x.created_at <= v_otro_leido)
  from (
    select m.* from public.chat_mensaje m
    where m.conversacion_id = v_conv and (p_antes is null or m.created_at < p_antes)
    order by m.created_at desc limit least(greatest(coalesce(p_limite, 50), 1), 200)
  ) x order by x.created_at asc;
end $$;
revoke all on function public.chat_listar(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.chat_listar(uuid, integer, timestamptz) to authenticated;

create or replace function public.chat_marcar_leido(p_reserva_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if public._chat_rol(p_reserva_id) is null then raise exception 'NO_AUTORIZADO'; end if;
  select c.id into v_conv from public.chat_conversacion c where c.reserva_id = p_reserva_id;
  if v_conv is null then return false; end if;
  insert into public.chat_lectura (conversacion_id, usuario_id, leido_hasta)
  values (v_conv, auth.uid(), clock_timestamp())
  on conflict (conversacion_id, usuario_id) do update set leido_hasta = excluded.leido_hasta;
  -- marca leidas las notificaciones de chat de esa cita
  update public.notificacion_usuario set leida_at = now()
  where usuario_id = auth.uid() and tipo = 'CHAT_MENSAJE' and reserva_id = p_reserva_id and leida_at is null;
  return true;
end $$;
revoke all on function public.chat_marcar_leido(uuid) from public, anon, authenticated;
grant execute on function public.chat_marcar_leido(uuid) to authenticated;
