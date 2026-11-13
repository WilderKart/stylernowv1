-- Pruebas de la migración 127 (registro pendiente).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/registro_pendiente_127.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.
-- La prueba con el servicio de Auth real (getUser / app_metadata) se hizo con la API local; ver el informe.

begin;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;
grant update on public.perfil to authenticated;

-- Cuenta nueva (como la crea Supabase Auth al validar el código).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'nuevo@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'viejo@t.l', 'authenticated', 'authenticated');

do $$ begin
  if not (select registro_pendiente from public.perfil where id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 127: una cuenta nueva debe nacer con el registro pendiente';
  end if;
  if (select raw_app_meta_data->>'registro_pendiente' from auth.users where id = '00000000-0000-0000-0000-0000000000a1') <> 'true' then
    raise exception 'FALLA 127: la marca no llegó a app_metadata';
  end if;
  raise notice 'OK 127: cuenta nueva nace pendiente (perfil y app_metadata)';
end $$;

-- El usuario no puede marcarse como registrado por la API.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
update public.perfil set registro_pendiente = false where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
do $$ begin
  if not (select registro_pendiente from public.perfil where id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 127: el usuario se marcó registrado sin crear la cuenta';
  end if;
  raise notice 'OK 127: no se puede saltar el registro editando el perfil';
end $$;

-- Una cuenta pendiente, abandonada y sin datos aparece para limpieza (con fecha vieja).
update public.perfil set created_at = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from public.cuentas_registro_abandonado(24, 50) where usuario_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 127: la cuenta abandonada no aparece para limpieza';
  end if;
  raise notice 'OK 127: cuenta abandonada detectada para limpieza';
end $$;

-- «Crear cuenta» (completar_registro) completa el registro y lo refleja en app_metadata.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.completar_registro('Usuario Nuevo', 'CO', false, 'es');
reset role;
do $$ begin
  if (select registro_pendiente from public.perfil where id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 127: crear cuenta no completó el registro';
  end if;
  if (select raw_app_meta_data->>'registro_pendiente' from auth.users where id = '00000000-0000-0000-0000-0000000000a1') <> 'false' then
    raise exception 'FALLA 127: app_metadata no se actualizó al crear la cuenta';
  end if;
  if exists (select 1 from public.cuentas_registro_abandonado(24, 50) where usuario_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FALLA 127: una cuenta creada aparece para limpieza';
  end if;
  raise notice 'OK 127: crear cuenta completa el registro y la saca de la limpieza';
end $$;

-- Una cuenta con actividad (p. ej. dueña de negocio) nunca se limpia aunque siga pendiente.
update public.perfil set created_at = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000a2';
insert into public.negocio (owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('00000000-0000-0000-0000-0000000000a2', 'N', 'n-127', 'Cali', 'CO');
do $$ begin
  if exists (select 1 from public.cuentas_registro_abandonado(24, 50) where usuario_id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FALLA 127: se marcaría para borrar una cuenta con negocio';
  end if;
  raise notice 'OK 127: cuentas con actividad nunca se limpian';
end $$;

set local role authenticated;
do $$ begin
  begin
    perform public.cuentas_registro_abandonado(24, 50);
    raise exception 'FALLA 127: authenticated ejecuta la limpieza';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 127: la limpieza solo la ejecuta el servidor';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 127 PASARON'; end $$;
rollback;
