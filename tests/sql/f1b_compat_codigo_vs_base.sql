-- Fase 1B · compatibilidad CÓDIGO ↔ BASE para el orden de liberación (139a / código / 139 + 141 + 142).
-- Ejecuta, con sesión real de cada rol (set local role + JWT), las MISMAS consultas que hace el código desplegado hoy en producción
-- (commit 130481e, «VIEJO») y el código de la rama cierre/fase-0 (commit f7a84be, «NUEVO»), y reporta si cada una funciona en la base donde se corre.
-- No falla nunca: imprime una matriz; la comparación contra lo esperado se hace en docs/plan_cierre/PLAN_LIBERACION_CONTROLADA.md.
-- Todo en ROLLBACK, datos ficticios. Correr en una base de PRUEBAS en el estado que se quiera evaluar (S0, S1, S2).
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('super','00000000-0000-0000-0f1d-000000000001'),('dueno','00000000-0000-0000-0f1d-000000000002'),('cliente','00000000-0000-0000-0f1d-000000000004');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1d.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre,es_supersu) select id,alias,alias='super' from _a on conflict (id) do update set es_supersu=excluded.es_supersu;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values ('00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-000000000002','Neg A','f1d-a','Cali','CO');
update public.suscripcion set estado='ACTIVA' where negocio_id='00000000-0000-0000-0f1d-0000000000a0';
insert into public.referido_config (negocio_id, monto, activo) values ('00000000-0000-0000-0f1d-0000000000a0', 1000, true);
insert into public.vip_nivel (id,negocio_id,nombre,orden) values ('00000000-0000-0000-0f1d-0000000000c1','00000000-0000-0000-0f1d-0000000000a0','Oro',1);
insert into public.vip_miembro (negocio_id, cliente_id, nivel_id, origen) values ('00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-000000000004','00000000-0000-0000-0f1d-0000000000c1','MANUAL');

create temp table _r (n int, codigo text, actor text, que text, resultado text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.probar(p_n int, p_codigo text, p_actor text, p_que text, p_sql text) returns void language plpgsql as $$
declare v_id uuid; v_obt text; v_cnt bigint;
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    execute 'select count(*) from (' || p_sql || ') q' into v_cnt;
    v_obt := 'FUNCIONA (' || v_cnt || ' filas)';
    raise exception 'REVERTIR';
  exception when others then
    if sqlerrm <> 'REVERTIR' then v_obt := 'FALLA: ' || left(sqlerrm, 70); end if;
  end;
  insert into _r values (p_n, p_codigo, p_actor, p_que, v_obt);
end $$;
\o /dev/null
-- Centro de IA del Super Admin
select pg_temp.probar(1,'VIEJO','super','Centro de IA · lista de acciones (select *)','select * from public.ai_accion_costo order by categoria, accion');
select pg_temp.probar(2,'VIEJO','super','Centro de IA · costos por accion (select accion,categoria,costo_proveedor_estimado,costo_creditos)','select accion, categoria, costo_proveedor_estimado, costo_creditos from public.ai_accion_costo');
select pg_temp.probar(3,'NUEVO','super','Centro de IA · rpc ai_acciones_costo_admin()','select * from public.ai_acciones_costo_admin()');
-- Tarjeta ROI de IA del dueño
select pg_temp.probar(4,'VIEJO','dueno','ROI del dueño · select accion,categoria,costo_proveedor_estimado','select accion, categoria, costo_proveedor_estimado from public.ai_accion_costo');
select pg_temp.probar(5,'NUEVO','dueno','ROI del dueño · select accion,categoria','select accion, categoria from public.ai_accion_costo');
-- Lo que no debe cambiar para nadie (mismo código en ambos): lealtad, VIP, familia, fraude
select pg_temp.probar(6,'AMBOS','dueno','Panel lealtad · referido_config de su negocio','select monto, porcentaje, limite_mensual, vigencia_dias, activo from public.referido_config where negocio_id = ''00000000-0000-0000-0f1d-0000000000a0''');
select pg_temp.probar(7,'AMBOS','dueno','Panel lealtad · vip_nivel de su negocio','select id, nombre, orden, beneficios from public.vip_nivel where negocio_id = ''00000000-0000-0000-0f1d-0000000000a0''');
select pg_temp.probar(8,'AMBOS','cliente','Página del negocio · «tu nivel VIP» (vip_miembro → vip_nivel)','select n.nombre from public.vip_miembro m join public.vip_nivel n on n.id = m.nivel_id where m.cliente_id = (select id from _a where alias=''cliente'')');
select pg_temp.probar(9,'AMBOS','cliente','Familia · crear_grupo_familiar(nombre)','select public.crear_grupo_familiar(''Mi familia'')');
select pg_temp.probar(10,'AMBOS','cliente','Lealtad · registrar_evento_fraude(tipo, negocio, payload)','select public.registrar_evento_fraude(''CANJE_DUPLICADO'', ''00000000-0000-0000-0f1d-0000000000a0'', ''MEDIA'', ''{}''::jsonb)');
\o
reset role;
\echo '== Matriz código ↔ base =='
select n, codigo, actor, que, resultado from _r order by n;
rollback;
