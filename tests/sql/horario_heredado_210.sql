-- Prueba de la migración 210: el barbero hereda el horario de la sede donde trabaja.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/horario_heredado_210.sql
-- Transacción que se revierte al final; contra la base LOCAL (con la 210 ya aplicada).
begin;

insert into auth.users (id, email, aud, role) values
  ('21000000-0000-4000-8000-0000000000a1', 'h210_dueno@t.l', 'authenticated', 'authenticated'),
  ('21000000-0000-4000-8000-0000000000a2', 'h210_juan@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('21000000-0000-4000-8000-0000000000a1', 'Dueño'), ('21000000-0000-4000-8000-0000000000a2', 'Juan')
on conflict (id) do nothing;
insert into public.staff (usuario_id, nombre) values ('21000000-0000-4000-8000-0000000000a2', 'Juan');

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('21000000-0000-4000-8000-0000000000b1', '21000000-0000-4000-8000-0000000000a1', 'Neg 210', 'neg-210-test', 'Cali', 'CO');
update public.negocio set estado = 'ACTIVO', min_anticipacion_minutos = 0 where id = '21000000-0000-4000-8000-0000000000b1';

-- Sede A abre lunes a viernes 9–19 (con corte 13–14 los martes); sede B (como Guadalupe) NO abre los viernes.
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base) values
  ('21000000-0000-4000-8000-0000000000c1', '21000000-0000-4000-8000-0000000000b1', 'A', 'Cra 1', 'Cali',
   '{"lun":[["09:00","19:00"]],"mar":[["09:00","13:00"],["14:00","19:00"]],"mie":[["09:00","19:00"]],"jue":[["09:00","19:00"]],"vie":[["09:00","19:00"]]}'),
  ('21000000-0000-4000-8000-0000000000c2', '21000000-0000-4000-8000-0000000000b1', 'B', 'Cra 2', 'Cali',
   '{"lun":[["09:00","19:00"]],"mar":[["09:00","19:00"]],"mie":[["09:00","19:00"]],"jue":[["09:00","19:00"]]}');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '21000000-0000-4000-8000-0000000000b1';
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado)
values ('21000000-0000-4000-8000-0000000000e1', '21000000-0000-4000-8000-0000000000b1', 'Corte', 30, 30000, 'ACTIVO');
insert into public.staff_servicio (staff_id, servicio_id) values ('21000000-0000-4000-8000-0000000000a2', '21000000-0000-4000-8000-0000000000e1');

-- Un barbero es reservable si es «publicable» (foto + autorización, o dentro de la transición); aquí se usa la transición.
update public.configuracion_plataforma set staff_transicion_inicio = now() + interval '1 day', staff_transicion_fin = now() + interval '2 days';

create or replace function pg_temp.dias(p_sede uuid, p_heredado boolean) returns text language sql as $$
  select coalesce(string_agg(dia_semana || ':' || to_char(hora_inicio, 'HH24:MI') || '-' || to_char(hora_fin, 'HH24:MI'), ' ' order by dia_semana), '')
    from public.disponibilidad where vinculo_id = '21000000-0000-4000-8000-0000000000d1' and sede_id = p_sede and heredado = p_heredado
$$;
create or replace function pg_temp.slots(p_sede uuid, p_dow int) returns bigint language sql as $$
  select count(*) from public.slots_disponibles(p_sede, array['21000000-0000-4000-8000-0000000000e1']::uuid[],
    (current_date + ((p_dow - extract(dow from current_date)::int + 7) % 7) + 7), '21000000-0000-4000-8000-0000000000a2', 30) where disponible
$$;

-- 1) Invitado a la sede B: hereda el horario de B (sin viernes).
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, comision_pct, presta_servicios)
values ('21000000-0000-4000-8000-0000000000d1', '21000000-0000-4000-8000-0000000000a2', '21000000-0000-4000-8000-0000000000b1',
        '21000000-0000-4000-8000-0000000000c2', 'ACTIVO', 35, true);
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c2', true) <> '1:09:00-19:00 2:09:00-19:00 3:09:00-19:00 4:09:00-19:00' then
    raise exception 'FALLA 210.1: hereda mal en B: %', pg_temp.dias('21000000-0000-4000-8000-0000000000c2', true);
  end if;
  if pg_temp.slots('21000000-0000-4000-8000-0000000000c2', 5) <> 0 then raise exception 'FALLA 210.1: B no debía ofrecer viernes'; end if;
  if pg_temp.slots('21000000-0000-4000-8000-0000000000c2', 1) = 0 then raise exception 'FALLA 210.1: B debía ofrecer lunes'; end if;
  raise notice 'OK 210.1: invitado a B hereda el horario de B (sin viernes) y ofrece lunes';
end $$;

-- 2) Trasladado a A (como hace trasladar_staff): hereda el de A, con viernes; lo de B desaparece.
update public.vinculo_staff_negocio set sede_activa_id = '21000000-0000-4000-8000-0000000000c1' where id = '21000000-0000-4000-8000-0000000000d1';
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) <> '1:09:00-19:00 2:09:00-19:00 3:09:00-19:00 4:09:00-19:00 5:09:00-19:00' then
    raise exception 'FALLA 210.2: hereda mal en A: %', pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true);
  end if;
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c2', true) <> '' then raise exception 'FALLA 210.2: quedó horario heredado de B'; end if;
  if pg_temp.slots('21000000-0000-4000-8000-0000000000c1', 5) = 0 then raise exception 'FALLA 210.2: A debía ofrecer viernes tras el traslado'; end if;
  -- El corte de los martes (13–14) lo respeta el cruce con la sede aunque el barbero tenga una sola franja.
  if exists (select 1 from public.slots_disponibles('21000000-0000-4000-8000-0000000000c1', array['21000000-0000-4000-8000-0000000000e1']::uuid[],
        (current_date + ((2 - extract(dow from current_date)::int + 7) % 7) + 7), '21000000-0000-4000-8000-0000000000a2', 30)
      where disponible and (hora_inicio at time zone 'America/Bogota')::time >= '13:00' and (hora_inicio at time zone 'America/Bogota')::time < '14:00') then
    raise exception 'FALLA 210.2: ofreció horarios dentro del corte de la sede';
  end if;
  raise notice 'OK 210.2: trasladado a A hereda el horario de A, ofrece viernes y respeta el corte';
end $$;

-- 3) La sede cambia su horario: el barbero que hereda lo sigue (viernes 10–14).
update public.sede set horario_base = jsonb_set(horario_base, '{vie}', '[["10:00","14:00"]]') where id = '21000000-0000-4000-8000-0000000000c1';
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) not like '%5:10:00-14:00' then
    raise exception 'FALLA 210.3: no siguió el cambio de la sede: %', pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true);
  end if;
  raise notice 'OK 210.3: el cambio de horario de la sede llega al barbero que hereda';
end $$;
-- y si la sede abre un día nuevo (sábado), también.
update public.sede set horario_base = jsonb_set(horario_base, '{sab}', '[["08:00","12:00"]]') where id = '21000000-0000-4000-8000-0000000000c1';
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) not like '%6:08:00-12:00' then raise exception 'FALLA 210.3b: no heredó el día nuevo'; end if;
  raise notice 'OK 210.3b: un día nuevo de la sede llega al barbero';
end $$;

-- 4) Horario propio (lo que hace _aplicar_semana al guardar el barbero o la barbería): reemplaza lo heredado y ya no se pisa.
select public._aplicar_semana('21000000-0000-4000-8000-0000000000d1', '21000000-0000-4000-8000-0000000000c1',
  '[{"dia_semana":1,"hora_inicio":"11:00","hora_fin":"15:00"},{"dia_semana":5,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb);
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) <> '' then raise exception 'FALLA 210.4: quedó horario heredado junto al propio'; end if;
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', false) <> '1:11:00-15:00 5:09:00-18:00' then raise exception 'FALLA 210.4: horario propio mal guardado'; end if;
  raise notice 'OK 210.4: el horario propio reemplaza al heredado';
end $$;
update public.sede set horario_base = jsonb_set(horario_base, '{lun}', '[["08:00","20:00"]]') where id = '21000000-0000-4000-8000-0000000000c1';
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', false) <> '1:11:00-15:00 5:09:00-18:00' or pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) <> '' then
    raise exception 'FALLA 210.4b: un cambio de la sede pisó el horario propio';
  end if;
  -- rige el cruce: propio 11–15 ∩ sede 08–20 → lunes 11–15
  raise notice 'OK 210.4b: el horario propio no se pisa cuando la sede cambia';
end $$;

-- 5) Vuelve a B: en B hereda de nuevo; el horario propio de A se conserva.
update public.vinculo_staff_negocio set sede_activa_id = '21000000-0000-4000-8000-0000000000c2' where id = '21000000-0000-4000-8000-0000000000d1';
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c2', true) <> '1:09:00-19:00 2:09:00-19:00 3:09:00-19:00 4:09:00-19:00' then raise exception 'FALLA 210.5: no heredó al volver a B'; end if;
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', false) <> '1:11:00-15:00 5:09:00-18:00' then raise exception 'FALLA 210.5: se perdió el horario propio de A'; end if;
  raise notice 'OK 210.5: al volver a B hereda y el horario propio de A se conserva';
end $$;

-- 6) Sede sin horario cargado = abierta todo el día (como en slots_disponibles).
update public.sede set horario_base = '{}'::jsonb where id = '21000000-0000-4000-8000-0000000000c2';
do $$ begin
  if (select count(*) from public.disponibilidad where vinculo_id = '21000000-0000-4000-8000-0000000000d1' and sede_id = '21000000-0000-4000-8000-0000000000c2' and heredado) <> 7 then
    raise exception 'FALLA 210.6: sede sin horario debía dar 7 días';
  end if;
  raise notice 'OK 210.6: sede sin horario cargado → 7 días';
end $$;

-- 7) Quien no está activo no hereda nada.
update public.vinculo_staff_negocio set estado = 'SUSPENDIDO' where id = '21000000-0000-4000-8000-0000000000d1';
update public.sede set horario_base = '{"lun":[["09:00","12:00"]]}' where id = '21000000-0000-4000-8000-0000000000c2';
do $$ begin
  -- Suspendido: no se vuelve a heredar (las filas anteriores quedan; no se generan nuevas).
  if exists (select 1 from public.disponibilidad where vinculo_id = '21000000-0000-4000-8000-0000000000d1' and sede_id = '21000000-0000-4000-8000-0000000000c2' and heredado and hora_fin = '12:00') then
    raise exception 'FALLA 210.7: un barbero suspendido recibió horario heredado';
  end if;
  raise notice 'OK 210.7: un barbero suspendido no hereda';
end $$;

-- 8) De punta a punta con la función real: la barbería traslada al barbero (como authenticated) y hereda el horario de la nueva sede.
update public.vinculo_staff_negocio set estado = 'ACTIVO' where id = '21000000-0000-4000-8000-0000000000d1';
delete from public.disponibilidad where vinculo_id = '21000000-0000-4000-8000-0000000000d1' and sede_id = '21000000-0000-4000-8000-0000000000c1';
grant select, insert, update, delete on all tables in schema public to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select public.trasladar_staff('21000000-0000-4000-8000-0000000000d1', '21000000-0000-4000-8000-0000000000c1');
reset role;
do $$ begin
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true) not like '1:08:00-20:00%5:10:00-14:00%' then
    raise exception 'FALLA 210.8: trasladar_staff no dejó el horario heredado de A: %', pg_temp.dias('21000000-0000-4000-8000-0000000000c1', true);
  end if;
  if pg_temp.dias('21000000-0000-4000-8000-0000000000c2', true) <> '' then raise exception 'FALLA 210.8: quedó horario heredado de B'; end if;
  raise notice 'OK 210.8: trasladar_staff real (como la barbería) → hereda el horario de la sede nueva';
end $$;

rollback;
