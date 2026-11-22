-- Pruebas de la migración 156 (límites de plan en el servidor).
-- Solo contra la base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/limites_plan_156.sql
-- Transacción terminada en ROLLBACK: no deja datos. Cada bloque lanza 'FALLA …' si el comportamiento no es el esperado.
-- Actores (prefijo …0008-): a1 dueño A (ESSENTIAL) · s1 dueño S (STUDIO) · g1 staff de S · x9 intruso.

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create function public._t_err(q text) returns text language plpgsql as $f$
begin execute q; return 'SIN_ERROR'; exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate); end $f$;
create function public._t_rechaza(etiqueta text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 120); end if;
end $f$;
create function public._t_acepta(etiqueta text, q text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if r <> 'SIN_ERROR' then raise exception 'FALLA %: esperaba éxito, obtuvo «%»', etiqueta, left(r, 120); end if;
end $f$;
create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido; end if;
end $f$;
create function public._t_como(uid text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$f$;

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0008-0000000000a1', 'pl-dueno-e@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0008-0000000000b1', 'pl-dueno-s@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0008-0000000000c1', 'pl-staff-s@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0008-0000000000d9', 'pl-intruso@test.local', 'authenticated', 'authenticated', now());
insert into public.perfil (id, nombre, email) values
  ('00000000-0000-0000-0008-0000000000a1', 'Dueño Essential', 'pl-dueno-e@test.local'),
  ('00000000-0000-0000-0008-0000000000b1', 'Dueño Studio', 'pl-dueno-s@test.local'),
  ('00000000-0000-0000-0008-0000000000c1', 'Staff Studio', 'pl-staff-s@test.local'),
  ('00000000-0000-0000-0008-0000000000d9', 'Intruso', 'pl-intruso@test.local')
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0008-0000000001a0', '00000000-0000-0000-0008-0000000000a1', 'Negocio Essential', 'pl-essential', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0008-0000000001b0', '00000000-0000-0000-0008-0000000000b1', 'Negocio Studio', 'pl-studio', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-0008-0000000001a0';
update public.negocio set plan_codigo = 'STUDIO' where id = '00000000-0000-0000-0008-0000000001b0';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values
  ('00000000-0000-0000-0008-0000000002a0', '00000000-0000-0000-0008-0000000001a0', 'Sede E', 'Cra 1', 'Cali', true),
  ('00000000-0000-0000-0008-0000000002b0', '00000000-0000-0000-0008-0000000001b0', 'Sede S', 'Cra 2', 'Cali', true);
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0008-0000000000c1', 'Staff Studio') on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0008-0000000003c1', '00000000-0000-0000-0008-0000000000c1', '00000000-0000-0000-0008-0000000001b0',
   '00000000-0000-0000-0008-0000000002b0', 'ACTIVO', false, 40, now());

-- Valores del plan: tope = incluido.
select public._t_igual('essential tope 1', (select staff_tope_absoluto from public.plan where codigo = 'ESSENTIAL'), 1);
select public._t_igual('studio tope 5', (select staff_tope_absoluto from public.plan where codigo = 'STUDIO'), 5);
select public._t_igual('prestige tope 15', (select staff_tope_absoluto from public.plan where codigo = 'PRESTIGE'), 15);
select public._t_igual('signature tope 50', (select staff_tope_absoluto from public.plan where codigo = 'SIGNATURE'), 50);

-- ── Essential: 1 profesional ────────────────────────────────────────────────
set local role authenticated;
select public._t_como('00000000-0000-0000-0008-0000000000a1');
select public._t_rechaza('essential: comisión no incluida',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001a0', 'uno@test.local', '00000000-0000-0000-0008-0000000002a0', 40)$q$,
  'PLAN_NO_INCLUYE_COMISIONES');
select public._t_acepta('essential: primera invitación sin comisión',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001a0', 'uno@test.local', '00000000-0000-0000-0008-0000000002a0')$q$);
select public._t_rechaza('essential: la segunda invitación se rechaza',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001a0', 'dos@test.local', '00000000-0000-0000-0008-0000000002a0')$q$,
  'PLAN_LIMIT_EXCEEDED');
select public._t_acepta('essential: reinvitar el mismo correo no consume otro cupo',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001a0', 'uno@test.local', '00000000-0000-0000-0008-0000000002a0')$q$);
select public._t_igual('essential: cupo usado 1 de 1',
  (public.cupo_plan_negocio('00000000-0000-0000-0008-0000000001a0')->>'staff_usado')::int, 1);
select public._t_igual('essential: siguiente plan es Studio',
  public.cupo_plan_negocio('00000000-0000-0000-0008-0000000001a0')->>'siguiente_codigo', 'STUDIO');
select public._t_igual('essential: comisiones no incluidas',
  (public.cupo_plan_negocio('00000000-0000-0000-0008-0000000001a0')->>'comisiones')::boolean, false);

-- ── Studio: 5 profesionales (1 vínculo + 4 invitaciones) y comisión permitida ───
select public._t_como('00000000-0000-0000-0008-0000000000b1');
select public._t_acepta('studio: invitación con comisión',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001b0', 's1@test.local', '00000000-0000-0000-0008-0000000002b0', 40)$q$);
select public._t_acepta('studio: 3',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001b0', 's2@test.local', '00000000-0000-0000-0008-0000000002b0')$q$);
select public._t_acepta('studio: 4',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001b0', 's3@test.local', '00000000-0000-0000-0008-0000000002b0')$q$);
select public._t_acepta('studio: 5',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001b0', 's4@test.local', '00000000-0000-0000-0008-0000000002b0')$q$);
select public._t_rechaza('studio: el sexto se rechaza',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001b0', 's5@test.local', '00000000-0000-0000-0008-0000000002b0')$q$,
  'PLAN_LIMIT_EXCEEDED');
select public._t_acepta('studio: promover guardián permitido',
  $q$select public.promover_guardian('00000000-0000-0000-0008-0000000003c1')$q$);

-- ── Guardián en Essential: rechazado ────────────────────────────────────────
reset role;
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0008-0000000000d9', 'Otro') on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso) values
  ('00000000-0000-0000-0008-0000000003e1', '00000000-0000-0000-0008-0000000000d9', '00000000-0000-0000-0008-0000000001a0',
   '00000000-0000-0000-0008-0000000002a0', 'ACTIVO', false, null, now());
set local role authenticated;
select public._t_como('00000000-0000-0000-0008-0000000000a1');
select public._t_rechaza('essential: guardián no incluido',
  $q$select public.promover_guardian('00000000-0000-0000-0008-0000000003e1')$q$, 'PLAN_NO_INCLUYE_GUARDIAN');

-- ── Aislamiento: otro dueño no invita ni lee cupos ajenos ───────────────────
select public._t_como('00000000-0000-0000-0008-0000000000b1');
select public._t_rechaza('intruso no invita en A',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-0008-0000000001a0', 'x@test.local', '00000000-0000-0000-0008-0000000002a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('intruso no lee cupos de A',
  $q$select public.cupo_plan_negocio('00000000-0000-0000-0008-0000000001a0')$q$, 'NO_AUTORIZADO');

reset role;
set local role anon;
select public._t_rechaza('anon no lee cupos', $q$select public.cupo_plan_negocio('00000000-0000-0000-0008-0000000001a0')$q$, 'permission denied');

rollback;
select 'OK: limites_plan_149 — todas las pruebas pasaron' as resultado;
