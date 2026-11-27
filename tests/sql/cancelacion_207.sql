-- Prueba de la migración 207: cancelación del negocio con mínimo 2 h y devolución con pago completo.
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/cancelacion_207.sql
-- Transacción que se revierte al final; contra la base LOCAL.
begin;

grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;

insert into auth.users (id, email, aud, role) values
  ('c2070000-0000-4000-8000-0000000000a1', 'c207_dueno@t.l', 'authenticated', 'authenticated'),
  ('c2070000-0000-4000-8000-0000000000a2', 'c207_cliente@t.l', 'authenticated', 'authenticated'),
  ('c2070000-0000-4000-8000-0000000000a3', 'c207_su@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('c2070000-0000-4000-8000-0000000000a1', 'Dueño'), ('c2070000-0000-4000-8000-0000000000a2', 'Cliente'),
  ('c2070000-0000-4000-8000-0000000000a3', 'SuperSU')
on conflict (id) do nothing;
-- Solo puede haber un Super Admin (índice único): se usa el que ya exista; si no hay, se marca el de la prueba.
update public.perfil set es_supersu = true where id = 'c2070000-0000-4000-8000-0000000000a3'
  and not exists (select 1 from public.perfil where es_supersu);

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('c2070000-0000-4000-8000-0000000000b1', 'c2070000-0000-4000-8000-0000000000a1', 'Neg 207', 'neg-207-test', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
values ('c2070000-0000-4000-8000-0000000000c1', 'c2070000-0000-4000-8000-0000000000b1', 'Principal', 'Cra 1', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = 'c2070000-0000-4000-8000-0000000000b1';
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('c2070000-0000-4000-8000-0000000000b1', 'CONECTADA', 'SANDBOX', '123456789', 'v1.iv.tag.datos', now() + interval '180 days', now());
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado)
values ('c2070000-0000-4000-8000-0000000000e1', 'c2070000-0000-4000-8000-0000000000b1', 'Corte', 30, 30000, 'ACTIVO');

-- Anticipo fijo de 10.000 y se cobra el servicio completo en la app. Ventanas por defecto: 24 h / 2 h / 50 %.
update public.negocio set anticipo_modo = 'OBLIGATORIO', sena_monto_fijo = 10000, sena_pct = null, sena_minimo = 0,
       sena_maximo = 1000000, pago_completo_en_app = true
 where id = 'c2070000-0000-4000-8000-0000000000b1';

-- d1: faltan 30 h (cliente → 100 %) · d2: 10 h (50 %) · d3: 1 h (0 %) · d4: cancela el negocio con 5 h · d5: negocio con 1 h
-- d6: negocio con 1 h pero cancela el Super Admin · d7: sin pago completo (comportamiento de siempre) · d8: no presentado
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
select ('c2070000-0000-4000-8000-0000000000d' || n)::uuid, 'c2070000-0000-4000-8000-0000000000a2', 'c2070000-0000-4000-8000-0000000000b1',
       'c2070000-0000-4000-8000-0000000000c1', now() + h, now() + h + interval '1 hour', 'CONFIRMADA', 30000, 30000
  from (values (1, interval '30 hours'), (2, interval '10 hours'), (3, interval '1 hour'), (4, interval '5 hours'),
               (5, interval '1 hour'), (6, interval '1 hour'), (7, interval '10 hours'), (8, interval '1 hour')) v(n, h);
insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario)
select id, 'c2070000-0000-4000-8000-0000000000e1', 30000 from public.reserva where negocio_id = 'c2070000-0000-4000-8000-0000000000b1';

do $$ begin
  if (select count(*) from public.reserva where negocio_id = 'c2070000-0000-4000-8000-0000000000b1' and monto_anticipo_base = 10000) <> 8 then
    raise exception 'FALLA 207: el anticipo base no se calculó (10000) en las 8 reservas';
  end if;
  raise notice 'OK 207: anticipo base 10000 guardado al reservar con pago completo';
end $$;

-- d7 simula una reserva sin anticipo base (negocio que no cobraba el total, o anterior a la 207): pagó solo 10.000.
update public.reserva set monto_anticipo_base = null, monto_sena = 10000 where id = 'c2070000-0000-4000-8000-0000000000d7';

-- Pagos aprobados de la pasarela (sin pasar por la aceptación de política: se inserta como administrador de la base).
set local session_replication_role = replica;
insert into public.pago (reserva_id, negocio_id, tipo, monto, estado, id_transaccion_pasarela, comision_plataforma_monto)
select id, negocio_id, 'SENA', case when id = 'c2070000-0000-4000-8000-0000000000d7' then 10000 else 30000 end, 'APROBADO', 'mp-' || id, 0
  from public.reserva where negocio_id = 'c2070000-0000-4000-8000-0000000000b1';
set local session_replication_role = origin;

create or replace function pg_temp.esperado(p_reserva text, p_monto numeric, p_pct numeric) returns void language plpgsql as $$
declare r jsonb;
begin
  r := public.cancelar_reserva(('c2070000-0000-4000-8000-0000000000d' || p_reserva)::uuid, null);
  if (r->>'reembolso_monto')::numeric <> p_monto or (r->>'reembolso_pct')::numeric <> p_pct then
    raise exception 'FALLA 207 (d%): se esperaba % / % %%, llegó %', p_reserva, p_monto, p_pct, r;
  end if;
  raise notice 'OK 207 d%: devuelve % (pct de política %)', p_reserva, p_monto, p_pct;
end $$;
grant execute on function pg_temp.esperado(text, numeric, numeric) to authenticated;

-- ── Cliente ────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2070000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select pg_temp.esperado('1', 30000, 100);   -- 100 %: todo
select pg_temp.esperado('2', 25000, 50);    -- 50 % del anticipo: 20.000 + 5.000
select pg_temp.esperado('3', 20000, 0);     -- perdió el anticipo: solo el resto del servicio
select pg_temp.esperado('7', 5000, 50);     -- sin anticipo base: pagó 10.000 y es el anticipo → 50 % como siempre
reset role;

-- ── Negocio ────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2070000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select pg_temp.esperado('4', 30000, 100);   -- con 5 h puede cancelar y se devuelve todo
do $$ begin
  begin
    perform public.cancelar_reserva('c2070000-0000-4000-8000-0000000000d5', null);
    raise exception 'FALLA 207: el negocio canceló con 1 h de anticipación';
  exception when others then
    if sqlerrm not like '%CANCELACION_NEGOCIO_MUY_TARDE%' then raise; end if;
  end;
  if (select estado from public.reserva where id = 'c2070000-0000-4000-8000-0000000000d5') <> 'CONFIRMADA' then
    raise exception 'FALLA 207: la reserva cambió de estado pese al rechazo';
  end if;
  raise notice 'OK 207: el negocio no puede cancelar con menos de 2 h';
end $$;
reset role;

-- El motivo no sirve de llave: pasar «Negocio suspendido…» no salta la regla mientras el negocio siga activo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2070000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.cancelar_reserva('c2070000-0000-4000-8000-0000000000d5', 'Negocio suspendido: truco');
    raise exception 'FALLA 207: un motivo falso saltó la regla de 2 h';
  exception when others then
    if sqlerrm not like '%CANCELACION_NEGOCIO_MUY_TARDE%' then raise; end if;
  end;
  raise notice 'OK 207: el texto del motivo no salta la regla';
end $$;
reset role;

-- Cascada real: con el negocio ya suspendido se cancela aunque falte menos de 2 h (como lo hace suspender_negocio).
update public.negocio set estado = 'SUSPENDIDO' where id = 'c2070000-0000-4000-8000-0000000000b1';
select set_config('c207.su', (select id::text from public.perfil where es_supersu limit 1), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2070000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select pg_temp.esperado('5', 30000, 100);
reset role;
update public.negocio set estado = 'PENDIENTE_APROBACION' where id = 'c2070000-0000-4000-8000-0000000000b1';

-- ── Super Admin: queda fuera de la regla de 2 h ────────────────────────────
select set_config('c207.su', (select id::text from public.perfil where es_supersu limit 1), true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('c207.su'), 'role', 'authenticated')::text, true);
select pg_temp.esperado('6', 30000, 100);
reset role;

-- ── No presentación: el negocio se queda con el anticipo y devuelve el resto ──
update public.reserva set hora_inicio = now() - interval '10 minutes', hora_fin = now() + interval '20 minutes'
 where id = 'c2070000-0000-4000-8000-0000000000d8';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2070000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select public.marcar_no_show('c2070000-0000-4000-8000-0000000000d8', null);
reset role;
do $$ begin
  if (select monto from public.reembolso where reserva_id = 'c2070000-0000-4000-8000-0000000000d8') <> 20000 then
    raise exception 'FALLA 207: la no presentación debía devolver 20000 (el resto del servicio)';
  end if;
  raise notice 'OK 207: no presentación devuelve 20000 y retiene el anticipo de 10000';
end $$;

rollback;
