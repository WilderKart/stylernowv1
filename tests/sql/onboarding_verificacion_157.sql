-- Pruebas de la migración 157 (cierre del onboarding, foto principal y verificación del negocio).
-- Solo contra la base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/onboarding_verificacion_157.sql
-- Transacción terminada en ROLLBACK. Actores (prefijo …0009-): a1 propietario A · b1 propietario B (intruso) · e0 SuperSU · c1 staff de A.

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
-- Paridad con producción: las tablas nuevas de 150 quedan cerradas (los default privileges las abren, la migración las cierra).
revoke all on public.negocio_verificacion, public.verificacion_documento, public.verificacion_evento from public, anon, authenticated, service_role;

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

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0009-0000000000a1', 'ov-dueno-a@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0009-0000000000b1', 'ov-dueno-b@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0009-0000000000e0', 'ov-supersu@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0009-0000000000c1', 'ov-staff-a@test.local', 'authenticated', 'authenticated', now());
insert into public.perfil (id, nombre, email) values
  ('00000000-0000-0000-0009-0000000000a1', 'Dueño A', 'ov-dueno-a@test.local'),
  ('00000000-0000-0000-0009-0000000000b1', 'Dueño B', 'ov-dueno-b@test.local'),
  ('00000000-0000-0000-0009-0000000000e0', 'SuperSU', 'ov-supersu@test.local'),
  ('00000000-0000-0000-0009-0000000000c1', 'Staff A', 'ov-staff-a@test.local')
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
-- Solo puede haber un SuperSU: el existente se degrada solo dentro de esta transacción (el ROLLBACK lo restaura).
update public.perfil set es_supersu = false where es_supersu;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0009-0000000000e0';
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado, onboarding_completo) values
  ('00000000-0000-0000-0009-0000000001a0', '00000000-0000-0000-0009-0000000000a1', 'Negocio A', 'ov-a', 'Cali', 'CO', 'PENDIENTE_APROBACION', false),
  ('00000000-0000-0000-0009-0000000001b0', '00000000-0000-0000-0009-0000000000b1', 'Negocio B', 'ov-b', 'Cali', 'CO', 'PENDIENTE_APROBACION', false);

-- ════ Foto principal ════
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_acepta('foto: propietario fija una foto de Cloudinary',
  $q$select public.fijar_foto_principal_negocio('00000000-0000-0000-0009-0000000001a0',
     'https://res.cloudinary.com/demo/image/upload/v1/negocios/00000000-0000-0000-0009-0000000001a0/fachada.jpg',
     'negocios/00000000-0000-0000-0009-0000000001a0/fachada')$q$);
select public._t_rechaza('foto: host que no es Cloudinary',
  $q$select public.fijar_foto_principal_negocio('00000000-0000-0000-0009-0000000001a0', 'https://evil.test/x.jpg', 'negocios/00000000-0000-0000-0009-0000000001a0/x')$q$, 'FOTO_INVALIDA');
select public._t_rechaza('foto: identificador fuera de la carpeta negocios/',
  $q$select public.fijar_foto_principal_negocio('00000000-0000-0000-0009-0000000001a0', 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg', 'otra/cosa')$q$, 'FOTO_INVALIDA');
select public._t_rechaza('foto: restricción de tabla ante UPDATE directo con URL ajena',
  $q$update public.negocio set foto_principal_url = 'https://evil.test/x.jpg' where id = '00000000-0000-0000-0009-0000000001a0'$q$, 'negocio_foto_principal_cloudinary');
select public._t_como('00000000-0000-0000-0009-0000000000b1');
select public._t_rechaza('foto: otro propietario no puede',
  $q$select public.fijar_foto_principal_negocio('00000000-0000-0000-0009-0000000001a0',
     'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 'negocios/00000000-0000-0000-0009-0000000001a0/a')$q$, 'NO_AUTORIZADO');

-- negocio se lee por columnas: la URL de la fachada es pública (igual que logo_url).
select public._t_acepta('foto: authenticated lee foto_principal_url', $q$select foto_principal_url from public.negocio limit 1$q$);
reset role;
set local role anon;
select public._t_acepta('foto: anon lee foto_principal_url', $q$select foto_principal_url from public.negocio limit 1$q$);
reset role;
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000a1');

-- ════ Cierre del onboarding ════
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_rechaza('onboarding: sin sede', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'FALTA_SEDE');
reset role;
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values
  ('00000000-0000-0000-0009-0000000002a0', '00000000-0000-0000-0009-0000000001a0', 'Sede A', 'Cra 1', 'Cali', true);
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro) values ('00000000-0000-0000-0009-0000000001a0', 'ESSENTIAL', 'REQUIERE_PLAN', now() + interval '14 days');
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_rechaza('onboarding: sin prueba activa', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'FALTA_PRUEBA_ACTIVA');
reset role;
update public.suscripcion set estado = 'TRIAL' where negocio_id = '00000000-0000-0000-0009-0000000001a0';
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000b1');
select public._t_rechaza('onboarding: otro propietario', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_acepta('onboarding: completa sin servicios', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$);
select public._t_acepta('onboarding: reintento idempotente', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$);
reset role;
select public._t_igual('onboarding: un solo evento de auditoría',
  (select count(*) from public.evento_auditoria where entidad_id = '00000000-0000-0000-0009-0000000001a0' and accion = 'ONBOARDING_COMPLETADO')::int, 1);
select public._t_igual('onboarding: el estado de publicación no cambia',
  (select estado::text from public.negocio where id = '00000000-0000-0000-0009-0000000001a0'), 'PENDIENTE_APROBACION');
set local role anon;
select public._t_rechaza('onboarding: anon', $q$select public.completar_onboarding_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'permission denied');
reset role;

-- ════ Verificación ════
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000b1');
select public._t_rechaza('verif: intruso no inicia', $q$select public.iniciar_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('verif: intruso no lee estado ajeno', $q$select public.mi_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_igual('verif: inicia en NO_INICIADA', public.mi_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')->>'estado', 'NO_INICIADA');
select public._t_rechaza('verif: no se puede enviar sin iniciar', $q$select public.enviar_verificacion_a_revision('00000000-0000-0000-0009-0000000001a0')$q$, 'TRANSICION_NO_PERMITIDA');
select public._t_igual('verif: iniciar', public.iniciar_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')::text, 'PENDIENTE_DOCUMENTACION');
select public._t_igual('verif: iniciar es idempotente', public.iniciar_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')::text, 'PENDIENTE_DOCUMENTACION');
select public._t_rechaza('verif: sin documentos no se envía', $q$select public.enviar_verificacion_a_revision('00000000-0000-0000-0009-0000000001a0')$q$, 'FALTAN_DOCUMENTOS');
select public._t_rechaza('verif: el propietario no registra documentos por la API (solo el servidor)',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000a1', '00000000-0000-0000-0009-0000000001a0', 'RUT', 'verificacion/00000000-0000-0000-0009-0000000001a0/x', 1, 'pdf', 10)$q$, 'permission denied');

reset role;
set local role service_role;
select public._t_rechaza('verif: archivo de OTRO negocio (IDOR)',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000a1', '00000000-0000-0000-0009-0000000001a0', 'RUT', 'verificacion/00000000-0000-0000-0009-0000000001b0/x', 1, 'pdf', 10)$q$, 'ARCHIVO_AJENO');
select public._t_rechaza('verif: actor que no es propietario',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000b1', '00000000-0000-0000-0009-0000000001a0', 'RUT', 'verificacion/00000000-0000-0000-0009-0000000001a0/x', 1, 'pdf', 10)$q$, 'NO_AUTORIZADO');
select public._t_rechaza('verif: tipo inválido',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000a1', '00000000-0000-0000-0009-0000000001a0', 'CUALQUIERA', 'verificacion/00000000-0000-0000-0009-0000000001a0/y', 1, 'pdf', 10)$q$, 'verificacion_documento_tipo_check');
select public._t_acepta('verif: documento propio',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000a1', '00000000-0000-0000-0009-0000000001a0', 'ALTERNATIVO_INDEPENDIENTE', 'verificacion/00000000-0000-0000-0009-0000000001a0/doc1', 7, 'pdf', 2048)$q$);
select public._t_rechaza('verif: service_role no lee las tablas directamente', $q$select * from public.verificacion_documento$q$, 'permission denied');
reset role;
create temp table _t_doc as select id from public.verificacion_documento where negocio_id = '00000000-0000-0000-0009-0000000001a0';
grant select on _t_doc to anon, authenticated, service_role;

set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_rechaza('verif: tabla cerrada a authenticated', $q$select * from public.negocio_verificacion$q$, 'permission denied');
select public._t_rechaza('verif: tabla de eventos cerrada', $q$select * from public.verificacion_evento$q$, 'permission denied');
select public._t_igual('verif: el propietario ve su documento sin identificador de Cloudinary',
  (public.mi_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')->'documentos'->0 ? 'public_id'), false);
select public._t_igual('verif: enviar a revisión', public.enviar_verificacion_a_revision('00000000-0000-0000-0009-0000000001a0')::text, 'EN_REVISION');
select public._t_rechaza('verif: en revisión ya no es editable (retirar)', format($q$select public.retirar_documento_verificacion(%L)$q$, (select id from _t_doc)), 'VERIFICACION_NO_EDITABLE');
select public._t_rechaza('verif: el propietario no decide', $q$select public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'VERIFICADA', 'Aprobado por mí mismo')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('verif: el propietario no lista en el CRM', $q$select public.admin_verificaciones_listar()$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0009-0000000000b1');
select public._t_rechaza('verif: el intruso no autoriza lectura (solo servidor)', format($q$select public.autorizar_lectura_documento_srv(auth.uid(), %L)$q$, (select id from _t_doc)), 'permission denied');

-- SuperSU decide
select public._t_como('00000000-0000-0000-0009-0000000000e0');
select public._t_rechaza('verif: motivo obligatorio', $q$select public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'VERIFICADA', 'ok')$q$, 'MOTIVO_REQUERIDO');
select public._t_rechaza('verif: estado inválido', $q$select public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'INVENTADO', 'motivo suficiente aquí')$q$, 'ESTADO_INVALIDO');
select public._t_rechaza('verif: EN_REVISION no salta a REVOCADA', $q$select public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'REVOCADA', 'motivo suficiente aquí')$q$, 'TRANSICION_NO_PERMITIDA');
select public._t_igual('verif: la lista del CRM pone en revisión primero',
  public.admin_verificaciones_listar()->'filas'->0->>'verificacion', 'EN_REVISION');
select public._t_igual('verif: pide corrección',
  public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'REQUIERE_CORRECCION', 'Falta una foto nítida de la fachada.')::text, 'REQUIERE_CORRECCION');
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_igual('verif: el propietario ve el motivo de la corrección',
  public.mi_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')->>'motivo', 'Falta una foto nítida de la fachada.');
select public._t_acepta('verif: puede retirar y volver a subir tras la corrección', format($q$select public.retirar_documento_verificacion(%L)$q$, (select id from _t_doc)));
select public._t_rechaza('verif: sin documentos no reenvía', $q$select public.enviar_verificacion_a_revision('00000000-0000-0000-0009-0000000001a0')$q$, 'FALTAN_DOCUMENTOS');
reset role;
set local role service_role;
select public._t_acepta('verif: nuevo documento tras corrección',
  $q$select public.registrar_documento_verificacion_srv('00000000-0000-0000-0009-0000000000a1', '00000000-0000-0000-0009-0000000001a0', 'FOTO_ESTABLECIMIENTO', 'verificacion/00000000-0000-0000-0009-0000000001a0/doc2', 8, 'jpg', 4096)$q$);
reset role;
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_igual('verif: reenvía', public.enviar_verificacion_a_revision('00000000-0000-0000-0009-0000000001a0')::text, 'EN_REVISION');
select public._t_como('00000000-0000-0000-0009-0000000000e0');
select public._t_igual('verif: aprueba', public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'VERIFICADA', 'Documentos y fachada coinciden.')::text, 'VERIFICADA');
reset role;
set local role anon;
select public._t_igual('insignia pública visible para anon', public.negocio_verificado('00000000-0000-0000-0009-0000000001a0'), true);
reset role;
set local role authenticated;
select public._t_como('00000000-0000-0000-0009-0000000000e0');
select public._t_igual('verif: revoca', public.admin_decidir_verificacion('00000000-0000-0000-0009-0000000001a0', 'REVOCADA', 'Cambió de dueño y de dirección.')::text, 'REVOCADA');
select public._t_igual('insignia retirada tras revocar', public.negocio_verificado('00000000-0000-0000-0009-0000000001a0'), false);
select public._t_rechaza('verif: REVOCADA es final para el propietario', $q$select public.iniciar_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0009-0000000000a1');
select public._t_rechaza('verif: REVOCADA no se reinicia', $q$select public.iniciar_verificacion_negocio('00000000-0000-0000-0009-0000000001a0')$q$, 'TRANSICION_NO_PERMITIDA');
reset role;

-- Trazabilidad: cada paso dejó evento con actor, estado anterior y nuevo, motivo y origen.
select public._t_igual('trazabilidad: 6 eventos', (select count(*) from public.verificacion_evento where negocio_id = '00000000-0000-0000-0009-0000000001a0')::int, 6);
select public._t_igual('trazabilidad: la revocación registra anterior, nuevo, actor y origen',
  (select count(*) from public.verificacion_evento where negocio_id = '00000000-0000-0000-0009-0000000001a0'
     and estado_anterior = 'VERIFICADA' and estado_nuevo = 'REVOCADA' and actor_rol = 'SUPERSU' and origen = 'CRM'
     and actor_id = '00000000-0000-0000-0009-0000000000e0' and motivo is not null)::int, 1);
set local role service_role;
select public._t_rechaza('trazabilidad: el historial no se altera', $q$update public.verificacion_evento set motivo = 'x'$q$, 'permission denied');
reset role;
grant update on public.verificacion_evento to service_role;
set local role service_role;
select public._t_rechaza('trazabilidad: ni siquiera con permisos de tabla (trigger)', $q$update public.verificacion_evento set motivo = 'x'$q$, 'REGISTRO_INMUTABLE');
reset role;

-- Lectura de documentos: solo propietario y SuperSU, y queda auditada.
set local role service_role;
select public._t_acepta('lectura: propietario', format($q$select public.autorizar_lectura_documento_srv('00000000-0000-0000-0009-0000000000a1', %L)$q$, (select id from _t_doc)));
select public._t_acepta('lectura: SuperSU', format($q$select public.autorizar_lectura_documento_srv('00000000-0000-0000-0009-0000000000e0', %L)$q$, (select id from _t_doc)));
select public._t_rechaza('lectura: otro propietario', format($q$select public.autorizar_lectura_documento_srv('00000000-0000-0000-0009-0000000000b1', %L)$q$, (select id from _t_doc)), 'NO_AUTORIZADO');
select public._t_rechaza('lectura: staff del negocio', format($q$select public.autorizar_lectura_documento_srv('00000000-0000-0000-0009-0000000000c1', %L)$q$, (select id from _t_doc)), 'NO_AUTORIZADO');
select public._t_rechaza('lectura: documento inexistente', $q$select public.autorizar_lectura_documento_srv('00000000-0000-0000-0009-0000000000a1', gen_random_uuid())$q$, 'NO_AUTORIZADO');
reset role;
select public._t_igual('lectura: 2 lecturas auditadas', (select count(*) from public.evento_auditoria where accion = 'DOCUMENTO_VERIFICACION_LEIDO' and negocio_id = '00000000-0000-0000-0009-0000000001a0')::int, 2);

rollback;
select 'OK: onboarding_verificacion_157 — todas las pruebas pasaron' as resultado;
