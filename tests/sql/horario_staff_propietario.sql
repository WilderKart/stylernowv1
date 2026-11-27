-- Prueba SQL de la migración 206 (la propietaria define el horario semanal de su equipo).
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/horario_staff_propietario.sql
-- Transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('a6100001-0000-4000-8000-000000000001', 'h_dueno@t.l', 'authenticated', 'authenticated'),
  ('a6100001-0000-4000-8000-000000000002', 'h_staff@t.l', 'authenticated', 'authenticated'),
  ('a6100001-0000-4000-8000-000000000003', 'h_otro@t.l', 'authenticated', 'authenticated'),
  ('a6100001-0000-4000-8000-000000000004', 'h_dueno2@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('a6100001-0000-4000-8000-000000000001', 'Dueño'), ('a6100001-0000-4000-8000-000000000002', 'Barbero'),
  ('a6100001-0000-4000-8000-000000000003', 'Otro'), ('a6100001-0000-4000-8000-000000000004', 'Dueño2')
on conflict (id) do update set nombre = excluded.nombre;
insert into public.staff (usuario_id, nombre) values ('a6100001-0000-4000-8000-000000000002', 'Barbero') on conflict (usuario_id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b6100001-0000-4000-8000-00000000000a', 'a6100001-0000-4000-8000-000000000001', 'Neg H', 'hor-neg-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO'),
  ('b6100001-0000-4000-8000-00000000000b', 'a6100001-0000-4000-8000-000000000004', 'Neg H2', 'hor-neg2-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b6100001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('b6100001-0000-4000-8000-00000000000b', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
delete from public.sede where negocio_id in ('b6100001-0000-4000-8000-00000000000a', 'b6100001-0000-4000-8000-00000000000b');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('c6100001-0000-4000-8000-000000000001', 'b6100001-0000-4000-8000-00000000000a', 'Sede', 'Calle 1', 'Cali', '{}'::jsonb, true),
  ('c6100001-0000-4000-8000-000000000002', 'b6100001-0000-4000-8000-00000000000b', 'Sede 2', 'Calle 2', 'Cali', '{}'::jsonb, true);
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, presta_servicios) values
  ('d6100001-0000-4000-8000-000000000001', 'a6100001-0000-4000-8000-000000000002', 'b6100001-0000-4000-8000-00000000000a', 'c6100001-0000-4000-8000-000000000001', 'ACTIVO', true);

create temp table t_r (n int, ok boolean, detalle text);
grant all on t_r to authenticated, anon;
create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(text) to authenticated;

create or replace function pg_temp.intenta(p_n int, p_uid text, p_vinculo uuid, p_sede uuid, p_dias jsonb, p_espera text) returns void language plpgsql as $$
declare v_msg text := null;
begin
  perform pg_temp.como(p_uid);
  begin
    perform public.propietario_definir_horario_staff(p_vinculo, p_sede, p_dias);
  exception when others then v_msg := sqlerrm;
  end;
  insert into t_r values (p_n, case when p_espera is null then v_msg is null else coalesce(v_msg, '') like '%' || p_espera || '%' end, coalesce(v_msg, 'OK'));
end $$;
grant execute on function pg_temp.intenta(int, text, uuid, uuid, jsonb, text) to authenticated;

set local role authenticated;
-- 1. La propietaria define lunes a viernes 09:00–18:00
select pg_temp.intenta(1, 'a6100001-0000-4000-8000-000000000001', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":2,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":3,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":4,"hora_inicio":"09:00","hora_fin":"18:00"},{"dia_semana":5,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb, null);
-- 2. Reemplaza (no acumula): ahora solo sábado
select pg_temp.intenta(2, 'a6100001-0000-4000-8000-000000000001', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":6,"hora_inicio":"10:00","hora_fin":"14:00"}]'::jsonb, null);
-- 3. Otra propietaria (de otro negocio) NO puede
select pg_temp.intenta(3, 'a6100001-0000-4000-8000-000000000004', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb, 'NO_AUTORIZADO');
-- 4. El propio barbero NO usa esta función (para eso está su flujo con aprobación)
select pg_temp.intenta(4, 'a6100001-0000-4000-8000-000000000002', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb, 'NO_AUTORIZADO');
-- 5. Un tercero cualquiera NO puede
select pg_temp.intenta(5, 'a6100001-0000-4000-8000-000000000003', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb, 'NO_AUTORIZADO');
-- 6. Sede de otro negocio
select pg_temp.intenta(6, 'a6100001-0000-4000-8000-000000000001', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000002',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00"}]'::jsonb, 'SEDE_INVALIDA');
-- 7. Fin antes del inicio
select pg_temp.intenta(7, 'a6100001-0000-4000-8000-000000000001', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"18:00","hora_fin":"09:00"}]'::jsonb, 'HORARIO_INVALIDO');
-- 8. Día repetido
select pg_temp.intenta(8, 'a6100001-0000-4000-8000-000000000001', 'd6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001',
  '[{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"12:00"},{"dia_semana":1,"hora_inicio":"13:00","hora_fin":"18:00"}]'::jsonb, 'HORARIO_INVALIDO');
-- 9. Anónimo
reset role;
set local role anon;
do $$ begin
  begin perform public.propietario_definir_horario_staff('d6100001-0000-4000-8000-000000000001', 'c6100001-0000-4000-8000-000000000001', '[]'::jsonb);
        insert into t_r values (9, false, 'anon ejecutó');
  exception when insufficient_privilege then insert into t_r values (9, true, 'sin permiso');
  end;
end $$;
reset role;

-- Estado final: solo quedó el sábado de la prueba 2 (las inválidas no cambiaron nada) y hay auditoría
insert into t_r select 10, (select count(*) from public.disponibilidad where vinculo_id = 'd6100001-0000-4000-8000-000000000001') = 1
  and (select dia_semana from public.disponibilidad where vinculo_id = 'd6100001-0000-4000-8000-000000000001') = 6, 'estado final';
insert into t_r select 11, (select count(*) from public.evento_auditoria where entidad_id = 'd6100001-0000-4000-8000-000000000001' and accion = 'HORARIO_DEFINIDO_POR_BARBERIA') = 2, 'auditoría (2 cambios válidos)';

select n, case when ok then 'OK' else 'FALLA' end resultado, detalle from t_r order by n;
do $$ begin
  if exists (select 1 from t_r where not ok) then raise exception 'HAY PRUEBAS FALLIDAS'; end if;
end $$;
rollback;
