-- 124: Infraestructura de notificaciones independiente del proveedor (email + web push + panel) con Outbox.
--
-- Diseño
--  * `notificacion_outbox` es la cola durable. Los productores (triggers AFTER sobre reserva, pago,
--    reembolso y suscripción, más el generador programado de recordatorios) SOLO encolan; nunca envían.
--    El envío lo hace el worker del servidor (src/lib/notificaciones/worker.ts) con service_role.
--  * `notificacion_envio` (004) se conserva intacta: es el log histórico que usa 049 con PANEL_INTERNO.
--    No se reutiliza porque su `enviado_at not null default now()` significa "enviado" desde el INSERT,
--    lo cual contradice la regla de no marcar ENVIADO sin evidencia del proveedor.
--  * `notificacion_usuario` + `_notificar()` + `trg_reserva_notificar` (093) siguen funcionando igual.
--    Para no duplicar avisos dentro de la app, el canal PANEL del outbox solo se usa para destinatarios
--    del negocio y para eventos que 093 no cubre.
--  * WhatsApp vive en su propio módulo (120). Este outbox no tiene canal WhatsApp; si en el futuro se
--    quiere, se agrega el valor al CHECK y un adaptador que delegue en src/lib/whatsapp.
--  * Estado ENVIADO exige `id_externo` (id del proveedor o id de la fila de notificacion_usuario).
--    Sin canal configurado, el worker marca CANAL_NO_HABILITADO; nunca ENVIADO.
--  * MARKETING exige consentimiento vigente: EMAIL → `consentimiento_evento` 'marketing_email';
--    PUSH/PANEL → opt-in explícito en `notificacion_preferencia` (no existe propósito 'marketing_push').
--    Se verifica al encolar Y al tomar el lote (por si el usuario retiró el consentimiento entre medio).
--  * Preferencias TRANSACCIONALES: se pueden apagar por evento y canal, salvo el EMAIL de los eventos
--    marcados `esencial` (confirmación, cancelación, reprogramación, no-show, pagos, reembolsos, plan
--    vencido o suspendido): ese correo es la constancia de una operación con efectos económicos o sobre
--    la cita y no se puede desactivar. El push de esos eventos sí.
--
-- Re-ejecutable: create ... if not exists, create or replace, drop ... if exists, semillas sin duplicar.

-- ── Catálogo de eventos ────────────────────────────────────────────────────
create table if not exists public.notificacion_evento (
  codigo text primary key check (codigo ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  categoria text not null check (categoria in ('TRANSACCIONAL', 'MARKETING')),
  audiencia text not null check (audiencia in ('CLIENTE', 'NEGOCIO')),
  esencial boolean not null default false,
  descripcion_es text not null,
  descripcion_en text not null,
  constraint notificacion_evento_marketing_no_esencial check (not (categoria = 'MARKETING' and esencial))
);
alter table public.notificacion_evento enable row level security;
revoke all on public.notificacion_evento from public, anon, authenticated;

insert into public.notificacion_evento (codigo, categoria, audiencia, esencial, descripcion_es, descripcion_en) values
  ('RESERVA_CREADA',                  'TRANSACCIONAL', 'CLIENTE', false, 'Reserva creada, pendiente de pago', 'Booking created, payment pending'),
  ('RESERVA_CONFIRMADA',              'TRANSACCIONAL', 'CLIENTE', true,  'Cita confirmada', 'Appointment confirmed'),
  ('RESERVA_REPROGRAMADA',            'TRANSACCIONAL', 'CLIENTE', true,  'Cita reprogramada', 'Appointment rescheduled'),
  ('RESERVA_CANCELADA',               'TRANSACCIONAL', 'CLIENTE', true,  'Cita cancelada', 'Appointment cancelled'),
  ('RESERVA_COMPLETADA',              'TRANSACCIONAL', 'CLIENTE', false, 'Visita completada', 'Visit completed'),
  ('RESERVA_NO_SHOW',                 'TRANSACCIONAL', 'CLIENTE', true,  'Inasistencia registrada', 'No-show recorded'),
  ('RESERVA_RECORDATORIO',            'TRANSACCIONAL', 'CLIENTE', false, 'Recordatorio de cita', 'Appointment reminder'),
  ('NEGOCIO_RESERVA_NUEVA',           'TRANSACCIONAL', 'NEGOCIO', false, 'Nueva reserva confirmada', 'New confirmed booking'),
  ('NEGOCIO_RESERVA_REPROGRAMADA',    'TRANSACCIONAL', 'NEGOCIO', false, 'Reserva reprogramada', 'Booking rescheduled'),
  ('NEGOCIO_RESERVA_CANCELADA',       'TRANSACCIONAL', 'NEGOCIO', false, 'Reserva cancelada', 'Booking cancelled'),
  ('NEGOCIO_CLIENTE_NUEVO',           'TRANSACCIONAL', 'NEGOCIO', false, 'Cliente nuevo', 'New client'),
  ('SUSCRIPCION_PRUEBA_POR_TERMINAR', 'TRANSACCIONAL', 'NEGOCIO', false, 'Tu prueba gratuita está por terminar', 'Your free trial is ending'),
  ('SUSCRIPCION_VENCIDA',             'TRANSACCIONAL', 'NEGOCIO', true,  'Plan vencido o en mora', 'Plan expired or overdue'),
  ('SUSCRIPCION_SUSPENDIDA',          'TRANSACCIONAL', 'NEGOCIO', true,  'Plan suspendido', 'Plan suspended'),
  ('SUSCRIPCION_REACTIVADA',          'TRANSACCIONAL', 'NEGOCIO', false, 'Plan reactivado', 'Plan reactivated'),
  ('PAGO_CONFIRMADO',                 'TRANSACCIONAL', 'CLIENTE', true,  'Pago confirmado', 'Payment confirmed'),
  ('ANTICIPO_RECIBIDO',               'TRANSACCIONAL', 'CLIENTE', true,  'Anticipo recibido', 'Deposit received'),
  ('NEGOCIO_ANTICIPO_RECIBIDO',       'TRANSACCIONAL', 'NEGOCIO', false, 'Anticipo recibido de un cliente', 'Deposit received from a client'),
  ('PAGO_RECHAZADO',                  'TRANSACCIONAL', 'CLIENTE', true,  'Pago rechazado', 'Payment declined'),
  ('REEMBOLSO_SOLICITADO',            'TRANSACCIONAL', 'CLIENTE', true,  'Reembolso solicitado', 'Refund requested'),
  ('REEMBOLSO_CONFIRMADO',            'TRANSACCIONAL', 'CLIENTE', true,  'Reembolso confirmado', 'Refund confirmed'),
  ('REEMBOLSO_EN_REVISION',           'TRANSACCIONAL', 'CLIENTE', true,  'Reembolso en revisión', 'Refund under review'),
  ('MARKETING_NOVEDADES',             'MARKETING',     'CLIENTE', false, 'Novedades y ofertas', 'News and offers')
on conflict (codigo) do nothing;

-- ── Plantillas (global + override opcional por negocio) ───────────────────
create table if not exists public.notificacion_plantilla (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.notificacion_evento(codigo),
  canal text not null check (canal in ('EMAIL', 'PUSH', 'PANEL')),
  idioma text not null check (idioma in ('es', 'en')),
  negocio_id uuid references public.negocio(id) on delete cascade,
  asunto text not null check (length(asunto) between 1 and 200),
  -- {{variable}}: el renderizador escapa HTML en los valores (EMAIL) o los inserta como texto (PUSH/PANEL).
  cuerpo text not null check (length(cuerpo) between 1 and 20000),
  version integer not null default 1 check (version >= 1),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists notificacion_plantilla_activa_uq
  on public.notificacion_plantilla (codigo, canal, idioma, negocio_id) nulls not distinct where activa;
alter table public.notificacion_plantilla enable row level security;
revoke all on public.notificacion_plantilla from public, anon, authenticated;

-- ── Preferencias por usuario (evento × canal) ─────────────────────────────
create table if not exists public.notificacion_preferencia (
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  evento text not null references public.notificacion_evento(codigo),
  canal text not null check (canal in ('EMAIL', 'PUSH')),
  activo boolean not null,
  updated_at timestamptz not null default now(),
  primary key (usuario_id, evento, canal)
);
alter table public.notificacion_preferencia enable row level security;
revoke all on public.notificacion_preferencia from public, anon, authenticated;
grant select on public.notificacion_preferencia to authenticated;
drop policy if exists notificacion_preferencia_select_propia on public.notificacion_preferencia;
create policy notificacion_preferencia_select_propia on public.notificacion_preferencia
  for select to authenticated using (usuario_id = auth.uid());

-- ── Suscripciones de web push ─────────────────────────────────────────────
create table if not exists public.notificacion_push_suscripcion (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 20 and 1024),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}={0,2}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{21,24}={0,2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notificacion_push_usuario_idx on public.notificacion_push_suscripcion (usuario_id);
alter table public.notificacion_push_suscripcion enable row level security;
revoke all on public.notificacion_push_suscripcion from public, anon, authenticated;
-- Solo columnas no sensibles: las claves del navegador no se devuelven a la API.
grant select (id, usuario_id, endpoint, created_at) on public.notificacion_push_suscripcion to authenticated;
drop policy if exists notificacion_push_select_propia on public.notificacion_push_suscripcion;
create policy notificacion_push_select_propia on public.notificacion_push_suscripcion
  for select to authenticated using (usuario_id = auth.uid());

-- ── Outbox ────────────────────────────────────────────────────────────────
create table if not exists public.notificacion_outbox (
  id uuid primary key default gen_random_uuid(),
  evento text not null references public.notificacion_evento(codigo),
  usuario_id uuid not null references public.perfil(id) on delete cascade,
  negocio_id uuid references public.negocio(id) on delete set null,
  canal text not null check (canal in ('EMAIL', 'PUSH', 'PANEL')),
  categoria text not null check (categoria in ('TRANSACCIONAL', 'MARKETING')),
  plantilla text not null,
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 400),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'PROCESANDO', 'ENVIADO', 'FALLIDO',
    'REINTENTANDO', 'CANAL_NO_HABILITADO', 'OMITIDO_PREFERENCIA')),
  intentos integer not null default 0 check (intentos >= 0),
  max_intentos integer not null default 5 check (max_intentos between 1 and 20),
  -- En PENDIENTE/REINTENTANDO: cuándo puede tomarse. En PROCESANDO: vencimiento del lease del worker.
  proximo_intento_at timestamptz,
  ultimo_error text check (length(ultimo_error) <= 200),
  id_externo text check (length(id_externo) <= 300),
  enviado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notificacion_outbox_enviado_con_evidencia check (
    estado <> 'ENVIADO' or (id_externo is not null and length(btrim(id_externo)) > 0 and enviado_at is not null))
);
create index if not exists notificacion_outbox_cola_idx on public.notificacion_outbox (canal, estado, proximo_intento_at)
  where estado in ('PENDIENTE', 'REINTENTANDO', 'PROCESANDO');
create index if not exists notificacion_outbox_usuario_idx on public.notificacion_outbox (usuario_id, created_at desc);
alter table public.notificacion_outbox enable row level security;
revoke all on public.notificacion_outbox from public, anon, authenticated;
grant select on public.notificacion_outbox to authenticated;
drop policy if exists notificacion_outbox_select_propia on public.notificacion_outbox;
create policy notificacion_outbox_select_propia on public.notificacion_outbox
  for select to authenticated using (usuario_id = auth.uid());

-- Historial append-only de cada transición.
create table if not exists public.notificacion_outbox_evento (
  id bigint generated always as identity primary key,
  outbox_id uuid not null references public.notificacion_outbox(id) on delete cascade,
  estado_origen text,
  estado_destino text not null,
  intento integer not null default 0,
  detalle text,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists notificacion_outbox_evento_idx on public.notificacion_outbox_evento (outbox_id, id);
alter table public.notificacion_outbox_evento enable row level security;
revoke all on public.notificacion_outbox_evento from public, anon, authenticated;

-- ── Máquina de estados (vale para todos los roles, incluido service_role) ──
create or replace function public.trg_notif_outbox_maquina()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.estado not in ('PENDIENTE', 'OMITIDO_PREFERENCIA') or new.intentos <> 0
       or new.id_externo is not null or new.enviado_at is not null then
      raise exception 'OUTBOX_ESTADO_INICIAL_INVALIDO';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Solo la cascada por eliminación del perfil (derecho de supresión) puede borrar filas.
    if exists (select 1 from public.perfil p where p.id = old.usuario_id) then
      raise exception 'REGISTRO_INMUTABLE';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id or new.evento is distinct from old.evento
     or new.usuario_id is distinct from old.usuario_id or new.canal is distinct from old.canal
     or new.categoria is distinct from old.categoria or new.plantilla is distinct from old.plantilla
     or new.datos is distinct from old.datos or new.idioma is distinct from old.idioma
     or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at
     or new.max_intentos is distinct from old.max_intentos
     or (new.negocio_id is distinct from old.negocio_id and new.negocio_id is not null) then
    raise exception 'OUTBOX_CAMPO_INMUTABLE';
  end if;

  if new.estado = old.estado then
    -- Estados finales: solo se tolera la cascada ON DELETE SET NULL de negocio_id.
    if old.estado in ('ENVIADO', 'FALLIDO', 'OMITIDO_PREFERENCIA') and (
         new.intentos is distinct from old.intentos or new.id_externo is distinct from old.id_externo
         or new.enviado_at is distinct from old.enviado_at or new.ultimo_error is distinct from old.ultimo_error
         or new.proximo_intento_at is distinct from old.proximo_intento_at) then
      raise exception 'OUTBOX_REGISTRO_CERRADO';
    end if;
    if new.estado <> 'ENVIADO' and new.id_externo is not null then
      raise exception 'OUTBOX_ID_EXTERNO_SOLO_EN_ENVIADO';
    end if;
    return new;
  end if;

  -- TRANSICIONES:INICIO (tests/notificaciones.test.ts compara esta lista con src/lib/notificaciones/estados.ts)
  if not exists (select 1 from (values
      ('PENDIENTE', 'PROCESANDO'),
      ('PENDIENTE', 'OMITIDO_PREFERENCIA'),
      ('REINTENTANDO', 'PROCESANDO'),
      ('REINTENTANDO', 'OMITIDO_PREFERENCIA'),
      ('PROCESANDO', 'ENVIADO'),
      ('PROCESANDO', 'REINTENTANDO'),
      ('PROCESANDO', 'FALLIDO'),
      ('PROCESANDO', 'CANAL_NO_HABILITADO'),
      ('PROCESANDO', 'OMITIDO_PREFERENCIA'),
      ('CANAL_NO_HABILITADO', 'PENDIENTE')
    ) t(origen, destino) where t.origen = old.estado and t.destino = new.estado) then
  -- TRANSICIONES:FIN
    raise exception 'TRANSICION_OUTBOX_INVALIDA: % -> %', old.estado, new.estado;
  end if;

  if new.estado = 'ENVIADO' then
    if coalesce(length(btrim(new.id_externo)), 0) = 0 then
      raise exception 'ENVIADO_REQUIERE_ID_EXTERNO';
    end if;
    new.enviado_at := coalesce(new.enviado_at, now());
  elsif new.id_externo is not null then
    raise exception 'OUTBOX_ID_EXTERNO_SOLO_EN_ENVIADO';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.trg_notif_outbox_maquina() from public, anon, authenticated;
drop trigger if exists trg_notif_outbox_maquina on public.notificacion_outbox;
create trigger trg_notif_outbox_maquina before insert or update or delete on public.notificacion_outbox
  for each row execute function public.trg_notif_outbox_maquina();

create or replace function public.trg_notif_outbox_historial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.notificacion_outbox_evento (outbox_id, estado_origen, estado_destino, intento, detalle)
    values (new.id, case when tg_op = 'UPDATE' then old.estado end, new.estado, new.intentos, new.ultimo_error);
  end if;
  return null;
end $$;
revoke all on function public.trg_notif_outbox_historial() from public, anon, authenticated;
drop trigger if exists trg_notif_outbox_historial on public.notificacion_outbox;
create trigger trg_notif_outbox_historial after insert or update on public.notificacion_outbox
  for each row execute function public.trg_notif_outbox_historial();

create or replace function public.trg_notif_outbox_evento_inmutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.notificacion_outbox o where o.id = old.outbox_id) then
    return old;  -- cascada desde la fila del outbox (que a su vez solo se borra con el perfil)
  end if;
  raise exception 'REGISTRO_INMUTABLE';
end $$;
revoke all on function public.trg_notif_outbox_evento_inmutable() from public, anon, authenticated;
drop trigger if exists trg_notif_outbox_evento_inmutable on public.notificacion_outbox_evento;
create trigger trg_notif_outbox_evento_inmutable before update or delete on public.notificacion_outbox_evento
  for each row execute function public.trg_notif_outbox_evento_inmutable();

-- ── Utilidades internas ───────────────────────────────────────────────────
create or replace function public._notif_plantilla(p_codigo text, p_canal text, p_idioma text, p_negocio uuid)
returns table (asunto text, cuerpo text, version integer)
language sql stable security definer set search_path = public as $$
  select t.asunto, t.cuerpo, t.version
  from public.notificacion_plantilla t
  where t.codigo = p_codigo and t.canal = p_canal and t.activa
    and (t.negocio_id is null or t.negocio_id = p_negocio)
  order by (t.negocio_id is not null) desc, (t.idioma = p_idioma) desc, (t.idioma = 'es') desc, t.version desc
  limit 1;
$$;
revoke all on function public._notif_plantilla(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public._notif_plantilla(text, text, text, uuid) to service_role;

-- Texto plano (PUSH/PANEL): {{clave}} → valor. Mismo contrato que renderizarTexto() en TS.
create or replace function public._notif_render_texto(p_texto text, p_datos jsonb)
returns text language plpgsql immutable security definer set search_path = public as $$
declare v_out text := coalesce(p_texto, ''); v_k text; v_v text;
begin
  for v_k, v_v in select e.key, e.value from jsonb_each_text(coalesce(p_datos, '{}'::jsonb)) e
                  where e.key ~ '^[A-Za-z0-9_]{1,40}$' loop
    v_out := replace(v_out, '{{' || v_k || '}}', coalesce(v_v, ''));
  end loop;
  return regexp_replace(v_out, '\{\{[A-Za-z0-9_]+\}\}', '', 'g');
end $$;
revoke all on function public._notif_render_texto(text, jsonb) from public, anon, authenticated;
grant execute on function public._notif_render_texto(text, jsonb) to service_role;

create or replace function public._notif_monto(p_monto numeric, p_negocio uuid)
returns text language sql stable security definer set search_path = public as $$
  select replace(to_char(round(coalesce(p_monto, 0)), 'FM999,999,999,990'), ',', '.')
         || coalesce(' ' || (select pa.moneda from public.negocio n join public.pais pa on pa.codigo = n.pais_codigo
                             where n.id = p_negocio), '');
$$;
revoke all on function public._notif_monto(numeric, uuid) from public, anon, authenticated;

-- Encola UNA notificación (un usuario, un canal). Idempotente por (clave, canal, usuario).
-- Devuelve el id (nuevo o existente) o null si no aplica (usuario inexistente, push sin suscripción).
create or replace function public._encolar_notificacion(
  p_evento text, p_usuario uuid, p_negocio uuid, p_canal text, p_datos jsonb, p_clave text,
  p_plantilla text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ev public.notificacion_evento;
  v_loc text;
  v_clave text;
  v_id uuid;
  v_pref boolean;
  v_estado text := 'PENDIENTE';
  v_motivo text;
  v_datos jsonb;
begin
  if p_usuario is null or p_canal is null or p_canal not in ('EMAIL', 'PUSH', 'PANEL')
     or coalesce(length(p_clave), 0) = 0 then
    return null;
  end if;
  select * into v_ev from public.notificacion_evento where codigo = p_evento;
  if not found then raise exception 'EVENTO_DESCONOCIDO'; end if;

  select p.locale into v_loc from public.perfil p where p.id = p_usuario;
  if not found then return null; end if;

  v_clave := left(p_clave, 300) || ':' || p_canal || ':' || p_usuario::text;
  select o.id into v_id from public.notificacion_outbox o where o.idempotency_key = v_clave;
  if found then return v_id; end if;

  -- Sin suscripción push no hay a quién entregar: no se encola (el usuario no optó por push).
  if p_canal = 'PUSH' and not exists (select 1 from public.notificacion_push_suscripcion s where s.usuario_id = p_usuario) then
    return null;
  end if;

  -- Los datos nunca llevan secretos: se descartan claves con nombres sensibles.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_datos
  from jsonb_each(case when jsonb_typeof(p_datos) = 'object' then p_datos else '{}'::jsonb end) e
  where e.key ~ '^[A-Za-z0-9_]{1,40}$'
    and e.key !~* '(token|secret|password|contrasena|clave|pin|cvv|tarjeta|card)';

  if p_canal in ('EMAIL', 'PUSH') then
    select np.activo into v_pref from public.notificacion_preferencia np
    where np.usuario_id = p_usuario and np.evento = p_evento and np.canal = p_canal;
  end if;

  if v_ev.categoria = 'MARKETING' then
    if p_canal = 'EMAIL' and not coalesce(public._consentimiento_vigente(p_usuario, 'marketing_email'), false) then
      v_estado := 'OMITIDO_PREFERENCIA'; v_motivo := 'SIN_CONSENTIMIENTO_MARKETING';
    elsif p_canal = 'EMAIL' and coalesce(v_pref, true) = false then
      v_estado := 'OMITIDO_PREFERENCIA'; v_motivo := 'PREFERENCIA_DESACTIVADA';
    elsif p_canal <> 'EMAIL' and not coalesce(v_pref, false) then
      v_estado := 'OMITIDO_PREFERENCIA'; v_motivo := 'SIN_OPT_IN_MARKETING';
    end if;
  elsif coalesce(v_pref, true) = false and not (v_ev.esencial and p_canal = 'EMAIL') then
    v_estado := 'OMITIDO_PREFERENCIA'; v_motivo := 'PREFERENCIA_DESACTIVADA';
  end if;

  insert into public.notificacion_outbox (evento, usuario_id, negocio_id, canal, categoria, plantilla, datos,
                                          idioma, idempotency_key, estado, ultimo_error)
  values (p_evento, p_usuario, p_negocio, p_canal, v_ev.categoria, coalesce(p_plantilla, p_evento), v_datos,
          case when v_loc = 'en' then 'en' else 'es' end, v_clave, v_estado, v_motivo)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select o.id into v_id from public.notificacion_outbox o where o.idempotency_key = v_clave;
  end if;
  return v_id;
end $$;
revoke all on function public._encolar_notificacion(text, uuid, uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public._encolar_notificacion(text, uuid, uuid, text, jsonb, text, text) to service_role;

-- Encola en varios canales; el fallo de un canal no impide los demás ni sube al llamador.
create or replace function public._notif_encolar_canales(
  p_evento text, p_usuario uuid, p_negocio uuid, p_datos jsonb, p_clave text, p_canales text[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_canal text; n integer := 0;
begin
  if p_usuario is null then return 0; end if;
  foreach v_canal in array coalesce(p_canales, array[]::text[]) loop
    begin
      if public._encolar_notificacion(p_evento, p_usuario, p_negocio, v_canal, p_datos, p_clave) is not null then
        n := n + 1;
      end if;
    exception when others then
      null;  -- subtransacción descartada; no hay nada escrito antes que se pierda
    end;
  end loop;
  return n;
end $$;
revoke all on function public._notif_encolar_canales(text, uuid, uuid, jsonb, text, text[]) from public, anon, authenticated;
grant execute on function public._notif_encolar_canales(text, uuid, uuid, jsonb, text, text[]) to service_role;

-- Datos de una reserva para las plantillas. p_para_negocio agrega el nombre del cliente y la ruta del panel.
create or replace function public._notif_datos_reserva(p_reserva public.reserva, p_para_negocio boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg text; v_tz text; v_cli text;
begin
  select n.nombre into v_neg from public.negocio n where n.id = p_reserva.negocio_id;
  select coalesce(s.zona_horaria, 'America/Bogota') into v_tz from public.sede s where s.id = p_reserva.sede_id;
  if p_para_negocio then
    select p.nombre into v_cli from public.perfil p where p.id = p_reserva.cliente_id;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'negocio', coalesce(v_neg, 'StylerNow'),
    'fecha', to_char(p_reserva.hora_inicio at time zone coalesce(v_tz, 'America/Bogota'), 'DD/MM/YYYY HH24:MI'),
    'cliente', case when p_para_negocio then coalesce(v_cli, '') end,
    'reserva_id', p_reserva.id::text,
    'ruta', case when p_para_negocio then '/panel/agenda' else '/reserva/' || p_reserva.id::text end));
end $$;
revoke all on function public._notif_datos_reserva(public.reserva, boolean) from public, anon, authenticated;

-- Destinatarios del lado del negocio: dueño + staff asignado (sin repetir).
create or replace function public._notif_destinatarios_negocio(p_negocio uuid, p_staff uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct u from (
    select n.owner_user_id as u from public.negocio n where n.id = p_negocio
    union all
    select p_staff where p_staff is not null
  ) x where u is not null;
$$;
revoke all on function public._notif_destinatarios_negocio(uuid, uuid) from public, anon, authenticated;

-- ── Productores (triggers AFTER: jamás hacen fallar la transacción de origen) ──
create or replace function public.trg_notif_reserva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cli jsonb; v_neg jsonb; v_u uuid; v_base text := 'reserva:' || new.id::text;
  c_cli constant text[] := array['EMAIL', 'PUSH'];
  c_neg constant text[] := array['EMAIL', 'PUSH', 'PANEL'];
begin
  begin
    v_cli := public._notif_datos_reserva(new, false);
    v_neg := public._notif_datos_reserva(new, true);

    if tg_op = 'INSERT' then
      if new.estado = 'CONFIRMADA' then
        perform public._notif_encolar_canales('RESERVA_CONFIRMADA', new.cliente_id, new.negocio_id, v_cli, v_base || ':confirmada', c_cli);
        for v_u in select * from public._notif_destinatarios_negocio(new.negocio_id, new.staff_id) loop
          perform public._notif_encolar_canales('NEGOCIO_RESERVA_NUEVA', v_u, new.negocio_id, v_neg, v_base || ':nueva', c_neg);
        end loop;
      elsif new.estado = 'PENDIENTE_PAGO' then
        perform public._notif_encolar_canales('RESERVA_CREADA', new.cliente_id, new.negocio_id, v_cli, v_base || ':creada', c_cli);
      end if;
      if not exists (select 1 from public.reserva x
                     where x.negocio_id = new.negocio_id and x.cliente_id = new.cliente_id and x.id <> new.id) then
        perform public._notif_encolar_canales('NEGOCIO_CLIENTE_NUEVO',
          (select n.owner_user_id from public.negocio n where n.id = new.negocio_id), new.negocio_id,
          v_neg - 'fecha', 'negocio:' || new.negocio_id::text || ':cliente_nuevo:' || new.cliente_id::text, c_neg);
      end if;
    else
      if new.estado is distinct from old.estado then
        if new.estado = 'CONFIRMADA' then
          perform public._notif_encolar_canales('RESERVA_CONFIRMADA', new.cliente_id, new.negocio_id, v_cli, v_base || ':confirmada', c_cli);
          for v_u in select * from public._notif_destinatarios_negocio(new.negocio_id, new.staff_id) loop
            perform public._notif_encolar_canales('NEGOCIO_RESERVA_NUEVA', v_u, new.negocio_id, v_neg, v_base || ':nueva', c_neg);
          end loop;
        elsif new.estado = 'CANCELADA' then
          perform public._notif_encolar_canales('RESERVA_CANCELADA', new.cliente_id, new.negocio_id, v_cli, v_base || ':cancelada', c_cli);
          for v_u in select * from public._notif_destinatarios_negocio(new.negocio_id, new.staff_id) loop
            perform public._notif_encolar_canales('NEGOCIO_RESERVA_CANCELADA', v_u, new.negocio_id, v_neg, v_base || ':neg_cancelada', c_neg);
          end loop;
        elsif new.estado = 'COMPLETADA' then
          perform public._notif_encolar_canales('RESERVA_COMPLETADA', new.cliente_id, new.negocio_id, v_cli, v_base || ':completada', c_cli);
        elsif new.estado = 'NO_SHOW' then
          perform public._notif_encolar_canales('RESERVA_NO_SHOW', new.cliente_id, new.negocio_id, v_cli, v_base || ':no_show', c_cli);
        end if;
      end if;
      if new.hora_inicio is distinct from old.hora_inicio and new.estado in ('CONFIRMADA', 'PENDIENTE_PAGO') then
        perform public._notif_encolar_canales('RESERVA_REPROGRAMADA', new.cliente_id, new.negocio_id, v_cli,
          v_base || ':reprog:' || extract(epoch from new.hora_inicio)::bigint, c_cli);
        for v_u in select * from public._notif_destinatarios_negocio(new.negocio_id, new.staff_id) loop
          perform public._notif_encolar_canales('NEGOCIO_RESERVA_REPROGRAMADA', v_u, new.negocio_id, v_neg,
            v_base || ':neg_reprog:' || extract(epoch from new.hora_inicio)::bigint, c_neg);
        end loop;
      end if;
    end if;
  exception when others then
    null;  -- notificar nunca rompe crear/confirmar/cancelar/reprogramar
  end;
  return null;
end $$;
revoke all on function public.trg_notif_reserva() from public, anon, authenticated;
drop trigger if exists trg_notif_reserva_ins on public.reserva;
create trigger trg_notif_reserva_ins after insert on public.reserva
  for each row execute function public.trg_notif_reserva();
drop trigger if exists trg_notif_reserva_upd on public.reserva;
create trigger trg_notif_reserva_upd after update of estado, hora_inicio on public.reserva
  for each row execute function public.trg_notif_reserva();

create or replace function public.trg_notif_suscripcion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_evento text; v_datos jsonb;
begin
  begin
    if new.estado is not distinct from old.estado then return null; end if;
    v_evento := case
      when new.estado in ('REQUIERE_PLAN', 'EN_MORA') then 'SUSCRIPCION_VENCIDA'
      when new.estado = 'SUSPENDIDA' then 'SUSCRIPCION_SUSPENDIDA'
      when new.estado = 'ACTIVA' and old.estado in ('EN_MORA', 'SUSPENDIDA', 'REQUIERE_PLAN') then 'SUSCRIPCION_REACTIVADA'
    end;
    if v_evento is null then return null; end if;
    select n.owner_user_id, jsonb_build_object('negocio', n.nombre, 'plan', new.plan_codigo::text, 'ruta', '/panel/suscripcion')
      into v_owner, v_datos
    from public.negocio n where n.id = new.negocio_id;
    -- La clave incluye el instante de la transacción: re-actualizar al mismo estado no dispara (filtro de arriba)
    -- y una transición real posterior sí genera su propio aviso.
    perform public._notif_encolar_canales(v_evento, v_owner, new.negocio_id, v_datos,
      'suscripcion:' || new.id::text || ':' || new.estado::text || ':' || extract(epoch from now())::bigint,
      array['EMAIL', 'PUSH', 'PANEL']);
  exception when others then
    null;
  end;
  return null;
end $$;
revoke all on function public.trg_notif_suscripcion() from public, anon, authenticated;
drop trigger if exists trg_notif_suscripcion on public.suscripcion;
create trigger trg_notif_suscripcion after update of estado on public.suscripcion
  for each row execute function public.trg_notif_suscripcion();

-- Pagos: SOLO desde estados ya confirmados en la base (APROBADO con id de transacción, o RECHAZADO).
-- No mueve dinero ni infiere confirmaciones.
create or replace function public.trg_notif_pago()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_res public.reserva; v_datos jsonb; v_owner uuid;
begin
  begin
    if new.reserva_id is null then return null; end if;  -- pagos sin reserva (plan, IA, recargas): sin destinatario cliente
    select * into v_res from public.reserva where id = new.reserva_id;
    if not found then return null; end if;
    v_datos := public._notif_datos_reserva(v_res, false) || jsonb_build_object('monto', public._notif_monto(new.monto, new.negocio_id));

    if new.estado = 'APROBADO' and coalesce(length(btrim(new.id_transaccion_pasarela)), 0) > 0
       and (tg_op = 'INSERT' or old.estado is distinct from 'APROBADO' or old.id_transaccion_pasarela is null) then
      if new.tipo = 'SENA' then
        perform public._notif_encolar_canales('ANTICIPO_RECIBIDO', v_res.cliente_id, v_res.negocio_id, v_datos,
          'pago:' || new.id::text || ':aprobado', array['EMAIL', 'PUSH']);
        select n.owner_user_id into v_owner from public.negocio n where n.id = v_res.negocio_id;
        perform public._notif_encolar_canales('NEGOCIO_ANTICIPO_RECIBIDO', v_owner, v_res.negocio_id,
          public._notif_datos_reserva(v_res, true) || jsonb_build_object('monto', public._notif_monto(new.monto, new.negocio_id)),
          'pago:' || new.id::text || ':aprobado_negocio', array['EMAIL', 'PUSH', 'PANEL']);
      else
        perform public._notif_encolar_canales('PAGO_CONFIRMADO', v_res.cliente_id, v_res.negocio_id, v_datos,
          'pago:' || new.id::text || ':aprobado', array['EMAIL', 'PUSH']);
      end if;
    elsif new.estado = 'RECHAZADO' and (tg_op = 'INSERT' or old.estado is distinct from 'RECHAZADO') then
      perform public._notif_encolar_canales('PAGO_RECHAZADO', v_res.cliente_id, v_res.negocio_id, v_datos,
        'pago:' || new.id::text || ':rechazado', array['EMAIL', 'PUSH']);
    end if;
  exception when others then
    null;
  end;
  return null;
end $$;
revoke all on function public.trg_notif_pago() from public, anon, authenticated;
drop trigger if exists trg_notif_pago on public.pago;
create trigger trg_notif_pago after insert or update of estado, id_transaccion_pasarela on public.pago
  for each row execute function public.trg_notif_pago();

create or replace function public.trg_notif_reembolso()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_evento text; v_sufijo text; v_datos jsonb;
begin
  begin
    if new.cliente_id is null then return null; end if;
    if tg_op = 'INSERT' then
      v_evento := 'REEMBOLSO_SOLICITADO'; v_sufijo := 'solicitado';
    elsif new.estado is distinct from old.estado and new.estado = 'REEMBOLSADO' then
      v_evento := 'REEMBOLSO_CONFIRMADO'; v_sufijo := 'confirmado';
    elsif new.estado is distinct from old.estado and new.estado = 'REQUIERE_REVISION' then
      v_evento := 'REEMBOLSO_EN_REVISION'; v_sufijo := 'revision';
    else
      return null;
    end if;
    v_datos := jsonb_build_object(
      'negocio', coalesce((select n.nombre from public.negocio n where n.id = new.negocio_id), 'StylerNow'),
      'monto', public._notif_monto(new.monto, new.negocio_id),
      'ruta', case when new.reserva_id is not null then '/reserva/' || new.reserva_id::text else '/mis-reservas' end);
    perform public._notif_encolar_canales(v_evento, new.cliente_id, new.negocio_id, v_datos,
      'reembolso:' || new.id::text || ':' || v_sufijo, array['EMAIL', 'PUSH']);
  exception when others then
    null;
  end;
  return null;
end $$;
revoke all on function public.trg_notif_reembolso() from public, anon, authenticated;
drop trigger if exists trg_notif_reembolso on public.reembolso;
create trigger trg_notif_reembolso after insert or update of estado on public.reembolso
  for each row execute function public.trg_notif_reembolso();

-- ── Generador programado (cron diario, service_role) ──────────────────────
create or replace function public.notif_generar_programadas(p_ventana_horas integer default 24)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_res public.reserva; v_rec integer := 0; v_pru integer := 0; v_tipo text;
begin
  for v_res in
    select re.* from public.reserva re
    where re.estado = 'CONFIRMADA' and re.hora_inicio > now()
      and re.hora_inicio <= now() + make_interval(hours => least(greatest(coalesce(p_ventana_horas, 24), 1), 72))
  loop
    v_rec := v_rec + public._notif_encolar_canales('RESERVA_RECORDATORIO', v_res.cliente_id, v_res.negocio_id,
      public._notif_datos_reserva(v_res, false),
      'reserva:' || v_res.id::text || ':recordatorio:' || extract(epoch from v_res.hora_inicio)::bigint, array['EMAIL', 'PUSH']);
  end loop;

  -- Prueba por terminar: el CORREO lo sigue enviando lib/planes/ciclo-suscripciones.ts (avisos_prueba_pendientes);
  -- aquí solo push y panel para no duplicar el email.
  for r in
    select s.id, s.negocio_id, s.prueba_fin, n.owner_user_id, n.nombre
    from public.suscripcion s join public.negocio n on n.id = s.negocio_id
    where s.estado = 'TRIAL' and not s.activacion_manual and s.prueba_fin > now() and s.prueba_fin <= now() + interval '3 days'
  loop
    v_tipo := case when r.prueba_fin <= now() + interval '1 day' then '1D' else '3D' end;
    v_pru := v_pru + public._notif_encolar_canales('SUSCRIPCION_PRUEBA_POR_TERMINAR', r.owner_user_id, r.negocio_id,
      jsonb_build_object('negocio', r.nombre, 'fecha', to_char(r.prueba_fin at time zone 'America/Bogota', 'DD/MM/YYYY'),
                         'ruta', '/panel/suscripcion'),
      'suscripcion:' || r.id::text || ':prueba:' || v_tipo || ':' || extract(epoch from r.prueba_fin)::bigint,
      array['PUSH', 'PANEL']);
  end loop;
  return jsonb_build_object('recordatorios', v_rec, 'avisos_prueba', v_pru);
end $$;
revoke all on function public.notif_generar_programadas(integer) from public, anon, authenticated;
grant execute on function public.notif_generar_programadas(integer) to service_role;

-- ── Worker (service_role) ─────────────────────────────────────────────────
-- Toma un lote EMAIL/PUSH: PENDIENTE|REINTENTANDO → PROCESANDO (FOR UPDATE SKIP LOCKED, lease de 10 min).
-- Devuelve lo necesario para enviar: plantilla resuelta, email del destinatario, suscripciones push.
create or replace function public.notif_outbox_tomar(p_limite integer default 50, p_canales text[] default array['EMAIL', 'PUSH'])
returns table (id uuid, evento text, usuario_id uuid, negocio_id uuid, canal text, categoria text, plantilla text,
               datos jsonb, idioma text, intentos integer, email text, asunto text, cuerpo text, push_suscripciones jsonb)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
begin
  -- Leases vencidos (worker caído): reintento o fallo definitivo.
  update public.notificacion_outbox o
     set estado = case when o.intentos >= o.max_intentos then 'FALLIDO' else 'REINTENTANDO' end,
         ultimo_error = 'LEASE_VENCIDO', proximo_intento_at = now()
   where o.estado = 'PROCESANDO' and o.canal <> 'PANEL' and o.proximo_intento_at < now();

  -- Consentimiento de marketing retirado después de encolar.
  update public.notificacion_outbox o
     set estado = 'OMITIDO_PREFERENCIA', ultimo_error = 'SIN_CONSENTIMIENTO_MARKETING'
   where o.categoria = 'MARKETING' and o.canal = 'EMAIL' and o.estado in ('PENDIENTE', 'REINTENTANDO')
     and not coalesce(public._consentimiento_vigente(o.usuario_id, 'marketing_email'), false);

  return query
  with c as (
    select o.id from public.notificacion_outbox o
    where o.canal = any(coalesce(p_canales, array[]::text[])) and o.canal <> 'PANEL'
      and o.estado in ('PENDIENTE', 'REINTENTANDO')
      and coalesce(o.proximo_intento_at, o.created_at) <= now()
    order by o.created_at
    limit v_lim
    for update skip locked
  ), u as (
    update public.notificacion_outbox o
       set estado = 'PROCESANDO', intentos = o.intentos + 1, proximo_intento_at = now() + interval '10 minutes'
      from c where o.id = c.id
    returning o.*
  )
  select u.id, u.evento, u.usuario_id, u.negocio_id, u.canal, u.categoria, u.plantilla, u.datos, u.idioma, u.intentos,
         case when u.canal = 'EMAIL' then coalesce(au.email, pf.email)::text end,
         t.asunto, t.cuerpo,
         case when u.canal = 'PUSH' then (
           select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
           from public.notificacion_push_suscripcion s where s.usuario_id = u.usuario_id) end
  from u
  left join auth.users au on au.id = u.usuario_id
  left join public.perfil pf on pf.id = u.usuario_id
  left join lateral public._notif_plantilla(u.plantilla, u.canal, u.idioma, u.negocio_id) t on true;
end $$;
revoke all on function public.notif_outbox_tomar(integer, text[]) from public, anon, authenticated;
grant execute on function public.notif_outbox_tomar(integer, text[]) to service_role;

-- Registra el resultado de un envío. ENVIADO exige id_externo. Idempotente: si la fila ya no está
-- PROCESANDO devuelve su estado actual sin tocarla.
create or replace function public.notif_outbox_registrar(
  p_id uuid, p_ok boolean, p_id_externo text default null, p_codigo text default null, p_reintentable boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare r public.notificacion_outbox; v_estado text;
  v_codigo text := nullif(left(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9_:.-]', '', 'g'), 120), '');
begin
  select * into r from public.notificacion_outbox where id = p_id for update;
  if not found then raise exception 'OUTBOX_NO_ENCONTRADO'; end if;
  if r.estado <> 'PROCESANDO' then return r.estado; end if;

  if coalesce(p_ok, false) then
    if coalesce(length(btrim(p_id_externo)), 0) = 0 then raise exception 'ENVIADO_REQUIERE_ID_EXTERNO'; end if;
    update public.notificacion_outbox
       set estado = 'ENVIADO', id_externo = left(btrim(p_id_externo), 300), enviado_at = now(),
           ultimo_error = null, proximo_intento_at = null
     where id = p_id;
    return 'ENVIADO';
  end if;

  if v_codigo = 'CANAL_NO_HABILITADO' then
    v_estado := 'CANAL_NO_HABILITADO';
  elsif v_codigo = 'SIN_SUSCRIPCION_PUSH' then
    v_estado := 'OMITIDO_PREFERENCIA';
  elsif coalesce(p_reintentable, false) and r.intentos < r.max_intentos then
    v_estado := 'REINTENTANDO';
  else
    v_estado := 'FALLIDO';
  end if;
  update public.notificacion_outbox
     set estado = v_estado, ultimo_error = v_codigo,
         proximo_intento_at = case when v_estado = 'REINTENTANDO'
           then now() + least(power(2, r.intentos)::integer, 360) * interval '1 minute' end
   where id = p_id;
  return v_estado;
end $$;
revoke all on function public.notif_outbox_registrar(uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.notif_outbox_registrar(uuid, boolean, text, text, boolean) to service_role;

-- Cuando un canal se habilita, lo marcado CANAL_NO_HABILITADO en las últimas horas vuelve a la cola.
create or replace function public.notif_outbox_reencolar_no_habilitados(p_canal text, p_max_horas integer default 24)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.notificacion_outbox o set estado = 'PENDIENTE', intentos = 0, ultimo_error = null, proximo_intento_at = null
   where o.estado = 'CANAL_NO_HABILITADO' and o.canal = p_canal
     and o.created_at >= now() - make_interval(hours => least(greatest(coalesce(p_max_horas, 24), 1), 168));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.notif_outbox_reencolar_no_habilitados(text, integer) from public, anon, authenticated;
grant execute on function public.notif_outbox_reencolar_no_habilitados(text, integer) to service_role;

-- Canal PANEL: se entrega dentro de la base (notificacion_usuario). La evidencia es el id de esa fila.
create or replace function public.notif_entregar_panel(p_limite integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare r public.notificacion_outbox; v_t record; v_nid uuid; n integer := 0;
  v_lim integer := least(greatest(coalesce(p_limite, 100), 1), 500);
begin
  for r in
    select * from public.notificacion_outbox o
    where o.canal = 'PANEL' and o.estado in ('PENDIENTE', 'REINTENTANDO')
      and coalesce(o.proximo_intento_at, o.created_at) <= now()
    order by o.created_at limit v_lim
    for update skip locked
  loop
    update public.notificacion_outbox set estado = 'PROCESANDO', intentos = intentos + 1,
           proximo_intento_at = now() + interval '10 minutes' where id = r.id;
    begin
      select * into v_t from public._notif_plantilla(r.plantilla, 'PANEL', r.idioma, r.negocio_id);
      if v_t.asunto is null then
        update public.notificacion_outbox set estado = 'FALLIDO', ultimo_error = 'PLANTILLA_NO_ENCONTRADA',
               proximo_intento_at = null where id = r.id;
        continue;
      end if;
      v_nid := null;
      insert into public.notificacion_usuario (usuario_id, tipo, titulo, cuerpo, negocio_id, dedupe_key)
      values (r.usuario_id, 'SISTEMA', left(public._notif_render_texto(v_t.asunto, r.datos), 200),
              left(public._notif_render_texto(v_t.cuerpo, r.datos), 1000), r.negocio_id, 'outbox:' || r.id::text)
      on conflict (usuario_id, dedupe_key) where dedupe_key is not null do nothing
      returning id into v_nid;
      if v_nid is null then
        select nu.id into v_nid from public.notificacion_usuario nu
        where nu.usuario_id = r.usuario_id and nu.dedupe_key = 'outbox:' || r.id::text;
      end if;
      update public.notificacion_outbox set estado = 'ENVIADO', id_externo = 'notificacion_usuario:' || v_nid::text,
             enviado_at = now(), ultimo_error = null, proximo_intento_at = null where id = r.id;
      n := n + 1;
    exception when others then
      update public.notificacion_outbox
         set estado = case when r.intentos + 1 >= r.max_intentos then 'FALLIDO' else 'REINTENTANDO' end,
             ultimo_error = 'ERROR_PANEL',
             proximo_intento_at = case when r.intentos + 1 >= r.max_intentos then null else now() + interval '5 minutes' end
       where id = r.id;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.notif_entregar_panel(integer) from public, anon, authenticated;
grant execute on function public.notif_entregar_panel(integer) to service_role;

-- El push service respondió 404/410: la suscripción ya no existe.
create or replace function public.notif_push_eliminar_endpoint(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.notificacion_push_suscripcion where endpoint = p_endpoint;
  return found;
end $$;
revoke all on function public.notif_push_eliminar_endpoint(text) from public, anon, authenticated;
grant execute on function public.notif_push_eliminar_endpoint(text) to service_role;

-- ── API del usuario (authenticated; la identidad sale de auth.uid()) ───────
create or replace function public.notif_preferencias_listar()
returns table (evento text, audiencia text, esencial boolean, descripcion text, email_activo boolean, push_activo boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_uid uuid := auth.uid(); v_loc text; v_es_negocio boolean;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  select p.locale into v_loc from public.perfil p where p.id = v_uid;
  v_es_negocio := coalesce(exists (select 1 from public.negocio n where n.owner_user_id = v_uid)
                           or exists (select 1 from public.staff s where s.usuario_id = v_uid), false);
  return query
  select e.codigo, e.audiencia, e.esencial,
         case when v_loc = 'en' then e.descripcion_en else e.descripcion_es end,
         coalesce((select np.activo from public.notificacion_preferencia np
                   where np.usuario_id = v_uid and np.evento = e.codigo and np.canal = 'EMAIL'), true) or e.esencial,
         coalesce((select np.activo from public.notificacion_preferencia np
                   where np.usuario_id = v_uid and np.evento = e.codigo and np.canal = 'PUSH'), true)
  from public.notificacion_evento e
  where e.categoria = 'TRANSACCIONAL' and (e.audiencia = 'CLIENTE' or v_es_negocio)
  order by e.audiencia, e.codigo;
end $$;
revoke all on function public.notif_preferencias_listar() from public, anon, authenticated;
grant execute on function public.notif_preferencias_listar() to authenticated;

create or replace function public.notif_preferencia_guardar(p_evento text, p_canal text, p_activo boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ev public.notificacion_evento;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_canal is null or p_canal not in ('EMAIL', 'PUSH') or p_activo is null then raise exception 'VALOR_INVALIDO'; end if;
  select * into v_ev from public.notificacion_evento where codigo = p_evento;
  if not found then raise exception 'EVENTO_DESCONOCIDO'; end if;
  if coalesce(v_ev.esencial, false) and p_canal = 'EMAIL' and not p_activo then
    raise exception 'PREFERENCIA_ESENCIAL';
  end if;
  insert into public.notificacion_preferencia (usuario_id, evento, canal, activo, updated_at)
  values (v_uid, p_evento, p_canal, p_activo, now())
  on conflict (usuario_id, evento, canal) do update set activo = excluded.activo, updated_at = now();
  return true;
end $$;
revoke all on function public.notif_preferencia_guardar(text, text, boolean) from public, anon, authenticated;
grant execute on function public.notif_preferencia_guardar(text, text, boolean) to authenticated;

-- Solo endpoints https de servicios de push conocidos (evita que el servidor haga POST a URLs arbitrarias).
create or replace function public._notif_endpoint_valido(p_endpoint text)
returns boolean language sql immutable security definer set search_path = public as $$
  select coalesce(length(p_endpoint) between 20 and 1024
    and p_endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[!-~]+$', false);
$$;
revoke all on function public._notif_endpoint_valido(text) from public, anon, authenticated;

create or replace function public.notif_push_suscribir(p_endpoint text, p_p256dh text, p_auth text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public._notif_endpoint_valido(p_endpoint), false)
     or coalesce(p_p256dh !~ '^[A-Za-z0-9_-]{86,88}={0,2}$', true)
     or coalesce(p_auth !~ '^[A-Za-z0-9_-]{21,24}={0,2}$', true) then
    raise exception 'SUSCRIPCION_PUSH_INVALIDA';
  end if;
  -- Un mismo navegador puede cambiar de cuenta: el endpoint queda con el usuario que lo registró último.
  insert into public.notificacion_push_suscripcion (usuario_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh,
    auth = excluded.auth, updated_at = now()
  returning id into v_id;
  -- Tope por usuario: se conservan las 10 más recientes.
  delete from public.notificacion_push_suscripcion s
   where s.usuario_id = v_uid and s.id in (
     select x.id from public.notificacion_push_suscripcion x where x.usuario_id = v_uid
     order by x.updated_at desc offset 10);
  return v_id;
end $$;
revoke all on function public.notif_push_suscribir(text, text, text) from public, anon, authenticated;
grant execute on function public.notif_push_suscribir(text, text, text) to authenticated;

create or replace function public.notif_push_desuscribir(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  delete from public.notificacion_push_suscripcion where endpoint = p_endpoint and usuario_id = v_uid;
  return found;
end $$;
revoke all on function public.notif_push_desuscribir(text) from public, anon, authenticated;
grant execute on function public.notif_push_desuscribir(text) to authenticated;

-- ── Plantillas por defecto (es/en). EMAIL usa cuerpo HTML; PUSH y PANEL, texto corto. ──
-- Variables: {{negocio}} {{fecha}} {{cliente}} {{monto}} {{plan}}; {{enlace}} solo en EMAIL (lo arma el servidor desde `ruta`).
with base (codigo, idioma, asunto, texto, html) as (values
  ('RESERVA_CREADA', 'es', 'Tu reserva en {{negocio}} está apartada', 'Completa el pago del anticipo para confirmar tu cita del {{fecha}}.',
   '<p>Apartamos tu cita en <strong>{{negocio}}</strong> para el {{fecha}}.</p><p>Completa el pago del anticipo para confirmarla; si no, el horario se libera.</p>'),
  ('RESERVA_CREADA', 'en', 'Your booking at {{negocio}} is on hold', 'Pay the deposit to confirm your appointment on {{fecha}}.',
   '<p>We are holding your appointment at <strong>{{negocio}}</strong> on {{fecha}}.</p><p>Pay the deposit to confirm it; otherwise the slot is released.</p>'),
  ('RESERVA_CONFIRMADA', 'es', 'Cita confirmada en {{negocio}}', 'Tu cita del {{fecha}} quedó confirmada.',
   '<p>Tu cita en <strong>{{negocio}}</strong> quedó confirmada para el {{fecha}}.</p>'),
  ('RESERVA_CONFIRMADA', 'en', 'Appointment confirmed at {{negocio}}', 'Your appointment on {{fecha}} is confirmed.',
   '<p>Your appointment at <strong>{{negocio}}</strong> is confirmed for {{fecha}}.</p>'),
  ('RESERVA_REPROGRAMADA', 'es', 'Tu cita en {{negocio}} cambió de hora', 'Nueva hora: {{fecha}}.',
   '<p>Tu cita en <strong>{{negocio}}</strong> se reprogramó. Nueva hora: {{fecha}}.</p>'),
  ('RESERVA_REPROGRAMADA', 'en', 'Your appointment at {{negocio}} was rescheduled', 'New time: {{fecha}}.',
   '<p>Your appointment at <strong>{{negocio}}</strong> was rescheduled. New time: {{fecha}}.</p>'),
  ('RESERVA_CANCELADA', 'es', 'Cita cancelada en {{negocio}}', 'Tu cita del {{fecha}} se canceló.',
   '<p>Tu cita en <strong>{{negocio}}</strong> del {{fecha}} se canceló.</p><p>Si corresponde un reembolso, te avisaremos cuando la pasarela lo confirme.</p>'),
  ('RESERVA_CANCELADA', 'en', 'Appointment cancelled at {{negocio}}', 'Your appointment on {{fecha}} was cancelled.',
   '<p>Your appointment at <strong>{{negocio}}</strong> on {{fecha}} was cancelled.</p><p>If a refund applies, we will let you know once the payment provider confirms it.</p>'),
  ('RESERVA_COMPLETADA', 'es', '¿Cómo te fue en {{negocio}}?', 'Califica tu visita: tu reseña ayuda a otros.',
   '<p>Gracias por tu visita a <strong>{{negocio}}</strong>. Cuéntanos cómo te fue: tu reseña ayuda a otros.</p>'),
  ('RESERVA_COMPLETADA', 'en', 'How was {{negocio}}?', 'Rate your visit: your review helps others.',
   '<p>Thanks for visiting <strong>{{negocio}}</strong>. Tell us how it went: your review helps others.</p>'),
  ('RESERVA_NO_SHOW', 'es', 'Registramos tu inasistencia en {{negocio}}', 'No asististe a tu cita del {{fecha}}.',
   '<p><strong>{{negocio}}</strong> registró que no asististe a tu cita del {{fecha}}. Se aplica la política de cancelación que aceptaste.</p>'),
  ('RESERVA_NO_SHOW', 'en', 'No-show recorded at {{negocio}}', 'You missed your appointment on {{fecha}}.',
   '<p><strong>{{negocio}}</strong> recorded that you missed your appointment on {{fecha}}. The cancellation policy you accepted applies.</p>'),
  ('RESERVA_RECORDATORIO', 'es', 'Recordatorio: tu cita en {{negocio}}', 'Te esperamos el {{fecha}}.',
   '<p>Te recordamos tu cita en <strong>{{negocio}}</strong> el {{fecha}}.</p>'),
  ('RESERVA_RECORDATORIO', 'en', 'Reminder: your appointment at {{negocio}}', 'See you on {{fecha}}.',
   '<p>This is a reminder of your appointment at <strong>{{negocio}}</strong> on {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_NUEVA', 'es', 'Nueva reserva: {{cliente}}', '{{cliente}} reservó para el {{fecha}}.',
   '<p><strong>{{cliente}}</strong> tiene una reserva confirmada en {{negocio}} para el {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_NUEVA', 'en', 'New booking: {{cliente}}', '{{cliente}} booked for {{fecha}}.',
   '<p><strong>{{cliente}}</strong> has a confirmed booking at {{negocio}} for {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_REPROGRAMADA', 'es', 'Reserva reprogramada: {{cliente}}', 'Nueva hora: {{fecha}}.',
   '<p>La reserva de <strong>{{cliente}}</strong> en {{negocio}} cambió. Nueva hora: {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_REPROGRAMADA', 'en', 'Booking rescheduled: {{cliente}}', 'New time: {{fecha}}.',
   '<p>The booking for <strong>{{cliente}}</strong> at {{negocio}} changed. New time: {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_CANCELADA', 'es', 'Reserva cancelada: {{cliente}}', 'Se canceló la cita del {{fecha}}.',
   '<p>Se canceló la reserva de <strong>{{cliente}}</strong> en {{negocio}} del {{fecha}}.</p>'),
  ('NEGOCIO_RESERVA_CANCELADA', 'en', 'Booking cancelled: {{cliente}}', 'The appointment on {{fecha}} was cancelled.',
   '<p>The booking for <strong>{{cliente}}</strong> at {{negocio}} on {{fecha}} was cancelled.</p>'),
  ('NEGOCIO_CLIENTE_NUEVO', 'es', 'Cliente nuevo en {{negocio}}', '{{cliente}} reservó por primera vez.',
   '<p><strong>{{cliente}}</strong> hizo su primera reserva en {{negocio}}.</p>'),
  ('NEGOCIO_CLIENTE_NUEVO', 'en', 'New client at {{negocio}}', '{{cliente}} booked for the first time.',
   '<p><strong>{{cliente}}</strong> made their first booking at {{negocio}}.</p>'),
  ('SUSCRIPCION_PRUEBA_POR_TERMINAR', 'es', 'Tu prueba gratuita termina pronto', 'Tu prueba de {{negocio}} termina el {{fecha}}. Elige tu plan para seguir recibiendo reservas.',
   '<p>La prueba gratuita de <strong>{{negocio}}</strong> termina el {{fecha}}. Elige tu plan para seguir recibiendo reservas.</p>'),
  ('SUSCRIPCION_PRUEBA_POR_TERMINAR', 'en', 'Your free trial ends soon', 'The trial for {{negocio}} ends on {{fecha}}. Choose a plan to keep receiving bookings.',
   '<p>The free trial for <strong>{{negocio}}</strong> ends on {{fecha}}. Choose a plan to keep receiving bookings.</p>'),
  ('SUSCRIPCION_VENCIDA', 'es', 'Tu plan de {{negocio}} necesita atención', 'Tu plan venció o tiene un pago pendiente. Regulariza para seguir recibiendo reservas.',
   '<p>El plan de <strong>{{negocio}}</strong> venció o tiene un pago pendiente. Regularízalo desde Plan y facturación para seguir recibiendo reservas.</p>'),
  ('SUSCRIPCION_VENCIDA', 'en', 'Your {{negocio}} plan needs attention', 'Your plan expired or has a pending payment. Settle it to keep receiving bookings.',
   '<p>The plan for <strong>{{negocio}}</strong> expired or has a pending payment. Settle it from Plan &amp; billing to keep receiving bookings.</p>'),
  ('SUSCRIPCION_SUSPENDIDA', 'es', 'Suspendimos el plan de {{negocio}}', 'Tu perfil quedó oculto hasta que regularices tu plan.',
   '<p>Suspendimos el plan de <strong>{{negocio}}</strong>. Tu perfil queda oculto hasta que lo regularices desde Plan y facturación.</p>'),
  ('SUSCRIPCION_SUSPENDIDA', 'en', 'We suspended the {{negocio}} plan', 'Your profile is hidden until you settle your plan.',
   '<p>We suspended the plan for <strong>{{negocio}}</strong>. Your profile stays hidden until you settle it from Plan &amp; billing.</p>'),
  ('SUSCRIPCION_REACTIVADA', 'es', 'Tu plan de {{negocio}} está activo', 'Tu plan {{plan}} está activo de nuevo.',
   '<p>El plan {{plan}} de <strong>{{negocio}}</strong> está activo de nuevo.</p>'),
  ('SUSCRIPCION_REACTIVADA', 'en', 'Your {{negocio}} plan is active', 'Your {{plan}} plan is active again.',
   '<p>The {{plan}} plan for <strong>{{negocio}}</strong> is active again.</p>'),
  ('PAGO_CONFIRMADO', 'es', 'Pago confirmado en {{negocio}}', 'Recibimos tu pago de {{monto}}.',
   '<p>La pasarela confirmó tu pago de <strong>{{monto}}</strong> en {{negocio}}.</p>'),
  ('PAGO_CONFIRMADO', 'en', 'Payment confirmed at {{negocio}}', 'We received your payment of {{monto}}.',
   '<p>The payment provider confirmed your payment of <strong>{{monto}}</strong> at {{negocio}}.</p>'),
  ('ANTICIPO_RECIBIDO', 'es', 'Anticipo recibido: {{negocio}}', 'Recibimos tu anticipo de {{monto}} para el {{fecha}}.',
   '<p>La pasarela confirmó tu anticipo de <strong>{{monto}}</strong> para tu cita en {{negocio}} del {{fecha}}.</p>'),
  ('ANTICIPO_RECIBIDO', 'en', 'Deposit received: {{negocio}}', 'We received your deposit of {{monto}} for {{fecha}}.',
   '<p>The payment provider confirmed your deposit of <strong>{{monto}}</strong> for your appointment at {{negocio}} on {{fecha}}.</p>'),
  ('NEGOCIO_ANTICIPO_RECIBIDO', 'es', 'Anticipo recibido de {{cliente}}', '{{cliente}} pagó {{monto}} para el {{fecha}}.',
   '<p><strong>{{cliente}}</strong> pagó un anticipo de {{monto}} para su cita del {{fecha}} en {{negocio}}.</p>'),
  ('NEGOCIO_ANTICIPO_RECIBIDO', 'en', 'Deposit received from {{cliente}}', '{{cliente}} paid {{monto}} for {{fecha}}.',
   '<p><strong>{{cliente}}</strong> paid a deposit of {{monto}} for their appointment on {{fecha}} at {{negocio}}.</p>'),
  ('PAGO_RECHAZADO', 'es', 'No se pudo procesar tu pago', 'La pasarela rechazó el pago de {{monto}}. Puedes intentarlo de nuevo.',
   '<p>La pasarela rechazó tu pago de <strong>{{monto}}</strong> en {{negocio}}. No se hizo ningún cobro; puedes intentarlo de nuevo.</p>'),
  ('PAGO_RECHAZADO', 'en', 'Your payment could not be processed', 'The provider declined the payment of {{monto}}. You can try again.',
   '<p>The payment provider declined your payment of <strong>{{monto}}</strong> at {{negocio}}. You were not charged; you can try again.</p>'),
  ('REEMBOLSO_SOLICITADO', 'es', 'Estamos procesando tu reembolso', 'Solicitamos el reembolso de {{monto}}. Te avisaremos cuando se confirme.',
   '<p>Registramos el reembolso de <strong>{{monto}}</strong> ({{negocio}}). Te avisaremos cuando la pasarela lo confirme.</p>'),
  ('REEMBOLSO_SOLICITADO', 'en', 'We are processing your refund', 'We requested a refund of {{monto}}. We will let you know once confirmed.',
   '<p>We registered a refund of <strong>{{monto}}</strong> ({{negocio}}). We will let you know once the payment provider confirms it.</p>'),
  ('REEMBOLSO_CONFIRMADO', 'es', 'Reembolso confirmado', 'Te devolvimos {{monto}}. Puede tardar unos días en verse en tu medio de pago.',
   '<p>La pasarela confirmó el reembolso de <strong>{{monto}}</strong> ({{negocio}}). Puede tardar unos días en verse en tu medio de pago.</p>'),
  ('REEMBOLSO_CONFIRMADO', 'en', 'Refund confirmed', 'We refunded {{monto}}. It may take a few days to show up.',
   '<p>The payment provider confirmed your refund of <strong>{{monto}}</strong> ({{negocio}}). It may take a few days to show up.</p>'),
  ('REEMBOLSO_EN_REVISION', 'es', 'Tu reembolso requiere revisión', 'No pudimos completar el reembolso de {{monto}}. Nuestro equipo lo está revisando.',
   '<p>No pudimos completar el reembolso de <strong>{{monto}}</strong> ({{negocio}}) de forma automática. Nuestro equipo lo está revisando y te contactará.</p>'),
  ('REEMBOLSO_EN_REVISION', 'en', 'Your refund needs review', 'We could not complete the refund of {{monto}}. Our team is reviewing it.',
   '<p>We could not complete the refund of <strong>{{monto}}</strong> ({{negocio}}) automatically. Our team is reviewing it and will contact you.</p>'),
  ('MARKETING_NOVEDADES', 'es', 'Novedades de StylerNow', 'Descubre lo nuevo cerca de ti.',
   '<p>Descubre lo nuevo cerca de ti en StylerNow.</p>'),
  ('MARKETING_NOVEDADES', 'en', 'StylerNow news', 'Discover what is new near you.',
   '<p>Discover what is new near you on StylerNow.</p>')
), filas as (
  select codigo, 'EMAIL'::text as canal, idioma, asunto, html as cuerpo from base
  union all select codigo, 'PUSH', idioma, asunto, texto from base
  union all select codigo, 'PANEL', idioma, asunto, texto from base
)
insert into public.notificacion_plantilla (codigo, canal, idioma, negocio_id, asunto, cuerpo, version, activa)
select f.codigo, f.canal, f.idioma, null, f.asunto, f.cuerpo, 1, true from filas f
where not exists (select 1 from public.notificacion_plantilla t
                  where t.codigo = f.codigo and t.canal = f.canal and t.idioma = f.idioma and t.negocio_id is null);
