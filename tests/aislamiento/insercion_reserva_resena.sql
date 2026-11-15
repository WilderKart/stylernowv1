-- Inserción DIRECTA (sin RPC) en reserva y resena con filas COMPLETAS y válidas, como cada actor.
-- Motivo: la matriz HTTP envía una fila incompleta y en estas dos tablas un trigger BEFORE INSERT falla (P0001) antes de que se evalúe
-- la política RLS; ahí el aislamiento de inserción no quedaba demostrado. Aquí el cuerpo es válido, así que cualquier rechazo es de
-- autorización/regla y no de datos faltantes. Base LOCAL con seed_pruebas/seed_datos_ricos; cada intento se revierte (subtransacción).
-- Esperado: nadie inserta sobre el negocio B suplantando a su cliente ni siendo interno de otro negocio.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
create temp table _r (n int, actor text, intento text, esperado text, obtenido text, detalle text);
grant all on _r to authenticated, anon;

create or replace function pg_temp.intentar(p_n int, p_actor text, p_intento text, p_esperado text, p_sql text, p_rol text default 'authenticated') returns void language plpgsql as $$
declare v_id uuid; v_obt text := 'PERMITIDO'; v_det text := '';
begin
  select u.id into v_id from auth.users u where u.email = p_actor || '@pruebas.test';
  p_sql := replace(p_sql, '@@ACTOR@@', coalesce(v_id::text, '00000000-0000-0000-0000-000000000000'));
  begin
    execute format('set local role %I', p_rol);
    perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role', p_rol)::text end, true);
    execute p_sql;
    raise exception 'REVERTIR_PRUEBA';
  exception when others then
    if sqlerrm <> 'REVERTIR_PRUEBA' then v_obt := 'DENEGADO'; v_det := left(sqlerrm, 90); end if;
  end;
  insert into _r values (p_n, p_actor, p_intento, p_esperado, v_obt, v_det);
end $$;

-- Valores de B: negocio, sede, cliente, reserva COMPLETADA (para la reseña)
\set NEG '00000000-0000-0000-0006-0000000001b0'
\set SEDE '00000000-0000-0000-0006-0000000002b0'
\set CLIB '00000000-0000-0000-0006-0000000000b3'
\set RESB '00000000-0000-0000-0006-0000000004b2'
\set CLIA '00000000-0000-0000-0006-0000000000a3'

\o /dev/null
-- RESERVA sobre el negocio B, suplantando al cliente de B
select pg_temp.intentar(1, a, 'reserva en B con cliente_id = cliente de B (suplantación)', 'DENEGADO',
  format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
            values (%L, %L, %L, now() + interval '5 days', now() + interval '5 days 1 hour', 'CONFIRMADA', 30000, 0)$q$, :'CLIB', :'NEG', :'SEDE'))
from unnest(array['intruso','cliente-a','dueno-a','guardian-a','pro-a1','pro-a2']) a;
-- RESERVA sobre B siendo personal interno de OTRO negocio (política reserva_insert_interno exige ser de B)
select pg_temp.intentar(2, a, 'reserva en B con cliente_id propio, actor interno de A', 'DENEGADO',
  format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
            values ('@@ACTOR@@', %L, %L, now() + interval '6 days', now() + interval '6 days 1 hour', 'CONFIRMADA', 30000, 0)$q$, :'NEG', :'SEDE'))
from unnest(array['dueno-a','guardian-a','pro-a1','pro-a2']) a;
-- RESERVA en B con cliente propio (camino de la política «cliente»): informativo, lo decide trg_reserva_proteger_directo
select pg_temp.intentar(3, a, 'reserva DIRECTA en B con cliente_id propio (cliente de otro negocio)', 'DENEGADO',
  format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
            values ('@@ACTOR@@', %L, %L, now() + interval '7 days', now() + interval '7 days 1 hour', 'CONFIRMADA', 30000, 0)$q$, :'NEG', :'SEDE'))
from unnest(array['intruso','cliente-a']) a;
-- RESEÑA sobre una reserva COMPLETADA de B
select pg_temp.intentar(4, a, 'reseña en B con cliente_id = cliente de B (suplantación)', 'DENEGADO',
  format($q$insert into public.resena (reserva_id, cliente_id, negocio_id, calificacion, comentario) values (%L, %L, %L, 1, 'ataque')$q$, :'RESB', :'CLIB', :'NEG'))
from unnest(array['intruso','cliente-a','dueno-a','guardian-a','pro-a1']) a;
select pg_temp.intentar(5, a, 'reseña en B sobre reserva ajena con cliente_id propio', 'DENEGADO',
  format($q$insert into public.resena (reserva_id, cliente_id, negocio_id, calificacion, comentario) values (%L, '@@ACTOR@@', %L, 1, 'ataque')$q$, :'RESB', :'NEG'))
from unnest(array['intruso','cliente-a','dueno-a','guardian-a','pro-a1']) a;
-- Anónimo
select pg_temp.intentar(6, 'anonimo', 'reserva en B sin sesión', 'DENEGADO',
  format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values (%L, %L, %L, now() + interval '8 days', now() + interval '8 days 1 hour', 'CONFIRMADA', 1, 0)$q$, :'CLIB', :'NEG', :'SEDE'), 'anon');
select pg_temp.intentar(7, 'anonimo', 'reseña en B sin sesión', 'DENEGADO',
  format($q$insert into public.resena (reserva_id, cliente_id, negocio_id, calificacion) values (%L, %L, %L, 1)$q$, :'RESB', :'CLIB', :'NEG'), 'anon');
-- CONTROL POSITIVO: el cliente de B reseña su propia reserva COMPLETADA, y el dueño de B inserta una reserva en su negocio
select pg_temp.intentar(8, 'cliente-b', 'CONTROL: cliente de B reseña su reserva COMPLETADA', 'PERMITIDO',
  format($q$insert into public.resena (reserva_id, cliente_id, negocio_id, calificacion, comentario) values (%L, %L, %L, 5, 'control')$q$, :'RESB', :'CLIB', :'NEG'));
select pg_temp.intentar(9, 'dueno-b', 'CONTROL: ni el dueño de B inserta reserva DIRECTA (solo por función)', 'DENEGADO',
  format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
            values (%L, %L, %L, now() + interval '9 days', now() + interval '9 days 1 hour', 'CONFIRMADA', 30000, 0)$q$, :'CLIB', :'NEG', :'SEDE'));
\o
reset role;
\echo '== inserción directa en reserva / resena =='
select n, actor, intento, esperado, obtenido, case when detalle ~* 'permission denied for table|does not exist|syntax|invalid input|null value|violates (not-null|foreign)' then '*** RAZÓN INVÁLIDA (error de la prueba) ***' when esperado = obtenido then 'ok' else '*** DIFIERE ***' end veredicto, detalle from _r order by n, actor;
do $$
declare v_mal int;
begin
  select count(*) into v_mal from _r where esperado <> obtenido or detalle ~* 'permission denied for table|does not exist|syntax|invalid input|null value|violates (not-null|foreign)';
  if v_mal > 0 then raise exception 'FALLA: % intentos no coinciden con lo esperado', v_mal; end if;
  raise notice 'OK: % intentos coinciden con lo esperado', (select count(*) from _r);
end $$;
rollback;
