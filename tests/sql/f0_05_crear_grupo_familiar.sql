-- F0-05 · crear_grupo_familiar: autorización por negocio y límites del descuento (RPC directa, sin pasar por la interfaz).
-- ACTUALIZADO en 139: por directriz del propietario los grupos familiares NO son mecanismo de descuento; todo descuento distinto de 0 se rechaza (casos 21, 23 y 24, antes PERMITIDO, ahora DENEGADO).
-- Base LOCAL con datos ficticios; todo termina en ROLLBACK. Imprime una fila por caso (actor, llamada, esperado, obtenido) y
-- falla (exit code ≠ 0) si alguno no coincide con lo esperado.
--   Reglas que verifica (decisión de seguridad, no regla comercial nueva):
--     · amarrar el grupo a un negocio exige relación autorizada: dueño, personal del negocio, cliente con reserva en él, o Super Admin;
--     · un descuento ≠ 0 solo lo fija el dueño del negocio o el Super Admin; nunca un cliente ni un tercero;
--     · el descuento es un porcentaje 0–100 y no puede ser NULL; los demás casos se rechazan en el servidor aunque la interfaz no lo permita.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;

-- Actores ficticios (todos distintos; ids 00000000-…-f05-…)
create temp table _a (alias text primary key, id uuid);
insert into _a values
  ('super',    '00000000-0000-0000-0f05-000000000001'),
  ('dueno',    '00000000-0000-0000-0f05-000000000002'),
  ('guardian', '00000000-0000-0000-0f05-000000000003'),
  ('pro',      '00000000-0000-0000-0f05-000000000004'),
  ('cliente',  '00000000-0000-0000-0f05-000000000005'),
  ('intruso',  '00000000-0000-0000-0f05-000000000006'),
  ('dueno_m',  '00000000-0000-0000-0f05-000000000007');
grant select on _a to authenticated, anon;

insert into auth.users (id, email, aud, role) select id, alias || '@f05.test', 'authenticated', 'authenticated' from _a;
insert into public.perfil (id, nombre, es_supersu) select id, alias, alias = 'super' from _a on conflict (id) do update set es_supersu = excluded.es_supersu;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0f05-0000000000a0', '00000000-0000-0000-0f05-000000000002', 'Negocio N', 'f05-n', 'Cali', 'CO'),
  ('00000000-0000-0000-0f05-0000000000b0', '00000000-0000-0000-0f05-000000000007', 'Negocio M', 'f05-m', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0f05-0000000000a1', '00000000-0000-0000-0f05-0000000000a0', 'Sede N', 'x', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id in ('00000000-0000-0000-0f05-0000000000a0', '00000000-0000-0000-0f05-0000000000b0');
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0f05-000000000003', 'G'), ('00000000-0000-0000-0f05-000000000004', 'P');
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0f05-000000000003', '00000000-0000-0000-0f05-0000000000a0', '00000000-0000-0000-0f05-0000000000a1', 'ACTIVO', true,  40, now()),
  ('00000000-0000-0000-0f05-000000000004', '00000000-0000-0000-0f05-0000000000a0', '00000000-0000-0000-0f05-0000000000a1', 'ACTIVO', false, 40, now());
insert into public.reserva (cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0f05-000000000005', '00000000-0000-0000-0f05-0000000000a0', '00000000-0000-0000-0f05-0000000000a1', now() + interval '3 days', now() + interval '3 days 1 hour', 'CONFIRMADA', 30000, 0);

create temp table _res (n int, actor text, llamada text, esperado text, obtenido text, detalle text);
grant all on _res to authenticated, anon;

-- Ejecuta la RPC como `p_actor` dentro de una subtransacción que SIEMPRE se revierte (no deja grupos creados).
create or replace function pg_temp.intentar(p_n int, p_actor text, p_llamada text, p_esperado text, p_neg uuid, p_pct numeric, p_rol text default 'authenticated')
returns void language plpgsql as $$
declare v_id uuid; v_obt text := 'PERMITIDO'; v_det text := '';
begin
  select id into v_id from _a where alias = p_actor;
  begin
    execute format('set local role %I', p_rol);
    perform set_config('request.jwt.claims', case when v_id is null then '{"role":"anon"}' else json_build_object('sub', v_id, 'role', p_rol)::text end, true);
    perform public.crear_grupo_familiar('Grupo prueba', p_neg, 4, p_pct);
    raise exception 'REVERTIR_PRUEBA';
  exception when others then
    if sqlerrm <> 'REVERTIR_PRUEBA' then v_obt := 'DENEGADO'; v_det := left(sqlerrm, 80); end if;
  end;
  insert into _res values (p_n, p_actor, p_llamada, p_esperado, v_obt, v_det);
end $$;

\set N '00000000-0000-0000-0f05-0000000000a0'
\set M '00000000-0000-0000-0f05-0000000000b0'
\set NADA '00000000-0000-0000-0f05-0000000000ff'

\o /dev/null
-- ── Sin negocio y sin descuento (el uso real de la interfaz): lo puede hacer cualquier autenticado ─────────────────────────
select pg_temp.intentar(1,  'intruso',  'sin negocio, 0%',                      'PERMITIDO', null, 0);
select pg_temp.intentar(2,  'cliente',  'sin negocio, 0%',                      'PERMITIDO', null, 0);
-- ── Negocio ajeno: solo con relación autorizada ──────────────────────────────────────────────────────────────────────────
select pg_temp.intentar(3,  'intruso',  'negocio N, 0%',                        'DENEGADO',  :'N', 0);
select pg_temp.intentar(4,  'cliente',  'negocio N (con reserva en N), 0%',     'PERMITIDO', :'N', 0);
select pg_temp.intentar(5,  'cliente',  'negocio M (sin relación con M), 0%',   'DENEGADO',  :'M', 0);
select pg_temp.intentar(6,  'pro',      'negocio N (su negocio), 0%',           'PERMITIDO', :'N', 0);
select pg_temp.intentar(7,  'pro',      'negocio M (otro negocio), 0%',         'DENEGADO',  :'M', 0);
select pg_temp.intentar(8,  'guardian', 'negocio N (su negocio), 0%',           'PERMITIDO', :'N', 0);
select pg_temp.intentar(9,  'guardian', 'negocio M (otro negocio), 0%',         'DENEGADO',  :'M', 0);
select pg_temp.intentar(10, 'dueno',    'negocio N (propio), 0%',               'PERMITIDO', :'N', 0);
select pg_temp.intentar(11, 'dueno',    'negocio M (de otro dueño), 0%',        'DENEGADO',  :'M', 0);
select pg_temp.intentar(12, 'super',    'negocio N, 0%',                        'PERMITIDO', :'N', 0);
select pg_temp.intentar(13, 'super',    'negocio M, 0%',                        'PERMITIDO', :'M', 0);
select pg_temp.intentar(14, 'dueno',    'negocio inexistente, 0%',              'DENEGADO',  :'NADA', 0);
select pg_temp.intentar(15, 'super',    'negocio inexistente, 0%',              'DENEGADO',  :'NADA', 0);
-- ── Descuento: solo dueño del negocio o Super Admin; siempre entre 0 y 100 ───────────────────────────────────────────────
select pg_temp.intentar(16, 'cliente',  'negocio N, 15%',                       'DENEGADO',  :'N', 15);
select pg_temp.intentar(17, 'cliente',  'sin negocio, 15%',                     'DENEGADO',  null, 15);
select pg_temp.intentar(18, 'intruso',  'negocio N, 15%',                       'DENEGADO',  :'N', 15);
select pg_temp.intentar(19, 'pro',      'negocio N, 15%',                       'DENEGADO',  :'N', 15);
select pg_temp.intentar(20, 'guardian', 'negocio N, 15%',                       'DENEGADO',  :'N', 15);
select pg_temp.intentar(21, 'dueno',    'negocio N, 15%',                       'DENEGADO' , :'N', 15);
select pg_temp.intentar(22, 'dueno',    'negocio M (ajeno), 15%',               'DENEGADO',  :'M', 15);
select pg_temp.intentar(23, 'super',    'negocio N, 15%',                       'DENEGADO' , :'N', 15);
select pg_temp.intentar(24, 'dueno',    'negocio N, 100%',                      'DENEGADO' , :'N', 100);
select pg_temp.intentar(25, 'dueno',    'negocio N, 100.01%',                   'DENEGADO',  :'N', 100.01);
select pg_temp.intentar(26, 'dueno',    'negocio N, 999.99%',                    'DENEGADO',  :'N', 999.99);
select pg_temp.intentar(27, 'dueno',    'negocio N, -5%',                       'DENEGADO',  :'N', -5);
select pg_temp.intentar(28, 'super',    'negocio N, -5%',                       'DENEGADO',  :'N', -5);
select pg_temp.intentar(29, 'dueno',    'negocio N, NULL%',                     'DENEGADO',  :'N', null);
select pg_temp.intentar(30, 'cliente',  'sin negocio, -50% (descuento negativo)', 'DENEGADO', null, -50);
-- ── Anónimo (sin sesión) ─────────────────────────────────────────────────────────────────────────────────────────────────
select pg_temp.intentar(31, 'anonimo',  'sin negocio, 0%',                      'DENEGADO',  null, 0, 'anon');
select pg_temp.intentar(32, 'anonimo',  'negocio N, 15%',                       'DENEGADO',  :'N', 15, 'anon');

reset role;
\o
\echo ''
\echo '== F0-05 · resultados por caso =='
select n, actor, llamada, esperado, obtenido, case when esperado = obtenido then 'ok' else '*** DIFIERE ***' end as veredicto, detalle from _res order by n;

-- ── Escrituras directas a la tabla (saltándose la RPC): deben seguir bloqueadas por RLS ──────────────────────────────────
create temp table _dir (n int, llamada text, esperado text, obtenido text);
grant all on _dir to authenticated;
do $$
declare v_obt text;
begin
  -- como intruso: INSERT directo con negocio ajeno y descuento
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0f05-000000000006","role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into public.familia_grupo (titular_cliente_id, negocio_id, nombre, descuento_familiar_pct)
    values ('00000000-0000-0000-0f05-000000000006', '00000000-0000-0000-0f05-0000000000a0', 'directo', 99);
    v_obt := 'PERMITIDO';
  exception when others then v_obt := 'DENEGADO'; end;
  reset role;
  insert into _dir values (101, 'INSERT directo en familia_grupo (negocio ajeno, 99%) como intruso', 'DENEGADO', v_obt);
end $$;
do $$
declare v_obt text; v_g uuid;
begin
  -- titular legítimo crea un grupo sin descuento y luego intenta subirse el descuento con UPDATE directo
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0f05-000000000005","role":"authenticated"}', true);
  set local role authenticated;
  v_g := (public.crear_grupo_familiar('Mi grupo', null, 4, 0)).id;
  begin
    update public.familia_grupo set descuento_familiar_pct = 50 where id = v_g;
    -- un UPDATE sin política de UPDATE no falla: afecta 0 filas; se mide por efecto
    reset role;
    select case when descuento_familiar_pct = 50 then 'PERMITIDO' else 'DENEGADO' end into v_obt from public.familia_grupo where id = v_g;
  exception when others then v_obt := 'DENEGADO'; reset role; end;
  insert into _dir values (102, 'UPDATE directo del descuento a 50% por el propio titular', 'DENEGADO', v_obt);
end $$;
reset role;
select n, llamada, esperado, obtenido, case when esperado = obtenido then 'ok' else '*** DIFIERE ***' end as veredicto from _dir order by n;

do $$
declare v_mal int; v_mal2 int;
begin
  select count(*) into v_mal from _res where esperado <> obtenido;
  select count(*) into v_mal2 from _dir where esperado <> obtenido;
  if v_mal + v_mal2 > 0 then
    raise exception 'FALLA F0-05: % casos de RPC y % de escritura directa no coinciden con lo esperado', v_mal, v_mal2;
  end if;
  raise notice 'OK F0-05: % casos de RPC + % de escritura directa coinciden con lo esperado', (select count(*) from _res), (select count(*) from _dir);
end $$;
rollback;
