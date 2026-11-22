-- Prueba de la migración 157 (normalización de negocios existentes) con fixtures "antiguos". Solo contra la base LOCAL.
-- La línea '-- INCLUDE157' se sustituye por el contenido de la migración: ejecutar con  bash tests/sql/roles_157_normalizacion.sh
-- Todo dentro de una transacción terminada en ROLLBACK. Otros negocios de la base local también se normalizan dentro de la
-- transacción (no se escribe nada real); las comprobaciones se limitan a los fixtures y a los huérfanos globales.
begin;

-- La prueba no debe depender de que alguien haya editado la configuración de planes en /admin/planes: se fijan, SOLO dentro de esta
-- transacción (ROLLBACK), los valores iniciales aprobados (Essential por defecto+automático; resto voluntario).
update public.plan set propietario_profesional_por_defecto = (codigo = 'ESSENTIAL'), propietario_perfil_auto_alta = (codigo = 'ESSENTIAL'),
  propietario_puede_activar_perfil = true, propietario_puede_desactivar_perfil = true;

create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido; end if;
end $f$;
create function public._t_cap(p_negocio uuid, p_clave text) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(p_negocio) ->> p_clave)::int;
$f$;

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-000c-0000000000' || x.k)::uuid, 'n155-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','o1'),('a2','o2'),('a3','o3'),('a4','o4'),('a5','o5'),('a6','o6'),('b1','e1'),('b2','e2'),('b3','e3')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-000c-0000000000' || x.k)::uuid, 'N155 ' || x.n, 'n155-' || x.n || '@test.local'
from (values ('a1','o1'),('a2','o2'),('a3','o3'),('a4','o4'),('a5','o5'),('a6','o6'),('b1','e1'),('b2','e2'),('b3','e3')) x(k, n)
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-000c-0000000001a1', '00000000-0000-0000-000c-0000000000a1', 'N155 L1 essential 1 empleado', 'n155-l1', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000c-0000000001a2', '00000000-0000-0000-000c-0000000000a2', 'N155 L2 studio dueño barbero', 'n155-l2', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000c-0000000001a3', '00000000-0000-0000-000c-0000000000a3', 'N155 L3 studio dueño con reservas', 'n155-l3', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-000c-0000000001a4', '00000000-0000-0000-000c-0000000000a4', 'N155 L4 essential sin alta', 'n155-l4', 'Cali', 'CO', 'PENDIENTE_APROBACION'),
  ('00000000-0000-0000-000c-0000000001a5', '00000000-0000-0000-000c-0000000000a5', 'N155 L5 essential alta completa SIN sede', 'n155-l5', 'Cali', 'CO', 'PENDIENTE_APROBACION'),
  ('00000000-0000-0000-000c-0000000001a6', '00000000-0000-0000-000c-0000000000a6', 'N155 L6 essential ACTIVO con alta incompleta', 'n155-l6', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'ESSENTIAL', onboarding_completo = true where id = '00000000-0000-0000-000c-0000000001a1';
update public.negocio set plan_codigo = 'STUDIO', onboarding_completo = true where id in ('00000000-0000-0000-000c-0000000001a2', '00000000-0000-0000-000c-0000000001a3');
update public.negocio set plan_codigo = 'ESSENTIAL', onboarding_completo = false where id in ('00000000-0000-0000-000c-0000000001a4', '00000000-0000-0000-000c-0000000001a6');
update public.negocio set plan_codigo = 'ESSENTIAL', onboarding_completo = true where id = '00000000-0000-0000-000c-0000000001a5';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal)
select ('00000000-0000-0000-000c-0000000002' || x.k)::uuid, ('00000000-0000-0000-000c-0000000001' || x.k)::uuid, 'Sede ' || x.k, 'Cra 1', 'Cali', true
from (values ('a1'),('a2'),('a3'),('a4'),('a6')) x(k);  -- L5 (a5) NO tiene sede a propósito
insert into public.staff (usuario_id, nombre) select ('00000000-0000-0000-000c-0000000000' || x.k)::uuid, 'N155 ' || x.k from (values ('a2'),('a3'),('b1'),('b2'),('b3')) x(k);
-- Modelo ANTIGUO: vínculos sin capacidades explícitas (el default los deja BARBER).
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso) values
  ('00000000-0000-0000-000c-0000000003b1', '00000000-0000-0000-000c-0000000000b1', '00000000-0000-0000-000c-0000000001a1', '00000000-0000-0000-000c-0000000002a1', 'ACTIVO', now()),
  ('00000000-0000-0000-000c-0000000003a2', '00000000-0000-0000-000c-0000000000a2', '00000000-0000-0000-000c-0000000001a2', '00000000-0000-0000-000c-0000000002a2', 'ACTIVO', now()),
  ('00000000-0000-0000-000c-0000000003b2', '00000000-0000-0000-000c-0000000000b2', '00000000-0000-0000-000c-0000000001a2', '00000000-0000-0000-000c-0000000002a2', 'ACTIVO', now()),
  ('00000000-0000-0000-000c-0000000003a3', '00000000-0000-0000-000c-0000000000a3', '00000000-0000-0000-000c-0000000001a3', '00000000-0000-0000-000c-0000000002a3', 'ACTIVO', now());
-- Historia del dueño-barbero de L2 (debe conservarse intacta): reserva pasada, disponibilidad y servicio.
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values
  ('00000000-0000-0000-000c-0000000005a2', '00000000-0000-0000-000c-0000000001a2', 'Corte N155', 30, 20000);
insert into public.staff_servicio (staff_id, servicio_id) values ('00000000-0000-0000-000c-0000000000a2', '00000000-0000-0000-000c-0000000005a2');
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
values ('00000000-0000-0000-000c-0000000003a2', '00000000-0000-0000-000c-0000000002a2', 1, '09:00', '12:00');
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-000c-0000000004a2', '00000000-0000-0000-000c-0000000000b3', '00000000-0000-0000-000c-0000000001a2',
   '00000000-0000-0000-000c-0000000002a2', '00000000-0000-0000-000c-0000000000a2', now() - interval '10 days', now() - interval '10 days' + interval '1 hour', 'COMPLETADA', 30000, 6000),
  ('00000000-0000-0000-000c-0000000004a3', '00000000-0000-0000-000c-0000000000b3', '00000000-0000-0000-000c-0000000001a3',
   '00000000-0000-0000-000c-0000000002a3', '00000000-0000-0000-000c-0000000000a3', now() + interval '30 hours', now() + interval '31 hours', 'CONFIRMADA', 30000, 6000);

-- ═══ ANTES ═══
select 'ANTES' etapa, n.nombre, n.plan_codigo plan, public._t_cap(n.id, 'ocupados') ocupados, public._t_cap(n.id, 'limite') limite,
       (select string_agg(coalesce(public._rol_equipo(n.id, v.staff_id), '?') || ':' || v.estado::text, ', ') from public.vinculo_staff_negocio v where v.negocio_id = n.id and v.estado <> 'RETIRADO') vinculos
  from public.negocio n where n.slug like 'n155-%' order by n.slug;

-- INCLUDE157

-- ═══ DESPUÉS ═══
select 'DESPUES' etapa, n.nombre, n.plan_codigo plan, public._t_cap(n.id, 'ocupados') ocupados, public._t_cap(n.id, 'limite') limite, public._t_cap(n.id, 'exceso') exceso,
       (select string_agg(coalesce(public._rol_equipo(n.id, v.staff_id), '?') || ':' || v.estado::text, ', ') from public.vinculo_staff_negocio v where v.negocio_id = n.id) vinculos
  from public.negocio n where n.slug like 'n155-%' order by n.slug;

-- L1: Essential con 1 empleado: el propietario queda habilitado; 2/1; nadie se borra.
select public._t_igual('L1: propietario profesional', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000c-0000000001a1'
  and staff_id = '00000000-0000-0000-000c-0000000000a1' and estado = 'ACTIVO' and presta_servicios and not es_admin)::int, 1);
select public._t_igual('L1: el empleado sigue ACTIVO', (select estado::text from public.vinculo_staff_negocio where id = '00000000-0000-0000-000c-0000000003b1'), 'ACTIVO');
select public._t_igual('L1: 2 ocupados de 1', public._t_cap('00000000-0000-0000-000c-0000000001a1', 'ocupados'), 2);
select public._t_igual('L1: exceso marcado', public._t_cap('00000000-0000-0000-000c-0000000001a1', 'exceso'), 1);
select public._t_igual('L1: evento de exceso', (select count(*) from public.evento_auditoria where negocio_id = '00000000-0000-0000-000c-0000000001a1' and accion = 'CUPO_EXCEDIDO_DETECTADO')::int, 1);
-- L2: Studio con el dueño figurando como barbero: se desvincula del modelo antiguo conservando TODA la historia.
select public._t_igual('L2: dueño RETIRADO del modelo antiguo', (select estado::text from public.vinculo_staff_negocio where id = '00000000-0000-0000-000c-0000000003a2'), 'RETIRADO');
select public._t_igual('L2: el otro barbero sigue ACTIVO', (select estado::text from public.vinculo_staff_negocio where id = '00000000-0000-0000-000c-0000000003b2'), 'ACTIVO');
select public._t_igual('L2: ocupa 1 (solo el barbero)', public._t_cap('00000000-0000-0000-000c-0000000001a2', 'ocupados'), 1);
select public._t_igual('L2: la reserva histórica se conserva', (select count(*) from public.reserva where id = '00000000-0000-0000-000c-0000000004a2' and staff_id = '00000000-0000-0000-000c-0000000000a2')::int, 1);
select public._t_igual('L2: la disponibilidad se conserva', (select count(*) from public.disponibilidad where vinculo_id = '00000000-0000-0000-000c-0000000003a2')::int, 1);
select public._t_igual('L2: el servicio asignado se conserva', (select count(*) from public.staff_servicio where staff_id = '00000000-0000-0000-000c-0000000000a2')::int, 1);
select public._t_igual('L2: la fila staff se conserva', (select count(*) from public.staff where usuario_id = '00000000-0000-0000-000c-0000000000a2')::int, 1);
-- L3: Studio con el dueño y reservas FUTURAS: no se toca.
select public._t_igual('L3: dueño con reservas futuras NO se desvincula', (select estado::text from public.vinculo_staff_negocio where id = '00000000-0000-0000-000c-0000000003a3'), 'ACTIVO');
-- L4: Essential sin alta completa: no se toca.
select public._t_igual('L4: sin cambios', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000c-0000000001a4')::int, 0);
-- L5: alta completa pero SIN sede: se omite (nunca un vínculo sin sede) y queda registrado.
select public._t_igual('L5: sin vínculo', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000c-0000000001a5')::int, 0);
select public._t_igual('L5: omisión registrada', (select count(*) from public.evento_auditoria where negocio_id = '00000000-0000-0000-000c-0000000001a5' and accion = 'NORMALIZACION_FASE1_OMITIDA' and payload_despues ->> 'motivo' = 'SIN_SEDE')::int, 1);
-- L6: ACTIVO pero con el alta INCOMPLETA: no se le crea perfil (lo recibirá al completar el alta).
select public._t_igual('L6: alta incompleta, sin vínculo', (select count(*) from public.vinculo_staff_negocio where negocio_id = '00000000-0000-0000-000c-0000000001a6')::int, 0);
select public._t_igual('L6: sin evento de normalización', (select count(*) from public.evento_auditoria where negocio_id = '00000000-0000-0000-000c-0000000001a6' and accion like 'NORMALIZACION_FASE1%')::int, 0);
select public._t_igual('L1: el empleado NO fue retirado ni se cancelaron invitaciones por el exceso', (select count(*) from public.invitacion_staff where negocio_id = '00000000-0000-0000-000c-0000000001a1' and estado = 'CANCELADA')::int, 0);
-- Sin huérfanos en todo el sistema.
select public._t_igual('sin reservas huérfanas', (select count(*) from public.reserva r where r.staff_id is not null and not exists (select 1 from public.staff s where s.usuario_id = r.staff_id))::int, 0);
select public._t_igual('sin staff_servicio huérfano', (select count(*) from public.staff_servicio ss where not exists (select 1 from public.staff s where s.usuario_id = ss.staff_id))::int, 0);
select public._t_igual('sin vínculos huérfanos', (select count(*) from public.vinculo_staff_negocio v where not exists (select 1 from public.staff s where s.usuario_id = v.staff_id))::int, 0);
select public._t_igual('sin disponibilidad huérfana', (select count(*) from public.disponibilidad d where not exists (select 1 from public.vinculo_staff_negocio v where v.id = d.vinculo_id))::int, 0);
select public._t_igual('sin bloqueos huérfanos', (select count(*) from public.bloqueo_ausencia b where not exists (select 1 from public.vinculo_staff_negocio v where v.id = b.vinculo_id))::int, 0);
select public._t_igual('sin niveles/puntajes huérfanos', (select (select count(*) from public.nivel_staff_consolidado b where not exists (select 1 from public.vinculo_staff_negocio v where v.id = b.vinculo_id))
  + (select count(*) from public.puntaje_staff_evento b where not exists (select 1 from public.vinculo_staff_negocio v where v.id = b.vinculo_id)))::int, 0);
select public._t_igual('ningún vínculo viola el check de capacidades', (select count(*) from public.vinculo_staff_negocio where not (es_admin or presta_servicios))::int, 0);
-- Idempotencia: una segunda ejecución no duplica eventos ni cambia estados.
create temp table ev_antes as select count(*) c from public.evento_auditoria where accion in ('NORMALIZACION_FASE1_PERFIL_PROPIETARIO', 'CUPO_EXCEDIDO_DETECTADO');
create temp table vin_antes as select id, estado, presta_servicios, es_admin from public.vinculo_staff_negocio;
-- INCLUDE157
select public._t_igual('idempotente: mismos eventos', (select count(*) from public.evento_auditoria where accion in ('NORMALIZACION_FASE1_PERFIL_PROPIETARIO', 'CUPO_EXCEDIDO_DETECTADO'))::int, (select c from ev_antes)::int);
select public._t_igual('idempotente: mismos vínculos', (select count(*) from public.vinculo_staff_negocio v where not exists
  (select 1 from vin_antes a where a.id = v.id and a.estado = v.estado and a.presta_servicios = v.presta_servicios and a.es_admin = v.es_admin))::int, 0);

rollback;
select 'OK: roles_157_normalizacion — todas las comprobaciones pasaron' as resultado;
