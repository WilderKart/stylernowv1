-- Pruebas de las migraciones 160-164 (FASE 2B: suscripción restringida / bloqueo operativo). Solo base LOCAL:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/restringida_160.sql
-- Transacción terminada en ROLLBACK: no deja datos. Cada bloque lanza 'FALLA …' si el comportamiento no es el esperado.
-- Los «días» se simulan de dos formas: (a) _estado_operativo_en(negocio, instante) con instantes exactos en hora de Colombia (bordes de
-- medianoche UTC-5) y (b) moviendo las fechas de la suscripción para que «hoy» sea el día N del ciclo (así los disparadores y RPC, que
-- usan now(), ven el estado real).
-- Negocios: NE essential · NS studio · NP prestige · NG signature · NX ajeno (intruso)

begin;

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
-- Emula a un usuario de la API (rol authenticated + claims) o al sistema (sin claims) o al administrador de la base.
create function public._t_como(uid text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $f$;
create function public._t_sistema() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('role', 'service_role', true); end $f$;
create function public._t_yo() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', '', true); perform set_config('role', 'postgres', true); end $f$;

-- «Hoy es el día N de la prueba» / «hoy es el día N del periodo pagado» (día 1 = hoy menos N-1 días, hora de Colombia).
create function public._t_dia_prueba(n uuid, dia int) returns void language plpgsql as $f$
declare v_ini timestamptz := now() - make_interval(days => dia - 1);
begin
  update public.suscripcion set estado = 'TRIAL', prueba_inicio = v_ini, prueba_fin = public.suscripcion_fecha_limite(v_ini, 14),
         fecha_proximo_cobro = public.suscripcion_fecha_limite(v_ini, 14), fecha_inicio_ciclo = v_ini, activacion_manual = false,
         manual_hasta = null, gracia_fin = null, suspendido_causa = null where negocio_id = n;
end $f$;
create function public._t_dia_pagado(n uuid, dia int) returns void language plpgsql as $f$
declare v_ini timestamptz := now() - make_interval(days => dia - 1);
begin
  update public.suscripcion set estado = 'ACTIVA', fecha_inicio_ciclo = v_ini, fecha_proximo_cobro = public.suscripcion_fecha_limite(v_ini, 30),
         prueba_inicio = null, prueba_fin = null, activacion_manual = false, manual_hasta = null, gracia_fin = null, suspendido_causa = null
   where negocio_id = n;
end $f$;
create function public._t_op(n uuid) returns boolean language sql security definer set search_path = public as $f$ select public.negocio_operativo(n) $f$;
create function public._t_fase(n uuid) returns text language sql security definer set search_path = public as $f$ select public._estado_operativo_en(n, now()) ->> 'estado' $f$;

create temp table _t_ids (k text primary key, id uuid);
grant all on _t_ids to public;
-- ── Fixtures ────────────────────────────────────────────────────────────────────────────
-- Un solo SuperSU: en la transacción se desciende al existente y se promueve al de la prueba.
update public.perfil set es_supersu = false where es_supersu;
insert into auth.users (id, email, aud, role, email_confirmed_at)
select ('00000000-0000-0000-0016-0000000000' || x.k)::uuid, 'r160-' || x.n || '@test.local', 'authenticated', 'authenticated', now()
from (values ('a1','dueno'),('b1','barbero'),('c1','cliente'),('d1','intruso'),('e1','su'),('f1','dueno2'),('f2','dueno3'),('f3','dueno4')) x(k, n);
insert into public.perfil (id, nombre, email)
select ('00000000-0000-0000-0016-0000000000' || x.k)::uuid, 'R160 ' || x.n, 'r160-' || x.n || '@test.local'
from (values ('a1','dueno'),('b1','barbero'),('c1','cliente'),('d1','intruso'),('e1','su'),('f1','dueno2'),('f2','dueno3'),('f3','dueno4')) x(k, n)
on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0016-0000000000e1';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado, plan_codigo) values
  ('00000000-0000-0000-0016-0000000001a0', '00000000-0000-0000-0016-0000000000a1', 'R160 NE', 'r160-ne', 'Cali', 'CO', 'ACTIVO', 'ESSENTIAL'),
  ('00000000-0000-0000-0016-0000000001b0', '00000000-0000-0000-0016-0000000000f1', 'R160 NS', 'r160-ns', 'Cali', 'CO', 'ACTIVO', 'STUDIO'),
  ('00000000-0000-0000-0016-0000000001c0', '00000000-0000-0000-0016-0000000000f2', 'R160 NP', 'r160-np', 'Cali', 'CO', 'ACTIVO', 'PRESTIGE'),
  ('00000000-0000-0000-0016-0000000001d0', '00000000-0000-0000-0016-0000000000f3', 'R160 NG', 'r160-ng', 'Cali', 'CO', 'ACTIVO', 'SIGNATURE'),
  ('00000000-0000-0000-0016-0000000001e0', '00000000-0000-0000-0016-0000000000d1', 'R160 NX', 'r160-nx', 'Cali', 'CO', 'ACTIVO', 'ESSENTIAL');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal)
select ('00000000-0000-0000-0016-0000000002' || x.k)::uuid, ('00000000-0000-0000-0016-0000000001' || x.k)::uuid, 'Sede ' || x.k, 'Cra 1', 'Cali', true
from (values ('a0'),('b0'),('c0'),('d0'),('e0')) x(k);
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo)
select ('00000000-0000-0000-0016-0000000001' || x.k)::uuid, x.p::public.plan_codigo, 'TRIAL', now() + interval '14 days', 'CO'
from (values ('a0','ESSENTIAL'),('b0','STUDIO'),('c0','PRESTIGE'),('d0','SIGNATURE'),('e0','ESSENTIAL')) x(k, p);
insert into public.staff (usuario_id, nombre) values ('00000000-0000-0000-0016-0000000000b1', 'R160 barbero') on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso, presta_servicios) values
  ('00000000-0000-0000-0016-0000000003a1', '00000000-0000-0000-0016-0000000000b1', '00000000-0000-0000-0016-0000000001a0',
   '00000000-0000-0000-0016-0000000002a0', 'ACTIVO', false, 30, now(), true);
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('00000000-0000-0000-0016-0000000004a1', '00000000-0000-0000-0016-0000000001a0', 'Corte R160', 30, 30000, 'ACTIVO');
insert into public.staff_servicio (staff_id, servicio_id) values ('00000000-0000-0000-0016-0000000000b1', '00000000-0000-0000-0016-0000000004a1');
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
select '00000000-0000-0000-0016-0000000003a1', '00000000-0000-0000-0016-0000000002a0', d, '08:00', '20:00' from generate_series(0, 6) d;

-- ═════════════ 1 · Función central de fechas (America/Bogota) y bordes de medianoche UTC-5 ═════════════
do $$
begin
  perform public._t_igual('día en Colombia justo antes de medianoche local', public.suscripcion_dia('2026-11-18 04:59:59+00'::timestamptz), '2026-11-17'::date);
  perform public._t_igual('día en Colombia en la medianoche local', public.suscripcion_dia('2026-11-18 05:00:00+00'::timestamptz), '2026-11-18'::date);
  -- 21:00 del día 1 en Bogotá = 02:00 UTC del día 2: sigue siendo el día 1.
  perform public._t_igual('pago a las 21:00 de Bogotá es del mismo día', public.suscripcion_dia('2026-11-02 02:00:00+00'::timestamptz), '2026-11-01'::date);
  -- Día 1 pago, día 30 último pagado: el límite es la medianoche (Bogotá) del día 31.
  perform public._t_igual('límite de 30 días', public.suscripcion_fecha_limite('2026-11-01 23:30:00-05'::timestamptz, 30), '2026-12-01 00:00:00-05'::timestamptz);
  perform public._t_igual('límite de 14 días de prueba', public.suscripcion_fecha_limite('2026-11-01 10:00:00-05'::timestamptz, 14), '2026-11-15 00:00:00-05'::timestamptz);
  perform public._t_igual('número de día (día 1)', public.suscripcion_numero_dia('2026-11-01 10:00:00-05'::timestamptz, '2026-11-01 23:59:59-05'::timestamptz), 1);
  perform public._t_igual('número de día (día 15)', public.suscripcion_numero_dia('2026-11-01 10:00:00-05'::timestamptz, '2026-11-15 00:00:00-05'::timestamptz), 15);
  raise notice 'OK 160-1: función central de fechas y bordes UTC-5';
end $$;

-- ═════════════ 2 · Prueba de 14 días y pago de 30 días: instantes exactos (bordes) ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; v_ini timestamptz := '2026-11-01 10:00:00-05'; e jsonb;
begin
  update public.suscripcion set estado = 'TRIAL', prueba_inicio = v_ini, prueba_fin = public.suscripcion_fecha_limite(v_ini, 14),
         fecha_proximo_cobro = public.suscripcion_fecha_limite(v_ini, 14), fecha_inicio_ciclo = v_ini where negocio_id = n;
  perform public._t_igual('prueba día 1 (00:00 UTC-5)', (public._estado_operativo_en(n, '2026-11-01 00:00:00-05')->>'operativo')::boolean, true);
  e := public._estado_operativo_en(n, '2026-11-14 23:59:59-05');
  perform public._t_igual('prueba día 14 a las 23:59:59 sigue operativa', (e->>'operativo')::boolean, true);
  perform public._t_igual('prueba: fase', e->>'estado', 'PRUEBA');
  perform public._t_igual('prueba: día 14', (e->>'dia_ciclo')::int, 14);
  -- Borde en UTC: 04:59:59Z del 15 sigue siendo el día 14 en Bogotá; 05:00:00Z ya es el día 15.
  perform public._t_igual('prueba 04:59:59Z del día 15 (día 14 local)', (public._estado_operativo_en(n, '2026-11-15 04:59:59+00')->>'operativo')::boolean, true);
  e := public._estado_operativo_en(n, '2026-11-15 05:00:00+00');
  perform public._t_igual('prueba día 15 sin pago: bloqueada', (e->>'operativo')::boolean, false);
  perform public._t_igual('prueba día 15: fase', e->>'estado', 'RESTRINGIDO');
  perform public._t_igual('prueba día 15: motivo', e->>'motivo', 'PRUEBA_VENCIDA');
  perform public._t_igual('prueba día 15: puede pagar', (e->>'puede_pagar')::boolean, true);

  -- Pago confirmado el día 1: días 1..30 operativos, día 31 gracia (opera), día 32 bloqueo.
  update public.suscripcion set estado = 'ACTIVA', prueba_inicio = null, prueba_fin = null, fecha_inicio_ciclo = v_ini,
         fecha_proximo_cobro = public.suscripcion_fecha_limite(v_ini, 30) where negocio_id = n;
  e := public._estado_operativo_en(n, '2026-11-30 23:59:59-05');
  perform public._t_igual('pagado día 30 operativo', (e->>'operativo')::boolean, true);
  perform public._t_igual('pagado día 30 fase', e->>'estado', 'PAGADO');
  perform public._t_igual('pagado día 30 número', (e->>'dia_ciclo')::int, 30);
  e := public._estado_operativo_en(n, '2026-12-01 00:00:00-05');
  perform public._t_igual('día 31 es de gracia', e->>'estado', 'GRACIA');
  perform public._t_igual('día 31 la gracia opera (config por defecto)', (e->>'operativo')::boolean, true);
  perform public._t_igual('día 31 número', (e->>'dia_ciclo')::int, 31);
  e := public._estado_operativo_en(n, '2026-12-01 23:59:59-05');
  perform public._t_igual('día 31 a las 23:59:59 aún en gracia', e->>'estado', 'GRACIA');
  e := public._estado_operativo_en(n, '2026-12-02 00:00:00-05');
  perform public._t_igual('día 32 bloqueado', (e->>'operativo')::boolean, false);
  perform public._t_igual('día 32 motivo', e->>'motivo', 'PERIODO_VENCIDO');
  perform public._t_igual('día 32 número', (e->>'dia_ciclo')::int, 32);
  -- Borde UTC del día 32: 04:59:59Z aún es el 31 local; 05:00:00Z ya es el 32.
  perform public._t_igual('día 32 04:59:59Z todavía gracia', public._estado_operativo_en(n, '2026-12-02 04:59:59+00')->>'estado', 'GRACIA');
  perform public._t_igual('día 32 05:00:00Z bloqueado', public._estado_operativo_en(n, '2026-12-02 05:00:00+00')->>'estado', 'RESTRINGIDO');

  -- La gracia es configurable: si SuperAdmin la apaga (gracia_permite_operar = false) el día 31 ya no opera; con 0 días desaparece.
  update public.configuracion_plataforma set gracia_permite_operar = false where id;
  perform public._t_igual('gracia sin operar', (public._estado_operativo_en(n, '2026-12-01 12:00:00-05')->>'operativo')::boolean, false);
  update public.configuracion_plataforma set gracia_permite_operar = true, suscripcion_gracia_dias = 0 where id;
  perform public._t_igual('gracia de 0 días: el día 31 ya bloquea', public._estado_operativo_en(n, '2026-12-01 00:00:00-05')->>'estado', 'RESTRINGIDO');
  update public.configuracion_plataforma set suscripcion_gracia_dias = 3 where id;
  perform public._t_igual('gracia de 3 días: el día 33 aún gracia', public._estado_operativo_en(n, '2026-12-03 12:00:00-05')->>'estado', 'GRACIA');
  update public.configuracion_plataforma set suscripcion_gracia_dias = 1 where id;
  -- Gracia de la prueba (0 por defecto; editable).
  update public.suscripcion set estado = 'TRIAL', prueba_inicio = v_ini, prueba_fin = public.suscripcion_fecha_limite(v_ini, 14) where negocio_id = n;
  update public.configuracion_plataforma set prueba_gracia_dias = 2 where id;
  perform public._t_igual('prueba con gracia de 2: día 16 gracia', public._estado_operativo_en(n, '2026-11-16 12:00:00-05')->>'estado', 'GRACIA');
  perform public._t_igual('prueba con gracia de 2: día 17 bloqueada', public._estado_operativo_en(n, '2026-11-17 00:00:00-05')->>'estado', 'RESTRINGIDO');
  update public.configuracion_plataforma set prueba_gracia_dias = 0 where id;
  raise notice 'OK 160-2: prueba 14 días, pago 30 días, gracia día 31, bloqueo día 32 (bordes UTC-5 y configuración)';
end $$;

-- ═════════════ 3 · Los 4 planes: día 14 opera, día 15 sin pago bloquea (con los datos reales de la suscripción) ═════════════
do $$
declare r record;
begin
  for r in select * from (values ('00000000-0000-0000-0016-0000000001a0'::uuid, 'ESSENTIAL'), ('00000000-0000-0000-0016-0000000001b0', 'STUDIO'),
                                  ('00000000-0000-0000-0016-0000000001c0', 'PRESTIGE'), ('00000000-0000-0000-0016-0000000001d0', 'SIGNATURE')) t(n, p) loop
    perform public._t_dia_prueba(r.n, 1);  perform public._t_igual(r.p || ' día 1', public._t_op(r.n), true);
    perform public._t_dia_prueba(r.n, 14); perform public._t_igual(r.p || ' día 14', public._t_op(r.n), true);
    perform public._t_dia_prueba(r.n, 15); perform public._t_igual(r.p || ' día 15 sin pago', public._t_op(r.n), false);
    perform public._t_dia_pagado(r.n, 30); perform public._t_igual(r.p || ' pagado día 30', public._t_op(r.n), true);
    perform public._t_dia_pagado(r.n, 31); perform public._t_igual(r.p || ' pagado día 31 (gracia)', public._t_fase(r.n), 'GRACIA');
    perform public._t_igual(r.p || ' pagado día 31 opera', public._t_op(r.n), true);
    perform public._t_dia_pagado(r.n, 32); perform public._t_igual(r.p || ' pagado día 32', public._t_op(r.n), false);
  end loop;
  -- Estados que nunca operan.
  update public.suscripcion set estado = 'REQUIERE_PLAN' where negocio_id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_igual('REQUIERE_PLAN', public._t_op('00000000-0000-0000-0016-0000000001e0'), false);
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'INFRACCION' where negocio_id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_igual('SUSPENDIDA', public._t_op('00000000-0000-0000-0016-0000000001e0'), false);
  perform public._t_igual('SUSPENDIDA por infracción no puede pagar', (public._estado_operativo_en('00000000-0000-0000-0016-0000000001e0', now())->>'puede_pagar')::boolean, false);
  update public.suscripcion set estado = 'CANCELADA' where negocio_id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_igual('CANCELADA', public._t_op('00000000-0000-0000-0016-0000000001e0'), false);
  update public.suscripcion set estado = 'TRIAL', prueba_fin = now() + interval '5 days', prueba_inicio = now() where negocio_id = '00000000-0000-0000-0016-0000000001e0';
  -- Negocio en alta (PENDIENTE_APROBACION): operativo para poder configurarse; negocio suspendido: no.
  update public.negocio set estado = 'PENDIENTE_APROBACION' where id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_dia_prueba('00000000-0000-0000-0016-0000000001e0', 15);
  perform public._t_igual('en alta con prueba vencida sigue configurable', public._t_op('00000000-0000-0000-0016-0000000001e0'), true);
  update public.negocio set estado = 'SUSPENDIDO' where id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_igual('negocio suspendido no opera', public._t_op('00000000-0000-0000-0016-0000000001e0'), false);
  update public.negocio set estado = 'ACTIVO' where id = '00000000-0000-0000-0016-0000000001e0';
  perform public._t_dia_prueba('00000000-0000-0000-0016-0000000001e0', 3);
  raise notice 'OK 160-3: 4 planes, estados que nunca operan, negocio en alta';
end $$;

-- ═════════════ 4 · Mantenimiento diario sincroniza el estado visible sin cambiar lo operativo ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001b0'; s public.suscripcion;
begin
  -- Prueba día 15: el estado derivado ya bloquea ANTES del cron; el cron la mueve a REQUIERE_PLAN (sin gracia de prueba).
  perform public._t_dia_prueba(n, 15);
  perform public._t_igual('antes del cron: ya bloqueada', public._t_op(n), false);
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('cron: prueba vencida → REQUIERE_PLAN', s.estado::text, 'REQUIERE_PLAN');
  perform public._t_igual('después del cron: sigue bloqueada', public._t_op(n), false);
  -- Historial: este negocio ya pagó un plan antes (sin eso, vencido = REQUIERE_PLAN, no SUSPENDIDA).
  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (n, 'SUSCRIPCION', 139900, 'APROBADO', 'MERCADOPAGO', jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', 'STUDIO', 'ciclo', 'MENSUAL'));
  -- Pagado día 31: el cron lo pasa a EN_MORA con gracia_fin determinista = fecha_proximo_cobro + 1 día; sigue operando.
  perform public._t_dia_pagado(n, 31);
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('cron: periodo vencido → EN_MORA', s.estado::text, 'EN_MORA');
  perform public._t_igual('cron: gracia_fin determinista', s.gracia_fin, s.fecha_proximo_cobro + interval '1 day');
  perform public._t_igual('EN_MORA en gracia opera', public._t_op(n), true);
  -- Día 32: aunque el cron aún no corra, bloquea; al correr queda SUSPENDIDA por IMPAGO.
  perform public._t_dia_pagado(n, 32);
  perform public._t_igual('día 32 antes del cron: bloqueado', public._t_op(n), false);
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('cron día 32: SUSPENDIDA', s.estado::text, 'SUSPENDIDA');
  perform public._t_igual('cron día 32: causa IMPAGO', s.suspendido_causa, 'IMPAGO');
  perform public._t_igual('SUSPENDIDA por impago puede pagar', (public._estado_operativo_en(n, now())->>'puede_pagar')::boolean, true);
  -- Las activaciones manuales no las toca el cron de prueba/periodo.
  perform public._t_dia_prueba(n, 20);
  update public.suscripcion set activacion_manual = true, manual_tipo = 'CORTESIA', manual_hasta = now() + interval '3 days' where negocio_id = n;
  perform public.mantenimiento_suscripciones();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('manual vigente no la mueve el cron', s.estado::text, 'TRIAL');
  perform public._t_igual('manual vigente opera aunque la prueba esté vencida', public._t_op(n), true);
  update public.suscripcion set manual_hasta = now() - interval '1 minute' where negocio_id = n;
  perform public._t_igual('manual vencida bloquea al instante', public._t_op(n), false);
  perform public.mantenimiento_suscripciones();
  perform public._t_igual('cron: manual vencida → REQUIERE_PLAN', (select estado::text from public.suscripcion where negocio_id = n), 'REQUIERE_PLAN');
  raise notice 'OK 160-4: mantenimiento diario coherente con el estado derivado';
end $$;

-- ═════════════ 5 · Pago confirmado reactiva (aplicar_evento_pago, como el webhook) y fija 30 días por día de Bogotá ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; v_pago uuid := gen_random_uuid(); s public.suscripcion;
begin
  perform public._t_dia_prueba(n, 15);
  perform public._t_igual('antes de pagar: bloqueada', public._t_op(n), false);
  insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_pago, n, 'SUSCRIPCION', 99900, 'PENDIENTE', 'MERCADOPAGO',
          jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', 'ESSENTIAL', 'ciclo', 'MENSUAL', 'estado_previo', 'TRIAL'));
  perform public._t_sistema();
  perform public.aplicar_evento_pago(v_pago, 'r160-pago-1', 'APROBADO', '{}'::jsonb);
  perform public._t_yo();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('pago: ACTIVA', s.estado::text, 'ACTIVA');
  perform public._t_igual('pago: 30 días por día de Bogotá', s.fecha_proximo_cobro, public.suscripcion_fecha_limite(now(), 30));
  perform public._t_igual('pago: restaura la operación', public._t_op(n), true);
  perform public._t_igual('pago: día 1 del ciclo', (public._estado_operativo_en(n, now())->>'dia_ciclo')::int, 1);
  -- Renovar desde el bloqueo (día 32 sin renovar): el periodo nuevo cuenta desde el día del pago, no desde el vencido.
  perform public._t_dia_pagado(n, 32);
  perform public._t_igual('día 32: bloqueada', public._t_op(n), false);
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'IMPAGO' where negocio_id = n;
  v_pago := gen_random_uuid();
  insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_pago, n, 'SUSCRIPCION', 99900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', 'ESSENTIAL', 'ciclo', 'MENSUAL'));
  perform public._t_sistema();
  perform public.aplicar_evento_pago(v_pago, 'r160-pago-2', 'APROBADO', '{}'::jsonb);
  perform public._t_yo();
  select * into s from public.suscripcion where negocio_id = n;
  perform public._t_igual('renovación desde SUSPENDIDA: ACTIVA', s.estado::text, 'ACTIVA');
  perform public._t_igual('renovación: 30 días desde hoy', s.fecha_proximo_cobro, public.suscripcion_fecha_limite(now(), 30));
  perform public._t_igual('renovación: restaura las funciones', public._t_op(n), true);
  perform public._t_igual('renovación: gracia_fin limpia', s.gracia_fin is null, true);
  -- Renovación el día 31 (gracia): periodo nuevo desde hoy.
  perform public._t_dia_pagado(n, 31);
  v_pago := gen_random_uuid();
  insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_pago, n, 'SUSCRIPCION', 99900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', 'ESSENTIAL', 'ciclo', 'MENSUAL'));
  perform public._t_sistema();
  perform public.aplicar_evento_pago(v_pago, 'r160-pago-3', 'APROBADO', '{}'::jsonb);
  perform public._t_yo();
  perform public._t_igual('renovar en la gracia: 30 días desde hoy', (select fecha_proximo_cobro from public.suscripcion where negocio_id = n), public.suscripcion_fecha_limite(now(), 30));
  perform public._t_dia_pagado(n, 5);
  raise notice 'OK 160-5: pago confirmado inicia 30 días y restaura (desde bloqueo, suspendida y gracia)';
end $$;

-- ═════════════ 6 · Citas previas confirmadas (se crean con el negocio operativo) ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; v_r public.reserva; v_base timestamptz := date_trunc('day', now() + interval '3 days') + interval '15 hours'; i int;
begin
  perform public._t_dia_pagado(n, 5);
  for i in 1..4 loop
    perform public._t_como('00000000-0000-0000-0016-0000000000a1');
    v_r := public.crear_reserva_manual('00000000-0000-0000-0016-0000000002a0', array['00000000-0000-0000-0016-0000000004a1']::uuid[],
             v_base + make_interval(hours => i), '00000000-0000-0000-0016-0000000000c1', '00000000-0000-0000-0016-0000000000b1');
    perform public._t_yo();
    insert into _t_ids values ('cita' || i, v_r.id);
    perform public._t_igual('control positivo: cita ' || i || ' creada con el negocio operativo', v_r.estado::text, 'CONFIRMADA');
  end loop;
  -- Control positivo de slots con el negocio operativo.
  perform public._t_como('00000000-0000-0000-0016-0000000000a1');
  perform public._t_igual('slots con el negocio operativo hay horarios',
    (select count(*) > 0 from public.slots_disponibles('00000000-0000-0000-0016-0000000002a0', array['00000000-0000-0000-0016-0000000004a1']::uuid[], (now() + interval '5 days')::date)), true);
  perform public._t_yo();
  -- cita1 está «en su hora» (para iniciar/finalizar) y cita3 ya pasó (para cobrar en el POS): se mueven AHORA, con el negocio operativo.
  update public.reserva set hora_inicio = now() - interval '10 minutes', hora_fin = now() + interval '20 minutes' where id = (select id from _t_ids where k = 'cita1');
  update public.reserva set hora_inicio = now() - interval '3 hours', hora_fin = now() - interval '2 hours 30 minutes' where id = (select id from _t_ids where k = 'cita3');
  raise notice 'OK 160-6: 4 citas previas confirmadas y slots con negocio operativo';
end $$;

-- ═════════════ 7 · BLOQUEADO con el negocio restringido (día 15 sin pago): RPC, tablas, API del dueño ═════════════
create function public._t_nunca(etiqueta text, q text) returns void language plpgsql as $f$
declare r text := public._t_err(q);
begin if r = 'SIN_ERROR' then raise exception 'FALLA %: debía fallar y funcionó', etiqueta; end if; end $f$;

do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; own text := '00000000-0000-0000-0016-0000000000a1'; cli text := '00000000-0000-0000-0016-0000000000c1';
        v text := 'SUSCRIPCION_RESTRINGIDA'; srv text := '00000000-0000-0000-0016-0000000004a1'; sede text := '00000000-0000-0000-0016-0000000002a0';
        vinc text := '00000000-0000-0000-0016-0000000003a1'; hora text;
begin
  perform public._t_dia_prueba(n, 15);
  perform public._t_igual('el negocio quedó restringido', public._t_op(n), false);
  hora := (now() + interval '6 days')::text;

  -- Dueño (rol authenticated, escrituras directas como lo hacen las Server Actions con el JWT del usuario)
  perform public._t_como(own);
  perform public._t_rechaza('crear servicio', format($q$insert into public.servicio (negocio_id, nombre, duracion_minutos, precio_base) values (%L, 'Nuevo', 30, 10000)$q$, n), v);
  perform public._t_rechaza('modificar servicio', format($q$update public.servicio set nombre = 'Cambiado' where id = %L$q$, srv), v);
  perform public._t_rechaza('modificar PRECIO', format($q$update public.servicio set precio_base = 1 where id = %L$q$, srv), v);
  perform public._t_rechaza('borrar servicio', format($q$delete from public.servicio where id = %L$q$, srv), v);
  perform public._t_rechaza('asignar servicio a profesional', format($q$delete from public.staff_servicio where servicio_id = %L$q$, srv), v);
  perform public._t_rechaza('crear disponibilidad', format($q$insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin) values (%L, %L, 1, '07:00', '07:30')$q$, vinc, sede), v);
  perform public._t_rechaza('modificar disponibilidad', format($q$update public.disponibilidad set hora_fin = '19:00' where vinculo_id = %L$q$, vinc), v);
  perform public._t_rechaza('bloqueo de ausencia', format($q$insert into public.bloqueo_ausencia (vinculo_id, fecha_inicio, fecha_fin) values (%L, now() + interval '9 days', now() + interval '10 days')$q$, vinc), v);
  perform public._t_rechaza('modificar sede', format($q$update public.sede set nombre = 'Otra' where id = %L$q$, sede), v);
  perform public._t_rechaza('crear sede (RPC)', format($q$select public.crear_sede(%L, 'S2', 'Cra 2', 'Cali', '{}'::jsonb, null, null)$q$, n), v);
  perform public._t_rechaza('invitar profesional (RPC)', format($q$select public.crear_invitacion_staff(%L, 'nuevo@t.local', %L, 10, 'BARBER')$q$, n, sede), v);
  perform public._t_rechaza('invitación directa a la tabla', format($q$insert into public.invitacion_staff (negocio_id, email, invitado_por, expira_at, sede_id, comision_pct) values (%L, 'otro@t.local', %L, now() + interval '5 days', %L, 5)$q$, n, own, sede), v);
  perform public._t_rechaza('comisión del profesional', format($q$update public.vinculo_staff_negocio set comision_pct = 55 where id = %L$q$, vinc), v);
  perform public._t_rechaza('suspender profesional (equipo)', format($q$select public.suspender_staff(%L, 'motivo de prueba largo')$q$, vinc), v);
  perform public._t_rechaza('retirar profesional (equipo)', format($q$select public.retirar_staff(%L, 'motivo de prueba largo')$q$, vinc), v);
  perform public._t_rechaza('vincular a alguien al equipo', format($q$insert into public.vinculo_staff_negocio (staff_id, negocio_id, estado) values (%L, %L, 'ACTIVO')$q$, cli, n), v);
  perform public._t_rechaza('datos del negocio', format($q$update public.negocio set nombre = 'Renombrado' where id = %L$q$, n), v);
  perform public._t_rechaza('anticipo / política (RPC)', format($q$select public.configurar_anticipo(%L, 'PORCENTAJE', 20, null, null, null, false, 'motivo de prueba largo')$q$, n), v);
  perform public._t_rechaza('campaña de sellos (comercial)', format($q$select public.crear_campana_sellos(%L, 'Sellos', 5, 'Corte gratis', array[]::uuid[], 30)$q$, n), v);
  perform public._t_rechaza('gift card (comercial)', format($q$select public.crear_gift_card(%L, 50000, '1234', null, null, 30, null, null)$q$, n), v);
  perform public._t_rechaza('referidos (comercial)', format($q$select public.configurar_referidos(%L, 1000, null, 5, 30, true)$q$, n), v);
  perform public._t_rechaza('egreso de caja (admin)', format($q$select public.registrar_egreso_caja(%L, %L, 1000, 'x', 'otros')$q$, n, sede), v);
  perform public._t_rechaza('ajustar stock (inventario)', format($q$select public.ajustar_stock(gen_random_uuid(), %L, 3, 'prueba')$q$, sede), v);
  perform public._t_rechaza('cita manual (RPC)', format($q$select public.crear_reserva_manual(%L, array[%L]::uuid[], %L::timestamptz, %L, %L)$q$, sede, srv, hora, cli, '00000000-0000-0000-0016-0000000000b1'), v);
  perform public._t_rechaza('reprogramar cita confirmada a otra fecha (RPC)', format($q$select public.reprogramar_reserva(%L, now() + interval '8 days', 'prueba')$q$, (select id from _t_ids where k = 'cita4')), v);
  perform public._t_yo();
  perform public._t_sistema();
  perform public._t_rechaza('reprogramar: evasión directa a la tabla (sistema)', format($q$update public.reserva set hora_inicio = hora_inicio + interval '1 day', hora_fin = hora_fin + interval '1 day' where id = %L$q$, (select id from _t_ids where k = 'cita4')), v);
  perform public._t_yo();

  -- Cliente (JWT del cliente llamando RPC directo): no puede saltarse el bloqueo
  perform public._t_como(cli);
  perform public._t_rechaza('cliente: crear_reserva directo (cerrada desde 144)', format($q$select public.crear_reserva(%L, array[%L]::uuid[], %L::timestamptz, null, null)$q$, sede, srv, hora), 'permission denied');
  perform public._t_rechaza('cliente: crear_reserva_autorizada directo (marketplace)', format($q$select public.crear_reserva_autorizada(%L, array[%L]::uuid[], %L::timestamptz, null, null, true)$q$, sede, srv, hora), v);
  perform public._t_nunca('cliente: insert directo a la tabla reserva', format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values (%L, %L, %L, %L, %L::timestamptz, %L::timestamptz + interval '30 minutes', 'CONFIRMADA', 1, 0)$q$, cli, n, sede, '00000000-0000-0000-0016-0000000000b1', hora, hora));
  perform public._t_rechaza('cliente: reprogramar su cita a otra fecha', format($q$select public.reprogramar_reserva(%L, now() + interval '8 days', 'prueba')$q$, (select id from _t_ids where k = 'cita4')), v);
  perform public._t_yo();
  -- Sistema (service_role, p. ej. un servidor con la clave de servicio): el disparador de reservas lo frena igual.
  perform public._t_sistema();
  perform public._t_rechaza('sistema: insertar una reserva en negocio restringido', format($q$insert into public.reserva (cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values (%L, %L, %L, %L, %L::timestamptz, %L::timestamptz + interval '30 minutes', 'CONFIRMADA', 1, 0)$q$, cli, n, sede, '00000000-0000-0000-0016-0000000000b1', hora, hora), v);
  perform public._t_yo();
  -- slots: la agenda pública no ofrece horarios
  perform public._t_igual('slots restringido: ninguno', (select count(*) from public.slots_disponibles(sede::uuid, array[srv::uuid], (now() + interval '5 days')::date)), 0::bigint);
  raise notice 'OK 160-7: todo lo comercial/administrativo/equipo/precio/reserva nueva queda bloqueado (RPC, tablas, JWT de cliente, sistema)';
end $$;

-- ═════════════ 8 · PERMITIDO con el negocio restringido: histórico, pago, cumplir citas previas ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; own text := '00000000-0000-0000-0016-0000000000a1'; bar text := '00000000-0000-0000-0016-0000000000b1';
        intr text := '00000000-0000-0000-0016-0000000000d1'; c1 uuid; c2 uuid; c3 uuid; c4 uuid; e jsonb; est text; pago public.pago;
begin
  select id into c1 from _t_ids where k = 'cita1'; select id into c2 from _t_ids where k = 'cita2';
  select id into c3 from _t_ids where k = 'cita3'; select id into c4 from _t_ids where k = 'cita4';
  perform public._t_igual('sigue restringido', public._t_op(n), false);
  insert into public.plan_precio (plan_codigo, pais_codigo, precio_mensual, es_desde, activo) values ('ESSENTIAL', 'CO', 99900, false, true) on conflict do nothing;

  -- Consulta histórica (dueño) y estado de pago
  perform public._t_como(own);
  perform public._t_igual('histórico: el dueño ve sus citas', (select count(*) from public.reserva where negocio_id = n), 4::bigint);
  perform public._t_igual('histórico: el dueño ve su suscripción', (select count(*) from public.suscripcion where negocio_id = n), 1::bigint);
  e := public.negocio_estado_operativo(n);
  perform public._t_igual('el dueño ve el detalle (motivo)', e->>'motivo', 'PRUEBA_VENCIDA');
  perform public._t_igual('el dueño ve que puede pagar', (e->>'puede_pagar')::boolean, true);
  -- Pagar: la pantalla de suscripción y el pago de la renovación siguen accesibles
  pago := public.solicitar_pago_plan(n, 'ESSENTIAL', 'MENSUAL');
  perform public._t_igual('pagar: se crea el cobro del plan en estado restringido', pago.estado::text, 'PENDIENTE');
  perform public._t_yo();

  -- IDOR / privacidad del estado
  perform public._t_como(intr);
  e := public.negocio_estado_operativo(n);
  perform public._t_igual('intruso: no ve motivo', e ? 'motivo', false);
  perform public._t_igual('intruso: no ve fechas', e ? 'limite_servicio', false);
  perform public._t_yo();
  perform public._t_como(bar);
  e := public.negocio_estado_operativo(n);
  perform public._t_igual('profesional del negocio sí ve el estado', e->>'motivo', 'PRUEBA_VENCIDA');
  perform public._t_yo();
  perform set_config('request.jwt.claims', '', true); perform set_config('role', 'anon', true);
  perform public._t_igual('anónimo: página pública sabe que no acepta reservas', public.negocio_acepta_reservas(n), false);
  perform public._t_igual('anónimo: otro negocio operativo sí acepta', public.negocio_acepta_reservas('00000000-0000-0000-0016-0000000001e0'), true);
  perform public._t_rechaza('anónimo no llama el estado detallado', format($q$select public.negocio_estado_operativo(%L)$q$, n), 'permission denied');
  perform public._t_rechaza('anónimo no llama la función interna', format($q$select public._estado_operativo_en(%L, now())$q$, n), 'permission denied');
  perform public._t_rechaza('anónimo no llama la guardia', format($q$select public._exigir_operativo(%L)$q$, n), 'permission denied');
  perform public._t_yo();

  -- Cumplir las citas previas: el profesional inicia y finaliza la cita que ya estaba confirmada
  perform public._t_como(bar);
  perform public._t_acepta('profesional: iniciar atención de cita previa', format($q$select public.iniciar_atencion_reserva(%L)$q$, c1));
  perform public._t_acepta('profesional: finalizar atención de cita previa', format($q$select public.finalizar_atencion_reserva(%L)$q$, c1));
  perform public._t_yo();
  perform public._t_igual('la atención previa quedó finalizada (checkout) con el negocio restringido', (select checkout_at is not null from public.reserva where id = c1), true);

  -- El dueño cobra otra cita previa en el POS (sin venta de productos) y cancela una tercera
  perform public._t_como(own);
  perform public._t_acepta('dueño: completar cita previa en el POS', format($q$select public.completar_venta_pos(%L, '[]'::jsonb, 'EFECTIVO', 0, 'EFECTIVO', 0)$q$, c3));
  perform public._t_acepta('dueño: cobrar en el POS la atención finalizada por el profesional', format($q$select public.completar_venta_pos(%L, '[]'::jsonb, 'EFECTIVO', 0, 'EFECTIVO', 0)$q$, c1));
  perform public._t_rechaza('dueño: POS con venta de productos nueva', format($q$select public.completar_venta_pos(%L, '[{"producto_id":"00000000-0000-0000-0016-00000000ffff","cantidad":1}]'::jsonb, 'EFECTIVO', 0, 'EFECTIVO', 0)$q$, c2), 'SUSCRIPCION_RESTRINGIDA');
  perform public._t_acepta('dueño: cancelar una cita previa', format($q$select public.cancelar_reserva(%L, 'cancelada por la barbería')$q$, c2));
  perform public._t_yo();
  select estado::text into est from public.reserva where id = c3;
  perform public._t_igual('POS: la cita previa quedó COMPLETADA', est, 'COMPLETADA');
  select estado::text into est from public.reserva where id = c2;
  perform public._t_igual('cancelar: la cita previa quedó CANCELADA', est, 'CANCELADA');
  perform public._t_igual('no se borró ninguna cita', (select count(*) from public.reserva where negocio_id = n), 4::bigint);
  perform public._t_igual('la cita 4 sigue confirmada en su fecha original', (select estado::text from public.reserva where id = c4), 'CONFIRMADA');
  raise notice 'OK 160-8: histórico, estado de pago, pagar y cumplir citas previas funcionan con el negocio restringido (y IDOR del estado)';
end $$;

-- ═════════════ 9 · Aislamiento: un negocio restringido NO bloquea a otro operativo ═════════════
do $$
declare nx uuid := '00000000-0000-0000-0016-0000000001e0'; intr text := '00000000-0000-0000-0016-0000000000d1';
begin
  perform public._t_dia_pagado(nx, 3);
  perform public._t_como(intr);
  perform public._t_acepta('otro negocio operativo sigue creando servicios', format($q$insert into public.servicio (negocio_id, nombre, duracion_minutos, precio_base) values (%L, 'Corte X', 30, 20000)$q$, nx));
  perform public._t_yo();
  -- IDOR: el dueño restringido NO puede tocar el negocio ajeno (RLS) aunque este esté operativo
  perform public._t_como('00000000-0000-0000-0016-0000000000a1');
  perform public._t_nunca('IDOR: crear servicio en el negocio ajeno', format($q$insert into public.servicio (negocio_id, nombre, duracion_minutos, precio_base) values (%L, 'Hack', 30, 1)$q$, nx));
  perform public._t_yo();
  raise notice 'OK 160-9: aislamiento entre negocios (el bloqueo es por negocio) e IDOR';
end $$;

-- ═════════════ 10 · Activación manual de SuperAdmin (090) sigue funcionando y desbloquea ═════════════
do $$
declare n uuid := '00000000-0000-0000-0016-0000000001a0'; su text := '00000000-0000-0000-0016-0000000000e1'; own text := '00000000-0000-0000-0016-0000000000a1'; s public.suscripcion;
begin
  perform public._t_dia_prueba(n, 15);
  perform public._t_igual('antes de la activación manual: bloqueado', public._t_op(n), false);
  perform public._t_como(own);
  perform public._t_rechaza('el dueño no puede activarse a sí mismo', format($q$select public.admin_activar_negocio_manual(%L, 'ACTIVA', 'ESSENTIAL', 'CORTESIA', 'me regalo días', 5, null)$q$, n), 'NO_AUTORIZADO');
  perform public._t_yo();
  perform public._t_como(su);
  s := public.admin_activar_negocio_manual(n, 'ACTIVA', 'ESSENTIAL', 'TRANSFERENCIA', 'Pago por transferencia verificado', 5, 'REF-160');
  perform public._t_yo();
  perform public._t_igual('activación manual: la vigencia usa la función central de fechas', s.manual_hasta, public.suscripcion_fecha_limite(now(), 5));
  perform public._t_igual('activación manual: opera', public._t_op(n), true);
  perform public._t_como(own);
  perform public._t_acepta('activación manual: ya puede crear servicios', format($q$insert into public.servicio (negocio_id, nombre, duracion_minutos, precio_base) values (%L, 'Con activación manual', 30, 10000)$q$, n));
  perform public._t_yo();
  update public.suscripcion set manual_hasta = now() - interval '1 minute' where negocio_id = n;
  perform public._t_igual('activación manual vencida: bloquea', public._t_op(n), false);
  perform public._t_como(su);
  s := public.admin_activar_negocio_manual(n, 'TRIAL', 'ESSENTIAL', 'CONTINGENCIA_PASARELA', 'Contingencia de la pasarela', 2, null);
  perform public._t_yo();
  perform public._t_igual('prueba manual: opera', public._t_op(n), true);
  perform public._t_igual('prueba manual: límite central', s.prueba_fin, public.suscripcion_fecha_limite(now(), 2));
  raise notice 'OK 160-10: activación manual de SuperAdmin (ACTIVA y TRIAL) opera y vence según la función central';
end $$;

-- ═════════════ 11 · Configuración SuperAdmin y estado por negocio ═════════════
do $$
declare su text := '00000000-0000-0000-0016-0000000000e1'; own text := '00000000-0000-0000-0016-0000000000a1'; c jsonb; r record; v_pago uuid := gen_random_uuid();
begin
  perform public._t_como(own);
  perform public._t_rechaza('dueño no lee la configuración', 'select public.config_suscripcion()', 'NO_AUTORIZADO');
  perform public._t_rechaza('dueño no cambia la configuración', $q$select public.admin_set_config_suscripcion(30, 0, true, 'intento del dueño')$q$, 'NO_AUTORIZADO');
  perform public._t_rechaza('dueño no lista estados operativos', $q$select * from public.admin_estado_operativo_negocios(array['00000000-0000-0000-0016-0000000001a0']::uuid[])$q$, 'NO_AUTORIZADO');
  perform public._t_yo();
  perform public._t_como(su);
  c := public.config_suscripcion();
  perform public._t_igual('config: periodo 30', (c->>'periodo_dias')::int, 30);
  perform public._t_igual('config: gracia del periodo pagado = 1', (c->>'gracia_dias')::int, 1);
  perform public._t_igual('config: gracia de la prueba = 0', (c->>'prueba_gracia_dias')::int, 0);
  perform public._t_rechaza('config: motivo obligatorio', $q$select public.admin_set_config_suscripcion(30, 0, true, 'x')$q$, 'MOTIVO_REQUERIDO');
  perform public._t_rechaza('config: periodo inválido', $q$select public.admin_set_config_suscripcion(0, 0, true, 'motivo suficiente')$q$, 'PERIODO_INVALIDO');
  perform public._t_acepta('config: SuperAdmin cambia el periodo', $q$select public.admin_set_config_suscripcion(28, 1, false, 'prueba de configuración 160')$q$);
  perform public._t_igual('config: periodo guardado', (select suscripcion_periodo_dias from public.configuracion_plataforma where id), 28);
  perform public._t_igual('config: auditada con motivo', (select count(*) from public.evento_auditoria where accion = 'CONFIG_SUSCRIPCION_ACTUALIZADA' and motivo = 'prueba de configuración 160'), 1::bigint);
  select * into r from public.admin_estado_operativo_negocios(array['00000000-0000-0000-0016-0000000001a0']::uuid[]);
  perform public._t_igual('SuperAdmin ve el estado operativo de la ficha', r.estado_operativo ? 'estado', true);
  perform public._t_yo();
  -- Con periodo de 28 días el siguiente pago dura 28 días (configurable sin tocar código)
  insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata)
  values (v_pago, '00000000-0000-0000-0016-0000000001b0', 'SUSCRIPCION', 139900, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('concepto', 'PLAN', 'plan_codigo_nuevo', 'STUDIO', 'ciclo', 'MENSUAL'));
  perform public._t_sistema();
  perform public.aplicar_evento_pago(v_pago, 'r160-pago-cfg', 'APROBADO', '{}'::jsonb);
  perform public._t_yo();
  perform public._t_igual('pago con periodo configurado a 28 días', (select fecha_proximo_cobro from public.suscripcion where negocio_id = '00000000-0000-0000-0016-0000000001b0'), public.suscripcion_fecha_limite(now(), 28));
  raise notice 'OK 160-11: configuración SuperAdmin (periodo, gracia de prueba, gracia opera) con motivo, auditoría y permisos';
end $$;

-- ═════════════ 12 · Privilegios de las funciones nuevas (no basta revocar a public: se revoca a los tres roles) ═════════════
do $$
declare f text; rol text;
begin
  foreach f in array array['public._estado_operativo_en(uuid,timestamptz)', 'public._exigir_operativo(uuid)', 'public._exigir_operativo_sede(uuid)', 'public._exigir_operativo_reserva(uuid)',
                           'public._exigir_operativo_reserva_sin_productos(uuid,jsonb)', 'public.trg_guardia_operativa()', 'public.trg_guardia_operativa_equipo()',
                           'public.trg_guardia_operativa_negocio()', 'public.trg_guardia_reprogramacion()'] loop
    foreach rol in array array['anon', 'authenticated'] loop
      if has_function_privilege(rol, f::regprocedure, 'execute') then raise exception 'FALLA privilegios: % puede ejecutar %', rol, f; end if;
    end loop;
  end loop;
  foreach f in array array['public.negocio_estado_operativo(uuid)', 'public.negocio_operativo(uuid)', 'public.config_suscripcion()',
                           'public.admin_set_config_suscripcion(integer,integer,boolean,text)', 'public.admin_estado_operativo_negocios(uuid[])'] loop
    if has_function_privilege('anon', f::regprocedure, 'execute') then raise exception 'FALLA privilegios: anon puede ejecutar %', f; end if;
  end loop;
  if not has_function_privilege('anon', 'public.negocio_acepta_reservas(uuid)'::regprocedure, 'execute') then raise exception 'FALLA: la página pública (anon) debe poder preguntar si el negocio acepta reservas'; end if;
  raise notice 'OK 160-12: privilegios de las funciones nuevas';
end $$;

rollback;
