-- Prueba SQL de la migración 207 (ventana de reservas).
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/ventana_reservas.sql
-- Transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('a7100001-0000-4000-8000-000000000001', 'v_dueno@t.l', 'authenticated', 'authenticated'),
  ('a7100001-0000-4000-8000-000000000002', 'v_otro@t.l', 'authenticated', 'authenticated'),
  ('a7100001-0000-4000-8000-000000000003', 'v_cli@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('a7100001-0000-4000-8000-000000000001', 'Dueño'), ('a7100001-0000-4000-8000-000000000002', 'Otro'), ('a7100001-0000-4000-8000-000000000003', 'Cliente')
on conflict (id) do update set nombre = excluded.nombre;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b7100001-0000-4000-8000-00000000000a', 'a7100001-0000-4000-8000-000000000001', 'Neg V', 'ven-neg-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b7100001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';

create temp table t_r (n int, ok boolean, detalle text);
grant all on t_r to authenticated, anon;
create or replace function pg_temp.intenta(p_n int, p_uid text, p_min int, p_max int, p_espera text) returns void language plpgsql as $$
declare v_msg text := null;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  begin
    perform public.configurar_ventana_reservas('b7100001-0000-4000-8000-00000000000a', p_min, p_max);
  exception when others then v_msg := sqlerrm;
  end;
  insert into t_r values (p_n, case when p_espera is null then v_msg is null else coalesce(v_msg, '') like '%' || p_espera || '%' end, coalesce(v_msg, 'OK'));
end $$;
grant execute on function pg_temp.intenta(int, text, int, int, text) to authenticated;

set local role authenticated;
select pg_temp.intenta(1, 'a7100001-0000-4000-8000-000000000001', 120, 180, null);                 -- la propietaria puede
select pg_temp.intenta(2, 'a7100001-0000-4000-8000-000000000002', 0, 90, 'NO_AUTORIZADO');         -- otra persona no
select pg_temp.intenta(3, 'a7100001-0000-4000-8000-000000000003', 0, 90, 'NO_AUTORIZADO');         -- un cliente no
select pg_temp.intenta(4, 'a7100001-0000-4000-8000-000000000001', 0, 366, 'VENTANA_INVALIDA');    -- más de un año
select pg_temp.intenta(5, 'a7100001-0000-4000-8000-000000000001', 0, 0, 'VENTANA_INVALIDA');      -- menos de 1 día
select pg_temp.intenta(6, 'a7100001-0000-4000-8000-000000000001', -5, 30, 'VENTANA_INVALIDA');    -- mínimo negativo
select pg_temp.intenta(7, 'a7100001-0000-4000-8000-000000000001', 10081, 30, 'VENTANA_INVALIDA'); -- mínimo mayor a 7 días
select pg_temp.intenta(8, 'a7100001-0000-4000-8000-000000000001', 1440, 1, 'VENTANA_INVALIDA');   -- máximo no mayor que el mínimo
reset role;
set local role anon;
do $$ begin
  begin perform public.configurar_ventana_reservas('b7100001-0000-4000-8000-00000000000a', 0, 90); insert into t_r values (9, false, 'anon ejecutó');
  exception when insufficient_privilege then insert into t_r values (9, true, 'anon sin permiso'); end;
end $$;
reset role;

insert into t_r select 10, (select min_anticipacion_minutos = 120 and max_anticipacion_dias = 180 from public.negocio where id = 'b7100001-0000-4000-8000-00000000000a'), 'valores guardados; los inválidos no cambiaron nada';
insert into t_r select 11, (select count(*) from public.evento_auditoria where entidad_id = 'b7100001-0000-4000-8000-00000000000a' and accion = 'VENTANA_RESERVAS_CONFIGURADA') = 1, 'auditoría';

select n, case when ok then 'OK' else 'FALLA' end resultado, detalle from t_r order by n;
do $$ begin if exists (select 1 from t_r where not ok) then raise exception 'HAY PRUEBAS FALLIDAS'; end if; end $$;
rollback;
