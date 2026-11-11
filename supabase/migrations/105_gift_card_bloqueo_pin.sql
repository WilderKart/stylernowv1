-- H6 (informe de seguridad): PIN de gift card sin bloqueo. 5 PIN erroneos seguidos bloquean la tarjeta 15 minutos.
-- Un RAISE revierte los UPDATE previos de la misma llamada, asi que el PIN erroneo ya NO lanza excepcion:
-- el contador se guarda y la funcion devuelve "sin resultado" (consultar: 0 filas; redimir: null). El bloqueo
-- activo si lanza DEMASIADOS_INTENTOS (no escribe nada antes de lanzar). Misma firma y mismos permisos.
alter table public.gift_card
  add column if not exists intentos_pin integer not null default 0,
  add column if not exists bloqueada_hasta timestamptz;

create or replace function public._gift_card_pin_ok(p_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare g public.gift_card;
begin
  select * into g from public.gift_card where id = p_id for update;
  if not found then return false; end if;
  if g.bloqueada_hasta is not null and g.bloqueada_hasta > now() then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;
  if g.pin_hash = extensions.crypt(coalesce(p_pin, ''), g.pin_hash) then
    if g.intentos_pin > 0 or g.bloqueada_hasta is not null then
      update public.gift_card set intentos_pin = 0, bloqueada_hasta = null where id = p_id;
    end if;
    return true;
  end if;
  update public.gift_card
     set intentos_pin = case when intentos_pin + 1 >= 5 then 0 else intentos_pin + 1 end,
         bloqueada_hasta = case when intentos_pin + 1 >= 5 then now() + interval '15 minutes' else bloqueada_hasta end
   where id = p_id;
  insert into public.lealtad_fraude_evento (tipo, cliente_id, negocio_id, severidad, payload)
  values ('CANJE_DUPLICADO', auth.uid(), g.negocio_id, case when g.intentos_pin + 1 >= 5 then 'MEDIA' else 'BAJA' end,
          jsonb_build_object('motivo', 'PIN_INCORRECTO', 'gift_card_id', g.id, 'intento', g.intentos_pin + 1));
  return false;
end $$;
revoke all on function public._gift_card_pin_ok(uuid, text) from public, anon, authenticated;

create or replace function public.consultar_gift_card(p_codigo text, p_pin text)
returns table(monto_original numeric, saldo_actual numeric, estado gift_card_estado, fecha_expiracion timestamptz, negocio_nombre text)
language plpgsql security definer set search_path = public as $$
declare v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo));
  if not found then return; end if;            -- sin diferencia visible entre "no existe" y "PIN incorrecto"
  if not public._gift_card_pin_ok(v_gift_card.id, p_pin) then return; end if;
  return query
    select v_gift_card.monto_original, v_gift_card.saldo_actual, v_gift_card.estado, v_gift_card.fecha_expiracion, n.nombre
    from public.negocio n where n.id = v_gift_card.negocio_id;
end $$;

create or replace function public._validar_gift_card_para_canje(p_codigo text, p_pin text)
returns public.gift_card language plpgsql security definer set search_path = public as $$
declare v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo));
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if not public._gift_card_pin_ok(v_gift_card.id, p_pin) then return null; end if;   -- PIN incorrecto (ya contado)
  select * into v_gift_card from public.gift_card where id = v_gift_card.id for update;
  if v_gift_card.estado = 'CANJEADA' then raise exception 'YA_CANJEADA'; end if;
  if v_gift_card.estado in ('BLOQUEADA', 'VENCIDA') then raise exception 'GIFT_CARD_NO_DISPONIBLE'; end if;
  if v_gift_card.fecha_expiracion is not null and v_gift_card.fecha_expiracion < now() then
    update public.gift_card set estado = 'VENCIDA', updated_at = now() where id = v_gift_card.id;
    raise exception 'GIFT_CARD_VENCIDA';
  end if;
  return v_gift_card;
end $$;

create or replace function public.redimir_gift_card_pos(p_codigo text, p_pin text, p_cliente_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_gift_card public.gift_card;
begin
  v_gift_card := public._validar_gift_card_para_canje(p_codigo, p_pin);
  if v_gift_card.id is null then return null; end if;      -- PIN incorrecto
  if not public.tiene_acceso_interno(v_gift_card.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  insert into public.gift_card_redencion (gift_card_id, cliente_id, monto) values (v_gift_card.id, p_cliente_id, v_gift_card.saldo_actual);
  update public.gift_card set estado = 'CANJEADA', saldo_actual = 0, updated_at = now() where id = v_gift_card.id;

  perform public._lealtad_acreditar(
    p_cliente_id, 'GIFT_CARD', v_gift_card.saldo_actual, v_gift_card.negocio_id, null,
    'gift_card', v_gift_card.id, 'Canje de Gift Card ' || v_gift_card.codigo || ' en POS'
  );

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('gift_card', v_gift_card.id, 'GIFT_CARD_CANJEADA_POS', 'BARBERIA', auth.uid(), v_gift_card.negocio_id,
    jsonb_build_object('cliente_id', p_cliente_id, 'monto', v_gift_card.saldo_actual));

  return v_gift_card.saldo_actual;
end $$;

create or replace function public.redimir_gift_card(p_codigo text, p_pin text)
returns public.lealtad_wallet language plpgsql security definer set search_path = public as $$
declare v_gift_card public.gift_card; v_wallet public.lealtad_wallet;
begin
  v_gift_card := public._validar_gift_card_para_canje(p_codigo, p_pin);
  if v_gift_card.id is null then return null; end if;      -- PIN incorrecto
  insert into public.gift_card_redencion (gift_card_id, cliente_id, monto) values (v_gift_card.id, auth.uid(), v_gift_card.saldo_actual);
  update public.gift_card set estado = 'CANJEADA', saldo_actual = 0, updated_at = now() where id = v_gift_card.id;
  perform public._lealtad_acreditar(
    auth.uid(), 'GIFT_CARD', v_gift_card.saldo_actual, v_gift_card.negocio_id, null,
    'gift_card', v_gift_card.id, 'Canje de Gift Card ' || v_gift_card.codigo
  );
  select * into v_wallet from public.lealtad_wallet where cliente_id = auth.uid();
  return v_wallet;
end $$;
