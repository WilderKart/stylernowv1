-- Pruebas de comportamiento de la migración 119 (cobro directo al negocio).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/cobro_directo_119.sql
-- Base LOCAL únicamente. Transacción con ROLLBACK: no deja datos.

begin;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;
-- Paridad: en las tablas de credenciales la 119 revoca explícitamente; se reaplica tras el grant masivo.
revoke all on public.conexion_pago_negocio, public.oauth_estado, public.conexion_pago_evento from authenticated, anon;
revoke insert, update, delete on public.conexion_pago_negocio, public.oauth_estado, public.conexion_pago_evento from service_role;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'dueno@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'cliente@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'intruso@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'D'), ('00000000-0000-0000-0000-0000000000a2', 'C'), ('00000000-0000-0000-0000-0000000000a3', 'I')
on conflict (id) do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, sena_pct) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Con cuenta', 'con-cuenta-119', 'Cali', 'CO', 20),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Sin cuenta', 'sin-cuenta-119', 'Cali', 'CO', 20);
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S1', 'D', 'Cali'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'S2', 'D', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
insert into public.conexion_pago_negocio (id, negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'CONECTADA', 'SANDBOX', '123456789',
        'v1.iv.tag.datos', now() + interval '180 days', now());

-- ── Anticipo solo con cuenta propia ────────────────────────────────────────
do $$ begin
  if public.calcular_sena('00000000-0000-0000-0000-0000000000b2', 50000) <> 0 then
    raise exception 'FALLA 119: un negocio sin cuenta conectada cobraría anticipo en línea';
  end if;
  if public.calcular_sena('00000000-0000-0000-0000-0000000000b1', 50000) <= 0 then
    raise exception 'FALLA 119: un negocio con cuenta conectada debería cobrar anticipo';
  end if;
  raise notice 'OK 119: sin cuenta conectada, anticipo 0';
end $$;

do $$ begin
  begin
    insert into public.pago (negocio_id, tipo, monto, estado, pasarela)
    values ('00000000-0000-0000-0000-0000000000b2', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO');
    raise exception 'FALLA 119: se creó un cobro en línea del negocio sin su cuenta (iría a StylerNow)';
  exception when others then
    if sqlerrm not like '%NEGOCIO_SIN_CUENTA_PAGO%' then raise; end if;
  end;
  raise notice 'OK 119: el dinero del negocio nunca se cobra en la cuenta de StylerNow';
end $$;

-- ── Beneficiario y cuenta de cobro los decide la base ──────────────────────
update public.negocio set comision_plataforma_pct = 5 where id = '00000000-0000-0000-0000-0000000000b1';
do $$
declare p public.pago; q public.pago; e public.pago;
begin
  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, cuenta_cobro, conexion_pago_id, marketplace_fee)
  values ('00000000-0000-0000-0000-0000000000b1', 'MEMBRESIA', 40000, 'PENDIENTE', 'MERCADOPAGO', 'PLATAFORMA', null, 99999)
  returning * into p;
  if p.cuenta_cobro <> 'NEGOCIO' or p.conexion_pago_id <> '00000000-0000-0000-0000-0000000000f1' or p.marketplace_fee <> 2000 then
    raise exception 'FALLA 119: la cuenta/comisión no la decidió la base: % / % / %', p.cuenta_cobro, p.conexion_pago_id, p.marketplace_fee;
  end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, cuenta_cobro)
  values ('00000000-0000-0000-0000-0000000000b1', 'SUSCRIPCION', 139900, 'PENDIENTE', 'MERCADOPAGO', 'NEGOCIO')
  returning * into q;
  if q.cuenta_cobro <> 'PLATAFORMA' or q.conexion_pago_id is not null then
    raise exception 'FALLA 119: un ingreso de StylerNow quedó en la cuenta del negocio';
  end if;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela)
  values ('00000000-0000-0000-0000-0000000000b2', 'SALDO', 20000, 'APROBADO', 'EFECTIVO')
  returning * into e;
  if e.cuenta_cobro <> 'NEGOCIO' then raise exception 'FALLA 119: el pago en local no quedó del negocio'; end if;
  raise notice 'OK 119: matriz de beneficiarios (negocio / plataforma / local) aplicada en la base';
end $$;

set local role service_role;
do $$ begin
  begin
    update public.pago set cuenta_cobro = 'PLATAFORMA' where tipo = 'MEMBRESIA' and negocio_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'FALLA 119: se cambió la cuenta de cobro de un pago';
  exception when others then
    if sqlerrm not like '%PAGO_CAMPO_INMUTABLE%' then raise; end if;
  end;
  raise notice 'OK 119: la cuenta de cobro de un pago es inmutable';
end $$;
reset role;

-- ── Aprobación de un pago del negocio: sin wallet (el dinero ya está en su cuenta) ──
do $$
declare v_pago uuid; v_antes int; v_despues int; r jsonb;
begin
  -- Rama genérica (la que acreditaba el wallet en custodia): un saldo cobrado en línea.
  insert into public.pago (negocio_id, tipo, monto, estado, pasarela)
  values ('00000000-0000-0000-0000-0000000000b1', 'SALDO', 40000, 'PENDIENTE', 'MERCADOPAGO') returning id into v_pago;
  select count(*) into v_antes from public.wallet_movimiento;
  r := public.aplicar_evento_pago(v_pago, '5550001', 'APROBADO', '{}'::jsonb);
  select count(*) into v_despues from public.wallet_movimiento;
  if v_despues <> v_antes then raise exception 'FALLA 119: un cobro directo acreditó el wallet (doble saldo)'; end if;
  if (select comision_plataforma_monto from public.pago where id = v_pago) <> 2000 then
    raise exception 'FALLA 119: la comisión registrada no es el marketplace_fee';
  end if;
  raise notice 'OK 119: cobro directo sin custodia; comisión = marketplace_fee';
end $$;

-- ── Reserva sin anticipo nace confirmada ───────────────────────────────────
do $$ begin
  if position('CONFIRMADA' in pg_get_functiondef('public.crear_reserva(uuid,uuid[],timestamptz,uuid,text)'::regprocedure)) = 0 then
    raise exception 'FALLA 119: crear_reserva no confirma reservas sin anticipo';
  end if;
  raise notice 'OK 119: crear_reserva confirma directo cuando el anticipo es 0';
end $$;

-- ── OAuth: state de un solo uso, ligado al dueño ───────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.oauth_iniciar('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', repeat('a', 64), 'v1.x.y.z');
    raise exception 'FALLA 119: authenticated ejecutó una función de servidor del OAuth';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.conexion_pago_negocio;
    raise exception 'FALLA 119: authenticated puede leer la tabla de credenciales';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.conexion_pago_estado('00000000-0000-0000-0000-0000000000b1');
    raise exception 'FALLA 119: un tercero vio el estado de la conexión de otro negocio';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform public.conexion_desconectar('00000000-0000-0000-0000-0000000000b1');
    raise exception 'FALLA 119: un tercero desconectó la cuenta de otro negocio';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 119: credenciales invisibles y aisladas por negocio';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare j jsonb;
begin
  j := public.conexion_pago_estado('00000000-0000-0000-0000-0000000000b1');
  if j->>'estado' <> 'CONECTADA' or j::text like '%v1.%' or j->>'cuenta' <> '•••6789' then
    raise exception 'FALLA 119: el estado expone datos sensibles o es incorrecto: %', j;
  end if;
  raise notice 'OK 119: el dueño ve el estado real sin tokens';
end $$;
reset role;

set local role service_role;
do $$
declare r record;
begin
  begin
    perform public.oauth_iniciar('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', repeat('a', 64), 'v1.x.y.z');
    raise exception 'FALLA 119: un no-dueño inició el OAuth de otro negocio';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  perform public.oauth_iniciar('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', repeat('b', 64), 'v1.x.y.z');
  begin
    perform * from public.oauth_consumir(repeat('b', 64), '00000000-0000-0000-0000-0000000000a3');
    raise exception 'FALLA 119: otro usuario consumió el state (CSRF)';
  exception when others then
    if sqlerrm not like '%OAUTH_ESTADO_INVALIDO%' then raise; end if;
  end;
  select * into r from public.oauth_consumir(repeat('b', 64), '00000000-0000-0000-0000-0000000000a1');
  if r.negocio_id <> '00000000-0000-0000-0000-0000000000b1' then raise exception 'FALLA 119: state mal resuelto'; end if;
  begin
    perform * from public.oauth_consumir(repeat('b', 64), '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FALLA 119: el state se usó dos veces';
  exception when others then
    if sqlerrm not like '%OAUTH_ESTADO_INVALIDO%' then raise; end if;
  end;
  begin
    perform public.conexion_guardar('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
      'abc; drop table pago', 'SANDBOX', 'v1.a.b.c', null, now() + interval '1 day', 'read');
    raise exception 'FALLA 119: se aceptó una cuenta externa con formato inválido';
  exception when others then
    if sqlerrm not like '%CUENTA_EXTERNA_INVALIDA%' then raise; end if;
  end;
  raise notice 'OK 119: state de un solo uso, ligado al dueño; entradas validadas';
end $$;

-- Revocación real: queda el estado y se borran los tokens; el historial se conserva.
do $$
declare c public.conexion_pago_negocio;
begin
  perform public.conexion_marcar_estado('00000000-0000-0000-0000-0000000000f1', 'REVOCADA', 'invalid_token 401');
  select * into c from public.conexion_pago_negocio where id = '00000000-0000-0000-0000-0000000000f1';
  if c.estado <> 'REVOCADA' or c.access_token_cifrado is not null then raise exception 'FALLA 119: revocación incompleta'; end if;
  if not exists (select 1 from public.conexion_pago_evento where conexion_id = c.id and estado_destino = 'REVOCADA') then
    raise exception 'FALLA 119: la revocación no dejó historial';
  end if;
  if public.negocio_cobra_en_linea('00000000-0000-0000-0000-0000000000b1') then
    raise exception 'FALLA 119: una conexión revocada sigue habilitando cobros';
  end if;
  raise notice 'OK 119: token revocado = estado real, sin cobros, con historial';
end $$;

-- Webhook: duplicado detectado.
do $$ begin
  if not public.webhook_registrar('MERCADOPAGO', 'req-1', '5550001', 'payment', null) then raise exception 'FALLA 119: primer webhook'; end if;
  perform public.webhook_marcar_procesado('MERCADOPAGO', 'req-1', 'APROBADO');
  if public.webhook_registrar('MERCADOPAGO', 'req-1', '5550001', 'payment', null) then
    raise exception 'FALLA 119: un webhook ya procesado se volvería a procesar';
  end if;
  raise notice 'OK 119: webhook duplicado detectado';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 119 PASARON'; end $$;
rollback;
