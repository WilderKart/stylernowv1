-- Fase 1B · migraciones 141 (sin TRUNCATE/TRIGGER/REFERENCES para anon/authenticated) y 142 (registrar_evento_fraude acotado). Base `limpia`, datos ficticios, ROLLBACK.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('duenoa','00000000-0000-0000-0f1d-000000000002'),('duenob','00000000-0000-0000-0f1d-000000000003'),('clientea','00000000-0000-0000-0f1d-000000000004'),('intruso','00000000-0000-0000-0f1d-000000000005');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1d.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre) select id,alias from _a on conflict do nothing;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values
 ('00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-000000000002','Neg A','f1d-a','Cali','CO'),
 ('00000000-0000-0000-0f1d-0000000000b0','00000000-0000-0000-0f1d-000000000003','Neg B','f1d-b','Cali','CO');
insert into public.sede (id,negocio_id,nombre,direccion,ciudad) values ('00000000-0000-0000-0f1d-0000000000a1','00000000-0000-0000-0f1d-0000000000a0','S','x','Cali');
insert into public.reserva (cliente_id,negocio_id,sede_id,hora_inicio,hora_fin,estado,monto_total,monto_sena) values
 ('00000000-0000-0000-0f1d-000000000004','00000000-0000-0000-0f1d-0000000000a0','00000000-0000-0000-0f1d-0000000000a1',now()+interval '3 days',now()+interval '3 days 1 hour','CONFIRMADA',30000,0);

create temp table _r (n int, caso text, esperado text, obtenido text);
\echo '== 141: privilegios de tabla =='
insert into _r select 1, 'tablas de public donde anon o authenticated conservan TRUNCATE', '0',
  (select count(*)::text from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES'));
insert into _r select 2, 'authenticated conserva INSERT/UPDATE/DELETE en negocio (SELECT es por columna desde 108)', '3',
  (select count(*)::text from information_schema.table_privileges where table_schema='public' and table_name='negocio' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE'));

create or replace function pg_temp.fraude(p_actor text, p_neg uuid, p_sev text default 'ALTA', p_payload jsonb default '{"x":1}') returns text language plpgsql as $$
declare v_id uuid; v_res text;
begin
  select id into v_id from _a where alias = p_actor;
  set local role authenticated;
  perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role','authenticated')::text end, true);
  perform public.registrar_evento_fraude('CANJE_DUPLICADO', p_neg, p_sev, p_payload);
  reset role;
  select coalesce(negocio_id::text,'SIN_NEGOCIO')||'/'||severidad||'/'||length(payload::text) into v_res from public.lealtad_fraude_evento where cliente_id = v_id order by created_at desc limit 1;
  delete from public.lealtad_fraude_evento where cliente_id = v_id;
  return v_res;
exception when others then reset role; return 'DENEGADO:' || left(sqlerrm, 40);
end $$;
\o /dev/null
insert into _r select 10, 'cliente con reserva en A registra evento en A: se conserva el negocio y la severidad la fija el servidor (MEDIA)', '00000000-0000-0000-0f1d-0000000000a0/MEDIA/8', pg_temp.fraude('clientea','00000000-0000-0000-0f1d-0000000000a0');
insert into _r select 11, 'intruso registra evento en el negocio A (sin relación): queda SIN negocio', 'SIN_NEGOCIO/MEDIA/8', pg_temp.fraude('intruso','00000000-0000-0000-0f1d-0000000000a0');
insert into _r select 12, 'cliente de A registra evento en B (ajeno): queda SIN negocio', 'SIN_NEGOCIO/MEDIA/8', pg_temp.fraude('clientea','00000000-0000-0000-0f1d-0000000000b0');
insert into _r select 13, 'dueño de B registra en B (interno): se conserva', '00000000-0000-0000-0f1d-0000000000b0/MEDIA/8', pg_temp.fraude('duenob','00000000-0000-0000-0f1d-0000000000b0');
insert into _r select 14, 'payload de 10 KB: se reemplaza por marca de truncado', 'SIN_NEGOCIO/MEDIA/18', pg_temp.fraude('intruso', null, 'MEDIA', jsonb_build_object('basura', repeat('x', 10000)));
insert into _r select 15, 'sin negocio (uso real de la interfaz)', 'SIN_NEGOCIO/MEDIA/8', pg_temp.fraude('clientea', null);
insert into _r select 16, 'anónimo', 'DENEGADO:NO_AUTENTICADO', pg_temp.fraude('anonimo_x', null);
\o
reset role;
select n, caso, esperado, obtenido, case when esperado = obtenido then 'ok' else '*** DIFIERE ***' end veredicto from _r order by n;
do $$ declare v int; begin
  select count(*) into v from _r where esperado <> obtenido;
  if v > 0 then raise exception 'FALLA: % casos no coinciden', v; end if;
  raise notice 'OK: % casos coinciden', (select count(*) from _r);
end $$;
rollback;
