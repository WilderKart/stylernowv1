-- Fase 1B · migración 146: ANTES el dueño no puede suspender staff (regresión); DESPUÉS sí, y la escritura directa de session_version sigue prohibida.
-- Base `limpia`, datos ficticios, ROLLBACK. Aplica el cuerpo de 146 en línea.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _a (alias text primary key, id uuid);
insert into _a values ('super','00000000-0000-0000-0f1e-000000000001'),('dueno','00000000-0000-0000-0f1e-000000000002'),('pro','00000000-0000-0000-0f1e-000000000003'),('cliente','00000000-0000-0000-0f1e-000000000004');
grant select on _a to authenticated, anon;
insert into auth.users (id,email,aud,role) select id, alias||'@f1e.test','authenticated','authenticated' from _a;
insert into public.perfil (id,nombre,es_supersu) select id,alias,alias='super' from _a on conflict (id) do update set es_supersu=excluded.es_supersu;
insert into public.negocio (id,owner_user_id,nombre,slug,ciudad,pais_codigo) values ('00000000-0000-0000-0f1e-0000000000a0','00000000-0000-0000-0f1e-000000000002','Neg','f1e-a','Cali','CO');
update public.suscripcion set estado='ACTIVA' where negocio_id='00000000-0000-0000-0f1e-0000000000a0';
insert into public.sede (id,negocio_id,nombre,direccion,ciudad) values ('00000000-0000-0000-0f1e-0000000000a1','00000000-0000-0000-0f1e-0000000000a0','S','x','Cali');
insert into public.staff (usuario_id,nombre) values ('00000000-0000-0000-0f1e-000000000003','P');
insert into public.vinculo_staff_negocio (id,staff_id,negocio_id,sede_activa_id,estado,es_guardian,comision_pct,fecha_ingreso) values
 ('00000000-0000-0000-0f1e-0000000000c1','00000000-0000-0000-0f1e-000000000003','00000000-0000-0000-0f1e-0000000000a0','00000000-0000-0000-0f1e-0000000000a1','ACTIVO',false,40,now());
create temp table _r (fase text, caso text, esperado text, obtenido text, detalle text);
grant all on _r to authenticated, anon;
create or replace function pg_temp.probar(p_fase text, p_actor text, p_caso text, p_esperado text, p_sql text) returns void language plpgsql as $$
declare v_id uuid; v text; d text := '';
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    execute p_sql; v := 'PERMITIDO'; raise exception 'REVERTIR';
  exception when others then if sqlerrm <> 'REVERTIR' then v := 'DENEGADO'; d := left(sqlerrm, 90); end if; end;
  insert into _r values (p_fase, p_caso, p_esperado, v, d);
end $$;
-- Estado previo (cuerpo de la migración 136, el que hay hoy en producción): se instala dentro de la transacción para que la prueba sea independiente de si 146 ya está aplicada.
create or replace function public.perfil_proteger_columnas_sensibles()
 returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.es_supersu, false) then raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos'; end if;
      return new;
    end if;
    if new.es_supersu is distinct from old.es_supersu then raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos'; end if;
    if new.email is distinct from old.email then raise exception 'NO_AUTORIZADO: el correo del perfil se toma de la cuenta y no se edita directamente'; end if;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_supersu() and new.session_version is distinct from old.session_version then
    raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
  end if;
  return new;
end;
$function$;
\o /dev/null
select pg_temp.probar('ANTES','dueno','dueño suspende a su staff (regresión)','DENEGADO',$$select public.suspender_staff('00000000-0000-0000-0f1e-0000000000c1'::uuid,'x')$$);
\o
reset role;
-- cuerpo de 146
create or replace function public.perfil_proteger_columnas_sensibles()
 returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.es_supersu, false) then raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos'; end if;
      return new;
    end if;
    if new.es_supersu is distinct from old.es_supersu then raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos'; end if;
    if new.email is distinct from old.email then raise exception 'NO_AUTORIZADO: el correo del perfil se toma de la cuenta y no se edita directamente'; end if;
    if new.session_version is distinct from old.session_version and not coalesce(public.is_supersu(), false) then
      raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
    end if;
  end if;
  return new;
end;
$function$;
\o /dev/null
select pg_temp.probar('DESPUES','dueno','dueño suspende a su staff','PERMITIDO',$$select public.suspender_staff('00000000-0000-0000-0f1e-0000000000c1'::uuid,'x')$$);
select pg_temp.probar('DESPUES','cliente','cliente suspende staff de un negocio ajeno','DENEGADO',$$select public.suspender_staff('00000000-0000-0000-0f1e-0000000000c1'::uuid,'x')$$);
select pg_temp.probar('DESPUES','pro','profesional suspende su propio vinculo','DENEGADO',$$select public.suspender_staff('00000000-0000-0000-0f1e-0000000000c1'::uuid,'x')$$);
select pg_temp.probar('DESPUES','cliente','escritura DIRECTA de session_version propia','DENEGADO',$$update public.perfil set session_version = session_version + 1 where id = (select id from _a where alias='cliente')$$);
select pg_temp.probar('DESPUES','dueno','escritura DIRECTA de session_version de su staff','DENEGADO',$$do $x$ declare n int; begin update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-0f1e-000000000003'; get diagnostics n = row_count; if n = 0 then raise exception 'SIN_FILAS (RLS)'; end if; end $x$ $$);
select pg_temp.probar('DESPUES','cliente','auto-promocion a Super Admin','DENEGADO',$$update public.perfil set es_supersu = true where id = (select id from _a where alias='cliente')$$);
select pg_temp.probar('DESPUES','cliente','cambio de correo del perfil','DENEGADO',$$update public.perfil set email = 'otro@x.test' where id = (select id from _a where alias='cliente')$$);
select pg_temp.probar('DESPUES','cliente','editar su propio nombre (legitimo)','PERMITIDO',$$update public.perfil set nombre = 'Nuevo' where id = (select id from _a where alias='cliente')$$);
\o
reset role;
\echo '== Fase 1B · session_version / 146 =='
select fase, caso, esperado, obtenido, case when esperado = obtenido then 'ok' else '*** DIFIERE ***' end v, detalle from _r order by fase desc, caso;
do $$ declare v int; begin select count(*) into v from _r where esperado <> obtenido;
  if v > 0 then raise exception 'FALLA: % casos no coinciden', v; end if; raise notice 'OK: % casos coinciden', (select count(*) from _r); end $$;
rollback;
