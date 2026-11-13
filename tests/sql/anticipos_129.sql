-- Pruebas de la migración 129 (motor de anticipos y entorno del pago).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/anticipos_129.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK.

begin;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;
revoke all on public.conexion_pago_negocio, public.oauth_estado, public.conexion_pago_evento from authenticated, anon;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'duenoA@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'cliente@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'duenoB@t.l', 'authenticated', 'authenticated');
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, sena_pct, sena_minimo, sena_maximo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 'ant-a', 'Cali', 'CO', 20, 5000, 100000);
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000000000b1', 'CONECTADA', 'SANDBOX', '111', 'v1.a.b.c', now() + interval '180 days', now());
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Corte', 30, 40000, 'ACTIVO'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', 'Tinte', 60, 100000, 'ACTIVO');

-- ── Cálculo ──────────────────────────────────────────────────────────────
do $$
declare v numeric;
begin
  -- Sin reglas por servicio = regla del negocio (20 % de 140.000 = 28.000).
  v := public.calcular_sena_servicios('00000000-0000-0000-0000-0000000000b1',
        array['00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2']::uuid[], 140000);
  if v <> 28000 then raise exception 'FALLA 129: esperado 28000 sin reglas por servicio, fue %', v; end if;

  -- Tinte con anticipo fijo 50.000; Corte sin regla → 20 % de 40.000 = 8.000. Total 58.000.
  update public.servicio set anticipo_monto_fijo = 50000 where id = '00000000-0000-0000-0000-0000000000e2';
  v := public.calcular_sena_servicios('00000000-0000-0000-0000-0000000000b1',
        array['00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2']::uuid[], 140000);
  if v <> 58000 then raise exception 'FALLA 129: esperado 58000 con regla por servicio, fue %', v; end if;

  -- El máximo del negocio manda.
  update public.negocio set sena_maximo = 30000 where id = '00000000-0000-0000-0000-0000000000b1';
  v := public.calcular_sena_servicios('00000000-0000-0000-0000-0000000000b1',
        array['00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2']::uuid[], 140000);
  if v <> 30000 then raise exception 'FALLA 129: el máximo no se aplicó: %', v; end if;

  -- Un servicio de OTRO negocio no influye (no se mezclan reglas entre negocios).
  v := public.calcular_sena_servicios('00000000-0000-0000-0000-0000000000b1', array[gen_random_uuid()]::uuid[], 40000);
  if v <> 8000 then raise exception 'FALLA 129: un id ajeno alteró el cálculo: %', v; end if;

  -- Modo NINGUNO = 0.
  update public.negocio set anticipo_modo = 'NINGUNO' where id = '00000000-0000-0000-0000-0000000000b1';
  if public.calcular_sena_servicios('00000000-0000-0000-0000-0000000000b1', array['00000000-0000-0000-0000-0000000000e1']::uuid[], 40000) <> 0 then
    raise exception 'FALLA 129: modo NINGUNO cobró anticipo';
  end if;
  update public.negocio set anticipo_modo = 'OBLIGATORIO', sena_maximo = 100000 where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice 'OK 129: cálculo por negocio, por servicio, máximo, aislamiento y modo NINGUNO';
end $$;

do $$ begin
  if position('calcular_sena_servicios' in pg_get_functiondef('public.crear_reserva(uuid,uuid[],timestamptz,uuid,text)'::regprocedure)) = 0 then
    raise exception 'FALLA 129: crear_reserva no usa el cálculo por servicio';
  end if;
  raise notice 'OK 129: crear_reserva usa el motor nuevo';
end $$;

-- ── Configuración: validación y autorización ──────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.configurar_anticipo('00000000-0000-0000-0000-0000000000b1', 'OPCIONAL', 10, null, 0, 1000, false);
    raise exception 'FALLA 129: otro dueño configuró el anticipo ajeno';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 129: un negocio no configura el anticipo de otro';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.configurar_anticipo('00000000-0000-0000-0000-0000000000b1', 'OPCIONAL', 150, null, 0, 1000, false);
    raise exception 'FALLA 129: se aceptó un porcentaje de 150';
  exception when others then
    if sqlerrm not like '%ANTICIPO_VALORES_INVALIDOS%' then raise; end if;
  end;
  begin
    perform public.configurar_anticipo('00000000-0000-0000-0000-0000000000b1', 'OPCIONAL', 10, null, 5000, 1000, false);
    raise exception 'FALLA 129: se aceptó máximo menor que el mínimo';
  exception when others then
    if sqlerrm not like '%ANTICIPO_VALORES_INVALIDOS%' then raise; end if;
  end;
  perform public.configurar_anticipo('00000000-0000-0000-0000-0000000000b1', 'OPCIONAL', 25, null, 1000, 90000, false, 'prueba');
  if (select anticipo_modo from public.negocio where id = '00000000-0000-0000-0000-0000000000b1') <> 'OPCIONAL' then
    raise exception 'FALLA 129: la configuración no se guardó';
  end if;
  raise notice 'OK 129: configuración validada en la base y guardada por el dueño';
end $$;
reset role;

-- ── Anticipo opcional ─────────────────────────────────────────────────────
insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S', 'D', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena, expira_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '2 days', now() + interval '2 days 1 hour', 'PENDIENTE_PAGO', 40000, 10000, now() + interval '10 minutes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.confirmar_reserva_sin_anticipo('00000000-0000-0000-0000-0000000000d1');
    raise exception 'FALLA 129: un tercero confirmó una reserva ajena sin anticipo';
  exception when others then
    if sqlerrm not like '%RESERVA_NO_ENCONTRADA%' then raise; end if;
  end;
  raise notice 'OK 129: solo el cliente dueño confirma sin anticipo';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  perform public.confirmar_reserva_sin_anticipo('00000000-0000-0000-0000-0000000000d1');
  if (select estado from public.reserva where id = '00000000-0000-0000-0000-0000000000d1') <> 'CONFIRMADA' then
    raise exception 'FALLA 129: la reserva opcional no quedó confirmada';
  end if;
  raise notice 'OK 129: anticipo opcional confirma sin cobro';
end $$;
reset role;

update public.negocio set anticipo_modo = 'OBLIGATORIO' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena, expira_at) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1', now() + interval '3 days', now() + interval '3 days 1 hour', 'PENDIENTE_PAGO', 40000, 10000, now() + interval '10 minutes');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.confirmar_reserva_sin_anticipo('00000000-0000-0000-0000-0000000000d2');
    raise exception 'FALLA 129: se saltó un anticipo obligatorio';
  exception when others then
    if sqlerrm not like '%ANTICIPO_OBLIGATORIO%' then raise; end if;
  end;
  raise notice 'OK 129: con anticipo obligatorio no se confirma sin pago verificado';
end $$;
reset role;

-- ── Entorno del pago y evidencia en el libro ─────────────────────────────
insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO');
update public.pago set entorno = 'SANDBOX' where id = '00000000-0000-0000-0000-0000000000f1';
set local role service_role;
do $$ begin
  begin
    update public.pago set entorno = 'PRODUCCION' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FALLA 129: se cambió el entorno de un pago';
  exception when others then
    if sqlerrm not like '%PAGO_CAMPO_INMUTABLE%' then raise; end if;
  end;
  raise notice 'OK 129: el entorno de un pago es inmutable';
end $$;
reset role;

do $$
declare d jsonb;
begin
  perform public.aplicar_evento_pago('00000000-0000-0000-0000-0000000000f1', '9990001', 'APROBADO',
    '{"payment_method_id":"visa","payment_type_id":"credit_card","live_mode":false,"collector_id":"111",
      "net_received_amount":28650,"fee_details":[{"type":"mercadopago_fee","amount":1350}]}'::jsonb);
  select detalle into d from public.libro_movimiento where pago_id = '00000000-0000-0000-0000-0000000000f1' and evento = 'PAGO_CONFIRMADO';
  if d->>'entorno' <> 'SANDBOX' or (d->>'comision_proveedor')::numeric <> 1350 or (d->>'valor_neto_proveedor')::numeric <> 28650
     or d->>'metodo_pago' <> 'visa' or d->>'cuenta_vendedor' <> '111' then
    raise exception 'FALLA 129: el libro no guardó la evidencia del proveedor: %', d;
  end if;
  raise notice 'OK 129: el libro guarda entorno, medio, comisión del proveedor, neto y vendedor';
end $$;

do $$ begin raise notice 'TODAS LAS PRUEBAS 129 PASARON'; end $$;
rollback;
