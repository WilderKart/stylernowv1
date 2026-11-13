-- 130 · Webhooks de Mercado Pago: trazabilidad completa y estados posteriores a la aprobación.
--
-- Aditiva. No modifica aplicar_evento_pago ni las firmas de funciones existentes.
--   1. webhook_evento: barbería, pago, estado del proveedor, entorno, error e intentos (sin secretos,
--      sin tokens, sin datos del pagador).
--   2. webhook_registrar: mismo contrato; ahora cuenta reintentos.
--   3. webhook_registrar_resultado: deja constancia del resultado (procesado o error para reintento).
--   4. pago_registrar_disputa: contracargo / mediación → EN_DISPUTA (el libro lo anota como
--      REQUIERE_REVISION por el trigger existente de la 122). Nunca toca dinero.

-- ── 1. Columnas de trazabilidad ─────────────────────────────────────────────
alter table public.webhook_evento
  add column if not exists firma text,
  add column if not exists negocio_id uuid,
  add column if not exists pago_id uuid,
  add column if not exists estado_proveedor text,
  add column if not exists live_mode boolean,
  add column if not exists error text,
  add column if not exists intentos integer not null default 1,
  add column if not exists ultimo_intento_at timestamptz not null default now();

do $$ begin
  alter table public.webhook_evento add constraint webhook_evento_firma_valida
    check (firma is null or firma in ('VALIDA', 'SIN_SECRETO_LOCAL'));
exception when duplicate_object then null; end $$;

create index if not exists webhook_evento_negocio_idx on public.webhook_evento (negocio_id, recibido_at desc) where negocio_id is not null;
create index if not exists webhook_evento_data_idx on public.webhook_evento (proveedor, data_id);
create index if not exists webhook_evento_pendiente_idx on public.webhook_evento (recibido_at) where procesado_at is null;

-- ── 2. Registro idempotente (mismo contrato que la 119, ahora cuenta reintentos) ──
create or replace function public.webhook_registrar(
  p_proveedor text, p_request_id text, p_data_id text, p_topico text, p_conexion_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_proc timestamptz;
begin
  if coalesce(p_request_id, '') = '' then return true; end if;
  insert into public.webhook_evento (proveedor, request_id, data_id, topico, conexion_id)
  values (p_proveedor, left(p_request_id, 200), left(p_data_id, 40), left(p_topico, 60), p_conexion_id)
  on conflict (proveedor, request_id) do update
     set intentos = public.webhook_evento.intentos + 1, ultimo_intento_at = now();
  select procesado_at into v_proc from public.webhook_evento
   where proveedor = p_proveedor and request_id = left(p_request_id, 200);
  return v_proc is null;
end $$;
revoke all on function public.webhook_registrar(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.webhook_registrar(text, text, text, text, uuid) to service_role;

-- ── 3. Resultado del procesamiento ──────────────────────────────────────────
-- p_procesado = false deja el evento pendiente (Mercado Pago reintenta y se vuelve a procesar).
create or replace function public.webhook_registrar_resultado(
  p_proveedor text, p_request_id text, p_procesado boolean, p_resultado text,
  p_firma text default null, p_negocio_id uuid default null, p_pago_id uuid default null,
  p_estado_proveedor text default null, p_live_mode boolean default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_request_id, '') = '' then return; end if;
  update public.webhook_evento
     set resultado        = left(p_resultado, 60),
         firma            = coalesce(p_firma, firma),
         negocio_id       = coalesce(p_negocio_id, negocio_id),
         pago_id          = coalesce(p_pago_id, pago_id),
         estado_proveedor = coalesce(left(p_estado_proveedor, 40), estado_proveedor),
         live_mode        = coalesce(p_live_mode, live_mode),
         error            = left(p_error, 300),
         procesado_at     = case when coalesce(p_procesado, false) then coalesce(procesado_at, now()) else procesado_at end
   where proveedor = p_proveedor and request_id = left(p_request_id, 200);
end $$;
revoke all on function public.webhook_registrar_resultado(text, text, boolean, text, text, uuid, uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.webhook_registrar_resultado(text, text, boolean, text, text, uuid, uuid, text, boolean, text) to service_role;

-- ── 4. Contracargo / mediación sobre un pago ya aprobado ───────────────────
-- Solo con la transacción que aprobó ese pago (no se puede marcar un pago ajeno) y solo desde
-- APROBADO o REEMBOLSADO_PARCIAL. Idempotente: si ya está EN_DISPUTA no hace nada.
create or replace function public.pago_registrar_disputa(
  p_pago_id uuid, p_id_transaccion text, p_estado_proveedor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pago public.pago;
begin
  select * into v_pago from public.pago where id = p_pago_id for update;
  if not found then return jsonb_build_object('procesado', false, 'motivo', 'PAGO_NO_ENCONTRADO'); end if;
  if coalesce(v_pago.id_transaccion_pasarela, '') is distinct from coalesce(p_id_transaccion, '-') then
    return jsonb_build_object('procesado', false, 'motivo', 'TRANSACCION_NO_COINCIDE');
  end if;
  if v_pago.estado = 'EN_DISPUTA' then
    return jsonb_build_object('procesado', false, 'motivo', 'YA_EN_DISPUTA');
  end if;
  if v_pago.estado not in ('APROBADO', 'REEMBOLSADO_PARCIAL') then
    return jsonb_build_object('procesado', false, 'motivo', 'ESTADO_NO_ADMITE_DISPUTA', 'estado', v_pago.estado);
  end if;

  update public.pago set estado = 'EN_DISPUTA', updated_at = now() where id = p_pago_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_antes, payload_despues)
  values ('pago', p_pago_id, 'PAGO_EN_DISPUTA', 'SISTEMA', v_pago.negocio_id,
          jsonb_build_object('estado', v_pago.estado),
          jsonb_build_object('estado', 'EN_DISPUTA', 'estado_proveedor', left(p_estado_proveedor, 40), 'id_transaccion', p_id_transaccion));

  return jsonb_build_object('procesado', true, 'negocio_id', v_pago.negocio_id, 'reserva_id', v_pago.reserva_id);
end $$;
revoke all on function public.pago_registrar_disputa(uuid, text, text) from public, anon, authenticated;
grant execute on function public.pago_registrar_disputa(uuid, text, text) to service_role;
