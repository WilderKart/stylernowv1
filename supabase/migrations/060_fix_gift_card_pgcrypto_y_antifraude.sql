-- StylerNow — Migración 060: corrige dos bugs reales de la migración 055,
-- encontrados al ejecutar el script de verificación completo del dominio
-- LEALTAD antes de construir ningún frontend sobre estas RPCs.
--
-- Bug 1: `gen_random_bytes()`/`crypt()`/`gen_salt()` (pgcrypto) fallaban
-- con "function gen_random_bytes(integer) does not exist" — Supabase
-- instala las extensiones en el esquema `extensions`, no en `public`, y
-- toda función de este proyecto usa `set search_path = public` (nunca
-- incluye `extensions`) — se corrige calificando el esquema explícito en
-- cada llamada, en vez de agregar `extensions` al search_path del
-- proyecto entero (más seguro: no expone silenciosamente otras funciones
-- de extensiones a cada función del proyecto).
--
-- Bug 2 (más importante): `registrar_referido()` (056) y
-- `redimir_gift_card()` (055) insertaban un evento en
-- `lealtad_fraude_evento` INMEDIATAMENTE ANTES de un `raise exception` —
-- pero un `RAISE EXCEPTION` aborta TODA la transacción de la función,
-- incluyendo cualquier INSERT hecho microsegundos antes en la misma
-- llamada. El evento de fraude nunca llegaba a persistir — se habría
-- descubierto recién en producción, con el registro de auditoría que
-- más importa (el intento de fraude) siempre vacío. Postgres no soporta
-- transacciones autónomas nativas (sin `dblink`/`pg_background`, no
-- instalados en este proyecto); la solución correcta es registrar el
-- evento desde una llamada de sistema SEPARADA (server_role, otra
-- transacción) en la capa de TypeScript cuando el RPC devuelve
-- específicamente estos códigos de error — implementado en las Server
-- Actions de Referidos/Gift Cards (`src/app/.../lealtad/actions.ts`).

create or replace function public.registrar_referido(p_codigo text, p_negocio_id uuid default null)
returns public.referido
language plpgsql security definer set search_path = public as $fn$
declare
  v_codigo public.referido_codigo;
  v_referido public.referido;
begin
  select * into v_codigo from public.referido_codigo where codigo = upper(trim(p_codigo));
  if not found then raise exception 'CODIGO_INVALIDO'; end if;
  if v_codigo.cliente_id = auth.uid() then
    raise exception 'NO_PUEDES_REFERIRTE_A_TI_MISMO';
  end if;
  if exists (select 1 from public.referido where referido_cliente_id = auth.uid())
     or exists (select 1 from public.staff_referido where cliente_referido_id = auth.uid()) then
    raise exception 'YA_FUE_REFERIDO';
  end if;

  insert into public.referido (referido_codigo_id, referente_cliente_id, referido_cliente_id, negocio_id)
  values (v_codigo.id, v_codigo.cliente_id, auth.uid(), p_negocio_id)
  returning * into v_referido;

  return v_referido;
end;
$fn$;

create or replace function public.redimir_gift_card(p_codigo text, p_pin text)
returns public.lealtad_wallet
language plpgsql security definer set search_path = public as $fn$
declare
  v_gift_card public.gift_card;
  v_wallet public.lealtad_wallet;
begin
  select * into v_gift_card from public.gift_card where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'GIFT_CARD_NO_ENCONTRADA'; end if;
  if v_gift_card.pin_hash <> extensions.crypt(p_pin, v_gift_card.pin_hash) then
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

  v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, destinatario_email, destinatario_telefono, monto_original, saldo_actual, estado, fecha_expiracion)
  values (v_codigo, extensions.crypt(p_pin, extensions.gen_salt('bf')), p_negocio_id, auth.uid(), p_destinatario_email, p_destinatario_telefono, p_monto, p_monto, 'BLOQUEADA', now() + make_interval(days => p_dias_vigencia))
  returning * into v_gift_card;

  insert into public.pago (negocio_id, tipo, monto, estado, pasarela, metadata)
  values (p_negocio_id, 'GIFT_CARD', p_monto, 'PENDIENTE', 'MERCADOPAGO', jsonb_build_object('gift_card_id', v_gift_card.id))
  returning * into v_pago;

  return v_pago;
end;
$fn$;

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
    v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
    v_pin := lpad((floor(random() * 10000))::text, 4, '0');
    insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, monto_original, saldo_actual, estado, fecha_expiracion, corporativo_cuenta_id, lote_id)
    values (v_codigo, extensions.crypt(v_pin, extensions.gen_salt('bf')), v_cuenta.negocio_id, auth.uid(), p_monto_cada_una, p_monto_cada_una, 'ACTIVA', v_cuenta.vigencia_fin::timestamptz, p_cuenta_id, v_lote_id);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('corporativo_cuenta', p_cuenta_id, 'LOTE_GIFT_CARDS_CREADO', 'SUPERSU', auth.uid(), v_cuenta.negocio_id,
    jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad, 'monto_cada_una', p_monto_cada_una));

  return jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad);
end;
$fn$;

-- Registro de fraude desde una transacción de sistema SEPARADA (nunca
-- dentro de la misma llamada que también hace `raise exception`, ver
-- explicación arriba). Restringido a auto-reporte (cliente_id = auth.uid()
-- si lo llama un usuario, o service_role desde el servidor) y a los tipos
-- de evento que un intento fallido de Cliente puede generar legítimamente.
create or replace function public.registrar_evento_fraude(p_tipo text, p_negocio_id uuid default null, p_severidad text default 'MEDIA', p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if p_tipo not in ('CANJE_DUPLICADO', 'ABUSO_REFERIDO') then raise exception 'TIPO_NO_PERMITIDO_DESDE_CLIENTE'; end if;
  if p_severidad not in ('BAJA', 'MEDIA', 'ALTA') then p_severidad := 'MEDIA'; end if;

  insert into public.lealtad_fraude_evento (tipo, cliente_id, negocio_id, severidad, payload)
  values (p_tipo, auth.uid(), p_negocio_id, p_severidad, p_payload);
end;
$fn$;
grant execute on function public.registrar_evento_fraude(text, uuid, text, jsonb) to authenticated;
