-- Pruebas de las migraciones 151-154 (roles por capacidades, función central de cupo, perfil profesional del propietario,
-- delegación mínima). Solo contra la base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/roles_151.sql
-- Transacción terminada en ROLLBACK: no deja datos. Cada bloque lanza 'FALLA …' si el comportamiento no es el esperado.
-- La concurrencia real (dos sesiones) y la normalización de datos tienen sus propios scripts: roles_151_concurrencia.sh y
-- roles_155_normalizacion.sh.
-- Negocios: NE essential (propietario atiende) · NS studio (propietario solo administra) · NP prestige (propietario atiende, opcional)
--           NG signature · NX ajeno (intruso) · NEx essential ya en exceso · ND studio con suscripción activa (downgrade) · NE2 essential (alta)

begin;

-- Privilegios REALES, antes del GRANT de conveniencia de abajo (que los taparía): la vista del equipo debe seguir legible por authenticated
-- tras aplicar o revertir 151 (la primera versión de la reversión la dejaba sin SELECT).
do $$ begin
  if not has_table_privilege('authenticated', 'public.vista_staff_negocio', 'select') then raise exception 'FALLA: authenticated sin SELECT en vista_staff_negocio'; end if;
end $$;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create function public._t_err(q text) returns text language plpgsql as $f$
begin execute q; return 'SIN_ERROR'; exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate); end $f$;
create function public._t_rechaza(etiqueta text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 140); end if;
end $f$;
create function public._t_acepta(etiqueta text, q text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if r <> 'SIN_ERROR' then raise exception 'FALLA %: esperaba éxito, obtuvo «%»', etiqueta, left(r, 140); end if;
end $f$;
create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido; end if;
end $f$;
create function public._t_como(uid text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$f$;
-- Lee la capacidad central sin depender del rol del llamador.
create function public._t_cap(p_negocio uuid, p_clave text) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(p_negocio) ->> p_clave)::int;
$f$;
create function public._t_vinculo(p_negocio uuid, p_usuario uuid) returns uuid language sql security definer set search_path = public as $f$
  select id from public.vinculo_staff_negocio where negocio_id = p_negocio and staff_id = p_usuario and estado <> 'RETIRADO' limit 1;
$f$;
create function public._t_inv(p_negocio uuid, p_email text) returns uuid language sql security definer set search_path = public as $f$
  select id from public.invitacion_staff where negocio_id = p_negocio and email = p_email;
$f$;

-- ── Fixtures ────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-000a-0000000000' || x.k)::uuid, 'r151-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','oe'),('b1','os'),('c1','op'),('d1','og'),('e1','adm'),('f1','ab'),('11','u1'),('12','u2'),('13','u3'),('14','u4'),
             ('15','u5'),('16','u6'),('17','u7'),('d9','x9'),('e2','oex'),('e3','ex1'),('e4','ex2'),('e5','od'),('e6','dbar'),('e7','oe2')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-000a-0000000000' || x.k)::uuid, 'R151 ' || x.n, 'r151-' || x.n || '@test.local'
from (values ('a1','oe'),('b1','os'),('c1','op'),('d1','og'),('e1','adm'),('f1','ab'),('11','u1'),('12','u2'),('13','u3'),('14','u4'),
             ('15','u5'),('16','u6'),('17','u7'),('d9','x9'),('e2','oex'),('e3','ex1'),('e4','ex2'),('e5','od'),('e6','dbar'),('e7','oe2')) x(k, n)
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-000a-0000000001a0', '00000000-0000-0000-000a-0000000000a1', 'R151 NE', 'r151-ne', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000b1', 'R151 NS', 'r151-ns', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001c0', '00000000-0000-0000-000a-0000000000c1', 'R151 NP', 'r151-np', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001d0', '00000000-0000-0000-000a-0000000000d1', 'R151 NG', 'r151-ng', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001e0', '00000000-0000-0000-000a-0000000000d9', 'R151 NX', 'r151-nx', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001f0', '00000000-0000-0000-000a-0000000000e2', 'R151 NEx', 'r151-nex', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001b2', '00000000-0000-0000-000a-0000000000e5', 'R151 ND', 'r151-nd', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000a-0000000001a2', '00000000-0000-0000-000a-0000000000e7', 'R151 NE2', 'r151-ne2', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'ESSENTIAL' where id in ('00000000-0000-0000-000a-0000000001a0', '00000000-0000-0000-000a-0000000001e0',
  '00000000-0000-0000-000a-0000000001f0', '00000000-0000-0000-000a-0000000001a2');
update public.negocio set plan_codigo = 'STUDIO' where id in ('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000001b2');
update public.negocio set plan_codigo = 'PRESTIGE' where id = '00000000-0000-0000-000a-0000000001c0';
update public.negocio set plan_codigo = 'SIGNATURE' where id = '00000000-0000-0000-000a-0000000001d0';
-- Alta pendiente en NS y NE2 (para probar completar_onboarding_negocio); el resto ya completo.
update public.negocio set onboarding_completo = false where id in ('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000001a2');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal)
select ('00000000-0000-0000-000a-0000000002' || x.k)::uuid, ('00000000-0000-0000-000a-0000000001' || x.k)::uuid, 'Sede ' || x.k, 'Cra 1', 'Cali', true
from (values ('a0'),('b0'),('c0'),('d0'),('e0'),('f0'),('b2'),('a2')) x(k);
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro) values
  ('00000000-0000-0000-000a-0000000001b0', 'STUDIO', 'TRIAL', now() + interval '14 days'),
  ('00000000-0000-0000-000a-0000000001a2', 'ESSENTIAL', 'TRIAL', now() + interval '14 days'),
  ('00000000-0000-0000-000a-0000000001b2', 'STUDIO', 'ACTIVA', now() + interval '14 days');

insert into public.staff (usuario_id, nombre, foto_url)
select ('00000000-0000-0000-000a-0000000000' || x.k)::uuid, 'R151 ' || x.n, 'https://res.cloudinary.com/demo/image/upload/x.jpg'
from (values ('e1','adm'),('f1','ab'),('11','u1'),('e3','ex1'),('e4','ex2'),('e6','dbar')) x(k, n) on conflict (usuario_id) do nothing;

-- NEx: Essential que YA excede (2 profesionales; el límite es 1). Se inserta como postgres, igual que quedaron los datos antiguos.
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso) values
  ('00000000-0000-0000-000a-0000000003e3', '00000000-0000-0000-000a-0000000000e3', '00000000-0000-0000-000a-0000000001f0', '00000000-0000-0000-000a-0000000002f0', 'ACTIVO', now()),
  ('00000000-0000-0000-000a-0000000003e4', '00000000-0000-0000-000a-0000000000e4', '00000000-0000-0000-000a-0000000001f0', '00000000-0000-0000-000a-0000000002f0', 'ACTIVO', now());
-- ND: Studio con un barbero.
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso) values
  ('00000000-0000-0000-000a-0000000003e6', '00000000-0000-0000-000a-0000000000e6', '00000000-0000-0000-000a-0000000001b2', '00000000-0000-0000-000a-0000000002b2', 'ACTIVO', now());

-- ═══ 1. Valores del plan y configuración ═══════════════════════════════════════════════
select public._t_igual('essential límite 1', public._t_cap('00000000-0000-0000-000a-0000000001a0', 'limite'), 1);
select public._t_igual('studio límite 5', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'limite'), 5);
select public._t_igual('prestige límite 15', public._t_cap('00000000-0000-0000-000a-0000000001c0', 'limite'), 15);
select public._t_igual('signature límite 50', public._t_cap('00000000-0000-0000-000a-0000000001d0', 'limite'), 50);
select public._t_igual('adicionales contratados (Fase 3) suman al límite',
  (public._capacidad_profesional('00000000-0000-0000-000a-0000000001d0', null, 5) ->> 'limite')::int, 55);
select public._t_igual('plan destino evaluable', (public._capacidad_profesional('00000000-0000-0000-000a-0000000001b0', 'ESSENTIAL') ->> 'limite')::int, 1);
select public._t_igual('perfil del propietario por defecto: solo Essential',
  (select string_agg(codigo::text, ',' order by codigo::text) from public.plan where propietario_profesional_por_defecto), 'ESSENTIAL');
select public._t_igual('rol_invitado por defecto', (select column_default from information_schema.columns
  where table_name = 'invitacion_staff' and column_name = 'rol_invitado'), '''BARBER''::text');

-- ═══ 2. Propietario de plan superior: el alta NO lo hace profesional; Essential sí ═════
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_acepta('studio: completa el alta', $q$select public.completar_onboarding_negocio('00000000-0000-0000-000a-0000000001b0')$q$);
select public._t_como('00000000-0000-0000-000a-0000000000e7');
select public._t_acepta('essential: completa el alta', $q$select public.completar_onboarding_negocio('00000000-0000-0000-000a-0000000001a2')$q$);
reset role;
select public._t_igual('studio: propietario sin vínculo operativo tras el alta',
  (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001b0')::int, 0);
select public._t_igual('studio: no ocupa cupo', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 0);
select public._t_igual('essential: propietario habilitado como profesional al completar el alta',
  (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001a2'
     and staff_id = '00000000-0000-0000-000a-0000000000e7' and estado = 'ACTIVO' and presta_servicios and not es_admin)::int, 1);
select public._t_igual('essential: la sede activa es la principal',
  (select sede_activa_id from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001a2'),
  '00000000-0000-0000-000a-0000000002a2'::uuid);
select public._t_igual('essential: ocupa su único cupo', public._t_cap('00000000-0000-0000-000a-0000000001a2', 'ocupados'), 1);
select public._t_igual('essential: la fila staff existe', (select count(*) from public.staff where usuario_id = '00000000-0000-0000-000a-0000000000e7')::int, 1);
select public._t_igual('essential: auditoría del perfil activado',
  (select count(*) from public.evento_auditoria where negocio_id = '00000000-0000-0000-000a-0000000001a2' and accion = 'PERFIL_PROFESIONAL_PROPIETARIO_ACTIVADO')::int, 1);
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000e7');
select public._t_acepta('essential: el alta es idempotente y no duplica el vínculo',
  $q$select public.completar_onboarding_negocio('00000000-0000-0000-000a-0000000001a2')$q$);
select public._t_igual('essential: sigue 1 solo vínculo',
  (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001a2')::int, 1);
select public._t_igual('rol del propietario Essential', public.rol_equipo('00000000-0000-0000-000a-0000000001a2'), 'BUSINESS_OWNER');

-- ═══ 3. Essential (cupo 1): propietario que atiende ═════════════════════════════════════
select public._t_como('00000000-0000-0000-000a-0000000000a1');
select public._t_igual('NE: antes de activar, 0 ocupados', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0') ->> 'ocupados')::int, 0);
select public._t_igual('NE: activar perfil',
  public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0') ->> 'estado', 'ACTIVADO');
select public._t_igual('NE: 1 de 1', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0') ->> 'disponibles')::int, 0);
select public._t_igual('NE: activar es idempotente',
  public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0') ->> 'estado', 'YA_ACTIVO');
select public._t_igual('NE: un solo vínculo', public._t_cap('00000000-0000-0000-000a-0000000001a0', 'activos'), 1);
select public._t_rechaza('NE: sin cupo para un barbero', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'r151-u1@test.local', '00000000-0000-0000-000a-0000000002a0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NE: sin cupo para ADMIN_BARBER', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'r151-u1@test.local', '00000000-0000-0000-000a-0000000002a0', null::numeric, 'ADMIN_BARBER')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_acepta('NE: un BUSINESS_ADMIN NO consume cupo (aunque el cupo esté lleno)',
  $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'r151-adm@test.local', '00000000-0000-0000-000a-0000000002a0', null::numeric, 'BUSINESS_ADMIN')$q$);
select public._t_igual('NE: la invitación a BUSINESS_ADMIN no cuenta', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0') ->> 'invitaciones_pendientes')::int, 0);
select public._t_rechaza('NE: rol inválido', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'r151-u2@test.local', '00000000-0000-0000-000a-0000000002a0', null::numeric, 'OWNER')$q$, 'ROL_INVALIDO');
select public._t_igual('NE: desactivar el perfil',
  public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0') ->> 'estado', 'DESACTIVADO');
select public._t_igual('NE: libera el cupo', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0') ->> 'disponibles')::int, 1);
select public._t_igual('NE: desactivar de nuevo es idempotente',
  public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0') ->> 'estado', 'YA_INACTIVO');
select public._t_acepta('NE: ahora sí invita a un barbero', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'r151-u1@test.local', '00000000-0000-0000-000a-0000000002a0')$q$);
select public._t_rechaza('NE: la invitación pendiente vigente ocupa el cupo e impide reactivar el perfil',
  $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public.cancelar_invitacion(public._t_inv('00000000-0000-0000-000a-0000000001a0', 'r151-u1@test.local'));
select public._t_igual('NE: la invitación cancelada no ocupa cupo', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0') ->> 'disponibles')::int, 1);
select public._t_igual('NE: reactivar el perfil reutiliza el MISMO vínculo (conserva historial)',
  public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0') ->> 'estado', 'ACTIVADO');
select public._t_igual('NE: sigue habiendo una sola fila de vínculo del propietario',
  (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001a0'
     and staff_id = '00000000-0000-0000-000a-0000000000a1')::int, 1);
-- Reservas futuras bloquean la desactivación.
reset role;
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-000a-0000000004a0', '00000000-0000-0000-000a-0000000000e7', '00000000-0000-0000-000a-0000000001a0',
   '00000000-0000-0000-000a-0000000002a0', '00000000-0000-0000-000a-0000000000a1', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000);
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000a1');
select public._t_rechaza('NE: no se desactiva con reservas futuras', $q$select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0')$q$, 'TIENE_RESERVAS_FUTURAS');
reset role;
update public.reserva set estado = 'CANCELADA' where id = '00000000-0000-0000-000a-0000000004a0';
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000a1');
select public._t_acepta('NE: sin reservas futuras sí se desactiva', $q$select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0')$q$);

-- ═══ 4. Studio (cupo 5): propietario solo administra; invitaciones y roles ═════════════
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_acepta('NS: u1', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u1@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_acepta('NS: u2', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u2@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_acepta('NS: u3', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u3@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_rechaza('NS: comisión no aplica a un administrador puro', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-zz@test.local', '00000000-0000-0000-000a-0000000002b0', 40, 'BUSINESS_ADMIN')$q$, 'COMISION_NO_APLICA_A_ADMINISTRADOR');
select public._t_acepta('NS: ADMIN_BARBER consume cupo', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-ab@test.local', '00000000-0000-0000-000a-0000000002b0', null::numeric, 'ADMIN_BARBER')$q$);
select public._t_acepta('NS: BUSINESS_ADMIN no consume', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-adm@test.local', '00000000-0000-0000-000a-0000000002b0', null::numeric, 'BUSINESS_ADMIN')$q$);
select public._t_igual('NS: 4 ocupados (3 BARBER + 1 ADMIN_BARBER)', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001b0') ->> 'ocupados')::int, 4);
select public._t_acepta('NS: u4 (quinto cupo)', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u4@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_rechaza('NS: el sexto se rechaza', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u5@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_acepta('NS: reinvitar un correo ya invitado no consume otro cupo', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u4@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_igual('NS: sigue en 5', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001b0') ->> 'ocupados')::int, 5);

-- Aceptaciones: BUSINESS_ADMIN, ADMIN_BARBER y BARBER; ninguna cuenta doble el cupo.
select public._t_como('00000000-0000-0000-000a-0000000000e1');
select public._t_acepta('adm acepta (BUSINESS_ADMIN)', format($q$select public.aceptar_invitacion_staff(%L, true)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-adm@test.local')));
select public._t_como('00000000-0000-0000-000a-0000000000f1');
select public._t_acepta('ab acepta (ADMIN_BARBER) con el cupo lleno: su propia invitación no cuenta doble',
  format($q$select public.aceptar_invitacion_staff(%L, true)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-ab@test.local')));
select public._t_como('00000000-0000-0000-000a-000000000011');
select public._t_acepta('u1 acepta (BARBER)', format($q$select public.aceptar_invitacion_staff(%L, true)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u1@test.local')));
select public._t_igual('NS: sigue en 5 tras aceptar', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 5);
select public._t_igual('NS: rol BUSINESS_ADMIN', public.rol_equipo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1'), 'BUSINESS_ADMIN');
select public._t_igual('NS: rol ADMIN_BARBER', public.rol_equipo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000f1'), 'ADMIN_BARBER');
select public._t_igual('NS: rol BARBER', public.rol_equipo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011'), 'BARBER');
select public._t_igual('NS: el rol propio se consulta sin parámetro', public.rol_equipo('00000000-0000-0000-000a-0000000001b0'), 'BARBER');
select public._t_igual('NS: activos 2 (ab + u1); el BUSINESS_ADMIN no ocupa', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'activos'), 2);

-- Invitaciones pendientes / vencidas / canceladas / rechazadas.
reset role;
update public.invitacion_staff set expira_at = now() - interval '1 hour' where negocio_id = '00000000-0000-0000-000a-0000000001b0' and email = 'r151-u2@test.local';
select public._t_igual('NS: una invitación vencida deja de ocupar cupo', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 4);
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_acepta('NS: el cupo liberado por vencimiento se puede usar', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u5@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_rechaza('NS: de nuevo lleno', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u6@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public.cancelar_invitacion(public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u3@test.local'));
select public._t_acepta('NS: el cupo liberado por cancelación se puede usar', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u6@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_como('00000000-0000-0000-000a-000000000012');
select public._t_rechaza('NS: aceptar una invitación vencida', format($q$select public.aceptar_invitacion_staff(%L, true)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u2@test.local')), 'INVITACION_EXPIRADA');
select public._t_como('00000000-0000-0000-000a-000000000014');
select public._t_acepta('NS: u4 rechaza su invitación', format($q$select public.responder_invitacion(%L, false)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u4@test.local')));
select public._t_igual('NS: lo rechazado no ocupa', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 4);
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_acepta('NS: u7 usa el cupo rechazado', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-u7@test.local', '00000000-0000-0000-000a-0000000002b0')$q$);
select public._t_igual('NS: lleno (5) otra vez', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'disponibles'), 0);
select public._t_igual('NS: sin exceso', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'exceso'), 0);

-- ═══ 5. Cambiar el rol NO evade el tope ═════════════════════════════════════════════════
select public._t_rechaza('NS: BUSINESS_ADMIN -> BARBER con el cupo lleno',
  format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1')), 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NS: BUSINESS_ADMIN -> ADMIN_BARBER con el cupo lleno',
  format($q$select public.cambiar_rol_equipo(%L, 'ADMIN_BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1')), 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NS: escritura directa (presta_servicios=true) también topada por el disparador',
  format($q$update public.vinculo_staff_negocio set presta_servicios = true where id = %L$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1')), 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NS: invitación directa por la API (sin la función) también topada',
  $q$insert into public.invitacion_staff (negocio_id, email, invitado_por, sede_id) values ('00000000-0000-0000-000a-0000000001b0', 'r151-directa@test.local', auth.uid(), '00000000-0000-0000-000a-0000000002b0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NS: vínculo directo por la API también topado',
  $q$insert into public.vinculo_staff_negocio (staff_id, negocio_id, estado) values ('00000000-0000-0000-000a-0000000000e3', '00000000-0000-0000-000a-0000000001b0', 'ACTIVO')$q$, 'PLAN_LIMIT_EXCEEDED');
-- BARBER -> BUSINESS_ADMIN libera cupo (y se puede volver a BARBER); se bloquea con reservas futuras.
select public._t_acepta('NS: u1 BARBER -> BUSINESS_ADMIN libera cupo',
  format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_igual('NS: 4 ocupados tras liberar', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 4);
select public._t_igual('NS: u1 ahora es BUSINESS_ADMIN', public.rol_equipo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011'), 'BUSINESS_ADMIN');
select public._t_acepta('NS: u1 vuelve a BARBER (hay un cupo libre)',
  format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_igual('NS: otra vez 5', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 5);
select public._t_acepta('NS: cambiar al mismo rol es idempotente',
  format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_rechaza('NS: rol inválido', format($q$select public.cambiar_rol_equipo(%L, 'OWNER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'ROL_INVALIDO');

-- ═══ 6. Visibilidad: el administrador puro no aparece ni se le asignan servicios/citas ═══
reset role;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values
  ('00000000-0000-0000-000a-0000000005b0', '00000000-0000-0000-000a-0000000001b0', 'Corte R151', 30, 20000);
-- adm (BUSINESS_ADMIN) con servicios y disponibilidad HEREDADOS (simula datos antiguos): se desactiva el disparador solo para el fixture.
alter table public.staff_servicio disable trigger trg_staff_servicio_solo_profesionales;
insert into public.staff_servicio (staff_id, servicio_id) values
  ('00000000-0000-0000-000a-0000000000e1', '00000000-0000-0000-000a-0000000005b0'),
  ('00000000-0000-0000-000a-0000000000f1', '00000000-0000-0000-000a-0000000005b0'),
  ('00000000-0000-0000-000a-000000000011', '00000000-0000-0000-000a-0000000005b0');
alter table public.staff_servicio enable trigger trg_staff_servicio_solo_profesionales;
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
select public._t_vinculo('00000000-0000-0000-000a-0000000001b0', u), '00000000-0000-0000-000a-0000000002b0', extract(dow from current_date + 3)::int, '09:00', '12:00'
from (values ('00000000-0000-0000-000a-0000000000e1'::uuid), ('00000000-0000-0000-000a-0000000000f1'), ('00000000-0000-0000-000a-000000000011')) x(u);
-- Publicación autorizada por cada uno (flujo real de consentimiento).
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000e1');
select public.autorizar_staff('AUTORIZACION_STAFF_TRATAMIENTO', 'perfil'); select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil');
select public._t_como('00000000-0000-0000-000a-0000000000f1');
select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil');
select public._t_como('00000000-0000-0000-000a-000000000011');
select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil');
reset role;
update public.staff set foto_url = 'https://res.cloudinary.com/demo/image/upload/x.jpg' where usuario_id in
  ('00000000-0000-0000-000a-0000000000e1', '00000000-0000-0000-000a-0000000000f1', '00000000-0000-0000-000a-000000000011');
select public._t_igual('el BUSINESS_ADMIN SÍ es publicable por consentimiento (la exclusión es por presta_servicios)',
  public.staff_es_publicable('00000000-0000-0000-000a-0000000000e1', '00000000-0000-0000-000a-0000000001b0'), true);
set local role anon;
select public._t_igual('negocio_staff_publico: aparecen ab y u1 (presta servicios)',
  (select count(*) from public.negocio_staff_publico('00000000-0000-0000-000a-0000000001b0'))::int, 2);
select public._t_igual('negocio_staff_publico: el BUSINESS_ADMIN no aparece',
  (select count(*) from public.negocio_staff_publico('00000000-0000-0000-000a-0000000001b0') where staff_id = '00000000-0000-0000-000a-0000000000e1')::int, 0);
select public._t_igual('slots_disponibles: solo profesionales (adm excluido)',
  (select count(distinct staff_id) from public.slots_disponibles('00000000-0000-0000-000a-0000000002b0', array['00000000-0000-0000-000a-0000000005b0']::uuid[], current_date + 3))::int, 2);
select public._t_igual('slots_disponibles: adm no genera horarios aunque lo pidan por id',
  (select count(*) from public.slots_disponibles('00000000-0000-0000-000a-0000000002b0', array['00000000-0000-0000-000a-0000000005b0']::uuid[], current_date + 3,
     '00000000-0000-0000-000a-0000000000e1'))::int, 0);
select public._t_igual('slots_disponibles: u1 sí tiene horarios',
  (select count(*) > 0 from public.slots_disponibles('00000000-0000-0000-000a-0000000002b0', array['00000000-0000-0000-000a-0000000005b0']::uuid[], current_date + 3,
     '00000000-0000-0000-000a-000000000011')), true);
select public._t_igual('perfil público de staff (tabla): el BUSINESS_ADMIN no se ve para anon',
  (select count(*) from public.staff where usuario_id = '00000000-0000-0000-000a-0000000000e1')::int, 0);
select public._t_igual('perfil público de staff (tabla): u1 sí', (select count(*) from public.staff where usuario_id = '00000000-0000-0000-000a-000000000011')::int, 1);
select public._t_igual('staff_perfil_publico: BUSINESS_ADMIN nulo', public.staff_perfil_publico('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1') is null, true);
reset role;
-- No se le asignan servicios ni reservas.
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_rechaza('no se asignan servicios a un BUSINESS_ADMIN',
  $q$insert into public.staff_servicio (staff_id, servicio_id) values ('00000000-0000-0000-000a-0000000000e1', '00000000-0000-0000-000a-0000000005b0') on conflict do nothing$q$, 'STAFF_NO_PRESTA_SERVICIOS');
reset role;
select public._t_rechaza('no se asignan reservas a un BUSINESS_ADMIN',
  $q$insert into public.reserva (cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, monto_total, monto_sena) values
     ('00000000-0000-0000-000a-0000000000e7', '00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000002b0',
      '00000000-0000-0000-000a-0000000000e1', now() + interval '50 hours', now() + interval '51 hours', 1, 0)$q$, 'STAFF_NO_PRESTA_SERVICIOS');
-- Reserva futura de u1: bloquea BARBER -> BUSINESS_ADMIN.
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-000a-0000000004b0', '00000000-0000-0000-000a-0000000000e7', '00000000-0000-0000-000a-0000000001b0',
   '00000000-0000-0000-000a-0000000002b0', '00000000-0000-0000-000a-000000000011', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000);
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_rechaza('NS: no se pasa a BUSINESS_ADMIN a quien tiene reservas futuras',
  format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'TIENE_RESERVAS_FUTURAS');

-- ═══ 7. Permisos de cada rol ═══════════════════════════════════════════════════════════
-- BUSINESS_ADMIN (e1)
select public._t_como('00000000-0000-0000-000a-0000000000e1');
select public._t_igual('adm: lee la capacidad', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001b0') ->> 'limite')::int, 5);
select public._t_igual('adm: lee cupo_plan_negocio', (public.cupo_plan_negocio('00000000-0000-0000-000a-0000000001b0') ->> 'plan_codigo'), 'STUDIO');
select public._t_igual('adm: ve el equipo (vista, RLS)', (select count(*) from public.vista_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001b0')::int, 3);
select public._t_igual('adm: la vista expone las capacidades', (select presta_servicios from public.vista_staff_negocio where staff_id = '00000000-0000-0000-000a-0000000000e1'), false);
select public._t_igual('adm: ve las invitaciones del negocio', (select count(*) > 0 from public.invitacion_staff where negocio_id = '00000000-0000-0000-000a-0000000001b0'), true);
select public._t_rechaza('adm: invita BARBER (autorizado; el cupo está lleno)', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-nuevo@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('adm: NO invita BUSINESS_ADMIN', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-nuevo@test.local', '00000000-0000-0000-000a-0000000002b0', null::numeric, 'BUSINESS_ADMIN')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO invita ADMIN_BARBER', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-nuevo@test.local', '00000000-0000-0000-000a-0000000002b0', null::numeric, 'ADMIN_BARBER')$q$, 'NO_AUTORIZADO');
select public._t_acepta('adm: suspende a un BARBER', format($q$select public.suspender_staff(%L, 'prueba')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_igual('adm: un suspendido SIGUE ocupando cupo (no se evade suspendiendo)', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'suspendidos'), 1);
select public._t_igual('adm: y el cupo total no cambió', public._t_cap('00000000-0000-0000-000a-0000000001b0', 'ocupados'), 5);
select public._t_acepta('adm: reactiva', format($q$select public.reactivar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_acepta('adm: traslada a un BARBER', format($q$select public.trasladar_staff(%L, '00000000-0000-0000-000a-0000000002b0')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_rechaza('adm: NO suspende a otro administrador (ADMIN_BARBER)', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000f1')), 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO se retira a sí mismo', format($q$select public.retirar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1')), 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO cambia roles', format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO activa el perfil profesional del propietario', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO desactiva el perfil del propietario', $q$select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO promueve Guardian', format($q$select public.promover_guardian(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
select public._t_rechaza('adm: NO escribe directo en vínculos', format($q$update public.vinculo_staff_negocio set es_admin = true where id = %L$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'SIN_ERROR');
select public._t_igual('adm: ... esa escritura directa no cambió nada (RLS la filtra)',
  (select es_admin from public.vinculo_staff_negocio where id = public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), false);
-- BARBER (u1)
select public._t_como('00000000-0000-0000-000a-000000000011');
select public._t_rechaza('barber: NO invita', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-nuevo@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('barber: NO cambia roles', format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
select public._t_rechaza('barber: NO suspende', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000f1')), 'NO_AUTORIZADO');
select public._t_igual('barber: no es administrador', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), false);
-- ADMIN_BARBER (ab): administra Y atiende
select public._t_como('00000000-0000-0000-000a-0000000000f1');
select public._t_igual('ab: es administrador', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), true);
select public._t_acepta('ab: suspende a un BARBER', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_acepta('ab: reactiva', format($q$select public.reactivar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')));
select public._t_rechaza('ab: NO cambia roles', format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
-- Un administrador suspendido pierde la delegación.
reset role;
update public.vinculo_staff_negocio set estado = 'SUSPENDIDO' where id = public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1');
set local role authenticated;
select public._t_como('00000000-0000-0000-000a-0000000000e1');
select public._t_igual('adm suspendido: ya no es administrador', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), false);
select public._t_rechaza('adm suspendido: no invita', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-nuevo@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'NO_AUTORIZADO');
-- Propietario: gestiona todo lo de su negocio.
select public._t_como('00000000-0000-0000-000a-0000000000b1');
select public._t_igual('propietario: is_admin_de', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), true);
select public._t_igual('propietario: is_barberia_de intacto', public.is_barberia_de('00000000-0000-0000-000a-0000000001b0'), true);
select public._t_como('00000000-0000-0000-000a-0000000000f1');
select public._t_igual('un administrador NO es is_barberia_de (facturación y propiedad siguen del propietario)', public.is_barberia_de('00000000-0000-0000-000a-0000000001b0'), false);

-- ═══ 8. Prestige: propietario que atiende de forma opcional ═══════════════════════════
select public._t_como('00000000-0000-0000-000a-0000000000c1');
select public._t_igual('NP: 0 de 15 al iniciar', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001c0') ->> 'limite')::int, 15);
select public._t_igual('NP: activa su perfil (opcional)', public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001c0') ->> 'estado', 'ACTIVADO');
select public._t_igual('NP: consume 1', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001c0') ->> 'ocupados')::int, 1);
select public._t_igual('NP: sigue siendo BUSINESS_OWNER aunque atienda', public.rol_equipo('00000000-0000-0000-000a-0000000001c0'), 'BUSINESS_OWNER');
select public._t_rechaza('NP: su rol no se cambia con cambiar_rol_equipo', format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001c0', '00000000-0000-0000-000a-0000000000c1')), 'ROL_PROPIETARIO_NO_CAMBIA');
select public._t_igual('NP: la vista muestra su perfil profesional',
  (select presta_servicios from public.vista_staff_negocio where staff_id = '00000000-0000-0000-000a-0000000000c1'), true);

-- ═══ 9. Exceso ya existente (Essential 2/1): no se borra a nadie, solo se impide agregar ═══
select public._t_como('00000000-0000-0000-000a-0000000000e2');
select public._t_igual('NEx: exceso 1', (public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001f0') ->> 'exceso')::int, 1);
select public._t_igual('NEx: nadie fue retirado', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001f0' and estado = 'ACTIVO')::int, 2);
select public._t_rechaza('NEx: no invita más', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001f0', 'r151-u1@test.local', '00000000-0000-0000-000a-0000000002f0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NEx: no activa su propio perfil (evadiría el tope)', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001f0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_rechaza('NEx: id inexistente -> NO_AUTORIZADO', $q$select public.suspender_staff('00000000-0000-0000-000a-00000000ffff')$q$, 'NO_AUTORIZADO');

-- ═══ 10. Downgrade usa el mismo criterio central ════════════════════════════════════════
select public._t_como('00000000-0000-0000-000a-0000000000e5');
select public._t_acepta('ND: activa su perfil (1 barbero + propietario = 2)', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b2')$q$);
select public._t_rechaza('ND: bajar a Essential con 2 profesionales (el propietario cuenta)', $q$select public.solicitar_downgrade_plan('00000000-0000-0000-000a-0000000001b2', 'ESSENTIAL')$q$, 'EXCEDE_LIMITE_STAFF');
select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b2');
select public._t_acepta('ND: con solo el barbero (propietario solo administra) sí puede bajar', $q$select public.solicitar_downgrade_plan('00000000-0000-0000-000a-0000000001b2', 'ESSENTIAL')$q$);

-- ═══ 11. IDOR: el propietario de otro negocio no puede nada ═══════════════════════════
select public._t_como('00000000-0000-0000-000a-0000000000d9');
select public._t_rechaza('IDOR: activar perfil en negocio ajeno', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: desactivar perfil en negocio ajeno', $q$select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: cambiar rol ajeno', format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: invitar en negocio ajeno', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001b0', 'r151-x@test.local', '00000000-0000-0000-000a-0000000002b0', null::numeric, 'BUSINESS_ADMIN')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: invitar con sede de otro negocio', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001e0', 'r151-x@test.local', '00000000-0000-0000-000a-0000000002b0')$q$, 'SEDE_NO_PERTENECE_AL_NEGOCIO');
select public._t_rechaza('IDOR: leer capacidad ajena', $q$select public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: leer cupo ajeno', $q$select public.cupo_plan_negocio('00000000-0000-0000-000a-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: leer rol ajeno', $q$select public.rol_equipo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-0000000000e1')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: suspender staff ajeno', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: cancelar invitación ajena', format($q$select public.cancelar_invitacion(%L)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u7@test.local')), 'NO_AUTORIZADO');
select public._t_igual('IDOR: no ve el equipo ajeno (RLS)', (select count(*) from public.vista_staff_negocio where negocio_id = '00000000-0000-0000-000a-0000000001b0')::int, 0);
select public._t_igual('IDOR: no ve invitaciones ajenas (RLS)', (select count(*) from public.invitacion_staff where negocio_id = '00000000-0000-0000-000a-0000000001b0')::int, 0);
select public._t_igual('IDOR: no es administrador del negocio ajeno', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), false);
select public._t_rechaza('IDOR: helper interno no invocable', format($q$select public._puede_gestionar_vinculo(%L)$q$, public._t_vinculo('00000000-0000-0000-000a-0000000001b0', '00000000-0000-0000-000a-000000000011')), 'permission denied');
select public._t_rechaza('IDOR: función central interna no invocable', $q$select public._capacidad_profesional('00000000-0000-0000-000a-0000000001b0')$q$, 'permission denied');
select public._t_rechaza('IDOR: aceptar la invitación de otro correo', format($q$select public.aceptar_invitacion_staff(%L, true)$q$, public._t_inv('00000000-0000-0000-000a-0000000001b0', 'r151-u7@test.local')), 'NO_AUTORIZADO');

-- ═══ 12. REVOKE de public/anon/authenticated verificado (los tres son independientes) ═══
reset role;
create function public._t_acl(p_firma text, p_rol text) returns boolean language sql security definer set search_path = public as $f$
  select case p_rol
    when 'public' then exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = p_firma::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE')
    else has_function_privilege(p_rol, p_firma::regprocedure, 'execute') end;
$f$;
-- Internas: nadie las llama desde la API.
select public._t_igual('internas cerradas a public/anon/authenticated: ' || f,
  public._t_acl(f, 'public') or public._t_acl(f, 'anon') or public._t_acl(f, 'authenticated'), false)
from unnest(array['public._capacidad_profesional(uuid,text,integer,text)', 'public._cupo_bloquear(uuid)',
  'public._activar_perfil_propietario(uuid,uuid,boolean)', 'public._rol_equipo(uuid,uuid)',
  'public._puede_gestionar_vinculo(uuid)', 'public._puede_gestionar_invitacion(uuid)',
  'public.trg_vinculo_cupo()', 'public.trg_invitacion_cupo()', 'public.trg_staff_servicio_solo_profesionales()',
  'public.trg_reserva_solo_profesionales()']) f;
-- RPC de usuario: authenticated sí; public y anon no.
select public._t_igual('RPC: authenticated puede, public/anon no: ' || f,
  public._t_acl(f, 'authenticated') and not public._t_acl(f, 'public') and not public._t_acl(f, 'anon'), true)
from unnest(array['public.capacidad_profesional_negocio(uuid)', 'public.cambiar_rol_equipo(uuid,text)',
  'public.activar_perfil_profesional_propietario(uuid)', 'public.desactivar_perfil_profesional_propietario(uuid)',
  'public.rol_equipo(uuid,uuid)', 'public.crear_invitacion_staff(uuid,text,uuid,numeric,text)', 'public.cupo_plan_negocio(uuid)']) f;
select public._t_igual('is_admin_de: sin grant a public (solo anon y authenticated, requeridos por las políticas RLS)',
  public._t_acl('public.is_admin_de(uuid)', 'public'), false);
select public._t_igual('no queda la firma vieja de crear_invitacion_staff (evita la sobrecarga ambigua)',
  to_regprocedure('public.crear_invitacion_staff(uuid,text,uuid,numeric)') is null, true);
set local role anon;
select public._t_rechaza('anon no activa perfiles', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000a-0000000001a0')$q$, 'permission denied');
select public._t_rechaza('anon no cambia roles', $q$select public.cambiar_rol_equipo('00000000-0000-0000-000a-0000000003e3', 'BARBER')$q$, 'permission denied');
select public._t_rechaza('anon no lee capacidad', $q$select public.capacidad_profesional_negocio('00000000-0000-0000-000a-0000000001a0')$q$, 'permission denied');
select public._t_rechaza('anon no invita', $q$select public.crear_invitacion_staff('00000000-0000-0000-000a-0000000001a0', 'x@test.local', '00000000-0000-0000-000a-0000000002a0')$q$, 'permission denied');
select public._t_igual('anon: is_admin_de es falso (auth.uid() nulo)', public.is_admin_de('00000000-0000-0000-000a-0000000001b0'), false);
select public._t_igual('anon: no ve vínculos (la política con is_admin_de no lanza)', (select count(*) from public.vinculo_staff_negocio)::int, 0);

rollback;
select 'OK: roles_151 — todas las pruebas pasaron' as resultado;
