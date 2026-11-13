-- 119 · Cobro directo al negocio: conexión OAuth de Mercado Pago por negocio y beneficiario por tipo de pago.
--
-- Directiva Única Integral §7.1–7.3, §18 (2026-11-12). Sin aplicar.
-- Investigación oficial (Mercado Pago, split de pagos 1:1, Colombia): OAuth con URL
-- auth.mercadopago.com.co/authorization, tokens de 180 días con refresh rotativo
-- (scope offline_access), preferencia creada con el token DEL VENDEDOR y `marketplace_fee`
-- opcional (por defecto 0), webhooks firmados con el secreto de la app del integrador.
--
--  * `conexion_pago_negocio`: una conexión por negocio y proveedor. Los tokens se guardan
--    CIFRADOS por la aplicación (AES-256-GCM; la base nunca ve el token en claro) y ningún
--    rol de API puede leerlos: solo service_role, y solo desde el servidor.
--  * `oauth_estado`: `state` de un solo uso (anti-CSRF), con vencimiento, ligado al negocio
--    y al dueño que inició la conexión, y el `code_verifier` PKCE cifrado.
--  * Beneficiario por tipo de pago (matriz §18): SENA, SALDO, PROPINA, GIFT_CARD, MEMBRESIA
--    → NEGOCIO; SUSCRIPCION, PAQUETE_CREDITOS_IA, PAQUETE_CONVERSACIONES_WHATSAPP → PLATAFORMA.
--    Todo pago en línea cuyo beneficiario es el negocio EXIGE su conexión vigente y queda
--    ligado a ella: el dinero del negocio nunca cae en la cuenta de StylerNow.
--  * Sin conexión, el anticipo no se cobra en línea (`calcular_sena` = 0) y la reserva sin
--    anticipo nace CONFIRMADA (antes quedaba PENDIENTE_PAGO de $0 y expiraba).
--  * `webhook_evento`: registro idempotente de notificaciones recibidas.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Conexiones de pago por negocio
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.conexion_pago_negocio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  proveedor text not null default 'MERCADOPAGO' check (proveedor in ('MERCADOPAGO')),
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','CONECTADA','EXPIRADA','REVOCADA','ERROR')),
  entorno text check (entorno in ('SANDBOX','PRODUCCION')),
  cuenta_externa_id text,                 -- user_id del vendedor en Mercado Pago
  access_token_cifrado text,
  refresh_token_cifrado text,
  token_expira_at timestamptz,
  scopes text,
  conectada_at timestamptz,
  revocada_at timestamptz,
  ultimo_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, proveedor),
  -- Una conexión CONECTADA siempre tiene token cifrado (formato v1.iv.tag.datos) y cuenta.
  constraint conexion_conectada_completa check (
    estado <> 'CONECTADA' or (access_token_cifrado like 'v1.%' and cuenta_externa_id is not null and token_expira_at is not null))
);

create table if not exists public.conexion_pago_evento (
  id bigserial primary key,
  conexion_id uuid not null references public.conexion_pago_negocio(id),
  negocio_id uuid not null,
  estado_origen text,
  estado_destino text not null,
  actor_tipo text not null,
  actor_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);
create trigger trg_conexion_pago_evento_inmutable before update or delete on public.conexion_pago_evento
  for each row execute function public.trg_fila_inmutable();

create table if not exists public.oauth_estado (
  state_hash text primary key,            -- sha256 del state; el state en claro solo viaja al navegador
  negocio_id uuid not null references public.negocio(id),
  actor_id uuid not null,
  proveedor text not null default 'MERCADOPAGO',
  verifier_cifrado text not null,
  expira_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.conexion_pago_negocio enable row level security;
alter table public.conexion_pago_evento enable row level security;
alter table public.oauth_estado enable row level security;

-- Sin políticas para clientes: nadie lee estas tablas por la API salvo el servidor.
revoke all on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from public, anon, authenticated;
grant select on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado to service_role;
revoke insert, update, delete, truncate on public.conexion_pago_negocio, public.conexion_pago_evento, public.oauth_estado from service_role;
revoke all on sequence public.conexion_pago_evento_id_seq from public, anon, authenticated;

create or replace function public._conexion_evento(
  p_conexion uuid, p_negocio uuid, p_origen text, p_destino text, p_actor_tipo text, p_actor uuid, p_detalle jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.conexion_pago_evento (conexion_id, negocio_id, estado_origen, estado_destino, actor_tipo, actor_id, detalle)
  values (p_conexion, p_negocio, p_origen, p_destino, p_actor_tipo, p_actor, p_detalle);
$$;
revoke all on function public._conexion_evento(uuid, uuid, text, text, text, uuid, jsonb) from public, anon, authenticated, service_role;

-- ¿El negocio puede cobrar en línea con su propia cuenta?
create or replace function public.negocio_cobra_en_linea(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conexion_pago_negocio c
                  where c.negocio_id = p_negocio_id and c.proveedor = 'MERCADOPAGO' and c.estado = 'CONECTADA');
$$;
revoke all on function public.negocio_cobra_en_linea(uuid) from public;
grant execute on function public.negocio_cobra_en_linea(uuid) to anon, authenticated, service_role;

-- Estado visible para el dueño (sin tokens ni la cuenta completa).
create or replace function public.conexion_pago_estado(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.conexion_pago_negocio;
begin
  if not (coalesce(public.is_barberia_de(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into c from public.conexion_pago_negocio where negocio_id = p_negocio_id and proveedor = 'MERCADOPAGO';
  if not found then
    return jsonb_build_object('estado', 'NO_CONFIGURADO');
  end if;
  return jsonb_build_object(
    'estado', c.estado, 'entorno', c.entorno,
    'cuenta', case when c.cuenta_externa_id is null then null else '•••' || right(c.cuenta_externa_id, 4) end,
    'conectada_at', c.conectada_at, 'token_expira_at', c.token_expira_at, 'ultimo_error', c.ultimo_error);
end $$;
revoke all on function public.conexion_pago_estado(uuid) from public, anon, authenticated;
grant execute on function public.conexion_pago_estado(uuid) to authenticated;

-- ── Flujo OAuth (solo servidor) ─────────────────────────────────────────────

create or replace function public.oauth_iniciar(
  p_actor uuid, p_negocio_id uuid, p_state_hash text, p_verifier_cifrado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_actor is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.negocio where id = p_negocio_id and owner_user_id = p_actor) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if coalesce(p_state_hash, '') !~ '^[0-9a-f]{64}$' or coalesce(p_verifier_cifrado, '') not like 'v1.%' then
    raise exception 'OAUTH_ESTADO_INVALIDO';
  end if;
  -- Limpia estados vencidos del mismo negocio (no son historial financiero).
  delete from public.oauth_estado where negocio_id = p_negocio_id and (expira_at < now() or usado_at is not null);
  insert into public.oauth_estado (state_hash, negocio_id, actor_id, verifier_cifrado, expira_at)
  values (p_state_hash, p_negocio_id, p_actor, p_verifier_cifrado, now() + interval '10 minutes');
end $$;
revoke all on function public.oauth_iniciar(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.oauth_iniciar(uuid, uuid, text, text) to service_role;

-- Consume el state una sola vez. Exige que quien vuelve del proveedor sea el mismo dueño.
create or replace function public.oauth_consumir(p_state_hash text, p_actor uuid)
returns table(negocio_id uuid, verifier_cifrado text)
language plpgsql security definer set search_path = public as $$
declare e public.oauth_estado;
begin
  select * into e from public.oauth_estado where state_hash = p_state_hash for update;
  if not found or e.usado_at is not null or e.expira_at < now() then raise exception 'OAUTH_ESTADO_INVALIDO'; end if;
  if e.actor_id is distinct from p_actor then raise exception 'OAUTH_ESTADO_INVALIDO'; end if;
  update public.oauth_estado set usado_at = now() where state_hash = p_state_hash;
  return query select e.negocio_id, e.verifier_cifrado;
end $$;
revoke all on function public.oauth_consumir(text, uuid) from public, anon, authenticated;
grant execute on function public.oauth_consumir(text, uuid) to service_role;

create or replace function public.conexion_guardar(
  p_negocio_id uuid, p_actor uuid, p_cuenta_externa text, p_entorno text,
  p_access_cifrado text, p_refresh_cifrado text, p_expira_at timestamptz, p_scopes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_antes text;
begin
  if not exists (select 1 from public.negocio where id = p_negocio_id and owner_user_id = p_actor) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if coalesce(p_cuenta_externa, '') !~ '^[0-9]{1,20}$' then raise exception 'CUENTA_EXTERNA_INVALIDA'; end if;

  select id, estado into v_id, v_antes from public.conexion_pago_negocio
   where negocio_id = p_negocio_id and proveedor = 'MERCADOPAGO' for update;

  if v_id is null then
    insert into public.conexion_pago_negocio (negocio_id, proveedor, estado, entorno, cuenta_externa_id,
      access_token_cifrado, refresh_token_cifrado, token_expira_at, scopes, conectada_at)
    values (p_negocio_id, 'MERCADOPAGO', 'CONECTADA', p_entorno, p_cuenta_externa,
      p_access_cifrado, p_refresh_cifrado, p_expira_at, p_scopes, now())
    returning id into v_id;
  else
    update public.conexion_pago_negocio
       set estado = 'CONECTADA', entorno = p_entorno, cuenta_externa_id = p_cuenta_externa,
           access_token_cifrado = p_access_cifrado, refresh_token_cifrado = p_refresh_cifrado,
           token_expira_at = p_expira_at, scopes = p_scopes, conectada_at = now(), revocada_at = null,
           ultimo_error = null, updated_at = now()
     where id = v_id;
  end if;

  perform public._conexion_evento(v_id, p_negocio_id, v_antes, 'CONECTADA', 'BARBERIA', p_actor,
                                  jsonb_build_object('entorno', p_entorno, 'cuenta', '•••' || right(p_cuenta_externa, 4)));
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('conexion_pago_negocio', v_id, 'CONEXION_PAGO_CONECTADA', 'BARBERIA', p_actor, p_negocio_id,
          jsonb_build_object('entorno', p_entorno));
  return v_id;
end $$;
revoke all on function public.conexion_guardar(uuid, uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.conexion_guardar(uuid, uuid, text, text, text, text, timestamptz, text) to service_role;

-- Renovación de tokens (refresh rotativo: se guarda siempre el refresh nuevo).
create or replace function public.conexion_renovar_tokens(
  p_conexion_id uuid, p_access_cifrado text, p_refresh_cifrado text, p_expira_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare c public.conexion_pago_negocio;
begin
  select * into c from public.conexion_pago_negocio where id = p_conexion_id for update;
  if not found or c.estado not in ('CONECTADA','EXPIRADA') then raise exception 'CONEXION_NO_RENOVABLE'; end if;
  update public.conexion_pago_negocio
     set access_token_cifrado = p_access_cifrado, refresh_token_cifrado = p_refresh_cifrado,
         token_expira_at = p_expira_at, estado = 'CONECTADA', ultimo_error = null, updated_at = now()
   where id = p_conexion_id;
  perform public._conexion_evento(c.id, c.negocio_id, c.estado, 'CONECTADA', 'SISTEMA', null, jsonb_build_object('motivo', 'TOKEN_RENOVADO'));
end $$;
revoke all on function public.conexion_renovar_tokens(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.conexion_renovar_tokens(uuid, text, text, timestamptz) to service_role;

-- Estado real reportado por el proveedor (token revocado, expirado, error de API).
create or replace function public.conexion_marcar_estado(p_conexion_id uuid, p_estado text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.conexion_pago_negocio;
begin
  if p_estado not in ('EXPIRADA','REVOCADA','ERROR') then raise exception 'ESTADO_CONEXION_INVALIDO'; end if;
  select * into c from public.conexion_pago_negocio where id = p_conexion_id for update;
  if not found then raise exception 'CONEXION_NO_ENCONTRADA'; end if;
  if c.estado = p_estado then return; end if;
  update public.conexion_pago_negocio
     set estado = p_estado, ultimo_error = left(p_error, 500), updated_at = now(),
         revocada_at = case when p_estado = 'REVOCADA' then now() else revocada_at end,
         access_token_cifrado = case when p_estado = 'REVOCADA' then null else access_token_cifrado end,
         refresh_token_cifrado = case when p_estado = 'REVOCADA' then null else refresh_token_cifrado end
   where id = p_conexion_id;
  perform public._conexion_evento(c.id, c.negocio_id, c.estado, p_estado, 'SISTEMA', null, jsonb_build_object('error', left(p_error, 500)));
end $$;
revoke all on function public.conexion_marcar_estado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.conexion_marcar_estado(uuid, text, text) to service_role;

-- El dueño desconecta su cuenta: se borran los tokens, el historial se conserva.
create or replace function public.conexion_desconectar(p_negocio_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.conexion_pago_negocio;
begin
  if not (coalesce(public.is_barberia_de(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into c from public.conexion_pago_negocio where negocio_id = p_negocio_id and proveedor = 'MERCADOPAGO' for update;
  if not found or c.estado = 'REVOCADA' then return; end if;
  update public.conexion_pago_negocio
     set estado = 'REVOCADA', revocada_at = now(), access_token_cifrado = null, refresh_token_cifrado = null,
         ultimo_error = null, updated_at = now()
   where id = c.id;
  perform public._conexion_evento(c.id, c.negocio_id, c.estado, 'REVOCADA',
                                  case when coalesce(public.is_supersu(), false) then 'SUPERSU' else 'BARBERIA' end,
                                  auth.uid(), jsonb_build_object('motivo', p_motivo));
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('conexion_pago_negocio', c.id, 'CONEXION_PAGO_DESCONECTADA', 'BARBERIA', auth.uid(), p_negocio_id, p_motivo);
end $$;
revoke all on function public.conexion_desconectar(uuid, text) from public, anon, authenticated;
grant execute on function public.conexion_desconectar(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Beneficiario por tipo de pago y cuenta de cobro de cada pago
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.beneficiario_pago(p_tipo public.pago_tipo)
returns text language sql immutable set search_path = public as $$
  select case p_tipo
    when 'SENA' then 'NEGOCIO' when 'SALDO' then 'NEGOCIO' when 'PROPINA' then 'NEGOCIO'
    when 'GIFT_CARD' then 'NEGOCIO' when 'MEMBRESIA' then 'NEGOCIO'
    when 'SUSCRIPCION' then 'PLATAFORMA' when 'PAQUETE_CREDITOS_IA' then 'PLATAFORMA'
    when 'PAQUETE_CONVERSACIONES_WHATSAPP' then 'PLATAFORMA'
  end;
$$;
grant execute on function public.beneficiario_pago(public.pago_tipo) to anon, authenticated, service_role;

alter table public.pago
  add column if not exists cuenta_cobro text check (cuenta_cobro in ('PLATAFORMA','NEGOCIO')),
  add column if not exists conexion_pago_id uuid references public.conexion_pago_negocio(id),
  add column if not exists marketplace_fee numeric(12,2) not null default 0 check (marketplace_fee >= 0);

-- Pagos en línea (pasarela) creados desde ahora: la cuenta de cobro la decide la base, nunca
-- el código que inserta. Los pagos en el local (efectivo, datáfono propio) no pasan por la
-- pasarela: son del negocio y no requieren conexión.
create or replace function public.trg_pago_cuenta_cobro() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_benef text; v_conexion uuid;
begin
  v_benef := public.beneficiario_pago(new.tipo);
  if coalesce(new.pasarela, '') not in ('MERCADOPAGO', 'MERCADO_PAGO') then
    new.cuenta_cobro := coalesce(new.cuenta_cobro, v_benef);
    return new;
  end if;

  if v_benef = 'NEGOCIO' then
    select id into v_conexion from public.conexion_pago_negocio
     where negocio_id = new.negocio_id and proveedor = 'MERCADOPAGO' and estado = 'CONECTADA';
    if v_conexion is null then raise exception 'NEGOCIO_SIN_CUENTA_PAGO'; end if;
    new.cuenta_cobro := 'NEGOCIO';
    new.conexion_pago_id := v_conexion;
    -- Comisión de StylerNow (0 % por defecto) que Mercado Pago retiene como marketplace_fee.
    -- La fija la base con el % vigente del negocio; el código nunca la envía.
    select round(new.monto * coalesce(n.comision_plataforma_pct, 0) / 100, 0) into new.marketplace_fee
      from public.negocio n where n.id = new.negocio_id;
    new.marketplace_fee := least(coalesce(new.marketplace_fee, 0), new.monto);
  else
    new.cuenta_cobro := 'PLATAFORMA';
    new.conexion_pago_id := null;
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_cuenta_cobro() from public, anon, authenticated;

drop trigger if exists trg_pago_cuenta_cobro on public.pago;
create trigger trg_pago_cuenta_cobro before insert on public.pago
  for each row execute function public.trg_pago_cuenta_cobro();

-- La cuenta de cobro de un pago es parte de su identidad económica: no cambia nunca.
create or replace function public.trg_pago_cuenta_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  if (old.cuenta_cobro is not null and new.cuenta_cobro is distinct from old.cuenta_cobro)
     or (old.conexion_pago_id is not null and new.conexion_pago_id is distinct from old.conexion_pago_id)
     or new.marketplace_fee is distinct from old.marketplace_fee then
    raise exception 'PAGO_CAMPO_INMUTABLE';
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_cuenta_inmutable() from public, anon, authenticated;
drop trigger if exists trg_pago_cuenta_inmutable on public.pago;
create trigger trg_pago_cuenta_inmutable before update on public.pago
  for each row execute function public.trg_pago_cuenta_inmutable();

-- Histórico: los pagos anteriores se cobraron con la cuenta central (custodia). Se marcan
-- como PLATAFORMA, que es lo que ocurrió, sin tocar montos ni estados.
update public.pago set cuenta_cobro = 'PLATAFORMA'
 where cuenta_cobro is null and coalesce(pasarela, '') in ('MERCADOPAGO', 'MERCADO_PAGO', 'WOMPI');
update public.pago set cuenta_cobro = public.beneficiario_pago(tipo) where cuenta_cobro is null;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Anticipo solo si el negocio cobra con su cuenta; reserva sin anticipo = confirmada
-- ════════════════════════════════════════════════════════════════════════

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.calcular_sena(uuid,numeric)'::regprocedure);
  if position('-- El Negocio puede habilitar el cobro del 100% en app' in v_def) = 0 then
    raise exception 'calcular_sena cambió: revisar el parche de la 119 a mano';
  end if;
  v_def := replace(v_def, '-- El Negocio puede habilitar el cobro del 100% en app',
    '-- 119: sin cuenta de cobro propia conectada no se cobra anticipo en línea (nunca a la cuenta de StylerNow).
  if not public.negocio_cobra_en_linea(p_negocio_id) then
    return 0;
  end if;

  -- El Negocio puede habilitar el cobro del 100% en app');
  execute v_def;
end $$;

do $$
declare r record; v_def text; v_viejo text := '''PENDIENTE_PAGO'', v_monto_total, v_sena,';
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('crear_reserva', 'crear_reserva_manual')
  loop
    v_def := pg_get_functiondef(r.oid);
    if position(v_viejo in v_def) > 0 then
      v_def := replace(v_def, v_viejo,
        'case when v_sena > 0 then ''PENDIENTE_PAGO''::public.reserva_estado else ''CONFIRMADA''::public.reserva_estado end, v_monto_total, v_sena,');
      v_def := replace(v_def, 'v_buf_prev, v_buf_post, now() + interval ''10 minutes'',',
                              'v_buf_prev, v_buf_post, case when v_sena > 0 then now() + interval ''10 minutes'' end,');
      execute v_def;
    elsif r.proname = 'crear_reserva' then
      raise exception 'crear_reserva cambió: revisar el parche de la 119 a mano';
    end if;
  end loop;
end $$;

-- Con cobro directo el dinero ya está en la cuenta del negocio: NO se acredita el wallet
-- (que representa lo que StylerNow le debe) y la comisión es el marketplace_fee del pago.
-- Los pagos históricos en custodia (cuenta PLATAFORMA) siguen el flujo anterior.
-- Búsqueda tolerante a espacios y saltos de línea (\s+): al pegar desde un editor en Windows los
-- saltos llegan como CRLF y un literal de varias líneas no coincidiría con la definición (LF).
do $$
declare
  v_def text := pg_get_functiondef('public.aplicar_evento_pago(uuid,text,pago_estado,jsonb)'::regprocedure);
  v_calc text := 'v_comision := round(v_pago.monto * coalesce(v_negocio.comision_plataforma_pct, 0) / 100, 2);';
  v_wallet_re text := 'if\s+v_negocio\.id\s+is\s+not\s+null\s+then(\s+)select\s+id\s+into\s+v_wallet_id\s+from\s+public\.wallet';
begin
  if position('cuenta_cobro' in v_def) > 0 then
    return;  -- ya parcheada (re-ejecución)
  end if;
  if position(v_calc in v_def) = 0 or v_def !~ v_wallet_re then
    raise exception 'aplicar_evento_pago cambió (¿falta la 117?): revisar el parche de la 119 a mano';
  end if;
  v_def := replace(v_def, v_calc,
    'v_comision := case when v_pago.cuenta_cobro = ''NEGOCIO'' then v_pago.marketplace_fee else round(v_pago.monto * coalesce(v_negocio.comision_plataforma_pct, 0) / 100, 2) end;');
  v_def := regexp_replace(v_def, v_wallet_re,
    'if v_negocio.id is not null and v_pago.cuenta_cobro is distinct from ''NEGOCIO'' then\1select id into v_wallet_id from public.wallet');
  execute v_def;
end $$;
revoke all on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_evento_pago(uuid, text, pago_estado, jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Registro idempotente de webhooks
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.webhook_evento (
  id bigserial primary key,
  proveedor text not null,
  request_id text not null,
  data_id text,
  topico text,
  conexion_id uuid,
  recibido_at timestamptz not null default now(),
  procesado_at timestamptz,
  resultado text,
  unique (proveedor, request_id)
);
alter table public.webhook_evento enable row level security;
create policy webhook_evento_supersu on public.webhook_evento for select to authenticated using (public.is_supersu());
revoke all on public.webhook_evento from public, anon;
revoke insert, update, delete, truncate on public.webhook_evento from authenticated;
grant select on public.webhook_evento to authenticated, service_role;
revoke all on sequence public.webhook_evento_id_seq from public, anon, authenticated;

-- Registra la recepción. Devuelve false si ese request_id ya se procesó con éxito (duplicado).
create or replace function public.webhook_registrar(
  p_proveedor text, p_request_id text, p_data_id text, p_topico text, p_conexion_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_proc timestamptz;
begin
  if coalesce(p_request_id, '') = '' then return true; end if;  -- sin id: se procesa (la idempotencia de negocio protege)
  insert into public.webhook_evento (proveedor, request_id, data_id, topico, conexion_id)
  values (p_proveedor, left(p_request_id, 200), left(p_data_id, 40), left(p_topico, 60), p_conexion_id)
  on conflict (proveedor, request_id) do nothing;
  select procesado_at into v_proc from public.webhook_evento where proveedor = p_proveedor and request_id = left(p_request_id, 200);
  return v_proc is null;
end $$;
revoke all on function public.webhook_registrar(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.webhook_registrar(text, text, text, text, uuid) to service_role;

create or replace function public.webhook_marcar_procesado(p_proveedor text, p_request_id text, p_resultado text)
returns void language sql security definer set search_path = public as $$
  update public.webhook_evento set procesado_at = now(), resultado = left(p_resultado, 60)
   where proveedor = p_proveedor and request_id = left(p_request_id, 200) and procesado_at is null;
$$;
revoke all on function public.webhook_marcar_procesado(text, text, text) from public, anon, authenticated;
grant execute on function public.webhook_marcar_procesado(text, text, text) to service_role;
