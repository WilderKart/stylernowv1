-- Regresión de seguridad: autorización con profesional (staff_id) nulo y patrones equivalentes.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/seguridad_regresion.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.
-- La prueba del hotfix sobre la versión vulnerable está en tests/sql/hotfix_staff_nulo_verificacion.sh.

begin;

grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'duenoA@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'cliente@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'intruso@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'duenoB@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'staffA@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'A'), ('00000000-0000-0000-0000-0000000000a2', 'C'),
  ('00000000-0000-0000-0000-0000000000a3', 'I'), ('00000000-0000-0000-0000-0000000000a5', 'B'),
  ('00000000-0000-0000-0000-0000000000a6', 'SA')
on conflict (id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 'seg-a', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a5', 'B', 'seg-b', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S', 'D', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0000-0000000000a6', 'Staff A') on conflict do nothing;

-- d1, d2, d3: SIN profesional asignado (el caso del P0). d4: asignada a staff A.
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', null,
   now() + interval '3 days', now() + interval '3 days 1 hour', 'CONFIRMADA', 50000, 0),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', null,
   now() + interval '4 days', now() + interval '4 days 1 hour', 'CONFIRMADA', 50000, 0),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', null,
   now() + interval '5 days', now() + interval '5 days 1 hour', 'CONFIRMADA', 50000, 0),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a6', now() + interval '6 days', now() + interval '6 days 1 hour', 'CONFIRMADA', 50000, 0);

set local role authenticated;

-- ── Ataques: intruso autenticado y dueño de OTRO negocio ───────────────────
do $$
declare v_sub text;
begin
  foreach v_sub in array array['00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a5'] loop
    perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
    begin
      perform public.cancelar_reserva('00000000-0000-0000-0000-0000000000d1', 'ataque');
      raise exception 'FALLA P0: % canceló una reserva ajena sin profesional asignado', v_sub;
    exception when others then
      if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
    end;
    begin
      perform public.completar_venta_pos('00000000-0000-0000-0000-0000000000d1', '[]'::jsonb, 'EFECTIVO', 0, null, 0);
      raise exception 'FALLA P0: % cerró la venta POS de una reserva ajena sin profesional asignado', v_sub;
    exception when others then
      if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
    end;
    begin
      perform public.marcar_no_show('00000000-0000-0000-0000-0000000000d1');
      raise exception 'FALLA: % marcó no-show en una reserva ajena', v_sub;
    exception when others then
      if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
    end;
    begin
      perform public.reprogramar_reserva('00000000-0000-0000-0000-0000000000d1', now() + interval '7 days', 'ataque');
      raise exception 'FALLA: % reprogramó una reserva ajena', v_sub;
    exception when others then
      if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
    end;
  end loop;
  if (select estado from public.reserva where id = '00000000-0000-0000-0000-0000000000d1') <> 'CONFIRMADA' then
    raise exception 'FALLA P0: la reserva atacada cambió de estado';
  end if;
  raise notice 'OK seguridad: intruso y dueño ajeno rechazados en cancelar, POS, no-show y reprogramar (staff nulo)';
end $$;

-- ── Operaciones legítimas siguen funcionando ───────────────────────────────
do $$
declare r jsonb;
begin
  -- El cliente cancela su propia reserva sin profesional: con la política por defecto (≥24 h) es 100 %
  -- como CLIENTE (antes del arreglo se trataba como negocio).
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
  r := public.cancelar_reserva('00000000-0000-0000-0000-0000000000d2', null);
  if (select cancelado_por from public.reserva where id = '00000000-0000-0000-0000-0000000000d2') <> 'CLIENTE' then
    raise exception 'FALLA: la cancelación del cliente no quedó como del cliente';
  end if;

  -- El dueño cancela una reserva de su negocio sin profesional.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  r := public.cancelar_reserva('00000000-0000-0000-0000-0000000000d3', 'cierre de agenda');
  if (select cancelado_por from public.reserva where id = '00000000-0000-0000-0000-0000000000d3') <> 'NEGOCIO' then
    raise exception 'FALLA: la cancelación del dueño no quedó como del negocio';
  end if;
  raise notice 'OK seguridad: cliente y dueño conservan sus operaciones legítimas';
end $$;

do $$ begin
  -- El dueño y el staff asignado pasan la autorización del POS (pueden fallar después por validaciones
  -- de la venta, pero nunca por NO_AUTORIZADO).
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  begin
    perform public.completar_venta_pos('00000000-0000-0000-0000-0000000000d1', '[]'::jsonb, 'EFECTIVO', 0, null, 0);
  exception when others then
    if sqlerrm like '%NO_AUTORIZADO%' then raise exception 'FALLA: el dueño quedó bloqueado en su propio POS'; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
  begin
    perform public.completar_venta_pos('00000000-0000-0000-0000-0000000000d4', '[]'::jsonb, 'EFECTIVO', 0, null, 0);
  exception when others then
    if sqlerrm like '%NO_AUTORIZADO%' then raise exception 'FALLA: el staff asignado quedó bloqueado en el POS de su cita'; end if;
  end;
  raise notice 'OK seguridad: dueño y staff asignado pasan la autorización del POS';
end $$;
reset role;

-- ── Escaneo automático: el patrón no debe reaparecer en ninguna función ────
do $$
declare v text;
begin
  -- (1) Asignación de un booleano de autorización por comparación con el actor, sin coalesce.
  select string_agg(proname, ', ') into v from (
    select p.proname, m[1] stmt
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang,
           regexp_matches(p.prosrc, '(:=[^;]*?=\s*(?:auth\.uid\(\)|v_actor|v_uid|v_usuario)[^;]*;)', 'g') m
     where n.nspname = 'public' and l.lanname = 'plpgsql') s
   where stmt !~* 'coalesce' and stmt !~* 'exists'
     -- Revisadas: el operando nunca es NULL (cliente_id NOT NULL y el actor nulo se rechaza antes).
     and proname not in ('reprogramar_reserva');
  if v is not null then raise exception 'FALLA patrón NULL: autorización sin coalesce en: %', v; end if;

  -- (2) Comparación con el actor directamente dentro de `if not (…)`, sin coalesce.
  select string_agg(distinct p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang,
         regexp_matches(p.prosrc, '(if\s+not\s*\((?:[^;]|\n)*?\)\s*then)', 'gi') m
   where n.nspname = 'public' and l.lanname = 'plpgsql'
     and m[1] ~ '=\s*(auth\.uid\(\)|v_actor|v_uid)' and m[1] !~* 'coalesce' and m[1] !~* 'exists';
  if v is not null then raise exception 'FALLA patrón NULL: if not (… = actor) sin coalesce en: %', v; end if;

  -- (2b) Variante negativa: `if … <> actor then raise` deja pasar con columna NULL (P0 de
  --      iniciar/finalizar_atencion_reserva, corregido en 125). Debe usar coalesce o IS DISTINCT FROM.
  select string_agg(distinct p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang,
         regexp_matches(p.prosrc, '(if\s(?:[^;]|\n)*?\sthen)', 'gi') m
   where n.nspname = 'public' and l.lanname = 'plpgsql'
     and m[1] ~ '<>\s*(auth\.uid\(\)|v_actor|v_uid)' and m[1] !~* 'coalesce';
  if v is not null then raise exception 'FALLA patrón NULL: if … <> actor sin coalesce en: %', v; end if;

  -- (3) Funciones de sistema (_*) nunca ejecutables por anon/authenticated.
  select string_agg(p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like '\_%' and p.prokind = 'f'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
     -- Helpers de políticas RLS (094/114): deben ser ejecutables por quien consulta y solo responden
     -- sobre el acceso del propio auth.uid(). Revisados 2026-11-12.
     and p.proname not in ('_chat_rol', '_familia_miembro', '_familia_titular');
  if v is not null then raise exception 'FALLA: funciones internas expuestas a anon/authenticated: %', v; end if;

  raise notice 'OK seguridad: sin patrones de autorización NULL ni funciones internas expuestas';
end $$;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE SEGURIDAD PASARON'; end $$;
rollback;
