-- 123 · Auditoría completa de los paneles administrativos (Directiva §6 y §24, fase H).
--
-- Aditiva y re-ejecutable (create or replace / drop … if exists). No reescribe filas viejas.
--
-- 1. evento_auditoria gana `origen` ('PANEL','API','SISTEMA','SQL') y `request_id`.
-- 2. Un trigger BEFORE INSERT completa TODA fila nueva, venga de donde venga (RPC antigua,
--    trigger nuevo o inserción del servidor con service_role):
--      · quita de los payloads, de forma recursiva, las claves con forma de secreto;
--      · llena origen y request_id (cabecera `x-request-id` que expone PostgREST);
--      · si falta el motivo, usa la cabecera `x-auditoria-motivo` (base64 UTF-8) que pone el servidor.
-- 3. `_auditar(...)`: helper interno (SECURITY DEFINER, sin grants a roles de API) que deduce el
--    actor desde auth.uid() y los helpers existentes.
-- 4. `_trg_auditar_cambio()`: trigger AFTER genérico con fila antes/después, que también atrapa
--    escrituras directas (sin RPC). Se aplica a la configuración de plataforma, a la configuración
--    del negocio y a los CAMBIOS DE ESTADO de reservas, pagos, suscripciones, staff y negocio.
--    No se audita la creación de reservas ni otras tablas de alto volumen fila a fila.
-- 5. Lectura: `auditoria_listar` y `auditoria_entidades` (SuperSU: todo; dueño: solo su negocio,
--    verificado en la base). La RLS existente `auditoria_select_negocio` ya limita al dueño.
-- 6. TRUNCATE bloqueado también por trigger (los triggers de fila no se disparan con TRUNCATE).
--
-- Reglas del proyecto aplicadas: toda función `security definer set search_path = public`;
-- `revoke all … from public, anon, authenticated`; autorización con coalesce(…, false);
-- nada de INSERT de log seguido de RAISE en la misma transacción; DDL dinámico solo con format(%I/%L).

-- ════════════════════════════════════════════════════════════════════════
-- 1. Columnas nuevas e índices
-- ════════════════════════════════════════════════════════════════════════

alter table public.evento_auditoria add column if not exists origen text;
alter table public.evento_auditoria add column if not exists request_id text;

alter table public.evento_auditoria drop constraint if exists evento_auditoria_origen_check;
alter table public.evento_auditoria add constraint evento_auditoria_origen_check
  check (origen is null or origen in ('PANEL', 'API', 'SISTEMA', 'SQL')) not valid;
alter table public.evento_auditoria validate constraint evento_auditoria_origen_check;

create index if not exists auditoria_fecha_idx on public.evento_auditoria (created_at desc);
create index if not exists auditoria_negocio_fecha_idx on public.evento_auditoria (negocio_id, created_at desc);
create index if not exists auditoria_request_idx on public.evento_auditoria (request_id) where request_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Helpers internos
-- ════════════════════════════════════════════════════════════════════════

-- ¿La clave parece un secreto? Se evalúa por segmentos separados por "_" para no borrar
-- columnas legítimas: `clave` (nombre de la característica) o `cpc_pin_cop` (tarifa) se conservan,
-- `pin_hash`, `access_token_cifrado`, `password`, `api_key`, `idempotency_key` se eliminan.
create or replace function public._auditoria_es_clave_secreta(p_clave text)
returns boolean
language sql immutable security definer set search_path = public
as $$
  select coalesce(
    lower(p_clave) ~ '(^|_)(token|tokens|secret|secreto|secreta|secrets|password|passwd|contrasena|hash|key|apikey|cifrado|cifrada|credencial|credential|otp|cvv)(_|$)'
    or lower(p_clave) ~ '^pin(_|$)'
    or lower(p_clave) in ('pin', 'authorization', 'cookie', 'metodo_pago_ref'),
    false);
$$;

-- Quita recursivamente (objetos y arreglos anidados) las claves con forma de secreto.
create or replace function public._auditoria_limpiar(p jsonb)
returns jsonb
language plpgsql immutable security definer set search_path = public
as $$
declare
  r jsonb;
  k text;
  v jsonb;
begin
  if p is null then return null; end if;
  if jsonb_typeof(p) = 'object' then
    r := '{}'::jsonb;
    for k, v in select e.key, e.value from jsonb_each(p) e loop
      if not public._auditoria_es_clave_secreta(k) then
        r := r || jsonb_build_object(k, public._auditoria_limpiar(v));
      end if;
    end loop;
    return r;
  elsif jsonb_typeof(p) = 'array' then
    select coalesce(jsonb_agg(public._auditoria_limpiar(t.e) order by t.i), '[]'::jsonb)
      into r from jsonb_array_elements(p) with ordinality as t(e, i);
    return r;
  end if;
  return p;
end $$;

-- Cabeceras de la petición HTTP actual (PostgREST las publica en `request.headers`). NULL fuera de la API.
create or replace function public._auditoria_cabeceras()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v text := current_setting('request.headers', true);
begin
  if v is null or btrim(v) = '' then return null; end if;
  begin
    return v::jsonb;
  exception when others then
    return null;
  end;
end $$;

-- request_id de la petición, solo si tiene forma segura (evita guardar basura enviada por terceros).
create or replace function public._auditoria_request_id()
returns text
language sql stable security definer set search_path = public
as $$
  select case when v ~ '^[A-Za-z0-9._:-]{1,100}$' then v end
    from (select public._auditoria_cabeceras() ->> 'x-request-id' as v) s;
$$;

-- Origen del cambio. Indicativo, no es una credencial (una cabecera se puede fabricar):
--   SQL     → sin petición HTTP (psql, editor SQL, pg_cron, migraciones);
--   SISTEMA → petición con rol service_role (crons, webhooks, servidor);
--   PANEL   → petición con sesión de usuario y el x-request-id que pone el servidor de Next;
--   API     → petición con sesión de usuario sin ese id (llamada directa a la API de datos).
create or replace function public._auditoria_origen()
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_cab jsonb := public._auditoria_cabeceras();
  v_rol text;
begin
  begin
    v_rol := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    v_rol := null;
  end;
  if v_cab is null and v_rol is null then return 'SQL'; end if;
  if v_rol = 'service_role' then return 'SISTEMA'; end if;
  if public._auditoria_request_id() is not null then return 'PANEL'; end if;
  return 'API';
end $$;

-- Motivo enviado por el servidor en la cabecera `x-auditoria-motivo` (base64 de UTF-8).
-- Permite registrar el motivo en RPC antiguas sin cambiar su lista de parámetros.
create or replace function public._auditoria_motivo_cabecera()
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_b64 text := public._auditoria_cabeceras() ->> 'x-auditoria-motivo';
  v text;
begin
  if v_b64 is null or length(v_b64) > 2000 then return null; end if;
  begin
    v := convert_from(decode(v_b64, 'base64'), 'UTF8');
  exception when others then
    return null;
  end;
  return left(nullif(btrim(v), ''), 500);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Completar cada fila nueva de auditoría (todas las vías de escritura)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._trg_auditoria_completar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.payload_antes := public._auditoria_limpiar(new.payload_antes);
  new.payload_despues := public._auditoria_limpiar(new.payload_despues);
  new.origen := coalesce(new.origen, public._auditoria_origen());
  new.request_id := coalesce(new.request_id, public._auditoria_request_id());
  if new.motivo is null or btrim(new.motivo) = '' then
    new.motivo := public._auditoria_motivo_cabecera();
  end if;
  return new;
end $$;

drop trigger if exists trg_evento_auditoria_completar on public.evento_auditoria;
create trigger trg_evento_auditoria_completar
  before insert on public.evento_auditoria
  for each row execute function public._trg_auditoria_completar();

-- TRUNCATE no dispara los triggers de fila de la 117: se bloquea también a nivel de sentencia.
drop trigger if exists trg_evento_auditoria_no_truncate on public.evento_auditoria;
create trigger trg_evento_auditoria_no_truncate
  before truncate on public.evento_auditoria
  for each statement execute function public.trg_fila_inmutable();

-- ════════════════════════════════════════════════════════════════════════
-- 4. _auditar: helper interno para RPC y triggers
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._auditar(
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_accion text,
  p_negocio_id uuid,
  p_antes jsonb,
  p_despues jsonb,
  p_motivo text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor uuid;
  v_tipo text;
  v_negocio uuid;
  v_id uuid;
begin
  -- actor_id tiene FK a auth.users: solo se guarda si el usuario existe (un JWT de prueba o de un
  -- usuario borrado no debe tumbar la operación auditada).
  if v_uid is not null and exists (select 1 from auth.users u where u.id = v_uid) then
    v_actor := v_uid;
  end if;

  -- negocio_id tiene FK a negocio: si el negocio ya no existe (borrado en cascada), queda NULL.
  if p_negocio_id is not null and exists (select 1 from public.negocio n where n.id = p_negocio_id) then
    v_negocio := p_negocio_id;
  end if;

  if v_uid is null then
    v_tipo := 'SISTEMA';
  else
    v_tipo := coalesce(public.actor_tipo_soporte(v_negocio), 'CLIENTE');
  end if;

  insert into public.evento_auditoria
    (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues, motivo)
  values
    (p_entidad_tipo, p_entidad_id, left(p_accion, 120), v_tipo, v_actor, v_negocio, p_antes, p_despues,
     nullif(btrim(left(p_motivo, 500)), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Trigger genérico antes/después
-- ════════════════════════════════════════════════════════════════════════
-- Argumentos: (entidad_tipo, columna_negocio | '-', columnas_vigiladas_csv | '*', columnas_excluidas_csv | '-')
--   · '*' guarda la fila completa (menos excluidas, timestamps y secretos);
--   · una lista guarda solo esas columnas y solo registra si alguna cambió.

create or replace function public._auditoria_filtrar(p jsonb, p_cols text[], p_excl text[])
returns jsonb
language plpgsql immutable security definer set search_path = public
as $$
declare
  r jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  if p is null then return null; end if;
  for k, v in select e.key, e.value from jsonb_each(p) e loop
    if (p_cols is null or k = any (p_cols)) and not (k = any (p_excl)) then
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end $$;

create or replace function public._trg_auditar_cambio()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_entidad text := tg_argv[0];
  v_col_neg text := nullif(coalesce(tg_argv[1], '-'), '-');
  v_cols text[] := case when coalesce(tg_argv[2], '*') = '*' then null else string_to_array(tg_argv[2], ',') end;
  v_excl text[] := array['updated_at', 'updated_by', 'created_at']
                   || case when coalesce(tg_argv[3], '-') = '-' then '{}'::text[] else string_to_array(tg_argv[3], ',') end;
  v_old jsonb;
  v_new jsonb;
  v_fila jsonb;
  v_id uuid;
  v_neg uuid;
  v_accion text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('UPDATE', 'INSERT') then v_new := to_jsonb(new); end if;
  v_fila := coalesce(v_new, v_old);

  if coalesce(v_fila ->> 'id', '') ~ c_uuid then v_id := (v_fila ->> 'id')::uuid; end if;
  if v_col_neg is not null and coalesce(v_fila ->> v_col_neg, '') ~ c_uuid then
    v_neg := (v_fila ->> v_col_neg)::uuid;
  end if;

  v_old := public._auditoria_limpiar(public._auditoria_filtrar(v_old, v_cols, v_excl));
  v_new := public._auditoria_limpiar(public._auditoria_filtrar(v_new, v_cols, v_excl));

  if tg_op = 'UPDATE' and v_old is not distinct from v_new then
    return null;   -- nada auditable cambió (p. ej. solo updated_at)
  end if;

  v_accion := upper(v_entidad) || case tg_op when 'INSERT' then '_CREADO' when 'DELETE' then '_ELIMINADO' else '_ACTUALIZADO' end;
  if tg_op = 'UPDATE' and v_old ? 'estado' and (v_old -> 'estado') is distinct from (v_new -> 'estado') then
    v_accion := upper(v_entidad) || '_ESTADO_' || upper(coalesce(v_new ->> 'estado', 'NULO'));
  end if;

  -- Para tablas sin columna de negocio no se rellena negocio_id: el dueño no las ve (configuración global).
  perform public._auditar(v_entidad, v_id, v_accion, v_neg,
    case when tg_op = 'INSERT' then null else v_old end,
    case when tg_op = 'DELETE' then null else v_new end,
    null);
  return null;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Instalación de los triggers
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- Configuración de plataforma (solo SuperSU; fila completa)
      ('pais',                     'pais',                     '-',          '*',   '-',         'insert or update or delete'),
      ('plan',                     'plan',                     '-',          '*',   '-',         'insert or update or delete'),
      ('plan_precio',              'plan_precio',              '-',          '*',   '-',         'insert or update or delete'),
      ('plan_caracteristica',      'plan_caracteristica',      '-',          '*',   '-',         'insert or update or delete'),
      ('addon_precio',             'addon_precio',             '-',          '*',   '-',         'insert or update or delete'),
      ('feature_flag',             'feature_flag',             '-',          '*',   '-',         'insert or update or delete'),
      ('configuracion_plataforma', 'configuracion_plataforma', '-',          '*',   '-',         'insert or update or delete'),
      ('ai_modelo_config',         'ai_modelo_config',         '-',          '*',   '-',         'insert or update or delete'),
      ('ai_paquete_creditos',      'ai_paquete_creditos',      '-',          '*',   '-',         'insert or update or delete'),
      ('ai_accion_costo',          'ai_accion_costo',          '-',          '*',   '-',         'insert or update or delete'),
      ('plan_funcion_ia',          'plan_funcion_ia',          '-',          '*',   '-',         'insert or update or delete'),
      ('ciudad_habilitada',        'ciudad_habilitada',        '-',          '*',   '-',         'insert or update or delete'),
      ('banner_home',              'banner_home',              '-',          '*',   '-',         'insert or update or delete'),
      ('texto_legal',              'texto_legal',              '-',          '*',   'contenido', 'insert or update or delete'),
      -- Escalamiento de privilegios
      ('perfil',                   'perfil',                   '-',          'es_supersu', '-',  'update of es_supersu'),
      -- Negocio: comerciales, estado, plan, comisión, política, anticipo
      ('negocio',                  'negocio',                  'id',         '*',   '-',         'insert or update or delete'),
      ('suscripcion',              'suscripcion',              'negocio_id',
         'estado,plan_codigo,plan_codigo_destino,ciclo,pais_codigo,activacion_manual,manual_tipo,manual_hasta,manual_referencia,prueba_inicio,prueba_fin,gracia_fin,suspendido_causa',
         '-', 'insert or update or delete'),
      ('vinculo_staff_negocio',    'vinculo_staff_negocio',    'negocio_id', 'staff_id,sede_activa_id,es_guardian,estado,comision_pct', '-', 'insert or update or delete'),
      ('conexion_pago_negocio',    'conexion_pago_negocio',    'negocio_id', 'proveedor,estado,entorno,cuenta_externa_id,conectada_at,revocada_at', '-', 'insert or update or delete'),
      -- Cambios de ESTADO de entidades de alto volumen (no su creación)
      ('reserva',                  'reserva',                  'negocio_id', 'estado,cancelado_por,cancelado_motivo', '-', 'update of estado'),
      ('pago',                     'pago',                     'negocio_id', 'estado,tipo,monto,monto_reembolsado,reserva_id,cuenta_cobro', '-', 'update of estado'),
      ('gift_card',                'gift_card',                'negocio_id', 'estado,bloqueada_hasta', '-', 'update of estado, bloqueada_hasta'),
      ('resena',                   'resena',                   'negocio_id', 'estado,respuesta_negocio,moderado_motivo', '-', 'update of estado, respuesta_negocio'),
      ('reembolso',                'reembolso',                'negocio_id', 'estado,intentos,monto,pct,ultimo_error,pago_id', '-', 'update of estado'),
      ('campana_publicitaria',     'campana_publicitaria',     'negocio_id', 'estado,presupuesto_diario,presupuesto_total,fecha_fin,formato,unidad_cobro', '-', 'update of estado, presupuesto_diario, presupuesto_total, fecha_fin'),
      ('lealtad_fraude_evento',    'lealtad_fraude_evento',    'negocio_id', 'revisado,tipo,severidad,cliente_id', '-', 'update of revisado'),
      ('ticket_soporte',           'ticket_soporte',           'negocio_id', 'estado', '-', 'update of estado'),
      -- Configuración del negocio (panel)
      ('servicio',                 'servicio',                 'negocio_id', '*',   '-',         'insert or update or delete'),
      ('servicio_combo',           'servicio_combo',           'negocio_id', '*',   '-',         'insert or update or delete'),
      ('producto',                 'producto',                 'negocio_id', '*',   '-',         'insert or update or delete'),
      ('sede',                     'sede',                     'negocio_id', '*',   '-',         'insert or update or delete'),
      ('membresia_plan',           'membresia_plan',           'negocio_id', '*',   '-',         'insert or update or delete'),
      ('referido_config',          'referido_config',          'negocio_id', '*',   '-',         'insert or update or delete'),
      ('cashback_regla',           'cashback_regla',           'negocio_id', '*',   '-',         'insert or update or delete'),
      ('sello_campana',            'sello_campana',            'negocio_id', '*',   '-',         'insert or update or delete'),
      ('recompensa_regla',         'recompensa_regla',         'negocio_id', '*',   '-',         'insert or update or delete'),
      ('vip_nivel',                'vip_nivel',                'negocio_id', '*',   '-',         'insert or update or delete'),
      ('negocio_addon',            'negocio_addon',            'negocio_id', '*',   '-',         'insert or update or delete'),
      ('negocio_marca',            'negocio_marca',            'negocio_id', '*',   '-',         'insert or update or delete'),
      ('oferta_negocio',           'oferta_negocio',           'negocio_id', '*',   '-',         'insert or update or delete'),
      ('corporativo_cuenta',       'corporativo_cuenta',       'negocio_id', '*',   '-',         'insert or update or delete'),
      ('reserva_foto',             'reserva_foto',             'negocio_id', 'reserva_id,cliente_id,consentimiento,momento,compartida,subido_por', '-', 'insert or update or delete'),
      -- CRM: se audita la edición, no el texto libre de la nota (dato personal)
      ('cliente_nota',             'cliente_nota',             'negocio_id', '*',   'texto',     'insert or update or delete'),
      ('cliente_etiqueta',         'cliente_etiqueta',         'negocio_id', '*',   '-',         'insert or update or delete')
    ) as t(tabla, entidad, col_negocio, cols, excl, eventos)
  loop
    if to_regclass('public.' || r.tabla) is null then
      raise notice 'auditoria 123: tabla % no existe, se omite', r.tabla;
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', 'trg_auditar_' || r.tabla, r.tabla);
    -- r.eventos es una constante de esta migración (no viene de datos); se valida igualmente.
    if r.eventos !~ '^(insert or update or delete|update of [a-z_, ]+)$' then
      raise exception 'auditoria 123: eventos inválidos para %', r.tabla;
    end if;
    execute format(
      'create trigger %I after ' || r.eventos || ' on public.%I for each row execute function public._trg_auditar_cambio(%L, %L, %L, %L)',
      'trg_auditar_' || r.tabla, r.tabla, r.entidad, r.col_negocio, r.cols, r.excl);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Lectura (SuperSU: todo; dueño: solo su negocio)
-- ════════════════════════════════════════════════════════════════════════

-- La RLS existente (006) ya tiene `auditoria_select_negocio` = is_barberia_de(negocio_id) y
-- `auditoria_select_supersu`. Se re-crea la del dueño con la forma explícita pedida por la directiva.
drop policy if exists auditoria_select_negocio on public.evento_auditoria;
create policy auditoria_select_negocio on public.evento_auditoria
  for select using (negocio_id is not null and coalesce(public.is_barberia_de(negocio_id), false));

create or replace function public.auditoria_listar(
  p_negocio_id uuid default null,
  p_entidad_tipo text default null,
  p_accion text default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_limite integer default 50,
  p_offset integer default 0
) returns table (
  id uuid,
  created_at timestamptz,
  entidad_tipo text,
  entidad_id uuid,
  accion text,
  actor_tipo text,
  actor_nombre text,
  negocio_id uuid,
  negocio_nombre text,
  motivo text,
  origen text,
  request_id text,
  payload_antes jsonb,
  payload_despues jsonb
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_su boolean := coalesce(public.is_supersu(), false);
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 101);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_accion text := nullif(btrim(left(p_accion, 80)), '');
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;
  if not v_su then
    -- El dueño solo puede pedir SU negocio; sin negocio no hay lectura.
    if p_negocio_id is null or not coalesce(public.is_barberia_de(p_negocio_id), false) then
      raise exception 'NO_AUTORIZADO';
    end if;
  end if;

  if v_accion is not null then
    v_accion := replace(replace(replace(v_accion, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  return query
  select e.id, e.created_at, e.entidad_tipo, e.entidad_id, e.accion, e.actor_tipo,
         case when v_su or e.actor_tipo <> 'SUPERSU' then pf.nombre end,
         e.negocio_id, n.nombre, e.motivo, e.origen,
         case when v_su then e.request_id end,
         e.payload_antes, e.payload_despues
    from public.evento_auditoria e
    left join public.negocio n on n.id = e.negocio_id
    left join public.perfil pf on pf.id = e.actor_id
   where (p_negocio_id is null or e.negocio_id = p_negocio_id)
     and (p_entidad_tipo is null or e.entidad_tipo = p_entidad_tipo)
     and (v_accion is null or e.accion ilike '%' || v_accion || '%')
     and (p_desde is null or e.created_at >= p_desde)
     and (p_hasta is null or e.created_at < p_hasta)
   order by e.created_at desc, e.id desc
   limit v_limite offset v_offset;
end $$;

create or replace function public.auditoria_entidades(p_negocio_id uuid default null)
returns setof text
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;
  if not coalesce(public.is_supersu(), false) then
    if p_negocio_id is null or not coalesce(public.is_barberia_de(p_negocio_id), false) then
      raise exception 'NO_AUTORIZADO';
    end if;
  end if;
  return query
  select distinct e.entidad_tipo from public.evento_auditoria e
   where p_negocio_id is null or e.negocio_id = p_negocio_id
   order by 1;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. Permisos
-- ════════════════════════════════════════════════════════════════════════

-- Internas: ningún rol de API las ejecuta (los triggers corren como su dueño).
revoke all on function public._auditoria_es_clave_secreta(text) from public, anon, authenticated, service_role;
revoke all on function public._auditoria_limpiar(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._auditoria_cabeceras() from public, anon, authenticated, service_role;
revoke all on function public._auditoria_request_id() from public, anon, authenticated, service_role;
revoke all on function public._auditoria_origen() from public, anon, authenticated, service_role;
revoke all on function public._auditoria_motivo_cabecera() from public, anon, authenticated, service_role;
revoke all on function public._auditoria_filtrar(jsonb, text[], text[]) from public, anon, authenticated, service_role;
revoke all on function public._trg_auditoria_completar() from public, anon, authenticated, service_role;
revoke all on function public._trg_auditar_cambio() from public, anon, authenticated, service_role;
revoke all on function public._auditar(text, uuid, text, uuid, jsonb, jsonb, text) from public, anon, authenticated, service_role;

-- Lectura: solo usuarios con sesión; la función decide qué filas.
revoke all on function public.auditoria_listar(uuid, text, text, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.auditoria_listar(uuid, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
revoke all on function public.auditoria_entidades(uuid) from public, anon, authenticated;
grant execute on function public.auditoria_entidades(uuid) to authenticated;

-- La tabla sigue siendo solo de anexar. service_role conserva INSERT (lo usan
-- src/lib/auth/identity-events.ts y src/lib/pagos/sincronizar.ts), nunca UPDATE/DELETE/TRUNCATE.
revoke insert, update, delete, truncate on public.evento_auditoria from public, anon, authenticated;
revoke update, delete, truncate on public.evento_auditoria from service_role;
