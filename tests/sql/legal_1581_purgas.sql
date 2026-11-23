-- Pruebas de la migración 183 (retención Ley 1581): purga y anonimización ejecutables.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/legal_1581_purgas.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.

begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'retencion@t.l', 'authenticated', 'authenticated');

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Retencion Test', 'retencion-test', 'Cali'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'Retencion Test 2', 'retencion-test-2', 'Cali');

insert into public.intento_auth (email, tipo, exitoso, created_at) values
  ('viejo@t.l', 'password_login', false, now() - interval '31 days'),
  ('reciente@t.l', 'password_login', true, now());

insert into public.limite_tasa_evento (clave, creado_at) values
  ('vieja', now() - interval '3 days'),
  ('reciente', now());

insert into public.prueba_uso (negocio_id, owner_user_id, telefono_hash, documento_hash, email_hash, dispositivo_hash, ip_hash, equipo_hash, created_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'tel_viejo', 'doc_viejo', 'email_viejo', 'disp_viejo', 'ip_vieja', 'eq_viejo', now() - interval '731 days'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'tel_reciente', 'doc_reciente', 'email_reciente', 'disp_reciente', 'ip_reciente', 'eq_reciente', now());

do $$
declare
  r jsonb;
  v_viejo int;
  v_reciente int;
  v_anonimizados int;
begin
  r := public.purgar_retencion_1581();

  select count(*) into v_viejo from public.intento_auth where email = 'viejo@t.l';
  select count(*) into v_reciente from public.intento_auth where email = 'reciente@t.l';
  if v_viejo <> 0 or v_reciente <> 1 then
    raise exception 'FALLA 183: purga de intento_auth incorrecta (%, %)', v_viejo, v_reciente;
  end if;

  select count(*) into v_viejo from public.limite_tasa_evento where clave = 'vieja';
  select count(*) into v_reciente from public.limite_tasa_evento where clave = 'reciente';
  if v_viejo <> 0 or v_reciente <> 1 then
    raise exception 'FALLA 183: purga de limite_tasa_evento incorrecta (%, %)', v_viejo, v_reciente;
  end if;

  select count(*) into v_anonimizados
  from public.prueba_uso
  where negocio_id = '00000000-0000-0000-0000-0000000000c1'
    and telefono_hash is null and documento_hash is null and email_hash is null
    and dispositivo_hash is null and ip_hash is null and equipo_hash is null;
  if v_anonimizados <> 1 then
    raise exception 'FALLA 183: la prueba vencida no quedó anonimizada';
  end if;

  select count(*) into v_reciente
  from public.prueba_uso
  where negocio_id = '00000000-0000-0000-0000-0000000000c2'
    and ip_hash = 'ip_reciente' and equipo_hash = 'eq_reciente';
  if v_reciente <> 1 then
    raise exception 'FALLA 183: la prueba vigente fue anonimizada';
  end if;

  if coalesce((r->>'intento_auth_eliminados')::int, -1) <> 1
     or coalesce((r->>'limite_tasa_evento_eliminados')::int, -1) <> 1
     or coalesce((r->>'prueba_uso_anonimizados')::int, -1) <> 1 then
    raise exception 'FALLA 183: conteos inesperados %', r;
  end if;

  raise notice 'OK 183: retención purga/anonimiza solo datos vencidos y devuelve conteos sin PII';
end $$;

rollback;
