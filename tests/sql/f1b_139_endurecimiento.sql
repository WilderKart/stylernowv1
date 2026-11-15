-- Fase 1B · migración 139: F1A-04 (referido_config / vip_nivel), F1A-05 (costos de IA), F1A-06 (agregar_miembro_familiar), F1A-07 (límite de miembros).
-- Base LOCAL (`limpia`, sin datos), datos ficticios; todo en ROLLBACK. Cada intento va en subtransacción; se verifica ADEMÁS que el motivo del
-- rechazo no sea un error de la prueba. Falla (exit ≠ 0) si algo difiere.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('super','00000000-0000-0000-0f1b-000000000001'),('duenoa','00000000-0000-0000-0f1b-000000000002'),('duenob','00000000-0000-0000-0f1b-000000000003'),
  ('cliente','00000000-0000-0000-0f1b-000000000004'),('intruso','00000000-0000-0000-0f1b-000000000005'),('otro','00000000-0000-0000-0f1b-000000000006');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1b.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre,es_supersu) select id,alias,alias='super' from _a on conflict (id) do update set es_supersu=excluded.es_supersu;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values
 ('00000000-0000-0000-0f1b-0000000000a0','00000000-0000-0000-0f1b-000000000002','Neg A','f1b-a','Cali','CO'),
 ('00000000-0000-0000-0f1b-0000000000b0','00000000-0000-0000-0f1b-000000000003','Neg B','f1b-b','Cali','CO');
update public.suscripcion set estado='ACTIVA' where negocio_id in ('00000000-0000-0000-0f1b-0000000000a0','00000000-0000-0000-0f1b-0000000000b0');
insert into public.referido_config (negocio_id, monto, activo) values ('00000000-0000-0000-0f1b-0000000000a0', 1000, true), ('00000000-0000-0000-0f1b-0000000000b0', 2000, true);
insert into public.vip_nivel (id,negocio_id,nombre,orden) values ('00000000-0000-0000-0f1b-0000000000c1','00000000-0000-0000-0f1b-0000000000a0','Oro',1),('00000000-0000-0000-0f1b-0000000000c2','00000000-0000-0000-0f1b-0000000000a0','Plata',2);
insert into public.vip_miembro (negocio_id, cliente_id, nivel_id, origen) values ('00000000-0000-0000-0f1b-0000000000a0','00000000-0000-0000-0f1b-000000000004','00000000-0000-0000-0f1b-0000000000c1','MANUAL');

create temp table _r (n int, actor text, caso text, esperado text, obtenido text, detalle text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.probar(p_n int, p_actor text, p_caso text, p_esperado text, p_sql text, p_tipo text default 'dml', p_rol text default 'authenticated') returns void language plpgsql as $$
declare v_id uuid; v_obt text; v_det text := ''; v_cnt int;
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute format('set local role %I', p_rol);
    perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role', p_rol)::text end, true);
    if p_tipo = 'filas' then execute 'select count(*) from (' || p_sql || ') q' into v_cnt; v_obt := v_cnt::text;
    else execute p_sql; v_obt := 'PERMITIDO'; end if;
    raise exception 'REVERTIR';
  exception when others then
    if sqlerrm <> 'REVERTIR' then v_obt := 'DENEGADO'; v_det := left(sqlerrm, 100); end if;
  end;
  insert into _r values (p_n, p_actor, p_caso, p_esperado, v_obt, v_det);
end $$;
\o /dev/null
-- F1A-04 · referido_config: solo interno del negocio y SuperSU
select pg_temp.probar(1,'anonimo','lee referido_config (todas)','0','select 1 from public.referido_config','filas','anon');
select pg_temp.probar(2,'intruso','lee referido_config','0','select 1 from public.referido_config','filas');
select pg_temp.probar(3,'cliente','lee referido_config (cliente del negocio A)','0','select 1 from public.referido_config','filas');
select pg_temp.probar(4,'duenoa','lee referido_config: solo la de su negocio','1','select 1 from public.referido_config','filas');
select pg_temp.probar(5,'super','lee referido_config: todas','2','select 1 from public.referido_config','filas');
-- F1A-04 · vip_nivel: interno + el cliente ve SOLO su nivel
select pg_temp.probar(6,'anonimo','lee vip_nivel','0','select 1 from public.vip_nivel','filas','anon');
select pg_temp.probar(7,'intruso','lee vip_nivel','0','select 1 from public.vip_nivel','filas');
select pg_temp.probar(8,'cliente','lee vip_nivel: solo su nivel (Oro), no Plata','1','select 1 from public.vip_nivel','filas');
select pg_temp.probar(9,'duenob','lee vip_nivel: los de A no se ven desde B','0','select 1 from public.vip_nivel','filas');
select pg_temp.probar(10,'duenoa','lee vip_nivel: ambos de su negocio','2','select 1 from public.vip_nivel','filas');
-- F1A-05 · costos de IA
select pg_temp.probar(11,'anonimo','lee ai_accion_costo.margen_pct','DENEGADO','select margen_pct from public.ai_accion_costo','dml','anon');
select pg_temp.probar(12,'duenoa','lee costo_proveedor_estimado','DENEGADO','select costo_proveedor_estimado from public.ai_accion_costo');
select pg_temp.probar(13,'duenoa','lee margen_pct','DENEGADO','select margen_pct from public.ai_accion_costo');
select pg_temp.probar(14,'duenoa','select * (incluye columnas sensibles)','DENEGADO','select * from public.ai_accion_costo');
select pg_temp.probar(15,'cliente','lee margen_pct','DENEGADO','select margen_pct from public.ai_accion_costo');
select pg_temp.probar(16,'duenoa','lee costo_creditos (precio en créditos, no sensible)','PERMITIDO','select accion, costo_creditos from public.ai_accion_costo');
select pg_temp.probar(17,'duenoa','ejecuta ai_acciones_costo_admin()','DENEGADO','select * from public.ai_acciones_costo_admin()');
select pg_temp.probar(18,'cliente','ejecuta ai_acciones_costo_admin()','DENEGADO','select * from public.ai_acciones_costo_admin()');
select pg_temp.probar(19,'anonimo','ejecuta ai_acciones_costo_admin()','DENEGADO','select * from public.ai_acciones_costo_admin()','dml','anon');
select pg_temp.probar(20,'super','ejecuta ai_acciones_costo_admin() (control positivo)','PERMITIDO','select * from public.ai_acciones_costo_admin()');
select pg_temp.probar(21,'duenoa','UPDATE directo margen_pct','DENEGADO','update public.ai_accion_costo set margen_pct = 0');
select pg_temp.probar(22,'anonimo','INSERT directo','DENEGADO','insert into public.ai_accion_costo (accion,categoria,nivel_ia,costo_creditos) values (''x'',''x'',1,1)','dml','anon');
-- F1A-06 · agregar_miembro_familiar ya no es ejecutable por nadie con sesión
select pg_temp.probar(23,'cliente','agregar_miembro_familiar (a un perfil ajeno)','DENEGADO','select public.agregar_miembro_familiar(gen_random_uuid(), (select id from _a where alias=''otro''), ''x'')');
select pg_temp.probar(24,'anonimo','agregar_miembro_familiar','DENEGADO','select public.agregar_miembro_familiar(gen_random_uuid(), gen_random_uuid(), ''x'')','dml','anon');
-- F1A-07 · p_limite_miembros
select pg_temp.probar(25,'cliente','grupo con límite por defecto (4)','PERMITIDO','select public.crear_grupo_familiar(''F'', null, 4, 0)');
select pg_temp.probar(26,'cliente','límite 1000','DENEGADO','select public.crear_grupo_familiar(''F'', null, 1000, 0)');
select pg_temp.probar(27,'cliente','límite 2147483647','DENEGADO','select public.crear_grupo_familiar(''F'', null, 2147483647, 0)');
select pg_temp.probar(28,'cliente','límite -3','DENEGADO','select public.crear_grupo_familiar(''F'', null, -3, 0)');
select pg_temp.probar(29,'cliente','límite 0','DENEGADO','select public.crear_grupo_familiar(''F'', null, 0, 0)');
select pg_temp.probar(30,'cliente','límite NULL','DENEGADO','select public.crear_grupo_familiar(''F'', null, null, 0)');
select pg_temp.probar(31,'cliente','límite 10 sin ser dueño','DENEGADO','select public.crear_grupo_familiar(''F'', null, 10, 0)');
select pg_temp.probar(32,'duenoa','límite 10 siendo dueño del negocio A','PERMITIDO','select public.crear_grupo_familiar(''F'', ''00000000-0000-0000-0f1b-0000000000a0'', 10, 0)');
select pg_temp.probar(33,'duenob','límite 10 sobre negocio A (ajeno)','DENEGADO','select public.crear_grupo_familiar(''F'', ''00000000-0000-0000-0f1b-0000000000a0'', 10, 0)');
select pg_temp.probar(34,'duenoa','límite 21 (sobre el techo técnico) siendo dueño','DENEGADO','select public.crear_grupo_familiar(''F'', ''00000000-0000-0000-0f1b-0000000000a0'', 21, 0)');
select pg_temp.probar(35,'super','límite 20 siendo Super Admin','PERMITIDO','select public.crear_grupo_familiar(''F'', null, 20, 0)');
select pg_temp.probar(36,'duenoa','descuento familiar 10% (ya no soportado, ni el dueño)','DENEGADO','select public.crear_grupo_familiar(''F'', ''00000000-0000-0000-0f1b-0000000000a0'', 4, 10)');
select pg_temp.probar(37,'super','descuento familiar 10% (ni Super Admin)','DENEGADO','select public.crear_grupo_familiar(''F'', null, 4, 10)');
select pg_temp.probar(38,'cliente','INSERT directo en familia_grupo con límite 1000','DENEGADO','insert into public.familia_grupo (titular_cliente_id,nombre,limite_miembros) values ((select id from _a where alias=''cliente''),''x'',1000)');
\o
reset role;
\echo '== Fase 1B · 139 =='
select n, actor, caso, esperado, obtenido,
  case when detalle ~* 'does not exist|syntax|invalid input|null value|violates (not-null|foreign)|permission denied for table users' then '*** RAZÓN INVÁLIDA ***'
       when esperado = obtenido then 'ok' else '*** DIFIERE ***' end veredicto, detalle
from _r order by n;
do $$ declare v int; begin
  select count(*) into v from _r where esperado <> obtenido or detalle ~* 'does not exist|syntax|invalid input|null value|violates (not-null|foreign)|permission denied for table users';
  if v > 0 then raise exception 'FALLA: % casos no coinciden', v; end if;
  raise notice 'OK: % casos coinciden', (select count(*) from _r);
end $$;
rollback;
