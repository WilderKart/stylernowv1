-- StylerNow — Migración 074: corrige ADL-025 en la migración 073.
-- `crear_gift_card()`, `_validar_gift_card_para_canje()` y
-- `consultar_gift_card()` re-declararon las llamadas a `gen_random_bytes`/
-- `crypt`/`gen_salt` SIN calificar el esquema `extensions` (el fix de la
-- migración 060 no se arrastró al copiar el cuerpo de la función) —
-- descubierto por la propia suite de verificación de Fase B al fallar
-- con "function gen_random_bytes(integer) does not exist", exactamente
-- el mismo síntoma que ADL-025.

create or replace function public.crear_gift_card(
  p_negocio_id uuid, p_monto numeric, p_pin text,
  p_destinatario_email text default null, p_destinatario_telefono text default null, p_dias_vigencia int default 365,
  p_destinatario_nombre text default null, p_mensaje text default null
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

  v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, destinatario_email, destinatario_telefono, destinatario_nombre, mensaje, monto_original, saldo_actual, estado, fecha_expiracion)
  values (v_codigo, extensions.crypt(p_pin, extensions.gen_salt('bf')), p_negocio_id, auth.uid(), p_destinatario_email, p_destinatario_telefono, p_destinatario_nombre, p_mensaje, p_monto, p_monto, 'BLOQUEADA', now() + make_interval(days => p_dias_vigencia))
  returning * into v_gift_card;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'GIFT_CARD', p_monto, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('gift_card_id', v_gift_card.id))
  returning * into v_pago;

  return v_pago;
end;
$fn$;

create or replace function public._validar_gift_card_para_canje(p_codigo text, p_pin text)
returns public.gift_card
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if v_gift_card.pin_hash <> extensions.crypt(p_pin, v_gift_card.pin_hash) then
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
  return v_gift_card;
end;
$fn$;

create or replace function public.consultar_gift_card(p_codigo text, p_pin text)
returns table (monto_original numeric, saldo_actual numeric, estado gift_card_estado, fecha_expiracion timestamptz, negocio_nombre text)
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo));
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if v_gift_card.pin_hash <> extensions.crypt(p_pin, v_gift_card.pin_hash) then raise exception 'PIN_INCORRECTO'; end if;

  return query
    select v_gift_card.monto_original, v_gift_card.saldo_actual, v_gift_card.estado, v_gift_card.fecha_expiracion, n.nombre
    from public.negocio n where n.id = v_gift_card.negocio_id;
end;
$fn$;
