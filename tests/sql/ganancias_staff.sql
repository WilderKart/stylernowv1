-- Prueba SQL de la migración 201 (ganancias del staff). Ejecutar contra la base local:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/ganancias_staff.sql
-- Todo ocurre en una transacción que se revierte al final. Usa identidades reales (auth.users) y suplanta con JWT + rol authenticated.
begin;

-- ── Identidades ──
-- Solo puede existir un SuperSU: dentro de esta transacción (se revierte) se cede el rol al agente de prueba.
update public.perfil set es_supersu = false where es_supersu;
insert into auth.users (id, email, aud, role) values
  ('a0000001-0000-4000-8000-000000000001', 'g_ownerA@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000002', 'g_b1@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000003', 'g_b2@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000004', 'g_sedeadmin@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000005', 'g_ownerB@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000006', 'g_b3@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000007', 'g_cliente@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000008', 'g_agente@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-000000000009', 'g_agente2@t.l', 'authenticated', 'authenticated'),
  ('a0000001-0000-4000-8000-00000000000a', 'g_adminsinperm@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('a0000001-0000-4000-8000-000000000001', 'Dueño A', false), ('a0000001-0000-4000-8000-000000000002', 'Barbero Uno', false),
  ('a0000001-0000-4000-8000-000000000003', 'Barbero Dos', false), ('a0000001-0000-4000-8000-000000000004', 'Admin Sede', false),
  ('a0000001-0000-4000-8000-000000000005', 'Dueño B', false), ('a0000001-0000-4000-8000-000000000006', 'Barbero Tres', false),
  ('a0000001-0000-4000-8000-000000000007', 'Cliente Prueba', false), ('a0000001-0000-4000-8000-000000000008', 'Agente Soporte', true),
  ('a0000001-0000-4000-8000-000000000009', 'Agente Dos', false), ('a0000001-0000-4000-8000-00000000000a', 'Admin Sin Permiso', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = excluded.es_supersu;
insert into public.staff (usuario_id, nombre) values
  ('a0000001-0000-4000-8000-000000000002', 'Barbero Uno'), ('a0000001-0000-4000-8000-000000000003', 'Barbero Dos'),
  ('a0000001-0000-4000-8000-000000000004', 'Admin Sede'), ('a0000001-0000-4000-8000-000000000006', 'Barbero Tres'),
  ('a0000001-0000-4000-8000-00000000000a', 'Admin Sin Permiso')
on conflict (usuario_id) do nothing;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000001', 'Neg A', 'gan-neg-a-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO'),
  ('b0000001-0000-4000-8000-00000000000b', 'a0000001-0000-4000-8000-000000000005', 'Neg B', 'gan-neg-b-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('b0000001-0000-4000-8000-00000000000a', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('b0000001-0000-4000-8000-00000000000b', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
delete from public.sede where negocio_id in ('b0000001-0000-4000-8000-00000000000a', 'b0000001-0000-4000-8000-00000000000b');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('c0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-00000000000a', 'Sede 1', 'Calle 1', 'Cali', '{}'::jsonb, true),
  ('c0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-00000000000a', 'Sede 2', 'Calle 2', 'Cali', '{}'::jsonb, false),
  ('c0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-00000000000b', 'Sede B', 'Calle 3', 'Cali', '{}'::jsonb, true);
insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, comision_pct, es_admin, presta_servicios) values
  ('a0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000001', 'ACTIVO', 40, false, true),
  ('a0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000002', 'ACTIVO', null, false, true),
  ('a0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000001', 'ACTIVO', null, true, false),
  ('a0000001-0000-4000-8000-00000000000a', 'b0000001-0000-4000-8000-00000000000a', null, 'ACTIVO', null, true, false),
  ('a0000001-0000-4000-8000-000000000006', 'b0000001-0000-4000-8000-00000000000b', 'c0000001-0000-4000-8000-000000000003', 'ACTIVO', 50, false, true);
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('d0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-00000000000a', 'Corte', 30, 40000, 'ACTIVO'),
  ('d0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-00000000000a', 'Tinte', 60, 100000, 'ACTIVO'),
  ('d0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-00000000000b', 'Corte B', 30, 30000, 'ACTIVO');

-- Reservas (R1: B1 corte+tinte con 10.000 de descuento; R2: B2 sin regla; R3: negocio B)
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('e0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002', now() - interval '3 hours', now() - interval '2 hours', 'EN_CURSO', 130000, 0),
  ('e0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000003', now() - interval '2 hours', now() - interval '1 hour', 'EN_CURSO', 40000, 0),
  ('e0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-00000000000b', 'c0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000006', now() - interval '2 hours', now() - interval '1 hour', 'EN_CURSO', 30000, 0);
insert into public.reserva_servicio (reserva_id, servicio_id, precio_congelado_unitario) values
  ('e0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001', 40000),
  ('e0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000002', 100000),
  ('e0000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000001', 40000),
  ('e0000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000003', 30000);

-- ── 1. Generación automática (como lo haría completar_venta_pos: cambia el estado) ──
do $$
declare n int; c numeric; d numeric;
begin
  update public.reserva set estado = 'COMPLETADA' where id in ('e0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000003');
  select count(*), sum(comision), sum(descuento) into n, c, d from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000001';
  if n <> 2 then raise exception 'FALLA: R1 debía generar 2 registros, generó %', n; end if;
  if d <> 10000 then raise exception 'FALLA: descuento prorrateado % (esperado 10000)', d; end if;
  -- 40 % sobre neto: (40000+100000-10000) * 0.40 = 52000
  if c <> 52000 then raise exception 'FALLA: comisión R1 % (esperado 52000)', c; end if;
  if (select estado_comision from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000002') <> 'SIN_REGLA' then raise exception 'FALLA: R2 debía quedar SIN_REGLA'; end if;
  if not exists (select 1 from public.ganancia_novedad where tipo = 'SERVICIO_SIN_REGLA' and negocio_id = 'b0000001-0000-4000-8000-00000000000a') then raise exception 'FALLA: sin novedad SERVICIO_SIN_REGLA'; end if;
  -- Idempotencia: reprocesar, reabrir y completar de nuevo no duplica
  if public._ganancia_generar('e0000001-0000-4000-8000-000000000001') <> 0 then raise exception 'FALLA: reprocesar duplicó'; end if;
  update public.reserva set estado = 'EN_CURSO' where id = 'e0000001-0000-4000-8000-000000000001';
  update public.reserva set estado = 'COMPLETADA' where id = 'e0000001-0000-4000-8000-000000000001';
  if (select count(*) from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000001') <> 2 then raise exception 'FALLA: reabrir/completar duplicó'; end if;
  if (select count(*) from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000001' and estado_comision = 'EN_REVISION') <> 2 then raise exception 'FALLA: reabrir no dejó en revisión'; end if;
  update public.staff_ganancia set estado_comision = 'PENDIENTE' where reserva_id = 'e0000001-0000-4000-8000-000000000001';   -- (como lo resolvería el negocio)
  -- Inmutabilidad: nadie reescribe valores ni borra directo (ni siquiera el dueño de la base)
  begin update public.staff_ganancia set comision = 1 where reserva_id = 'e0000001-0000-4000-8000-000000000001'; raise exception 'FALLA: se pudo reescribir la comisión';
  exception when others then if sqlerrm not like '%REGISTRO_FINANCIERO_INMUTABLE%' then raise; end if; end;
  begin delete from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000001'; raise exception 'FALLA: se pudo borrar';
  exception when others then if sqlerrm not like '%REGISTRO_FINANCIERO_NO_SE_BORRA%' then raise; end if; end;
end $$;

-- ── 2. Reglas: jerarquía, solape y permisos ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 30, 'NETO', 'intento sin permiso'); raise exception 'FALLA: admin sin permiso creó una regla';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.ganancias_listar('b0000001-0000-4000-8000-00000000000a'); 
    if (public.ganancias_listar('b0000001-0000-4000-8000-00000000000a') ->> 'total')::int <> 0 then raise exception 'FALLA: admin sin permiso ve ganancias'; end if;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare v_gen uuid; v_esp uuid; v_prev jsonb;
begin
  v_gen := public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 30, 'NETO', 'regla general del negocio');
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 35, 'NETO', 'solapada con la general'); raise exception 'FALLA: permitió reglas solapadas';
  exception when others then if sqlerrm not like '%REGLA_SOLAPADA%' then raise; end if; end;
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000b', 30, 'NETO', 'negocio ajeno'); raise exception 'FALLA: creó regla en negocio ajeno';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 150, 'NETO', 'porcentaje fuera de rango'); raise exception 'FALLA: aceptó 150 por ciento';
  exception when others then if sqlerrm not like '%PORCENTAJE_INVALIDO%' then raise; end if; end;
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 20, 'NETO', 'servicio de otro negocio', null, null, 'd0000001-0000-4000-8000-000000000003');
    raise exception 'FALLA: aceptó un servicio de otro negocio';
  exception when others then if sqlerrm not like '%SERVICIO_INVALIDO%' then raise; end if; end;
  -- Específica (staff + servicio, base precio original) gana a la general
  v_esp := public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 50, 'PRECIO_ORIGINAL', 'tinte de Barbero Uno', null, 'a0000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000002');
  v_prev := public.comision_previsualizar('b0000001-0000-4000-8000-00000000000a', 100000, 10000, 50, 'PRECIO_ORIGINAL');
  if (v_prev ->> 'comision_profesional')::numeric <> 50000 or (v_prev ->> 'participacion_negocio')::numeric <> 40000 then raise exception 'FALLA: previsualización %', v_prev; end if;
  -- Versionado: reemplazar crea versión 2 y desactiva la 1
  perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 45, 'PRECIO_ORIGINAL', 'ajuste de la regla específica', null, 'a0000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000002', null, null, null, v_esp);
  if (select count(*) from public.comision_regla where servicio_id = 'd0000001-0000-4000-8000-000000000002' and estado = 'ACTIVA' and version = 2) <> 1 then raise exception 'FALLA: versionado'; end if;
  if (select estado from public.comision_regla where id = v_esp) <> 'INACTIVA' then raise exception 'FALLA: la versión anterior debía quedar inactiva'; end if;
end $$;

-- ── 3. Nueva reserva usa la regla (45 % del precio original del tinte = 45000) y las ya generadas NO cambian ──
reset role;
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('e0000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002', now() - interval '1 hour', now(), 'EN_CURSO', 100000, 0);
insert into public.reserva_servicio values ('e0000001-0000-4000-8000-000000000004', 'd0000001-0000-4000-8000-000000000002', 100000);
update public.reserva set estado = 'COMPLETADA' where id = 'e0000001-0000-4000-8000-000000000004';
do $$ begin
  if (select comision from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000004') <> 45000 then raise exception 'FALLA: la regla específica no se aplicó'; end if;
  if (select sum(comision) from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000001') <> 52000 then raise exception 'FALLA: cambiar reglas alteró comisiones ya generadas'; end if;
end $$;

-- ── 3b. Flujo REAL: el profesional completa en el POS y la comisión nace sola (sin tocar la tabla a mano) ──
insert into public.reserva (id, cliente_id, negocio_id, sede_id, staff_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('e0000001-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000007', 'b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002', now(), now() + interval '30 minutes', 'EN_CURSO', 40000, 0);
insert into public.reserva_servicio values ('e0000001-0000-4000-8000-000000000005', 'd0000001-0000-4000-8000-000000000001', 40000);
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.completar_venta_pos('e0000001-0000-4000-8000-000000000005') is not null as pos_ok;
reset role;
do $$ begin
  if (select comision from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000005') <> 12000 then raise exception 'FALLA: el POS no generó la comisión (regla general 30 por ciento de 40000)'; end if;
  perform public._ganancia_generar('e0000001-0000-4000-8000-000000000005');
  if (select count(*) from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000005') <> 1 then raise exception 'FALLA: duplicado tras POS'; end if;
  delete from public.staff_ganancia where reserva_id = 'e0000001-0000-4000-8000-000000000005' and false;
end $$;

-- ── 4. Aislamiento: profesional, otro negocio, admin de sede ──
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  -- B1 pide los de B2 y el negocio entero: solo recibe los suyos
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000a', null, 'a0000001-0000-4000-8000-000000000003');
  if exists (select 1 from jsonb_array_elements(r -> 'filas') f where f ->> 'staff_id' <> 'a0000001-0000-4000-8000-000000000002') then raise exception 'FALLA: B1 ve registros de otro profesional'; end if;
  if (r ->> 'total')::int <> 4 then raise exception 'FALLA: B1 debía ver sus 4 registros, ve %', r ->> 'total'; end if;
  if (r -> 'filas' -> 0) ? 'cliente_id' then raise exception 'FALLA: se expone cliente_id'; end if;
  r := public.ganancias_resumen('b0000001-0000-4000-8000-00000000000a');
  if (r ->> 'participacion_negocio') is not null then raise exception 'FALLA: el profesional ve la participación del negocio'; end if;
  -- RLS directo
  if (select count(*) from public.staff_ganancia) <> 4 then raise exception 'FALLA: RLS directa, B1 ve % filas', (select count(*) from public.staff_ganancia); end if;
  if (select count(*) from public.ganancia_novedad) <> 0 then raise exception 'FALLA: B1 ve novedades'; end if;
  if (select count(*) from public.comision_regla) <> 0 then raise exception 'FALLA: B1 ve reglas'; end if;
  -- Sin escritura directa ni RPC de gestión
  begin insert into public.staff_ganancia (negocio_id, staff_id, reserva_id, servicio_id, servicio_nombre, precio_original, valor_neto, participacion_negocio, fecha_local)
    values ('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000004', 'd0000001-0000-4000-8000-000000000001', 'x', 1, 1, 1, current_date);
    raise exception 'FALLA: B1 insertó directo';
  exception when insufficient_privilege then null; end;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date, current_date); raise exception 'FALLA: B1 liquidó';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.ganancia_ajustar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', 99999, 'ajuste a mi favor'); raise exception 'FALLA: B1 se ajustó';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.ganancias_detectar_novedades('b0000001-0000-4000-8000-00000000000a'); raise exception 'FALLA: B1 detectó novedades';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.ganancia_permiso_definir('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, '{"ver":true,"liquidar":true}'::jsonb); raise exception 'FALLA: B1 se dio permisos';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;

reset role;
-- B3 (negocio B) y dueño B: no ven nada del negocio A
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000a');
  if (r ->> 'total')::int <> 0 then raise exception 'FALLA: dueño B ve ganancias del negocio A (%)', r ->> 'total'; end if;
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000b');
  if (r ->> 'total')::int <> 1 then raise exception 'FALLA: dueño B debía ver 1 registro propio'; end if;
  if (select count(*) from public.staff_ganancia where negocio_id = 'b0000001-0000-4000-8000-00000000000a') <> 0 then raise exception 'FALLA: RLS cruzada'; end if;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date, current_date); raise exception 'FALLA: dueño B liquidó en A';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;

-- Admin de sede: permiso explícito limitado a Sede 1
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.ganancia_permiso_definir('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000001', '{"ver":true,"liquidar":true}'::jsonb);
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000a');
  if exists (select 1 from jsonb_array_elements(r -> 'filas') f where f ->> 'sede_id' <> 'c0000001-0000-4000-8000-000000000001') then raise exception 'FALLA: admin de sede ve otra sede'; end if;
  if (r ->> 'total')::int <> 4 then raise exception 'FALLA: admin de sede debía ver las 4 de su sede, ve %', r ->> 'total'; end if;
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000a', 'c0000001-0000-4000-8000-000000000002');   -- pide la otra sede
  if (r ->> 'total')::int <> 0 then raise exception 'FALLA: cambiando la sede ve registros ajenos'; end if;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000003', 'c0000001-0000-4000-8000-000000000002', 'DIARIO', current_date, current_date); raise exception 'FALLA: liquidó en otra sede';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date, current_date); raise exception 'FALLA: liquidó todo el negocio con permiso de una sede';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 10, 'NETO', 'sin permiso de configurar', 'c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000002');
    raise exception 'FALLA: admin de sede configuró reglas';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;

-- ── 5. Liquidación: cierre, doble cierre, pagos parciales, idempotencia, reversión ──
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_liq uuid; v_p1 uuid; v_p2 uuid; l public.ganancia_liquidacion; v_aj uuid;
begin
  v_aj := public.ganancia_ajustar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', -2000, 'descuento por producto dañado');
  v_liq := public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date - 1, current_date);
  select * into l from public.ganancia_liquidacion where id = v_liq;
  -- 52000 (R1) + 45000 (R4) + 12000 (R5 por POS) - 2000 = 107000
  if l.total_neto <> 107000 or l.servicios <> 4 then raise exception 'FALLA: liquidación % / % servicios', l.total_neto, l.servicios; end if;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date - 1, current_date); raise exception 'FALLA: se liquidó dos veces';
  exception when others then if sqlerrm not like '%SIN_REGISTROS_PENDIENTES%' then raise; end if; end;
  v_p1 := public.liquidacion_registrar_pago(v_liq, 40000, 'EFECTIVO', null, null, null, null, 'clave-1');
  if public.liquidacion_registrar_pago(v_liq, 40000, 'EFECTIVO', null, null, null, null, 'clave-1') <> v_p1 then raise exception 'FALLA: doble clic duplicó el pago'; end if;
  begin perform public.liquidacion_registrar_pago(v_liq, 70000, 'EFECTIVO'); raise exception 'FALLA: pagó más del saldo';
  exception when others then if sqlerrm not like '%MONTO_INVALIDO%' then raise; end if; end;
  begin perform public.liquidacion_revertir(v_liq, 'intento de revertir con pagos'); raise exception 'FALLA: revirtió con pagos registrados';
  exception when others then if sqlerrm not like '%ANULA_LOS_PAGOS_PRIMERO%' then raise; end if; end;
  if (select estado from public.ganancia_liquidacion where id = v_liq) <> 'PAGADA_PARCIAL' then raise exception 'FALLA: estado tras pago parcial'; end if;
  v_p2 := public.liquidacion_registrar_pago(v_liq, 67000, 'TRANSFERENCIA', 'REF-1');
  if (select estado from public.ganancia_liquidacion where id = v_liq) <> 'PAGADA' then raise exception 'FALLA: estado tras pago total'; end if;
  perform public.ganancia_pago_anular(v_p2, 'se pagó a la cuenta equivocada');
  if (select pagado from public.ganancia_liquidacion where id = v_liq) <> 40000 then raise exception 'FALLA: saldo tras anular'; end if;
  perform public.ganancia_pago_anular(v_p1, 'pago registrado por error');
  perform public.liquidacion_revertir(v_liq, 'cierre con período equivocado');
  if (select count(*) from public.staff_ganancia where staff_id = 'a0000001-0000-4000-8000-000000000002' and estado_comision = 'PENDIENTE') <> 4 then raise exception 'FALLA: revertir no liberó los registros'; end if;
  if (select liquidacion_id from public.ganancia_ajuste where id = v_aj) is not null then raise exception 'FALLA: revertir no liberó el ajuste'; end if;
  perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'PERSONALIZADO', current_date - 1, current_date);   -- se puede volver a cerrar
  if (select count(*) from public.evento_auditoria where negocio_id = 'b0000001-0000-4000-8000-00000000000a' and accion in ('LIQUIDACION_CERRADA', 'LIQUIDACION_REVERTIDA', 'PAGO_LIQUIDACION_REGISTRADO', 'PAGO_LIQUIDACION_ANULADO', 'COMISION_AJUSTADA', 'REGLA_COMISION_CREADA')) < 8 then raise exception 'FALLA: auditoría incompleta'; end if;
end $$;

-- Novedades y revisión
do $$
declare n int;
begin
  n := public.ganancias_detectar_novedades('b0000001-0000-4000-8000-00000000000a');
  if public.ganancias_detectar_novedades('b0000001-0000-4000-8000-00000000000a') <> 0 then raise exception 'FALLA: detectar duplicó novedades'; end if;
  perform public.ganancia_novedad_gestionar((select id from public.ganancia_novedad where tipo = 'SERVICIO_SIN_REGLA' limit 1), 'EN_REVISION');
  begin perform public.ganancia_novedad_gestionar((select id from public.ganancia_novedad where tipo = 'SERVICIO_SIN_REGLA' limit 1), 'DESCARTADA', 'corto'); raise exception 'FALLA: descartó sin justificación';
  exception when others then if sqlerrm not like '%JUSTIFICACION_REQUERIDA%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rev uuid; v_otra uuid;
begin
  select id into v_otra from public.staff_ganancia where staff_id = 'a0000001-0000-4000-8000-000000000003' limit 1;   -- RLS: no la ve
  if v_otra is not null then raise exception 'FALLA: B1 ve la ganancia de B2'; end if;
  v_rev := public.revision_solicitar('GANANCIA', (select id from public.staff_ganancia limit 1), 'No coincide el porcentaje con lo acordado');
  begin perform public.revision_solicitar('GANANCIA', (select objeto_id from public.ganancia_revision where id = v_rev), 'segunda solicitud para el mismo registro'); raise exception 'FALLA: permitió dos solicitudes abiertas';
  exception when others then if sqlerrm not like '%YA_HAY_UNA_SOLICITUD_ABIERTA%' then raise; end if; end;
  begin perform public.revision_responder(v_rev, 'APROBADA', 'me apruebo solo'); raise exception 'FALLA: B1 respondió su propia revisión';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  -- B2 (otro profesional) intenta revisar un registro de B1: no se revela
  perform set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;
  begin perform public.revision_solicitar('GANANCIA', (select g.id from public.staff_ganancia g where g.staff_id = 'a0000001-0000-4000-8000-000000000002' limit 1), 'intento sobre registro ajeno');
    raise exception 'FALLA: B2 pidió revisión de un registro ajeno'; -- (RLS ya lo oculta; si llegara aquí sería un fallo)
  exception when others then if sqlerrm not like '%NO_ENCONTRADO%' and sqlerrm not like '%invalid input%' and sqlerrm not like '%null%' then raise; end if; end;
  reset role;
end $$;

-- ── 6. Soporte (SuperSU): sin autorización no lee; con autorización lee, no escribe; expira; un solo agente ──
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (public.ganancias_listar('b0000001-0000-4000-8000-00000000000a') ->> 'total')::int <> 0 then raise exception 'FALLA: SuperSU lee ganancias sin sesión autorizada'; end if;
  if (select count(*) from public.staff_ganancia) <> 0 then raise exception 'FALLA: SuperSU lee por RLS sin sesión'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.soporte_ganancias_solicitar('b0000001-0000-4000-8000-00000000000a', 'Revisar por qué no cuadra la liquidación') as acceso \gset
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin perform public.soporte_ganancias_tomar((select id from public.soporte_acceso_ganancias limit 1)); raise exception 'FALLA: tomó un acceso sin autorización del propietario';
  exception when others then if sqlerrm not like '%ACCESO_NO_VIGENTE%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.soporte_ganancias_autorizar(:'acceso', 30);
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;
select public.soporte_ganancias_tomar(:'acceso');
do $$
declare r jsonb;
begin
  r := public.ganancias_listar('b0000001-0000-4000-8000-00000000000a');
  if (r ->> 'total')::int <> 5 or r ->> 'modo' <> 'SOPORTE' then raise exception 'FALLA: el agente autorizado debía leer el negocio (total %, modo %)', r ->> 'total', r ->> 'modo'; end if;
  if (select count(*) from public.staff_ganancia where negocio_id = 'b0000001-0000-4000-8000-00000000000b') <> 0 then raise exception 'FALLA: el acceso se extendió a otro negocio'; end if;
  if (public.ganancias_listar('b0000001-0000-4000-8000-00000000000b') ->> 'total')::int <> 0 then raise exception 'FALLA: soporte lee el negocio B'; end if;
  -- solo lectura: ninguna escritura
  begin perform public.ganancia_ajustar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', 1000, 'ajuste desde soporte no permitido'); raise exception 'FALLA: soporte ajustó';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.liquidacion_cerrar('b0000001-0000-4000-8000-00000000000a', 'a0000001-0000-4000-8000-000000000002', null, 'DIARIO', current_date - 1, current_date); raise exception 'FALLA: soporte liquidó';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  begin perform public.comision_regla_crear('b0000001-0000-4000-8000-00000000000a', 1, 'NETO', 'soporte no puede crear reglas'); raise exception 'FALLA: soporte creó una regla';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  if (select count(*) from public.evento_auditoria where accion = 'SOPORTE_LECTURA_GANANCIAS') < 1 then raise exception 'FALLA: la lectura de soporte no quedó auditada'; end if;
end $$;
-- otro agente no puede tomar la sesión
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000009","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin perform public.soporte_ganancias_tomar((select id from public.soporte_acceso_ganancias limit 1)); raise exception 'FALLA: otro agente tomó la sesión';
  exception when others then if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if; end;
  if (public.ganancias_listar('b0000001-0000-4000-8000-00000000000a') ->> 'total')::int <> 0 then raise exception 'FALLA: otro agente lee con la sesión ajena'; end if;
end $$;
-- expiración automática: no depende de que alguien la cierre
reset role;
update public.soporte_acceso_ganancias set expira_at = now() - interval '1 minute';
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (public.ganancias_listar('b0000001-0000-4000-8000-00000000000a') ->> 'total')::int <> 0 then raise exception 'FALLA: el acceso expirado sigue leyendo'; end if;
end $$;

-- El profesional no puede tocar la auditoría ni la tabla de soporte
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000001-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  begin delete from public.evento_auditoria where negocio_id = 'b0000001-0000-4000-8000-00000000000a'; 
    if exists (select 1 from public.evento_auditoria where negocio_id = 'b0000001-0000-4000-8000-00000000000a' and accion = 'LIQUIDACION_CERRADA') and (select count(*) from public.soporte_acceso_ganancias) > 0 then raise exception 'FALLA: B1 ve el acceso de soporte'; end if;
  exception when insufficient_privilege then null; end;
end $$;

rollback;
select 'OK ganancias_staff' as resultado;
