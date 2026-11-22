-- Pruebas de las migraciones 170-178 (barberos adicionales, FASE 2A). Solo contra la base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/adicionales_170.sql
-- Transacción terminada en ROLLBACK: no deja datos. Cada bloque lanza 'FALLA …' si el comportamiento no es el esperado.
-- Concurrencia real (dos sesiones): tests/sql/adicionales_170_concurrencia.sh. HTTP con JWT: tests/sql/adicionales_http.sh.
-- Negocios: N1 essential (propietario O1, admin ADM) · N2 studio (O2) · NG signature (OG) · NX ajeno (OX).
-- Pagos: aplicar_evento_pago se llama como lo hace sincronizar.ts (el estado real lo trae Mercado Pago; aquí se simula el resultado).

begin;

create function public._t_err(q text) returns text language plpgsql as $f$
begin execute q; return 'SIN_ERROR'; exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate); end $f$;
create function public._t_igual(etiqueta text, obtenido anyelement, esperado anyelement) returns void language plpgsql as $f$
begin
  if obtenido is distinct from esperado then raise exception 'FALLA %: esperaba %, obtuvo %', etiqueta, esperado, obtenido; end if;
end $f$;
create function public._t_cierto(etiqueta text, c boolean) returns void language plpgsql as $f$
begin if not coalesce(c, false) then raise exception 'FALLA %', etiqueta; end if; end $f$;
-- Ejecuta q como un usuario autenticado (JWT simulado) y devuelve el error o 'SIN_ERROR'.
create function public._t_como_err(uid text, q text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q; r := 'SIN_ERROR'; exception when others then r := coalesce(nullif(sqlerrm, ''), sqlstate); end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $f$;
create function public._t_como_json(uid text, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q into r; exception when others then r := jsonb_build_object('error', coalesce(nullif(sqlerrm, ''), sqlstate)); end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $f$;
create function public._t_rechaza(etiqueta text, uid text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_como_err(uid, q);
begin if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 160); end if; end $f$;
create function public._t_acepta(etiqueta text, uid text, q text) returns void language plpgsql as $f$
declare r text := public._t_como_err(uid, q);
begin if r <> 'SIN_ERROR' then raise exception 'FALLA %: esperaba éxito, obtuvo «%»', etiqueta, left(r, 160); end if; end $f$;
create function public._t_rechaza_pg(etiqueta text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', etiqueta, esperado, left(r, 160); end if; end $f$;
create function public._t_lim(n uuid) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(n) ->> 'limite')::int; $f$;
create function public._t_cap(n uuid, k text) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(n) ->> k)::int; $f$;
create function public._t_lote(n uuid) returns uuid language sql security definer set search_path = public as $f$
  select id from public.adicional_lote where negocio_id = n order by created_at desc, id limit 1; $f$;
create function public._t_lestado(l uuid) returns text language sql security definer set search_path = public as $f$
  select estado from public.adicional_lote where id = l; $f$;
create function public._t_aprobar(p uuid, mp text, monto numeric) returns jsonb language sql as $f$
  select public.aplicar_evento_pago(p, mp, 'APROBADO', jsonb_build_object('transaction_amount', monto, 'status', 'approved')); $f$;
create function public._t_rechazar(p uuid, mp text) returns jsonb language sql as $f$
  select public.aplicar_evento_pago(p, mp, 'RECHAZADO', jsonb_build_object('status', 'rejected', 'status_detail', 'cc_rejected_other_reason')); $f$;
create function public._t_pago_de(l uuid) returns uuid language sql security definer set search_path = public as $f$
  select pago_id from public.adicional_cobro where lote_id = l and estado = 'PENDIENTE' order by created_at desc limit 1; $f$;
create function public._t_hist(l uuid, ev text) returns int language sql security definer set search_path = public as $f$
  select count(*)::int from public.adicional_historial where lote_id = l and evento = ev; $f$;
create function public._t_mant(p_ahora timestamptz default now()) returns jsonb language sql as $f$
  select public.adicional_mantenimiento_srv(p_ahora, true); $f$;

-- ── Fixtures ────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-00f2-0000000000' || x.k)::uuid, 'f2a-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','o1'),('a2','o2'),('a3','og'),('a4','ox'),('a5','adm'),('a6','su'),('b1','u1'),('b2','u2'),('b3','u3'),('b4','u4')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-00f2-0000000000' || x.k)::uuid, 'F2A ' || x.n, 'f2a-' || x.n || '@test.local'
from (values ('a1','o1'),('a2','o2'),('a3','og'),('a4','ox'),('a5','adm'),('a6','su'),('b1','u1'),('b2','u2'),('b3','u3'),('b4','u4')) x(k, n)
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
-- Un solo SuperSU en la base: dentro de la transacción se desciende al existente y se asciende a SU (todo termina en ROLLBACK).
update public.perfil set es_supersu = false where es_supersu and id <> '00000000-0000-0000-00f2-0000000000a6';
update public.perfil set es_supersu = true where id = '00000000-0000-0000-00f2-0000000000a6';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values
  ('00000000-0000-0000-00f2-000000000101', '00000000-0000-0000-00f2-0000000000a1', 'F2A N1', 'f2a-n1', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-00f2-000000000102', '00000000-0000-0000-00f2-0000000000a2', 'F2A N2', 'f2a-n2', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-00f2-000000000103', '00000000-0000-0000-00f2-0000000000a3', 'F2A NG', 'f2a-ng', 'Cali', 'CO', 'ACTIVO'),
  ('00000000-0000-0000-00f2-000000000104', '00000000-0000-0000-00f2-0000000000a4', 'F2A NX', 'f2a-nx', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-00f2-000000000101';
update public.negocio set plan_codigo = 'STUDIO' where id = '00000000-0000-0000-00f2-000000000102';
update public.negocio set plan_codigo = 'SIGNATURE' where id = '00000000-0000-0000-00f2-000000000103';
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-00f2-000000000104';
delete from public.suscripcion where negocio_id in (select id from public.negocio where slug like 'f2a-%');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('00000000-0000-0000-00f2-000000000101', 'ESSENTIAL', 'ACTIVA', now() + interval '20 days', 'CO'),
  ('00000000-0000-0000-00f2-000000000102', 'STUDIO', 'ACTIVA', now() + interval '3 days', 'CO'),
  ('00000000-0000-0000-00f2-000000000103', 'SIGNATURE', 'ACTIVA', now() + interval '20 days', 'CO'),
  ('00000000-0000-0000-00f2-000000000104', 'ESSENTIAL', 'ACTIVA', now() + interval '20 days', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal)
select ('00000000-0000-0000-00f2-0000000002' || x.k)::uuid, ('00000000-0000-0000-00f2-0000000001' || x.k)::uuid, 'Sede ' || x.k, 'Cra 1', 'Cali', true
from (values ('01'),('02'),('03'),('04')) x(k);
insert into public.staff (usuario_id, nombre, foto_url)
select ('00000000-0000-0000-00f2-0000000000' || x.k)::uuid, 'F2A ' || x.n, 'https://res.cloudinary.com/demo/image/upload/x.jpg'
from (values ('a5','adm'),('b1','u1'),('b2','u2'),('b3','u3'),('b4','u4')) x(k, n) on conflict (usuario_id) do nothing;
-- ADM: administrador delegado de N1 (no presta servicios).
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso, es_admin, presta_servicios) values
  ('00000000-0000-0000-00f2-0000000000a5', '00000000-0000-0000-00f2-000000000101', '00000000-0000-0000-00f2-000000000201', 'ACTIVO', now(), true, false);

\set N1 '''00000000-0000-0000-00f2-000000000101'''
\set N2 '''00000000-0000-0000-00f2-000000000102'''
\set NG '''00000000-0000-0000-00f2-000000000103'''
\set NX '''00000000-0000-0000-00f2-000000000104'''
\set O1 '''00000000-0000-0000-00f2-0000000000a1'''
\set O2 '''00000000-0000-0000-00f2-0000000000a2'''
\set OG '''00000000-0000-0000-00f2-0000000000a3'''
\set OX '''00000000-0000-0000-00f2-0000000000a4'''
\set ADM '''00000000-0000-0000-00f2-0000000000a5'''
\set SU '''00000000-0000-0000-00f2-0000000000a6'''

-- ═══ 1. Datos sembrados, vocabulario y funciones de fecha ═══════════════════════════════════
select public._t_igual('precio inicial CO 51.900 en los 4 planes', (select count(*) from public.adicional_precio_plan where pais_codigo = 'CO' and precio_mensual = 51900)::int, 4);
select public._t_igual('config: límite por negocio 50', (select max_por_negocio from public.adicional_config), 50);
select public._t_igual('config: gracia 3 días', (select gracia_dias from public.adicional_config), 3);
select public._t_igual('config: avisos 7/3/1', (select avisos_dias_antes from public.adicional_config), '{7,3,1}'::int[]);
select public._t_igual('config: periodo 30 días', (select periodo_dias from public.adicional_config), 30);
select public._t_igual('11 estados definidos (máquina única)', (select count(*) from public.adicional_estado_def)::int, 11);
select public._t_igual('fin de periodo = +30 días (Bogotá)', public.adicional_fin_periodo('2026-01-31 23:00:00-05'), '2026-03-02 23:00:00-05'::timestamptz);
select public._t_igual('días para (calendario Bogotá)', public.adicional_dias_para('2026-12-18 03:00:00+00', '2026-12-17 20:00:00-05'), 0);
select public._t_igual('días para vencido es negativo', public.adicional_dias_para('2026-12-10 12:00:00-05', '2026-12-17 12:00:00-05'), -7);

-- ═══ 2. REVOKE verificado en los tres roles ═════════════════════════════════════════════════
create function public._t_priv(p text, rol text) returns boolean language sql as $f$
  select has_function_privilege(rol, p::regprocedure, 'execute'); $f$;
create function public._t_public(p text) returns boolean language sql as $f$
  select exists (select 1 from pg_proc x, aclexplode(coalesce(x.proacl, acldefault('f', x.proowner))) a where x.oid = p::regprocedure and a.grantee = 0); $f$;
do $$
declare f text;
  -- Solo servidor (service_role): ningún navegador puede llamarlas.
  srv text[] := array['public.adicional_checkout_fallido_srv(uuid,uuid,text)', 'public.adicional_marcar_pago_pendiente_srv(uuid,text)',
                      'public.adicional_mantenimiento_srv(timestamptz,boolean)'];
  -- Internas: nadie de la API.
  internas text[] := array['public._adicional_transicionar(uuid,text,text,text,uuid,text,uuid,jsonb)', 'public._adicional_historial(uuid,text,text,uuid,text,uuid,text,jsonb,text,text,integer,integer)',
                           'public._adicionales_activos(uuid)', 'public._adicionales_resumen(uuid)', 'public._adicional_notificar(uuid,text,text,jsonb)',
                           'public._adicional_aplicar_pago(pago,text,pago_estado,jsonb)', 'public._adicional_revisar_pago(pago,uuid,text,text,jsonb)',
                           'public._adicional_cotizacion(uuid,integer,uuid)', 'public._adicional_cerrar_checkout(uuid,text,uuid,text)',
                           'public._adicional_exige_supersu(text,boolean)', 'public._capacidad_profesional(uuid,text,integer,text)'];
  -- Con control dentro de la función (propietario o SuperSU): authenticated sí, anon y public no.
  api text[] := array['public.adicional_cotizar(uuid,integer)', 'public.adicional_iniciar(uuid,integer,numeric)', 'public.adicional_renovar(uuid)',
                      'public.adicional_cancelar_renovacion(uuid,text)', 'public.adicional_mis_lotes(uuid)',
                      'public.admin_adicional_config_obtener()', 'public.admin_adicional_config_guardar(jsonb,text)',
                      'public.admin_adicional_precio_guardar(character,plan_codigo,numeric,text,boolean)', 'public.admin_adicional_listar(jsonb)',
                      'public.admin_adicional_detalle(uuid)', 'public.admin_adicional_accion(uuid,text,text,jsonb)',
                      'public.admin_adicional_activar_manual(uuid,integer,integer,text,text,text)',
                      'public.admin_adicional_reembolso_solicitar(uuid,text,text,text,numeric)', 'public.admin_adicional_reembolso_decidir(uuid,text,text,text,boolean)',
                      'public.admin_adicional_reembolso_listar(text)', 'public.admin_adicional_revision_listar(text)', 'public.admin_adicional_revision_resolver(uuid,text,text)'];
begin
  foreach f in array srv loop
    if public._t_priv(f, 'anon') or public._t_priv(f, 'authenticated') or public._t_public(f) or not public._t_priv(f, 'service_role') then
      raise exception 'FALLA REVOKE servidor %: anon=% authenticated=% public=% service_role=%', f, public._t_priv(f, 'anon'), public._t_priv(f, 'authenticated'), public._t_public(f), public._t_priv(f, 'service_role');
    end if;
  end loop;
  foreach f in array internas loop
    if public._t_priv(f, 'anon') or public._t_priv(f, 'authenticated') or public._t_public(f) then
      raise exception 'FALLA REVOKE interna %: anon=% authenticated=% public=%', f, public._t_priv(f, 'anon'), public._t_priv(f, 'authenticated'), public._t_public(f);
    end if;
  end loop;
  foreach f in array api loop
    if public._t_priv(f, 'anon') or public._t_public(f) or not public._t_priv(f, 'authenticated') then
      raise exception 'FALLA REVOKE API %: anon=% public=% authenticated=%', f, public._t_priv(f, 'anon'), public._t_public(f), public._t_priv(f, 'authenticated');
    end if;
  end loop;
end $$;
-- Tablas: ningún acceso de escritura ni lectura directa de anon; authenticated solo SELECT bajo RLS en las que corresponde.
select public._t_cierto('anon sin acceso a las tablas', not exists (
  select 1 from information_schema.role_table_grants where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
    and table_name in ('adicional_lote', 'adicional_cobro', 'adicional_historial', 'adicional_config', 'adicional_precio_plan', 'adicional_reembolso', 'adicional_pago_revision', 'adicional_estado_def', 'adicional_transicion', 'adicional_mantenimiento_corrida')));
select public._t_cierto('authenticated sin escritura en las tablas', not exists (
  select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    and table_name like 'adicional\_%'));
select public._t_cierto('RLS activada en todas', (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname like 'adicional\_%' and relkind = 'r'));

-- ═══ 3. Permisos: solo el propietario ═══════════════════════════════════════════════════════
select public._t_rechaza('admin delegado NO cotiza', :ADM, format('select public.adicional_cotizar(%L, 3)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: otro propietario NO cotiza N1', :OX, format('select public.adicional_cotizar(%L, 3)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('SuperSU NO compra por el propietario', :SU, format('select public.adicional_iniciar(%L, 3, 155700)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('admin NO inicia pagos', :ADM, format('select public.adicional_iniciar(%L, 3, 155700)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('admin NO consulta lotes/pagos', :ADM, format('select public.adicional_mis_lotes(%L)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: OX NO consulta lotes de N1', :OX, format('select public.adicional_mis_lotes(%L)', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('sin sesión NO cotiza', null, format('select public.adicional_cotizar(%L, 3)', :N1), 'NO_AUTORIZADO');

-- ═══ 4. Cotización: el precio lo calcula la base ═══════════════════════════════════════════
select public._t_igual('3 × 51.900 = 155.700', (public._t_como_json(:O1, format('select public.adicional_cotizar(%L, 3)', :N1)) ->> 'total')::numeric, 155700::numeric);
select public._t_igual('precio unitario', (public._t_como_json(:O1, format('select public.adicional_cotizar(%L, 3)', :N1)) ->> 'precio_unitario')::numeric, 51900::numeric);
select public._t_igual('cotización trae gracia 3', (public._t_como_json(:O1, format('select public.adicional_cotizar(%L, 1)', :N1)) ->> 'gracia_dias')::int, 3);
select public._t_rechaza('cantidad 0', :O1, format('select public.adicional_cotizar(%L, 0)', :N1), 'CANTIDAD_INVALIDA');
select public._t_rechaza('máximo por lote (50 PROPUESTA)', :O1, format('select public.adicional_cotizar(%L, 51)', :N1), 'MAXIMO_POR_LOTE_EXCEDIDO');
select public._t_rechaza('el navegador no puede imponer otro total', :O1, format('select public.adicional_iniciar(%L, 3, 1000)', :N1), 'PRECIO_CAMBIO');

-- ═══ 5. Contratar 3 (Essential): checkout, pago, pendiente, rechazado ═══════════════════════
select public._t_igual('Essential parte con tope 1', public._t_lim(:N1), 1);
select set_config('t.r1', public._t_como_json(:O1, format('select public.adicional_iniciar(%L, 3, 155700)', :N1))::text, true);
select public._t_igual('lote en CHECKOUT_INICIADO', public._t_lestado(public._t_lote(:N1)), 'CHECKOUT_INICIADO');
select public._t_igual('pago SUSCRIPCION pendiente concepto STAFF_EXTRA por 155.700',
  (select count(*) from public.pago where negocio_id = :N1 and tipo = 'SUSCRIPCION' and estado = 'PENDIENTE' and metadata ->> 'concepto' = 'STAFF_EXTRA' and monto = 155700)::int, 1);
select public._t_igual('lote congela precio y total', (select precio_unitario::text || '/' || total::text from public.adicional_lote where id = public._t_lote(:N1)), '51900.00/155700.00');
select public._t_igual('beneficiario PLATAFORMA', (select cuenta_cobro from public.pago where negocio_id = :N1 and metadata ->> 'concepto' = 'STAFF_EXTRA'), 'PLATAFORMA');
select public._t_igual('checkout iniciado NO sube el tope', public._t_lim(:N1), 1);
select public._t_igual('reintento es idempotente (mismo lote)', (public._t_como_json(:O1, format('select public.adicional_iniciar(%L, 3, 155700)', :N1)) ->> 'reutilizado')::boolean, true);
select public._t_igual('un solo lote y un solo pago', (select count(*) from public.adicional_lote where negocio_id = :N1)::int, 1);
select public._t_igual('un cambio de pago de plan no existe: pagos pendientes = 1', (select count(*) from public.pago where negocio_id = :N1 and estado = 'PENDIENTE')::int, 1);

-- pendiente: no activa
select public._t_igual('MP informa pendiente → PAGO_PENDIENTE', public.adicional_marcar_pago_pendiente_srv(public._t_pago_de(public._t_lote(:N1)), 'MP-P1'), true);
select public._t_igual('estado PAGO_PENDIENTE', public._t_lestado(public._t_lote(:N1)), 'PAGO_PENDIENTE');
select public._t_igual('PENDIENTE no activa cupos', public._t_lim(:N1), 1);
select public._t_igual('repetir el aviso pendiente no cambia nada', public.adicional_marcar_pago_pendiente_srv(public._t_pago_de(public._t_lote(:N1)), 'MP-P1'), false);

-- rechazado: no activa; el cobro sigue reintentable
select public._t_igual('rechazo registrado', (public._t_rechazar(public._t_pago_de(public._t_lote(:N1)), 'MP-R1') ->> 'procesado')::boolean, true);
select public._t_igual('rechazado NO activa', public._t_lim(:N1), 1);
select public._t_igual('el lote sigue esperando pago', public._t_lestado(public._t_lote(:N1)), 'PAGO_PENDIENTE');
select public._t_igual('rechazo duplicado no duplica historial', (select (public._t_rechazar(public._t_pago_de(public._t_lote(:N1)), 'MP-R1') ->> 'procesado')::boolean), true);
select public._t_igual('una sola fila de rechazo', public._t_hist(public._t_lote(:N1), 'PAGO_RECHAZADO_MP'), 1);

-- inválidos: importe distinto en Mercado Pago, sin id
select public._t_igual('aprobado con importe MP distinto → revisión, no activa', (public._t_aprobar(public._t_pago_de(public._t_lote(:N1)), 'MP-X1', 100) ->> 'motivo'), 'ADICIONAL_EN_REVISION');
select public._t_igual('importe inválido no activa', public._t_lim(:N1), 1);
select public._t_igual('importe inválido NO reembolsa', (select count(*) from public.reembolso where negocio_id = :N1)::int, 0);
select public._t_igual('cola de revisión con 1 fila', (select count(*) from public.adicional_pago_revision where negocio_id = :N1 and motivo = 'IMPORTE_PASARELA_NO_COINCIDE')::int, 1);
select public._t_igual('sin id de pasarela → revisión', (public.aplicar_evento_pago(public._t_pago_de(public._t_lote(:N1)), '  ', 'APROBADO', '{"transaction_amount":155700}'::jsonb) ->> 'detalle'), 'SIN_ID_PASARELA');

-- aprobado: activa SOLO este lote
select public._t_igual('aprobado activa', (public._t_aprobar(public._t_pago_de(public._t_lote(:N1)), 'MP-OK1', 155700) ->> 'adicional'), 'ACTIVADO');
select set_config('t.l1', public._t_lote(:N1)::text, true);
select public._t_igual('lote ACTIVO', public._t_lestado(current_setting('t.l1')::uuid), 'ACTIVO');
select public._t_igual('tope = 1 incluido + 3 adicionales', public._t_lim(:N1), 4);
select public._t_igual('cupo del plan intacto (tope_plan 1)', public._t_cap(:N1, 'tope_plan'), 1);
select public._t_igual('periodo 1 registrado', (select periodo_n from public.adicional_lote where id = current_setting('t.l1')::uuid), 1);
select public._t_cierto('vencimiento = pago + 30 días', (select vigente_hasta = public.adicional_fin_periodo(inicio_periodo_at) from public.adicional_lote where id = current_setting('t.l1')::uuid));
select public._t_cierto('inicio ≈ ahora', (select inicio_periodo_at > now() - interval '1 minute' from public.adicional_lote where id = current_setting('t.l1')::uuid));
select public._t_igual('pago APROBADO con id de MP', (select estado::text || '/' || id_transaccion_pasarela from public.pago where id = (select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid)), 'APROBADO/MP-OK1');
select public._t_igual('cobro APROBADO', (select estado from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid), 'APROBADO');
select public._t_igual('el plan del negocio NO cambió', (select plan_codigo::text from public.negocio where id = :N1), 'ESSENTIAL');
select public._t_igual('la suscripción del plan NO cambió', (select plan_codigo::text || '/' || estado::text from public.suscripcion where negocio_id = :N1), 'ESSENTIAL/ACTIVA');
select public._t_cierto('confirmación en el outbox', (select count(*) from public.notificacion_outbox where evento = 'ADICIONAL_ACTIVADO' and usuario_id = :O1) >= 1);
select public._t_igual('historial: activado', public._t_hist(current_setting('t.l1')::uuid, 'ACTIVADO'), 1);

-- duplicado / fuera de orden / tardío
select public._t_igual('webhook duplicado → YA_PROCESADO', (select public.aplicar_evento_pago((select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid), 'MP-OK1', 'APROBADO', '{"transaction_amount":155700}'::jsonb) ->> 'motivo'), 'YA_PROCESADO');
select public._t_igual('duplicado no duplica periodos', (select periodo_n from public.adicional_lote where id = current_setting('t.l1')::uuid), 1);
select public._t_igual('duplicado no duplica el cupo', public._t_lim(:N1), 4);
select public._t_igual('segundo pago de MP sobre el mismo cobro → revisión duplicado',
  (select public.aplicar_evento_pago((select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid), 'MP-OK1-DUP', 'APROBADO', '{"transaction_amount":155700}'::jsonb) ->> 'detalle'), 'COBRO_DUPLICADO');
select public._t_igual('rechazo tardío sobre pago aprobado no cambia nada',
  (select public.aplicar_evento_pago((select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid), 'MP-LATE', 'RECHAZADO', '{}'::jsonb) ->> 'motivo'), 'YA_PROCESADO');
select public._t_igual('tras el desorden el lote sigue ACTIVO con 4', public._t_lestado(current_setting('t.l1')::uuid) || '/' || public._t_lim(:N1)::text, 'ACTIVO/4');
select public._t_igual('lectura de "pendiente" después de aprobado no retrocede', public.adicional_marcar_pago_pendiente_srv((select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid), 'MP-OK1'), false);

-- ═══ 6. Pago de plan vs adicional: separación por concepto ═══════════════════════════════════
select set_config('t.r2', public._t_como_json(:O2, format('select public.adicional_iniciar(%L, 2, 103800)', :N2))::text, true);
select public._t_igual('N2 (Studio): adicional pendiente creado', public._t_lestado(public._t_lote(:N2)), 'CHECKOUT_INICIADO');
select public._t_acepta('un adicional pendiente NO bloquea pagar el plan', :O2, format('select public.solicitar_pago_plan(%L, null, null)', :N2));
select public._t_igual('el pago de plan es otro pago', (select count(*) from public.pago where negocio_id = :N2 and tipo = 'SUSCRIPCION' and metadata ->> 'concepto' = 'PLAN')::int, 1);
select public._t_igual('plan pendiente + adicional pendiente coexisten', (select count(*) from public.pago where negocio_id = :N2 and estado = 'PENDIENTE')::int, 2);
-- el pago de plan aprobado sigue activando el plan (regresión)
select public._t_igual('pago de plan aprobado: procesado', (select public.aplicar_evento_pago((select id from public.pago where negocio_id = :N2 and metadata ->> 'concepto' = 'PLAN'), 'MP-PLAN1', 'APROBADO',
  jsonb_build_object('transaction_amount', (select monto from public.pago where negocio_id = :N2 and metadata ->> 'concepto' = 'PLAN'))) ->> 'procesado')::boolean, true);
select public._t_cierto('el plan se renovó (fecha_proximo_cobro > +25 días)', (select fecha_proximo_cobro > now() + interval '25 days' from public.suscripcion where negocio_id = :N2));
select public._t_igual('el plan sigue siendo STUDIO tras pagar plan', (select plan_codigo::text from public.negocio where id = :N2), 'STUDIO');
select public._t_igual('pagar plan NO activó adicionales', public._t_lestado(public._t_lote(:N2)) || '/' || public._t_lim(:N2)::text, 'CHECKOUT_INICIADO/5');
-- el pago de adicional aprobado activa solo cupos
select public._t_igual('adicional N2 aprobado', (public._t_aprobar(public._t_pago_de(public._t_lote(:N2)), 'MP-ADIC2', 103800) ->> 'adicional'), 'ACTIVADO');
select public._t_igual('N2: tope 5 + 2', public._t_lim(:N2), 7);
select public._t_igual('N2: el plan NO cambió por el adicional', (select plan_codigo::text from public.negocio where id = :N2), 'STUDIO');
select public._t_cierto('N2: la renovación del plan NO se movió por el adicional', (select fecha_proximo_cobro < now() + interval '40 days' from public.suscripcion where negocio_id = :N2));

-- pagos desconocidos / inválidos: no activan, no reembolsan
insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata) values
  ('00000000-0000-0000-00f2-00000000f001', :N1, 'SUSCRIPCION', 5000, 'PENDIENTE', 'MERCADOPAGO', '{"concepto":"OTRA_COSA"}'),
  ('00000000-0000-0000-00f2-00000000f002', :N1, 'SUSCRIPCION', 51900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'STAFF_EXTRA', 'lote_id', public._t_lote(:N2), 'periodo_n', 1)),
  ('00000000-0000-0000-00f2-00000000f003', :N1, 'SUSCRIPCION', 51900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'STAFF_EXTRA', 'lote_id', '00000000-0000-0000-00f2-0000deadbeef', 'periodo_n', 1)),
  ('00000000-0000-0000-00f2-00000000f004', :N1, 'SUSCRIPCION', 51900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'STAFF_EXTRA', 'lote_id', current_setting('t.l1'), 'periodo_n', 7)),
  ('00000000-0000-0000-00f2-00000000f005', :N1, 'SUSCRIPCION', 51900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'STAFF_EXTRA', 'periodo_n', 1));
select public._t_igual('concepto desconocido: no se aplica', (public.aplicar_evento_pago('00000000-0000-0000-00f2-00000000f001', 'MP-U1', 'APROBADO', '{}'::jsonb) ->> 'motivo'), 'CONCEPTO_DESCONOCIDO');
select public._t_igual('lote de OTRO negocio → revisión', (public._t_aprobar('00000000-0000-0000-00f2-00000000f002', 'MP-U2', 51900) ->> 'detalle'), 'LOTE_DE_OTRO_NEGOCIO');
select public._t_igual('lote inexistente → revisión', (public._t_aprobar('00000000-0000-0000-00f2-00000000f003', 'MP-U3', 51900) ->> 'detalle'), 'LOTE_NO_ENCONTRADO');
select public._t_igual('lote real pero sin cobro correspondiente → revisión', (public._t_aprobar('00000000-0000-0000-00f2-00000000f004', 'MP-U4', 51900) ->> 'detalle'), 'COBRO_NO_CORRESPONDE');
select public._t_igual('sin lote indicado → revisión', (public._t_aprobar('00000000-0000-0000-00f2-00000000f005', 'MP-U5', 51900) ->> 'detalle'), 'LOTE_NO_INDICADO');
select public._t_igual('ninguno de esos activó ni cambió cupos', public._t_lim(:N1) || '/' || public._t_lim(:N2), '4/7');
select public._t_igual('ninguno quedó APROBADO', (select count(*) from public.pago where id::text like '00000000-0000-0000-00f2-00000000f00%' and estado <> 'PENDIENTE')::int, 0);
select public._t_igual('ninguno generó reembolso automático', (select count(*) from public.reembolso where pago_id::text like '00000000-0000-0000-00f2-00000000f00%')::int, 0);
select public._t_igual('4 pagos en cola de revisión', (select count(*) from public.adicional_pago_revision where pago_id::text like '00000000-0000-0000-00f2-00000000f00%')::int, 4);
select public._t_igual('revisión repetida no duplica', (public._t_aprobar('00000000-0000-0000-00f2-00000000f002', 'MP-U2', 51900) ->> 'detalle') || (select count(*)::text from public.adicional_pago_revision where pago_id = '00000000-0000-0000-00f2-00000000f002'), 'LOTE_DE_OTRO_NEGOCIO1');

-- tardío sobre un cobro cerrado: lote cancelado y luego aprueba
select set_config('t.r3', public._t_como_json(:OX, format('select public.adicional_iniciar(%L, 1, 51900)', :N1))::text, true);   -- OX no es dueño de N1
select public._t_cierto('IDOR: OX no pudo iniciar en N1', current_setting('t.r3')::jsonb ? 'error');
select set_config('t.r3', public._t_como_json(:OX, format('select public.adicional_iniciar(%L, 1, 51900)', :NX))::text, true);
select public._t_igual('NX inicia 1 adicional', public._t_lestado(public._t_lote(:NX)), 'CHECKOUT_INICIADO');
select set_config('t.px', public._t_pago_de(public._t_lote(:NX))::text, true);
select public._t_acepta('un adicional pendiente NO bloquea el upgrade del plan', :OX, format('select public.solicitar_upgrade_plan(%L, ''STUDIO'')', :NX));
select public._t_igual('upgrade y adicional pendientes coexisten', (select count(*) from public.pago where negocio_id = :NX and estado = 'PENDIENTE')::int, 2);
select public._t_acepta('NX cancela el checkout', :OX, format('select public.adicional_cancelar_renovacion(%L)', public._t_lote(:NX)));
select public._t_igual('lote cancelado', public._t_lestado(public._t_lote(:NX)), 'CANCELADO');
select public._t_igual('pago tardío sobre cobro cerrado → revisión', (public._t_aprobar(current_setting('t.px')::uuid, 'MP-LATE2', 51900) ->> 'detalle'), 'PAGO_TARDIO_SOBRE_COBRO_CERRADO');
select public._t_igual('NX sigue sin cupos', public._t_lim(:NX), 1);

-- ═══ 7. Vencimiento, avisos 7/3/1, gracia 3 días, suspensión ═══════════════════════════════════
update public.adicional_lote set vigente_hasta = now() + interval '8 days' where id = current_setting('t.l1')::uuid;
select public._t_igual('8 días: aún sin aviso', (public._t_mant() ->> 'avisos')::int, 0);
update public.adicional_lote set vigente_hasta = now() + interval '7 days' where id = current_setting('t.l1')::uuid;
select public._t_igual('a 7 días: aviso y PROXIMO_A_RENOVAR', (public._t_mant() ->> 'avisos')::int || '/' || public._t_lestado(current_setting('t.l1')::uuid), '1/PROXIMO_A_RENOVAR');
select public._t_igual('mismo día otra corrida: no repite aviso (forzada)', (public._t_mant() ->> 'avisos')::int, 0);
select public._t_igual('corrida del mismo día sin forzar: omitida', (public.adicional_mantenimiento_srv(now(), false) ->> 'omitido')::boolean, true);
update public.adicional_lote set vigente_hasta = now() + interval '3 days' where id = current_setting('t.l1')::uuid;
select public._t_igual('a 3 días: aviso', (public._t_mant() ->> 'avisos')::int, 1);
update public.adicional_lote set vigente_hasta = now() + interval '1 day' where id = current_setting('t.l1')::uuid;
select public._t_igual('a 1 día: aviso', (public._t_mant() ->> 'avisos')::int, 1);
select public._t_igual('exactamente 3 avisos en el historial', public._t_hist(current_setting('t.l1')::uuid, 'AVISO_VENCIMIENTO'), 3);
select public._t_igual('avisos en el outbox (3 avisos × canales EMAIL y PANEL)', (select count(*) from public.notificacion_outbox where evento = 'ADICIONAL_POR_VENCER' and usuario_id = :O1)::int, 6);
select public._t_igual('último umbral = 1', (select ultimo_aviso_dias from public.adicional_lote where id = current_setting('t.l1')::uuid), 1);
select public._t_igual('el cupo sigue vigente hasta vencer', public._t_lim(:N1), 4);
-- gracia: venció hace 1 hora
update public.adicional_lote set vigente_hasta = now() - interval '1 hour' where id = current_setting('t.l1')::uuid;
select public._t_igual('vencido → EN_GRACIA', (public._t_mant() ->> 'en_gracia')::int || '/' || public._t_lestado(current_setting('t.l1')::uuid), '1/EN_GRACIA');
select public._t_cierto('gracia_fin = vencimiento + 3 días', (select gracia_fin = vigente_hasta + interval '3 days' from public.adicional_lote where id = current_setting('t.l1')::uuid));
select public._t_igual('en gracia el cupo sigue vigente', public._t_lim(:N1), 4);
-- 2 días 23 h después del vencimiento: todavía NO se suspende
update public.adicional_lote set vigente_hasta = now() - interval '2 days 23 hours', gracia_fin = now() + interval '1 hour' where id = current_setting('t.l1')::uuid;
select public._t_igual('antes de terminar los 3 días NO suspende', (public._t_mant() ->> 'suspendidos')::int || '/' || public._t_lestado(current_setting('t.l1')::uuid), '0/EN_GRACIA');
select public._t_igual('el cupo sigue durante la gracia', public._t_lim(:N1), 4);
-- Profesionales operativos: 3 (cupo completo con adicionales)
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso, es_admin, presta_servicios)
select ('00000000-0000-0000-00f2-0000000000' || k)::uuid, :N1, '00000000-0000-0000-00f2-000000000201', 'ACTIVO', now(), false, true from (values ('b1'), ('b2'), ('b3')) x(k);
select public._t_igual('3 profesionales ocupan 3 de 4', public._t_cap(:N1, 'ocupados'), 3);
-- termina la gracia
update public.adicional_lote set gracia_fin = now() - interval '1 minute' where id = current_setting('t.l1')::uuid;
select public._t_igual('terminada la gracia → SUSPENDIDO', (public._t_mant() ->> 'suspendidos')::int || '/' || public._t_lestado(current_setting('t.l1')::uuid), '1/SUSPENDIDO');
select public._t_igual('suspendido: el cupo vuelve a 1', public._t_lim(:N1), 1);
select public._t_igual('EXCESO: nadie se retira (3 siguen ACTIVOS)', (select count(*) from public.vinculo_staff_negocio where negocio_id = :N1 and estado = 'ACTIVO' and presta_servicios)::int, 3);
select public._t_igual('exceso = 2, a regularizar 2, disponibles 0', public._t_cap(:N1, 'exceso') || '/' || public._t_cap(:N1, 'a_regularizar') || '/' || public._t_cap(:N1, 'disponibles'), '2/2/0');
select public._t_igual('adicionales suspendidos informados', public._t_cap(:N1, 'adicionales_suspendidos'), 3);
select public._t_rechaza('exceso: NO se puede invitar a otro barbero', :O1, format('select public.crear_invitacion_staff(%L, ''nuevo@test.local'', %L, null, ''BARBER'')', :N1, '00000000-0000-0000-00f2-000000000201'::text), 'PLAN_LIMIT_EXCEEDED');
select public._t_igual('suspender el adicional NO suspende el plan principal', (select estado::text from public.suscripcion where negocio_id = :N1), 'ACTIVA');
select public._t_igual('no se borró nada: vínculos y lote intactos', (select count(*) from public.vinculo_staff_negocio where negocio_id = :N1)::int, 4);
select public._t_igual('historial: gracia terminada', public._t_hist(current_setting('t.l1')::uuid, 'GRACIA_TERMINADA'), 1);
select public._t_cierto('aviso de suspensión en outbox', (select count(*) from public.notificacion_outbox where evento = 'ADICIONAL_SUSPENDIDO' and usuario_id = :O1) >= 1);
select public._t_cierto('aviso de gracia en outbox', (select count(*) from public.notificacion_outbox where evento = 'ADICIONAL_EN_GRACIA' and usuario_id = :O1) >= 1);
-- Sin expiración a los 60 días: se corre el cron 90 días después y se revierte (subtransacción) para no alterar los demás lotes.
do $$
begin
  perform public._t_mant(now() + interval '90 days');
  raise exception 'ESTADO90:%', public._t_lestado(current_setting('t.l1')::uuid);
exception when others then
  if sqlerrm <> 'ESTADO90:SUSPENDIDO' then raise exception 'FALLA sigue SUSPENDIDO tras 90 días: %', sqlerrm; end if;
end $$;

-- ═══ 8. Reactivación pagando; administrador no renueva; precio congelado ══════════════════════════
select public._t_rechaza('admin NO renueva', :ADM, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: OX NO renueva el lote de N1', :OX, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid), 'NO_AUTORIZADO');
-- SuperAdmin cambia el precio del plan ESSENTIAL: los lotes vigentes NO cambian
select public._t_rechaza('propietario NO cambia precios', :O1, 'select public.admin_adicional_precio_guardar(''CO'', ''ESSENTIAL'', 60000, ''intento'')', 'NO_AUTORIZADO');
select public._t_rechaza('admin NO cambia precios', :ADM, 'select public.admin_adicional_precio_guardar(''CO'', ''ESSENTIAL'', 60000, ''intento'')', 'NO_AUTORIZADO');
select public._t_rechaza('precio sin motivo', :SU, 'select public.admin_adicional_precio_guardar(''CO'', ''ESSENTIAL'', 60000, '''')', 'MOTIVO_REQUERIDO');
select public._t_acepta('SuperAdmin cambia el precio ESSENTIAL con motivo', :SU, 'select public.admin_adicional_precio_guardar(''CO'', ''ESSENTIAL'', 60000, ''ajuste comercial de prueba'')');
select public._t_igual('el lote vigente conserva 51.900', (select precio_unitario from public.adicional_lote where id = current_setting('t.l1')::uuid), 51900::numeric);
select public._t_igual('una cotización nueva usa 60.000', (public._t_como_json(:O1, format('select public.adicional_cotizar(%L, 1)', :N1)) ->> 'precio_unitario')::numeric, 60000::numeric);
select public._t_igual('el precio por plan es independiente (STUDIO sigue 51.900)', (public._t_como_json(:O2, format('select public.adicional_cotizar(%L, 1)', :N2)) ->> 'precio_unitario')::numeric, 51900::numeric);
select public._t_cierto('auditoría del cambio de precio con motivo', exists (select 1 from public.evento_auditoria where accion = 'ADICIONAL_PRECIO_CAMBIADO' and motivo = 'ajuste comercial de prueba'));
select set_config('t.r4', public._t_como_json(:O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid))::text, true);
select public._t_igual('renovar SUSPENDIDO: pago por el total congelado 155.700', (current_setting('t.r4')::jsonb ->> 'monto')::numeric, 155700::numeric);
select public._t_igual('la renovación sigue sin activar', public._t_lim(:N1), 1);
select public._t_igual('renovar es idempotente', (public._t_como_json(:O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid)) ->> 'reutilizado')::boolean, true);
select public._t_igual('reactivación por pago confirmado', (public._t_aprobar((current_setting('t.r4')::jsonb ->> 'pago_id')::uuid, 'MP-REN1', 155700) ->> 'adicional'), 'ACTIVADO');
select public._t_igual('lote ACTIVO periodo 2', public._t_lestado(current_setting('t.l1')::uuid) || '/' || (select periodo_n from public.adicional_lote where id = current_setting('t.l1')::uuid), 'ACTIVO/2');
select public._t_igual('el cupo vuelve a 4', public._t_lim(:N1), 4);
select public._t_igual('exceso se corrige solo al reactivar', public._t_cap(:N1, 'exceso'), 0);
select public._t_igual('historial: REACTIVADO', public._t_hist(current_setting('t.l1')::uuid, 'REACTIVADO'), 1);
select public._t_cierto('nuevo vencimiento ≈ ahora + 30 días', (select vigente_hasta between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' from public.adicional_lote where id = current_setting('t.l1')::uuid));
select public._t_rechaza('renovar muy pronto: AUN_NO_TOCA_RENOVAR', :O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid), 'AUN_NO_TOCA_RENOVAR');
-- renovación anticipada dentro de la ventana: no se pierden días
update public.adicional_lote set vigente_hasta = now() + interval '5 days', estado = estado where id = current_setting('t.l1')::uuid;
select set_config('t.vant', (select vigente_hasta::text from public.adicional_lote where id = current_setting('t.l1')::uuid), true);
select set_config('t.r5', public._t_como_json(:O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid))::text, true);
select public._t_igual('renovación anticipada aplicada', (public._t_aprobar((current_setting('t.r5')::jsonb ->> 'pago_id')::uuid, 'MP-REN2', 155700) ->> 'procesado')::boolean, true);
select public._t_cierto('no se pierden días: nuevo vencimiento = anterior + 30 días', (select vigente_hasta = public.adicional_fin_periodo(current_setting('t.vant')::timestamptz) from public.adicional_lote where id = current_setting('t.l1')::uuid));
select public._t_igual('periodo 3', (select periodo_n from public.adicional_lote where id = current_setting('t.l1')::uuid), 3);

-- ═══ 9. Cancelación de la renovación futura ═══════════════════════════════════════════════════
select public._t_rechaza('admin NO cancela', :ADM, format('select public.adicional_cancelar_renovacion(%L)', current_setting('t.l1')::uuid), 'NO_AUTORIZADO');
select public._t_rechaza('IDOR: OX NO cancela el lote de N1', :OX, format('select public.adicional_cancelar_renovacion(%L)', current_setting('t.l1')::uuid), 'NO_AUTORIZADO');
update public.adicional_lote set vigente_hasta = now() + interval '4 days' where id = current_setting('t.l1')::uuid;
select set_config('t.r6', public._t_como_json(:O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid))::text, true);   -- renovación abierta
select public._t_acepta('propietario cancela la renovación futura', :O1, format('select public.adicional_cancelar_renovacion(%L, ''ya no los necesito'')', current_setting('t.l1')::uuid));
select public._t_igual('lote CANCELADO', public._t_lestado(current_setting('t.l1')::uuid), 'CANCELADO');
select public._t_igual('el periodo ya pagado NO se pierde: cupo 4 hasta vigente_hasta', public._t_lim(:N1), 4);
select public._t_igual('la renovación abierta se cerró (sin cobro vivo)', (select count(*) from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and estado = 'PENDIENTE')::int, 0);
select public._t_igual('el pago abierto de renovación ya no está pendiente', (select estado::text from public.pago where id = (current_setting('t.r6')::jsonb ->> 'pago_id')::uuid), 'RECHAZADO');
select public._t_rechaza('cancelado NO se renueva', :O1, format('select public.adicional_renovar(%L)', current_setting('t.l1')::uuid), 'LOTE_NO_RENOVABLE');
select public._t_igual('cancelar de nuevo es idempotente', (public._t_como_json(:O1, format('select public.adicional_cancelar_renovacion(%L)', current_setting('t.l1')::uuid)) ->> 'ya_cancelado')::boolean, true);
select public._t_igual('no hay reembolso automático por cancelar', (select count(*) from public.reembolso where negocio_id = :N1)::int + (select count(*) from public.adicional_reembolso where negocio_id = :N1)::int, 0);
select public._t_igual('pago tardío tras cancelar → revisión', (public._t_aprobar((current_setting('t.r6')::jsonb ->> 'pago_id')::uuid, 'MP-LATE3', 155700) ->> 'detalle'), 'PAGO_TARDIO_SOBRE_COBRO_CERRADO');
update public.adicional_lote set vigente_hasta = now() - interval '1 hour' where id = current_setting('t.l1')::uuid;
select public._t_igual('cancelado y vencido: cupo 0', public._t_lim(:N1), 1);
select public._t_igual('el cron NO revive ni suspende un cancelado', (public._t_mant() ->> 'en_gracia')::int + (public._t_mant(now() + interval '1 day') ->> 'suspendidos')::int, 0);

-- ═══ 10. Signature con adicionales ═════════════════════════════════════════════════════════════
select public._t_igual('Signature parte con 50', public._t_lim(:NG), 50);
select public._t_igual('Signature cotiza 3', (public._t_como_json(:OG, format('select public.adicional_cotizar(%L, 3)', :NG)) ->> 'total')::numeric, 155700::numeric);
select set_config('t.r7', public._t_como_json(:OG, format('select public.adicional_iniciar(%L, 3, 155700)', :NG))::text, true);
select public._t_igual('Signature aprobado', (public._t_aprobar(public._t_pago_de(public._t_lote(:NG)), 'MP-SIG1', 155700) ->> 'adicional'), 'ACTIVADO');
select public._t_igual('Signature: 50 + 3 = 53', public._t_lim(:NG), 53);

-- ═══ 11. Cambio de plan con lote vigente ═══════════════════════════════════════════════════════
-- N2 (Studio, 2 adicionales) pasa a Prestige: el tope sigue = tope del plan + adicionales
update public.negocio set plan_codigo = 'PRESTIGE' where id = :N2;
select public._t_igual('Prestige 15 + 2 adicionales', public._t_lim(:N2), 17);
select public._t_igual('el lote conserva su precio y su plan de contratación', (select precio_unitario::text || '/' || plan_codigo::text from public.adicional_lote where id = public._t_lote(:N2)), '51900.00/STUDIO');
select public._t_igual('simular el plan destino suma los adicionales vigentes', (public._capacidad_profesional(:N2, 'ESSENTIAL') ->> 'limite')::int, 3);

-- ═══ 12. Plan principal bloqueado con adicional pagado ═══════════════════════════════════════════
update public.suscripcion set estado = 'REQUIERE_PLAN' where negocio_id = :N2;
select public._t_rechaza('principal bloqueado: no se contrata más', :O2, format('select public.adicional_cotizar(%L, 1)', :N2), 'SUSCRIPCION_NO_VIGENTE');
select public._t_igual('el adicional pagado sigue en el tope (las restricciones generales las impone el plan)', public._t_lim(:N2), 17);
select public._t_igual('el estado del adicional no depende del plan', public._t_lestado(public._t_lote(:N2)), 'ACTIVO');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = :N2;

-- ═══ 13. SuperAdmin: configuración, excepciones con motivo, acciones ═══════════════════════════════
select public._t_rechaza('propietario NO lee la configuración', :O1, 'select public.admin_adicional_config_obtener()', 'NO_AUTORIZADO');
select public._t_rechaza('admin NO lee la configuración', :ADM, 'select public.admin_adicional_config_obtener()', 'NO_AUTORIZADO');
select public._t_cierto('SuperAdmin lee la configuración', (public._t_como_json(:SU, 'select public.admin_adicional_config_obtener()') -> 'precios') is not null);
select public._t_rechaza('config sin motivo', :SU, 'select public.admin_adicional_config_guardar(''{"gracia_dias":5}''::jsonb, ''x'')', 'MOTIVO_REQUERIDO');
select public._t_rechaza('config incoherente', :SU, 'select public.admin_adicional_config_guardar(''{"max_por_lote":60}''::jsonb, ''motivo válido'')', 'CONFIG_INVALIDA');
select public._t_rechaza('config fuera de rango', :SU, 'select public.admin_adicional_config_guardar(''{"gracia_dias":999}''::jsonb, ''motivo válido'')', 'adicional_config');
select public._t_acepta('config válida', :SU, 'select public.admin_adicional_config_guardar(''{"gracia_dias":4,"avisos_dias_antes":[10,5,2],"max_por_lote":40}''::jsonb, ''prueba de configuración'')');
select public._t_igual('config aplicada', (select gracia_dias::text || '/' || avisos_dias_antes::text || '/' || max_por_lote::text from public.adicional_config), '4/{10,5,2}/40');
select public._t_rechaza('el máximo por lote configurado se respeta', :O1, format('select public.adicional_cotizar(%L, 41)', :N1), 'MAXIMO_POR_LOTE_EXCEDIDO');
select public._t_cierto('auditoría de config con motivo y valores', exists (select 1 from public.evento_auditoria where accion = 'ADICIONAL_CONFIG_CAMBIADA' and motivo = 'prueba de configuración' and payload_despues ->> 'gracia_dias' = '4' and payload_antes ->> 'gracia_dias' = '3'));
select public._t_acepta('restablece config', :SU, 'select public.admin_adicional_config_guardar(''{"gracia_dias":3,"avisos_dias_antes":[7,3,1],"max_por_lote":50}''::jsonb, ''restablecer prueba'')');
select public._t_acepta('máximo por establecimiento configurable', :SU, 'select public.admin_adicional_config_guardar(''{"max_por_negocio":6,"max_por_lote":6}''::jsonb, ''prueba límite'')');
-- N2 ya tiene 2 adicionales: 2 + 4 = 6 cabe; 2 + 5 = 7 no.
select public._t_acepta('límite por establecimiento: 2 + 4 = 6 cabe', :O2, format('select public.adicional_cotizar(%L, 4)', :N2));
select public._t_rechaza('límite por establecimiento: 2 + 5 > 6', :O2, format('select public.adicional_cotizar(%L, 5)', :N2), 'MAXIMO_POR_NEGOCIO_EXCEDIDO');
select public._t_acepta('SuperAdmin restablece 50', :SU, 'select public.admin_adicional_config_guardar(''{"max_por_negocio":50,"max_por_lote":50}''::jsonb, ''restablecer prueba'')');
-- Activación manual
select public._t_rechaza('propietario NO activa manualmente', :O1, format('select public.admin_adicional_activar_manual(%L, 2, 30, ''CORTESIA'', ''motivo válido'')', :NX), 'NO_AUTORIZADO');
select public._t_rechaza('admin NO activa manualmente', :ADM, format('select public.admin_adicional_activar_manual(%L, 2, 30, ''CORTESIA'', ''motivo válido'')', :N1), 'NO_AUTORIZADO');
select public._t_rechaza('activación sin motivo', :SU, format('select public.admin_adicional_activar_manual(%L, 2, 30, ''CORTESIA'', '' '')', :NX), 'MOTIVO_REQUERIDO');
select public._t_rechaza('vigencia obligatoria y acotada', :SU, format('select public.admin_adicional_activar_manual(%L, 2, 400, ''CORTESIA'', ''motivo válido'')', :NX), 'VIGENCIA_INVALIDA');
select public._t_rechaza('transferencia exige referencia', :SU, format('select public.admin_adicional_activar_manual(%L, 2, 30, ''TRANSFERENCIA'', ''motivo válido'')', :NX), 'REFERENCIA_REQUERIDA');
select set_config('t.r8', public._t_como_json(:SU, format('select public.admin_adicional_activar_manual(%L, 2, 30, ''CORTESIA'', ''excepción de prueba'', null)', :NX))::text, true);
select public._t_igual('excepción activa 2 cupos en NX', public._t_lim(:NX), 3);
select public._t_igual('lote manual: responsable y motivo', (select (manual_por = :SU::uuid)::text || '/' || manual_motivo || '/' || origen from public.adicional_lote where id = (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid), 'true/excepción de prueba/MANUAL_SUPERADMIN');
select public._t_cierto('auditoría de la excepción con motivo', exists (select 1 from public.evento_auditoria where accion = 'ADICIONAL_ACTIVACION_MANUAL' and motivo = 'excepción de prueba'));
select public._t_igual('historial de la excepción', public._t_hist((current_setting('t.r8')::jsonb ->> 'lote_id')::uuid, 'ACTIVACION_MANUAL'), 1);
-- acciones con motivo
select public._t_rechaza('acción sin motivo', :SU, format('select public.admin_adicional_accion(%L, ''SUSPENDER'', '''', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid), 'MOTIVO_REQUERIDO');
select public._t_rechaza('propietario NO usa acciones de SuperAdmin', :O1, format('select public.admin_adicional_accion(%L, ''SUSPENDER'', ''motivo válido'', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid), 'NO_AUTORIZADO');
select public._t_acepta('SuperAdmin suspende', :SU, format('select public.admin_adicional_accion(%L, ''SUSPENDER'', ''revisión de prueba'', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid));
select public._t_igual('suspendido por SuperAdmin: NX vuelve a 1', public._t_lim(:NX), 1);
select public._t_rechaza('reactivar exige vigencia', :SU, format('select public.admin_adicional_accion(%L, ''REACTIVAR'', ''motivo válido'', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid), 'VIGENCIA_INVALIDA');
select public._t_acepta('SuperAdmin reactiva con vigencia', :SU, format('select public.admin_adicional_accion(%L, ''REACTIVAR'', ''reactivación de prueba'', ''{"dias":10}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid));
select public._t_igual('reactivado: NX en 3', public._t_lim(:NX), 3);
select public._t_acepta('SuperAdmin ajusta cantidad', :SU, format('select public.admin_adicional_accion(%L, ''AJUSTAR'', ''ajuste de prueba'', ''{"cantidad":4}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid));
select public._t_igual('ajuste aplicado', public._t_lim(:NX), 5);
select public._t_igual('historial del ajuste con cantidades', (select cantidad_antes::text || '>' || cantidad_despues::text from public.adicional_historial where lote_id = (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid and evento = 'AJUSTE_CANTIDAD'), '2>4');
select public._t_acepta('SuperAdmin cancela', :SU, format('select public.admin_adicional_accion(%L, ''CANCELAR'', ''cierre de prueba'', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid));
select public._t_rechaza('acción inválida', :SU, format('select public.admin_adicional_accion(%L, ''BORRAR'', ''motivo válido'', ''{}'')', (current_setting('t.r8')::jsonb ->> 'lote_id')::uuid), 'ACCION_INVALIDA');
-- la activación manual vence sola
select set_config('t.r9', public._t_como_json(:SU, format('select public.admin_adicional_activar_manual(%L, 1, 5, ''CORTESIA'', ''excepción corta'', null)', :NX))::text, true);
update public.adicional_lote set vigente_hasta = now() - interval '1 minute' where id = (current_setting('t.r9')::jsonb ->> 'lote_id')::uuid;
select public._t_igual('excepción vencida → cancelada por el cron', (public._t_mant() ->> 'manuales_vencidos')::int || '/' || public._t_lestado((current_setting('t.r9')::jsonb ->> 'lote_id')::uuid), '1/CANCELADO');
-- consulta del CRM
select public._t_cierto('CRM lista lotes por negocio', (public._t_como_json(:SU, format('select public.admin_adicional_listar(jsonb_build_object(''negocio_id'', %L))', :N1)) ->> 'total')::int >= 1);
select public._t_cierto('CRM filtra por estado', (public._t_como_json(:SU, 'select public.admin_adicional_listar(''{"estado":"CANCELADO"}''::jsonb)') ->> 'total')::int >= 1);
select public._t_cierto('CRM detalle con historial y cobros', jsonb_array_length(public._t_como_json(:SU, format('select public.admin_adicional_detalle(%L)', current_setting('t.l1')::uuid)) -> 'historial') >= 5);
select public._t_rechaza('propietario NO usa el CRM', :O1, 'select public.admin_adicional_listar(''{}''::jsonb)', 'NO_AUTORIZADO');

-- ═══ 14. Reembolsos y revisión (solo registro, auditado) ═══════════════════════════════════════════
select public._t_rechaza('propietario NO solicita reembolsos en el CRM', :O1, format('select public.admin_adicional_reembolso_solicitar(%L, ''COBRO_DUPLICADO'', ''x'', ''motivo válido'')', (select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and periodo_n = 1)), 'NO_AUTORIZADO');
select set_config('t.rf', public._t_como_json(:SU, format('select public.admin_adicional_reembolso_solicitar(%L, ''COBRO_DUPLICADO'', ''cobro doble de prueba'', ''revisión individual'')', (select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and periodo_n = 1)))::text, true);
select public._t_igual('reembolso SOLICITADO', current_setting('t.rf')::jsonb ->> 'estado', 'SOLICITADO');
select public._t_rechaza('no se abre un segundo reembolso del mismo pago', :SU, format('select public.admin_adicional_reembolso_solicitar(%L, ''COBRO_DUPLICADO'', ''x'', ''motivo válido'')', (select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and periodo_n = 1)), 'REEMBOLSO_YA_ABIERTO');
select public._t_rechaza('causa inválida', :SU, format('select public.admin_adicional_reembolso_solicitar(%L, ''ME_ARREPENTI'', ''x'', ''motivo válido'')', (select pago_id from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and periodo_n = 2)), 'CAUSA_INVALIDA');
select public._t_rechaza('no se puede saltar de SOLICITADO a EJECUTADO', :SU, format('select public.admin_adicional_reembolso_decidir(%L, ''EJECUTADO_MANUAL'', ''motivo válido'', ''REF-1'')', current_setting('t.rf')::jsonb ->> 'id'), 'TRANSICION_REEMBOLSO_NO_PERMITIDA');
select public._t_acepta('aprobar con motivo', :SU, format('select public.admin_adicional_reembolso_decidir(%L, ''APROBADO'', ''duplicado confirmado'')', current_setting('t.rf')::jsonb ->> 'id'));
select public._t_rechaza('ejecutar exige referencia de Mercado Pago', :SU, format('select public.admin_adicional_reembolso_decidir(%L, ''EJECUTADO_MANUAL'', ''motivo válido'')', current_setting('t.rf')::jsonb ->> 'id'), 'REFERENCIA_REQUERIDA');
select public._t_acepta('registrar ejecución manual', :SU, format('select public.admin_adicional_reembolso_decidir(%L, ''EJECUTADO_MANUAL'', ''devuelto en el panel de Mercado Pago'', ''MP-REF-123'')', current_setting('t.rf')::jsonb ->> 'id'));
select public._t_igual('el cobro queda REEMBOLSADO', (select estado from public.adicional_cobro where lote_id = current_setting('t.l1')::uuid and periodo_n = 1), 'REEMBOLSADO');
select public._t_cierto('auditoría completa del reembolso', (select count(*) from public.evento_auditoria where accion like 'ADICIONAL\_REEMBOLSO\_%' and entidad_id = (current_setting('t.rf')::jsonb ->> 'id')::uuid) >= 3);
select public._t_igual('NO se creó ningún reembolso automático (tabla reserva)', (select count(*) from public.reembolso where negocio_id in (:N1, :N2, :NG, :NX))::int, 0);
select public._t_cierto('cola de revisión visible para SuperAdmin', jsonb_array_length(public._t_como_json(:SU, 'select public.admin_adicional_revision_listar(''PENDIENTE'')')) >= 5);
select public._t_acepta('resolver una revisión con motivo', :SU, format('select public.admin_adicional_revision_resolver(%L, ''verificado, sin acción'', ''revisión humana'')', (select id from public.adicional_pago_revision where motivo = 'LOTE_NO_INDICADO' limit 1)));
select public._t_rechaza('no se resuelve dos veces', :SU, format('select public.admin_adicional_revision_resolver(%L, ''x'', ''motivo válido'')', (select id from public.adicional_pago_revision where motivo = 'LOTE_NO_INDICADO' limit 1)), 'REVISION_NO_ENCONTRADA_O_RESUELTA');

-- ═══ 15. Checkouts abandonados ═════════════════════════════════════════════════════════════════
select set_config('t.r10', public._t_como_json(:O1, format('select public.adicional_iniciar(%L, 1, 60000)', :N1))::text, true);
select public._t_igual('nuevo checkout al precio nuevo', (select total from public.adicional_lote where id = public._t_lote(:N1)), 60000::numeric);
update public.adicional_lote set created_at = now() - interval '2 days' where id = (current_setting('t.r10')::jsonb ->> 'lote_id')::uuid;
select public._t_igual('checkout de >24 h → EXPIRADO_SIN_PAGO', (public._t_mant() ->> 'checkouts_abandonados')::int || '/' || public._t_lestado((current_setting('t.r10')::jsonb ->> 'lote_id')::uuid), '1/EXPIRADO_SIN_PAGO');
select public._t_igual('el pago abandonado se cierra', (select estado::text from public.pago where id = (current_setting('t.r10')::jsonb ->> 'pago_id')::uuid), 'RECHAZADO');

-- ═══ 16. Máquina de estados: nada cambia fuera de las transiciones ═══════════════════════════════════
select public._t_rechaza_pg('estado directo prohibido', format('update public.adicional_lote set estado = ''ACTIVO'' where id = %L', current_setting('t.l1')), 'ADICIONAL_ESTADO_SOLO_POR_TRANSICION');
select public._t_rechaza_pg('precio congelado inmutable', format('update public.adicional_lote set precio_unitario = 1 where id = %L', current_setting('t.l1')), 'ADICIONAL_LOTE_CAMPO_INMUTABLE');
select public._t_rechaza_pg('cantidad inmutable fuera del ajuste', format('update public.adicional_lote set cantidad = 99, total = 99 * precio_unitario where id = %L', current_setting('t.l1')), 'ADICIONAL_LOTE_CAMPO_INMUTABLE');
select public._t_cierto('el lote no se borra desde la API', public._t_como_err(:O1, format('delete from public.adicional_lote where id = %L', current_setting('t.l1'))) <> 'SIN_ERROR');
select public._t_rechaza_pg('transición no permitida (CANCELADO → ACTIVO)', format('select public._adicional_transicionar(%L, ''ACTIVO'', ''X'', ''SUPERSU'')', current_setting('t.l1')), 'ADICIONAL_TRANSICION_NO_PERMITIDA');
select public._t_rechaza_pg('actor no permitido (propietario no puede suspender)', format('select public._adicional_transicionar(%L, ''SUSPENDIDO'', ''X'', ''PROPIETARIO'')', public._t_lote(:N2)), 'ADICIONAL_TRANSICION_NO_PERMITIDA');
select public._t_rechaza_pg('total coherente', format('insert into public.adicional_lote (negocio_id, pais_codigo, plan_codigo, cantidad, precio_unitario, total) values (%L, ''CO'', ''ESSENTIAL'', 2, 51900, 5)', :N1), 'adicional_lote_total_coherente');
select public._t_cierto('el historial es inmutable para los roles de la API', public._t_como_err(:O1, format('update public.adicional_historial set evento = ''X'' where lote_id = %L', current_setting('t.l1'))) <> 'SIN_ERROR');
select public._t_cierto('el propietario no escribe lotes', public._t_como_err(:O1, format('update public.adicional_lote set cancelar_renovacion = false where id = %L', current_setting('t.l1'))) <> 'SIN_ERROR');
select public._t_cierto('el propietario no inserta lotes', public._t_como_err(:O1, format('insert into public.adicional_lote (negocio_id, pais_codigo, plan_codigo, cantidad, precio_unitario, total) values (%L, ''CO'', ''ESSENTIAL'', 1, 1, 1)', :N1)) <> 'SIN_ERROR');

-- ═══ 17. RLS de lectura ═════════════════════════════════════════════════════════════════════════════
create function public._t_ve(uid text, q text) returns int language plpgsql as $f$
declare r int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated; execute q into r; reset role;
  perform set_config('request.jwt.claims', '', true); return r;
end $f$;
select public._t_cierto('propietario ve sus lotes', public._t_ve(:O1, format('select count(*)::int from public.adicional_lote where negocio_id = %L', :N1)) >= 1);
select public._t_igual('IDOR: OX no ve lotes de N1', public._t_ve(:OX, format('select count(*)::int from public.adicional_lote where negocio_id = %L', :N1)), 0);
select public._t_igual('admin delegado no ve lotes ni cobros', public._t_ve(:ADM, 'select count(*)::int from public.adicional_lote') + public._t_ve(:ADM, 'select count(*)::int from public.adicional_cobro'), 0);
select public._t_igual('propietario no ve la cola de revisión ni reembolsos', public._t_ve(:O1, 'select count(*)::int from public.adicional_pago_revision') + public._t_ve(:O1, 'select count(*)::int from public.adicional_reembolso'), 0);
select public._t_igual('propietario no lee la configuración directa', public._t_como_err(:O1, 'select * from public.adicional_config'), 'permission denied for table adicional_config');
select public._t_cierto('SuperAdmin ve todo', public._t_ve(:SU, 'select count(*)::int from public.adicional_lote') >= 4);
select public._t_cierto('la capacidad es visible al administrador delegado (cupo_plan_negocio)', (public._t_como_json(:ADM, format('select public.cupo_plan_negocio(%L)', :N1)) -> 'capacidad') is not null);

rollback;
select 'ADICIONALES 170-178: TODAS LAS PRUEBAS PASARON' as resultado;
