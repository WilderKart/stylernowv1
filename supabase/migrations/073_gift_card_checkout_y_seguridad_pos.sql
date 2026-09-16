-- StylerNow — Migración 073: ADR-014, Fase B — Checkout completo de Gift
-- Cards + endurecimiento de seguridad: "canje únicamente desde POS".
--
-- Hallazgo de la auditoría previa a esta migración: `redimir_gift_card()`
-- (migración 055/060) es invocable por CUALQUIER usuario autenticado y
-- convierte el saldo directamente a su propio StylerWallet — un modelo de
-- autoservicio remoto que ADR-014 pide cerrar explícitamente (vulnerable a
-- fuerza bruta de PIN sin que la persona esté físicamente en el Negocio).
-- Se resuelve así, sin duplicar la lógica de validación:
--   1. `_validar_gift_card_para_canje()` — helper privado con las
--      validaciones ya existentes (PIN, estado, expiración, fraude).
--   2. `consultar_gift_card()` — lectura SOLO informativa (monto, estado,
--      expiración) para que el Cliente pueda confirmar que su código es
--      válido antes de ir al Negocio — nunca mueve saldo.
--   3. `redimir_gift_card_pos()` — el ÚNICO camino real de canje, exclusivo
--      de Staff/Barbería en el Negocio de la propia Gift Card, acredita el
--      StylerWallet del Cliente presente (no del Staff que la procesa).
--   4. Se revoca `authenticated` de la `redimir_gift_card()` original — el
--      autoservicio remoto queda cerrado. La función se conserva (no se
--      dropea) por si algún proceso interno futuro necesita reusar su
--      forma; hoy nada más la llama.

alter table public.gift_card add column if not exists mensaje text;
alter table public.gift_card add column if not exists destinatario_nombre text;

-- Ampliación de RLS: el destinatario (por email, verificado contra su
-- propio JWT — nunca un email arbitrario) también puede ver la Gift Card
-- que le regalaron, no solo quien la compró.
drop policy if exists gift_card_select on public.gift_card;
create policy gift_card_select on public.gift_card for select
  using (
    comprador_id = auth.uid()
    or destinatario_email = (auth.jwt() ->> 'email')
    or public.tiene_acceso_interno(negocio_id)
    or public.is_supersu()
  );

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

  v_codigo := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, destinatario_email, destinatario_telefono, destinatario_nombre, mensaje, monto_original, saldo_actual, estado, fecha_expiracion)
  values (v_codigo, crypt(p_pin, gen_salt('bf')), p_negocio_id, auth.uid(), p_destinatario_email, p_destinatario_telefono, p_destinatario_nombre, p_mensaje, p_monto, p_monto, 'BLOQUEADA', now() + make_interval(days => p_dias_vigencia))
  returning * into v_gift_card;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'GIFT_CARD', p_monto, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('gift_card_id', v_gift_card.id))
  returning * into v_pago;

  return v_pago;
end;
$fn$;
grant execute on function public.crear_gift_card(uuid, numeric, text, text, text, int, text, text) to authenticated;

-- Validación compartida (privada) — PIN, estado, expiración, antifraude.
-- Nunca mueve saldo: eso lo decide cada función que la use.
create or replace function public._validar_gift_card_para_canje(p_codigo text, p_pin text)
returns public.gift_card
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
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
  return v_gift_card;
end;
$fn$;
revoke all on function public._validar_gift_card_para_canje(text, text) from public, anon, authenticated;

-- Consulta informativa: confirma que un código/PIN son válidos y muestra
-- el saldo — NUNCA canjea. Pensada para /gift-cards/canjear (el Cliente
-- verifica su Gift Card antes de presentarla en el Negocio).
create or replace function public.consultar_gift_card(p_codigo text, p_pin text)
returns table (monto_original numeric, saldo_actual numeric, estado gift_card_estado, fecha_expiracion timestamptz, negocio_nombre text)
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo));
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if v_gift_card.pin_hash <> crypt(p_pin, v_gift_card.pin_hash) then raise exception 'PIN_INCORRECTO'; end if;

  return query
    select v_gift_card.monto_original, v_gift_card.saldo_actual, v_gift_card.estado, v_gift_card.fecha_expiracion, n.nombre
    from public.negocio n where n.id = v_gift_card.negocio_id;
end;
$fn$;
grant execute on function public.consultar_gift_card(text, text) to authenticated;

-- El ÚNICO canje real: exclusivo de Staff/Barbería del propio Negocio de
-- la Gift Card, acredita el StylerWallet del Cliente presente (no de
-- quien procesa el canje).
create or replace function public.redimir_gift_card_pos(p_codigo text, p_pin text, p_cliente_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
begin
  v_gift_card := public._validar_gift_card_para_canje(p_codigo, p_pin);
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
end;
$fn$;
grant execute on function public.redimir_gift_card_pos(text, text, uuid) to authenticated;

-- Cierre del autoservicio remoto (ADR-014, Fase B: "canje únicamente desde
-- POS"). La función se conserva definida — solo se revoca el acceso
-- directo de Cliente — por si un flujo interno futuro necesita su forma.
revoke execute on function public.redimir_gift_card(text, text) from authenticated;
