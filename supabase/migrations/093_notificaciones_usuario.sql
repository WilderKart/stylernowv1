-- 093: Notificaciones in-app del cliente (C01). notificacion_envio sigue siendo el log de entregas externas.
create table public.notificacion_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  tipo text not null check (tipo in ('CITA_CONFIRMADA','CITA_CANCELADA','CITA_REPROGRAMADA',
    'CITA_RECORDATORIO','CALIFICAR_VISITA','CHAT_MENSAJE','OFERTA','SISTEMA')),
  titulo text not null,
  cuerpo text not null,
  reserva_id uuid references public.reserva(id) on delete set null,
  negocio_id uuid references public.negocio(id) on delete set null,
  dedupe_key text,
  leida_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create unique index notificacion_usuario_dedupe_uq on public.notificacion_usuario (usuario_id, dedupe_key)
  where dedupe_key is not null;
create index notificacion_usuario_lista_idx on public.notificacion_usuario (usuario_id, created_at desc);

alter table public.notificacion_usuario enable row level security;
revoke all on public.notificacion_usuario from public, anon, authenticated;
grant select on public.notificacion_usuario to authenticated;
create policy notificacion_usuario_select_propia on public.notificacion_usuario
  for select to authenticated using (usuario_id = auth.uid());

-- Interna: crea la notificacion en el idioma del destinatario. Nunca lanza (no rompe el flujo origen).
create or replace function public._notificar(
  p_usuario uuid, p_tipo text, p_titulo_es text, p_cuerpo_es text, p_titulo_en text, p_cuerpo_en text,
  p_reserva uuid default null, p_negocio uuid default null, p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_loc text;
begin
  select locale into v_loc from public.perfil where id = p_usuario;
  if not found then return; end if;
  insert into public.notificacion_usuario (usuario_id, tipo, titulo, cuerpo, reserva_id, negocio_id, dedupe_key)
  values (p_usuario, p_tipo,
          case when v_loc = 'en' then coalesce(p_titulo_en, p_titulo_es) else p_titulo_es end,
          case when v_loc = 'en' then coalesce(p_cuerpo_en, p_cuerpo_es) else p_cuerpo_es end,
          p_reserva, p_negocio, p_dedupe)
  on conflict do nothing;
exception when others then
  null;
end $$;
revoke all on function public._notificar(uuid, text, text, text, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public._notificar(uuid, text, text, text, text, text, uuid, uuid, text) to service_role;

-- Genera notificaciones desde eventos reales de reserva. Defensivo: jamas rompe crear/cancelar/reprogramar.
create or replace function public.trg_reserva_notificar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_neg text; v_tz text; v_cuando text;
begin
  begin
    select n.nombre into v_neg from public.negocio n where n.id = new.negocio_id;
    select coalesce(s.zona_horaria, 'America/Bogota') into v_tz from public.sede s where s.id = new.sede_id;
    v_cuando := to_char(new.hora_inicio at time zone coalesce(v_tz, 'America/Bogota'), 'DD/MM HH24:MI');

    if tg_op = 'INSERT' then
      if new.estado = 'CONFIRMADA' then
        perform public._notificar(new.cliente_id, 'CITA_CONFIRMADA', 'Cita confirmada',
          v_neg || ' · ' || v_cuando, 'Appointment confirmed', v_neg || ' · ' || v_cuando,
          new.id, new.negocio_id, 'confirmada:' || new.id);
      end if;
    else
      if new.estado is distinct from old.estado then
        if new.estado = 'CONFIRMADA' then
          perform public._notificar(new.cliente_id, 'CITA_CONFIRMADA', 'Cita confirmada',
            v_neg || ' · ' || v_cuando, 'Appointment confirmed', v_neg || ' · ' || v_cuando,
            new.id, new.negocio_id, 'confirmada:' || new.id);
        elsif new.estado = 'CANCELADA' then
          perform public._notificar(new.cliente_id, 'CITA_CANCELADA', 'Cita cancelada',
            v_neg || ' · ' || v_cuando, 'Appointment cancelled', v_neg || ' · ' || v_cuando,
            new.id, new.negocio_id, 'cancelada:' || new.id);
        elsif new.estado = 'COMPLETADA' then
          perform public._notificar(new.cliente_id, 'CALIFICAR_VISITA', 'Califica tu visita',
            '¿Cómo te fue en ' || v_neg || '? Tu reseña ayuda a otros.',
            'Rate your visit', 'How was ' || v_neg || '? Your review helps others.',
            new.id, new.negocio_id, 'calificar:' || new.id);
        end if;
      elsif new.hora_inicio is distinct from old.hora_inicio and new.estado = 'CONFIRMADA' then
        perform public._notificar(new.cliente_id, 'CITA_REPROGRAMADA', 'Cita reprogramada',
          'Nueva hora: ' || v_cuando || ' · ' || v_neg, 'Appointment rescheduled',
          'New time: ' || v_cuando || ' · ' || v_neg,
          new.id, new.negocio_id, 'reprog:' || new.id || ':' || extract(epoch from new.hora_inicio)::bigint);
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.trg_reserva_notificar() from public, anon, authenticated;
create trigger trg_reserva_notificar_ins after insert on public.reserva
  for each row execute function public.trg_reserva_notificar();
create trigger trg_reserva_notificar_upd after update of estado, hora_inicio on public.reserva
  for each row execute function public.trg_reserva_notificar();

create or replace function public.notificaciones_listar(p_limite integer default 50, p_solo_no_leidas boolean default false)
returns table (id uuid, tipo text, titulo text, cuerpo text, reserva_id uuid, negocio_id uuid,
               leida boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select n.id, n.tipo, n.titulo, n.cuerpo, n.reserva_id, n.negocio_id, n.leida_at is not null, n.created_at
  from public.notificacion_usuario n
  where n.usuario_id = auth.uid() and (not coalesce(p_solo_no_leidas, false) or n.leida_at is null)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limite, 50), 1), 200);
end $$;
revoke all on function public.notificaciones_listar(integer, boolean) from public, anon, authenticated;
grant execute on function public.notificaciones_listar(integer, boolean) to authenticated;

create or replace function public.notificaciones_no_leidas()
returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select count(*) into n from public.notificacion_usuario where usuario_id = auth.uid() and leida_at is null;
  return n;
end $$;
revoke all on function public.notificaciones_no_leidas() from public, anon, authenticated;
grant execute on function public.notificaciones_no_leidas() to authenticated;

create or replace function public.notificacion_marcar_leida(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  update public.notificacion_usuario set leida_at = now()
  where id = p_id and usuario_id = auth.uid() and leida_at is null;
  return found;
end $$;
revoke all on function public.notificacion_marcar_leida(uuid) from public, anon, authenticated;
grant execute on function public.notificacion_marcar_leida(uuid) to authenticated;

create or replace function public.notificaciones_marcar_todas_leidas()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  update public.notificacion_usuario set leida_at = now() where usuario_id = auth.uid() and leida_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.notificaciones_marcar_todas_leidas() from public, anon, authenticated;
grant execute on function public.notificaciones_marcar_todas_leidas() to authenticated;

-- Cron (service_role): recordatorio de citas CONFIRMADAS que empiezan dentro de la ventana. Idempotente.
create or replace function public.generar_recordatorios_cita(p_ventana_horas integer default 24)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v_tz text; v_cuando text;
begin
  for r in
    select re.id, re.cliente_id, re.negocio_id, re.sede_id, re.hora_inicio, ng.nombre as neg
    from public.reserva re join public.negocio ng on ng.id = re.negocio_id
    where re.estado = 'CONFIRMADA' and re.hora_inicio > now()
      and re.hora_inicio <= now() + make_interval(hours => greatest(coalesce(p_ventana_horas, 24), 1))
      and not exists (select 1 from public.notificacion_usuario nu
                      where nu.usuario_id = re.cliente_id and nu.dedupe_key = 'recordatorio:' || re.id)
  loop
    select coalesce(zona_horaria, 'America/Bogota') into v_tz from public.sede where id = r.sede_id;
    v_cuando := to_char(r.hora_inicio at time zone coalesce(v_tz, 'America/Bogota'), 'DD/MM HH24:MI');
    perform public._notificar(r.cliente_id, 'CITA_RECORDATORIO', 'Recordatorio de tu cita',
      r.neg || ' · ' || v_cuando, 'Appointment reminder', r.neg || ' · ' || v_cuando,
      r.id, r.negocio_id, 'recordatorio:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.generar_recordatorios_cita(integer) from public, anon, authenticated;
grant execute on function public.generar_recordatorios_cita(integer) to service_role;
