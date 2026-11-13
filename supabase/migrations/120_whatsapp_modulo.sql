-- 120: Modulo interno de WhatsApp (cuotas, recargas, plantillas, campanas, mensajes y libro de consumo).
-- SIN proveedor conectado: nada en esta migracion envia, entrega ni lee mensajes. Los estados ENVIADO/ENTREGADO/LEIDO
-- solo los fija una funcion de service_role alimentada por la evidencia del proveedor (id de mensaje + payload).
-- Mientras whatsapp_config.estado_conexion no sea PRODUCCION, toda campana o mensaje queda BLOQUEADO_SIN_CONEXION.
-- Reglas comerciales configurables por SuperSU (nunca constantes): % marketing sobre la cuota del plan (40),
-- % marketing sobre recargas (10), vencimiento de recargas (12 meses), umbrales de alerta (80/100), paquetes de recarga.
-- Cada cambio de configuracion deja fila en evento_auditoria con payload_antes / payload_despues / motivo.
-- Orden de consumo: primero el lote del plan del mes, luego las recargas vigentes por vencimiento (FIFO), tal como lo
-- dicen los Terminos v3 (sec. 11: "las recargas se consumen despues de la cuota del Plan").
-- Recargas: aqui solo se crea la solicitud PENDIENTE_PAGO. El cobro (checkout + webhook) lo conecta la fase de pagos,
-- que al aprobar el pago llama whatsapp_acreditar_recarga(compra, pago) con service_role. Es idempotente.
-- PENDIENTE DE APLICAR por Wilder.

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0) Tipos
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
do $$ begin
  create type public.whatsapp_estado_conexion as enum
    ('NO_CONFIGURADO','PENDIENTE_CREDENCIALES','SANDBOX','PRODUCCION','SUSPENDIDO','REVOCADO','ERROR');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.whatsapp_categoria as enum ('UTILIDAD','MARKETING');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.whatsapp_plantilla_estado as enum ('BORRADOR','PENDIENTE_APROBACION','APROBADA','RECHAZADA');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.whatsapp_campana_estado as enum
    ('BORRADOR','PROGRAMADA','BLOQUEADA_SIN_CONEXION','EN_ENVIO','COMPLETADA','CANCELADA');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.whatsapp_mensaje_estado as enum
    ('PREPARADO','BLOQUEADO_SIN_CONEXION','ENVIADO','ENTREGADO','LEIDO','FALLIDO');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.whatsapp_compra_estado as enum ('PENDIENTE_PAGO','ACREDITADA','CANCELADA');
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1) Consentimiento: nuevo proposito 'marketing_whatsapp' (aditivo, las filas existentes siguen validas)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
            where c.conrelid = 'public.consentimiento_evento'::regclass and c.contype = 'c'
              and pg_get_constraintdef(c.oid) like '%marketing_email%'
  loop
    execute format('alter table public.consentimiento_evento drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.consentimiento_evento add constraint consentimiento_evento_proposito_chk check (proposito in
  ('analitica','personalizacion','ofertas_cercanas','beneficios_marcas','marketing_email','marketing_whatsapp'));

-- Misma firma y permisos que en la 091; solo se agrega el proposito nuevo a la lista.
create or replace function public.privacidad_estado()
returns table (proposito text, otorgado boolean, desde timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  return query
  select p.p, public._consentimiento_vigente(auth.uid(), p.p),
         (select max(c.created_at) from public.consentimiento_evento c
           where c.usuario_id = auth.uid() and c.proposito = p.p)
  from (values ('analitica'),('personalizacion'),('ofertas_cercanas'),
               ('beneficios_marcas'),('marketing_email'),('marketing_whatsapp')) as p(p);
end $$;
revoke all on function public.privacidad_estado() from public, anon, authenticated;
grant execute on function public.privacidad_estado() to authenticated;

create or replace function public.privacidad_guardar(p_preferencias jsonb)
returns table (proposito text, otorgado boolean, desde timestamptz)
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_preferencias is null or jsonb_typeof(p_preferencias) <> 'object' then
    raise exception 'PREFERENCIAS_INVALIDAS';
  end if;
  for k, v in select * from jsonb_each(p_preferencias) loop
    if k not in ('analitica','personalizacion','ofertas_cercanas','beneficios_marcas','marketing_email','marketing_whatsapp') then
      raise exception 'PROPOSITO_INVALIDO';
    end if;
    if jsonb_typeof(v) <> 'boolean' then raise exception 'PREFERENCIAS_INVALIDAS'; end if;
  end loop;
  for k, v in select * from jsonb_each(p_preferencias) loop
    perform public._consentimiento_registrar(auth.uid(), k, (v)::text::boolean, 'centro_privacidad');
  end loop;
  return query select * from public.privacidad_estado();
end $$;
revoke all on function public.privacidad_guardar(jsonb) from public, anon, authenticated;
grant execute on function public.privacidad_guardar(jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2) Tablas
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- Configuracion global (una sola fila). No guarda credenciales: los secretos del proveedor viven en el entorno del servidor.
create table if not exists public.whatsapp_config (
  id boolean primary key default true check (id),
  pct_marketing_plan numeric(5,2) not null default 40 check (pct_marketing_plan between 0 and 100),
  pct_marketing_recarga numeric(5,2) not null default 10 check (pct_marketing_recarga between 0 and 100),
  meses_vencimiento_recarga integer not null default 12 check (meses_vencimiento_recarga between 1 and 36),
  umbrales_alerta integer[] not null default '{80,100}'
    check (cardinality(umbrales_alerta) between 1 and 5 and 1 <= all (umbrales_alerta) and 100 >= all (umbrales_alerta)),
  proveedor text check (proveedor is null or proveedor in ('META_CLOUD_API','TWILIO','DIALOG_360','OTRO')),
  estado_conexion public.whatsapp_estado_conexion not null default 'NO_CONFIGURADO',
  estado_conexion_detalle text check (estado_conexion_detalle is null or length(estado_conexion_detalle) <= 300),
  estado_conexion_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.whatsapp_config (id) values (true) on conflict (id) do nothing;

-- Paquetes de recarga (solo WhatsApp). Versionados: cambiar precio o cantidad crea una version nueva y desactiva la
-- anterior, asi una compra siempre apunta al precio que vio el negocio.
create table if not exists public.whatsapp_paquete (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-Z0-9_]{3,40}$'),
  version integer not null default 1 check (version >= 1),
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  conversaciones integer not null check (conversaciones between 1 and 1000000),
  precio numeric(12,2) not null check (precio > 0 and precio <= 100000000),
  moneda text not null default 'COP' check (moneda ~ '^[A-Z]{3}$'),
  activo boolean not null default true,
  reemplaza_a uuid references public.whatsapp_paquete(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (codigo, version)
);
create unique index if not exists whatsapp_paquete_codigo_activo_uq on public.whatsapp_paquete (codigo) where activo;
insert into public.whatsapp_paquete (codigo, version, nombre, conversaciones, precio, moneda) values
  ('RECARGA_500',  1, 'Recarga 500',   500,  25000, 'COP'),
  ('RECARGA_1500', 1, 'Recarga 1.500', 1500, 60000, 'COP'),
  ('RECARGA_5000', 1, 'Recarga 5.000', 5000, 150000, 'COP')
on conflict (codigo, version) do nothing;

-- Solicitudes de recarga. Precio, cantidad, % marketing y vencimiento quedan congelados al solicitar.
create table if not exists public.whatsapp_compra_recarga (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  paquete_id uuid not null references public.whatsapp_paquete(id),
  conversaciones integer not null check (conversaciones > 0),
  precio numeric(12,2) not null check (precio > 0),
  moneda text not null,
  pct_marketing numeric(5,2) not null check (pct_marketing between 0 and 100),
  meses_vencimiento integer not null check (meses_vencimiento between 1 and 36),
  estado public.whatsapp_compra_estado not null default 'PENDIENTE_PAGO',
  solicitado_por uuid not null references auth.users(id),
  pago_id uuid unique references public.pago(id),
  lote_id uuid unique references public.whatsapp_conversacion_lote(id),
  created_at timestamptz not null default now(),
  acreditada_at timestamptz,
  cancelada_at timestamptz,
  constraint whatsapp_compra_acreditada_coherente
    check ((estado = 'ACREDITADA') = (pago_id is not null and lote_id is not null and acreditada_at is not null))
);
create index if not exists whatsapp_compra_negocio_idx on public.whatsapp_compra_recarga (negocio_id, created_at desc);

-- Lotes existentes (004): se agregan periodo (lote del plan), compra de origen y el tope de marketing del lote.
alter table public.whatsapp_conversacion_lote
  add column if not exists periodo date,
  add column if not exists compra_id uuid references public.whatsapp_compra_recarga(id),
  add column if not exists cupo_marketing integer not null default 0,
  add column if not exists marketing_consumido integer not null default 0;
alter table public.whatsapp_conversacion_lote drop constraint if exists whatsapp_lote_marketing_chk;
alter table public.whatsapp_conversacion_lote add constraint whatsapp_lote_marketing_chk
  check (cupo_marketing >= 0 and marketing_consumido >= 0 and marketing_consumido <= cupo_marketing and cupo_marketing <= cantidad);
alter table public.whatsapp_conversacion_lote drop constraint if exists whatsapp_lote_disponible_chk;
alter table public.whatsapp_conversacion_lote add constraint whatsapp_lote_disponible_chk
  check (cantidad_disponible <= cantidad) not valid;
alter table public.whatsapp_conversacion_lote drop constraint if exists whatsapp_lote_periodo_chk;
alter table public.whatsapp_conversacion_lote add constraint whatsapp_lote_periodo_chk
  check (periodo is null or (origen = 'PLAN' and periodo = date_trunc('month', periodo)::date)) not valid;
create unique index if not exists whatsapp_lote_plan_periodo_uq on public.whatsapp_conversacion_lote (negocio_id, periodo) where origen = 'PLAN';
create unique index if not exists whatsapp_lote_compra_uq on public.whatsapp_conversacion_lote (compra_id) where compra_id is not null;

-- Plantillas: por negocio (negocio_id) o globales de StylerNow (negocio_id null, solo SuperSU).
-- APROBADA / RECHAZADA solo las fija el proveedor (funcion de service_role).
create table if not exists public.whatsapp_plantilla (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocio(id),
  nombre text not null check (nombre ~ '^[a-z0-9_]{3,60}$'),
  idioma text not null default 'es' check (idioma in ('es','en')),
  categoria public.whatsapp_categoria not null,
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 1024),
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array' and jsonb_array_length(variables) <= 10),
  estado public.whatsapp_plantilla_estado not null default 'BORRADOR',
  motivo_rechazo text check (motivo_rechazo is null or length(motivo_rechazo) <= 500),
  proveedor_plantilla_id text check (proveedor_plantilla_id is null or length(proveedor_plantilla_id) <= 200),
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists whatsapp_plantilla_nombre_uq
  on public.whatsapp_plantilla (coalesce(negocio_id, '00000000-0000-0000-0000-000000000000'::uuid), nombre, idioma);
drop trigger if exists trg_updated_at on public.whatsapp_plantilla;
create trigger trg_updated_at before update on public.whatsapp_plantilla for each row execute function public.set_updated_at();

create table if not exists public.whatsapp_campana (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  plantilla_id uuid not null references public.whatsapp_plantilla(id),
  nombre text not null check (length(btrim(nombre)) between 2 and 80),
  categoria public.whatsapp_categoria not null,
  segmento jsonb not null default '{}'::jsonb check (jsonb_typeof(segmento) = 'object'),
  programada_at timestamptz,
  estado public.whatsapp_campana_estado not null default 'BORRADOR',
  destinatarios_estimados integer not null default 0 check (destinatarios_estimados >= 0),
  motivo_estado text check (motivo_estado is null or length(motivo_estado) <= 200),
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelada_at timestamptz
);
create index if not exists whatsapp_campana_negocio_idx on public.whatsapp_campana (negocio_id, created_at desc);
create index if not exists whatsapp_campana_programada_idx on public.whatsapp_campana (programada_at) where estado = 'PROGRAMADA';
drop trigger if exists trg_updated_at on public.whatsapp_campana;
create trigger trg_updated_at before update on public.whatsapp_campana for each row execute function public.set_updated_at();

-- Un mensaje por destinatario. ENVIADO o posterior exige el id que devolvio el proveedor.
create table if not exists public.whatsapp_mensaje (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  campana_id uuid references public.whatsapp_campana(id),
  plantilla_id uuid not null references public.whatsapp_plantilla(id),
  cliente_id uuid not null references public.perfil(id),
  telefono text not null check (telefono ~ '^[0-9]{7,15}$'),
  categoria public.whatsapp_categoria not null,
  variables jsonb not null default '{}'::jsonb check (jsonb_typeof(variables) = 'object'),
  referencia_tipo text check (referencia_tipo is null or referencia_tipo ~ '^[A-Z_]{3,40}$'),
  referencia_id uuid,
  estado public.whatsapp_mensaje_estado not null default 'PREPARADO',
  proveedor_mensaje_id text unique check (proveedor_mensaje_id is null or length(proveedor_mensaje_id) between 1 and 200),
  error_codigo text check (error_codigo is null or length(error_codigo) <= 80),
  error_detalle text check (error_detalle is null or length(error_detalle) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  enviado_at timestamptz,
  entregado_at timestamptz,
  leido_at timestamptz,
  fallido_at timestamptz,
  constraint whatsapp_mensaje_evidencia_proveedor
    check (estado in ('PREPARADO','BLOQUEADO_SIN_CONEXION','FALLIDO') or proveedor_mensaje_id is not null)
);
create unique index if not exists whatsapp_mensaje_campana_cliente_uq on public.whatsapp_mensaje (campana_id, cliente_id) where campana_id is not null;
create unique index if not exists whatsapp_mensaje_referencia_uq on public.whatsapp_mensaje (plantilla_id, referencia_tipo, referencia_id) where referencia_id is not null;
create index if not exists whatsapp_mensaje_negocio_idx on public.whatsapp_mensaje (negocio_id, created_at desc);
drop trigger if exists trg_updated_at on public.whatsapp_mensaje;
create trigger trg_updated_at before update on public.whatsapp_mensaje for each row execute function public.set_updated_at();

-- Evidencia cruda del proveedor por cambio de estado (append-only).
create table if not exists public.whatsapp_mensaje_evento (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references public.whatsapp_mensaje(id),
  estado public.whatsapp_mensaje_estado not null,
  proveedor_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_mensaje_evento_idx on public.whatsapp_mensaje_evento (mensaje_id, created_at);

-- Libro de consumo (append-only). Un CONSUMO y a lo sumo un REVERSO por mensaje: idempotente por construccion.
create table if not exists public.whatsapp_consumo (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  lote_id uuid not null references public.whatsapp_conversacion_lote(id),
  mensaje_id uuid not null references public.whatsapp_mensaje(id),
  tipo text not null check (tipo in ('CONSUMO','REVERSO')),
  categoria public.whatsapp_categoria not null,
  cantidad integer not null default 1 check (cantidad = 1),
  created_at timestamptz not null default now(),
  unique (mensaje_id, tipo)
);
create index if not exists whatsapp_consumo_negocio_idx on public.whatsapp_consumo (negocio_id, created_at desc);

-- Alertas de consumo de la cuota del plan (una por umbral y periodo).
create table if not exists public.whatsapp_alerta (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  periodo date not null,
  umbral integer not null check (umbral between 1 and 100),
  pct_al_disparar numeric(6,2) not null,
  created_at timestamptz not null default now(),
  unique (negocio_id, periodo, umbral)
);

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3) Inmutabilidad y maquinas de estado (aplican a TODA escritura, incluso de service_role)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Sin security definer a proposito: current_user debe ser el rol que ejecuta la sentencia.
create or replace function public.whatsapp_solo_insercion()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'WHATSAPP_REGISTRO_INMUTABLE';
end $$;
revoke all on function public.whatsapp_solo_insercion() from public, anon, authenticated;

drop trigger if exists whatsapp_consumo_inmutable on public.whatsapp_consumo;
create trigger whatsapp_consumo_inmutable before update or delete on public.whatsapp_consumo
  for each row execute function public.whatsapp_solo_insercion();
drop trigger if exists whatsapp_mensaje_evento_inmutable on public.whatsapp_mensaje_evento;
create trigger whatsapp_mensaje_evento_inmutable before update or delete on public.whatsapp_mensaje_evento
  for each row execute function public.whatsapp_solo_insercion();

-- Mapa unico de transiciones. Se replica en src/lib/whatsapp/reglas.ts (TRANSICIONES) y lo cubren las pruebas.
create or replace function public._whatsapp_transicion_valida(p_maquina text, p_desde text, p_hacia text)
returns boolean language sql immutable set search_path = public as $$
  select exists (select 1 from (values
    ('PLANTILLA','BORRADOR','PENDIENTE_APROBACION'),
    ('PLANTILLA','PENDIENTE_APROBACION','APROBADA'),
    ('PLANTILLA','PENDIENTE_APROBACION','RECHAZADA'),
    ('PLANTILLA','APROBADA','RECHAZADA'),
    ('PLANTILLA','RECHAZADA','BORRADOR'),
    ('CAMPANA','BORRADOR','PROGRAMADA'),
    ('CAMPANA','BORRADOR','BLOQUEADA_SIN_CONEXION'),
    ('CAMPANA','BORRADOR','CANCELADA'),
    ('CAMPANA','PROGRAMADA','EN_ENVIO'),
    ('CAMPANA','PROGRAMADA','BLOQUEADA_SIN_CONEXION'),
    ('CAMPANA','PROGRAMADA','CANCELADA'),
    ('CAMPANA','BLOQUEADA_SIN_CONEXION','PROGRAMADA'),
    ('CAMPANA','BLOQUEADA_SIN_CONEXION','CANCELADA'),
    ('CAMPANA','EN_ENVIO','COMPLETADA'),
    ('CAMPANA','EN_ENVIO','BLOQUEADA_SIN_CONEXION'),
    ('MENSAJE','PREPARADO','ENVIADO'),
    ('MENSAJE','PREPARADO','FALLIDO'),
    ('MENSAJE','PREPARADO','BLOQUEADO_SIN_CONEXION'),
    ('MENSAJE','BLOQUEADO_SIN_CONEXION','PREPARADO'),
    ('MENSAJE','BLOQUEADO_SIN_CONEXION','FALLIDO'),
    ('MENSAJE','ENVIADO','ENTREGADO'),
    ('MENSAJE','ENVIADO','LEIDO'),
    ('MENSAJE','ENVIADO','FALLIDO'),
    ('MENSAJE','ENTREGADO','LEIDO'),
    ('COMPRA','PENDIENTE_PAGO','ACREDITADA'),
    ('COMPRA','PENDIENTE_PAGO','CANCELADA'),
    ('CONEXION','NO_CONFIGURADO','PENDIENTE_CREDENCIALES'),
    ('CONEXION','PENDIENTE_CREDENCIALES','NO_CONFIGURADO'),
    ('CONEXION','PENDIENTE_CREDENCIALES','SANDBOX'),
    ('CONEXION','PENDIENTE_CREDENCIALES','PRODUCCION'),
    ('CONEXION','PENDIENTE_CREDENCIALES','ERROR'),
    ('CONEXION','SANDBOX','PRODUCCION'),
    ('CONEXION','SANDBOX','ERROR'),
    ('CONEXION','SANDBOX','SUSPENDIDO'),
    ('CONEXION','SANDBOX','REVOCADO'),
    ('CONEXION','PRODUCCION','ERROR'),
    ('CONEXION','PRODUCCION','SUSPENDIDO'),
    ('CONEXION','PRODUCCION','REVOCADO'),
    ('CONEXION','SUSPENDIDO','PRODUCCION'),
    ('CONEXION','SUSPENDIDO','REVOCADO'),
    ('CONEXION','ERROR','PENDIENTE_CREDENCIALES'),
    ('CONEXION','ERROR','NO_CONFIGURADO'),
    ('CONEXION','ERROR','PRODUCCION'),
    ('CONEXION','REVOCADO','PENDIENTE_CREDENCIALES'),
    ('CONEXION','REVOCADO','NO_CONFIGURADO')
  ) t(maquina, desde, hacia) where t.maquina = p_maquina and t.desde = p_desde and t.hacia = p_hacia);
$$;
revoke all on function public._whatsapp_transicion_valida(text, text, text) from public, anon, authenticated;

-- Definer: el trigger corre como dueno y puede llamar la funcion interna aunque la sentencia la haga service_role.
create or replace function public.whatsapp_validar_transicion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_maquina text;
begin
  v_maquina := case tg_table_name
    when 'whatsapp_plantilla' then 'PLANTILLA'
    when 'whatsapp_campana' then 'CAMPANA'
    when 'whatsapp_mensaje' then 'MENSAJE'
    when 'whatsapp_compra_recarga' then 'COMPRA'
    when 'whatsapp_config' then 'CONEXION' end;
  if tg_table_name = 'whatsapp_config' then
    if new.estado_conexion is distinct from old.estado_conexion
       and not public._whatsapp_transicion_valida(v_maquina, old.estado_conexion::text, new.estado_conexion::text) then
      raise exception 'TRANSICION_INVALIDA: % -> %', old.estado_conexion, new.estado_conexion;
    end if;
    return new;
  end if;
  if new.estado is distinct from old.estado
     and not public._whatsapp_transicion_valida(v_maquina, old.estado::text, new.estado::text) then
    raise exception 'TRANSICION_INVALIDA: % -> %', old.estado, new.estado;
  end if;
  if tg_table_name = 'whatsapp_plantilla' then
    -- El contenido solo cambia en BORRADOR (o al volver de RECHAZADA a BORRADOR en la misma edicion).
    if (new.cuerpo, new.variables, new.categoria, new.nombre, new.idioma, new.negocio_id)
       is distinct from (old.cuerpo, old.variables, old.categoria, old.nombre, old.idioma, old.negocio_id)
       and not (old.estado in ('BORRADOR','RECHAZADA') and new.estado = 'BORRADOR') then
      raise exception 'PLANTILLA_NO_EDITABLE';
    end if;
  end if;
  if tg_table_name = 'whatsapp_mensaje' then
    if old.proveedor_mensaje_id is not null and new.proveedor_mensaje_id is distinct from old.proveedor_mensaje_id then
      raise exception 'PROVEEDOR_ID_INMUTABLE';
    end if;
    if (new.negocio_id, new.cliente_id, new.telefono, new.categoria, new.plantilla_id)
       is distinct from (old.negocio_id, old.cliente_id, old.telefono, old.categoria, old.plantilla_id) then
      raise exception 'MENSAJE_INMUTABLE';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.whatsapp_validar_transicion() from public, anon, authenticated;

drop trigger if exists whatsapp_plantilla_transicion on public.whatsapp_plantilla;
create trigger whatsapp_plantilla_transicion before update on public.whatsapp_plantilla
  for each row execute function public.whatsapp_validar_transicion();
drop trigger if exists whatsapp_campana_transicion on public.whatsapp_campana;
create trigger whatsapp_campana_transicion before update on public.whatsapp_campana
  for each row execute function public.whatsapp_validar_transicion();
drop trigger if exists whatsapp_mensaje_transicion on public.whatsapp_mensaje;
create trigger whatsapp_mensaje_transicion before update on public.whatsapp_mensaje
  for each row execute function public.whatsapp_validar_transicion();
drop trigger if exists whatsapp_compra_transicion on public.whatsapp_compra_recarga;
create trigger whatsapp_compra_transicion before update on public.whatsapp_compra_recarga
  for each row execute function public.whatsapp_validar_transicion();
drop trigger if exists whatsapp_config_transicion on public.whatsapp_config;
create trigger whatsapp_config_transicion before update on public.whatsapp_config
  for each row execute function public.whatsapp_validar_transicion();

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4) RLS: lectura propia (dueno) y total (SuperSU). Ninguna escritura directa por API: todo pasa por las RPC.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_paquete enable row level security;
alter table public.whatsapp_compra_recarga enable row level security;
alter table public.whatsapp_plantilla enable row level security;
alter table public.whatsapp_campana enable row level security;
alter table public.whatsapp_mensaje enable row level security;
alter table public.whatsapp_mensaje_evento enable row level security;
alter table public.whatsapp_consumo enable row level security;
alter table public.whatsapp_alerta enable row level security;

revoke all on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta from public, anon, authenticated;
grant select on public.whatsapp_config, public.whatsapp_paquete, public.whatsapp_compra_recarga, public.whatsapp_plantilla,
  public.whatsapp_campana, public.whatsapp_mensaje, public.whatsapp_mensaje_evento, public.whatsapp_consumo,
  public.whatsapp_alerta to authenticated;
-- El lote ya tenia solo politica de lectura (006); se cierra tambien a nivel de privilegios.
revoke insert, update, delete on public.whatsapp_conversacion_lote from public, anon, authenticated;

drop policy if exists whatsapp_config_select on public.whatsapp_config;
create policy whatsapp_config_select on public.whatsapp_config for select to authenticated using (true);
drop policy if exists whatsapp_paquete_select on public.whatsapp_paquete;
create policy whatsapp_paquete_select on public.whatsapp_paquete for select to authenticated using (activo or public.is_supersu());
drop policy if exists whatsapp_compra_select on public.whatsapp_compra_recarga;
create policy whatsapp_compra_select on public.whatsapp_compra_recarga for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists whatsapp_plantilla_select on public.whatsapp_plantilla;
create policy whatsapp_plantilla_select on public.whatsapp_plantilla for select to authenticated
  using ((negocio_id is null and estado = 'APROBADA') or public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists whatsapp_campana_select on public.whatsapp_campana;
create policy whatsapp_campana_select on public.whatsapp_campana for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists whatsapp_mensaje_select on public.whatsapp_mensaje;
create policy whatsapp_mensaje_select on public.whatsapp_mensaje for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists whatsapp_mensaje_evento_select on public.whatsapp_mensaje_evento;
create policy whatsapp_mensaje_evento_select on public.whatsapp_mensaje_evento for select to authenticated
  using (public.is_supersu());
drop policy if exists whatsapp_consumo_select on public.whatsapp_consumo;
create policy whatsapp_consumo_select on public.whatsapp_consumo for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_supersu());
drop policy if exists whatsapp_alerta_select on public.whatsapp_alerta;
create policy whatsapp_alerta_select on public.whatsapp_alerta for select to authenticated
  using (public.is_barberia_de(negocio_id) or public.is_supersu());

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5) Funciones internas (sin permisos para ningun rol de API; solo las llaman otras funciones definer)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
create or replace function public._whatsapp_periodo_actual()
returns date language sql stable security definer set search_path = public as $$
  select date_trunc('month', now() at time zone 'America/Bogota')::date;
$$;

create or replace function public._whatsapp_plan_codigo(p_negocio_id uuid)
returns public.plan_codigo language sql stable security definer set search_path = public as $$
  select coalesce((select s.plan_codigo from public.suscripcion s where s.negocio_id = p_negocio_id),
                  (select n.plan_codigo from public.negocio n where n.id = p_negocio_id));
$$;

-- Igual que negocio_tiene_funcion (086) pero sin depender de auth.uid(): para procesos de service_role.
create or replace function public._whatsapp_plan_incluye(p_negocio_id uuid, p_clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select pc.habilitado from public.plan_caracteristica pc
                    where pc.clave = p_clave and pc.plan_codigo = public._whatsapp_plan_codigo(p_negocio_id)), false);
$$;

create or replace function public._whatsapp_envio_habilitado()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select c.estado_conexion = 'PRODUCCION' from public.whatsapp_config c where c.id), false);
$$;

create or replace function public._whatsapp_validar_plantilla(p_cuerpo text, p_variables jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare v_n int; v_marcadores int[]; v_esperados int[];
begin
  if p_cuerpo is null or length(btrim(p_cuerpo)) = 0 or length(p_cuerpo) > 1024 then raise exception 'CUERPO_INVALIDO'; end if;
  if p_variables is null or jsonb_typeof(p_variables) <> 'array' then raise exception 'VARIABLES_INVALIDAS'; end if;
  v_n := jsonb_array_length(p_variables);
  if v_n > 10 then raise exception 'VARIABLES_INVALIDAS'; end if;
  if exists (select 1 from jsonb_array_elements(p_variables) e
              where jsonb_typeof(e) <> 'string'
                 or (e #>> '{}') not in ('nombre_cliente','nombre_negocio','fecha_cita','hora_cita','servicio','sede')) then
    raise exception 'VARIABLE_DESCONOCIDA';
  end if;
  if (select count(distinct e) from jsonb_array_elements(p_variables) e) <> v_n then raise exception 'VARIABLE_DUPLICADA'; end if;
  select coalesce(array_agg(distinct (m[1])::int order by (m[1])::int), '{}'::int[]) into v_marcadores
    from regexp_matches(p_cuerpo, '\{\{\s*([0-9]{1,2})\s*\}\}', 'g') m;
  select coalesce(array_agg(g order by g), '{}'::int[]) into v_esperados from generate_series(1, v_n) g;
  if v_marcadores <> v_esperados then raise exception 'MARCADORES_NO_COINCIDEN'; end if;
end $$;

create or replace function public._whatsapp_validar_segmento(p jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'SEGMENTO_INVALIDO'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('dias_sin_visita_min','visitas_min','etiqueta') then raise exception 'SEGMENTO_INVALIDO'; end if;
  end loop;
  if jsonb_typeof(p->'dias_sin_visita_min') = 'number' then
    if (p->>'dias_sin_visita_min')::numeric <> trunc((p->>'dias_sin_visita_min')::numeric)
       or (p->>'dias_sin_visita_min')::numeric not between 1 and 3650 then raise exception 'SEGMENTO_INVALIDO'; end if;
  elsif p ? 'dias_sin_visita_min' and jsonb_typeof(p->'dias_sin_visita_min') <> 'null' then raise exception 'SEGMENTO_INVALIDO';
  end if;
  if jsonb_typeof(p->'visitas_min') = 'number' then
    if (p->>'visitas_min')::numeric <> trunc((p->>'visitas_min')::numeric)
       or (p->>'visitas_min')::numeric not between 1 and 1000 then raise exception 'SEGMENTO_INVALIDO'; end if;
  elsif p ? 'visitas_min' and jsonb_typeof(p->'visitas_min') <> 'null' then raise exception 'SEGMENTO_INVALIDO';
  end if;
  if jsonb_typeof(p->'etiqueta') = 'string' then
    if length(btrim(p->>'etiqueta')) not between 1 and 50 then raise exception 'SEGMENTO_INVALIDO'; end if;
  elsif p ? 'etiqueta' and jsonb_typeof(p->'etiqueta') <> 'null' then raise exception 'SEGMENTO_INVALIDO';
  end if;
end $$;

-- Destinatarios de un segmento, calculados SIEMPRE aqui: clientes con al menos una reserva COMPLETADA en ESE negocio,
-- con telefono valido y, si es MARKETING, con consentimiento vigente 'marketing_whatsapp'. Nunca listas del navegador.
create or replace function public._whatsapp_destinatarios(p_negocio_id uuid, p_segmento jsonb, p_categoria public.whatsapp_categoria)
returns table (dest_cliente_id uuid, dest_telefono text, dest_nombre text)
language plpgsql stable security definer set search_path = public as $$
declare v_dias int; v_visitas int; v_etiqueta text;
begin
  perform public._whatsapp_validar_segmento(p_segmento);
  v_dias := case when jsonb_typeof(p_segmento->'dias_sin_visita_min') = 'number' then (p_segmento->>'dias_sin_visita_min')::int end;
  v_visitas := case when jsonb_typeof(p_segmento->'visitas_min') = 'number' then (p_segmento->>'visitas_min')::int end;
  v_etiqueta := case when jsonb_typeof(p_segmento->'etiqueta') = 'string' then btrim(p_segmento->>'etiqueta') end;
  return query
  with clientes as (
    select r.cliente_id as cid, max(r.hora_inicio) as ultima, count(*) as visitas
      from public.reserva r
     where r.negocio_id = p_negocio_id and r.estado = 'COMPLETADA'
     group by r.cliente_id
  )
  select c.cid, regexp_replace(p.telefono, '[^0-9]', '', 'g'), p.nombre
    from clientes c join public.perfil p on p.id = c.cid
   where p.telefono is not null
     and length(regexp_replace(p.telefono, '[^0-9]', '', 'g')) between 7 and 15
     and (v_dias is null or c.ultima < now() - make_interval(days => v_dias))
     and (v_visitas is null or c.visitas >= v_visitas)
     and (v_etiqueta is null or exists (select 1 from public.cliente_etiqueta e
                                         where e.negocio_id = p_negocio_id and e.cliente_id = c.cid and e.etiqueta = v_etiqueta))
     and (p_categoria <> 'MARKETING' or public._consentimiento_vigente(c.cid, 'marketing_whatsapp'));
end $$;

-- Lote del plan del mes: idempotente por negocio + periodo. Solo si la suscripcion permite operar.
create or replace function public._whatsapp_otorgar_lote_plan(p_negocio_id uuid, p_periodo date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_periodo date := coalesce(p_periodo, public._whatsapp_periodo_actual());
  v_cuota int; v_pct numeric; v_id uuid;
begin
  if v_periodo <> date_trunc('month', v_periodo)::date then raise exception 'PERIODO_INVALIDO'; end if;
  select l.id into v_id from public.whatsapp_conversacion_lote l
   where l.negocio_id = p_negocio_id and l.origen = 'PLAN' and l.periodo = v_periodo;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.negocio n where n.id = p_negocio_id) then return null; end if;
  if not public.negocio_puede_recibir_reservas(p_negocio_id) then return null; end if;
  select p.conversaciones_whatsapp_mes into v_cuota from public.plan p where p.codigo = public._whatsapp_plan_codigo(p_negocio_id);
  if coalesce(v_cuota, 0) <= 0 then return null; end if;
  select c.pct_marketing_plan into v_pct from public.whatsapp_config c where c.id;
  insert into public.whatsapp_conversacion_lote
    (negocio_id, origen, cantidad, cantidad_disponible, fecha_otorgamiento, fecha_expiracion, periodo, cupo_marketing)
  values (p_negocio_id, 'PLAN', v_cuota, v_cuota,
          v_periodo::timestamp at time zone 'America/Bogota',
          (v_periodo + interval '1 month') at time zone 'America/Bogota',
          v_periodo, floor(v_cuota * coalesce(v_pct, 0) / 100)::int)
  on conflict (negocio_id, periodo) where origen = 'PLAN' do nothing
  returning id into v_id;
  if v_id is null then
    select l.id into v_id from public.whatsapp_conversacion_lote l
     where l.negocio_id = p_negocio_id and l.origen = 'PLAN' and l.periodo = v_periodo;
  end if;
  return v_id;
end $$;

-- Saldo vigente: lote del plan del mes + recargas no vencidas. Marketing disponible = suma del tope restante por lote.
create or replace function public._whatsapp_saldo(p_negocio_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with vigentes as (
    select l.* from public.whatsapp_conversacion_lote l
     where l.negocio_id = p_negocio_id and l.fecha_otorgamiento <= now() and l.fecha_expiracion > now()
  ), lote_plan as (
    select v.* from vigentes v where v.origen = 'PLAN' order by v.fecha_expiracion limit 1
  )
  select jsonb_build_object(
    'disponible_total', coalesce((select sum(v.cantidad_disponible) from vigentes v), 0),
    'marketing_disponible', coalesce((select sum(least(v.cupo_marketing - v.marketing_consumido, v.cantidad_disponible)) from vigentes v), 0),
    'recarga_disponible', coalesce((select sum(v.cantidad_disponible) from vigentes v where v.origen = 'PAQUETE'), 0),
    'plan', (select jsonb_build_object('lote_id', lp.id, 'periodo', lp.periodo, 'cuota', lp.cantidad, 'disponible', lp.cantidad_disponible,
                                       'cupo_marketing', lp.cupo_marketing, 'marketing_consumido', lp.marketing_consumido,
                                       'vence', lp.fecha_expiracion) from lote_plan lp),
    'recargas', coalesce((select jsonb_agg(jsonb_build_object('lote_id', v.id, 'cantidad', v.cantidad, 'disponible', v.cantidad_disponible,
                                       'cupo_marketing', v.cupo_marketing, 'marketing_consumido', v.marketing_consumido,
                                       'vence', v.fecha_expiracion) order by v.fecha_expiracion)
                            from vigentes v where v.origen = 'PAQUETE'), '[]'::jsonb)
  );
$$;

create or replace function public._whatsapp_evaluar_alertas(p_negocio_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_lote public.whatsapp_conversacion_lote; v_pct numeric; v_umbrales int[];
begin
  select * into v_lote from public.whatsapp_conversacion_lote l
   where l.negocio_id = p_negocio_id and l.origen = 'PLAN' and l.periodo = public._whatsapp_periodo_actual();
  if not found or v_lote.cantidad <= 0 then return; end if;
  v_pct := (v_lote.cantidad - v_lote.cantidad_disponible) * 100.0 / v_lote.cantidad;
  select c.umbrales_alerta into v_umbrales from public.whatsapp_config c where c.id;
  insert into public.whatsapp_alerta (negocio_id, periodo, umbral, pct_al_disparar)
  select p_negocio_id, v_lote.periodo, u, round(v_pct, 2) from unnest(v_umbrales) u where u <= v_pct
  on conflict (negocio_id, periodo, umbral) do nothing;
end $$;

-- Consume 1 conversacion para un mensaje. Idempotente: si el mensaje ya consumio, devuelve el mismo lote.
create or replace function public._whatsapp_consumir(p_mensaje_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare m public.whatsapp_mensaje; v_lote_id uuid;
begin
  select * into m from public.whatsapp_mensaje where id = p_mensaje_id;
  if not found then raise exception 'MENSAJE_NO_ENCONTRADO'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp_saldo:' || m.negocio_id::text, 0));
  select c.lote_id into v_lote_id from public.whatsapp_consumo c where c.mensaje_id = p_mensaje_id and c.tipo = 'CONSUMO';
  if v_lote_id is not null then
    if exists (select 1 from public.whatsapp_consumo c where c.mensaje_id = p_mensaje_id and c.tipo = 'REVERSO') then
      raise exception 'CONSUMO_YA_REVERTIDO';
    end if;
    return v_lote_id;
  end if;
  perform public._whatsapp_otorgar_lote_plan(m.negocio_id);
  select l.id into v_lote_id from public.whatsapp_conversacion_lote l
   where l.negocio_id = m.negocio_id and l.cantidad_disponible > 0
     and l.fecha_otorgamiento <= now() and l.fecha_expiracion > now()
     and (m.categoria = 'UTILIDAD' or l.marketing_consumido < l.cupo_marketing)
   order by (l.origen <> 'PLAN'), l.fecha_expiracion, l.fecha_otorgamiento
   limit 1 for update;
  if v_lote_id is null then
    if m.categoria = 'MARKETING' then raise exception 'CUPO_MARKETING_AGOTADO'; end if;
    raise exception 'SALDO_INSUFICIENTE';
  end if;
  update public.whatsapp_conversacion_lote
     set cantidad_disponible = cantidad_disponible - 1,
         marketing_consumido = marketing_consumido + case when m.categoria = 'MARKETING' then 1 else 0 end
   where id = v_lote_id;
  insert into public.whatsapp_consumo (negocio_id, lote_id, mensaje_id, tipo, categoria)
  values (m.negocio_id, v_lote_id, p_mensaje_id, 'CONSUMO', m.categoria);
  perform public._whatsapp_evaluar_alertas(m.negocio_id);
  return v_lote_id;
end $$;

-- Devuelve la conversacion al lote (mensaje que nunca salio o que el proveedor reporto fallido). Idempotente.
create or replace function public._whatsapp_revertir_consumo(p_mensaje_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.whatsapp_consumo;
begin
  select * into c from public.whatsapp_consumo where mensaje_id = p_mensaje_id and tipo = 'CONSUMO';
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp_saldo:' || c.negocio_id::text, 0));
  if exists (select 1 from public.whatsapp_consumo x where x.mensaje_id = p_mensaje_id and x.tipo = 'REVERSO') then return false; end if;
  update public.whatsapp_conversacion_lote
     set cantidad_disponible = cantidad_disponible + 1,
         marketing_consumido = marketing_consumido - case when c.categoria = 'MARKETING' then 1 else 0 end
   where id = c.lote_id;
  insert into public.whatsapp_consumo (negocio_id, lote_id, mensaje_id, tipo, categoria)
  values (c.negocio_id, c.lote_id, p_mensaje_id, 'REVERSO', c.categoria);
  return true;
end $$;

create or replace function public._whatsapp_consumo_periodo(p_negocio_id uuid, p_periodo date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'utilidad', coalesce(sum(case when c.tipo = 'CONSUMO' then 1 else -1 end) filter (where c.categoria = 'UTILIDAD'), 0),
    'marketing', coalesce(sum(case when c.tipo = 'CONSUMO' then 1 else -1 end) filter (where c.categoria = 'MARKETING'), 0))
  from public.whatsapp_consumo c
  where c.negocio_id = p_negocio_id
    and c.created_at >= p_periodo::timestamp at time zone 'America/Bogota'
    and c.created_at < (p_periodo + interval '1 month') at time zone 'America/Bogota';
$$;

revoke all on function public._whatsapp_periodo_actual() from public, anon, authenticated;
revoke all on function public._whatsapp_plan_codigo(uuid) from public, anon, authenticated;
revoke all on function public._whatsapp_plan_incluye(uuid, text) from public, anon, authenticated;
revoke all on function public._whatsapp_envio_habilitado() from public, anon, authenticated;
revoke all on function public._whatsapp_validar_plantilla(text, jsonb) from public, anon, authenticated;
revoke all on function public._whatsapp_validar_segmento(jsonb) from public, anon, authenticated;
revoke all on function public._whatsapp_destinatarios(uuid, jsonb, public.whatsapp_categoria) from public, anon, authenticated;
revoke all on function public._whatsapp_otorgar_lote_plan(uuid, date) from public, anon, authenticated;
revoke all on function public._whatsapp_saldo(uuid) from public, anon, authenticated;
revoke all on function public._whatsapp_evaluar_alertas(uuid) from public, anon, authenticated;
revoke all on function public._whatsapp_consumir(uuid) from public, anon, authenticated;
revoke all on function public._whatsapp_revertir_consumo(uuid) from public, anon, authenticated;
revoke all on function public._whatsapp_consumo_periodo(uuid, date) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6) RPC del dueno del negocio (authenticated; el negocio se valida con auth.uid() dentro)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- Resumen del panel. Otorga de forma perezosa el lote del plan del mes (idempotente) para no depender solo del cron.
create or replace function public.whatsapp_panel_resumen(p_negocio_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cfg public.whatsapp_config; v_periodo date := public._whatsapp_periodo_actual();
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (public.is_barberia_de(p_negocio_id) or public.is_supersu()) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._whatsapp_otorgar_lote_plan(p_negocio_id);
  select * into v_cfg from public.whatsapp_config where id;
  return jsonb_build_object(
    'conexion', jsonb_build_object('estado', v_cfg.estado_conexion, 'envio_habilitado', public._whatsapp_envio_habilitado()),
    'reglas', jsonb_build_object('pct_marketing_plan', v_cfg.pct_marketing_plan, 'pct_marketing_recarga', v_cfg.pct_marketing_recarga,
                                 'meses_vencimiento_recarga', v_cfg.meses_vencimiento_recarga, 'umbrales_alerta', to_jsonb(v_cfg.umbrales_alerta)),
    'funcion_marketing', public._whatsapp_plan_incluye(p_negocio_id, 'whatsapp_marketing'),
    'periodo', v_periodo,
    'saldo', public._whatsapp_saldo(p_negocio_id),
    'consumo_mes', public._whatsapp_consumo_periodo(p_negocio_id, v_periodo),
    'alertas', coalesce((select jsonb_agg(jsonb_build_object('umbral', a.umbral, 'pct', a.pct_al_disparar, 'fecha', a.created_at) order by a.umbral)
                           from public.whatsapp_alerta a where a.negocio_id = p_negocio_id and a.periodo = v_periodo), '[]'::jsonb),
    'paquetes', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'codigo', k.codigo, 'nombre', k.nombre, 'conversaciones', k.conversaciones,
                                                              'precio', k.precio, 'moneda', k.moneda) order by k.precio)
                            from public.whatsapp_paquete k where k.activo), '[]'::jsonb),
    'compras', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
                           select jsonb_build_object('id', c.id, 'conversaciones', c.conversaciones, 'precio', c.precio, 'moneda', c.moneda,
                                                     'estado', c.estado, 'fecha', c.created_at) as j, c.created_at
                             from public.whatsapp_compra_recarga c where c.negocio_id = p_negocio_id
                            order by c.created_at desc limit 20) x), '[]'::jsonb),
    'plantillas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'global', t.negocio_id is null, 'nombre', t.nombre, 'idioma', t.idioma,
                                                                'categoria', t.categoria, 'cuerpo', t.cuerpo, 'variables', t.variables,
                                                                'estado', t.estado, 'motivo_rechazo', t.motivo_rechazo) order by t.created_at desc)
                              from public.whatsapp_plantilla t
                             where t.negocio_id = p_negocio_id or (t.negocio_id is null and t.estado = 'APROBADA')), '[]'::jsonb),
    'campanas', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
                           select jsonb_build_object('id', k.id, 'nombre', k.nombre, 'plantilla_id', k.plantilla_id, 'categoria', k.categoria,
                                                     'segmento', k.segmento, 'programada_at', k.programada_at, 'estado', k.estado,
                                                     'destinatarios_estimados', k.destinatarios_estimados, 'motivo_estado', k.motivo_estado) as j, k.created_at
                             from public.whatsapp_campana k where k.negocio_id = p_negocio_id
                            order by k.created_at desc limit 50) x), '[]'::jsonb)
  );
end $$;

create or replace function public.whatsapp_plantilla_guardar(
  p_plantilla_id uuid, p_negocio_id uuid, p_nombre text, p_idioma text, p_categoria text, p_cuerpo text, p_variables jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.whatsapp_plantilla; v_cat public.whatsapp_categoria; v_id uuid; v_negocio uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_categoria is null or p_categoria not in ('UTILIDAD','MARKETING') then raise exception 'CATEGORIA_INVALIDA'; end if;
  v_cat := p_categoria::public.whatsapp_categoria;
  if p_nombre is null or p_nombre !~ '^[a-z0-9_]{3,60}$' then raise exception 'NOMBRE_PLANTILLA_INVALIDO'; end if;
  if coalesce(p_idioma, '') not in ('es','en') then raise exception 'IDIOMA_INVALIDO'; end if;
  perform public._whatsapp_validar_plantilla(p_cuerpo, p_variables);

  if p_plantilla_id is null then
    v_negocio := p_negocio_id;
  else
    select * into v from public.whatsapp_plantilla where id = p_plantilla_id for update;
    if not found then raise exception 'PLANTILLA_NO_ENCONTRADA'; end if;
    v_negocio := v.negocio_id;   -- el negocio sale de la fila, nunca del parametro
  end if;
  if v_negocio is null then
    if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  else
    if not public.is_barberia_de(v_negocio) then raise exception 'NO_AUTORIZADO'; end if;
    if v_cat = 'MARKETING' and not public.negocio_tiene_funcion(v_negocio, 'whatsapp_marketing') then
      raise exception 'FUNCION_NO_INCLUIDA';
    end if;
  end if;

  begin
    if p_plantilla_id is null then
      if v_negocio is not null and (select count(*) from public.whatsapp_plantilla t where t.negocio_id = v_negocio) >= 100 then
        raise exception 'PLANTILLAS_MAXIMAS';
      end if;
      insert into public.whatsapp_plantilla (negocio_id, nombre, idioma, categoria, cuerpo, variables, creado_por)
      values (v_negocio, p_nombre, p_idioma, v_cat, btrim(p_cuerpo), p_variables, auth.uid())
      returning id into v_id;
    else
      if v.estado not in ('BORRADOR','RECHAZADA') then raise exception 'PLANTILLA_NO_EDITABLE'; end if;
      update public.whatsapp_plantilla
         set nombre = p_nombre, idioma = p_idioma, categoria = v_cat, cuerpo = btrim(p_cuerpo), variables = p_variables,
             estado = 'BORRADOR', motivo_rechazo = null
       where id = p_plantilla_id;
      v_id := p_plantilla_id;
    end if;
  exception when unique_violation then
    raise exception 'PLANTILLA_DUPLICADA';
  end;
  return v_id;
end $$;

create or replace function public.whatsapp_plantilla_eliminar(p_plantilla_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.whatsapp_plantilla;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.whatsapp_plantilla where id = p_plantilla_id for update;
  if not found then raise exception 'PLANTILLA_NO_ENCONTRADA'; end if;
  if v.negocio_id is null then
    if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  elsif not public.is_barberia_de(v.negocio_id) then raise exception 'NO_AUTORIZADO';
  end if;
  if v.estado not in ('BORRADOR','RECHAZADA') then raise exception 'PLANTILLA_NO_EDITABLE'; end if;
  if exists (select 1 from public.whatsapp_campana c where c.plantilla_id = p_plantilla_id)
     or exists (select 1 from public.whatsapp_mensaje m where m.plantilla_id = p_plantilla_id) then
    raise exception 'PLANTILLA_EN_USO';
  end if;
  delete from public.whatsapp_plantilla where id = p_plantilla_id;
end $$;

-- Cuantos clientes cumplen el segmento (con telefono) y cuantos de ellos aceptaron marketing por WhatsApp.
create or replace function public.whatsapp_segmento_contar(p_negocio_id uuid, p_segmento jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  return jsonb_build_object(
    'con_telefono', (select count(*) from public._whatsapp_destinatarios(p_negocio_id, p_segmento, 'UTILIDAD')),
    'con_consentimiento', (select count(*) from public._whatsapp_destinatarios(p_negocio_id, p_segmento, 'MARKETING')));
end $$;

create or replace function public.whatsapp_campana_crear(
  p_negocio_id uuid, p_plantilla_id uuid, p_nombre text, p_segmento jsonb, p_programada_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.whatsapp_plantilla; v_id uuid; v_n int;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not public.negocio_tiene_funcion(p_negocio_id, 'whatsapp_marketing') then raise exception 'FUNCION_NO_INCLUIDA'; end if;
  select * into t from public.whatsapp_plantilla
   where id = p_plantilla_id and (negocio_id = p_negocio_id or (negocio_id is null and estado = 'APROBADA'));
  if not found then raise exception 'PLANTILLA_NO_ENCONTRADA'; end if;
  if t.categoria <> 'MARKETING' then raise exception 'CAMPANA_SOLO_MARKETING'; end if;
  if t.estado = 'RECHAZADA' then raise exception 'PLANTILLA_RECHAZADA'; end if;
  if exists (select 1 from jsonb_array_elements_text(t.variables) x where x not in ('nombre_cliente','nombre_negocio')) then
    raise exception 'VARIABLE_NO_DISPONIBLE_EN_CAMPANA';
  end if;
  if p_nombre is null or length(btrim(p_nombre)) not between 2 and 80 then raise exception 'NOMBRE_CAMPANA_INVALIDO'; end if;
  if p_programada_at is not null and (p_programada_at < now() + interval '5 minutes' or p_programada_at > now() + interval '90 days') then
    raise exception 'FECHA_INVALIDA';
  end if;
  if (select count(*) from public.whatsapp_campana c
       where c.negocio_id = p_negocio_id and c.estado in ('BORRADOR','PROGRAMADA','BLOQUEADA_SIN_CONEXION','EN_ENVIO')) >= 50 then
    raise exception 'CAMPANAS_MAXIMAS';
  end if;
  select count(*) into v_n from public._whatsapp_destinatarios(p_negocio_id, p_segmento, 'MARKETING');
  insert into public.whatsapp_campana (negocio_id, plantilla_id, nombre, categoria, segmento, programada_at, destinatarios_estimados, creado_por)
  values (p_negocio_id, p_plantilla_id, btrim(p_nombre), t.categoria, p_segmento, p_programada_at, v_n, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Programar: valida fecha, destinatarios y tope de marketing. Sin conexion queda BLOQUEADA_SIN_CONEXION (no se envia nada).
create or replace function public.whatsapp_campana_programar(p_campana_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare k public.whatsapp_campana; v_estado_plantilla public.whatsapp_plantilla_estado; v_n int; v_disp int;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into k from public.whatsapp_campana where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(k.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not public.negocio_tiene_funcion(k.negocio_id, 'whatsapp_marketing') then raise exception 'FUNCION_NO_INCLUIDA'; end if;
  if k.estado not in ('BORRADOR','BLOQUEADA_SIN_CONEXION') then raise exception 'TRANSICION_INVALIDA'; end if;
  if k.programada_at is null or k.programada_at < now() + interval '5 minutes' then raise exception 'FECHA_INVALIDA'; end if;
  select count(*) into v_n from public._whatsapp_destinatarios(k.negocio_id, k.segmento, k.categoria);
  if v_n = 0 then raise exception 'SIN_DESTINATARIOS'; end if;
  perform public._whatsapp_otorgar_lote_plan(k.negocio_id);
  v_disp := (public._whatsapp_saldo(k.negocio_id)->>'marketing_disponible')::int;
  if v_n > v_disp then raise exception 'CUPO_MARKETING_INSUFICIENTE'; end if;

  if not public._whatsapp_envio_habilitado() then
    update public.whatsapp_campana
       set estado = 'BLOQUEADA_SIN_CONEXION', motivo_estado = 'SIN_CONEXION', destinatarios_estimados = v_n
     where id = p_campana_id;
    return 'BLOQUEADA_SIN_CONEXION';
  end if;
  select t.estado into v_estado_plantilla from public.whatsapp_plantilla t where t.id = k.plantilla_id;
  if v_estado_plantilla <> 'APROBADA' then raise exception 'PLANTILLA_NO_APROBADA'; end if;
  update public.whatsapp_campana set estado = 'PROGRAMADA', motivo_estado = null, destinatarios_estimados = v_n where id = p_campana_id;
  return 'PROGRAMADA';
end $$;

create or replace function public.whatsapp_campana_cancelar(p_campana_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k public.whatsapp_campana; r record;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into k from public.whatsapp_campana where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(k.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if k.estado not in ('BORRADOR','PROGRAMADA','BLOQUEADA_SIN_CONEXION') then raise exception 'TRANSICION_INVALIDA'; end if;
  for r in select m.id from public.whatsapp_mensaje m
            where m.campana_id = p_campana_id and m.estado in ('PREPARADO','BLOQUEADO_SIN_CONEXION') for update loop
    perform public._whatsapp_revertir_consumo(r.id);
    update public.whatsapp_mensaje set estado = 'FALLIDO', error_codigo = 'CAMPANA_CANCELADA', fallido_at = now() where id = r.id;
  end loop;
  update public.whatsapp_campana set estado = 'CANCELADA', cancelada_at = now(), motivo_estado = 'CANCELADA_POR_NEGOCIO'
   where id = p_campana_id;
end $$;

-- Solicitud de recarga: queda PENDIENTE_PAGO con precio congelado. El cobro lo conecta la fase de pagos
-- (crea el pago tipo PAQUETE_CONVERSACIONES_WHATSAPP y, aprobado, llama whatsapp_acreditar_recarga).
create or replace function public.whatsapp_solicitar_recarga(p_negocio_id uuid, p_paquete_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare k public.whatsapp_paquete; v_cfg public.whatsapp_config; v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  select * into k from public.whatsapp_paquete where id = p_paquete_id and activo;
  if not found then raise exception 'PAQUETE_NO_DISPONIBLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp_recarga:' || p_negocio_id::text, 0));
  -- Doble clic / reintento: reutiliza la solicitud pendiente del mismo paquete de la ultima hora.
  select c.id into v_id from public.whatsapp_compra_recarga c
   where c.negocio_id = p_negocio_id and c.paquete_id = p_paquete_id and c.estado = 'PENDIENTE_PAGO'
     and c.created_at > now() - interval '1 hour'
   order by c.created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.whatsapp_compra_recarga c where c.negocio_id = p_negocio_id and c.estado = 'PENDIENTE_PAGO') >= 5 then
    raise exception 'DEMASIADAS_SOLICITUDES_PENDIENTES';
  end if;
  select * into v_cfg from public.whatsapp_config where id;
  insert into public.whatsapp_compra_recarga
    (negocio_id, paquete_id, conversaciones, precio, moneda, pct_marketing, meses_vencimiento, solicitado_por)
  values (p_negocio_id, k.id, k.conversaciones, k.precio, k.moneda, v_cfg.pct_marketing_recarga, v_cfg.meses_vencimiento_recarga, auth.uid())
  returning id into v_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('whatsapp_compra_recarga', v_id, 'WHATSAPP_RECARGA_SOLICITADA', 'BARBERIA', auth.uid(), p_negocio_id,
          jsonb_build_object('paquete', k.codigo, 'version', k.version, 'conversaciones', k.conversaciones, 'precio', k.precio, 'moneda', k.moneda));
  return v_id;
end $$;

create or replace function public.whatsapp_cancelar_recarga(p_compra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.whatsapp_compra_recarga;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into c from public.whatsapp_compra_recarga where id = p_compra_id for update;
  if not found then raise exception 'COMPRA_NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(c.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if c.estado <> 'PENDIENTE_PAGO' then raise exception 'TRANSICION_INVALIDA'; end if;
  update public.whatsapp_compra_recarga set estado = 'CANCELADA', cancelada_at = now() where id = p_compra_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes)
  values ('whatsapp_compra_recarga', p_compra_id, 'WHATSAPP_RECARGA_CANCELADA', 'BARBERIA', auth.uid(), c.negocio_id,
          jsonb_build_object('estado', c.estado, 'precio', c.precio, 'conversaciones', c.conversaciones));
end $$;

revoke all on function public.whatsapp_panel_resumen(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_panel_resumen(uuid) to authenticated;
revoke all on function public.whatsapp_plantilla_guardar(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_plantilla_guardar(uuid, uuid, text, text, text, text, jsonb) to authenticated;
revoke all on function public.whatsapp_plantilla_eliminar(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_plantilla_eliminar(uuid) to authenticated;
revoke all on function public.whatsapp_segmento_contar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_segmento_contar(uuid, jsonb) to authenticated;
revoke all on function public.whatsapp_campana_crear(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.whatsapp_campana_crear(uuid, uuid, text, jsonb, timestamptz) to authenticated;
revoke all on function public.whatsapp_campana_programar(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_campana_programar(uuid) to authenticated;
revoke all on function public.whatsapp_campana_cancelar(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_campana_cancelar(uuid) to authenticated;
revoke all on function public.whatsapp_solicitar_recarga(uuid, uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_solicitar_recarga(uuid, uuid) to authenticated;
revoke all on function public.whatsapp_cancelar_recarga(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_cancelar_recarga(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 7) RPC de SuperSU (authenticated + is_supersu() dentro). Toda modificacion audita antes/despues/motivo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
create or replace function public.whatsapp_admin_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cfg public.whatsapp_config;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  select * into v_cfg from public.whatsapp_config where id;
  return jsonb_build_object(
    'config', jsonb_build_object('pct_marketing_plan', v_cfg.pct_marketing_plan, 'pct_marketing_recarga', v_cfg.pct_marketing_recarga,
                                 'meses_vencimiento_recarga', v_cfg.meses_vencimiento_recarga, 'umbrales_alerta', to_jsonb(v_cfg.umbrales_alerta),
                                 'proveedor', v_cfg.proveedor, 'estado_conexion', v_cfg.estado_conexion,
                                 'estado_conexion_detalle', v_cfg.estado_conexion_detalle, 'estado_conexion_at', v_cfg.estado_conexion_at,
                                 'updated_at', v_cfg.updated_at),
    'paquetes', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'codigo', k.codigo, 'version', k.version, 'nombre', k.nombre,
                                                              'conversaciones', k.conversaciones, 'precio', k.precio, 'moneda', k.moneda,
                                                              'activo', k.activo, 'created_at', k.created_at) order by k.codigo, k.version desc)
                            from public.whatsapp_paquete k), '[]'::jsonb),
    'compras_pendientes', (select count(*) from public.whatsapp_compra_recarga c where c.estado = 'PENDIENTE_PAGO'),
    'compras_recientes', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
                            select jsonb_build_object('id', c.id, 'negocio', n.nombre, 'conversaciones', c.conversaciones, 'precio', c.precio,
                                                      'moneda', c.moneda, 'estado', c.estado, 'fecha', c.created_at) as j, c.created_at
                              from public.whatsapp_compra_recarga c join public.negocio n on n.id = c.negocio_id
                             order by c.created_at desc limit 30) x), '[]'::jsonb),
    'plantillas_globales', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'categoria', t.categoria,
                                                                         'estado', t.estado) order by t.created_at desc)
                                       from public.whatsapp_plantilla t where t.negocio_id is null), '[]'::jsonb)
  );
end $$;

create or replace function public.whatsapp_admin_actualizar_config(
  p_pct_marketing_plan numeric, p_pct_marketing_recarga numeric, p_meses_vencimiento_recarga integer,
  p_umbrales_alerta integer[], p_proveedor text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes public.whatsapp_config; v_despues public.whatsapp_config; v_umbrales int[];
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_pct_marketing_plan is null or p_pct_marketing_plan not between 0 and 100
     or p_pct_marketing_recarga is null or p_pct_marketing_recarga not between 0 and 100 then raise exception 'PORCENTAJE_INVALIDO'; end if;
  if p_meses_vencimiento_recarga is null or p_meses_vencimiento_recarga not between 1 and 36 then raise exception 'VENCIMIENTO_INVALIDO'; end if;
  select coalesce(array_agg(distinct u order by u), '{}'::int[]) into v_umbrales from unnest(p_umbrales_alerta) u;
  if cardinality(v_umbrales) not between 1 and 5 or exists (select 1 from unnest(v_umbrales) u where u is null or u not between 1 and 100) then
    raise exception 'UMBRALES_INVALIDOS';
  end if;
  if p_proveedor is not null and p_proveedor not in ('META_CLOUD_API','TWILIO','DIALOG_360','OTRO') then raise exception 'PROVEEDOR_INVALIDO'; end if;
  select * into v_antes from public.whatsapp_config where id for update;
  update public.whatsapp_config
     set pct_marketing_plan = p_pct_marketing_plan, pct_marketing_recarga = p_pct_marketing_recarga,
         meses_vencimiento_recarga = p_meses_vencimiento_recarga, umbrales_alerta = v_umbrales,
         proveedor = p_proveedor, updated_at = now(), updated_by = auth.uid()
   where id
  returning * into v_despues;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('whatsapp_config', null, 'WHATSAPP_CONFIG_ACTUALIZADA', 'SUPERSU', auth.uid(), left(btrim(p_motivo), 300),
          to_jsonb(v_antes) - 'updated_at' - 'updated_by', to_jsonb(v_despues) - 'updated_at' - 'updated_by');
end $$;

-- SuperSU solo puede fijar estados declarativos. SANDBOX / PRODUCCION / ERROR los fija el sistema tras verificar
-- credenciales con el proveedor real (whatsapp_sistema_estado_conexion).
create or replace function public.whatsapp_admin_estado_conexion(p_estado text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes public.whatsapp_config;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_estado is null or p_estado not in ('NO_CONFIGURADO','PENDIENTE_CREDENCIALES','SUSPENDIDO','REVOCADO') then
    raise exception 'ESTADO_SOLO_SISTEMA';
  end if;
  select * into v_antes from public.whatsapp_config where id for update;
  if v_antes.estado_conexion::text = p_estado then return; end if;
  if not public._whatsapp_transicion_valida('CONEXION', v_antes.estado_conexion::text, p_estado) then raise exception 'TRANSICION_INVALIDA'; end if;
  update public.whatsapp_config
     set estado_conexion = p_estado::public.whatsapp_estado_conexion, estado_conexion_detalle = left(btrim(p_motivo), 300),
         estado_conexion_at = now(), updated_at = now(), updated_by = auth.uid()
   where id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('whatsapp_config', null, 'WHATSAPP_CONEXION_ESTADO', 'SUPERSU', auth.uid(), left(btrim(p_motivo), 300),
          jsonb_build_object('estado_conexion', v_antes.estado_conexion), jsonb_build_object('estado_conexion', p_estado));
end $$;

create or replace function public.whatsapp_admin_crear_paquete(
  p_codigo text, p_nombre text, p_conversaciones integer, p_precio numeric, p_moneda text, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.whatsapp_paquete;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_codigo is null or p_codigo !~ '^[A-Z0-9_]{3,40}$' then raise exception 'CODIGO_INVALIDO'; end if;
  if p_nombre is null or length(btrim(p_nombre)) not between 2 and 60 then raise exception 'NOMBRE_INVALIDO'; end if;
  if p_conversaciones is null or p_conversaciones not between 1 and 1000000 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_precio is null or p_precio <= 0 or p_precio > 100000000 then raise exception 'PRECIO_INVALIDO'; end if;
  if coalesce(p_moneda, '') !~ '^[A-Z]{3}$' then raise exception 'MONEDA_INVALIDA'; end if;
  if exists (select 1 from public.whatsapp_paquete k where k.codigo = p_codigo) then raise exception 'CODIGO_DUPLICADO'; end if;
  insert into public.whatsapp_paquete (codigo, version, nombre, conversaciones, precio, moneda, created_by)
  values (p_codigo, 1, btrim(p_nombre), p_conversaciones, p_precio, p_moneda, auth.uid())
  returning * into v;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('whatsapp_paquete', v.id, 'WHATSAPP_PAQUETE_CREADO', 'SUPERSU', auth.uid(), left(btrim(p_motivo), 300), null, to_jsonb(v));
  return v.id;
end $$;

-- Cambiar nombre / cantidad / precio: nueva version activa; la anterior queda inactiva (las compras la conservan).
create or replace function public.whatsapp_admin_versionar_paquete(
  p_paquete_id uuid, p_nombre text, p_conversaciones integer, p_precio numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_antes public.whatsapp_paquete; v_nuevo public.whatsapp_paquete;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_nombre is null or length(btrim(p_nombre)) not between 2 and 60 then raise exception 'NOMBRE_INVALIDO'; end if;
  if p_conversaciones is null or p_conversaciones not between 1 and 1000000 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_precio is null or p_precio <= 0 or p_precio > 100000000 then raise exception 'PRECIO_INVALIDO'; end if;
  select * into v_antes from public.whatsapp_paquete where id = p_paquete_id for update;
  if not found then raise exception 'PAQUETE_NO_ENCONTRADO'; end if;
  if v_antes.version <> (select max(k.version) from public.whatsapp_paquete k where k.codigo = v_antes.codigo) then
    raise exception 'VERSION_DESACTUALIZADA';
  end if;
  update public.whatsapp_paquete set activo = false where codigo = v_antes.codigo and activo;
  insert into public.whatsapp_paquete (codigo, version, nombre, conversaciones, precio, moneda, activo, reemplaza_a, created_by)
  values (v_antes.codigo, v_antes.version + 1, btrim(p_nombre), p_conversaciones, p_precio, v_antes.moneda, true, v_antes.id, auth.uid())
  returning * into v_nuevo;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('whatsapp_paquete', v_nuevo.id, 'WHATSAPP_PAQUETE_VERSIONADO', 'SUPERSU', auth.uid(), left(btrim(p_motivo), 300),
          to_jsonb(v_antes), to_jsonb(v_nuevo));
  return v_nuevo.id;
end $$;

create or replace function public.whatsapp_admin_alternar_paquete(p_paquete_id uuid, p_activo boolean, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes public.whatsapp_paquete;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_activo is null then raise exception 'ESTADO_INVALIDO'; end if;
  select * into v_antes from public.whatsapp_paquete where id = p_paquete_id for update;
  if not found then raise exception 'PAQUETE_NO_ENCONTRADO'; end if;
  if v_antes.activo = p_activo then return; end if;
  if p_activo and v_antes.version <> (select max(k.version) from public.whatsapp_paquete k where k.codigo = v_antes.codigo) then
    raise exception 'VERSION_DESACTUALIZADA';
  end if;
  update public.whatsapp_paquete set activo = p_activo where id = p_paquete_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('whatsapp_paquete', p_paquete_id, case when p_activo then 'WHATSAPP_PAQUETE_ACTIVADO' else 'WHATSAPP_PAQUETE_DESACTIVADO' end,
          'SUPERSU', auth.uid(), left(btrim(p_motivo), 300), jsonb_build_object('activo', v_antes.activo), jsonb_build_object('activo', p_activo));
end $$;

revoke all on function public.whatsapp_admin_resumen() from public, anon, authenticated;
grant execute on function public.whatsapp_admin_resumen() to authenticated;
revoke all on function public.whatsapp_admin_actualizar_config(numeric, numeric, integer, integer[], text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_admin_actualizar_config(numeric, numeric, integer, integer[], text, text) to authenticated;
revoke all on function public.whatsapp_admin_estado_conexion(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_admin_estado_conexion(text, text) to authenticated;
revoke all on function public.whatsapp_admin_crear_paquete(text, text, integer, numeric, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_admin_crear_paquete(text, text, integer, numeric, text, text) to authenticated;
revoke all on function public.whatsapp_admin_versionar_paquete(uuid, text, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.whatsapp_admin_versionar_paquete(uuid, text, integer, numeric, text) to authenticated;
revoke all on function public.whatsapp_admin_alternar_paquete(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.whatsapp_admin_alternar_paquete(uuid, boolean, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 8) RPC del sistema (solo service_role: cron, webhook de pagos y, cuando exista, el adaptador del proveedor)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- Acredita una recarga pagada. Idempotente: repetir con el mismo pago devuelve el mismo lote.
create or replace function public.whatsapp_acreditar_recarga(p_compra_id uuid, p_pago_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.whatsapp_compra_recarga; p public.pago; v_lote uuid;
begin
  select * into c from public.whatsapp_compra_recarga where id = p_compra_id for update;
  if not found then raise exception 'COMPRA_NO_ENCONTRADA'; end if;
  if c.estado = 'ACREDITADA' then
    if c.pago_id = p_pago_id then return c.lote_id; end if;
    raise exception 'COMPRA_YA_ACREDITADA';
  end if;
  if c.estado <> 'PENDIENTE_PAGO' then raise exception 'TRANSICION_INVALIDA'; end if;
  select * into p from public.pago where id = p_pago_id for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if p.estado <> 'APROBADO' then raise exception 'PAGO_NO_APROBADO'; end if;
  if p.tipo <> 'PAQUETE_CONVERSACIONES_WHATSAPP' then raise exception 'PAGO_TIPO_INVALIDO'; end if;
  if p.negocio_id is distinct from c.negocio_id then raise exception 'PAGO_DE_OTRO_NEGOCIO'; end if;
  if p.monto < c.precio then raise exception 'PAGO_MONTO_INSUFICIENTE'; end if;
  if exists (select 1 from public.whatsapp_compra_recarga x where x.pago_id = p_pago_id and x.id <> p_compra_id) then
    raise exception 'PAGO_YA_USADO';
  end if;
  insert into public.whatsapp_conversacion_lote
    (negocio_id, origen, cantidad, cantidad_disponible, fecha_otorgamiento, fecha_expiracion, compra_id, cupo_marketing)
  values (c.negocio_id, 'PAQUETE', c.conversaciones, c.conversaciones, now(), now() + make_interval(months => c.meses_vencimiento),
          c.id, floor(c.conversaciones * c.pct_marketing / 100)::int)
  returning id into v_lote;
  update public.whatsapp_compra_recarga
     set estado = 'ACREDITADA', pago_id = p_pago_id, lote_id = v_lote, acreditada_at = now()
   where id = p_compra_id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_antes, payload_despues)
  values ('whatsapp_compra_recarga', p_compra_id, 'WHATSAPP_RECARGA_ACREDITADA', 'SISTEMA', c.negocio_id,
          jsonb_build_object('estado', c.estado),
          jsonb_build_object('estado', 'ACREDITADA', 'pago_id', p_pago_id, 'lote_id', v_lote, 'conversaciones', c.conversaciones));
  return v_lote;
end $$;

create or replace function public.whatsapp_otorgar_lote_plan(p_negocio_id uuid, p_periodo date default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public._whatsapp_otorgar_lote_plan(p_negocio_id, p_periodo);
end $$;

-- Cron mensual: lote del plan para todos los negocios (idempotente). Devuelve cuantos negocios tienen lote del mes.
create or replace function public.whatsapp_otorgar_lotes_plan_mes()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select x.id from public.negocio x loop
    if public._whatsapp_otorgar_lote_plan(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Estado de conexion verificado por el sistema contra el proveedor real (detalle = evidencia, p. ej. id del numero).
create or replace function public.whatsapp_sistema_estado_conexion(p_estado text, p_detalle text)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes public.whatsapp_config;
begin
  if p_estado is null or p_estado not in ('NO_CONFIGURADO','PENDIENTE_CREDENCIALES','SANDBOX','PRODUCCION','SUSPENDIDO','REVOCADO','ERROR') then
    raise exception 'ESTADO_INVALIDO';
  end if;
  if p_detalle is null or length(btrim(p_detalle)) < 3 then raise exception 'EVIDENCIA_REQUERIDA'; end if;
  select * into v_antes from public.whatsapp_config where id for update;
  if v_antes.estado_conexion::text = p_estado then return; end if;
  if not public._whatsapp_transicion_valida('CONEXION', v_antes.estado_conexion::text, p_estado) then raise exception 'TRANSICION_INVALIDA'; end if;
  update public.whatsapp_config
     set estado_conexion = p_estado::public.whatsapp_estado_conexion, estado_conexion_detalle = left(btrim(p_detalle), 300),
         estado_conexion_at = now(), updated_at = now(), updated_by = null
   where id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, motivo, payload_antes, payload_despues)
  values ('whatsapp_config', null, 'WHATSAPP_CONEXION_ESTADO', 'SISTEMA', left(btrim(p_detalle), 300),
          jsonb_build_object('estado_conexion', v_antes.estado_conexion), jsonb_build_object('estado_conexion', p_estado));
end $$;

-- Resultado de la revision del proveedor sobre una plantilla (enviada / aprobada / rechazada).
create or replace function public.whatsapp_sistema_plantilla_estado(
  p_plantilla_id uuid, p_estado text, p_proveedor_plantilla_id text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.whatsapp_plantilla;
begin
  if p_estado is null or p_estado not in ('PENDIENTE_APROBACION','APROBADA','RECHAZADA') then raise exception 'ESTADO_INVALIDO'; end if;
  if p_proveedor_plantilla_id is null or length(btrim(p_proveedor_plantilla_id)) = 0 then raise exception 'EVIDENCIA_REQUERIDA'; end if;
  select * into v from public.whatsapp_plantilla where id = p_plantilla_id for update;
  if not found then raise exception 'PLANTILLA_NO_ENCONTRADA'; end if;
  if v.estado::text = p_estado then return; end if;
  update public.whatsapp_plantilla
     set estado = p_estado::public.whatsapp_plantilla_estado, proveedor_plantilla_id = left(btrim(p_proveedor_plantilla_id), 200),
         motivo_rechazo = case when p_estado = 'RECHAZADA' then left(p_motivo, 500) else null end
   where id = p_plantilla_id;
end $$;

-- Materializa los destinatarios de una campana vencida (consentimiento recalculado AHORA). Sin conexion: bloquea.
create or replace function public.whatsapp_sistema_preparar_campana(p_campana_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare k public.whatsapp_campana; t public.whatsapp_plantilla; v_negocio_nombre text; n int;
begin
  select * into k from public.whatsapp_campana where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if k.estado <> 'PROGRAMADA' then raise exception 'TRANSICION_INVALIDA'; end if;
  if k.programada_at > now() then raise exception 'AUN_NO_PROGRAMADA'; end if;
  if not public._whatsapp_envio_habilitado() then
    update public.whatsapp_campana set estado = 'BLOQUEADA_SIN_CONEXION', motivo_estado = 'SIN_CONEXION' where id = p_campana_id;
    return 0;
  end if;
  if not public._whatsapp_plan_incluye(k.negocio_id, 'whatsapp_marketing') then raise exception 'FUNCION_NO_INCLUIDA'; end if;
  select * into t from public.whatsapp_plantilla where id = k.plantilla_id;
  if t.estado <> 'APROBADA' then raise exception 'PLANTILLA_NO_APROBADA'; end if;
  select x.nombre into v_negocio_nombre from public.negocio x where x.id = k.negocio_id;
  insert into public.whatsapp_mensaje (negocio_id, campana_id, plantilla_id, cliente_id, telefono, categoria, variables)
  select k.negocio_id, k.id, k.plantilla_id, d.dest_cliente_id, d.dest_telefono, k.categoria,
         coalesce((select jsonb_object_agg(v.ord::text,
                     case v.nombre when 'nombre_cliente' then coalesce(split_part(d.dest_nombre, ' ', 1), '') else coalesce(v_negocio_nombre, '') end)
                     from jsonb_array_elements_text(t.variables) with ordinality as v(nombre, ord)), '{}'::jsonb)
    from public._whatsapp_destinatarios(k.negocio_id, k.segmento, k.categoria) d
  on conflict do nothing;
  get diagnostics n = row_count;
  update public.whatsapp_campana set estado = 'EN_ENVIO', motivo_estado = null where id = p_campana_id;
  return n;
end $$;

-- Mensaje de utilidad (recordatorio / confirmacion). Idempotente por plantilla + referencia.
create or replace function public.whatsapp_sistema_preparar_mensaje_utilidad(
  p_negocio_id uuid, p_plantilla_id uuid, p_cliente_id uuid, p_variables jsonb, p_referencia_tipo text, p_referencia_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.whatsapp_plantilla; v_tel text; v_id uuid;
begin
  if p_referencia_tipo is null or p_referencia_id is null then raise exception 'REFERENCIA_REQUERIDA'; end if;
  select * into t from public.whatsapp_plantilla where id = p_plantilla_id and (negocio_id = p_negocio_id or negocio_id is null);
  if not found then raise exception 'PLANTILLA_NO_ENCONTRADA'; end if;
  if t.categoria <> 'UTILIDAD' then raise exception 'PLANTILLA_NO_ES_UTILIDAD'; end if;
  if p_variables is null or jsonb_typeof(p_variables) <> 'object'
     or (select count(*) from jsonb_object_keys(p_variables)) <> jsonb_array_length(t.variables)
     or exists (select 1 from generate_series(1, jsonb_array_length(t.variables)) g
                 where jsonb_typeof(p_variables->(g::text)) is distinct from 'string' or length(p_variables->>(g::text)) > 200) then
    raise exception 'VARIABLES_INVALIDAS';
  end if;
  if not exists (select 1 from public.reserva r where r.negocio_id = p_negocio_id and r.cliente_id = p_cliente_id) then
    raise exception 'CLIENTE_NO_ES_DEL_NEGOCIO';
  end if;
  select regexp_replace(p.telefono, '[^0-9]', '', 'g') into v_tel from public.perfil p where p.id = p_cliente_id;
  if v_tel is null or length(v_tel) not between 7 and 15 then raise exception 'TELEFONO_INVALIDO'; end if;
  insert into public.whatsapp_mensaje (negocio_id, plantilla_id, cliente_id, telefono, categoria, variables, referencia_tipo, referencia_id, estado)
  values (p_negocio_id, p_plantilla_id, p_cliente_id, v_tel, 'UTILIDAD', p_variables, p_referencia_tipo, p_referencia_id,
          case when public._whatsapp_envio_habilitado() then 'PREPARADO' else 'BLOQUEADO_SIN_CONEXION' end::public.whatsapp_mensaje_estado)
  on conflict (plantilla_id, referencia_tipo, referencia_id) where referencia_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    select m.id into v_id from public.whatsapp_mensaje m
     where m.plantilla_id = p_plantilla_id and m.referencia_tipo = p_referencia_tipo and m.referencia_id = p_referencia_id;
  end if;
  return v_id;
end $$;

-- Paso previo al envio real: reserva 1 conversacion. Devuelve {ok, motivo}; nunca marca nada como enviado.
create or replace function public.whatsapp_sistema_reservar_envio(p_mensaje_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.whatsapp_mensaje; v_lote uuid; v_estado_plantilla public.whatsapp_plantilla_estado;
begin
  select * into m from public.whatsapp_mensaje where id = p_mensaje_id for update;
  if not found then raise exception 'MENSAJE_NO_ENCONTRADO'; end if;
  if m.estado <> 'PREPARADO' then return jsonb_build_object('ok', false, 'motivo', 'ESTADO_' || m.estado); end if;
  if not public._whatsapp_envio_habilitado() then
    update public.whatsapp_mensaje set estado = 'BLOQUEADO_SIN_CONEXION' where id = p_mensaje_id;
    return jsonb_build_object('ok', false, 'motivo', 'SIN_CONEXION');
  end if;
  select t.estado into v_estado_plantilla from public.whatsapp_plantilla t where t.id = m.plantilla_id;
  if v_estado_plantilla <> 'APROBADA' then return jsonb_build_object('ok', false, 'motivo', 'PLANTILLA_NO_APROBADA'); end if;
  if m.categoria = 'MARKETING' and not public._consentimiento_vigente(m.cliente_id, 'marketing_whatsapp') then
    update public.whatsapp_mensaje set estado = 'FALLIDO', error_codigo = 'SIN_CONSENTIMIENTO', fallido_at = now() where id = p_mensaje_id;
    return jsonb_build_object('ok', false, 'motivo', 'SIN_CONSENTIMIENTO');
  end if;
  begin
    v_lote := public._whatsapp_consumir(p_mensaje_id);
  exception when others then
    if sqlerrm in ('SALDO_INSUFICIENTE', 'CUPO_MARKETING_AGOTADO') then
      return jsonb_build_object('ok', false, 'motivo', sqlerrm);
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'lote_id', v_lote);
end $$;

-- El proveedor acepto el mensaje: PREPARADO -> ENVIADO con su id. Exige la reserva previa. Idempotente.
create or replace function public.whatsapp_sistema_registrar_envio(p_mensaje_id uuid, p_proveedor_mensaje_id text, p_evidencia jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare m public.whatsapp_mensaje;
begin
  if p_proveedor_mensaje_id is null or length(btrim(p_proveedor_mensaje_id)) = 0 then raise exception 'EVIDENCIA_REQUERIDA'; end if;
  select * into m from public.whatsapp_mensaje where id = p_mensaje_id for update;
  if not found then raise exception 'MENSAJE_NO_ENCONTRADO'; end if;
  if m.proveedor_mensaje_id = btrim(p_proveedor_mensaje_id) then return false; end if;
  if m.estado <> 'PREPARADO' then raise exception 'TRANSICION_INVALIDA'; end if;
  if not exists (select 1 from public.whatsapp_consumo c where c.mensaje_id = p_mensaje_id and c.tipo = 'CONSUMO')
     or exists (select 1 from public.whatsapp_consumo c where c.mensaje_id = p_mensaje_id and c.tipo = 'REVERSO') then
    raise exception 'SIN_RESERVA_DE_SALDO';
  end if;
  update public.whatsapp_mensaje
     set estado = 'ENVIADO', proveedor_mensaje_id = btrim(p_proveedor_mensaje_id), enviado_at = now()
   where id = p_mensaje_id;
  insert into public.whatsapp_mensaje_evento (mensaje_id, estado, proveedor_payload) values (p_mensaje_id, 'ENVIADO', p_evidencia);
  return true;
end $$;

-- El intento de envio fallo antes o despues de llegar al proveedor: FALLIDO y se devuelve la conversacion.
create or replace function public.whatsapp_sistema_registrar_fallo(p_mensaje_id uuid, p_error_codigo text, p_error_detalle text, p_evidencia jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare m public.whatsapp_mensaje;
begin
  select * into m from public.whatsapp_mensaje where id = p_mensaje_id for update;
  if not found then raise exception 'MENSAJE_NO_ENCONTRADO'; end if;
  if m.estado = 'FALLIDO' then return false; end if;
  if not public._whatsapp_transicion_valida('MENSAJE', m.estado::text, 'FALLIDO') then raise exception 'TRANSICION_INVALIDA'; end if;
  perform public._whatsapp_revertir_consumo(p_mensaje_id);
  update public.whatsapp_mensaje
     set estado = 'FALLIDO', error_codigo = left(coalesce(p_error_codigo, 'DESCONOCIDO'), 80), error_detalle = left(p_error_detalle, 500), fallido_at = now()
   where id = p_mensaje_id;
  insert into public.whatsapp_mensaje_evento (mensaje_id, estado, proveedor_payload) values (p_mensaje_id, 'FALLIDO', p_evidencia);
  return true;
end $$;

-- Webhook de estado del proveedor (por su id de mensaje). Repetido o atrasado = sin cambios (devuelve false).
create or replace function public.whatsapp_sistema_actualizar_estado(p_proveedor_mensaje_id text, p_estado text, p_evidencia jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare m public.whatsapp_mensaje; v_rango_actual int; v_rango_nuevo int;
begin
  if p_estado is null or p_estado not in ('ENTREGADO','LEIDO','FALLIDO') then raise exception 'ESTADO_INVALIDO'; end if;
  if p_evidencia is null then raise exception 'EVIDENCIA_REQUERIDA'; end if;
  select * into m from public.whatsapp_mensaje where proveedor_mensaje_id = p_proveedor_mensaje_id for update;
  if not found then raise exception 'MENSAJE_NO_ENCONTRADO'; end if;
  if m.estado::text = p_estado then return false; end if;
  v_rango_actual := case m.estado when 'ENVIADO' then 1 when 'ENTREGADO' then 2 when 'LEIDO' then 3 else 9 end;
  v_rango_nuevo := case p_estado when 'ENTREGADO' then 2 when 'LEIDO' then 3 else 0 end;
  if m.estado in ('LEIDO','FALLIDO') or (v_rango_nuevo > 0 and v_rango_nuevo < v_rango_actual) then return false; end if;
  if not public._whatsapp_transicion_valida('MENSAJE', m.estado::text, p_estado) then raise exception 'TRANSICION_INVALIDA'; end if;
  if p_estado = 'FALLIDO' then perform public._whatsapp_revertir_consumo(m.id); end if;
  update public.whatsapp_mensaje
     set estado = p_estado::public.whatsapp_mensaje_estado,
         entregado_at = case when p_estado = 'ENTREGADO' then now() else entregado_at end,
         leido_at = case when p_estado = 'LEIDO' then now() else leido_at end,
         fallido_at = case when p_estado = 'FALLIDO' then now() else fallido_at end
   where id = m.id;
  insert into public.whatsapp_mensaje_evento (mensaje_id, estado, proveedor_payload)
  values (m.id, p_estado::public.whatsapp_mensaje_estado, p_evidencia);
  return true;
end $$;

-- Cierra una campana EN_ENVIO cuando ya no le quedan mensajes por intentar.
create or replace function public.whatsapp_sistema_cerrar_campana(p_campana_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare k public.whatsapp_campana;
begin
  select * into k from public.whatsapp_campana where id = p_campana_id for update;
  if not found then raise exception 'CAMPANA_NO_ENCONTRADA'; end if;
  if k.estado <> 'EN_ENVIO' then return false; end if;
  if exists (select 1 from public.whatsapp_mensaje m where m.campana_id = p_campana_id and m.estado in ('PREPARADO','BLOQUEADO_SIN_CONEXION')) then
    return false;
  end if;
  update public.whatsapp_campana set estado = 'COMPLETADA' where id = p_campana_id;
  return true;
end $$;

revoke all on function public.whatsapp_acreditar_recarga(uuid, uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_acreditar_recarga(uuid, uuid) to service_role;
revoke all on function public.whatsapp_otorgar_lote_plan(uuid, date) from public, anon, authenticated;
grant execute on function public.whatsapp_otorgar_lote_plan(uuid, date) to service_role;
revoke all on function public.whatsapp_otorgar_lotes_plan_mes() from public, anon, authenticated;
grant execute on function public.whatsapp_otorgar_lotes_plan_mes() to service_role;
revoke all on function public.whatsapp_sistema_estado_conexion(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_estado_conexion(text, text) to service_role;
revoke all on function public.whatsapp_sistema_plantilla_estado(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_plantilla_estado(uuid, text, text, text) to service_role;
revoke all on function public.whatsapp_sistema_preparar_campana(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_preparar_campana(uuid) to service_role;
revoke all on function public.whatsapp_sistema_preparar_mensaje_utilidad(uuid, uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_preparar_mensaje_utilidad(uuid, uuid, uuid, jsonb, text, uuid) to service_role;
revoke all on function public.whatsapp_sistema_reservar_envio(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_reservar_envio(uuid) to service_role;
revoke all on function public.whatsapp_sistema_registrar_envio(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_registrar_envio(uuid, text, jsonb) to service_role;
revoke all on function public.whatsapp_sistema_registrar_fallo(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_registrar_fallo(uuid, text, text, jsonb) to service_role;
revoke all on function public.whatsapp_sistema_actualizar_estado(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_actualizar_estado(text, text, jsonb) to service_role;
revoke all on function public.whatsapp_sistema_cerrar_campana(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_sistema_cerrar_campana(uuid) to service_role;

-- Pruebas negativas obligatorias tras aplicar (como authenticated de un negocio ajeno / anon):
--  * select whatsapp_panel_resumen('<negocio ajeno>')                        -> NO_AUTORIZADO
--  * select whatsapp_acreditar_recarga(...) como authenticated              -> permission denied
--  * update whatsapp_mensaje set estado = 'ENVIADO' (service_role, sin id)    -> viola whatsapp_mensaje_evidencia_proveedor
--  * update/delete whatsapp_consumo como service_role                        -> WHATSAPP_REGISTRO_INMUTABLE
--  * whatsapp_campana_programar con estado_conexion <> PRODUCCION             -> devuelve BLOQUEADA_SIN_CONEXION, 0 mensajes
