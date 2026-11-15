-- Fase 1B · promociones (oferta_negocio) y migración 140: solo el dueño las administra; PORCENTAJE <= 100. Base `limpia`, datos ficticios, todo en ROLLBACK.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('super','00000000-0000-0000-0f1c-000000000001'),('duenoa','00000000-0000-0000-0f1c-000000000002'),('duenob','00000000-0000-0000-0f1c-000000000003'),
  ('guardian','00000000-0000-0000-0f1c-000000000004'),('pro','00000000-0000-0000-0f1c-000000000005'),('cliente','00000000-0000-0000-0f1c-000000000006');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1c.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre,es_supersu) select id,alias,alias='super' from _a on conflict (id) do update set es_supersu=excluded.es_supersu;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values
 ('00000000-0000-0000-0f1c-0000000000a0','00000000-0000-0000-0f1c-000000000002','Neg A','f1c-a','Cali','CO'),
 ('00000000-0000-0000-0f1c-0000000000b0','00000000-0000-0000-0f1c-000000000003','Neg B','f1c-b','Cali','CO');
update public.suscripcion set estado='ACTIVA' where negocio_id in ('00000000-0000-0000-0f1c-0000000000a0','00000000-0000-0000-0f1c-0000000000b0');
insert into public.sede (id,negocio_id,nombre,direccion,ciudad) values ('00000000-0000-0000-0f1c-0000000000a1','00000000-0000-0000-0f1c-0000000000a0','S','x','Cali');
insert into public.staff (usuario_id,nombre) values ('00000000-0000-0000-0f1c-000000000004','G'),('00000000-0000-0000-0f1c-000000000005','P');
insert into public.vinculo_staff_negocio (staff_id,negocio_id,sede_activa_id,estado,es_guardian,comision_pct,fecha_ingreso) values
 ('00000000-0000-0000-0f1c-000000000004','00000000-0000-0000-0f1c-0000000000a0','00000000-0000-0000-0f1c-0000000000a1','ACTIVO',true,40,now()),
 ('00000000-0000-0000-0f1c-000000000005','00000000-0000-0000-0f1c-0000000000a0','00000000-0000-0000-0f1c-0000000000a1','ACTIVO',false,40,now());
insert into public.oferta_negocio (id,negocio_id,titulo,tipo_descuento,valor) values ('00000000-0000-0000-0f1c-0000000000c1','00000000-0000-0000-0f1c-0000000000a0','Promo A','PORCENTAJE',10);

create temp table _r (n int, actor text, caso text, esperado text, obtenido text, detalle text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.probar(p_n int, p_actor text, p_caso text, p_esperado text, p_sql text, p_rol text default 'authenticated') returns void language plpgsql as $$
declare v_id uuid; v_obt text; v_det text := ''; v_filas bigint;
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute format('set local role %I', p_rol);
    perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role', p_rol)::text end, true);
    execute p_sql;
    get diagnostics v_filas = row_count;
    v_obt := case when v_filas > 0 then 'PERMITIDO' else 'SIN_EFECTO' end; -- UPDATE/DELETE bloqueado por RLS no lanza error: 0 filas
    raise exception 'REVERTIR';
  exception when others then
    if sqlerrm <> 'REVERTIR' then v_obt := 'DENEGADO'; v_det := left(sqlerrm, 110); end if;
  end;
  insert into _r values (p_n, p_actor, p_caso, p_esperado, v_obt, v_det);
end $$;
\o /dev/null
-- INSERT en el negocio A
select pg_temp.probar(1,'duenoa','dueño crea promoción en su negocio','PERMITIDO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(2,'guardian','guardian crea promoción','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(3,'pro','profesional crea promoción','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(4,'cliente','cliente crea promoción','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(5,'duenob','dueño de OTRO negocio crea en A','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(6,'super','Super Admin escribe directo (solo por soporte autorizado, aún no construido)','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)');
select pg_temp.probar(7,'anonimo','anónimo crea promoción','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Nueva'',''PORCENTAJE'',20)','anon');
-- UPDATE / DELETE de la promoción de A (RLS filtra: sin error, 0 filas)
select pg_temp.probar(8,'duenoa','dueño modifica su promoción','PERMITIDO','update public.oferta_negocio set activa = false where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(9,'duenob','dueño de otro negocio modifica la promoción de A','SIN_EFECTO','update public.oferta_negocio set activa = false where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(10,'guardian','guardian modifica la promoción','SIN_EFECTO','update public.oferta_negocio set activa = false where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(11,'pro','profesional modifica la promoción','SIN_EFECTO','update public.oferta_negocio set activa = false where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(12,'super','Super Admin modifica la promoción','SIN_EFECTO','update public.oferta_negocio set activa = false where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(13,'duenob','dueño de otro negocio elimina la promoción de A','SIN_EFECTO','delete from public.oferta_negocio where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(14,'guardian','guardian elimina la promoción','SIN_EFECTO','delete from public.oferta_negocio where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(15,'duenoa','dueño elimina su promoción','PERMITIDO','delete from public.oferta_negocio where id = ''00000000-0000-0000-0f1c-0000000000c1''');
-- tope del 100 %
select pg_temp.probar(16,'duenoa','PORCENTAJE 100','PERMITIDO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Cien'',''PORCENTAJE'',100)');
select pg_temp.probar(17,'duenoa','PORCENTAJE 100.01','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Cien'',''PORCENTAJE'',100.01)');
select pg_temp.probar(18,'duenoa','PORCENTAJE 5000','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Cien'',''PORCENTAJE'',5000)');
select pg_temp.probar(19,'duenoa','UPDATE a PORCENTAJE 150','DENEGADO','update public.oferta_negocio set valor = 150 where id = ''00000000-0000-0000-0f1c-0000000000c1''');
select pg_temp.probar(20,'duenoa','MONTO 50000 (el tope no aplica a montos)','PERMITIDO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Monto'',''MONTO'',50000)');
select pg_temp.probar(21,'duenoa','valor negativo','DENEGADO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento,valor) values (''00000000-0000-0000-0f1c-0000000000a0'',''Neg'',''PORCENTAJE'',-5)');
select pg_temp.probar(22,'duenoa','2 por 1 sin valor','PERMITIDO','insert into public.oferta_negocio (negocio_id,titulo,tipo_descuento) values (''00000000-0000-0000-0f1c-0000000000a0'',''Dos por uno'',''DOS_POR_UNO'')');
\o
reset role;
\echo '== Fase 1B · promociones / 140 =='
select n, actor, caso, esperado, obtenido,
  case when detalle ~* 'does not exist|syntax|invalid input|null value|permission denied for table users' then '*** RAZÓN INVÁLIDA ***' when esperado = obtenido then 'ok' else '*** DIFIERE ***' end veredicto, detalle
from _r order by n;
do $$ declare v int; begin
  select count(*) into v from _r where esperado <> obtenido or detalle ~* 'does not exist|syntax|invalid input|null value|permission denied for table users';
  if v > 0 then raise exception 'FALLA: % casos no coinciden', v; end if;
  raise notice 'OK: % casos coinciden', (select count(*) from _r);
end $$;
rollback;
