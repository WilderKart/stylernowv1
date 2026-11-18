-- 151 · Centro de Cumplimiento y PQRS — Grupo B: se AMPLÍA el sistema de tickets existente (ticket_soporte / ticket_mensaje).
--       No se crea un segundo sistema de tickets.
--
--  * Radicación pública sin cuenta (`caso_radicar`, solo service_role: la llama el servidor tras Turnstile + rate limit).
--  * Seguimiento seguro: token aleatorio de alta entropía (solo se guarda su SHA-256); número de radicación + token.
--  * Máquina de estados que separa RESPONDER (comunicación sustantiva) de RESOLVER (decisión) y CERRAR (trámite completo).
--  * Plazos desde el catálogo (150): legal verificado / legal provisional / interno. Nunca se hardcodean.
--  * Historial append-only (`caso_historial`) de toda acción.
--  * Datos del solicitante en tabla aparte (solo SuperSU), con minimización.
--
-- Reversión: ver bloque al final (comentado). Los tickets existentes se conservan y se rellenan con valores por defecto.

-- ── Ampliación de ticket_soporte ───────────────────────────────────────────
alter table public.ticket_soporte alter column creado_por drop not null;   -- solicitante sin cuenta
alter table public.ticket_soporte
  add column if not exists numero_radicacion text,
  add column if not exists tipo_codigo text references public.caso_tipo(codigo),
  add column if not exists canal text not null default 'PLATAFORMA',
  add column if not exists prioridad text not null default 'NORMAL',
  add column if not exists responsable_id uuid references public.perfil(id),
  add column if not exists supervisor_id uuid references public.perfil(id),
  add column if not exists recibido_at timestamptz,
  add column if not exists regla_id uuid references public.caso_plazo_regla(id),
  add column if not exists plazo_origen text,
  add column if not exists fecha_limite timestamptz,
  add column if not exists fecha_limite_original timestamptz,
  add column if not exists prorroga_aplicada boolean not null default false,
  add column if not exists prorroga_motivo text,
  add column if not exists estado_caso text not null default 'NUEVO',
  add column if not exists estado_respuesta text not null default 'SIN_RESPUESTA',
  add column if not exists acuse_at timestamptz,
  add column if not exists respondido_at timestamptz,
  add column if not exists resuelto_at timestamptz,
  add column if not exists resultado text,
  add column if not exists cerrado_at timestamptz,
  add column if not exists nota_cierre text,
  add column if not exists escalado_at timestamptz,
  add column if not exists reclamo_en_tramite_desde timestamptz,
  add column if not exists subsanacion_requerida_at timestamptz,
  add column if not exists referencia_externa text,
  add column if not exists idempotency_key text,
  add column if not exists proxima_accion text;

do $$ begin
  alter table public.ticket_soporte add constraint ticket_canal_chk check (canal in
    ('PLATAFORMA', 'WEB_PUBLICO', 'CORREO', 'TELEFONO', 'PRESENCIAL', 'AUTORIDAD', 'INTERNO'));
  alter table public.ticket_soporte add constraint ticket_prioridad_chk check (prioridad in ('CRITICA', 'ALTA', 'NORMAL', 'BAJA'));
  alter table public.ticket_soporte add constraint ticket_estado_caso_chk check (estado_caso in
    ('NUEVO', 'EN_REVISION', 'ASIGNADO', 'EN_GESTION', 'ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'ESCALADO',
     'RESPONDIDO', 'RESUELTO', 'CERRADO', 'REABIERTO', 'DESISTIDO', 'TRASLADADO'));
  alter table public.ticket_soporte add constraint ticket_estado_respuesta_chk check (estado_respuesta in
    ('SIN_RESPUESTA', 'ACUSE_ENVIADO', 'RESPONDIDO'));
  alter table public.ticket_soporte add constraint ticket_plazo_origen_chk check (plazo_origen is null or plazo_origen in
    ('LEGAL_VERIFICADO', 'LEGAL_PROVISIONAL', 'INTERNO'));
exception when duplicate_object then null; end $$;

create sequence if not exists public.caso_numero_seq;
create unique index if not exists ticket_soporte_numero_uq on public.ticket_soporte (numero_radicacion);
create unique index if not exists ticket_soporte_idem_uq on public.ticket_soporte (idempotency_key) where idempotency_key is not null;
create index if not exists ticket_soporte_bandeja_idx on public.ticket_soporte (estado_caso, fecha_limite);
create index if not exists ticket_soporte_responsable_idx on public.ticket_soporte (responsable_id) where responsable_id is not null;
create index if not exists ticket_soporte_tipo_idx on public.ticket_soporte (tipo_codigo);
create index if not exists ticket_soporte_supervisor_idx on public.ticket_soporte (supervisor_id);
create index if not exists ticket_soporte_regla_idx on public.ticket_soporte (regla_id);

-- ── Ampliación de ticket_mensaje ───────────────────────────────────────────
alter table public.ticket_mensaje alter column autor_id drop not null;
alter table public.ticket_mensaje
  add column if not exists tipo text not null default 'MENSAJE',
  add column if not exists sustantiva boolean not null default false;
do $$ begin
  alter table public.ticket_mensaje drop constraint if exists ticket_mensaje_actor_tipo_check;
  alter table public.ticket_mensaje add constraint ticket_mensaje_actor_tipo_check check (actor_tipo in
    ('CLIENTE', 'STAFF', 'GUARDIAN', 'BARBERIA', 'SUPERSU', 'SOLICITANTE', 'SISTEMA'));
  alter table public.ticket_mensaje add constraint ticket_mensaje_tipo_chk check (tipo in
    ('MENSAJE', 'RESPUESTA', 'NOTA_INTERNA', 'ACUSE'));
  -- Una respuesta «sustantiva» solo la escribe un humano del equipo; el acuse automático nunca lo es.
  alter table public.ticket_mensaje add constraint ticket_mensaje_sustantiva_chk check (not sustantiva or (tipo = 'RESPUESTA' and actor_tipo = 'SUPERSU'));
exception when duplicate_object then null; end $$;

-- Las notas internas no las ve quien creó el ticket (solo el SuperSU).
alter policy ticket_mensaje_select_propio on public.ticket_mensaje using (
  coalesce(public.is_supersu(), false)
  or (tipo <> 'NOTA_INTERNA' and exists (select 1 from public.ticket_soporte t
        where t.id = ticket_mensaje.ticket_id and t.creado_por = (select auth.uid()))));

create or replace function public.cliente_ticket_mensajes(p_ticket_id uuid)
returns table (id uuid, actor_tipo text, mensaje text, es_mio boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not exists (select 1 from public.ticket_soporte t where t.id = p_ticket_id and t.creado_por = auth.uid()) then
    raise exception 'TICKET_NO_ENCONTRADO';
  end if;
  return query
  select m.id, m.actor_tipo, m.mensaje, m.autor_id = auth.uid(), m.created_at
  from public.ticket_mensaje m where m.ticket_id = p_ticket_id and m.tipo <> 'NOTA_INTERNA' order by m.created_at asc;
end $$;
revoke all on function public.cliente_ticket_mensajes(uuid) from public, anon, authenticated;
grant execute on function public.cliente_ticket_mensajes(uuid) to authenticated;

-- ── Solicitante, seguimiento, historial ────────────────────────────────────
create table if not exists public.caso_solicitante (
  ticket_id uuid primary key references public.ticket_soporte(id),
  nombre text not null check (length(nombre) between 2 and 120),
  email text not null check (length(email) <= 254 and email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$'),
  telefono text check (telefono is null or length(telefono) between 7 and 20),
  id_tipo text check (id_tipo is null or id_tipo in ('CC', 'CE', 'NIT', 'PASAPORTE', 'TI', 'OTRO')),
  id_numero text check (id_numero is null or length(id_numero) between 4 and 20),
  politica_texto_id uuid references public.texto_legal(id),
  politica_aceptada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists caso_solicitante_politica_idx on public.caso_solicitante (politica_texto_id);

create table if not exists public.caso_seguimiento (
  ticket_id uuid primary key references public.ticket_soporte(id),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  creado_at timestamptz not null default now(),
  rotado_at timestamptz,
  expira_at timestamptz not null default (now() + interval '2 years')
);

create table if not exists public.caso_historial (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.ticket_soporte(id),
  tipo_evento text not null check (tipo_evento in
    ('RADICADO', 'ESTADO', 'ASIGNADO', 'RESPUESTA', 'RESPUESTA_SUSTANTIVA', 'NOTA_INTERNA', 'PRORROGA',
     'SUBSANACION_SOLICITADA', 'SUBSANACION_RECIBIDA', 'TRASLADO', 'ESCALADO', 'RESUELTO', 'CERRADO', 'REABIERTO',
     'PRIORIDAD', 'PLAZO_RECALCULADO', 'ADJUNTO', 'ALERTA', 'DESISTIMIENTO', 'MENSAJE_SOLICITANTE', 'TOKEN_ROTADO',
     'ENVIO', 'RECLAMO_EN_TRAMITE')),
  estado_origen text,
  estado_destino text,
  actor_id uuid,
  actor_tipo text not null check (actor_tipo in ('SUPERSU', 'SOLICITANTE', 'SISTEMA', 'USUARIO')),
  detalle jsonb not null default '{}'::jsonb check (jsonb_typeof(detalle) = 'object'),
  visible_solicitante boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists caso_historial_ticket_idx on public.caso_historial (ticket_id, id);
drop trigger if exists trg_caso_historial_inmutable on public.caso_historial;
create trigger trg_caso_historial_inmutable before update or delete on public.caso_historial
  for each row execute function public.trg_fila_inmutable();

alter table public.caso_solicitante enable row level security;
alter table public.caso_seguimiento enable row level security;
alter table public.caso_historial enable row level security;
revoke all on public.caso_solicitante, public.caso_seguimiento, public.caso_historial from public, anon, authenticated;
revoke all on sequence public.caso_numero_seq from public, anon, authenticated;
grant select on public.caso_solicitante, public.caso_historial to authenticated;
drop policy if exists caso_solicitante_supersu on public.caso_solicitante;
create policy caso_solicitante_supersu on public.caso_solicitante for select to authenticated using (coalesce(public.is_supersu(), false));
drop policy if exists caso_historial_supersu on public.caso_historial;
create policy caso_historial_supersu on public.caso_historial for select to authenticated using (coalesce(public.is_supersu(), false));
-- caso_seguimiento: sin política y sin grant (ni siquiera el SuperSU lee los hashes por la API).

-- ── Plazo efectivo de un tipo ──────────────────────────────────────────────
create or replace function public._caso_plazo_efectivo(p_tipo text)
returns table (regla_id uuid, plazo integer, unidad text, origen text, prorroga_max integer)
language plpgsql stable security definer set search_path = public as $$
declare r public.caso_plazo_regla; t public.caso_tipo;
begin
  select * into t from public.caso_tipo where codigo = p_tipo;
  select * into r from public.caso_plazo_regla where tipo_codigo = p_tipo and activa
    and (vigente_hasta is null or vigente_hasta >= current_date) order by version desc limit 1;
  if r.id is not null and r.plazo is not null and r.estado_verificacion in
       ('VERIFICADO_LEGALMENTE', 'CONFIGURACION_PROVISIONAL', 'PENDIENTE_VERIFICACION') then
    regla_id := r.id; plazo := r.plazo; unidad := r.unidad; prorroga_max := r.prorroga_max;
    origen := case when r.estado_verificacion = 'VERIFICADO_LEGALMENTE' then 'LEGAL_VERIFICADO' else 'LEGAL_PROVISIONAL' end;
    return next; return;
  end if;
  regla_id := r.id;
  if t.sla_interno_horas is not null then plazo := t.sla_interno_horas; unidad := 'HORAS';
  else plazo := coalesce(t.sla_interno_dias_habiles, 15); unidad := 'DIAS_HABILES'; end if;
  origen := 'INTERNO'; prorroga_max := null;
  return next;
end $$;
revoke all on function public._caso_plazo_efectivo(text) from public, anon, authenticated;

create or replace function public._caso_prioridad_orden(p text)
returns integer language sql immutable set search_path = public as $$
  select case p when 'CRITICA' then 4 when 'ALTA' then 3 when 'NORMAL' then 2 else 1 end;
$$;
revoke all on function public._caso_prioridad_orden(text) from public, anon, authenticated;

-- Prioridad dinámica: nunca baja sola; sube según tipo, riesgo y cercanía del vencimiento.
create or replace function public._caso_prioridad_calculada(t public.ticket_soporte)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_tipo public.caso_tipo; v_p text; v_total numeric; v_gastado numeric; v_cerrado boolean;
begin
  select * into v_tipo from public.caso_tipo where codigo = t.tipo_codigo;
  v_p := coalesce(v_tipo.prioridad_base, 'NORMAL');
  if coalesce(v_tipo.es_critico, false) then v_p := 'CRITICA'; end if;
  v_cerrado := t.estado_caso in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO');
  if not v_cerrado and t.fecha_limite is not null then
    if now() > t.fecha_limite then v_p := 'CRITICA';
    else
      if t.fecha_limite - now() <= interval '24 hours' and t.plazo_origen is distinct from 'INTERNO' then
        v_p := 'CRITICA';
      elsif t.fecha_limite - now() <= interval '24 hours' and public._caso_prioridad_orden(v_p) < 3 then
        v_p := 'ALTA';
      end if;
      v_total := extract(epoch from (t.fecha_limite - coalesce(t.recibido_at, t.created_at)));
      v_gastado := extract(epoch from (now() - coalesce(t.recibido_at, t.created_at)));
      if v_total > 0 and v_gastado / v_total >= 0.75 and public._caso_prioridad_orden(v_p) < 3 then v_p := 'ALTA'; end if;
    end if;
  end if;
  if public._caso_prioridad_orden(t.prioridad) > public._caso_prioridad_orden(v_p) and not v_cerrado then v_p := t.prioridad; end if;
  return v_p;
end $$;
revoke all on function public._caso_prioridad_calculada(public.ticket_soporte) from public, anon, authenticated;

-- ── Historial ──────────────────────────────────────────────────────────────
create or replace function public._caso_log(p_ticket uuid, p_evento text, p_de text, p_a text, p_actor uuid,
  p_actor_tipo text, p_detalle jsonb default '{}', p_visible boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.caso_historial (ticket_id, tipo_evento, estado_origen, estado_destino, actor_id, actor_tipo, detalle, visible_solicitante)
  values (p_ticket, p_evento, p_de, p_a, p_actor, p_actor_tipo, coalesce(p_detalle, '{}'::jsonb), p_visible)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._caso_log(uuid, text, text, text, uuid, text, jsonb, boolean) from public, anon, authenticated;

-- ── Completar cualquier INSERT en ticket_soporte (también el de las RPC antiguas) ──
create or replace function public.trg_ticket_completar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; e record;
begin
  v_tipo := coalesce(new.tipo_codigo, 'OPE_OTRO');
  new.tipo_codigo := v_tipo;
  new.recibido_at := coalesce(new.recibido_at, now());
  if new.numero_radicacion is null then
    new.numero_radicacion := 'SN-' || to_char(new.recibido_at at time zone 'America/Bogota', 'YYYY') || '-' || lpad(nextval('public.caso_numero_seq')::text, 6, '0');
  end if;
  if new.fecha_limite is null then
    select * into e from public._caso_plazo_efectivo(v_tipo);
    new.regla_id := e.regla_id; new.plazo_origen := e.origen;
    new.fecha_limite := public.calcular_fecha_limite(new.recibido_at, e.plazo, e.unidad);
    new.fecha_limite_original := new.fecha_limite;
  end if;
  new.prioridad := public._caso_prioridad_calculada(new);
  return new;
end $$;
revoke all on function public.trg_ticket_completar() from public, anon, authenticated;
drop trigger if exists trg_ticket_completar on public.ticket_soporte;
create trigger trg_ticket_completar before insert on public.ticket_soporte for each row execute function public.trg_ticket_completar();

-- Tickets existentes: se completan sin cambiar su contenido (una sola vez).
do $$
declare t record; e record; v_estado text;
begin
  for t in select * from public.ticket_soporte where numero_radicacion is null order by created_at loop
    select * into e from public._caso_plazo_efectivo('OPE_OTRO');
    v_estado := case t.estado::text when 'ABIERTO' then 'NUEVO' when 'EN_PROCESO' then 'EN_GESTION' else 'RESUELTO' end;
    update public.ticket_soporte set
      numero_radicacion = 'SN-' || to_char(t.created_at at time zone 'America/Bogota', 'YYYY') || '-' || lpad(nextval('public.caso_numero_seq')::text, 6, '0'),
      tipo_codigo = 'OPE_OTRO', recibido_at = t.created_at, canal = 'PLATAFORMA', estado_caso = v_estado,
      regla_id = e.regla_id, plazo_origen = e.origen,
      fecha_limite = case when v_estado = 'RESUELTO' then null else public.calcular_fecha_limite(t.created_at, e.plazo, e.unidad) end,
      resuelto_at = case when v_estado = 'RESUELTO' then t.updated_at end
    where id = t.id;
  end loop;
end $$;

-- ── Máquina de estados ─────────────────────────────────────────────────────
create or replace function public._caso_transicion_valida(p_de text, p_a text)
returns boolean language sql immutable set search_path = public as $$
  select case p_de
    when 'NUEVO' then p_a in ('EN_REVISION', 'ASIGNADO', 'EN_GESTION', 'ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'ESCALADO', 'TRASLADADO', 'RESPONDIDO')
    when 'EN_REVISION' then p_a in ('ASIGNADO', 'EN_GESTION', 'ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'ESCALADO', 'TRASLADADO')
    when 'ASIGNADO' then p_a in ('EN_REVISION', 'EN_GESTION', 'ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'ESCALADO', 'TRASLADADO')
    when 'EN_GESTION' then p_a in ('ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'ESCALADO', 'RESPONDIDO', 'RESUELTO', 'TRASLADADO')
    when 'ESPERANDO_SOLICITANTE' then p_a in ('EN_GESTION', 'DESISTIDO', 'ESCALADO')
    when 'ESPERANDO_TERCERO' then p_a in ('EN_GESTION', 'ESCALADO')
    when 'ESCALADO' then p_a in ('EN_GESTION', 'ESPERANDO_SOLICITANTE', 'ESPERANDO_TERCERO', 'RESPONDIDO', 'RESUELTO')
    when 'RESPONDIDO' then p_a in ('EN_GESTION', 'RESUELTO', 'ESPERANDO_SOLICITANTE')
    when 'RESUELTO' then p_a in ('CERRADO', 'REABIERTO')
    when 'CERRADO' then p_a in ('REABIERTO')
    when 'REABIERTO' then p_a in ('EN_GESTION', 'ASIGNADO', 'ESCALADO', 'RESPONDIDO', 'RESUELTO')
    when 'DESISTIDO' then p_a in ('CERRADO', 'REABIERTO')
    when 'TRASLADADO' then p_a in ('CERRADO', 'REABIERTO')
    else false end;
$$;

revoke all on function public._caso_transicion_valida(text, text) from public, anon, authenticated;

create or replace function public._caso_exigir_supersu() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return auth.uid();
end $$;
revoke all on function public._caso_exigir_supersu() from public, anon, authenticated;

-- Mueve el estado, mantiene sincronizado el estado heredado y registra el historial.
create or replace function public._caso_mover(p_ticket uuid, p_nuevo text, p_actor uuid, p_actor_tipo text, p_detalle jsonb default '{}', p_visible boolean default false)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare t public.ticket_soporte; v_legacy public.ticket_soporte_estado; v_old text;
begin
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if t.estado_caso = p_nuevo then return t; end if;
  v_old := t.estado_caso;
  if not public._caso_transicion_valida(t.estado_caso, p_nuevo) then
    raise exception 'TRANSICION_INVALIDA: % -> %', t.estado_caso, p_nuevo;
  end if;
  v_legacy := case when p_nuevo in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO') then 'RESUELTO'
                   when p_nuevo in ('NUEVO', 'REABIERTO') then 'ABIERTO' else 'EN_PROCESO' end;
  update public.ticket_soporte set estado_caso = p_nuevo, estado = v_legacy, updated_at = now()
   where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'ESTADO', v_old, p_nuevo, p_actor, p_actor_tipo, p_detalle, p_visible);
  return t;
end $$;
revoke all on function public._caso_mover(uuid, text, uuid, text, jsonb, boolean) from public, anon, authenticated;

-- ── RADICACIÓN ─────────────────────────────────────────────────────────────
-- p_creado_por lo fija el SERVIDOR a partir de la sesión verificada (null = solicitante sin cuenta). Nunca viene del navegador.
create or replace function public.caso_radicar(
  p_tipo text, p_asunto text, p_descripcion text, p_canal text, p_creado_por uuid, p_solicitante jsonb,
  p_negocio_id uuid, p_referencia text, p_token_hash text, p_idempotency_key text, p_politica_texto_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tipo public.caso_tipo; t public.ticket_soporte; v_existente public.ticket_soporte;
  v_nombre text := nullif(trim(p_solicitante ->> 'nombre'), '');
  v_email text := lower(nullif(trim(p_solicitante ->> 'email'), ''));
  v_tel text := nullif(trim(p_solicitante ->> 'telefono'), '');
  v_idt text := nullif(trim(p_solicitante ->> 'id_tipo'), '');
  v_idn text := nullif(trim(p_solicitante ->> 'id_numero'), '');
begin
  select * into v_tipo from public.caso_tipo where codigo = p_tipo and activo;
  if not found then raise exception 'TIPO_INVALIDO'; end if;
  if p_creado_por is null and not v_tipo.publico then raise exception 'TIPO_NO_PUBLICO'; end if;
  if p_canal not in ('PLATAFORMA', 'WEB_PUBLICO', 'CORREO', 'TELEFONO', 'PRESENCIAL', 'AUTORIDAD', 'INTERNO') then raise exception 'CANAL_INVALIDO'; end if;
  if p_asunto is null or length(trim(p_asunto)) not between 5 and 160 then raise exception 'ASUNTO_INVALIDO'; end if;
  if p_descripcion is null or length(trim(p_descripcion)) not between 10 and 5000 then raise exception 'DESCRIPCION_INVALIDA'; end if;
  if p_referencia is not null and length(p_referencia) > 120 then raise exception 'REFERENCIA_INVALIDA'; end if;

  -- Idempotencia: el mismo envío (doble clic, reintento) no crea otro caso.
  if p_idempotency_key is not null then
    select * into v_existente from public.ticket_soporte where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id', v_existente.id, 'numero', v_existente.numero_radicacion, 'duplicado', true,
        'fecha_limite', v_existente.fecha_limite, 'plazo_origen', v_existente.plazo_origen);
    end if;
  end if;

  if p_creado_por is null then
    if v_nombre is null or v_email is null then raise exception 'SOLICITANTE_INCOMPLETO'; end if;
    if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'TOKEN_REQUERIDO'; end if;
    if p_politica_texto_id is null then raise exception 'POLITICA_NO_CONFIRMADA'; end if;
    if v_tipo.requiere_identificacion and (v_idt is null or v_idn is null) then raise exception 'IDENTIFICACION_REQUERIDA'; end if;
  end if;
  if not v_tipo.requiere_identificacion then v_idt := null; v_idn := null; end if;   -- minimización

  insert into public.ticket_soporte (creado_por, negocio_id, asunto, tipo_codigo, canal, referencia_externa, idempotency_key)
  values (p_creado_por, p_negocio_id, trim(p_asunto), v_tipo.codigo, p_canal, nullif(trim(p_referencia), ''), p_idempotency_key)
  returning * into t;

  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo)
  values (t.id, p_creado_por, case when p_creado_por is null then 'SOLICITANTE' else 'CLIENTE' end, trim(p_descripcion), 'MENSAJE');

  -- Contacto y seguimiento: siempre que lleguen (quien radica con cuenta también puede dar un correo de contacto y un enlace).
  if v_nombre is not null and v_email is not null then
    insert into public.caso_solicitante (ticket_id, nombre, email, telefono, id_tipo, id_numero, politica_texto_id, politica_aceptada_at)
    values (t.id, v_nombre, v_email, v_tel, v_idt, v_idn, p_politica_texto_id, case when p_politica_texto_id is not null then clock_timestamp() end);
  end if;
  if p_token_hash is not null and p_token_hash ~ '^[0-9a-f]{64}$' then
    insert into public.caso_seguimiento (ticket_id, token_hash) values (t.id, p_token_hash);
  end if;

  perform public._caso_log(t.id, 'RADICADO', null, 'NUEVO', p_creado_por, case when p_creado_por is null then 'SOLICITANTE' else 'USUARIO' end,
    jsonb_build_object('numero', t.numero_radicacion, 'tipo', t.tipo_codigo, 'canal', t.canal, 'prioridad', t.prioridad,
      'plazo_origen', t.plazo_origen, 'fecha_limite', t.fecha_limite, 'regla_id', t.regla_id), true);

  return jsonb_build_object('id', t.id, 'numero', t.numero_radicacion, 'duplicado', false, 'fecha_limite', t.fecha_limite,
    'plazo_origen', t.plazo_origen, 'prioridad', t.prioridad, 'recibido_at', t.recibido_at);
end $$;
revoke all on function public.caso_radicar(text, text, text, text, uuid, jsonb, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.caso_radicar(text, text, text, text, uuid, jsonb, uuid, text, text, text, uuid) to service_role;

-- ── CONSULTA PÚBLICA (número + token) ──────────────────────────────────────
-- Error genérico: no revela si el número existe. Devuelve solo lo que el solicitante puede ver.
create or replace function public.caso_consultar_publico(p_numero text, p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.ticket_soporte;
begin
  select tk.* into t from public.ticket_soporte tk
    join public.caso_seguimiento s on s.ticket_id = tk.id
   where tk.numero_radicacion = upper(trim(p_numero)) and s.token_hash = p_token_hash and s.expira_at > now();
  if not found then return null; end if;
  return jsonb_build_object(
    'numero', t.numero_radicacion, 'asunto', t.asunto, 'estado', t.estado_caso, 'recibido_at', t.recibido_at,
    'fecha_limite', t.fecha_limite, 'plazo_origen', t.plazo_origen, 'respondido_at', t.respondido_at,
    'resuelto_at', t.resuelto_at, 'cerrado_at', t.cerrado_at, 'prorroga', t.prorroga_aplicada,
    'esperando_solicitante', t.estado_caso = 'ESPERANDO_SOLICITANTE',
    'tipo', (select nombre from public.caso_tipo c where c.codigo = t.tipo_codigo),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('actor', m.actor_tipo, 'mensaje', m.mensaje, 'tipo', m.tipo, 'at', m.created_at) order by m.created_at)
                          from public.ticket_mensaje m where m.ticket_id = t.id and m.tipo <> 'NOTA_INTERNA'), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('evento', h.tipo_evento, 'estado', h.estado_destino, 'at', h.created_at) order by h.id)
                           from public.caso_historial h where h.ticket_id = t.id and h.visible_solicitante), '[]'::jsonb));
end $$;
revoke all on function public.caso_consultar_publico(text, text) from public, anon, authenticated;
grant execute on function public.caso_consultar_publico(text, text) to service_role;

-- El solicitante sin cuenta responde (p. ej. subsana un reclamo incompleto).
create or replace function public.caso_responder_publico(p_numero text, p_token_hash text, p_mensaje text)
returns boolean language plpgsql security definer set search_path = public as $$
declare t public.ticket_soporte; e record; v_regla public.caso_plazo_regla;
begin
  if p_mensaje is null or length(trim(p_mensaje)) not between 2 and 5000 then raise exception 'MENSAJE_INVALIDO'; end if;
  select tk.* into t from public.ticket_soporte tk join public.caso_seguimiento s on s.ticket_id = tk.id
   where tk.numero_radicacion = upper(trim(p_numero)) and s.token_hash = p_token_hash and s.expira_at > now() for update of tk;
  if not found then return false; end if;
  if t.estado_caso in ('CERRADO', 'DESISTIDO') then raise exception 'CASO_CERRADO'; end if;
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo) values (t.id, null, 'SOLICITANTE', trim(p_mensaje), 'MENSAJE');
  perform public._caso_log(t.id, 'MENSAJE_SOLICITANTE', null, null, null, 'SOLICITANTE', '{}', true);
  if t.estado_caso = 'ESPERANDO_SOLICITANTE' then
    -- Reclamo completado: el plazo de la norma cuenta desde el día siguiente a este recibo.
    select * into e from public._caso_plazo_efectivo(t.tipo_codigo);
    perform public._caso_mover(t.id, 'EN_GESTION', null, 'SOLICITANTE', jsonb_build_object('motivo', 'subsanacion_recibida'), true);
    update public.ticket_soporte set subsanacion_requerida_at = null,
      fecha_limite = public.calcular_fecha_limite(now(), e.plazo, e.unidad), fecha_limite_original = public.calcular_fecha_limite(now(), e.plazo, e.unidad),
      prorroga_aplicada = false, prorroga_motivo = null, plazo_origen = e.origen, regla_id = e.regla_id
     where id = t.id;
    perform public._caso_log(t.id, 'SUBSANACION_RECIBIDA', 'ESPERANDO_SOLICITANTE', 'EN_GESTION', null, 'SOLICITANTE',
      jsonb_build_object('nuevo_plazo', (select fecha_limite from public.ticket_soporte where id = t.id)), true);
  end if;
  return true;
end $$;
revoke all on function public.caso_responder_publico(text, text, text) from public, anon, authenticated;
grant execute on function public.caso_responder_publico(text, text, text) to service_role;

-- Nuevo enlace de seguimiento (el anterior deja de servir). Siempre responde igual para no revelar si el caso existe.
drop function if exists public.caso_rotar_token(text, text, text);
create or replace function public.caso_rotar_token(p_numero text, p_email text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select t.id into v_id from public.ticket_soporte t join public.caso_solicitante s on s.ticket_id = t.id
   where t.numero_radicacion = upper(trim(p_numero)) and lower(s.email) = lower(trim(p_email));
  if v_id is null then return null; end if;
  insert into public.caso_seguimiento (ticket_id, token_hash) values (v_id, p_token_hash)
  on conflict (ticket_id) do update set token_hash = excluded.token_hash, rotado_at = now(), expira_at = now() + interval '2 years';
  perform public._caso_log(v_id, 'TOKEN_ROTADO', null, null, null, 'SOLICITANTE', '{}', false);
  return v_id;
end $$;
revoke all on function public.caso_rotar_token(text, text, text) from public, anon, authenticated;
grant execute on function public.caso_rotar_token(text, text, text) to service_role;

-- ── ACCIONES DEL SUPERADMIN ────────────────────────────────────────────────
create or replace function public.caso_asignar(p_ticket uuid, p_responsable uuid, p_supervisor uuid default null)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte;
begin
  if p_responsable is not null and not exists (select 1 from public.perfil where id = p_responsable and es_supersu) then
    raise exception 'RESPONSABLE_INVALIDO';   -- hoy solo el equipo SuperSU puede gestionar casos
  end if;
  update public.ticket_soporte set responsable_id = p_responsable, supervisor_id = p_supervisor, updated_at = now()
   where id = p_ticket returning * into t;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  perform public._caso_log(p_ticket, 'ASIGNADO', null, null, v_actor, 'SUPERSU',
    jsonb_build_object('responsable_id', p_responsable, 'supervisor_id', p_supervisor), false);
  if p_responsable is not null and t.estado_caso in ('NUEVO', 'EN_REVISION') then
    t := public._caso_mover(p_ticket, 'ASIGNADO', v_actor, 'SUPERSU', '{}', false);
  end if;
  return t;
end $$;

create or replace function public.caso_cambiar_estado(p_ticket uuid, p_nuevo text, p_motivo text default null)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte; v_ant text;
begin
  if p_nuevo in ('RESPONDIDO', 'RESUELTO', 'CERRADO', 'REABIERTO', 'ESCALADO', 'TRASLADADO', 'DESISTIDO', 'ESPERANDO_SOLICITANTE') then
    raise exception 'USE_ACCION_ESPECIFICA';   -- esas transiciones tienen requisitos y se hacen con su acción
  end if;
  select estado_caso into v_ant from public.ticket_soporte where id = p_ticket;
  t := public._caso_mover(p_ticket, p_nuevo, v_actor, 'SUPERSU', jsonb_build_object('desde', v_ant, 'motivo', p_motivo), false);
  -- «Reclamo en trámite» (art. 15 Ley 1581): se marca al pasar a gestión un reclamo de datos ya completo.
  if p_nuevo = 'EN_GESTION' and t.tipo_codigo in ('DATOS_RECLAMO', 'DATOS_ACTUALIZACION', 'DATOS_RECTIFICACION', 'DATOS_SUPRESION',
       'DATOS_REVOCATORIA', 'DATOS_INCUMPLIMIENTO') and t.reclamo_en_tramite_desde is null then
    update public.ticket_soporte set reclamo_en_tramite_desde = now() where id = p_ticket returning * into t;
    perform public._caso_log(p_ticket, 'RECLAMO_EN_TRAMITE', null, null, v_actor, 'SUPERSU', jsonb_build_object('leyenda', 'reclamo en trámite'), true);
  end if;
  return t;
end $$;

create or replace function public.caso_nota_interna(p_ticket uuid, p_nota text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu();
begin
  if p_nota is null or length(trim(p_nota)) not between 2 and 5000 then raise exception 'NOTA_INVALIDA'; end if;
  if not exists (select 1 from public.ticket_soporte where id = p_ticket) then raise exception 'CASO_NO_ENCONTRADO'; end if;
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo) values (p_ticket, v_actor, 'SUPERSU', trim(p_nota), 'NOTA_INTERNA');
  return public._caso_log(p_ticket, 'NOTA_INTERNA', null, null, v_actor, 'SUPERSU', '{}', false);
end $$;

-- Responder: comunicación al solicitante. Solo la respuesta SUSTANTIVA cuenta como respuesta del caso.
create or replace function public.caso_responder(p_ticket uuid, p_mensaje text, p_sustantiva boolean default true)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte;
begin
  if p_mensaje is null or length(trim(p_mensaje)) not between 5 and 5000 then raise exception 'MENSAJE_INVALIDO'; end if;
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if t.estado_caso in ('CERRADO', 'DESISTIDO') then raise exception 'CASO_CERRADO'; end if;
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo, sustantiva)
  values (p_ticket, v_actor, 'SUPERSU', trim(p_mensaje), 'RESPUESTA', coalesce(p_sustantiva, true));
  if coalesce(p_sustantiva, true) then
    update public.ticket_soporte set estado_respuesta = 'RESPONDIDO', respondido_at = coalesce(respondido_at, now()), updated_at = now()
     where id = p_ticket returning * into t;
    perform public._caso_log(p_ticket, 'RESPUESTA_SUSTANTIVA', null, null, v_actor, 'SUPERSU',
      jsonb_build_object('en_plazo', t.fecha_limite is null or now() <= t.fecha_limite), true);
    if t.estado_caso in ('EN_GESTION', 'ESCALADO', 'REABIERTO', 'NUEVO') then t := public._caso_mover(p_ticket, 'RESPONDIDO', v_actor, 'SUPERSU', '{}', true); end if;
  else
    perform public._caso_log(p_ticket, 'RESPUESTA', null, null, v_actor, 'SUPERSU', jsonb_build_object('sustantiva', false), true);
  end if;
  return t;
end $$;

create or replace function public.caso_solicitar_subsanacion(p_ticket uuid, p_mensaje text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte; v_regla public.caso_plazo_regla; v_limite date;
begin
  if p_mensaje is null or length(trim(p_mensaje)) < 10 then raise exception 'MENSAJE_INVALIDO'; end if;
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  select * into v_regla from public.caso_plazo_regla where id = t.regla_id;
  -- Plazo para requerir al solicitante (art. 15: dentro de los 5 días siguientes a la recepción), si la regla lo define.
  if v_regla.subsanacion_dias is not null then
    v_limite := case when v_regla.subsanacion_unidad = 'DIAS_CALENDARIO' then public.fecha_colombia(t.recibido_at) + v_regla.subsanacion_dias
                     else public.sumar_dias_habiles(public.fecha_colombia(t.recibido_at), v_regla.subsanacion_dias) end;
    if public.fecha_colombia(now()) > v_limite then
      perform public._caso_log(p_ticket, 'ALERTA', null, null, v_actor, 'SUPERSU',
        jsonb_build_object('aviso', 'subsanacion_fuera_de_termino', 'limite', v_limite), false);
    end if;
  end if;
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo, sustantiva)
  values (p_ticket, v_actor, 'SUPERSU', trim(p_mensaje), 'RESPUESTA', false);
  t := public._caso_mover(p_ticket, 'ESPERANDO_SOLICITANTE', v_actor, 'SUPERSU', jsonb_build_object('motivo', 'subsanacion'), true);
  update public.ticket_soporte set subsanacion_requerida_at = now() where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'SUBSANACION_SOLICITADA', null, 'ESPERANDO_SOLICITANTE', v_actor, 'SUPERSU',
    jsonb_build_object('desiste_si_no_responde_antes_de', (now() + make_interval(months => coalesce(v_regla.desistimiento_meses, 2)))), true);
  return t;
end $$;

create or replace function public.caso_extender_plazo(p_ticket uuid, p_motivo text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte; e record; v_nuevo timestamptz;
begin
  if p_motivo is null or length(trim(p_motivo)) < 15 then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if t.prorroga_aplicada then raise exception 'PRORROGA_YA_APLICADA'; end if;
  if t.estado_caso in ('RESUELTO', 'CERRADO', 'DESISTIDO', 'TRASLADADO') then raise exception 'CASO_NO_ABIERTO'; end if;
  if now() > t.fecha_limite then raise exception 'PLAZO_VENCIDO_NO_PRORROGABLE'; end if;   -- debe informarse ANTES del vencimiento
  select * into e from public._caso_plazo_efectivo(t.tipo_codigo);
  if e.prorroga_max is null then raise exception 'SIN_PRORROGA_DEFINIDA'; end if;
  v_nuevo := public.calcular_fecha_limite(t.fecha_limite, e.prorroga_max, e.unidad);
  update public.ticket_soporte set fecha_limite = v_nuevo, prorroga_aplicada = true, prorroga_motivo = trim(p_motivo), updated_at = now()
   where id = p_ticket returning * into t;
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje, tipo, sustantiva)
  values (p_ticket, v_actor, 'SUPERSU', 'Informamos que ampliamos el plazo para atender tu solicitud hasta el ' ||
    to_char(v_nuevo at time zone 'America/Bogota', 'YYYY-MM-DD') || '. Motivo: ' || trim(p_motivo), 'RESPUESTA', false);
  perform public._caso_log(p_ticket, 'PRORROGA', null, null, v_actor, 'SUPERSU',
    jsonb_build_object('fecha_anterior', t.fecha_limite_original, 'fecha_nueva', v_nuevo, 'dias_adicionales', e.prorroga_max, 'motivo', trim(p_motivo)), true);
  return t;
end $$;

create or replace function public.caso_trasladar(p_ticket uuid, p_destino text, p_motivo text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte;
begin
  if p_destino is null or length(trim(p_destino)) < 3 or p_motivo is null or length(trim(p_motivo)) < 10 then raise exception 'DATOS_INCOMPLETOS'; end if;
  t := public._caso_mover(p_ticket, 'TRASLADADO', v_actor, 'SUPERSU', jsonb_build_object('destino', trim(p_destino), 'motivo', trim(p_motivo)), true);
  perform public._caso_log(p_ticket, 'TRASLADO', null, 'TRASLADADO', v_actor, 'SUPERSU', jsonb_build_object('destino', trim(p_destino), 'motivo', trim(p_motivo)), true);
  return t;
end $$;

create or replace function public.caso_escalar(p_ticket uuid, p_motivo text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte;
begin
  if p_motivo is null or length(trim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  t := public._caso_mover(p_ticket, 'ESCALADO', v_actor, 'SUPERSU', jsonb_build_object('motivo', trim(p_motivo)), false);
  update public.ticket_soporte set escalado_at = now(), prioridad = case when public._caso_prioridad_orden(prioridad) < 3 then 'ALTA' else prioridad end
   where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'ESCALADO', null, 'ESCALADO', v_actor, 'SUPERSU', jsonb_build_object('motivo', trim(p_motivo), 'manual', true), false);
  return t;
end $$;

-- Resolver: exige una respuesta sustantiva previa y el resultado.
create or replace function public.caso_resolver(p_ticket uuid, p_resultado text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte;
begin
  if p_resultado is null or length(trim(p_resultado)) < 10 then raise exception 'RESULTADO_REQUERIDO'; end if;
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if t.estado_respuesta <> 'RESPONDIDO' then raise exception 'RESPUESTA_SUSTANTIVA_REQUERIDA'; end if;
  t := public._caso_mover(p_ticket, 'RESUELTO', v_actor, 'SUPERSU', jsonb_build_object('resultado', left(trim(p_resultado), 300)), true);
  update public.ticket_soporte set resultado = trim(p_resultado), resuelto_at = now(), reclamo_en_tramite_desde = reclamo_en_tramite_desde
   where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'RESUELTO', null, 'RESUELTO', v_actor, 'SUPERSU', jsonb_build_object('resultado', left(trim(p_resultado), 300)), true);
  return t;
end $$;

-- Cerrar: caso resuelto; los críticos exigen nota de cierre.
create or replace function public.caso_cerrar(p_ticket uuid, p_nota text default null)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte; v_critico boolean;
begin
  select * into t from public.ticket_soporte where id = p_ticket for update;
  if not found then raise exception 'CASO_NO_ENCONTRADO'; end if;
  if t.estado_caso not in ('RESUELTO', 'DESISTIDO', 'TRASLADADO') then raise exception 'CASO_NO_RESUELTO'; end if;
  v_critico := t.prioridad = 'CRITICA' or coalesce((select es_critico from public.caso_tipo where codigo = t.tipo_codigo), false);
  if v_critico and (p_nota is null or length(trim(p_nota)) < 20) then raise exception 'NOTA_CIERRE_REQUERIDA'; end if;
  if v_critico and t.estado_caso = 'RESUELTO' and t.estado_respuesta <> 'RESPONDIDO' then raise exception 'RESPUESTA_SUSTANTIVA_REQUERIDA'; end if;
  t := public._caso_mover(p_ticket, 'CERRADO', v_actor, 'SUPERSU', jsonb_build_object('nota', left(coalesce(trim(p_nota), ''), 300)), true);
  update public.ticket_soporte set cerrado_at = now(), nota_cierre = nullif(trim(p_nota), '') where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'CERRADO', null, 'CERRADO', v_actor, 'SUPERSU', jsonb_build_object('critico', v_critico), true);
  return t;
end $$;

create or replace function public.caso_reabrir(p_ticket uuid, p_motivo text)
returns public.ticket_soporte language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public._caso_exigir_supersu(); t public.ticket_soporte; e record;
begin
  if p_motivo is null or length(trim(p_motivo)) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  t := public._caso_mover(p_ticket, 'REABIERTO', v_actor, 'SUPERSU', jsonb_build_object('motivo', trim(p_motivo)), true);
  select * into e from public._caso_plazo_efectivo(t.tipo_codigo);
  -- Se reabre con un plazo interno nuevo (no se «revive» el plazo legal original, que ya se cumplió o venció).
  update public.ticket_soporte set cerrado_at = null, resuelto_at = null, estado_respuesta = 'SIN_RESPUESTA', respondido_at = null,
    fecha_limite = public.calcular_fecha_limite(now(), 5, 'DIAS_HABILES'), plazo_origen = 'INTERNO', prorroga_aplicada = false
   where id = p_ticket returning * into t;
  perform public._caso_log(p_ticket, 'REABIERTO', null, 'REABIERTO', v_actor, 'SUPERSU', jsonb_build_object('motivo', trim(p_motivo)), true);
  return t;
end $$;

-- Permisos de las acciones del SuperAdmin: ejecutan los usuarios autenticados, y cada una verifica SuperSU adentro.
do $$
declare f text;
begin
  foreach f in array array[
    'caso_asignar(uuid, uuid, uuid)', 'caso_cambiar_estado(uuid, text, text)', 'caso_nota_interna(uuid, text)',
    'caso_responder(uuid, text, boolean)', 'caso_solicitar_subsanacion(uuid, text)', 'caso_extender_plazo(uuid, text)',
    'caso_trasladar(uuid, text, text)', 'caso_escalar(uuid, text)', 'caso_resolver(uuid, text)', 'caso_cerrar(uuid, text)',
    'caso_reabrir(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Reversión (manual, solo en local): drop function caso_*; drop table caso_historial, caso_seguimiento, caso_solicitante;
--   alter table ticket_soporte drop column ... (las agregadas arriba); restaurar la política y cliente_ticket_mensajes de 098/131.
