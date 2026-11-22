-- Independencia entre barberos adicionales (170-178) y el estado operativo del plan principal (160-164), más reglas aprobadas.
-- Solo base LOCAL, transacción con ROLLBACK:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/adicionales_restringida_180.sql
-- Regla aprobada: UN ADICIONAL PAGADO NO REACTIVA NI DESBLOQUEA UNA SUSCRIPCIÓN PRINCIPAL BLOQUEADA; al pagar el plan, se restaura.
begin;

create function public._t_err(q text) returns text language plpgsql as $f$
begin execute q; return 'SIN_ERROR'; exception when others then return coalesce(nullif(sqlerrm, ''), sqlstate); end $f$;
create function public._t_igual(e text, o anyelement, x anyelement) returns void language plpgsql as $f$
begin if o is distinct from x then raise exception 'FALLA %: esperaba %, obtuvo %', e, x, o; end if; end $f$;
create function public._t_como_err(uid text, q text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q; r := 'SIN_ERROR'; exception when others then r := coalesce(nullif(sqlerrm, ''), sqlstate); end;
  reset role; perform set_config('request.jwt.claims', '', true); return r;
end $f$;
create function public._t_como_json(uid text, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q into r; exception when others then r := jsonb_build_object('error', coalesce(nullif(sqlerrm, ''), sqlstate)); end;
  reset role; perform set_config('request.jwt.claims', '', true); return r;
end $f$;
create function public._t_rechaza(e text, uid text, q text, esperado text) returns void language plpgsql as $f$
declare r text := public._t_como_err(uid, q);
begin if position(esperado in r) = 0 then raise exception 'FALLA %: esperaba «%», obtuvo «%»', e, esperado, left(r, 160); end if; end $f$;
create function public._t_acepta(e text, uid text, q text) returns void language plpgsql as $f$
declare r text := public._t_como_err(uid, q);
begin if r <> 'SIN_ERROR' then raise exception 'FALLA %: esperaba éxito, obtuvo «%»', e, left(r, 160); end if; end $f$;
create function public._t_lim(n uuid) returns int language sql security definer set search_path = public as $f$
  select (public._capacidad_profesional(n) ->> 'limite')::int; $f$;
create function public._t_op(n uuid) returns boolean language sql security definer set search_path = public as $f$ select public.negocio_operativo(n) $f$;
create function public._t_reservas(n uuid) returns boolean language sql security definer set search_path = public as $f$ select public.negocio_puede_recibir_reservas(n) $f$;
create function public._t_pago_de(l uuid) returns uuid language sql security definer set search_path = public as $f$
  select pago_id from public.adicional_cobro where lote_id = l and estado = 'PENDIENTE' order by created_at desc limit 1; $f$;

-- Catálogo que la prueba necesita, fijado dentro de la transacción.
update public.plan_precio set precio_mensual = 69900, es_desde = false, activo = true where plan_codigo = 'ESSENTIAL' and pais_codigo = 'CO';
update public.plan_precio set precio_mensual = 139900, es_desde = false, activo = true where plan_codigo = 'STUDIO' and pais_codigo = 'CO';

insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-00f4-0000000000' || x.k)::uuid, 'f4-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','o1'),('a2','su'),('a3','adm')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-00f4-0000000000' || x.k)::uuid, 'F4 ' || x.n, 'f4-' || x.n || '@test.local'
from (values ('a1','o1'),('a2','su'),('a3','adm')) x(k, n) on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
update public.perfil set es_supersu = false where es_supersu and id <> '00000000-0000-0000-00f4-0000000000a2';
update public.perfil set es_supersu = true where id = '00000000-0000-0000-00f4-0000000000a2';
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado)
values ('00000000-0000-0000-00f4-000000000101', '00000000-0000-0000-00f4-0000000000a1', 'F4 N1', 'f4-n1', 'Cali', 'CO', 'ACTIVO');
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '00000000-0000-0000-00f4-000000000101';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values
  ('00000000-0000-0000-00f4-000000000201', '00000000-0000-0000-00f4-000000000101', 'Sede', 'Cra 1', 'Cali', true);
insert into public.staff (usuario_id, nombre, foto_url) values ('00000000-0000-0000-00f4-0000000000a3', 'F4 adm', 'https://res.cloudinary.com/demo/image/upload/x.jpg') on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, fecha_ingreso, es_admin, presta_servicios)
values ('00000000-0000-0000-00f4-0000000000a3', '00000000-0000-0000-00f4-000000000101', '00000000-0000-0000-00f4-000000000201', 'ACTIVO', now(), true, false);

\set N1 '''00000000-0000-0000-00f4-000000000101'''
\set O1 '''00000000-0000-0000-00f4-0000000000a1'''
\set SU '''00000000-0000-0000-00f4-0000000000a2'''
\set ADM '''00000000-0000-0000-00f4-0000000000a3'''

-- ═══ 1. Plan principal RESTRINGIDO (periodo pagado vencido hace 15 días, gracia agotada) ═══════════════
delete from public.suscripcion where negocio_id = :N1;
insert into public.suscripcion (negocio_id, plan_codigo, estado, pais_codigo, fecha_inicio_ciclo, fecha_proximo_cobro)
values (:N1, 'ESSENTIAL', 'ACTIVA', 'CO', now() - interval '45 days', public.suscripcion_fecha_limite(now() - interval '45 days', 30));
select public._t_igual('principal vencida: no operativa', public._t_op(:N1), false);
select public._t_igual('principal vencida: fase RESTRINGIDO', public._estado_operativo_en(:N1, now()) ->> 'estado', 'RESTRINGIDO');
select public._t_igual('principal vencida: sin reservas nuevas', public._t_reservas(:N1), false);
select public._t_rechaza('principal restringida: invitar (RPC)', :O1, format('select public.crear_invitacion_staff(%L, ''n1@t.local'', %L, null, ''BARBER'')', :N1, '00000000-0000-0000-00f4-000000000201'::text), 'SUSCRIPCION_RESTRINGIDA');

-- Contratar adicionales con el plan restringido: el estado de la suscripción sigue siendo ACTIVA en la fila, así que se permite pagar el
-- adicional (el propietario puede regularizar todo); lo que NO ocurre es que eso desbloquee el plan.
create temp table _g (k text primary key, v text);
insert into _g select 'r', public._t_como_json(:O1, format('select public.adicional_iniciar(%L, 2, 103800)', :N1))::text;
select public._t_igual('el adicional se inició', (select (v::jsonb ->> 'reutilizado') from _g where k = 'r'), 'false');
select public._t_igual('adicional pagado (webhook confirma)', (public.aplicar_evento_pago(public._t_pago_de((select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')), 'F4-MP-1', 'APROBADO', '{"transaction_amount":103800}'::jsonb) ->> 'adicional'), 'ACTIVADO');
select public._t_igual('lote ACTIVO', (select estado from public.adicional_lote where id = (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')), 'ACTIVO');
select public._t_igual('el cupo adicional existe (tope 1 + 2)', public._t_lim(:N1), 3);
-- La regla aprobada:
select public._t_igual('UN ADICIONAL PAGADO NO DESBLOQUEA: sigue no operativa', public._t_op(:N1), false);
select public._t_igual('sigue RESTRINGIDO', public._estado_operativo_en(:N1, now()) ->> 'estado', 'RESTRINGIDO');
select public._t_igual('sigue sin recibir reservas', public._t_reservas(:N1), false);
select public._t_rechaza('sigue bloqueado: invitar aunque haya cupo adicional', :O1, format('select public.crear_invitacion_staff(%L, ''n2@t.local'', %L, null, ''BARBER'')', :N1, '00000000-0000-0000-00f4-000000000201'::text), 'SUSCRIPCION_RESTRINGIDA');
select public._t_rechaza('sigue bloqueado: modificar datos del negocio', :O1, format('update public.negocio set nombre = ''Otro'' where id = %L', :N1), 'SUSCRIPCION_RESTRINGIDA');
select public._t_igual('el adicional no tocó la suscripción principal', (select estado::text || '/' || plan_codigo::text from public.suscripcion where negocio_id = :N1), 'ACTIVA/ESSENTIAL');
-- El cron de adicionales tampoco toca ni desbloquea la principal (ni siquiera al suspender el adicional)
select public.adicional_mantenimiento_srv(now(), true);
select public._t_igual('tras el cron de adicionales: principal intacta', (select estado::text from public.suscripcion where negocio_id = :N1), 'ACTIVA');
select public._t_igual('tras el cron: sigue no operativa', public._t_op(:N1), false);
-- Suspender el adicional tampoco cambia la principal
select public._t_acepta('SuperAdmin suspende el adicional', :SU, format('select public.admin_adicional_accion(%L, ''SUSPENDER'', ''prueba de independencia'', ''{}'')', (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')));
select public._t_igual('suspender el adicional no cambia el estado de la principal', (select estado::text from public.suscripcion where negocio_id = :N1), 'ACTIVA');
select public._t_acepta('SuperAdmin reactiva el adicional', :SU, format('select public.admin_adicional_accion(%L, ''REACTIVAR'', ''prueba de independencia'', ''{"dias":30}'')', (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')));
select public._t_igual('reactivar el adicional no desbloquea la principal', public._t_op(:N1), false);

-- ═══ 2. Al PAGAR EL PLAN se restaura todo ═══════════════════════════════════════════════════════
create temp table _h (k text primary key, v text);
insert into _h select 'p', public._t_como_json(:O1, format('select to_json(x) from public.solicitar_pago_plan(%L, null, null) x', :N1))::text;
select public._t_igual('solicitar pago del plan (propietario)', (select (v::jsonb ? 'id') from _h where k = 'p'), true);
select public._t_igual('pago del plan aprobado', (public.aplicar_evento_pago((select (v::jsonb ->> 'id')::uuid from _h where k = 'p'), 'F4-MP-PLAN', 'APROBADO',
  jsonb_build_object('transaction_amount', (select (v::jsonb ->> 'monto')::numeric from _h where k = 'p'))) ->> 'procesado')::boolean, true);
select public._t_igual('plan pagado: vuelve a ser operativa', public._t_op(:N1), true);
select public._t_igual('plan pagado: vuelve a recibir reservas', public._t_reservas(:N1), true);
select public._t_acepta('plan pagado: ya puede invitar usando el cupo adicional', :O1, format('select public.crear_invitacion_staff(%L, ''n3@t.local'', %L, null, ''BARBER'')', :N1, '00000000-0000-0000-00f4-000000000201'::text));

-- ═══ 3. Reglas aprobadas (resumen demostrable) ═══════════════════════════════════════════════════════
select public._t_igual('51.900 en los 4 planes (CO)', (select count(*) from public.adicional_precio_plan where pais_codigo = 'CO' and precio_mensual = 51900)::int, 4);
select public._t_igual('máximo inicial por negocio = 50', (select max_por_negocio from public.adicional_config), 50);
select public._t_igual('gracia 3 · avisos 7/3/1', (select gracia_dias::text || '/' || avisos_dias_antes::text from public.adicional_config), '3/{7,3,1}');
select public._t_rechaza('el administrador delegado NO contrata', :ADM, format('select public.adicional_iniciar(%L, 1, 51900)', :N1), 'NO_AUTORIZADO');
-- periodo congelado por compra: cambiar el periodo global no altera el lote ya pagado
select set_config('t.vh', (select vigente_hasta::text from public.adicional_lote where id = (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')), true);
select public._t_acepta('SuperAdmin cambia el periodo a 15 días', :SU, 'select public.admin_adicional_config_guardar(''{"periodo_dias":15}''::jsonb, ''prueba de congelación'')');
select public._t_igual('el lote conserva su vencimiento', (select vigente_hasta::text from public.adicional_lote where id = (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')), current_setting('t.vh'));
select public._t_igual('el lote conserva precio y cantidad', (select precio_unitario::text || '/' || cantidad::text from public.adicional_lote where id = (select (v::jsonb ->> 'lote_id')::uuid from _g where k = 'r')), '51900.00/2');
select public._t_igual('las compras nuevas usan el periodo nuevo', (public._t_como_json(:O1, format('select public.adicional_cotizar(%L, 1)', :N1)) ->> 'periodo_dias')::int, 15);

rollback;
select 'ADICIONALES vs PLAN RESTRINGIDO: TODAS LAS PRUEBAS PASARON' as resultado;
