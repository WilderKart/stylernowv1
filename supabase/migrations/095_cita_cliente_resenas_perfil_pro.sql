-- 095: Detalle de cita (C03), "Llegue", calificar visita (C02), perfil publico del profesional (C05).
-- Reprogramar y cancelar REUTILIZAN reprogramar_reserva / cancelar_reserva (ya validan slots, ventanas y roles).

-- Columnas de reserva_foto para My Look (C07): momento de la foto y si el cliente la comparte en el portafolio.
alter table public.reserva_foto
  add column if not exists momento text check (momento in ('ANTES','DESPUES')),
  add column if not exists compartida boolean not null default false,
  add column if not exists compartida_at timestamptz;

create or replace function public.mi_cita_detalle(p_reserva_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.reserva; ng public.negocio; sd public.sede;
  v_sena numeric; v_serv jsonb; v_staff jsonb; v_ya boolean; v_gratis timestamptz; v_reprog timestamptz;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select re.* into r from public.reserva re where re.id = p_reserva_id and re.cliente_id = auth.uid();
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  select n.* into ng from public.negocio n where n.id = r.negocio_id;
  select s.* into sd from public.sede s where s.id = r.sede_id;
  select coalesce(sum(p.monto - coalesce(p.monto_reembolsado, 0)), 0) into v_sena
  from public.pago p where p.reserva_id = r.id and p.tipo = 'SENA' and p.estado in ('APROBADO','REEMBOLSADO_PARCIAL');
  select coalesce(jsonb_agg(jsonb_build_object('servicio_id', s.id, 'nombre', s.nombre,
           'precio', rs.precio_congelado_unitario, 'duracion_minutos', s.duracion_minutos) order by s.nombre), '[]'::jsonb)
    into v_serv
  from public.reserva_servicio rs join public.servicio s on s.id = rs.servicio_id where rs.reserva_id = r.id;
  select jsonb_build_object('staff_id', st.usuario_id, 'nombre', st.nombre, 'foto_url', st.foto_url)
    into v_staff from public.staff st where st.usuario_id = r.staff_id;
  select exists (select 1 from public.resena x where x.reserva_id = r.id) into v_ya;
  v_gratis := r.hora_inicio - make_interval(hours => ng.ventana_reembolso_total_horas);
  v_reprog := r.hora_inicio - make_interval(hours => ng.ventana_reembolso_parcial_horas);
  return jsonb_build_object(
    'reserva_id', r.id,
    'codigo', upper(substr(replace(r.id::text, '-', ''), 1, 6)),
    'estado', r.estado,
    'hora_inicio', r.hora_inicio, 'hora_fin', r.hora_fin,
    'zona_horaria', coalesce(sd.zona_horaria, 'America/Bogota'),
    'servicios', v_serv, 'staff', v_staff,
    'negocio', jsonb_build_object('negocio_id', ng.id, 'nombre', ng.nombre, 'slug', ng.slug,
                                  'telefono', ng.telefono_contacto, 'logo_url', ng.logo_url),
    'sede', jsonb_build_object('sede_id', sd.id, 'nombre', sd.nombre, 'direccion', sd.direccion,
                               'ciudad', sd.ciudad, 'latitud', sd.latitud, 'longitud', sd.longitud),
    'monto_total', r.monto_total, 'monto_sena', r.monto_sena, 'sena_pagada', v_sena,
    'saldo_en_silla', greatest(r.monto_total - v_sena, 0),
    'cancelacion_gratis_hasta', v_gratis, 'reprogramable_hasta', v_reprog,
    'checkin_at', r.checkin_at,
    'puede_cancelar', r.estado in ('PENDIENTE_PAGO','CONFIRMADA'),
    'puede_reprogramar', r.estado = 'CONFIRMADA' and now() <= v_reprog,
    'puede_llegue', r.estado = 'CONFIRMADA' and r.checkin_at is null
                    and now() >= r.hora_inicio - interval '60 minutes' and now() <= r.hora_fin,
    'ya_califico', v_ya,
    'puede_calificar', r.estado = 'COMPLETADA' and not v_ya and r.hora_fin > now() - interval '30 days',
    'chat_habilitado', not (r.estado in ('CANCELADA','PENDIENTE_PAGO','NO_SHOW')
                            or (r.estado = 'COMPLETADA' and r.hora_fin < now() - interval '72 hours'))
  );
end $$;
revoke all on function public.mi_cita_detalle(uuid) from public, anon, authenticated;
grant execute on function public.mi_cita_detalle(uuid) to authenticated;

-- "Llegue": marca check-in del cliente. Si se envian coordenadas, valida que este a <= 0.5 km de la sede.
create or replace function public.marcar_llegada(p_reserva_id uuid, p_lat double precision default null, p_lng double precision default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r public.reserva; sd public.sede; v_dist numeric; v_ts timestamptz;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select re.* into r from public.reserva re where re.id = p_reserva_id and re.cliente_id = auth.uid() for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if r.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_ACTIVA'; end if;
  if r.checkin_at is not null then return r.checkin_at; end if;
  if now() < r.hora_inicio - interval '60 minutes' or now() > r.hora_fin then raise exception 'FUERA_DE_HORARIO'; end if;
  if p_lat is not null and p_lng is not null then
    select s.* into sd from public.sede s where s.id = r.sede_id;
    if sd.latitud is not null and sd.longitud is not null then
      v_dist := 6371 * acos(greatest(-1, least(1,
        cos(radians(p_lat)) * cos(radians(sd.latitud)) * cos(radians(sd.longitud) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(sd.latitud)))));
      if v_dist > 0.5 then raise exception 'FUERA_DEL_LOCAL'; end if;
    end if;
  end if;
  update public.reserva set checkin_at = now(), updated_at = now() where id = r.id returning checkin_at into v_ts;
  return v_ts;
end $$;
revoke all on function public.marcar_llegada(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.marcar_llegada(uuid, double precision, double precision) to authenticated;

-- Hardening del INSERT directo existente (policy resena_insert_cliente no valida negocio/staff):
-- negocio_id, staff_id y cliente_id siempre salen de la reserva.
create or replace function public.resena_forzar_origen()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.reserva;
begin
  select re.* into r from public.reserva re where re.id = new.reserva_id;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  new.negocio_id := r.negocio_id;
  new.staff_id := r.staff_id;
  new.cliente_id := r.cliente_id;
  return new;
end $$;
revoke all on function public.resena_forzar_origen() from public, anon, authenticated;
create trigger resena_forzar_origen_trg before insert on public.resena
  for each row execute function public.resena_forzar_origen();

create or replace function public.calificar_visita(p_reserva_id uuid, p_calificacion integer, p_comentario text default null)
returns public.resena language plpgsql security definer set search_path = public as $$
declare r public.reserva; v_res public.resena; v_txt text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_calificacion is null or p_calificacion < 1 or p_calificacion > 5 then raise exception 'CALIFICACION_INVALIDA'; end if;
  if v_txt is not null and length(v_txt) > 500 then raise exception 'COMENTARIO_LARGO'; end if;
  select re.* into r from public.reserva re where re.id = p_reserva_id and re.cliente_id = auth.uid();
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if r.estado <> 'COMPLETADA' then raise exception 'RESERVA_NO_COMPLETADA'; end if;
  if r.hora_fin < now() - interval '30 days' then raise exception 'FUERA_DE_PLAZO_RESENA'; end if;
  if exists (select 1 from public.resena x where x.reserva_id = r.id) then raise exception 'YA_CALIFICADA'; end if;
  insert into public.resena (reserva_id, cliente_id, negocio_id, staff_id, calificacion, comentario)
  values (r.id, auth.uid(), r.negocio_id, r.staff_id, p_calificacion, v_txt)
  returning * into v_res;
  return v_res;
end $$;
revoke all on function public.calificar_visita(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.calificar_visita(uuid, integer, text) to authenticated;

-- Perfil publico del profesional (C05). Portafolio: solo fotos que el cliente decidio compartir (My Look).
create or replace function public.staff_perfil_publico(p_negocio_id uuid, p_staff_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; vin public.vinculo_staff_negocio; ng public.negocio; st public.staff;
  v_nivel text; v_nota numeric; v_total bigint; v_dist jsonb; v_cortes bigint; v_precio numeric; v_port jsonb;
begin
  select n.* into ng from public.negocio n where n.id = p_negocio_id and n.estado = 'ACTIVO';
  if not found then return null; end if;
  select vv.* into vin from public.vinculo_staff_negocio vv
   where vv.negocio_id = p_negocio_id and vv.staff_id = p_staff_id and vv.estado = 'ACTIVO';
  if not found then return null; end if;
  select s.* into st from public.staff s where s.usuario_id = p_staff_id;
  if not found then return null; end if;
  select nc.nivel::text into v_nivel from public.nivel_staff_consolidado nc
    join public.temporada t on t.id = nc.temporada_id where nc.vinculo_id = vin.id order by t.fecha_fin desc limit 1;
  select round(avg(x.calificacion)::numeric, 2), count(*) into v_nota, v_total
    from public.resena x where x.negocio_id = p_negocio_id and x.staff_id = p_staff_id and x.estado = 'VISIBLE';
  select jsonb_object_agg(g.n::text, coalesce(c.k, 0)) into v_dist
    from generate_series(1, 5) g(n)
    left join (select x.calificacion, count(*) k from public.resena x
               where x.negocio_id = p_negocio_id and x.staff_id = p_staff_id and x.estado = 'VISIBLE'
               group by x.calificacion) c on c.calificacion = g.n;
  select count(*) into v_cortes from public.reserva re
    where re.negocio_id = p_negocio_id and re.staff_id = p_staff_id and re.estado = 'COMPLETADA';
  select min(sv.precio_base) into v_precio from public.servicio sv
    where sv.negocio_id = p_negocio_id and sv.estado = 'ACTIVO'
      and (not exists (select 1 from public.staff_servicio ss0 where ss0.staff_id = p_staff_id)
           or sv.id in (select ss.servicio_id from public.staff_servicio ss where ss.staff_id = p_staff_id));
  select coalesce(jsonb_agg(jsonb_build_object('foto_id', f.id, 'url', f.url, 'momento', f.momento)
                            order by f.compartida_at desc), '[]'::jsonb) into v_port
    from (select rf.* from public.reserva_foto rf join public.reserva re on re.id = rf.reserva_id
          where re.staff_id = p_staff_id and rf.negocio_id = p_negocio_id and rf.compartida
          order by rf.compartida_at desc limit 24) f;
  return jsonb_build_object(
    'staff_id', st.usuario_id, 'nombre', st.nombre, 'foto_url', st.foto_url,
    'especialidad', st.especialidad, 'bio', st.bio, 'nivel', v_nivel,
    'negocio', jsonb_build_object('negocio_id', ng.id, 'nombre', ng.nombre, 'slug', ng.slug, 'ciudad', ng.ciudad),
    'cortes', v_cortes,
    'anios', greatest(0, extract(year from age(now(), coalesce(vin.fecha_ingreso, vin.created_at)))::int),
    'nota', v_nota, 'total_resenas', v_total, 'distribucion', v_dist,
    'precio_desde', v_precio, 'portafolio', v_port);
end $$;
revoke all on function public.staff_perfil_publico(uuid, uuid) from public, anon, authenticated;
grant execute on function public.staff_perfil_publico(uuid, uuid) to anon, authenticated;

create or replace function public.staff_resenas_publicas(p_negocio_id uuid, p_staff_id uuid, p_limite integer default 10, p_offset integer default 0)
returns table (id uuid, calificacion integer, comentario text, respuesta_negocio text,
               created_at timestamptz, cliente_nombre text, servicios text)
language sql stable security definer set search_path = public as $$
  select r.id, r.calificacion, r.comentario, r.respuesta_negocio, r.created_at,
         case when p.nombre is null or p.nombre = 'Cliente anónimo' then 'Cliente anónimo'
              else split_part(p.nombre, ' ', 1)
                   || case when split_part(p.nombre, ' ', 2) <> '' then ' ' || upper(left(split_part(p.nombre, ' ', 2), 1)) || '.' else '' end
         end,
         (select string_agg(s.nombre, ' + ' order by s.nombre) from public.reserva_servicio rs
            join public.servicio s on s.id = rs.servicio_id where rs.reserva_id = r.reserva_id)
  from public.resena r
  join public.negocio n on n.id = r.negocio_id and n.estado = 'ACTIVO'
  left join public.perfil p on p.id = r.cliente_id
  where r.negocio_id = p_negocio_id and r.staff_id = p_staff_id and r.estado = 'VISIBLE'
  order by r.created_at desc
  limit least(greatest(coalesce(p_limite, 10), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.staff_resenas_publicas(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.staff_resenas_publicas(uuid, uuid, integer, integer) to anon, authenticated;
