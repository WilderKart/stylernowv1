-- Pruebas de las migraciones 146-149 (evidencias legales, invitación y autorizaciones de Staff,
-- Centro de Evidencias). Fase 5 del encargo del 2026-11-16.
--
-- Solo contra la base LOCAL (supabase start), nunca contra producción:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/evidencias_145_149.sql
-- Todo ocurre en una transacción que termina en ROLLBACK: no deja datos ni funciones auxiliares.
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado.
--
-- Actores (prefijo …0007-): e0 SuperSU · a1 dueño A · a2 staff A previo a la transición · a3 cliente A
-- · a4 invitado a A (correo verificado) · a5 invitado a A (sin verificar) · a6 invitación expirada
-- · b1 dueño B · b2 y b3 staff B (B en plan ESSENTIAL: tope 2) · c9 autenticado sin relación · anon.

begin;

-- ── Paridad con producción: default privileges + revokes de 145/146 ─────────
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.aceptacion_legal from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.texto_legal from public, anon, authenticated, service_role;
revoke all on public.evidencia_legal from public, anon, authenticated, service_role;
grant select on public.evidencia_legal to authenticated, service_role;

-- ── Auxiliares (INVOKER) ────────────────────────────────────────────────────
create function public._t_err(q text) returns text language plpgsql as $f$
begin
  execute q;
  return 'SIN_ERROR';
exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate);
end $f$;

-- Ejecuta q y exige que falle con un mensaje que contenga `esperado`.
create function public._t_rechaza(etiqueta text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin
  if position(esperado in r) = 0 then
    raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 120);
  end if;
end $f$;

create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then
    raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido;
  end if;
end $f$;

create function public._t_cierto(etiqueta text, cond boolean) returns void language plpgsql as $f$
begin
  if not coalesce(cond, false) then raise exception 'FALLA %', etiqueta; end if;
end $f$;

create function public._t_como(uid text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$f$;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0007-0000000000e0', 'ev-supersu@test.local',   'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000a1', 'ev-dueno-a@test.local',   'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000a2', 'ev-staff-a@test.local',   'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000a3', 'ev-cliente-a@test.local', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000a4', 'ev-invitado-a@test.local','authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000a5', 'ev-sinverificar@test.local','authenticated','authenticated', null),
  ('00000000-0000-0000-0007-0000000000a6', 'ev-expirado@test.local',  'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000b1', 'ev-dueno-b@test.local',   'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000b2', 'ev-staff-b@test.local',   'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000b3', 'ev-staff-b3@test.local',  'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0007-0000000000c9', 'ev-intruso@test.local',   'authenticated', 'authenticated', now());
insert into public.perfil (id, nombre, email) values
  ('00000000-0000-0000-0007-0000000000e0', 'SuperSU', 'ev-supersu@test.local'),
  ('00000000-0000-0000-0007-0000000000a1', 'Dueño A', 'ev-dueno-a@test.local'),
  ('00000000-0000-0000-0007-0000000000a2', 'Staff A', 'ev-staff-a@test.local'),
  ('00000000-0000-0000-0007-0000000000a3', 'Cliente A', 'ev-cliente-a@test.local'),
  ('00000000-0000-0000-0007-0000000000a4', 'Invitado A', 'ev-invitado-a@test.local'),
  ('00000000-0000-0000-0007-0000000000a5', 'Sin verificar', 'ev-sinverificar@test.local'),
  ('00000000-0000-0000-0007-0000000000a6', 'Expirado', 'ev-expirado@test.local'),
  ('00000000-0000-0000-0007-0000000000b1', 'Dueño B', 'ev-dueno-b@test.local'),
  ('00000000-0000-0000-0007-0000000000b2', 'Staff B', 'ev-staff-b@test.local'),
  ('00000000-0000-0000-0007-0000000000b3', 'Staff B3', 'ev-staff-b3@test.local'),
  ('00000000-0000-0000-0007-0000000000c9', 'Intruso', 'ev-intruso@test.local')
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0007-0000000000e0';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000000a1', 'Negocio A', 'ev-negocio-a', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-0007-0000000001b0', '00000000-0000-0000-0007-0000000000b1', 'Negocio B', 'ev-negocio-b', 'Cali', 'CO', 'ACTIVO');
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000001b0');
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-0007-0000000001b0';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values
  ('00000000-0000-0000-0007-0000000002a0', '00000000-0000-0000-0007-0000000001a0', 'Sede A', 'Cra 1', 'Cali', true),
  ('00000000-0000-0000-0007-0000000002b0', '00000000-0000-0000-0007-0000000001b0', 'Sede B', 'Cra 2', 'Cali', true);
insert into public.staff (usuario_id, nombre, foto_url) values
  ('00000000-0000-0000-0007-0000000000a2', 'Staff A', null),
  ('00000000-0000-0000-0007-0000000000b2', 'Staff B', 'https://ejemplo.test/b2.jpg'),
  ('00000000-0000-0000-0007-0000000000b3', 'Staff B3', null)
on conflict (usuario_id) do nothing;
-- a2: vínculo anterior al inicio de la transición (decisión D).
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso, created_at) values
  ('00000000-0000-0000-0007-0000000002a1', '00000000-0000-0000-0007-0000000000a2', '00000000-0000-0000-0007-0000000001a0',
   '00000000-0000-0000-0007-0000000002a0', 'ACTIVO', false, 40, now(),
   (select staff_transicion_inicio - interval '1 day' from public.configuracion_plataforma limit 1)),
  ('00000000-0000-0000-0007-0000000002b1', '00000000-0000-0000-0007-0000000000b2', '00000000-0000-0000-0007-0000000001b0',
   '00000000-0000-0000-0007-0000000002b0', 'ACTIVO', false, 40, now(), now()),
  ('00000000-0000-0000-0007-0000000002b2', '00000000-0000-0000-0007-0000000000b3', '00000000-0000-0000-0007-0000000001b0',
   '00000000-0000-0000-0007-0000000002b0', 'ACTIVO', false, 40, now(), now());
insert into public.invitacion_staff (id, negocio_id, sede_id, email, invitado_por, comision_pct, expira_at) values
  ('00000000-0000-0000-0007-0000000008a4', '00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000002a0', 'ev-invitado-a@test.local',  '00000000-0000-0000-0007-0000000000a1', 40, now() + interval '7 days'),
  ('00000000-0000-0000-0007-0000000008a5', '00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000002a0', 'ev-sinverificar@test.local','00000000-0000-0000-0007-0000000000a1', 40, now() + interval '7 days'),
  ('00000000-0000-0000-0007-0000000008a6', '00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000002a0', 'ev-expirado@test.local',    '00000000-0000-0000-0007-0000000000a1', 40, now() - interval '1 hour'),
  ('00000000-0000-0000-0007-0000000008b2', '00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000002a0', 'ev-staff-b@test.local',     '00000000-0000-0000-0007-0000000000a1', 40, now() + interval '7 days'),
  ('00000000-0000-0000-0007-0000000008c9', '00000000-0000-0000-0007-0000000001b0', '00000000-0000-0000-0007-0000000002b0', 'ev-intruso@test.local',     '00000000-0000-0000-0007-0000000000b1', 40, now() + interval '7 days'),
  ('00000000-0000-0000-0007-0000000008a7', '00000000-0000-0000-0007-0000000001b0', '00000000-0000-0000-0007-0000000002b0', 'ev-invitado-a@test.local',  '00000000-0000-0000-0007-0000000000b1', 40, now() + interval '7 days');

-- Ids de textos legales vigentes y borradores.
create temp table _t_textos as
select tipo, version, id, cambio_material, estado_juridico from public.texto_legal;
create temp table _t_contadores (clave text primary key, n bigint);
grant select on _t_textos, _t_contadores to anon, authenticated, service_role;
insert into _t_contadores select 'evidencias', count(*) from public.evidencia_legal;
insert into _t_contadores select 'auditoria', count(*) from public.evento_auditoria where entidad_tipo = 'evidencia_legal';

-- ════════════════════════════════════════════════════════════════════════════
-- 146 · aceptacion_legal y texto_legal: solo por función, hora del servidor, inmutables
-- ════════════════════════════════════════════════════════════════════════════
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a3');

select public._t_rechaza('145 cliente no inserta aceptacion_legal',
  format($q$insert into public.aceptacion_legal (usuario_id, texto_legal_id) values (auth.uid(), %L)$q$,
         (select id from _t_textos where tipo = 'TERMINOS' and version = 1)), 'permission denied');
select public._t_rechaza('145 cliente no inserta texto_legal',
  $q$insert into public.texto_legal (tipo, version, contenido) values ('TERMINOS', 99, 'x')$q$, 'permission denied');
select public._t_rechaza('145 origen inválido', $q$select public.registrar_aceptacion_legal('{}', 'hack')$q$, 'ORIGEN_INVALIDO');
select public._t_rechaza('145 registro solo service_role',
  $q$select public.registrar_aceptacion_legal_registro(auth.uid(), '{}')$q$, 'permission denied');

-- Versión vigente: 1 fila con hora del servidor; versión vieja: 0 filas.
select public._t_igual('145 acepta POLITICA_DATOS vigente',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'POLITICA_DATOS' and version = 2)], 'perfil'), 1);
select public._t_igual('145 versión antigua no se acepta',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'POLITICA_DATOS' and version = 1)], 'perfil'), 0);
select public._t_igual('145 borrador de staff no entra por aquí',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'AUTORIZACION_STAFF_TRATAMIENTO')], 'perfil'), 0);
-- TACITA solo para cambios no materiales: POLITICA_DATOS v2 es material (0), TERMINOS v1 no (1).
select public._t_igual('145 tácita rechazada en cambio material',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'POLITICA_DATOS' and version = 2)], 'ingreso', 'TACITA'), 0);
select public._t_igual('145 tácita en cambio no material',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'TERMINOS' and version = 1)], 'ingreso', 'TACITA'), 1);
select public._t_igual('145 repetir no duplica',
  public.registrar_aceptacion_legal(array[(select id from _t_textos where tipo = 'POLITICA_DATOS' and version = 2)], 'perfil'), 0);
select public._t_cierto('145 hora del servidor y origen',
  (select aceptado_at between now() - interval '5 s' and clock_timestamp() + interval '1 s' and origen = 'perfil' and tipo_aceptacion = 'EXPRESA'
   from public.aceptacion_legal where usuario_id = auth.uid() and texto_legal_id = (select id from _t_textos where tipo = 'POLITICA_DATOS' and version = 2)));
select public._t_rechaza('145 cliente no borra su aceptación',
  $q$delete from public.aceptacion_legal where usuario_id = auth.uid()$q$, 'permission denied');
select public._t_rechaza('145 cliente no cambia su aceptación',
  $q$update public.aceptacion_legal set aceptado_at = now() - interval '1 year' where usuario_id = auth.uid()$q$, 'permission denied');

-- service_role (la clave del servidor) tampoco escribe directo. Nota: el trigger de inmutabilidad
-- (116) exceptúa a postgres/supabase_admin (DBA); por eso la cadena de hashes (146) detecta esos cambios.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public._t_rechaza('145 service_role no altera textos',
  format($q$update public.texto_legal set contenido = 'alterado' where id = %L$q$, (select id from _t_textos where tipo = 'TERMINOS' and version = 1)), 'permission denied');
select public._t_rechaza('145 service_role no altera aceptaciones',
  $q$update public.aceptacion_legal set aceptado_at = now() where usuario_id = '00000000-0000-0000-0007-0000000000a3'$q$, 'permission denied');
reset role;
-- Un texto nuevo recibe su huella sola.
insert into public.texto_legal (tipo, version, contenido, cambio_material) values ('TERMINOS', 999, 'Texto de prueba', false);
select public._t_igual('145 huella automática del texto',
  (select contenido_sha256 from public.texto_legal where tipo = 'TERMINOS' and version = 999),
  encode(sha256(convert_to('Texto de prueba', 'UTF8')), 'hex'));

-- ════════════════════════════════════════════════════════════════════════════
-- 147 · Repositorio: las aceptaciones generan evidencias; RLS; inmutable; cadena verificable
-- ════════════════════════════════════════════════════════════════════════════
select public._t_igual('146 dos evidencias nuevas (expresa + tácita)',
  (select count(*) from public.evidencia_legal where usuario_id = '00000000-0000-0000-0007-0000000000a3'), 2::bigint);
select public._t_cierto('146 mapeo de la evidencia expresa',
  (select categoria = 'TRATAMIENTO_DATOS' and accion = 'ACEPTA' and rol = 'CLIENTE' and canal = 'perfil' and fuente_tabla = 'aceptacion_legal'
      and texto is not null and texto_sha256 = encode(sha256(convert_to(texto, 'UTF8')), 'hex') and importado = false
   from public.evidencia_legal where usuario_id = '00000000-0000-0000-0007-0000000000a3' and documento = 'POLITICA_DATOS'));
select public._t_igual('146 la tácita queda como ACEPTA_TACITA',
  (select accion from public.evidencia_legal where usuario_id = '00000000-0000-0000-0007-0000000000a3' and documento = 'TERMINOS'), 'ACEPTA_TACITA');
select public._t_igual('146 cadena íntegra', (select count(*) from public.verificar_cadena_evidencias(1, null)), 0::bigint);

set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a3');
select public._t_igual('146 titular ve lo suyo', (select count(*) from public.evidencia_legal), 2::bigint);
select public._t_rechaza('146 titular no borra', $q$delete from public.evidencia_legal$q$, 'permission denied');
select public._t_rechaza('146 titular no edita', $q$update public.evidencia_legal set accion = 'RECHAZA'$q$, 'permission denied');
select public._t_rechaza('146 titular no inserta',
  $q$insert into public.evidencia_legal (usuario_id, rol, categoria, documento, accion, ocurrido_at) values (auth.uid(), 'CLIENTE', 'CONTRACTUAL', 'TERMINOS', 'ACEPTA', now())$q$, 'permission denied');
select public._t_rechaza('146 titular no verifica la cadena', $q$select count(*) from public.verificar_cadena_evidencias(1, null)$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0007-0000000000c9');
select public._t_igual('146 intruso no ve nada', (select count(*) from public.evidencia_legal), 0::bigint);
select public._t_como('00000000-0000-0000-0007-0000000000e0');
select public._t_igual('146 SuperSU no lee directo (solo por funciones auditadas)', (select count(*) from public.evidencia_legal), 0::bigint);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public._t_rechaza('146 anon no lee', $q$select count(*) from public.evidencia_legal$q$, 'permission denied');
select public._t_rechaza('146 anon no acepta textos', $q$select public.registrar_aceptacion_legal('{}', 'perfil')$q$, 'permission denied');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public._t_rechaza('146 service_role no inserta evidencias',
  $q$insert into public.evidencia_legal (usuario_id, rol, categoria, documento, accion, ocurrido_at) values (null, 'SISTEMA', 'CONTRACTUAL', 'TERMINOS', 'ACEPTA', now())$q$, 'permission denied');
select public._t_rechaza('146 service_role no borra evidencias', $q$delete from public.evidencia_legal$q$, 'permission denied');
select public._t_rechaza('146 service_role no inserta aceptaciones directas',
  $q$insert into public.aceptacion_legal (usuario_id, texto_legal_id) select '00000000-0000-0000-0007-0000000000c9', id from public.texto_legal limit 1$q$, 'permission denied');
reset role;

-- Manipulación directa (solo postgres puede): la verificación la detecta.
savepoint manipulacion;
update public.evidencia_legal set texto = texto || ' (alterado)' where usuario_id = '00000000-0000-0000-0007-0000000000a3' and documento = 'POLITICA_DATOS';
select public._t_cierto('146 manipulación detectada',
  (select bool_or(problema in ('CONTENIDO_ALTERADO', 'TEXTO_ALTERADO')) from public.verificar_cadena_evidencias(1, null)));
rollback to savepoint manipulacion;
select public._t_igual('146 cadena íntegra tras revertir', (select count(*) from public.verificar_cadena_evidencias(1, null)), 0::bigint);

-- ════════════════════════════════════════════════════════════════════════════
-- 147 · Invitación: pública enmascarada, enrutado solo servidor, aceptación transaccional
-- ════════════════════════════════════════════════════════════════════════════
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public._t_cierto('147 invitación pública enmascarada',
  (select p->>'negocio' = 'Negocio A' and p->>'estado' = 'PENDIENTE' and position('ev-invitado-a' in p->>'email_enmascarado') = 0
      and p->>'email_enmascarado' like 'ev%@test.local'
   from public.invitacion_publica('00000000-0000-0000-0007-0000000008a4') p));
select public._t_igual('147 expirada se reporta como EXPIRADA',
  (select p->>'estado' from public.invitacion_publica('00000000-0000-0000-0007-0000000008a6') p), 'EXPIRADA');
select public._t_cierto('147 id inexistente devuelve null', (select public.invitacion_publica(gen_random_uuid()) is null));
select public._t_rechaza('147 anon no enruta', $q$select public.invitacion_para_enrutar('00000000-0000-0000-0007-0000000008a4')$q$, 'permission denied');
select public._t_rechaza('147 anon no acepta', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a4', true)$q$, 'permission denied');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public._t_cierto('147 servidor enruta: correo, estado y si tiene cuenta',
  (select r->>'email' = 'ev-invitado-a@test.local' and (r->>'tiene_cuenta')::boolean and r->>'estado' = 'PENDIENTE'
   from public.invitacion_para_enrutar('00000000-0000-0000-0007-0000000008a4') r));
reset role;

set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a3');
select public._t_rechaza('147 autenticado tampoco enruta', $q$select public.invitacion_para_enrutar('00000000-0000-0000-0007-0000000008a4')$q$, 'permission denied');
select public._t_rechaza('147 otro correo no acepta', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a4', true)$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0007-0000000000a5');
select public._t_rechaza('147 correo sin verificar', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a5', true)$q$, 'CORREO_NO_VERIFICADO');
select public._t_como('00000000-0000-0000-0007-0000000000a6');
select public._t_rechaza('147 invitación expirada', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a6', true)$q$, 'INVITACION_EXPIRADA');
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_rechaza('147 sin autorización de tratamiento', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a4', false)$q$, 'AUTORIZACION_TRATAMIENTO_REQUERIDA');
select public._t_rechaza('147 aceptar por la función vieja', $q$select public.responder_invitacion('00000000-0000-0000-0007-0000000008a4', true)$q$, 'USA_ACEPTAR_INVITACION_STAFF');
select public._t_rechaza('147 inexistente', $q$select public.aceptar_invitacion_staff(gen_random_uuid(), true)$q$, 'INVITACION_NO_ENCONTRADA');
select public._t_cierto('147 aún sin vínculo ni evidencia tras los rechazos',
  (select not exists (select 1 from public.vinculo_staff_negocio where staff_id = auth.uid())
      and not exists (select 1 from public.evidencia_legal where usuario_id = auth.uid())));

-- Aceptación válida: vínculo + evidencia de tratamiento en la misma transacción; reintento idempotente.
select public._t_cierto('147 acepta', (select (r->>'aceptada')::boolean from public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a4', true) r));
select public._t_cierto('147 reintento idempotente', (select (r->>'ya_aceptada')::boolean from public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008a4', true) r));
select public._t_igual('147 una sola evidencia de tratamiento', (select count(*) from public.evidencia_legal where usuario_id = auth.uid()), 1::bigint);
select public._t_cierto('147 evidencia de tratamiento correcta',
  (select documento = 'AUTORIZACION_STAFF_TRATAMIENTO' and accion = 'ACEPTA' and canal = 'invitacion' and rol = 'STAFF'
      and negocio_id = '00000000-0000-0000-0007-0000000001a0' and categoria = 'TRATAMIENTO_DATOS'
      and position('Negocio A' in texto) > 0 and version = '1-borrador' and position('{negocio}' in texto) = 0
   from public.evidencia_legal where usuario_id = auth.uid()));
reset role;
select public._t_cierto('147 vínculo ACTIVO creado',
  (select exists (select 1 from public.vinculo_staff_negocio where staff_id = '00000000-0000-0000-0007-0000000000a4' and negocio_id = '00000000-0000-0000-0007-0000000001a0' and estado = 'ACTIVO')));
select public._t_igual('147 invitación ACEPTADA', (select estado::text from public.invitacion_staff where id = '00000000-0000-0000-0007-0000000008a4'), 'ACEPTADA');

set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000b2');
select public._t_rechaza('147 un solo vínculo activo (decisión A)', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008b2', true)$q$, 'YA_TIENE_VINCULO_ACTIVO');
select public._t_como('00000000-0000-0000-0007-0000000000c9');
select public._t_rechaza('147 tope del plan', $q$select public.aceptar_invitacion_staff('00000000-0000-0000-0007-0000000008c9', true)$q$, 'PLAN_LIMIT_EXCEEDED');
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_cierto('147 rechazar sigue por la función vieja',
  (select not (r->>'aceptada')::boolean from public.responder_invitacion('00000000-0000-0000-0007-0000000008a7', false) r));
reset role;
select public._t_igual('147 rechazo registrado', (select estado::text from public.invitacion_staff where id = '00000000-0000-0000-0007-0000000008a7'), 'RECHAZADA');
select public._t_cierto('147 tope y vínculo no crearon evidencias',
  (select not exists (select 1 from public.evidencia_legal where usuario_id in ('00000000-0000-0000-0007-0000000000c9', '00000000-0000-0000-0007-0000000000b2'))));

-- ════════════════════════════════════════════════════════════════════════════
-- 147 · Publicación: independiente, voluntaria, revocable; foto obligatoria; transición
-- ════════════════════════════════════════════════════════════════════════════
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_cierto('147 a4 no publicable sin foto ni autorización', not public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
select public._t_rechaza('147 documento inválido', $q$select public.autorizar_staff('TERMINOS')$q$, 'DOCUMENTO_INVALIDO');
select public._t_rechaza('147 canal inválido', $q$select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'sql')$q$, 'CANAL_INVALIDO');
select public._t_cierto('147 autoriza publicación (sin foto todavía)', public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION') is not null);
select public._t_cierto('147 publicación autorizada pero sin foto: no publicable', not public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
select public._t_igual('147 autorizar dos veces es idempotente',
  public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION'),
  (select id from public.evidencia_legal where usuario_id = auth.uid() and documento = 'AUTORIZACION_STAFF_PUBLICACION'));
reset role;
update public.staff set foto_url = 'https://ejemplo.test/a4.jpg' where usuario_id = '00000000-0000-0000-0007-0000000000a4';
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_cierto('147 con foto + autorización: publicable', public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
select public._t_cierto('147 evidencia de publicación', (select accion = 'ACEPTA' and canal = 'perfil' and categoria = 'CONSENTIMIENTO_ESPECIFICO'
   from public.evidencia_legal where usuario_id = auth.uid() and documento = 'AUTORIZACION_STAFF_PUBLICACION'));

-- a2 (previo a la transición): sin tratamiento no puede autorizar publicación; sigue visible mientras dure la transición.
select public._t_como('00000000-0000-0000-0007-0000000000a2');
select public._t_rechaza('147 publicación exige tratamiento', $q$select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION')$q$, 'REQUIERE_TRATAMIENTO');
select public._t_cierto('147 a2 visible durante la transición (decisión D)', public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
-- c9 (sin vínculo) y a3 (cliente): nada que autorizar.
select public._t_como('00000000-0000-0000-0007-0000000000c9');
select public._t_rechaza('147 sin vínculo no autoriza', $q$select public.autorizar_staff('AUTORIZACION_STAFF_TRATAMIENTO')$q$, 'SIN_VINCULO');
select public._t_rechaza('147 sin vínculo no revoca', $q$select public.revocar_publicacion_staff()$q$, 'SIN_VINCULO');

-- Lo público: anon ve a a2 (transición) y a4 (autorizado); no ve a b3 (sin foto) en B.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public._t_cierto('147 público: a2 y a4 visibles',
  (select array_agg(staff_id order by staff_id) = array['00000000-0000-0000-0007-0000000000a2', '00000000-0000-0000-0007-0000000000a4']::uuid[]
   from public.negocio_staff_publico('00000000-0000-0000-0007-0000000001a0')));
select public._t_cierto('147 perfil público de a4', public.staff_perfil_publico('00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000000a4') is not null);
select public._t_rechaza('147 anon no autoriza', $q$select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION')$q$, 'permission denied');

-- Revocación: evento nuevo ligado al original; deja de verse; la aceptación previa sigue ahí.
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_cierto('147 revoca', public.revocar_publicacion_staff() is not null);
select public._t_cierto('147 revocación ligada a la aceptación',
  (select r.relacionado_con = a.id from public.evidencia_legal r
    join public.evidencia_legal a on a.usuario_id = r.usuario_id and a.documento = r.documento and a.accion = 'ACEPTA'
   where r.usuario_id = auth.uid() and r.documento = 'AUTORIZACION_STAFF_PUBLICACION' and r.accion = 'REVOCA'));
select public._t_igual('147 revocar dos veces es idempotente', public.revocar_publicacion_staff(),
  (select id from public.evidencia_legal where usuario_id = auth.uid() and documento = 'AUTORIZACION_STAFF_PUBLICACION' and accion = 'REVOCA'));
select public._t_cierto('147 revocado: no publicable', not public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
select public._t_igual('147 historial de a4: tratamiento + publicación + revocación',
  (select count(*) from public.evidencia_legal where usuario_id = auth.uid()), 3::bigint);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select public._t_cierto('147 público tras revocar: solo a2',
  (select array_agg(staff_id) = array['00000000-0000-0000-0007-0000000000a2']::uuid[] from public.negocio_staff_publico('00000000-0000-0000-0007-0000000001a0')));
select public._t_cierto('147 perfil público de a4 desaparece', public.staff_perfil_publico('00000000-0000-0000-0007-0000000001a0', '00000000-0000-0000-0007-0000000000a4') is null);
-- Re-autorizar después de revocar vuelve a publicar (nuevo evento ACEPTA).
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_cierto('147 re-autoriza tras revocar', public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION') is not null);
-- (sentencia aparte: staff_es_publicable es STABLE y ve la instantánea del inicio de la sentencia)
select public._t_cierto('147 re-autorizado: publicable de nuevo', public.staff_es_publicable(auth.uid(), '00000000-0000-0000-0007-0000000001a0'));
select public._t_igual('147 historial de a4 ahora: 4 eventos', (select count(*) from public.evidencia_legal where usuario_id = auth.uid()), 4::bigint);

-- Fin de la transición: a2 (sin autorización) deja de verse; a4 (autorizado) sigue.
reset role;
savepoint fin_transicion;
update public.configuracion_plataforma set staff_transicion_fin = now() - interval '1 second';
select public._t_cierto('147 fin de transición: a2 oculto, a4 visible',
  not public.staff_es_publicable('00000000-0000-0000-0007-0000000000a2', '00000000-0000-0000-0007-0000000001a0')
  and public.staff_es_publicable('00000000-0000-0000-0007-0000000000a4', '00000000-0000-0000-0007-0000000001a0'));
select public._t_cierto('147 fin de transición: vínculo y cuenta de a2 intactos',
  (select estado = 'ACTIVO' from public.vinculo_staff_negocio where id = '00000000-0000-0000-0007-0000000002a1'));
rollback to savepoint fin_transicion;

-- estado_autorizaciones_staff: dueño ve a todos los suyos; staff solo a sí mismo; otros nada.
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a1');
select public._t_igual('147 dueño A ve a su equipo', (select count(*) from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0')), 2::bigint);
select public._t_cierto('147 dueño A ve el estado de a4',
  (select tratamiento = 'ACEPTA' and publicacion = 'ACEPTA' and tiene_foto and publicable and not en_transicion
   from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0') where staff_id = '00000000-0000-0000-0007-0000000000a4'));
select public._t_cierto('147 dueño A ve a a2 en transición',
  (select tratamiento is null and en_transicion and publicable from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0') where staff_id = '00000000-0000-0000-0007-0000000000a2'));
select public._t_rechaza('147 dueño A no ve el equipo de B', $q$select count(*) from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001b0')$q$, 'NO_AUTORIZADO');
select public._t_igual('147 dueño A ve las evidencias de su negocio',
  (select count(*) from public.evidencia_legal where negocio_id = '00000000-0000-0000-0007-0000000001a0'), 4::bigint);
select public._t_como('00000000-0000-0000-0007-0000000000a4');
select public._t_igual('147 staff solo se ve a sí mismo', (select count(*) from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0')), 1::bigint);
select public._t_como('00000000-0000-0000-0007-0000000000b1');
select public._t_rechaza('147 dueño B no ve el equipo de A', $q$select count(*) from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0')$q$, 'NO_AUTORIZADO');
select public._t_igual('147 dueño B no ve evidencias de A', (select count(*) from public.evidencia_legal where negocio_id = '00000000-0000-0000-0007-0000000001a0'), 0::bigint);
select public._t_como('00000000-0000-0000-0007-0000000000a3');
select public._t_rechaza('147 cliente no consulta autorizaciones', $q$select count(*) from public.estado_autorizaciones_staff('00000000-0000-0000-0007-0000000001a0')$q$, 'NO_AUTORIZADO');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 149 · Centro de Evidencias: solo SuperSU, todo auditado, huellas recalculadas
-- ════════════════════════════════════════════════════════════════════════════
-- El SuperSU no lee la tabla: el id se resuelve antes, como postgres.
create temp table _t_ids as select 'a4_trat' as clave, id from public.evidencia_legal where usuario_id = '00000000-0000-0000-0007-0000000000a4' and documento = 'AUTORIZACION_STAFF_TRATAMIENTO';
grant select on _t_ids to authenticated;
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000a1');
select public._t_rechaza('148 dueño no busca', $q$select public.admin_buscar_evidencias()$q$, 'NO_AUTORIZADO');
select public._t_rechaza('148 dueño no exporta', $q$select public.admin_expediente_evidencias('00000000-0000-0000-0007-0000000000a4', 'motivo suficientemente largo')$q$, 'NO_AUTORIZADO');
select public._t_rechaza('148 dueño no verifica', $q$select public.admin_verificar_cadena_evidencias()$q$, 'NO_AUTORIZADO');
select public._t_como('00000000-0000-0000-0007-0000000000e0');
select public._t_igual('148 SuperSU busca por titular',
  (select (r->>'total')::int from public.admin_buscar_evidencias(p_usuario => '00000000-0000-0000-0007-0000000000a4') r), 4);
select public._t_igual('148 SuperSU busca por correo',
  (select (r->>'total')::int from public.admin_buscar_evidencias(p_correo => 'EV-INVITADO-A@test.local') r), 4);
select public._t_igual('148 correo sin cuenta: vacío', (select (r->>'total')::int from public.admin_buscar_evidencias(p_correo => 'nadie@test.local') r), 0);
select public._t_igual('148 filtro por acción', (select (r->>'total')::int from public.admin_buscar_evidencias(p_usuario => '00000000-0000-0000-0007-0000000000a4', p_accion => 'REVOCA') r), 1);
select public._t_cierto('148 detalle verificado con texto exacto',
  (select (d->'verificacion'->>'contenido_ok')::boolean and (d->'verificacion'->>'texto_ok')::boolean and (d->'verificacion'->>'enlace_ok')::boolean and d->>'texto' is not null
   from public.admin_evidencia_detalle((select id from _t_ids where clave = 'a4_trat')) d));
select public._t_rechaza('148 expediente exige motivo', $q$select public.admin_expediente_evidencias('00000000-0000-0000-0007-0000000000a4', 'corto')$q$, 'MOTIVO_REQUERIDO');
select public._t_cierto('148 expediente completo y declarando lo no capturado',
  (select (x->>'total')::int = 4 and (x->>'fallas_verificacion')::int = 0 and x->'no_capturado' @> '["Dirección IP (decisión F: no se recolecta)"]'::jsonb
      and x->'titular'->>'correo' = 'ev-invitado-a@test.local'
   from public.admin_expediente_evidencias('00000000-0000-0000-0007-0000000000a4', 'Solicitud del titular radicada en prueba local') x));
select public._t_igual('148 cadena íntegra desde el CRM', (select jsonb_array_length(r->'problemas') from public.admin_verificar_cadena_evidencias() r), 0);
reset role;
select public._t_igual('148 cada consulta quedó en auditoría (7 llamadas)',
  (select count(*) - (select n from _t_contadores where clave = 'auditoria') from public.evento_auditoria where entidad_tipo = 'evidencia_legal'), 7::bigint);
select public._t_cierto('148 la exportación guarda el motivo y el actor',
  (select motivo = 'Solicitud del titular radicada en prueba local' and actor_id = '00000000-0000-0000-0007-0000000000e0' and actor_tipo = 'SUPERSU'
   from public.evento_auditoria where entidad_tipo = 'evidencia_legal' and accion = 'EXPORTA_EXPEDIENTE' order by created_at desc limit 1));
-- Manipulación detectada también desde el CRM.
savepoint manipulacion2;
update public.evidencia_legal set accion = 'RECHAZA' where usuario_id = '00000000-0000-0000-0007-0000000000a4' and documento = 'AUTORIZACION_STAFF_TRATAMIENTO';
set local role authenticated;
select public._t_como('00000000-0000-0000-0007-0000000000e0');
select public._t_cierto('148 CRM detecta la manipulación', (select jsonb_array_length(r->'problemas') > 0 from public.admin_verificar_cadena_evidencias() r));
select public._t_cierto('148 detalle marca la huella como no coincidente',
  (select not (d->'verificacion'->>'contenido_ok')::boolean
   from public.admin_evidencia_detalle((select id from _t_ids where clave = 'a4_trat')) d));
reset role;
rollback to savepoint manipulacion2;

-- ════════════════════════════════════════════════════════════════════════════
-- Borrado de cuenta: las evidencias NO se borran en cascada (decisión G)
-- ════════════════════════════════════════════════════════════════════════════
savepoint borrado;
-- evento_auditoria.actor_id también referencia auth.users sin cascada (regla previa, 117); se aparta
-- aquí para aislar lo que se prueba: que las evidencias no dependen de la cuenta.
delete from public.evento_auditoria where actor_id = '00000000-0000-0000-0007-0000000000a4';
delete from auth.users where id = '00000000-0000-0000-0007-0000000000a4';
select public._t_igual('G evidencias de a4 sobreviven al borrado de su cuenta',
  (select count(*) from public.evidencia_legal where usuario_id = '00000000-0000-0000-0007-0000000000a4'), 4::bigint);
select public._t_igual('G cadena íntegra tras el borrado', (select count(*) from public.verificar_cadena_evidencias(1, null)), 0::bigint);
rollback to savepoint borrado;
-- a3 tiene filas en aceptacion_legal (FK sin cascada): el borrado queda BLOQUEADO (contradicción 2 documentada en PROGRESO.md).
select public._t_rechaza('G borrado con aceptacion_legal bloqueado por la FK (documentado)',
  $q$delete from auth.users where id = '00000000-0000-0000-0007-0000000000a3'$q$, 'aceptacion_legal');

select 'OK: evidencias_146_149 — todas las pruebas pasaron' as resultado;
rollback;
