-- StylerNow — Migración 055: Dominio LEALTAD (ADR-011) — Módulos 3 y 10:
-- Gift Cards (individuales y empresariales).
-- Fuente: ADR_011_Motor_Lealtad.md, Módulos 3 y 10.
--
-- Alcance V1: solo Gift Cards digitales — la física queda como
-- arquitectura de datos lista (columna implícita: nada distingue hoy una
-- tarjeta física, porque no hay flujo de emisión/impresión física que
-- consumirla), sin proveedor de impresión integrado (Decisión Pendiente
-- real si el fundador la necesita — ver TECH_DEBT_REGISTER.md).
-- Entrega: la Gift Card queda en el registro del comprador/destinatario y
-- se redime hacia StylerWallet — QR/Email/WhatsApp de entrega quedan
-- fuera de esta migración (WhatsApp explícitamente diferido por el
-- fundador; Email es un canal ya usado por notificacion_envio, se conecta
-- cuando exista el disparador real de envío, no antes).

create or replace function public.crear_gift_card(
  p_negocio_id uuid, p_monto numeric, p_pin text,
  p_destinatario_email text default null, p_destinatario_telefono text default null, p_dias_vigencia int default 365
)
returns public.pago
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
  v_pago public.pago;
  v_codigo text;
begin
  if p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if p_pin is null or length(p_pin) < 4 then raise exception 'PIN_INVALIDO'; end if;
  if not exists (select 1 from public.negocio where id = p_negocio_id and estado = 'ACTIVO') then
    raise exception 'NEGOCIO_NO_DISPONIBLE';
  end if;

  v_codigo := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  -- Nace BLOQUEADA (no redimible) hasta que el pago se apruebe — evita que
  -- una Gift Card exista utilizable antes de haberse cobrado.
  insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, destinatario_email, destinatario_telefono, monto_original, saldo_actual, estado, fecha_expiracion)
  values (v_codigo, crypt(p_pin, gen_salt('bf')), p_negocio_id, auth.uid(), p_destinatario_email, p_destinatario_telefono, p_monto, p_monto, 'BLOQUEADA', now() + make_interval(days => p_dias_vigencia))
  returning * into v_gift_card;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'GIFT_CARD', p_monto, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('gift_card_id', v_gift_card.id))
  returning * into v_pago;

  return v_pago;
end;
$fn$;
grant execute on function public.crear_gift_card(uuid, numeric, text, text, text, int) to authenticated;

-- Redime el saldo TOTAL de una Gift Card hacia el StylerWallet del Cliente
-- autenticado — simplificación V1 documentada: sin redención parcial.
create or replace function public.redimir_gift_card(p_codigo text, p_pin text)
returns public.lealtad_wallet
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
  v_wallet public.lealtad_wallet;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if v_gift_card.pin_hash <> crypt(p_pin, v_gift_card.pin_hash) then
    insert into public.lealtad_fraude_evento (tipo, cliente_id, negocio_id, severidad, payload)
    values ('CANJE_DUPLICADO', auth.uid(), v_gift_card.negocio_id, 'BAJA', jsonb_build_object('motivo', 'PIN_INCORRECTO', 'gift_card_id', v_gift_card.id));
    raise exception 'PIN_INCORRECTO';
  end if;
  if v_gift_card.estado = 'CANJEADA' then raise exception 'YA_CANJEADA'; end if;
  if v_gift_card.estado in ('BLOQUEADA', 'VENCIDA') then raise exception 'GIFT_CARD_NO_DISPONIBLE'; end if;
  if v_gift_card.fecha_expiracion is not null and v_gift_card.fecha_expiracion < now() then
    update public.gift_card set estado = 'VENCIDA', updated_at = now() where id = v_gift_card.id;
    raise exception 'GIFT_CARD_VENCIDA';
  end if;

  insert into public.gift_card_redencion (gift_card_id, cliente_id, monto) values (v_gift_card.id, auth.uid(), v_gift_card.saldo_actual);

  update public.gift_card set estado = 'CANJEADA', saldo_actual = 0, updated_at = now() where id = v_gift_card.id;

  perform public._lealtad_acreditar(
    auth.uid(), 'GIFT_CARD', v_gift_card.saldo_actual, v_gift_card.negocio_id, null,
    'gift_card', v_gift_card.id, 'Canje de Gift Card ' || v_gift_card.codigo
  );

  select * into v_wallet from public.lealtad_wallet where cliente_id = auth.uid();
  return v_wallet;
end;
$fn$;
grant execute on function public.redimir_gift_card(text, text) to authenticated;

create or replace function public.bloquear_gift_card(p_gift_card_id uuid, p_motivo text)
returns public.gift_card
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where id = p_gift_card_id;
  if not found or not (public.tiene_acceso_interno(v_gift_card.negocio_id) or public.is_supersu()) then raise exception 'NO_AUTORIZADO'; end if;
  if v_gift_card.estado = 'CANJEADA' then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.gift_card set estado = 'BLOQUEADA', updated_at = now() where id = p_gift_card_id returning * into v_gift_card;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('gift_card', p_gift_card_id, 'GIFT_CARD_BLOQUEADA', case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end, auth.uid(), v_gift_card.negocio_id, p_motivo);

  return v_gift_card;
end;
$fn$;
grant execute on function public.bloquear_gift_card(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Módulo 10 — Gift Cards empresariales: compra masiva (N códigos de un
-- mismo monto para una cuenta corporativa) y asignación a empleados.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_lote_gift_cards_corporativo(p_cuenta_id uuid, p_cantidad int, p_monto_cada_una numeric)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_cuenta public.corporativo_cuenta;
  v_lote_id uuid := gen_random_uuid();
  v_codigo text;
  v_pin text;
  i int;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or (v_cuenta.admin_user_id <> auth.uid() and not public.is_supersu()) then raise exception 'NO_AUTORIZADO'; end if;
  if p_cantidad <= 0 or p_cantidad > 500 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_monto_cada_una <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if v_cuenta.negocio_id is null then raise exception 'CUENTA_SIN_NEGOCIO_ASOCIADO'; end if;

  for i in 1..p_cantidad loop
    v_codigo := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    v_pin := lpad((floor(random() * 10000))::text, 4, '0');
    insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, monto_original, saldo_actual, estado, fecha_expiracion, corporativo_cuenta_id, lote_id)
    values (v_codigo, crypt(v_pin, gen_salt('bf')), v_cuenta.negocio_id, auth.uid(), p_monto_cada_una, p_monto_cada_una, 'ACTIVA', v_cuenta.vigencia_fin::timestamptz, p_cuenta_id, v_lote_id);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('corporativo_cuenta', p_cuenta_id, 'LOTE_GIFT_CARDS_CREADO', 'SUPERSU', auth.uid(), v_cuenta.negocio_id,
    jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad, 'monto_cada_una', p_monto_cada_una));

  return jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad);
end;
$fn$;
grant execute on function public.crear_lote_gift_cards_corporativo(uuid, int, numeric) to authenticated;
