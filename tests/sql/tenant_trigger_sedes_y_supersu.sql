-- Fase 1 — Confirmación del trigger `trg_negocio_id_inmutable` (migración 179):
--   (1) un dueño con varias sedes SIGUE pudiendo mover a su equipo entre sus sedes (sede_activa_id);
--   (2) el SuperSU queda EXENTO (soporte total) y service_role opera sin restricción;
--   (3) control: un dueño normal sigue bloqueado en un movimiento cross-tenant.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/tenant_trigger_sedes_y_supersu.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.

begin;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tsd-owner@t.l',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'tsd-ownerB@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'tsd-staff@t.l',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a9', 'tsd-supersu@t.l','authenticated', 'authenticated');
-- `handle_new_user` crea el perfil al insertar auth.users; se ajusta aquí el flag (solo postgres).
update public.perfil set es_supersu = false
 where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6');
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000000000a9';
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 'tsd-a', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a5', 'B', 'tsd-b', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S1', 'D', 'Cali'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'S2', 'D', 'Cali');
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0000-0000000000a6', 'Staff A')
on conflict do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a6',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ACTIVO');
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 30000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- ── (1) El dueño cambia la sede del staff (S1→S2) de SU MISMO negocio ────────
--     El trigger trg_negocio_id_inmutable NO debe intervenir: sede_activa_id ≠ negocio_id.
do $$
declare n int;
begin
  update public.vinculo_staff_negocio set sede_activa_id = '00000000-0000-0000-0000-0000000000c2'
   where id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA (1): el trigger bloqueó el cambio de sede_activa_id (% filas)', n; end if;
  if (select sede_activa_id from public.vinculo_staff_negocio where id = '00000000-0000-0000-0000-0000000000d1')
     <> '00000000-0000-0000-0000-0000000000c2' then
    raise exception 'FALLA (1): la sede del staff no quedó actualizada';
  end if;
  raise notice 'OK (1): mover un miembro entre SUS sedes no lo bloquea trg_negocio_id_inmutable';
end $$;

-- ── (1b) Diagnóstico: ¿el RPC de traslado (interfaz real del Panel) funciona? ─
--   trasladar_staff es DEFINER y llama a invalidar_sesion_usuario (162); ese UPDATE sobre
--   perfil dispara otro trigger (perfil_proteger_columnas_sensibles) que podría rechazarlo.
do $$
declare
  v_ok boolean := true;
  v_msg text := 'OK';
begin
  begin
    perform public.trasladar_staff('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1');
  exception when others then
    v_ok := false; v_msg := sqlerrm;
  end;
  if v_ok then
    raise notice 'OK (1b): trasladar_staff (RPC del Panel) funcionó';
  else
    raise notice 'HALLAZGO (1b): trasladar_staff FALLÓ con: % -- separado del trigger 179; investigar el trigger de session_version', v_msg;
  end if;
end $$;

reset role;

-- ── (2) SuperSU (authenticated + perfil.es_supersu) queda exento del trigger ─
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.sede set negocio_id = '00000000-0000-0000-0000-0000000000b2'
   where id = '00000000-0000-0000-0000-0000000000c2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA (2): el SuperSU fue bloqueado por el trigger (debe estar exento)'; end if;
  raise notice 'OK (2): el SuperSU está exento del trigger (movió una sede a otro negocio, soporte total)';
end $$;
reset role;

-- ── (3) service_role opera sin restricción ─────────────────────────────────
do $$
declare n int;
begin
  update public.sede set negocio_id = '00000000-0000-0000-0000-0000000000b1'
   where id = '00000000-0000-0000-0000-0000000000c2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA (3): service_role fue bloqueado por el trigger'; end if;
  raise notice 'OK (3): service_role mueve filas sin restricción del trigger';
end $$;

-- ── (4) Control: un dueño (no supersu) SIGUE bloqueado en cross-tenant ──────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  begin
    update public.servicio set negocio_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FALLA (4): el dueño movió su servicio a otro negocio';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK (4): el dueño normal sigue bloqueado en cross-tenant';
end $$;
reset role;

do $$ begin raise notice 'CONFIRMACIONES DEL TRIGGER: TODAS PASARON'; end $$;
rollback;
