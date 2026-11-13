-- 116 · Política de cancelación con aceptación explícita, no-show y motor de reembolsos.
--
-- Directiva Única Integral §8, §20, §21 (2026-11-12). Sin aplicar: se pega en el SQL
-- editor de Supabase tras revisión. Es aditiva: no borra ni reescribe datos históricos.
--
--  1. Límites globales de la política (Super Admin) y defaults 24 h / 2 h / 50 %.
--  2. La política de cada negocio solo cambia dentro de esos límites (trigger + RPC auditada).
--  3. `aceptacion_politica_reserva`: evidencia inmutable de que el cliente aceptó la política
--     vigente (snapshot del texto y de los números, versión de términos, zona horaria).
--     Sin aceptación no se puede crear el pago del anticipo.
--  4. `reembolso` + `reembolso_evento`: máquina de estados
--     ELEGIBLE → SOLICITADO → (PROCESANDO →) REEMBOLSADO | FALLIDO → … | REQUIERE_REVISION.
--     Un reembolso solo queda REEMBOLSADO con confirmación de la pasarela.
--  5. `cancelar_reserva` (misma firma) crea la solicitud de reembolso en vez de dejarla
--     solo en memoria del servidor: ninguna vía de cancelación (cliente, panel, cierre,
--     suspensión, eliminación de cuenta) vuelve a perder un reembolso.
--  6. `marcar_no_show`: no presentación → 0 % de devolución.
--
-- Límites exactos (horas = hora_inicio − now(), en timestamptz; no depende de zona horaria):
--   horas >= total            → 100 %
--   parcial <= horas < total  → reembolso_parcial_pct
--   horas < parcial           → 0 %
--   negocio / plataforma cancela → 100 % siempre.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Límites globales
-- ════════════════════════════════════════════════════════════════════════

alter table public.configuracion_plataforma
  add column if not exists politica_total_min_horas  int not null default 6,
  add column if not exists politica_total_max_horas  int not null default 72,
  add column if not exists politica_parcial_min_horas int not null default 0,
  add column if not exists politica_pct_parcial_min  numeric(5,2) not null default 0,
  add column if not exists politica_pct_parcial_max  numeric(5,2) not null default 100,
  add column if not exists reembolso_max_intentos    int not null default 5;

alter table public.configuracion_plataforma
  add constraint politica_limites_coherentes check (
    politica_total_min_horas >= 1
    and politica_total_max_horas >= politica_total_min_horas
    and politica_parcial_min_horas >= 0
    and politica_pct_parcial_min >= 0 and politica_pct_parcial_max <= 100
    and politica_pct_parcial_min <= politica_pct_parcial_max
    and reembolso_max_intentos between 1 and 20);

-- Coherencia mínima en el esquema (los datos actuales ya la cumplen: verificado 2026-11-12).
alter table public.negocio
  add constraint negocio_reembolso_parcial_pct_rango check (reembolso_parcial_pct between 0 and 100),
  add constraint negocio_ventanas_coherentes check (ventana_reembolso_parcial_horas <= ventana_reembolso_total_horas);

-- Toda modificación de la política de un negocio (RPC o UPDATE directo por REST) pasa por aquí.
create or replace function public.trg_negocio_validar_politica() returns trigger
language plpgsql set search_path = public as $$
declare c public.configuracion_plataforma;
begin
  if tg_op = 'UPDATE'
     and new.ventana_reembolso_total_horas is not distinct from old.ventana_reembolso_total_horas
     and new.ventana_reembolso_parcial_horas is not distinct from old.ventana_reembolso_parcial_horas
     and new.reembolso_parcial_pct is not distinct from old.reembolso_parcial_pct then
    return new;
  end if;
  select * into c from public.configuracion_plataforma where id;
  if new.ventana_reembolso_total_horas not between c.politica_total_min_horas and c.politica_total_max_horas
     or new.ventana_reembolso_parcial_horas < c.politica_parcial_min_horas
     or new.ventana_reembolso_parcial_horas > new.ventana_reembolso_total_horas
     or new.reembolso_parcial_pct not between c.politica_pct_parcial_min and c.politica_pct_parcial_max then
    raise exception 'POLITICA_FUERA_DE_LIMITES';
  end if;
  return new;
end $$;

drop trigger if exists trg_negocio_validar_politica on public.negocio;
create trigger trg_negocio_validar_politica
  before insert or update of ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct
  on public.negocio for each row execute function public.trg_negocio_validar_politica();

revoke all on function public.trg_negocio_validar_politica() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Configuración de la política (negocio) y de los límites (Super Admin)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.configurar_politica_cancelacion(
  p_negocio_id uuid, p_total_horas int, p_parcial_horas int, p_parcial_pct numeric, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (public.is_barberia_de(p_negocio_id) or public.is_supersu()) then raise exception 'NO_AUTORIZADO'; end if;
  if p_total_horas is null or p_parcial_horas is null or p_parcial_pct is null then raise exception 'DATOS_INCOMPLETOS'; end if;

  select jsonb_build_object('total_horas', ventana_reembolso_total_horas, 'parcial_horas', ventana_reembolso_parcial_horas,
                            'parcial_pct', reembolso_parcial_pct)
    into v_antes from public.negocio where id = p_negocio_id for update;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;

  -- El trigger valida contra los límites globales; un fallo revierte todo (incluida la auditoría).
  update public.negocio
     set ventana_reembolso_total_horas = p_total_horas,
         ventana_reembolso_parcial_horas = p_parcial_horas,
         reembolso_parcial_pct = round(p_parcial_pct, 2)
   where id = p_negocio_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_antes, payload_despues)
  values ('negocio', p_negocio_id, 'POLITICA_CANCELACION_ACTUALIZADA',
          case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end, auth.uid(), p_negocio_id, p_motivo, v_antes,
          jsonb_build_object('total_horas', p_total_horas, 'parcial_horas', p_parcial_horas, 'parcial_pct', round(p_parcial_pct, 2)));
end $$;

revoke all on function public.configurar_politica_cancelacion(uuid, int, int, numeric, text) from public, anon, authenticated;
grant execute on function public.configurar_politica_cancelacion(uuid, int, int, numeric, text) to authenticated;

create or replace function public.admin_set_limites_politica(
  p_total_min int, p_total_max int, p_parcial_min int, p_pct_min numeric, p_pct_max numeric,
  p_max_intentos int, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes jsonb;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;

  select jsonb_build_object('total_min', politica_total_min_horas, 'total_max', politica_total_max_horas,
                            'parcial_min', politica_parcial_min_horas, 'pct_min', politica_pct_parcial_min,
                            'pct_max', politica_pct_parcial_max, 'max_intentos', reembolso_max_intentos)
    into v_antes from public.configuracion_plataforma where id for update;

  -- Los negocios ya configurados conservan su política: los nuevos límites aplican al
  -- siguiente cambio que hagan (no se reescribe nada retroactivamente).
  update public.configuracion_plataforma
     set politica_total_min_horas = p_total_min, politica_total_max_horas = p_total_max,
         politica_parcial_min_horas = p_parcial_min, politica_pct_parcial_min = p_pct_min,
         politica_pct_parcial_max = p_pct_max, reembolso_max_intentos = p_max_intentos,
         updated_at = now(), updated_by = auth.uid()
   where id;

  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('configuracion_plataforma', 'LIMITES_POLITICA_ACTUALIZADOS', 'SUPERSU', auth.uid(), p_motivo, v_antes,
          jsonb_build_object('total_min', p_total_min, 'total_max', p_total_max, 'parcial_min', p_parcial_min,
                             'pct_min', p_pct_min, 'pct_max', p_pct_max, 'max_intentos', p_max_intentos));
end $$;

revoke all on function public.admin_set_limites_politica(int, int, int, numeric, numeric, int, text) from public, anon, authenticated;
grant execute on function public.admin_set_limites_politica(int, int, int, numeric, numeric, int, text) to authenticated;

-- Lectura de los límites para el panel del negocio (solo estos campos, nada sensible).
create or replace function public.limites_politica_cancelacion()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total_min', politica_total_min_horas, 'total_max', politica_total_max_horas,
                            'parcial_min', politica_parcial_min_horas, 'pct_min', politica_pct_parcial_min,
                            'pct_max', politica_pct_parcial_max, 'max_intentos', reembolso_max_intentos)
    from public.configuracion_plataforma where id;
$$;
revoke all on function public.limites_politica_cancelacion() from public, anon, authenticated;
grant execute on function public.limites_politica_cancelacion() to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Evidencia inmutable de aceptación de la política por reserva
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.aceptacion_politica_reserva (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reserva(id),
  cliente_id uuid not null references public.perfil(id),
  negocio_id uuid not null references public.negocio(id),
  politica jsonb not null,           -- números exactos aceptados
  texto_aceptado text not null,      -- texto mostrado, reconstruido en servidor
  version_politica text not null,    -- md5 del snapshot: identifica la versión
  terminos_id uuid references public.texto_legal(id),
  zona_horaria text not null,
  monto_sena numeric(12,2) not null,
  hora_inicio_reserva timestamptz not null,
  aceptado_at timestamptz not null default now()
);

create index if not exists aceptacion_politica_reserva_negocio_idx on public.aceptacion_politica_reserva (negocio_id, aceptado_at);

alter table public.aceptacion_politica_reserva enable row level security;

create policy aceptacion_politica_select on public.aceptacion_politica_reserva for select to authenticated
  using (cliente_id = auth.uid() or public.is_barberia_de(negocio_id) or public.is_supersu());

revoke insert, update, delete, truncate on public.aceptacion_politica_reserva from public, anon, authenticated;

-- Inmutabilidad genérica para tablas de evidencia/ledger: ni service_role puede alterar filas.
-- Solo el propietario de la base (scripts de mantenimiento revisados) puede hacerlo.
create or replace function public.trg_fila_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'REGISTRO_INMUTABLE: % en %', tg_op, tg_table_name;
end $$;
revoke all on function public.trg_fila_inmutable() from public, anon, authenticated;

create trigger trg_aceptacion_politica_inmutable before update or delete on public.aceptacion_politica_reserva
  for each row execute function public.trg_fila_inmutable();

-- Texto de la política, construido en servidor a partir de los números del negocio.
create or replace function public.texto_politica_cancelacion(p_total int, p_parcial int, p_pct numeric)
returns text language sql immutable set search_path = public as $$
  select format(
    'Cancelas con %s h o más de anticipación: te devolvemos el 100%% del anticipo. '
    'Entre %s h y menos de %s h antes: te devolvemos el %s%%. '
    'Con menos de %s h, o si no te presentas: el anticipo queda para el negocio por el espacio reservado. '
    'Si el negocio cancela, te devolvemos el 100%% siempre.',
    p_total, p_parcial, p_total, trim(to_char(p_pct, 'FM990.##')), p_parcial);
$$;
grant execute on function public.texto_politica_cancelacion(int, int, numeric) to anon, authenticated, service_role;

create or replace function public.aceptar_politica_reserva(p_reserva_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_reserva public.reserva;
  v_negocio public.negocio;
  v_tz text;
  v_politica jsonb;
  v_terminos uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found or v_reserva.cliente_id is distinct from auth.uid() then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  select id into v_id from public.aceptacion_politica_reserva where reserva_id = p_reserva_id;
  if found then return v_id; end if;   -- idempotente: la primera aceptación es la que vale

  if v_reserva.estado <> 'PENDIENTE_PAGO' then raise exception 'RESERVA_NO_PAGABLE'; end if;

  select * into v_negocio from public.negocio where id = v_reserva.negocio_id;
  select coalesce(zona_horaria, 'America/Bogota') into v_tz from public.sede where id = v_reserva.sede_id;
  select id into v_terminos from public.texto_legal where tipo = 'TERMINOS' order by publicado_at desc nulls last limit 1;

  v_politica := jsonb_build_object(
    'total_horas', v_negocio.ventana_reembolso_total_horas,
    'parcial_horas', v_negocio.ventana_reembolso_parcial_horas,
    'parcial_pct', v_negocio.reembolso_parcial_pct,
    'no_show_pct', 0,
    'cancela_negocio_pct', 100);

  insert into public.aceptacion_politica_reserva
    (reserva_id, cliente_id, negocio_id, politica, texto_aceptado, version_politica, terminos_id,
     zona_horaria, monto_sena, hora_inicio_reserva)
  values
    (p_reserva_id, auth.uid(), v_reserva.negocio_id, v_politica,
     public.texto_politica_cancelacion(v_negocio.ventana_reembolso_total_horas, v_negocio.ventana_reembolso_parcial_horas,
                                       v_negocio.reembolso_parcial_pct),
     md5(v_politica::text), v_terminos, coalesce(v_tz, 'America/Bogota'), coalesce(v_reserva.monto_sena, 0),
     v_reserva.hora_inicio)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.aceptar_politica_reserva(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_politica_reserva(uuid) to authenticated;

-- Sin aceptación no nace el pago del anticipo (aplica a toda vía de creación del pago).
create or replace function public.trg_pago_sena_exige_aceptacion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tipo = 'SENA' and new.reserva_id is not null
     and not exists (select 1 from public.aceptacion_politica_reserva a where a.reserva_id = new.reserva_id) then
    raise exception 'POLITICA_NO_ACEPTADA';
  end if;
  return new;
end $$;
revoke all on function public.trg_pago_sena_exige_aceptacion() from public, anon, authenticated;

drop trigger if exists trg_pago_sena_exige_aceptacion on public.pago;
create trigger trg_pago_sena_exige_aceptacion before insert on public.pago
  for each row execute function public.trg_pago_sena_exige_aceptacion();

-- La política que rige una cancelación es la aceptada, no la vigente hoy (no retroactividad).
create or replace function public.politica_de_reserva(p_reserva_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.politica from public.aceptacion_politica_reserva a where a.reserva_id = p_reserva_id),
    (select jsonb_build_object('total_horas', n.ventana_reembolso_total_horas,
                               'parcial_horas', n.ventana_reembolso_parcial_horas,
                               'parcial_pct', n.reembolso_parcial_pct)
       from public.reserva r join public.negocio n on n.id = r.negocio_id where r.id = p_reserva_id));
$$;
revoke all on function public.politica_de_reserva(uuid) from public, anon, authenticated;
grant execute on function public.politica_de_reserva(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Reembolsos: tabla, historial y máquina de estados
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.reembolso (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pago(id),
  reserva_id uuid references public.reserva(id),
  negocio_id uuid references public.negocio(id),
  cliente_id uuid references public.perfil(id),
  monto numeric(12,2) not null check (monto > 0),
  pct numeric(5,2) not null check (pct > 0 and pct <= 100),
  motivo text not null check (motivo in ('CANCELACION_CLIENTE_VENTANA_TOTAL','CANCELACION_CLIENTE_VENTANA_PARCIAL',
                                         'CANCELACION_NEGOCIO','NO_SHOW_STAFF','AJUSTE_SERVICIO','RESOLUCION_DISPUTA',
                                         'CORTESIA_COMERCIAL')),
  origen text not null check (origen in ('CANCELACION_CLIENTE','CANCELACION_NEGOCIO','CIERRE_O_SUSPENSION',
                                         'CUENTA_ELIMINADA','PAGO_TARDIO','WEBHOOK_HUERFANO','AJUSTE')),
  estado text not null default 'ELEGIBLE'
    check (estado in ('ELEGIBLE','SOLICITADO','PROCESANDO','REEMBOLSADO','FALLIDO','REQUIERE_REVISION')),
  intentos int not null default 0,
  ultimo_error text,
  id_reembolso_pasarela text,
  idempotency_key text not null unique,
  solicitado_at timestamptz,
  confirmado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reembolso_pendientes_idx on public.reembolso (estado, updated_at)
  where estado in ('ELEGIBLE','SOLICITADO','PROCESANDO','FALLIDO');
create index if not exists reembolso_negocio_idx on public.reembolso (negocio_id, created_at);

create table if not exists public.reembolso_evento (
  id bigserial primary key,
  reembolso_id uuid not null references public.reembolso(id),
  estado_origen text,
  estado_destino text not null,
  actor_tipo text not null,
  actor_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create trigger trg_reembolso_evento_inmutable before update or delete on public.reembolso_evento
  for each row execute function public.trg_fila_inmutable();

-- Un reembolso nunca se borra; su estado solo cambia por transiciones válidas.
create or replace function public.trg_reembolso_transicion() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if current_user in ('postgres','supabase_admin') then return old; end if;
    raise exception 'REGISTRO_INMUTABLE: DELETE en reembolso';
  end if;
  if new.pago_id is distinct from old.pago_id or new.monto is distinct from old.monto
     or new.pct is distinct from old.pct or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'REEMBOLSO_CAMPO_INMUTABLE';
  end if;
  if new.estado is distinct from old.estado and not (
       (old.estado = 'ELEGIBLE'   and new.estado in ('SOLICITADO','REQUIERE_REVISION'))
    or (old.estado = 'SOLICITADO' and new.estado in ('PROCESANDO','REEMBOLSADO','FALLIDO','REQUIERE_REVISION'))
    or (old.estado = 'PROCESANDO' and new.estado in ('REEMBOLSADO','FALLIDO','REQUIERE_REVISION'))
    or (old.estado = 'FALLIDO'    and new.estado in ('SOLICITADO','REQUIERE_REVISION'))
    or (old.estado = 'REQUIERE_REVISION' and new.estado in ('SOLICITADO'))) then
    raise exception 'TRANSICION_REEMBOLSO_INVALIDA: % -> %', old.estado, new.estado;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.trg_reembolso_transicion() from public, anon, authenticated;

create trigger trg_reembolso_transicion before update or delete on public.reembolso
  for each row execute function public.trg_reembolso_transicion();

alter table public.reembolso enable row level security;
alter table public.reembolso_evento enable row level security;

create policy reembolso_select on public.reembolso for select to authenticated
  using (cliente_id = auth.uid() or public.is_barberia_de(negocio_id) or public.is_supersu());
create policy reembolso_evento_select on public.reembolso_evento for select to authenticated
  using (exists (select 1 from public.reembolso r where r.id = reembolso_id
                 and (r.cliente_id = auth.uid() or public.is_barberia_de(r.negocio_id) or public.is_supersu())));

revoke insert, update, delete, truncate on public.reembolso, public.reembolso_evento from public, anon, authenticated;
revoke usage on sequence public.reembolso_evento_id_seq from public, anon, authenticated;

-- Permisos explícitos (no depender de los default privileges del proyecto): lectura para
-- usuarios con RLS y para el servidor; escritura solo vía funciones SECURITY DEFINER.
revoke all on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from anon;
grant select on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento to authenticated, service_role;
revoke insert, update, delete, truncate on public.aceptacion_politica_reserva, public.reembolso, public.reembolso_evento from service_role;

-- Interna: crea la solicitud (idempotente por pago + origen).
create or replace function public._reembolso_crear(
  p_pago_id uuid, p_monto numeric, p_pct numeric, p_motivo text, p_origen text, p_actor_tipo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pago public.pago; v_res public.reserva; v_id uuid;
begin
  if coalesce(p_monto, 0) <= 0 then return null; end if;
  select * into v_pago from public.pago where id = p_pago_id;
  if not found then return null; end if;
  select * into v_res from public.reserva where id = v_pago.reserva_id;

  insert into public.reembolso (pago_id, reserva_id, negocio_id, cliente_id, monto, pct, motivo, origen, idempotency_key)
  values (p_pago_id, v_pago.reserva_id, v_pago.negocio_id, v_res.cliente_id, least(round(p_monto, 2), v_pago.monto),
          p_pct, p_motivo, p_origen, 'reembolso:' || p_pago_id)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.reembolso_evento (reembolso_id, estado_origen, estado_destino, actor_tipo, actor_id, detalle)
    values (v_id, null, 'ELEGIBLE', p_actor_tipo, auth.uid(), jsonb_build_object('origen', p_origen, 'monto', p_monto));
  else
    select id into v_id from public.reembolso where idempotency_key = 'reembolso:' || p_pago_id;
  end if;
  return v_id;
end $$;
revoke all on function public._reembolso_crear(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public._reembolso_crear(uuid, numeric, numeric, text, text, text) to service_role;

-- Worker (servidor): toma lotes de reembolsos pendientes y los marca SOLICITADO.
create or replace function public.reembolso_tomar_pendientes(p_limite int default 20)
returns setof public.reembolso language plpgsql security definer set search_path = public as $$
declare v_max int; r public.reembolso;
begin
  select reembolso_max_intentos into v_max from public.configuracion_plataforma where id;
  for r in
    select * from public.reembolso
     where (estado = 'ELEGIBLE')
        or (estado = 'FALLIDO' and intentos < coalesce(v_max, 5)
            and updated_at < now() - make_interval(mins => 30 * greatest(intentos, 1)))
     order by created_at
     limit greatest(1, least(p_limite, 100))
     for update skip locked
  loop
    update public.reembolso set estado = 'SOLICITADO', intentos = intentos + 1, solicitado_at = now()
     where id = r.id returning * into r;
    insert into public.reembolso_evento (reembolso_id, estado_origen, estado_destino, actor_tipo, detalle)
    values (r.id, case when r.intentos = 1 then 'ELEGIBLE' else 'FALLIDO' end, 'SOLICITADO', 'SISTEMA',
            jsonb_build_object('intento', r.intentos));
    return next r;
  end loop;
end $$;
revoke all on function public.reembolso_tomar_pendientes(int) from public, anon, authenticated;
grant execute on function public.reembolso_tomar_pendientes(int) to service_role;

-- Resultado de la pasarela. p_estado_pasarela: 'approved' confirma; 'in_process'/'pending' deja
-- PROCESANDO (se reconcilia luego); cualquier error → FALLIDO (o REQUIERE_REVISION al agotar intentos).
create or replace function public.reembolso_registrar_resultado(
  p_reembolso_id uuid, p_estado_pasarela text, p_id_pasarela text, p_error text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.reembolso; v_pago public.pago; v_max int; v_destino text;
  v_total_reembolsado numeric; v_comision_rev numeric; v_neto_rev numeric; v_wallet uuid;
begin
  select * into r from public.reembolso where id = p_reembolso_id for update;
  if not found then raise exception 'REEMBOLSO_NO_ENCONTRADO'; end if;
  if r.estado = 'REEMBOLSADO' then return 'REEMBOLSADO'; end if;   -- idempotente
  if r.estado not in ('SOLICITADO','PROCESANDO') then raise exception 'REEMBOLSO_NO_EN_CURSO'; end if;

  select reembolso_max_intentos into v_max from public.configuracion_plataforma where id;

  v_destino := case
    when p_error is null and p_estado_pasarela = 'approved' then 'REEMBOLSADO'
    when p_error is null and p_estado_pasarela in ('in_process','pending','authorized') then 'PROCESANDO'
    when r.intentos >= coalesce(v_max, 5) then 'REQUIERE_REVISION'
    else 'FALLIDO' end;

  if v_destino = r.estado then return v_destino; end if;

  update public.reembolso
     set estado = v_destino,
         id_reembolso_pasarela = coalesce(p_id_pasarela, id_reembolso_pasarela),
         ultimo_error = case when v_destino in ('FALLIDO','REQUIERE_REVISION') then left(coalesce(p_error, p_estado_pasarela), 500) else ultimo_error end,
         confirmado_at = case when v_destino = 'REEMBOLSADO' then now() else confirmado_at end
   where id = r.id;

  insert into public.reembolso_evento (reembolso_id, estado_origen, estado_destino, actor_tipo, detalle)
  values (r.id, r.estado, v_destino, 'PASARELA',
          jsonb_build_object('estado_pasarela', p_estado_pasarela, 'id_pasarela', p_id_pasarela, 'error', left(p_error, 500)));

  if v_destino = 'REEMBOLSADO' then
    select * into v_pago from public.pago where id = r.pago_id for update;
    v_total_reembolsado := least(coalesce(v_pago.monto_reembolsado, 0) + r.monto, v_pago.monto);
    update public.pago
       set estado = case when v_total_reembolsado >= v_pago.monto then 'REEMBOLSADO'::pago_estado else 'REEMBOLSADO_PARCIAL'::pago_estado end,
           monto_reembolsado = v_total_reembolsado,
           motivo_reembolso = r.motivo,
           updated_at = now()
     where id = r.pago_id;

    -- Reverso contable del neto acreditado (pagos cobrados en custodia, previos al cobro directo).
    -- Una sola vez por reembolso: índice único sobre (referencia_tipo, referencia_id, tipo).
    select id into v_wallet from public.wallet where negocio_id = v_pago.negocio_id for update;
    if v_wallet is not null and exists (select 1 from public.wallet_movimiento
                                         where referencia_tipo = 'pago' and referencia_id = v_pago.id and tipo = 'COMISION') then
      v_comision_rev := round(coalesce(v_pago.comision_plataforma_monto, 0) * least(r.monto / nullif(v_pago.monto, 0), 1), 2);
      v_neto_rev := r.monto - v_comision_rev;
      insert into public.wallet_movimiento (wallet_id, tipo, monto, referencia_tipo, referencia_id)
      values (v_wallet, 'REEMBOLSO_COMISION', -v_neto_rev, 'reembolso', r.id)
      on conflict do nothing;
      if found then
        update public.wallet set saldo_disponible = saldo_disponible - v_neto_rev, updated_at = now() where id = v_wallet;
      end if;
    end if;

    if r.cliente_id is not null then
      perform public._notificar(r.cliente_id, 'SISTEMA', 'Reembolso confirmado',
        format('Te devolvimos %s del anticipo. Puede tardar unos días en verse en tu medio de pago.', to_char(r.monto, 'FM999G999G990')),
        'Refund confirmed', format('We refunded %s of your deposit. It may take a few days to show up.', to_char(r.monto, 'FM999G999G990')),
        r.reserva_id, r.negocio_id, 'reembolso:' || r.id);
    end if;
  end if;

  return v_destino;
end $$;
revoke all on function public.reembolso_registrar_resultado(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reembolso_registrar_resultado(uuid, text, text, text) to service_role;

create unique index if not exists wallet_movimiento_reverso_unico
  on public.wallet_movimiento (referencia_tipo, referencia_id, tipo) where referencia_tipo = 'reembolso';

-- Super Admin: reencolar un reembolso en revisión, con motivo.
create or replace function public.admin_reintentar_reembolso(p_reembolso_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reembolso;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into r from public.reembolso where id = p_reembolso_id for update;
  if not found then raise exception 'REEMBOLSO_NO_ENCONTRADO'; end if;
  if r.estado not in ('REQUIERE_REVISION','FALLIDO') then raise exception 'REEMBOLSO_NO_REINTENTABLE'; end if;
  update public.reembolso set estado = 'SOLICITADO', intentos = 0, solicitado_at = now() where id = r.id;
  insert into public.reembolso_evento (reembolso_id, estado_origen, estado_destino, actor_tipo, actor_id, detalle)
  values (r.id, r.estado, 'SOLICITADO', 'SUPERSU', auth.uid(), jsonb_build_object('motivo', p_motivo));
end $$;
revoke all on function public.admin_reintentar_reembolso(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reintentar_reembolso(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. cancelar_reserva: misma firma; ahora usa la política aceptada y encola el reembolso
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.cancelar_reserva(p_reserva_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_actor uuid := auth.uid();
  v_reserva public.reserva;
  v_es_cliente boolean;
  v_es_negocio boolean;
  v_horas numeric;
  v_pct numeric;
  v_pol jsonb;
  v_pago public.pago;
  v_tiene_pago boolean;
  v_monto_reembolso numeric := 0;
  v_motivo_catalogo text;
  v_reembolso_id uuid;
  v_origen text;
begin
  if v_actor is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  -- coalesce: con staff_id nulo, `staff_id = actor` da NULL y en la 008 eso hacía que la
  -- cancelación del cliente se tratara como del negocio (100 % siempre). Corregido aquí.
  v_es_cliente := coalesce(v_reserva.cliente_id = v_actor, false);
  v_es_negocio := coalesce(public.is_barberia_de(v_reserva.negocio_id), false)
               or coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)
               or coalesce(v_reserva.staff_id = v_actor, false);

  if not (v_es_cliente or v_es_negocio or public.is_supersu()) then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado in ('COMPLETADA','CANCELADA','NO_SHOW','EN_CURSO') then raise exception 'RESERVA_NO_CANCELABLE'; end if;

  v_horas := extract(epoch from (v_reserva.hora_inicio - now())) / 3600;
  v_pol := public.politica_de_reserva(p_reserva_id);

  if v_es_cliente and not v_es_negocio then
    v_origen := 'CANCELACION_CLIENTE';
    if v_horas >= (v_pol->>'total_horas')::numeric then
      v_pct := 100; v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_TOTAL';
    elsif v_horas >= (v_pol->>'parcial_horas')::numeric then
      v_pct := (v_pol->>'parcial_pct')::numeric; v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_PARCIAL';
    else
      v_pct := 0; v_motivo_catalogo := null;
    end if;
  else
    -- Negocio, staff o plataforma: 100 %, siempre.
    v_pct := 100; v_motivo_catalogo := 'CANCELACION_NEGOCIO';
    -- Las cascadas de 024/049 pasan 'Negocio suspendido: …' / 'Negocio dado de baja…'.
    v_origen := case when coalesce(p_motivo, '') ~ '^Negocio (suspendido|dado de baja)'
                     then 'CIERRE_O_SUSPENSION' else 'CANCELACION_NEGOCIO' end;
  end if;

  update public.reserva
     set estado = 'CANCELADA',
         cancelado_por = case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'NEGOCIO' end,
         cancelado_motivo = p_motivo,
         updated_at = now()
   where id = p_reserva_id;

  select * into v_pago from public.pago
   where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'APROBADO'
   order by created_at desc limit 1;
  v_tiene_pago := found;

  if v_tiene_pago and v_pct > 0 then
    v_monto_reembolso := round(v_pago.monto * v_pct / 100, 2);
    v_reembolso_id := public._reembolso_crear(v_pago.id, v_monto_reembolso, v_pct, v_motivo_catalogo, v_origen,
                                              case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end);
  end if;

  insert into public.evento_auditoria
    (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values
    ('reserva', p_reserva_id, 'RESERVA_CANCELADA',
     case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end,
     v_actor, v_reserva.negocio_id, p_motivo,
     jsonb_build_object('reembolso_pct', v_pct, 'reembolso_monto', v_monto_reembolso, 'reembolso_id', v_reembolso_id,
                        'horas_antes', round(v_horas, 2), 'politica', v_pol));

  -- El `pago` sigue APROBADO hasta que la pasarela confirme la devolución (worker de reembolsos).
  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'pago_id', case when v_tiene_pago then v_pago.id else null end,
    'reembolso_id', v_reembolso_id,
    'reembolso_pct', v_pct,
    'reembolso_monto', v_monto_reembolso,
    'motivo_catalogo', v_motivo_catalogo);
end;
$fn$;

revoke all on function public.cancelar_reserva(uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_reserva(uuid, text) to authenticated;

-- La eliminación de cuenta (100: _anonimizar_cliente) cancela citas futuras con UPDATE directo
-- y solo auditaba el 100 %. Este trigger encola el reembolso real sin reescribir esa función.
create or replace function public.trg_reserva_cuenta_eliminada_reembolso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pago_id uuid; v_monto numeric;
begin
  if new.estado = 'CANCELADA' and old.estado is distinct from 'CANCELADA'
     and new.cancelado_motivo = 'CUENTA_ELIMINADA' then
    select p.id, p.monto into v_pago_id, v_monto from public.pago p
     where p.reserva_id = new.id and p.tipo = 'SENA' and p.estado = 'APROBADO'
     order by p.created_at desc limit 1;
    if v_pago_id is not null then
      perform public._reembolso_crear(v_pago_id, v_monto, 100, 'CORTESIA_COMERCIAL', 'CUENTA_ELIMINADA', 'SISTEMA');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_reserva_cuenta_eliminada_reembolso() from public, anon, authenticated;

drop trigger if exists trg_reserva_cuenta_eliminada_reembolso on public.reserva;
create trigger trg_reserva_cuenta_eliminada_reembolso after update of estado on public.reserva
  for each row execute function public.trg_reserva_cuenta_eliminada_reembolso();

-- Misma falla de NULL en completar_venta_pos (P0, vigente en producción): un usuario ajeno a
-- una reserva sin staff podía cerrar su venta POS. Parche verificado del texto vigente
-- (idéntico a supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql; idempotente).
do $$
declare r record; v_def text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'completar_venta_pos'
  loop
    v_def := pg_get_functiondef(r.oid);
    if position('or v_reserva.staff_id = auth.uid();' in v_def) > 0 then
      v_def := replace(v_def, 'or v_reserva.staff_id = auth.uid();', 'or coalesce(v_reserva.staff_id = auth.uid(), false);');
      v_def := replace(v_def, 'if not v_autorizado then', 'if not coalesce(v_autorizado, false) then');
      execute v_def;
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. No presentación
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.marcar_no_show(p_reserva_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_reserva public.reserva;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  -- coalesce: con staff_id nulo la comparación da NULL y `not (… or NULL)` no lanzaría.
  if not (coalesce(public.is_barberia_de(v_reserva.negocio_id), false)
          or coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)
          or coalesce(v_reserva.staff_id = auth.uid(), false)
          or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_reserva.estado <> 'CONFIRMADA' then raise exception 'TRANSICION_RESERVA_INVALIDA'; end if;
  if now() < v_reserva.hora_inicio then raise exception 'NO_SHOW_ANTES_DE_LA_HORA'; end if;

  update public.reserva set estado = 'NO_SHOW', updated_at = now() where id = p_reserva_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values ('reserva', p_reserva_id, 'RESERVA_NO_SHOW', case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end,
          auth.uid(), v_reserva.negocio_id, p_motivo, jsonb_build_object('reembolso_pct', 0));
end $$;
revoke all on function public.marcar_no_show(uuid, text) from public, anon, authenticated;
grant execute on function public.marcar_no_show(uuid, text) to authenticated;
