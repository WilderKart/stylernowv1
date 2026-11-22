-- Pruebas de 155 (invalidación de sesión controlada), configuración del perfil del propietario por plan (153), suspendidos que ocupan
-- cupo (152), alcance mínimo de BUSINESS_ADMIN (154) y publicación del profesional (foto + consentimiento). Solo base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/roles_155_config_sesion_publicacion.sql
-- Transacción terminada en ROLLBACK. NO desactiva ningún trigger de seguridad. Un único SuperSU: se desciende al existente dentro de la transacción.
-- Actores (prefijo 000d-): O dueño Studio · A BUSINESS_ADMIN · B1/B2 barberos · X dueño ajeno · S SuperSU · E dueño Essential.

begin;
update public.perfil set es_supersu = false where es_supersu;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create function public._t_err(q text) returns text language plpgsql as $f$
begin execute q; return 'SIN_ERROR'; exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate); end $f$;
create function public._t_rechaza(etiqueta text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 160); end if;
end $f$;
create function public._t_acepta(etiqueta text, q text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if r <> 'SIN_ERROR' then raise exception 'FALLA %: esperaba éxito, obtuvo «%»', etiqueta, left(r, 160); end if;
end $f$;
create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido; end if;
end $f$;
create function public._t_como(uid text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$f$;
create function public._t_sv(p_usuario uuid) returns int language sql security definer set search_path = public as $f$
  select session_version from public.perfil where id = p_usuario;
$f$;
create function public._t_vinculo(p_negocio uuid, p_usuario uuid) returns uuid language sql security definer set search_path = public as $f$
  select id from public.vinculo_staff_negocio where negocio_id = p_negocio and staff_id = p_usuario and estado <> 'RETIRADO' limit 1;
$f$;
create function public._t_cap(p_negocio uuid, p_clave text) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(p_negocio) ->> p_clave)::int;
$f$;

-- ── Fixtures ────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-000d-0000000000' || x.k)::uuid, 's155-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','o'),('a2','a'),('a3','b1'),('a4','b2'),('a5','x'),('a6','s'),('a7','e'),('a8','n')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-000d-0000000000' || x.k)::uuid, 'S155 ' || x.n, 's155-' || x.n || '@test.local'
from (values ('a1','o'),('a2','a'),('a3','b1'),('a4','b2'),('a5','x'),('a6','s'),('a7','e'),('a8','n')) x(k, n)
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-000d-0000000000a6';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a1', 'S155 NS', 's155-ns', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000d-0000000001b0', '00000000-0000-0000-000d-0000000000a5', 'S155 NX', 's155-nx', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000d-0000000001c0', '00000000-0000-0000-000d-0000000000a7', 'S155 NE', 's155-ne', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000d-0000000001d0', '00000000-0000-0000-000d-0000000000a8', 'S155 NN', 's155-nn', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'STUDIO' where id in ('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000001b0', '00000000-0000-0000-000d-0000000001d0');
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-000d-0000000001c0';
update public.negocio set onboarding_completo = false where id = '00000000-0000-0000-000d-0000000001d0';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values
  ('00000000-0000-0000-000d-0000000002a0', '00000000-0000-0000-000d-0000000001a0', 'Sede 1', 'Cra 1', 'Cali', true),
  ('00000000-0000-0000-000d-0000000002a1', '00000000-0000-0000-000d-0000000001a0', 'Sede 2', 'Cra 2', 'Cali', false),
  ('00000000-0000-0000-000d-0000000002b0', '00000000-0000-0000-000d-0000000001b0', 'Sede X', 'Cra 3', 'Cali', true),
  ('00000000-0000-0000-000d-0000000002c0', '00000000-0000-0000-000d-0000000001c0', 'Sede E', 'Cra 4', 'Cali', true),
  ('00000000-0000-0000-000d-0000000002d0', '00000000-0000-0000-000d-0000000001d0', 'Sede N', 'Cra 5', 'Cali', true);
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro) values
  ('00000000-0000-0000-000d-0000000001a0', 'STUDIO', 'ACTIVA', now() + interval '20 days'),
  ('00000000-0000-0000-000d-0000000001d0', 'STUDIO', 'TRIAL', now() + interval '20 days');
insert into public.staff (usuario_id, nombre) values
  ('00000000-0000-0000-000d-0000000000a2', 'S155 a'), ('00000000-0000-0000-000d-0000000000a3', 'S155 b1'), ('00000000-0000-0000-000d-0000000000a4', 'S155 b2');
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_admin, presta_servicios, fecha_ingreso) values
  ('00000000-0000-0000-000d-0000000003a2', '00000000-0000-0000-000d-0000000000a2', '00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000002a0', 'ACTIVO', true, false, now()),
  ('00000000-0000-0000-000d-0000000003a3', '00000000-0000-0000-000d-0000000000a3', '00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000002a0', 'ACTIVO', false, true, now()),
  ('00000000-0000-0000-000d-0000000003a4', '00000000-0000-0000-000d-0000000000a4', '00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000002a0', 'ACTIVO', false, true, now());

-- ═══ 1. session_version: ningún usuario normal lo modifica; la vía autorizada sí funciona ═══════
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');  -- propietario
select public._t_rechaza('owner: session_version propio directo', $q$update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-000d-0000000000a1'$q$, 'session_version no se puede modificar');
select public._t_como('00000000-0000-0000-000d-0000000000a2');  -- administrador
select public._t_rechaza('admin: session_version propio directo', $q$update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-000d-0000000000a2'$q$, 'session_version no se puede modificar');
select public._t_como('00000000-0000-0000-000d-0000000000a3');  -- barbero
select public._t_rechaza('barbero: session_version propio directo', $q$update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-000d-0000000000a3'$q$, 'session_version no se puede modificar');
select public._t_como('00000000-0000-0000-000d-0000000000a5');  -- dueño ajeno
select public._t_rechaza('ajeno: session_version propio directo', $q$update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-000d-0000000000a5'$q$, 'session_version no se puede modificar');
-- Segundo factor: aunque el cliente se ponga la marca de la transacción él mismo, sigue bloqueado (current_user = authenticated).
select public._t_rechaza('ajeno: marca autoescrita + UPDATE directo',
  $q$do $b$ begin perform set_config('stylernow.sv_autorizado', 'on', true); update public.perfil set session_version = session_version + 1 where id = '00000000-0000-0000-000d-0000000000a5'; end $b$$q$, 'session_version no se puede modificar');
select public._t_rechaza('barbero: tampoco la de otro', $q$update public.perfil set session_version = 999 where id = '00000000-0000-0000-000d-0000000000a1'$q$, 'SIN_ERROR');  -- RLS: 0 filas
reset role;
select public._t_igual('la sesión del dueño no cambió por intentos ajenos', public._t_sv('00000000-0000-0000-000d-0000000000a1'), 1);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_rechaza('la función de invalidación no es invocable por la API', $q$select public.invalidar_sesion_usuario('00000000-0000-0000-000d-0000000000a3', '00000000-0000-0000-000d-0000000001a0', 'x')$q$, 'permission denied');
select public._t_rechaza('incrementar_session_version sigue cerrada', $q$select public.incrementar_session_version('00000000-0000-0000-000d-0000000000a3')$q$, 'permission denied');

-- ═══ 2. Suspender y trasladar funcionan para el propietario; la sesión se invalida y los permisos dejan de valer ═══
reset role;
select public._t_igual('sv antes', public._t_sv('00000000-0000-0000-000d-0000000000a3'), 1);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_acepta('owner suspende a un barbero', format($q$select public.suspender_staff(%L, 'prueba')$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')));
reset role;
select public._t_igual('suspender incrementó session_version', public._t_sv('00000000-0000-0000-000d-0000000000a3'), 2);
select public._t_igual('y quedó auditado', (select count(*) from public.evento_auditoria where entidad_id = '00000000-0000-0000-000d-0000000000a3' and accion = 'SESION_INVALIDADA')::int, 1);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a3');
select public._t_igual('el barbero suspendido ya no tiene acceso interno', public.is_staff_de('00000000-0000-0000-000d-0000000001a0'), false);
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_acepta('owner reactiva', format($q$select public.reactivar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')));
select public._t_acepta('owner traslada de sede', format($q$select public.trasladar_staff(%L, '00000000-0000-0000-000d-0000000002a1')$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')));
reset role;
select public._t_igual('trasladar incrementó session_version', public._t_sv('00000000-0000-0000-000d-0000000000a3'), 3);
select public._t_igual('el traslado se aplicó', (select sede_activa_id from public.vinculo_staff_negocio where id = '00000000-0000-0000-000d-0000000003a3'), '00000000-0000-0000-000d-0000000002a1'::uuid);
-- Administrador delegado: puede sobre barberos, no sobre otro administrador ni el dueño, y no toca la sesión del dueño.
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a2');
select public._t_acepta('admin suspende a un barbero (la sesión se invalida por la vía autorizada)', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a4')));
select public._t_acepta('admin lo reactiva', format($q$select public.reactivar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a4')));
select public._t_rechaza('admin no suspende a otro administrador', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a2')), 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-000d-0000000000a5');
select public._t_rechaza('ajeno no suspende', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')), 'NO_AUTORIZADO');
select public._t_rechaza('ajeno no traslada', format($q$select public.trasladar_staff(%L, '00000000-0000-0000-000d-0000000002a0')$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')), 'NO_AUTORIZADO');
select public._t_rechaza('ajeno no cambia roles', format($q$select public.cambiar_rol_equipo(%L, 'BUSINESS_ADMIN')$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')), 'NO_AUTORIZADO');
select public._t_rechaza('ajeno no retira', format($q$select public.retirar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')), 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-000d-0000000000a3');
select public._t_rechaza('barbero no suspende', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a4')), 'NO_AUTORIZADO');
reset role;
-- Validación interna de quién llama y sobre quién (se invoca como postgres con los claims de cada actor).
select public._t_como('00000000-0000-0000-000d-0000000000a2');
select public._t_rechaza('interna: un administrador no invalida la sesión del dueño', $q$select public.invalidar_sesion_usuario('00000000-0000-0000-000d-0000000000a1', '00000000-0000-0000-000d-0000000001a0', 'x')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-000d-0000000000a5');
select public._t_rechaza('interna: un dueño ajeno no invalida en otro negocio', $q$select public.invalidar_sesion_usuario('00000000-0000-0000-000d-0000000000a3', '00000000-0000-0000-000d-0000000001a0', 'x')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_rechaza('interna: un usuario sin vínculo con el negocio', $q$select public.invalidar_sesion_usuario('00000000-0000-0000-000d-0000000000a5', '00000000-0000-0000-000d-0000000001a0', 'x')$q$, 'USUARIO_AJENO_AL_NEGOCIO');
select public._t_rechaza('interna: sin sesión', $q$select set_config('request.jwt.claims', '', true), public.invalidar_sesion_usuario('00000000-0000-0000-000d-0000000000a3', '00000000-0000-0000-000d-0000000001a0', 'x')$q$, 'NO_AUTENTICADO');
-- Cambiar rol invalida y el permiso anterior deja de valer al instante.
select public._t_como('00000000-0000-0000-000d-0000000000a1');
set local role authenticated;
select public._t_igual('antes: el administrador administra', (select public.is_admin_de('00000000-0000-0000-000d-0000000001a0') from (select public._t_como('00000000-0000-0000-000d-0000000000a2')) s), true);
select public._t_como('00000000-0000-0000-000d-0000000000a1');
reset role;
select public._t_igual('sv del admin antes', public._t_sv('00000000-0000-0000-000d-0000000000a2'), 1);
set local role authenticated;
select public._t_acepta('owner pasa al administrador a BARBER', format($q$select public.cambiar_rol_equipo(%L, 'BARBER')$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a2')));
select public._t_como('00000000-0000-0000-000d-0000000000a2');
select public._t_igual('después: ya NO administra', public.is_admin_de('00000000-0000-0000-000d-0000000001a0'), false);
select public._t_rechaza('después: no puede invitar', $q$select public.crear_invitacion_staff('00000000-0000-0000-000d-0000000001a0', 's155-zz@test.local', '00000000-0000-0000-000d-0000000002a0')$q$, 'NO_AUTORIZADO');
reset role;
select public._t_igual('cambiar rol incrementó session_version', public._t_sv('00000000-0000-0000-000d-0000000000a2'), 2);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_acepta('owner retira al barbero 2', format($q$select public.retirar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a4')));
reset role;
select public._t_igual('retirar incrementó session_version', public._t_sv('00000000-0000-0000-000d-0000000000a4'), 3);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a4');
select public._t_igual('el retirado ya no tiene acceso interno', public.is_staff_de('00000000-0000-0000-000d-0000000001a0'), false);

-- ═══ 3. Suspendidos SIGUEN ocupando cupo: no se evade el tope suspendiendo ══════════════
reset role;
-- Studio = 5: a (BARBER ahora) + b1 = 2 ocupados; se llenan 3 más con invitaciones vigentes.
insert into public.invitacion_staff (negocio_id, email, sede_id, invitado_por) values
  ('00000000-0000-0000-000d-0000000001a0', 's155-i1@test.local', '00000000-0000-0000-000d-0000000002a0', '00000000-0000-0000-000d-0000000000a1'),
  ('00000000-0000-0000-000d-0000000001a0', 's155-i2@test.local', '00000000-0000-0000-000d-0000000002a0', '00000000-0000-0000-000d-0000000000a1'),
  ('00000000-0000-0000-000d-0000000001a0', 's155-i3@test.local', '00000000-0000-0000-000d-0000000002a0', '00000000-0000-0000-000d-0000000000a1');
select public._t_igual('lleno 5/5', public._t_cap('00000000-0000-0000-000d-0000000001a0', 'disponibles'), 0);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_acepta('suspende a un profesional para «liberar» cupo', format($q$select public.suspender_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')));
select public._t_igual('el suspendido sigue ocupando', public._t_cap('00000000-0000-0000-000d-0000000001a0', 'disponibles'), 0);
select public._t_rechaza('no se puede invitar a otro en su lugar', $q$select public.crear_invitacion_staff('00000000-0000-0000-000d-0000000001a0', 's155-nuevo@test.local', '00000000-0000-0000-000d-0000000002a0')$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_acepta('reactivar al suspendido es válido (nunca superó el tope)', format($q$select public.reactivar_staff(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')));
select public._t_igual('sin exceso', (select (public.capacidad_profesional_negocio('00000000-0000-0000-000d-0000000001a0') ->> 'exceso')::int), 0);
-- El retirado no vuelve por escritura directa si no hay cupo (el cupo se libera solo con la desvinculación definitiva).
select public._t_rechaza('reactivar a un RETIRADO por escritura directa respeta el tope',
  format($q$update public.vinculo_staff_negocio set estado = 'ACTIVO' where id = %L$q$, '00000000-0000-0000-000d-0000000003a4'), 'PLAN_LIMIT_EXCEEDED');

-- ═══ 4. BUSINESS_ADMIN: alcance mínimo, lo comercial está negado ════════════════════════
reset role;
update public.vinculo_staff_negocio set es_admin = true, presta_servicios = false where id = '00000000-0000-0000-000d-0000000003a2';  -- el admin de pruebas vuelve a serlo
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a2');
select public._t_igual('admin: es administrador', public.is_admin_de('00000000-0000-0000-000d-0000000001a0'), true);
select public._t_rechaza('admin: no pide downgrade del plan', $q$select public.solicitar_downgrade_plan('00000000-0000-0000-000d-0000000001a0', 'ESSENTIAL')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no inicia la verificación', $q$select public.iniciar_verificacion_negocio('00000000-0000-0000-000d-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no envía a revisión', $q$select public.enviar_verificacion_a_revision('00000000-0000-0000-000d-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no fija la foto del negocio', $q$select public.fijar_foto_principal_negocio('00000000-0000-0000-000d-0000000001a0', 'https://res.cloudinary.com/demo/x.jpg', 'negocios/00000000-0000-0000-000d-0000000001a0/x')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no completa el onboarding', $q$select public.completar_onboarding_negocio('00000000-0000-0000-000d-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no configura planes', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', true, true, true, true, 'intento de un administrador')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no activa el perfil del dueño', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000d-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('admin: no promueve Guardian', format($q$select public.promover_guardian(%L)$q$, public._t_vinculo('00000000-0000-0000-000d-0000000001a0', '00000000-0000-0000-000d-0000000000a3')), 'NO_AUTORIZADO');
select public._t_igual('admin: no lee la suscripción (RLS)', (select count(*) from public.suscripcion where negocio_id = '00000000-0000-0000-000d-0000000001a0')::int, 0);
select public._t_igual('admin: no lee pagos (RLS)', (select count(*) from public.pago where negocio_id = '00000000-0000-0000-000d-0000000001a0')::int, 0);
select public._t_igual('admin: no lee la wallet (RLS)', (select count(*) from public.wallet where negocio_id = '00000000-0000-0000-000d-0000000001a0')::int, 0);
select public._t_acepta('admin: intentar editar el negocio no da error pero no cambia nada', $q$update public.negocio set nombre = 'HACK' where id = '00000000-0000-0000-000d-0000000001a0'$q$);
select public._t_acepta('admin: intentar cambiar el propietario no da error pero no cambia nada', $q$update public.negocio set owner_user_id = '00000000-0000-0000-000d-0000000000a2' where id = '00000000-0000-0000-000d-0000000001a0'$q$);
select public._t_acepta('admin: intentar cambiar el plan directo no cambia nada', $q$update public.negocio set plan_codigo = 'SIGNATURE' where id = '00000000-0000-0000-000d-0000000001a0'$q$);
reset role;
select public._t_igual('el negocio no cambió', (select nombre || owner_user_id::text || plan_codigo::text from public.negocio where id = '00000000-0000-0000-000d-0000000001a0'),
  'S155 NS00000000-0000-0000-000d-0000000000a1STUDIO');

-- ═══ 5. Configuración del perfil del propietario por plan (SuperSU, con motivo y auditoría) ══
select public._t_igual('valores iniciales: Essential por defecto+auto, resto apagado y activable',
  (select string_agg(codigo::text || ':' || propietario_profesional_por_defecto::text || propietario_perfil_auto_alta::text || propietario_puede_activar_perfil::text || propietario_puede_desactivar_perfil::text, ',' order by codigo::text) from public.plan),
  'ESSENTIAL:truetruetruetrue,PRESTIGE:falsefalsetruetrue,SIGNATURE:falsefalsetruetrue,STUDIO:falsefalsetruetrue');
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_rechaza('un dueño no configura planes', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', true, true, true, true, 'intento de un propietario')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-000d-0000000000a6');  -- SuperSU
select public._t_rechaza('motivo obligatorio', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', true, true, true, true, 'corto')$q$, 'MOTIVO_REQUERIDO');
select public._t_rechaza('configuración incoherente (obliga lo que no se puede activar)', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', true, true, false, true, 'prueba de incoherencia')$q$, 'CONFIGURACION_INCOHERENTE');
-- activar/desactivar respetan la configuración
select public._t_acepta('Studio: puede_activar = false', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', false, false, false, true, 'prueba: el propietario no puede activarlo')$q$);
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_rechaza('dueño Studio: activar no permitido por el plan', $q$select public.activar_perfil_profesional_propietario('00000000-0000-0000-000d-0000000001a0')$q$, 'PERFIL_NO_PERMITIDO_POR_PLAN');
select public._t_como('00000000-0000-0000-000d-0000000000a6');
select public._t_acepta('Studio: voluntario de nuevo', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', false, false, true, false, 'prueba: activable pero no desactivable')$q$);
select public._t_como('00000000-0000-0000-000d-0000000000a1');
select public._t_igual('dueño Studio activa voluntariamente (hay 1 cupo libre tras retirar a b2)', public.activar_perfil_profesional_propietario('00000000-0000-0000-000d-0000000001a0') ->> 'estado', 'ACTIVADO');
select public._t_rechaza('dueño Studio: desactivar no permitido por el plan', $q$select public.desactivar_perfil_profesional_propietario('00000000-0000-0000-000d-0000000001a0')$q$, 'DESACTIVAR_NO_PERMITIDO_POR_PLAN');
-- completar el alta respeta auto_alta
select public._t_como('00000000-0000-0000-000d-0000000000a6');
select public._t_acepta('Studio: automático al completar el alta', $q$select public.admin_configurar_perfil_propietario_plan('STUDIO', true, true, true, true, 'prueba: automático también en Studio')$q$);
select public._t_como('00000000-0000-0000-000d-0000000000a8');
select public._t_acepta('dueño NN completa el alta', $q$select public.completar_onboarding_negocio('00000000-0000-0000-000d-0000000001d0')$q$);
reset role;
select public._t_igual('el alta de Studio activó el perfil porque la configuración lo dice', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000d-0000000001d0' and staff_id = '00000000-0000-0000-000d-0000000000a8' and presta_servicios and estado = 'ACTIVO')::int, 1);
select public._t_igual('auditoría de la configuración con motivo y valores', (select count(*) from public.evento_auditoria where accion = 'PLAN_PERFIL_PROPIETARIO_CONFIGURADO' and motivo is not null and payload_antes is not null and payload_despues is not null and actor_id = '00000000-0000-0000-000d-0000000000a6')::int, 3);
-- Essential: apagar el automático y completar un alta → no se activa
update public.negocio set onboarding_completo = false where id = '00000000-0000-0000-000d-0000000001c0';
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro) values ('00000000-0000-0000-000d-0000000001c0', 'ESSENTIAL', 'TRIAL', now() + interval '20 days');
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a6');
select public._t_acepta('Essential: sin automático', $q$select public.admin_configurar_perfil_propietario_plan('ESSENTIAL', true, false, true, true, 'prueba: Essential sin automático')$q$);
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_acepta('dueño Essential completa el alta', $q$select public.completar_onboarding_negocio('00000000-0000-0000-000d-0000000001c0')$q$);
reset role;
select public._t_igual('Essential sin automático: no se activó', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000d-0000000001c0')::int, 0);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a6');
select public._t_acepta('Essential: automático otra vez', $q$select public.admin_configurar_perfil_propietario_plan('ESSENTIAL', true, true, true, true, 'prueba: restaurar valores iniciales')$q$);
reset role;

-- ═══ 6. Publicación del profesional: foto profesional + consentimiento expreso (no por ser propietario) ═══
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_igual('Essential: el dueño activa su perfil', public.activar_perfil_profesional_propietario('00000000-0000-0000-000d-0000000001c0') ->> 'estado', 'ACTIVADO');
reset role;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values ('00000000-0000-0000-000d-0000000005c0', '00000000-0000-0000-000d-0000000001c0', 'Corte S155', 30, 20000);
insert into public.staff_servicio (staff_id, servicio_id) values ('00000000-0000-0000-000d-0000000000a7', '00000000-0000-0000-000d-0000000005c0');
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
values (public._t_vinculo('00000000-0000-0000-000d-0000000001c0', '00000000-0000-0000-000d-0000000000a7'), '00000000-0000-0000-000d-0000000002c0', extract(dow from current_date + 3)::int, '09:00', '12:00');
-- Sin foto y sin consentimiento: privado sí, público no.
set local role anon;
select set_config('request.jwt.claims', '', true);  -- sesión anónima de verdad (sin claims de la prueba anterior)
select public._t_igual('sin foto ni consentimiento: no aparece públicamente', (select count(*) from public.negocio_staff_publico('00000000-0000-0000-000d-0000000001c0'))::int, 0);
select public._t_igual('sin foto ni consentimiento: sin horarios públicos', (select count(*) from public.slots_disponibles('00000000-0000-0000-000d-0000000002c0', array['00000000-0000-0000-000d-0000000005c0']::uuid[], current_date + 3))::int, 0);
reset role;
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_igual('sin foto ni consentimiento: el dueño SÍ usa su agenda privada (slots internos)', (select count(*) > 0 from public.slots_disponibles('00000000-0000-0000-000d-0000000002c0', array['00000000-0000-0000-000d-0000000005c0']::uuid[], current_date + 3)), true);
select public._t_igual('sin foto ni consentimiento: ve su propio vínculo', (select count(*) from public.vista_staff_negocio where staff_id = '00000000-0000-0000-000d-0000000000a7')::int, 1);
-- Solo foto: sigue sin aparecer.
select public._t_acepta('sube su foto profesional', $q$update public.staff set foto_url = 'https://res.cloudinary.com/demo/image/upload/prof.jpg' where usuario_id = '00000000-0000-0000-000d-0000000000a7'$q$);
reset role;
select public._t_igual('solo foto: no publicable', public.staff_es_publicable('00000000-0000-0000-000d-0000000000a7', '00000000-0000-0000-000d-0000000001c0'), false);
-- La fachada del negocio es otra cosa y no publica al profesional.
update public.negocio set foto_principal_url = 'https://res.cloudinary.com/demo/image/upload/fachada.jpg' where id = '00000000-0000-0000-000d-0000000001c0';
select public._t_igual('la fachada del negocio no publica al profesional', public.staff_es_publicable('00000000-0000-0000-000d-0000000000a7', '00000000-0000-0000-000d-0000000001c0'), false);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_rechaza('publicar exige antes el tratamiento de datos', $q$select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil')$q$, 'REQUIERE_TRATAMIENTO');
select public._t_acepta('acepta el tratamiento de datos', $q$select public.autorizar_staff('AUTORIZACION_STAFF_TRATAMIENTO', 'perfil')$q$);
reset role;
select public._t_igual('foto + solo tratamiento: sigue sin ser público', public.staff_es_publicable('00000000-0000-0000-000d-0000000000a7', '00000000-0000-0000-000d-0000000001c0'), false);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_acepta('consentimiento EXPRESO de publicación', $q$select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil')$q$);
reset role;
select public._t_igual('evidencia: actor, fecha, versión del texto, huella y canal',
  (select count(*) from public.evidencia_legal where usuario_id = '00000000-0000-0000-000d-0000000000a7' and documento = 'AUTORIZACION_STAFF_PUBLICACION' and accion = 'ACEPTA'
     and ocurrido_at is not null and version is not null and texto_sha256 is not null and hash is not null and canal = 'perfil')::int, 1);
set local role anon;
select set_config('request.jwt.claims', '', true);  -- sesión anónima de verdad (sin claims de la prueba anterior)
select public._t_igual('foto + consentimiento: aparece públicamente', (select count(*) from public.negocio_staff_publico('00000000-0000-0000-000d-0000000001c0'))::int, 1);
select public._t_igual('foto + consentimiento: con horarios públicos', (select count(*) > 0 from public.slots_disponibles('00000000-0000-0000-000d-0000000002c0', array['00000000-0000-0000-000d-0000000005c0']::uuid[], current_date + 3)), true);
reset role;
-- La evidencia es inmutable.
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_rechaza('la evidencia no se edita', $q$update public.evidencia_legal set accion = 'REVOCA' where usuario_id = '00000000-0000-0000-000d-0000000000a7'$q$, 'SIN_ERROR');
reset role;
select public._t_igual('...y quedó intacta', (select count(*) from public.evidencia_legal where usuario_id = '00000000-0000-0000-000d-0000000000a7' and documento = 'AUTORIZACION_STAFF_PUBLICACION' and accion = 'ACEPTA')::int, 1);
-- Retirar el consentimiento: deja de mostrarse de inmediato, deja evidencia, y las funciones privadas siguen.
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_acepta('retira el consentimiento', $q$select public.revocar_publicacion_staff()$q$);
reset role;
select public._t_igual('retirado: no publicable', public.staff_es_publicable('00000000-0000-0000-000d-0000000000a7', '00000000-0000-0000-000d-0000000001c0'), false);
set local role anon;
select set_config('request.jwt.claims', '', true);  -- sesión anónima de verdad (sin claims de la prueba anterior)
select public._t_igual('retirado: desaparece al instante de negocio_staff_publico', (select count(*) from public.negocio_staff_publico('00000000-0000-0000-000d-0000000001c0'))::int, 0);
select public._t_igual('retirado: desaparece de los horarios públicos', (select count(*) from public.slots_disponibles('00000000-0000-0000-000d-0000000002c0', array['00000000-0000-0000-000d-0000000005c0']::uuid[], current_date + 3))::int, 0);
reset role;
select public._t_igual('retirar dejó su propia evidencia (REVOCA)', (select count(*) from public.evidencia_legal where usuario_id = '00000000-0000-0000-000d-0000000000a7' and documento = 'AUTORIZACION_STAFF_PUBLICACION' and accion = 'REVOCA')::int, 1);
set local role authenticated;
select public._t_como('00000000-0000-0000-000d-0000000000a7');
select public._t_igual('retirado: sigue usando su agenda privada', (select count(*) > 0 from public.slots_disponibles('00000000-0000-0000-000d-0000000002c0', array['00000000-0000-0000-000d-0000000005c0']::uuid[], current_date + 3)), true);
reset role;

rollback;
select 'OK: roles_155_config_sesion_publicacion — todas las pruebas pasaron' as resultado;
