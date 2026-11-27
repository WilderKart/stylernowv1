-- 201: Ganancias del staff — reglas de comisión, registro financiero por servicio, liquidaciones, pagos, ajustes,
-- novedades, solicitudes de revisión y acceso de soporte temporal (SuperSU) de solo lectura.
--
-- Diseño (docs/ganancias-staff/ARQUITECTURA.md):
--   · La comisión se genera SOLO en la base, con un trigger sobre reserva (estado → COMPLETADA). Cubre agenda, POS y
--     walk-in porque todos terminan en esa transición. Idempotente: unique (reserva_id, servicio_id).
--   · Ninguna tabla de este módulo admite INSERT/UPDATE/DELETE desde la API: todo pasa por funciones SECURITY DEFINER
--     que derivan la identidad de auth.uid() y validan negocio, sede y capacidad. SuperSU NO es bypass: solo lee mientras
--     exista una sesión de soporte autorizada por el propietario, vigente y de su propio agente.
--   · Los registros cerrados no se reescriben: se corrigen con ajustes, reversiones y anulaciones auditadas.
-- Reversión: 201_ganancias_staff_comisiones_liquidaciones_REVERSION.sql.txt

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═══════════════════════════════════════════════════════════════════════════

-- Capacidades financieras explícitas (un administrador NO ve ganancias por serlo). El propietario las tiene todas, implícitas.
create table if not exists public.ganancia_permiso (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  usuario_id uuid not null,
  sede_id uuid references public.sede(id) on delete cascade,      -- null = todas las sedes del negocio
  ver boolean not null default false,
  configurar boolean not null default false,
  liquidar boolean not null default false,
  pagar boolean not null default false,
  exportar boolean not null default false,
  novedades boolean not null default false,
  otorgado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ganancia_permiso_unico on public.ganancia_permiso (negocio_id, usuario_id, coalesce(sede_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Reglas de comisión con vigencia y versión. Una regla no se edita: se reemplaza (nueva versión) o se desactiva.
create table if not exists public.comision_regla (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid references public.sede(id) on delete cascade,
  staff_id uuid,
  servicio_id uuid references public.servicio(id) on delete cascade,
  categoria text,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 100),
  base text not null default 'NETO' check (base in ('PRECIO_ORIGINAL', 'NETO')),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA', 'INACTIVA')),
  version int not null default 1,
  reemplaza_id uuid references public.comision_regla(id),
  motivo text not null check (length(btrim(motivo)) >= 3),
  creado_por uuid,
  desactivado_por uuid,
  desactivado_at timestamptz,
  desactivado_motivo text,
  created_at timestamptz not null default now(),
  constraint regla_vigencia check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  constraint regla_servicio_o_categoria check (servicio_id is null or categoria is null)
);
create index if not exists comision_regla_negocio on public.comision_regla (negocio_id, estado, vigente_desde);

-- Registro financiero por servicio prestado (una fila por servicio de la reserva). Los valores se congelan al generarse.
create table if not exists public.staff_ganancia (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid references public.sede(id) on delete set null,
  staff_id uuid not null,
  reserva_id uuid not null references public.reserva(id) on delete cascade,
  servicio_id uuid not null,
  cliente_id uuid,
  servicio_nombre text not null,
  categoria text,
  cliente_nombre text,
  precio_original numeric(12,2) not null,
  descuento numeric(12,2) not null default 0,
  descuento_motivo text,
  valor_neto numeric(12,2) not null,
  base_tipo text check (base_tipo in ('PRECIO_ORIGINAL', 'NETO')),
  base_comision numeric(12,2) not null default 0,
  pct numeric(5,2),
  comision numeric(12,2) not null default 0,
  participacion_negocio numeric(12,2) not null,
  regla_id uuid,
  regla_version int,
  origen_regla text,                       -- REGLA | VINCULO | NINGUNA
  estado_comision text not null default 'PENDIENTE'
    check (estado_comision in ('SIN_REGLA', 'PENDIENTE', 'EN_REVISION', 'LIQUIDADA', 'REVERTIDA')),
  prestado_at timestamptz not null default now(),
  fecha_local date not null,
  evento_origen text not null default 'RESERVA_COMPLETADA',
  actor_origen uuid,
  generado_at timestamptz not null default now(),
  constraint ganancia_unica_por_servicio unique (reserva_id, servicio_id),
  constraint ganancia_valores check (valor_neto >= 0 and comision >= 0 and comision <= greatest(base_comision, 0) + 0.01)
);
create index if not exists staff_ganancia_negocio_fecha on public.staff_ganancia (negocio_id, fecha_local desc);
create index if not exists staff_ganancia_staff_fecha on public.staff_ganancia (staff_id, fecha_local desc);
create index if not exists staff_ganancia_sede on public.staff_ganancia (sede_id, fecha_local desc);
create index if not exists staff_ganancia_estado on public.staff_ganancia (negocio_id, estado_comision);

create table if not exists public.ganancia_liquidacion (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid references public.sede(id) on delete set null,
  staff_id uuid not null,
  staff_nombre text,
  periodo_tipo text not null check (periodo_tipo in ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'PERSONALIZADO')),
  desde date not null,
  hasta date not null,
  estado text not null default 'CERRADA' check (estado in ('CERRADA', 'PAGADA_PARCIAL', 'PAGADA', 'REVERTIDA')),
  total_comisiones numeric(12,2) not null,
  total_ajustes numeric(12,2) not null default 0,
  total_neto numeric(12,2) not null check (total_neto > 0),
  pagado numeric(12,2) not null default 0 check (pagado >= 0),
  servicios int not null,
  produccion numeric(12,2) not null,
  creado_por uuid,
  cerrada_at timestamptz not null default now(),
  revertida_por uuid,
  revertida_at timestamptz,
  revertida_motivo text,
  constraint liquidacion_periodo check (hasta >= desde),
  constraint liquidacion_pagado_max check (pagado <= total_neto)
);
create index if not exists ganancia_liquidacion_negocio on public.ganancia_liquidacion (negocio_id, cerrada_at desc);
create index if not exists ganancia_liquidacion_staff on public.ganancia_liquidacion (staff_id, cerrada_at desc);

-- Ajustes (+/-) del libro de comisiones: reemplazan editar. Se incluyen en la siguiente liquidación.
create table if not exists public.ganancia_ajuste (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid references public.sede(id) on delete set null,
  staff_id uuid not null,
  ganancia_id uuid references public.staff_ganancia(id),
  monto numeric(12,2) not null check (monto <> 0),
  motivo text not null check (length(btrim(motivo)) >= 10),
  liquidacion_id uuid references public.ganancia_liquidacion(id),   -- null = pendiente de liquidar
  creado_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists ganancia_ajuste_staff on public.ganancia_ajuste (negocio_id, staff_id, liquidacion_id);

create table if not exists public.ganancia_liquidacion_item (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.ganancia_liquidacion(id) on delete cascade,
  ganancia_id uuid references public.staff_ganancia(id),
  ajuste_id uuid references public.ganancia_ajuste(id),
  monto numeric(12,2) not null,
  activo boolean not null default true,
  constraint item_uno check ((ganancia_id is null) <> (ajuste_id is null))
);
create unique index if not exists item_ganancia_activa on public.ganancia_liquidacion_item (ganancia_id) where activo and ganancia_id is not null;
create unique index if not exists item_ajuste_activo on public.ganancia_liquidacion_item (ajuste_id) where activo and ajuste_id is not null;

create table if not exists public.ganancia_pago (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.ganancia_liquidacion(id) on delete cascade,
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid,
  staff_id uuid not null,
  monto numeric(12,2) not null check (monto > 0),
  medio text not null check (medio in ('EFECTIVO', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'OTRO')),
  referencia text,
  observacion text,
  evidencia_path text,
  pagado_el date not null default current_date,
  clave_idempotencia text,
  estado text not null default 'REGISTRADO' check (estado in ('REGISTRADO', 'ANULADO')),
  registrado_por uuid,
  anulado_por uuid,
  anulado_at timestamptz,
  anulado_motivo text,
  created_at timestamptz not null default now()
);
create unique index if not exists ganancia_pago_idem on public.ganancia_pago (liquidacion_id, clave_idempotencia) where clave_idempotencia is not null;

create table if not exists public.ganancia_novedad (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid,
  staff_id uuid,
  reserva_id uuid,
  ganancia_id uuid,
  liquidacion_id uuid,
  tipo text not null,
  clave text not null,
  severidad text not null check (severidad in ('CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFORMATIVA')),
  estado text not null default 'DETECTADA' check (estado in ('DETECTADA', 'PENDIENTE', 'EN_REVISION', 'RESUELTA', 'DESCARTADA')),
  descripcion text not null,
  impacto numeric(12,2),
  asignado_a uuid,
  resolucion text,
  resuelto_por uuid,
  resuelto_at timestamptz,
  created_at timestamptz not null default now(),
  constraint novedad_clave unique (negocio_id, tipo, clave)
);
create index if not exists ganancia_novedad_estado on public.ganancia_novedad (negocio_id, estado, severidad);

create table if not exists public.ganancia_revision (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  sede_id uuid,
  staff_id uuid not null,
  objeto_tipo text not null check (objeto_tipo in ('GANANCIA', 'LIQUIDACION', 'PAGO', 'AJUSTE')),
  objeto_id uuid not null,
  motivo text not null check (length(btrim(motivo)) >= 10),
  evidencia_path text,
  estado text not null default 'SOLICITADA'
    check (estado in ('SOLICITADA', 'EN_REVISION', 'EVIDENCIA_SOLICITADA', 'APROBADA', 'RECHAZADA')),
  respuesta text,
  decidido_por uuid,
  decidido_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ganancia_revision_negocio on public.ganancia_revision (negocio_id, estado);
create index if not exists ganancia_revision_staff on public.ganancia_revision (staff_id, created_at desc);

-- Acceso excepcional de soporte (SuperSU): solicitud expresa → autorización del propietario → toma por UN agente → expira.
create table if not exists public.soporte_acceso_ganancias (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id) on delete cascade,
  solicitado_por uuid not null,
  motivo text not null check (length(btrim(motivo)) >= 10),
  modulo text not null default 'GANANCIAS' check (modulo = 'GANANCIAS'),
  alcance text not null default 'LECTURA' check (alcance = 'LECTURA'),
  estado text not null default 'SOLICITADO' check (estado in ('SOLICITADO', 'AUTORIZADO', 'RECHAZADO', 'REVOCADO', 'EXPIRADO')),
  duracion_min int check (duracion_min between 5 and 240),
  autorizado_por uuid,
  autorizado_at timestamptz,
  agente_id uuid,
  iniciado_at timestamptz,
  expira_at timestamptz,
  revocado_por uuid,
  revocado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists soporte_acceso_negocio on public.soporte_acceso_ganancias (negocio_id, estado);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Inmutabilidad: solo cambian las columnas de estado listadas; nada se borra directamente
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public._gan_inmutable()
returns trigger language plpgsql set search_path = public as $$
declare v_perm text[] := string_to_array(coalesce(tg_argv[0], ''), ',');
begin
  if tg_op = 'DELETE' then
    -- Las cascadas (p. ej. al eliminar un negocio de prueba) corren a mayor profundidad; el borrado directo no.
    if pg_trigger_depth() <= 1 then raise exception 'REGISTRO_FINANCIERO_NO_SE_BORRA'; end if;
    return old;
  end if;
  if (to_jsonb(new) - v_perm) is distinct from (to_jsonb(old) - v_perm) then
    raise exception 'REGISTRO_FINANCIERO_INMUTABLE';
  end if;
  return new;
end $$;
revoke all on function public._gan_inmutable() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('staff_ganancia', 'estado_comision'),
    ('ganancia_liquidacion', 'estado,pagado,revertida_por,revertida_at,revertida_motivo'),
    ('ganancia_ajuste', 'liquidacion_id'),
    ('ganancia_liquidacion_item', 'activo'),
    ('ganancia_pago', 'estado,anulado_por,anulado_at,anulado_motivo'),
    ('ganancia_revision', 'estado,respuesta,decidido_por,decidido_at'),
    ('ganancia_novedad', 'estado,asignado_a,resolucion,resuelto_por,resuelto_at,severidad,descripcion,impacto'),
    ('comision_regla', 'estado,vigente_hasta,desactivado_por,desactivado_at,desactivado_motivo'),
    ('soporte_acceso_ganancias', 'estado,duracion_min,autorizado_por,autorizado_at,agente_id,iniciado_at,expira_at,revocado_por,revocado_at')
  ) as t(tabla, cols)
  loop
    execute format('drop trigger if exists trg_inmutable on public.%I', r.tabla);
    execute format('create trigger trg_inmutable before update or delete on public.%I for each row execute function public._gan_inmutable(%L)', r.tabla, r.cols);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Autorización (todo derivado de auth.uid(); NULL no autoriza)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public._gan_permiso(p_negocio uuid, p_sede uuid, p_cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.is_barberia_de(p_negocio)
    or exists (
      select 1 from public.ganancia_permiso gp
      join public.vinculo_staff_negocio v on v.staff_id = gp.usuario_id and v.negocio_id = gp.negocio_id and v.estado = 'ACTIVO'
      where gp.usuario_id = auth.uid() and gp.negocio_id = p_negocio
        and (gp.sede_id is null or gp.sede_id = p_sede)
        and case p_cap when 'ver' then gp.ver when 'configurar' then gp.configurar when 'liquidar' then gp.liquidar
                       when 'pagar' then gp.pagar when 'exportar' then gp.exportar when 'novedades' then gp.novedades else false end
    ), false);
$$;
revoke all on function public._gan_permiso(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public._gan_permiso(uuid, uuid, text) to authenticated;   -- necesario para las políticas RLS; no revela datos

create or replace function public._gan_soporte_activo(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_supersu(), false) and exists (
    select 1 from public.soporte_acceso_ganancias s
    where s.negocio_id = p_negocio and s.agente_id = auth.uid() and s.estado = 'AUTORIZADO'
      and s.revocado_at is null and s.expira_at > now());
$$;
revoke all on function public._gan_soporte_activo(uuid) from public, anon, authenticated;
grant execute on function public._gan_soporte_activo(uuid) to authenticated;

create or replace function public._gan_puede_ver(p_negocio uuid, p_sede uuid, p_staff uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_staff = auth.uid(), false) or public._gan_permiso(p_negocio, p_sede, 'ver') or public._gan_soporte_activo(p_negocio);
$$;
revoke all on function public._gan_puede_ver(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public._gan_puede_ver(uuid, uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS: lectura por helper; sin escritura directa
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['ganancia_permiso','comision_regla','staff_ganancia','ganancia_liquidacion','ganancia_ajuste',
    'ganancia_liquidacion_item','ganancia_pago','ganancia_novedad','ganancia_revision','soporte_acceso_ganancias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists sel on public.%I', t);
  end loop;
end $$;

create policy sel on public.ganancia_permiso for select to authenticated
  using (usuario_id = auth.uid() or public.is_barberia_de(negocio_id));
create policy sel on public.comision_regla for select to authenticated
  using (public._gan_permiso(negocio_id, sede_id, 'configurar') or public._gan_permiso(negocio_id, sede_id, 'ver') or public._gan_soporte_activo(negocio_id));
create policy sel on public.staff_ganancia for select to authenticated using (public._gan_puede_ver(negocio_id, sede_id, staff_id));
create policy sel on public.ganancia_liquidacion for select to authenticated using (public._gan_puede_ver(negocio_id, sede_id, staff_id));
create policy sel on public.ganancia_ajuste for select to authenticated using (public._gan_puede_ver(negocio_id, sede_id, staff_id));
create policy sel on public.ganancia_liquidacion_item for select to authenticated using (exists (
  select 1 from public.ganancia_liquidacion l where l.id = liquidacion_id and public._gan_puede_ver(l.negocio_id, l.sede_id, l.staff_id)));
create policy sel on public.ganancia_pago for select to authenticated using (public._gan_puede_ver(negocio_id, sede_id, staff_id));
create policy sel on public.ganancia_novedad for select to authenticated
  using (public._gan_permiso(negocio_id, sede_id, 'novedades') or public._gan_soporte_activo(negocio_id));
create policy sel on public.ganancia_revision for select to authenticated
  using (staff_id = auth.uid() or public._gan_permiso(negocio_id, sede_id, 'novedades') or public._gan_soporte_activo(negocio_id));
create policy sel on public.soporte_acceso_ganancias for select to authenticated
  using (public.is_barberia_de(negocio_id) or agente_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Motor de comisiones
-- ═══════════════════════════════════════════════════════════════════════════
-- Jerarquía (documentada en REGLAS_COMISION.md): gana la regla más específica según
--   puntaje = 8·staff + 4·servicio + 2·categoría + 1·sede; empate → vigente_desde más reciente → creada más reciente.
-- Sin regla: comisión base del vínculo (vinculo_staff_negocio.comision_pct, base NETO). Sin nada: SIN_REGLA + novedad.
create or replace function public._comision_resolver(p_negocio uuid, p_sede uuid, p_staff uuid, p_servicio uuid, p_categoria text, p_fecha date)
returns table (regla_id uuid, regla_version int, pct numeric, base text, origen text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select r.id, r.version, r.pct, r.base, 'REGLA'::text
    from public.comision_regla r
    where r.negocio_id = p_negocio and r.estado = 'ACTIVA'
      and r.vigente_desde <= p_fecha and (r.vigente_hasta is null or r.vigente_hasta >= p_fecha)
      and (r.staff_id is null or r.staff_id = p_staff)
      and (r.servicio_id is null or r.servicio_id = p_servicio)
      and (r.categoria is null or r.categoria = p_categoria)
      and (r.sede_id is null or r.sede_id = p_sede)
    order by (case when r.staff_id is not null then 8 else 0 end + case when r.servicio_id is not null then 4 else 0 end
              + case when r.categoria is not null then 2 else 0 end + case when r.sede_id is not null then 1 else 0 end) desc,
             r.vigente_desde desc, r.created_at desc, r.id
    limit 1;
  if found then return; end if;
  return query
    select null::uuid, null::int, v.comision_pct, 'NETO'::text, 'VINCULO'::text
    from public.vinculo_staff_negocio v
    where v.staff_id = p_staff and v.negocio_id = p_negocio and v.comision_pct is not null
    limit 1;
end $$;
revoke all on function public._comision_resolver(uuid, uuid, uuid, uuid, text, date) from public, anon, authenticated;

-- Una regla activa no puede solaparse con otra del mismo alcance (evita ambigüedad por construcción).
create or replace function public._trg_regla_sin_solape()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estado = 'ACTIVA' and exists (
    select 1 from public.comision_regla r
    where r.negocio_id = new.negocio_id and r.id <> new.id and r.estado = 'ACTIVA'
      and r.sede_id is not distinct from new.sede_id and r.staff_id is not distinct from new.staff_id
      and r.servicio_id is not distinct from new.servicio_id and r.categoria is not distinct from new.categoria
      and daterange(r.vigente_desde, coalesce(r.vigente_hasta, 'infinity'::date), '[]')
          && daterange(new.vigente_desde, coalesce(new.vigente_hasta, 'infinity'::date), '[]')) then
    raise exception 'REGLA_SOLAPADA';
  end if;
  return new;
end $$;
revoke all on function public._trg_regla_sin_solape() from public, anon, authenticated;
drop trigger if exists trg_regla_sin_solape on public.comision_regla;
create trigger trg_regla_sin_solape before insert or update on public.comision_regla
  for each row execute function public._trg_regla_sin_solape();

create or replace function public._novedad_registrar(p_negocio uuid, p_sede uuid, p_staff uuid, p_reserva uuid, p_ganancia uuid,
  p_liquidacion uuid, p_tipo text, p_clave text, p_sev text, p_desc text, p_impacto numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ganancia_novedad (negocio_id, sede_id, staff_id, reserva_id, ganancia_id, liquidacion_id, tipo, clave, severidad, descripcion, impacto)
  values (p_negocio, p_sede, p_staff, p_reserva, p_ganancia, p_liquidacion, p_tipo, p_clave, p_sev, p_desc, p_impacto)
  on conflict (negocio_id, tipo, clave) do nothing;
end $$;
revoke all on function public._novedad_registrar(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, numeric) from public, anon, authenticated;

-- Generación idempotente a partir de una reserva COMPLETADA.
create or replace function public._ganancia_generar(p_reserva_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_r public.reserva;
  v_zona text;
  v_cliente text;
  v_suma numeric;
  v_desc_total numeric;
  v_membresia numeric;
  v_acum numeric := 0;
  v_n int;
  v_i int := 0;
  l record;
  rg record;
  v_desc numeric;
  v_neto numeric;
  v_base numeric;
  v_com numeric;
  v_fecha date;
  v_prestado timestamptz;
  v_creadas int := 0;
  v_id uuid;
begin
  select * into v_r from public.reserva where id = p_reserva_id;
  if not found then return 0; end if;

  if v_r.staff_id is null then
    perform public._novedad_registrar(v_r.negocio_id, v_r.sede_id, null, v_r.id, null, null, 'SERVICIO_SIN_PROFESIONAL', v_r.id::text,
      'ALTA', 'Servicio completado sin profesional asignado: no se generó comisión.', v_r.monto_total);
    return 0;
  end if;

  select coalesce(zona_horaria, 'America/Bogota') into v_zona from public.sede where id = v_r.sede_id;
  v_zona := coalesce(v_zona, 'America/Bogota');
  v_prestado := coalesce(v_r.checkout_at, v_r.updated_at, now());
  v_fecha := (v_prestado at time zone v_zona)::date;
  select nullif(btrim(nombre), '') into v_cliente from public.perfil where id = v_r.cliente_id;

  select coalesce(sum(precio_congelado_unitario), 0), count(*) into v_suma, v_n from public.reserva_servicio where reserva_id = p_reserva_id;
  if v_n = 0 then return 0; end if;
  select coalesce(sum(monto_beneficio), 0) into v_membresia from public.membresia_uso where reserva_id = p_reserva_id;
  v_desc_total := least(greatest(v_suma - coalesce(v_r.monto_total, v_suma), 0) + v_membresia, v_suma);

  for l in
    select rs.servicio_id, rs.precio_congelado_unitario as precio, s.nombre, s.categoria_puntaje::text as categoria
    from public.reserva_servicio rs join public.servicio s on s.id = rs.servicio_id
    where rs.reserva_id = p_reserva_id order by rs.servicio_id
  loop
    v_i := v_i + 1;
    if v_suma > 0 then
      v_desc := case when v_i = v_n then v_desc_total - v_acum else round(v_desc_total * l.precio / v_suma, 2) end;
    else v_desc := 0; end if;
    v_desc := least(greatest(v_desc, 0), l.precio);
    v_acum := v_acum + v_desc;
    v_neto := l.precio - v_desc;

    select * into rg from public._comision_resolver(v_r.negocio_id, v_r.sede_id, v_r.staff_id, l.servicio_id, l.categoria, v_fecha);
    if rg.pct is null then
      insert into public.staff_ganancia (negocio_id, sede_id, staff_id, reserva_id, servicio_id, cliente_id, servicio_nombre, categoria, cliente_nombre,
        precio_original, descuento, descuento_motivo, valor_neto, participacion_negocio, estado_comision, origen_regla, prestado_at, fecha_local, actor_origen)
      values (v_r.negocio_id, v_r.sede_id, v_r.staff_id, v_r.id, l.servicio_id, v_r.cliente_id, l.nombre, l.categoria, v_cliente,
        l.precio, v_desc, case when v_desc > 0 then 'Descuento/membresía/promoción de la reserva' end, v_neto, v_neto, 'SIN_REGLA', 'NINGUNA', v_prestado, v_fecha, auth.uid())
      on conflict (reserva_id, servicio_id) do nothing returning id into v_id;
      if v_id is not null then
        perform public._novedad_registrar(v_r.negocio_id, v_r.sede_id, v_r.staff_id, v_r.id, v_id, null, 'SERVICIO_SIN_REGLA', v_id::text,
          'ALTA', 'No hay regla ni comisión base para este profesional: la comisión quedó en cero hasta definirla.', l.precio);
      end if;
    else
      v_base := case rg.base when 'PRECIO_ORIGINAL' then l.precio else v_neto end;
      v_com := least(round(v_base * rg.pct / 100, 2), v_base);
      insert into public.staff_ganancia (negocio_id, sede_id, staff_id, reserva_id, servicio_id, cliente_id, servicio_nombre, categoria, cliente_nombre,
        precio_original, descuento, descuento_motivo, valor_neto, base_tipo, base_comision, pct, comision, participacion_negocio,
        regla_id, regla_version, origen_regla, estado_comision, prestado_at, fecha_local, actor_origen)
      values (v_r.negocio_id, v_r.sede_id, v_r.staff_id, v_r.id, l.servicio_id, v_r.cliente_id, l.nombre, l.categoria, v_cliente,
        l.precio, v_desc, case when v_desc > 0 then 'Descuento/membresía/promoción de la reserva' end, v_neto, rg.base, v_base, rg.pct, v_com, v_neto - v_com,
        rg.regla_id, rg.regla_version, rg.origen, 'PENDIENTE', v_prestado, v_fecha, auth.uid())
      on conflict (reserva_id, servicio_id) do nothing returning id into v_id;
    end if;
    if v_id is not null then
      v_creadas := v_creadas + 1;
      perform public._auditar('staff_ganancia', v_id, 'GANANCIA_GENERADA', v_r.negocio_id, null,
        jsonb_build_object('reserva_id', v_r.id, 'servicio_id', l.servicio_id, 'precio', l.precio, 'descuento', v_desc, 'pct', rg.pct,
                           'origen', coalesce(rg.origen, 'NINGUNA'), 'regla_id', rg.regla_id), null);
    end if;
    v_id := null;
  end loop;
  return v_creadas;
end $$;
revoke all on function public._ganancia_generar(uuid) from public, anon, authenticated;

create or replace function public._trg_reserva_ganancia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 begin
  if new.estado = 'COMPLETADA' and old.estado is distinct from 'COMPLETADA' then
    perform public._ganancia_generar(new.id);
  elsif old.estado = 'COMPLETADA' and new.estado is distinct from 'COMPLETADA' then
    -- Servicio reabierto o cancelado después de generar comisión: nunca se reescribe; se marca y se avisa.
    update public.staff_ganancia set estado_comision = 'EN_REVISION' where reserva_id = new.id and estado_comision = 'PENDIENTE';
    perform public._novedad_registrar(new.negocio_id, new.sede_id, new.staff_id, new.id, null, null, 'SERVICIO_REABIERTO', new.id::text || ':' || new.estado::text,
      'ALTA', 'Un servicio con comisión generada cambió de COMPLETADA a ' || new.estado::text || '. La comisión pendiente quedó en revisión.', new.monto_total);
  end if;
 exception when others then
  -- La comisión nunca debe impedir cobrar o completar un servicio: se deja rastro y «Buscar novedades» lo marca como crítico (SERVICIO_SIN_COMISION).
  perform public._auditar('reserva', new.id, 'GANANCIA_GENERACION_FALLIDA', new.negocio_id, null, jsonb_build_object('error', sqlerrm), null);
 end;
  return null;
end $$;
revoke all on function public._trg_reserva_ganancia() from public, anon, authenticated;
drop trigger if exists trg_reserva_ganancia on public.reserva;
create trigger trg_reserva_ganancia after update of estado on public.reserva
  for each row execute function public._trg_reserva_ganancia();

-- Reembolso después de generar comisión: se avisa (no se mueve dinero automáticamente).
create or replace function public._trg_pago_reembolso_ganancia()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_g record;
begin
 begin
  if new.estado in ('REEMBOLSADO', 'REEMBOLSADO_PARCIAL') and old.estado is distinct from new.estado and new.reserva_id is not null then
    for v_g in select id, negocio_id, sede_id, staff_id, comision from public.staff_ganancia
               where reserva_id = new.reserva_id and estado_comision in ('PENDIENTE', 'LIQUIDADA') and comision > 0 loop
      perform public._novedad_registrar(v_g.negocio_id, v_g.sede_id, v_g.staff_id, new.reserva_id, v_g.id, null, 'REEMBOLSO_SIN_AJUSTE',
        v_g.id::text || ':' || new.id::text, 'ALTA',
        'Se reembolsó un pago de una reserva con comisión generada. Revisa si corresponde un ajuste a la comisión.', v_g.comision);
    end loop;
  end if;
 exception when others then
  perform public._auditar('pago', new.id, 'GANANCIA_NOVEDAD_REEMBOLSO_FALLIDA', new.negocio_id, null, jsonb_build_object('error', sqlerrm), null);
 end;
  return null;
end $$;
revoke all on function public._trg_pago_reembolso_ganancia() from public, anon, authenticated;
drop trigger if exists trg_pago_reembolso_ganancia on public.pago;
create trigger trg_pago_reembolso_ganancia after update of estado on public.pago
  for each row execute function public._trg_pago_reembolso_ganancia();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Reglas: crear (nueva versión), desactivar, previsualizar
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.comision_regla_crear(p_negocio uuid, p_pct numeric, p_base text, p_motivo text,
  p_sede uuid default null, p_staff uuid default null, p_servicio uuid default null, p_categoria text default null,
  p_desde date default null, p_hasta date default null, p_reemplaza uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ver int := 1; v_prev public.comision_regla;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._gan_permiso(p_negocio, null, 'configurar') then raise exception 'NO_AUTORIZADO'; end if;
  if p_sede is not null and not exists (select 1 from public.sede where id = p_sede and negocio_id = p_negocio) then raise exception 'SEDE_INVALIDA'; end if;
  if p_staff is not null and not exists (select 1 from public.vinculo_staff_negocio where staff_id = p_staff and negocio_id = p_negocio and estado <> 'RETIRADO') then raise exception 'PROFESIONAL_INVALIDO'; end if;
  if p_servicio is not null and not exists (select 1 from public.servicio where id = p_servicio and negocio_id = p_negocio) then raise exception 'SERVICIO_INVALIDO'; end if;
  if p_categoria is not null and p_servicio is not null then raise exception 'SERVICIO_O_CATEGORIA'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then raise exception 'PORCENTAJE_INVALIDO'; end if;
  if p_base not in ('PRECIO_ORIGINAL', 'NETO') then raise exception 'BASE_INVALIDA'; end if;

  if p_reemplaza is not null then
    select * into v_prev from public.comision_regla where id = p_reemplaza and negocio_id = p_negocio for update;
    if not found then raise exception 'REGLA_NO_ENCONTRADA'; end if;
    v_ver := v_prev.version + 1;
    update public.comision_regla set estado = 'INACTIVA', desactivado_por = auth.uid(), desactivado_at = now(), desactivado_motivo = 'Reemplazada por versión ' || v_ver
      where id = p_reemplaza and estado = 'ACTIVA';
  end if;
  insert into public.comision_regla (negocio_id, sede_id, staff_id, servicio_id, categoria, pct, base, vigente_desde, vigente_hasta, version, reemplaza_id, motivo, creado_por)
  values (p_negocio, p_sede, p_staff, p_servicio, p_categoria, p_pct, p_base, coalesce(p_desde, current_date), p_hasta, v_ver, p_reemplaza, p_motivo, auth.uid())
  returning id into v_id;
  perform public._auditar('comision_regla', v_id, 'REGLA_COMISION_CREADA', p_negocio, case when p_reemplaza is not null then to_jsonb(v_prev) end,
    jsonb_build_object('pct', p_pct, 'base', p_base, 'staff_id', p_staff, 'servicio_id', p_servicio, 'categoria', p_categoria, 'sede_id', p_sede, 'version', v_ver), p_motivo);
  return v_id;
end $$;

create or replace function public.comision_regla_desactivar(p_regla uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.comision_regla;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v from public.comision_regla where id = p_regla for update;
  if not found then raise exception 'REGLA_NO_ENCONTRADA'; end if;
  if not public._gan_permiso(v.negocio_id, null, 'configurar') then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'MOTIVO_REQUERIDO'; end if;
  update public.comision_regla set estado = 'INACTIVA', desactivado_por = auth.uid(), desactivado_at = now(), desactivado_motivo = p_motivo where id = p_regla and estado = 'ACTIVA';
  perform public._auditar('comision_regla', p_regla, 'REGLA_COMISION_DESACTIVADA', v.negocio_id, to_jsonb(v), null, p_motivo);
end $$;

-- Cuánto recibiría el profesional y cuánto el negocio con un precio dado (sin guardar nada).
create or replace function public.comision_previsualizar(p_negocio uuid, p_precio numeric, p_descuento numeric, p_pct numeric, p_base text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neto numeric; v_base numeric; v_com numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._gan_permiso(p_negocio, null, 'configurar') then raise exception 'NO_AUTORIZADO'; end if;
  if p_precio is null or p_precio < 0 or coalesce(p_descuento, 0) < 0 or p_pct is null or p_pct < 0 or p_pct > 100 or p_base not in ('PRECIO_ORIGINAL', 'NETO') then raise exception 'PARAMETROS_INVALIDOS'; end if;
  v_neto := greatest(p_precio - coalesce(p_descuento, 0), 0);
  v_base := case p_base when 'PRECIO_ORIGINAL' then p_precio else v_neto end;
  v_com := least(round(v_base * p_pct / 100, 2), v_base);
  return jsonb_build_object('valor_neto', v_neto, 'base', v_base, 'comision_profesional', v_com, 'participacion_negocio', v_neto - v_com);
end $$;

-- Permisos financieros (solo el propietario concede o retira).
create or replace function public.ganancia_permiso_definir(p_negocio uuid, p_usuario uuid, p_sede uuid, p_caps jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio) then raise exception 'NO_AUTORIZADO'; end if;
  if p_usuario = (select owner_user_id from public.negocio where id = p_negocio) then raise exception 'PROPIETARIO_YA_TIENE_TODO'; end if;
  if not exists (select 1 from public.vinculo_staff_negocio where staff_id = p_usuario and negocio_id = p_negocio and estado = 'ACTIVO') then raise exception 'USUARIO_NO_ES_DEL_EQUIPO'; end if;
  if p_sede is not null and not exists (select 1 from public.sede where id = p_sede and negocio_id = p_negocio) then raise exception 'SEDE_INVALIDA'; end if;
  insert into public.ganancia_permiso (negocio_id, usuario_id, sede_id, ver, configurar, liquidar, pagar, exportar, novedades, otorgado_por)
  values (p_negocio, p_usuario, p_sede, coalesce((p_caps ->> 'ver')::boolean, false), coalesce((p_caps ->> 'configurar')::boolean, false),
          coalesce((p_caps ->> 'liquidar')::boolean, false), coalesce((p_caps ->> 'pagar')::boolean, false),
          coalesce((p_caps ->> 'exportar')::boolean, false), coalesce((p_caps ->> 'novedades')::boolean, false), auth.uid())
  on conflict (negocio_id, usuario_id, coalesce(sede_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update
    set ver = excluded.ver, configurar = excluded.configurar, liquidar = excluded.liquidar, pagar = excluded.pagar,
        exportar = excluded.exportar, novedades = excluded.novedades, otorgado_por = auth.uid(), updated_at = now()
  returning id into v_id;
  perform public._auditar('ganancia_permiso', v_id, 'PERMISO_GANANCIAS_DEFINIDO', p_negocio, null, p_caps || jsonb_build_object('usuario_id', p_usuario, 'sede_id', p_sede), null);
end $$;

create or replace function public.ganancia_permiso_quitar(p_negocio uuid, p_usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio) then raise exception 'NO_AUTORIZADO'; end if;
  delete from public.ganancia_permiso where negocio_id = p_negocio and usuario_id = p_usuario;
  perform public._auditar('ganancia_permiso', null, 'PERMISO_GANANCIAS_QUITADO', p_negocio, jsonb_build_object('usuario_id', p_usuario), null, null);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Lectura: listado, resumen
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public._gan_estado_cobro(p_reserva uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.pago where reserva_id = p_reserva and tipo in ('SENA', 'SALDO') and estado = 'REEMBOLSADO') then 'REEMBOLSO_TOTAL'
    when exists (select 1 from public.pago where reserva_id = p_reserva and tipo in ('SENA', 'SALDO') and estado = 'REEMBOLSADO_PARCIAL') then 'REEMBOLSO_PARCIAL'
    when exists (select 1 from public.pago where reserva_id = p_reserva and tipo = 'SALDO' and estado = 'APROBADO') then 'PAGADO'
    when coalesce((select sum(monto) from public.pago where reserva_id = p_reserva and tipo in ('SENA', 'SALDO') and estado = 'APROBADO'), 0)
         >= coalesce((select monto_total from public.reserva where id = p_reserva), 0) and
         coalesce((select monto_total from public.reserva where id = p_reserva), 0) > 0 then 'PAGADO'
    when coalesce((select sum(monto_beneficio) from public.membresia_uso where reserva_id = p_reserva), 0)
         >= coalesce((select monto_total from public.reserva where id = p_reserva), 0) then 'CUBIERTO_MEMBRESIA'
    when exists (select 1 from public.pago where reserva_id = p_reserva and tipo in ('SENA', 'SALDO') and estado = 'APROBADO') then 'PARCIAL'
    when exists (select 1 from public.pago where reserva_id = p_reserva and tipo in ('SENA', 'SALDO') and estado = 'PENDIENTE') then 'PENDIENTE'
    else 'SIN_COBRO' end;
$$;
revoke all on function public._gan_estado_cobro(uuid) from public, anon, authenticated;

-- Verifica quién consulta: devuelve 'PROPIETARIO/ADMIN' (puede ver varias filas), 'PROPIO' (solo lo suyo) o 'SOPORTE'.
create or replace function public._gan_modo_lectura(p_negocio uuid, p_staff uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_negocio is null then return 'PROPIO'; end if;
  if public._gan_permiso(p_negocio, null, 'ver') then return 'GESTION'; end if;
  if exists (select 1 from public.ganancia_permiso where negocio_id = p_negocio and usuario_id = auth.uid() and ver) then return 'GESTION_SEDE'; end if;
  if public._gan_soporte_activo(p_negocio) then return 'SOPORTE'; end if;
  return 'PROPIO';
end $$;
revoke all on function public._gan_modo_lectura(uuid, uuid) from public, anon, authenticated;

create or replace function public.ganancias_listar(
  p_negocio uuid default null, p_sede uuid default null, p_staff uuid default null,
  p_desde date default null, p_hasta date default null, p_servicio uuid default null, p_categoria text default null,
  p_estado_comision text default null, p_estado_cobro text default null, p_estado_liquidacion text default null,
  p_busqueda text default null, p_reserva uuid default null, p_limite int default 25, p_desplazamiento int default 0,
  p_orden text default 'fecha_desc')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_modo text := public._gan_modo_lectura(p_negocio, p_staff);
  v_staff uuid := p_staff;
  v_lim int := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_off int := greatest(coalesce(p_desplazamiento, 0), 0);
  v_q text := nullif(btrim(coalesce(p_busqueda, '')), '');
  v_ver_contacto boolean := false;
  v_total bigint;
  v_filas jsonb;
begin
  if v_modo = 'PROPIO' then v_staff := auth.uid(); end if;           -- un profesional NUNCA elige de quién ve (se ignora p_staff)
  v_ver_contacto := v_modo in ('GESTION', 'GESTION_SEDE');
  if v_q is not null and length(v_q) > 80 then raise exception 'BUSQUEDA_DEMASIADO_LARGA'; end if;
  if p_estado_liquidacion is not null and p_estado_liquidacion not in ('SIN_LIQUIDAR', 'LIQUIDADA', 'PAGADA') then raise exception 'FILTRO_INVALIDO'; end if;

  with f as (
    select g.*, public._gan_estado_cobro(g.reserva_id) as cobro
    from public.staff_ganancia g
    left join public.perfil pc on pc.id = g.cliente_id
    left join public.staff st on st.usuario_id = g.staff_id
    where (p_negocio is null or g.negocio_id = p_negocio)
      and (v_staff is null or g.staff_id = v_staff)
      and (p_sede is null or g.sede_id = p_sede)
      and (p_desde is null or g.fecha_local >= p_desde) and (p_hasta is null or g.fecha_local <= p_hasta)
      and (p_servicio is null or g.servicio_id = p_servicio) and (p_categoria is null or g.categoria = p_categoria)
      and (p_estado_comision is null or g.estado_comision = p_estado_comision)
      and (p_reserva is null or g.reserva_id = p_reserva)
      and public._gan_puede_ver(g.negocio_id, g.sede_id, g.staff_id)
      and (p_estado_liquidacion is null or
           (p_estado_liquidacion = 'SIN_LIQUIDAR' and g.estado_comision <> 'LIQUIDADA') or
           (p_estado_liquidacion = 'LIQUIDADA' and g.estado_comision = 'LIQUIDADA') or
           (p_estado_liquidacion = 'PAGADA' and exists (select 1 from public.ganancia_liquidacion_item i join public.ganancia_liquidacion l on l.id = i.liquidacion_id
                                                       where i.ganancia_id = g.id and i.activo and l.estado = 'PAGADA')))
      and (v_q is null or g.servicio_nombre ilike '%' || v_q || '%' or g.cliente_nombre ilike '%' || v_q || '%' or st.nombre ilike '%' || v_q || '%'
           or g.reserva_id::text like v_q || '%' or g.id::text like v_q || '%'
           or (v_ver_contacto and (pc.telefono ilike '%' || v_q || '%' or pc.email ilike '%' || v_q || '%'
                or exists (select 1 from public.pago pg where pg.reserva_id = g.reserva_id and pg.id_transaccion_pasarela = v_q))))
  ), f2 as (select * from f where p_estado_cobro is null or cobro = p_estado_cobro)
  select (select count(*) from f2), coalesce(jsonb_agg(x.fila order by x.ord, x.id), '[]'::jsonb) into v_total, v_filas
  from (
    select g.id, jsonb_build_object(
      'id', g.id, 'fecha', g.fecha_local, 'prestado_at', g.prestado_at, 'reserva_id', g.reserva_id, 'servicio', g.servicio_nombre,
      'categoria', g.categoria, 'cliente', g.cliente_nombre, 'staff_id', g.staff_id, 'profesional', st.nombre, 'sede_id', g.sede_id, 'sede', sd.nombre,
      'precio_original', g.precio_original, 'descuento', g.descuento, 'base_tipo', g.base_tipo, 'base_comision', g.base_comision,
      'pct', g.pct, 'comision', g.comision, 'participacion_negocio', g.participacion_negocio, 'valor_neto', g.valor_neto,
      'origen_regla', g.origen_regla, 'regla_id', g.regla_id, 'regla_version', g.regla_version,
      'estado_comision', g.estado_comision, 'estado_cobro', g.cobro,
      'liquidacion_id', (select i.liquidacion_id from public.ganancia_liquidacion_item i where i.ganancia_id = g.id and i.activo)) as fila,
      case p_orden when 'fecha_asc' then extract(epoch from g.prestado_at) when 'comision_desc' then -g.comision::double precision
                   when 'comision_asc' then g.comision::double precision when 'precio_desc' then -g.precio_original::double precision
                   else -extract(epoch from g.prestado_at) end as ord
    from f2 g left join public.staff st on st.usuario_id = g.staff_id left join public.sede sd on sd.id = g.sede_id
    order by ord, g.id limit v_lim offset v_off
  ) x;

  if v_modo = 'SOPORTE' then
    perform public._auditar('soporte_acceso_ganancias', null, 'SOPORTE_LECTURA_GANANCIAS', p_negocio, null,
      jsonb_build_object('filas', jsonb_array_length(v_filas), 'agente', auth.uid()), null);
  end if;
  return jsonb_build_object('total', v_total, 'limite', v_lim, 'desplazamiento', v_off, 'modo', v_modo, 'filas', v_filas);
end $$;

create or replace function public.ganancias_resumen(p_negocio uuid default null, p_sede uuid default null, p_staff uuid default null,
  p_desde date default null, p_hasta date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_modo text := public._gan_modo_lectura(p_negocio, p_staff);
  v_staff uuid := p_staff;
  v jsonb; v_canc int := 0; v_ajustes numeric := 0; v_pagado numeric := 0; v_saldo numeric := 0;
begin
  if v_modo = 'PROPIO' then v_staff := auth.uid(); end if;
  select jsonb_build_object(
    'servicios', count(*), 'produccion_bruta', coalesce(sum(g.precio_original), 0), 'produccion_neta', coalesce(sum(g.valor_neto), 0),
    'descuentos', coalesce(sum(g.descuento), 0), 'comisiones_generadas', coalesce(sum(g.comision), 0),
    'comisiones_pendientes', coalesce(sum(g.comision) filter (where g.estado_comision = 'PENDIENTE'), 0),
    'comisiones_liquidadas', coalesce(sum(g.comision) filter (where g.estado_comision = 'LIQUIDADA'), 0),
    'en_revision', coalesce(sum(g.comision) filter (where g.estado_comision = 'EN_REVISION'), 0),
    'sin_regla', count(*) filter (where g.estado_comision = 'SIN_REGLA'),
    'participacion_negocio', case when v_modo in ('PROPIO') then null else coalesce(sum(g.participacion_negocio), 0) end,
    'ticket_promedio', coalesce(round(avg(g.valor_neto), 2), 0))
  into v
  from public.staff_ganancia g
  where (p_negocio is null or g.negocio_id = p_negocio) and (v_staff is null or g.staff_id = v_staff) and (p_sede is null or g.sede_id = p_sede)
    and (p_desde is null or g.fecha_local >= p_desde) and (p_hasta is null or g.fecha_local <= p_hasta)
    and public._gan_puede_ver(g.negocio_id, g.sede_id, g.staff_id);

  select coalesce(sum(a.monto), 0) into v_ajustes from public.ganancia_ajuste a
   where (p_negocio is null or a.negocio_id = p_negocio) and (v_staff is null or a.staff_id = v_staff) and (p_sede is null or a.sede_id = p_sede)
     and (p_desde is null or a.created_at::date >= p_desde) and (p_hasta is null or a.created_at::date <= p_hasta)
     and public._gan_puede_ver(a.negocio_id, a.sede_id, a.staff_id);
  select coalesce(sum(p.monto), 0) into v_pagado from public.ganancia_pago p
   where p.estado = 'REGISTRADO' and (p_negocio is null or p.negocio_id = p_negocio) and (v_staff is null or p.staff_id = v_staff)
     and (p_desde is null or p.pagado_el >= p_desde) and (p_hasta is null or p.pagado_el <= p_hasta)
     and (p_sede is null or p.sede_id = p_sede) and public._gan_puede_ver(p.negocio_id, p.sede_id, p.staff_id);
  select coalesce(sum(l.total_neto - l.pagado), 0) into v_saldo from public.ganancia_liquidacion l
   where l.estado in ('CERRADA', 'PAGADA_PARCIAL') and (p_negocio is null or l.negocio_id = p_negocio) and (v_staff is null or l.staff_id = v_staff)
     and (p_sede is null or l.sede_id = p_sede) and public._gan_puede_ver(l.negocio_id, l.sede_id, l.staff_id);

  if v_modo not in ('PROPIO') and p_negocio is not null then
    select count(*) into v_canc from public.reserva r
     where r.negocio_id = p_negocio and r.estado in ('CANCELADA', 'NO_SHOW') and (p_sede is null or r.sede_id = p_sede)
       and (v_staff is null or r.staff_id = v_staff) and (p_desde is null or r.hora_inicio::date >= p_desde) and (p_hasta is null or r.hora_inicio::date <= p_hasta);
  end if;
  if v_modo = 'SOPORTE' then
    perform public._auditar('soporte_acceso_ganancias', null, 'SOPORTE_LECTURA_RESUMEN', p_negocio, null, jsonb_build_object('agente', auth.uid()), null);
  end if;
  return v || jsonb_build_object('ajustes', v_ajustes, 'pagado', v_pagado, 'saldo_por_pagar', v_saldo, 'servicios_cancelados', v_canc, 'modo', v_modo);
end $$;

-- Liquidaciones y pagos del alcance del usuario.
create or replace function public.liquidaciones_listar(p_negocio uuid default null, p_staff uuid default null, p_sede uuid default null,
  p_limite int default 25, p_desplazamiento int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_modo text := public._gan_modo_lectura(p_negocio, p_staff); v_staff uuid := p_staff; v_lim int := least(greatest(coalesce(p_limite, 25), 1), 100);
begin
  if v_modo = 'PROPIO' then v_staff := auth.uid(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.numero desc) from (
    select l.id, l.numero, l.negocio_id, l.sede_id, l.staff_id, l.staff_nombre, l.periodo_tipo, l.desde, l.hasta, l.estado, l.total_comisiones, l.total_ajustes,
           l.total_neto, l.pagado, l.total_neto - l.pagado as saldo, l.servicios, l.produccion, l.cerrada_at
    from public.ganancia_liquidacion l
    where (p_negocio is null or l.negocio_id = p_negocio) and (v_staff is null or l.staff_id = v_staff) and (p_sede is null or l.sede_id = p_sede)
      and public._gan_puede_ver(l.negocio_id, l.sede_id, l.staff_id)
    order by l.numero desc limit v_lim offset greatest(coalesce(p_desplazamiento, 0), 0)) x), '[]'::jsonb);
end $$;

-- Comprobante: encabezado, servicios, ajustes y pagos de UNA liquidación.
create or replace function public.liquidacion_comprobante(p_liquidacion uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.ganancia_liquidacion;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into l from public.ganancia_liquidacion where id = p_liquidacion;
  if not found or not public._gan_puede_ver(l.negocio_id, l.sede_id, l.staff_id) then raise exception 'NO_ENCONTRADA'; end if;
  return jsonb_build_object(
    'liquidacion', to_jsonb(l) - 'creado_por' - 'revertida_por',
    'negocio', (select nombre from public.negocio where id = l.negocio_id),
    'sede', (select nombre from public.sede where id = l.sede_id),
    'cerrada_por', (select nombre from public.perfil where id = l.creado_por),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('fecha', g.fecha_local, 'servicio', g.servicio_nombre, 'precio', g.precio_original,
        'descuento', g.descuento, 'pct', g.pct, 'comision', g.comision) order by g.prestado_at)
        from public.ganancia_liquidacion_item i join public.staff_ganancia g on g.id = i.ganancia_id where i.liquidacion_id = l.id), '[]'::jsonb),
    'ajustes', coalesce((select jsonb_agg(jsonb_build_object('fecha', a.created_at, 'motivo', a.motivo, 'monto', a.monto) order by a.created_at)
        from public.ganancia_liquidacion_item i join public.ganancia_ajuste a on a.id = i.ajuste_id where i.liquidacion_id = l.id), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', p.pagado_el, 'monto', p.monto, 'medio', p.medio, 'referencia', p.referencia, 'estado', p.estado) order by p.created_at)
        from public.ganancia_pago p where p.liquidacion_id = l.id), '[]'::jsonb));
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Liquidar, pagar, ajustar, revertir
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.liquidacion_previsualizar(p_negocio uuid, p_staff uuid, p_sede uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._gan_permiso(p_negocio, p_sede, 'liquidar') then raise exception 'NO_AUTORIZADO'; end if;
  return (select jsonb_build_object(
    'servicios', count(*), 'produccion', coalesce(sum(g.precio_original), 0), 'comisiones', coalesce(sum(g.comision), 0),
    'ajustes_pendientes', coalesce((select sum(a.monto) from public.ganancia_ajuste a where a.negocio_id = p_negocio and a.staff_id = p_staff and a.liquidacion_id is null
        and (p_sede is null or a.sede_id is null or a.sede_id = p_sede)), 0))
    from public.staff_ganancia g
    where g.negocio_id = p_negocio and g.staff_id = p_staff and g.estado_comision = 'PENDIENTE' and g.fecha_local between p_desde and p_hasta
      and (p_sede is null or g.sede_id = p_sede));
end $$;

create or replace function public.liquidacion_cerrar(p_negocio uuid, p_staff uuid, p_sede uuid, p_tipo text, p_desde date, p_hasta date, p_ganancia_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_liq uuid; v_com numeric; v_aj numeric; v_n int; v_prod numeric; v_nombre text; v_ids uuid[]; v_aj_ids uuid[];
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._gan_permiso(p_negocio, p_sede, 'liquidar') then raise exception 'NO_AUTORIZADO'; end if;
  if p_tipo not in ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'PERSONALIZADO') then raise exception 'PERIODO_INVALIDO'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'FECHAS_INVALIDAS'; end if;
  if p_hasta > current_date then raise exception 'PERIODO_FUTURO'; end if;
  if not exists (select 1 from public.vinculo_staff_negocio where staff_id = p_staff and negocio_id = p_negocio) then raise exception 'PROFESIONAL_INVALIDO'; end if;
  if p_sede is not null and not exists (select 1 from public.sede where id = p_sede and negocio_id = p_negocio) then raise exception 'SEDE_INVALIDA'; end if;

  -- Bloquea y toma las filas elegibles: un segundo intento simultáneo o repetido no encontrará nada.
  select array_agg(id), coalesce(sum(comision), 0), count(*), coalesce(sum(precio_original), 0) into v_ids, v_com, v_n, v_prod from (
    select g.id, g.comision, g.precio_original from public.staff_ganancia g
    where g.negocio_id = p_negocio and g.staff_id = p_staff and g.estado_comision = 'PENDIENTE' and g.fecha_local between p_desde and p_hasta
      and (p_sede is null or g.sede_id = p_sede) and (p_ganancia_ids is null or g.id = any(p_ganancia_ids))
      and not exists (select 1 from public.ganancia_liquidacion_item i where i.ganancia_id = g.id and i.activo)
    for update) s;
  if coalesce(v_n, 0) = 0 then raise exception 'SIN_REGISTROS_PENDIENTES'; end if;
  if p_ganancia_ids is not null and v_n <> (select count(distinct x) from unnest(p_ganancia_ids) x) then raise exception 'REGISTROS_NO_ELEGIBLES'; end if;

  select array_agg(id), coalesce(sum(monto), 0) into v_aj_ids, v_aj from (
    select a.id, a.monto from public.ganancia_ajuste a where a.negocio_id = p_negocio and a.staff_id = p_staff and a.liquidacion_id is null
      and (p_sede is null or a.sede_id is null or a.sede_id = p_sede) for update) s;
  if v_com + v_aj <= 0 then raise exception 'SALDO_NO_POSITIVO'; end if;

  select nombre into v_nombre from public.staff where usuario_id = p_staff;
  insert into public.ganancia_liquidacion (negocio_id, sede_id, staff_id, staff_nombre, periodo_tipo, desde, hasta, total_comisiones, total_ajustes, total_neto, servicios, produccion, creado_por)
  values (p_negocio, p_sede, p_staff, v_nombre, p_tipo, p_desde, p_hasta, v_com, v_aj, v_com + v_aj, v_n, v_prod, auth.uid()) returning id into v_liq;
  insert into public.ganancia_liquidacion_item (liquidacion_id, ganancia_id, monto)
    select v_liq, g.id, g.comision from public.staff_ganancia g where g.id = any(v_ids);
  if v_aj_ids is not null then
    insert into public.ganancia_liquidacion_item (liquidacion_id, ajuste_id, monto) select v_liq, a.id, a.monto from public.ganancia_ajuste a where a.id = any(v_aj_ids);
    update public.ganancia_ajuste set liquidacion_id = v_liq where id = any(v_aj_ids);
  end if;
  update public.staff_ganancia set estado_comision = 'LIQUIDADA' where id = any(v_ids);
  perform public._auditar('ganancia_liquidacion', v_liq, 'LIQUIDACION_CERRADA', p_negocio, null,
    jsonb_build_object('staff_id', p_staff, 'sede_id', p_sede, 'desde', p_desde, 'hasta', p_hasta, 'servicios', v_n, 'comisiones', v_com, 'ajustes', v_aj), null);
  return v_liq;
end $$;

create or replace function public.liquidacion_registrar_pago(p_liquidacion uuid, p_monto numeric, p_medio text, p_referencia text default null,
  p_observacion text default null, p_evidencia_path text default null, p_fecha date default null, p_clave text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.ganancia_liquidacion; v_id uuid; v_pagado numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into l from public.ganancia_liquidacion where id = p_liquidacion for update;
  if not found then raise exception 'LIQUIDACION_NO_ENCONTRADA'; end if;
  if not public._gan_permiso(l.negocio_id, l.sede_id, 'pagar') then raise exception 'NO_AUTORIZADO'; end if;
  if l.estado not in ('CERRADA', 'PAGADA_PARCIAL') then raise exception 'LIQUIDACION_NO_PAGABLE'; end if;
  if p_clave is not null then
    select id into v_id from public.ganancia_pago where liquidacion_id = p_liquidacion and clave_idempotencia = p_clave;
    if found then return v_id; end if;           -- reintento / doble clic: devuelve el pago ya registrado
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > l.total_neto - l.pagado then raise exception 'MONTO_INVALIDO'; end if;
  if p_medio not in ('EFECTIVO', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'OTRO') then raise exception 'MEDIO_INVALIDO'; end if;
  if p_fecha is not null and p_fecha > current_date then raise exception 'FECHA_FUTURA'; end if;
  if p_evidencia_path is not null and p_evidencia_path not like l.negocio_id::text || '/%' then raise exception 'EVIDENCIA_INVALIDA'; end if;
  insert into public.ganancia_pago (liquidacion_id, negocio_id, sede_id, staff_id, monto, medio, referencia, observacion, evidencia_path, pagado_el, clave_idempotencia, registrado_por)
  values (p_liquidacion, l.negocio_id, l.sede_id, l.staff_id, p_monto, p_medio, left(p_referencia, 120), left(p_observacion, 500), p_evidencia_path, coalesce(p_fecha, current_date), p_clave, auth.uid())
  returning id into v_id;
  v_pagado := l.pagado + p_monto;
  update public.ganancia_liquidacion set pagado = v_pagado, estado = case when v_pagado >= total_neto then 'PAGADA' else 'PAGADA_PARCIAL' end where id = p_liquidacion;
  perform public._auditar('ganancia_pago', v_id, 'PAGO_LIQUIDACION_REGISTRADO', l.negocio_id, null,
    jsonb_build_object('liquidacion_id', p_liquidacion, 'monto', p_monto, 'medio', p_medio, 'staff_id', l.staff_id), null);
  return v_id;
end $$;

create or replace function public.ganancia_pago_anular(p_pago uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.ganancia_pago; l public.ganancia_liquidacion; v_pagado numeric;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into p from public.ganancia_pago where id = p_pago for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  select * into l from public.ganancia_liquidacion where id = p.liquidacion_id for update;
  if not public._gan_permiso(p.negocio_id, l.sede_id, 'pagar') then raise exception 'NO_AUTORIZADO'; end if;
  if p.estado <> 'REGISTRADO' then raise exception 'PAGO_YA_ANULADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  update public.ganancia_pago set estado = 'ANULADO', anulado_por = auth.uid(), anulado_at = now(), anulado_motivo = p_motivo where id = p_pago;
  v_pagado := l.pagado - p.monto;
  update public.ganancia_liquidacion set pagado = v_pagado,
    estado = case when l.estado = 'REVERTIDA' then l.estado when v_pagado <= 0 then 'CERRADA' when v_pagado >= total_neto then 'PAGADA' else 'PAGADA_PARCIAL' end
    where id = l.id;
  perform public._auditar('ganancia_pago', p_pago, 'PAGO_LIQUIDACION_ANULADO', p.negocio_id, to_jsonb(p), null, p_motivo);
end $$;

create or replace function public.liquidacion_revertir(p_liquidacion uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.ganancia_liquidacion;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into l from public.ganancia_liquidacion where id = p_liquidacion for update;
  if not found then raise exception 'LIQUIDACION_NO_ENCONTRADA'; end if;
  if not public._gan_permiso(l.negocio_id, l.sede_id, 'liquidar') then raise exception 'NO_AUTORIZADO'; end if;
  if l.estado = 'REVERTIDA' then return; end if;
  if l.pagado > 0 then raise exception 'ANULA_LOS_PAGOS_PRIMERO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  update public.ganancia_liquidacion set estado = 'REVERTIDA', revertida_por = auth.uid(), revertida_at = now(), revertida_motivo = p_motivo where id = l.id;
  update public.staff_ganancia set estado_comision = 'PENDIENTE'
    where id in (select ganancia_id from public.ganancia_liquidacion_item where liquidacion_id = l.id and ganancia_id is not null) and estado_comision = 'LIQUIDADA';
  update public.ganancia_ajuste set liquidacion_id = null
    where id in (select ajuste_id from public.ganancia_liquidacion_item where liquidacion_id = l.id and ajuste_id is not null);
  update public.ganancia_liquidacion_item set activo = false where liquidacion_id = l.id;
  perform public._auditar('ganancia_liquidacion', l.id, 'LIQUIDACION_REVERTIDA', l.negocio_id, to_jsonb(l), null, p_motivo);
end $$;

create or replace function public.ganancia_ajustar(p_negocio uuid, p_staff uuid, p_monto numeric, p_motivo text, p_ganancia uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sede uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_ganancia is not null then
    select sede_id into v_sede from public.staff_ganancia where id = p_ganancia and negocio_id = p_negocio and staff_id = p_staff;
    if not found then raise exception 'GANANCIA_NO_ENCONTRADA'; end if;
  end if;
  if not public._gan_permiso(p_negocio, v_sede, 'liquidar') then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.vinculo_staff_negocio where staff_id = p_staff and negocio_id = p_negocio) then raise exception 'PROFESIONAL_INVALIDO'; end if;
  if p_monto is null or p_monto = 0 or abs(p_monto) > 100000000 then raise exception 'MONTO_INVALIDO'; end if;
  insert into public.ganancia_ajuste (negocio_id, sede_id, staff_id, ganancia_id, monto, motivo, creado_por)
  values (p_negocio, v_sede, p_staff, p_ganancia, p_monto, p_motivo, auth.uid()) returning id into v_id;
  perform public._auditar('ganancia_ajuste', v_id, 'COMISION_AJUSTADA', p_negocio, null, jsonb_build_object('staff_id', p_staff, 'monto', p_monto, 'ganancia_id', p_ganancia), p_motivo);
  return v_id;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Novedades
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.ganancias_detectar_novedades(p_negocio uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_antes bigint; v_despues bigint;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public._gan_permiso(p_negocio, null, 'novedades') then raise exception 'NO_AUTORIZADO'; end if;
  select count(*) into v_antes from public.ganancia_novedad where negocio_id = p_negocio;

  -- Servicios completados (últimos 120 días) sin registro financiero.
  for r in select re.id, re.sede_id, re.staff_id, re.monto_total from public.reserva re
           where re.negocio_id = p_negocio and re.estado = 'COMPLETADA' and re.updated_at > now() - interval '120 days'
             and not exists (select 1 from public.staff_ganancia g where g.reserva_id = re.id) loop
    perform public._novedad_registrar(p_negocio, r.sede_id, r.staff_id, r.id, null, null, 'SERVICIO_SIN_COMISION', r.id::text, 'CRITICA',
      'Servicio completado sin registro de comisión.', r.monto_total);
  end loop;
  -- Servicio sin sede.
  for r in select re.id, re.staff_id, re.monto_total from public.reserva re
           where re.negocio_id = p_negocio and re.estado = 'COMPLETADA' and re.sede_id is null and re.updated_at > now() - interval '120 days' loop
    perform public._novedad_registrar(p_negocio, null, r.staff_id, r.id, null, null, 'SERVICIO_SIN_SEDE', r.id::text, 'ALTA', 'Servicio completado sin sede.', r.monto_total);
  end loop;
  -- Profesional que ya no está activo con comisión pendiente.
  for r in select g.id, g.sede_id, g.staff_id, g.reserva_id, g.comision from public.staff_ganancia g
           join public.vinculo_staff_negocio v on v.staff_id = g.staff_id and v.negocio_id = g.negocio_id
           where g.negocio_id = p_negocio and g.estado_comision = 'PENDIENTE' and v.estado in ('RETIRADO', 'SUSPENDIDO') loop
    perform public._novedad_registrar(p_negocio, r.sede_id, r.staff_id, r.reserva_id, r.id, null, 'PROFESIONAL_INACTIVO_CON_PENDIENTE', r.id::text, 'MEDIA',
      'Hay comisión pendiente de un profesional retirado o suspendido.', r.comision);
  end loop;
  -- Liquidaciones con saldo pendiente hace más de 30 días.
  for r in select l.id, l.sede_id, l.staff_id, l.total_neto - l.pagado as saldo from public.ganancia_liquidacion l
           where l.negocio_id = p_negocio and l.estado in ('CERRADA', 'PAGADA_PARCIAL') and l.cerrada_at < now() - interval '30 days' loop
    perform public._novedad_registrar(p_negocio, r.sede_id, r.staff_id, null, null, r.id, 'LIQUIDACION_SIN_PAGAR', r.id::text, 'MEDIA',
      'Liquidación con saldo pendiente de pago hace más de 30 días.', r.saldo);
  end loop;
  -- Diferencia entre la suma de servicios y el total de la reserva sin descuento explicable.
  for r in select re.id, re.sede_id, re.staff_id, sum(rs.precio_congelado_unitario) as suma, re.monto_total from public.reserva re
           join public.reserva_servicio rs on rs.reserva_id = re.id
           where re.negocio_id = p_negocio and re.estado = 'COMPLETADA' and re.updated_at > now() - interval '120 days'
           group by re.id having re.monto_total > sum(rs.precio_congelado_unitario) + 0.01 loop
    perform public._novedad_registrar(p_negocio, r.sede_id, r.staff_id, r.id, null, null, 'TOTAL_MAYOR_QUE_SERVICIOS', r.id::text, 'BAJA',
      'El total de la reserva es mayor que la suma de sus servicios.', r.monto_total - r.suma);
  end loop;

  select count(*) into v_despues from public.ganancia_novedad where negocio_id = p_negocio;
  return (v_despues - v_antes)::int;
end $$;

create or replace function public.ganancia_novedad_gestionar(p_novedad uuid, p_estado text, p_resolucion text default null, p_asignado uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare n public.ganancia_novedad;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into n from public.ganancia_novedad where id = p_novedad for update;
  if not found then raise exception 'NOVEDAD_NO_ENCONTRADA'; end if;
  if not public._gan_permiso(n.negocio_id, n.sede_id, 'novedades') then raise exception 'NO_AUTORIZADO'; end if;
  if p_estado not in ('PENDIENTE', 'EN_REVISION', 'RESUELTA', 'DESCARTADA') then raise exception 'ESTADO_INVALIDO'; end if;
  if p_estado in ('RESUELTA', 'DESCARTADA') and length(btrim(coalesce(p_resolucion, ''))) < 10 then raise exception 'JUSTIFICACION_REQUERIDA'; end if;
  if p_asignado is not null and not public._gan_permiso(n.negocio_id, n.sede_id, 'novedades') then raise exception 'ASIGNADO_INVALIDO'; end if;
  update public.ganancia_novedad set estado = p_estado, resolucion = coalesce(p_resolucion, resolucion), asignado_a = coalesce(p_asignado, asignado_a),
    resuelto_por = case when p_estado in ('RESUELTA', 'DESCARTADA') then auth.uid() else resuelto_por end,
    resuelto_at = case when p_estado in ('RESUELTA', 'DESCARTADA') then now() else resuelto_at end where id = p_novedad;
  perform public._auditar('ganancia_novedad', p_novedad, 'NOVEDAD_' || p_estado, n.negocio_id, jsonb_build_object('estado', n.estado), jsonb_build_object('estado', p_estado), p_resolucion);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Solicitudes de revisión (el profesional pide; nada cambia solo)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.revision_solicitar(p_tipo text, p_objeto uuid, p_motivo text, p_evidencia_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_neg uuid; v_sede uuid; v_staff uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_tipo = 'GANANCIA' then select negocio_id, sede_id, staff_id into v_neg, v_sede, v_staff from public.staff_ganancia where id = p_objeto;
  elsif p_tipo = 'LIQUIDACION' then select negocio_id, sede_id, staff_id into v_neg, v_sede, v_staff from public.ganancia_liquidacion where id = p_objeto;
  elsif p_tipo = 'PAGO' then select negocio_id, null, staff_id into v_neg, v_sede, v_staff from public.ganancia_pago where id = p_objeto;
  elsif p_tipo = 'AJUSTE' then select negocio_id, sede_id, staff_id into v_neg, v_sede, v_staff from public.ganancia_ajuste where id = p_objeto;
  else raise exception 'TIPO_INVALIDO'; end if;
  if v_staff is distinct from auth.uid() then raise exception 'NO_ENCONTRADO'; end if;       -- solo sobre lo propio; no revela existencia ajena
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if exists (select 1 from public.ganancia_revision where objeto_tipo = p_tipo and objeto_id = p_objeto and staff_id = auth.uid() and estado in ('SOLICITADA', 'EN_REVISION', 'EVIDENCIA_SOLICITADA')) then raise exception 'YA_HAY_UNA_SOLICITUD_ABIERTA'; end if;
  if p_evidencia_path is not null and p_evidencia_path not like v_neg::text || '/%' then raise exception 'EVIDENCIA_INVALIDA'; end if;
  insert into public.ganancia_revision (negocio_id, sede_id, staff_id, objeto_tipo, objeto_id, motivo, evidencia_path)
  values (v_neg, v_sede, auth.uid(), p_tipo, p_objeto, p_motivo, p_evidencia_path) returning id into v_id;
  perform public._auditar('ganancia_revision', v_id, 'REVISION_SOLICITADA', v_neg, null, jsonb_build_object('objeto_tipo', p_tipo, 'objeto_id', p_objeto), p_motivo);
  return v_id;
end $$;

create or replace function public.revision_responder(p_revision uuid, p_estado text, p_respuesta text)
returns void language plpgsql security definer set search_path = public as $$
declare rv public.ganancia_revision;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into rv from public.ganancia_revision where id = p_revision for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  if not public._gan_permiso(rv.negocio_id, rv.sede_id, 'novedades') then raise exception 'NO_AUTORIZADO'; end if;
  if p_estado not in ('EN_REVISION', 'EVIDENCIA_SOLICITADA', 'APROBADA', 'RECHAZADA') then raise exception 'ESTADO_INVALIDO'; end if;
  if length(btrim(coalesce(p_respuesta, ''))) < 5 then raise exception 'RESPUESTA_REQUERIDA'; end if;
  update public.ganancia_revision set estado = p_estado, respuesta = p_respuesta, decidido_por = auth.uid(), decidido_at = now() where id = p_revision;
  perform public._auditar('ganancia_revision', p_revision, 'REVISION_' || p_estado, rv.negocio_id, jsonb_build_object('estado', rv.estado), jsonb_build_object('estado', p_estado), p_respuesta);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. Acceso de soporte: solicitud → autorización del propietario → toma por un agente → expira
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.soporte_ganancias_solicitar(p_negocio uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio) then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if exists (select 1 from public.soporte_acceso_ganancias where negocio_id = p_negocio and estado in ('SOLICITADO', 'AUTORIZADO') and (expira_at is null or expira_at > now())) then raise exception 'YA_HAY_UNA_SOLICITUD_VIGENTE'; end if;
  insert into public.soporte_acceso_ganancias (negocio_id, solicitado_por, motivo) values (p_negocio, auth.uid(), p_motivo) returning id into v_id;
  perform public._auditar('soporte_acceso_ganancias', v_id, 'SOPORTE_GANANCIAS_SOLICITADO', p_negocio, null, null, p_motivo);
  return v_id;
end $$;

create or replace function public.soporte_ganancias_autorizar(p_acceso uuid, p_duracion_min int)
returns void language plpgsql security definer set search_path = public as $$
declare s public.soporte_acceso_ganancias;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into s from public.soporte_acceso_ganancias where id = p_acceso for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  if not public.is_barberia_de(s.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if s.estado <> 'SOLICITADO' then raise exception 'ESTADO_INVALIDO'; end if;
  if p_duracion_min is null or p_duracion_min < 5 or p_duracion_min > 240 then raise exception 'DURACION_INVALIDA'; end if;
  update public.soporte_acceso_ganancias set estado = 'AUTORIZADO', duracion_min = p_duracion_min, autorizado_por = auth.uid(), autorizado_at = now(),
    expira_at = now() + make_interval(mins => p_duracion_min) where id = p_acceso;
  perform public._auditar('soporte_acceso_ganancias', p_acceso, 'SOPORTE_GANANCIAS_AUTORIZADO', s.negocio_id, null, jsonb_build_object('duracion_min', p_duracion_min), null);
end $$;

create or replace function public.soporte_ganancias_tomar(p_acceso uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare s public.soporte_acceso_ganancias;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into s from public.soporte_acceso_ganancias where id = p_acceso for update;
  if not found or s.estado <> 'AUTORIZADO' or s.expira_at <= now() or s.revocado_at is not null then raise exception 'ACCESO_NO_VIGENTE'; end if;
  if s.agente_id is not null and s.agente_id <> auth.uid() then raise exception 'ACCESO_YA_TOMADO'; end if;
  if s.agente_id is null then
    update public.soporte_acceso_ganancias set agente_id = auth.uid(), iniciado_at = now() where id = p_acceso;
    perform public._auditar('soporte_acceso_ganancias', p_acceso, 'SOPORTE_GANANCIAS_INICIADO', s.negocio_id, null, jsonb_build_object('agente', auth.uid()), null);
  end if;
  return s.expira_at;
end $$;

create or replace function public.soporte_ganancias_revocar(p_acceso uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.soporte_acceso_ganancias;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into s from public.soporte_acceso_ganancias where id = p_acceso for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  if not (public.is_barberia_de(s.negocio_id) or s.agente_id = auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  if s.estado in ('REVOCADO', 'EXPIRADO', 'RECHAZADO') then return; end if;
  update public.soporte_acceso_ganancias set estado = case when s.estado = 'SOLICITADO' then 'RECHAZADO' else 'REVOCADO' end, revocado_por = auth.uid(), revocado_at = now() where id = p_acceso;
  perform public._auditar('soporte_acceso_ganancias', p_acceso, 'SOPORTE_GANANCIAS_CERRADO', s.negocio_id, null, null, p_motivo);
end $$;

-- Cierra por expiración lo vencido (también se llama al listar; la validación real es expira_at > now()).
create or replace function public.soporte_ganancias_expirar()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with u as (update public.soporte_acceso_ganancias set estado = 'EXPIRADO'
             where estado = 'AUTORIZADO' and expira_at <= now() and revocado_at is null returning id, negocio_id)
  select count(*) into v_n from u;
  return v_n;
end $$;
revoke all on function public.soporte_ganancias_expirar() from public, anon, authenticated;

-- Exportaciones: la descarga la arma el servidor con ganancias_listar (mismos permisos); aquí queda el rastro.
create or replace function public.ganancia_exportacion_registrar(p_negocio uuid, p_formato text, p_filtros jsonb, p_filas int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (public._gan_permiso(p_negocio, null, 'exportar') or (p_negocio is null)) then raise exception 'NO_AUTORIZADO'; end if;
  if p_formato not in ('CSV', 'XLSX', 'PDF') then raise exception 'FORMATO_INVALIDO'; end if;
  perform public._auditar('staff_ganancia', null, 'GANANCIAS_EXPORTADAS', p_negocio, null, jsonb_build_object('formato', p_formato, 'filas', p_filas, 'filtros', p_filtros), null);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. Permisos de ejecución: solo las funciones de uso del panel; nada interno
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'comision_regla_crear(uuid,numeric,text,text,uuid,uuid,uuid,text,date,date,uuid)', 'comision_regla_desactivar(uuid,text)',
    'comision_previsualizar(uuid,numeric,numeric,numeric,text)', 'ganancia_permiso_definir(uuid,uuid,uuid,jsonb)', 'ganancia_permiso_quitar(uuid,uuid)',
    'ganancias_listar(uuid,uuid,uuid,date,date,uuid,text,text,text,text,text,uuid,integer,integer,text)',
    'ganancias_resumen(uuid,uuid,uuid,date,date)', 'liquidaciones_listar(uuid,uuid,uuid,integer,integer)', 'liquidacion_comprobante(uuid)',
    'liquidacion_previsualizar(uuid,uuid,uuid,date,date)', 'liquidacion_cerrar(uuid,uuid,uuid,text,date,date,uuid[])',
    'liquidacion_registrar_pago(uuid,numeric,text,text,text,text,date,text)', 'ganancia_pago_anular(uuid,text)', 'liquidacion_revertir(uuid,text)',
    'ganancia_ajustar(uuid,uuid,numeric,text,uuid)', 'ganancias_detectar_novedades(uuid)', 'ganancia_novedad_gestionar(uuid,text,text,uuid)',
    'revision_solicitar(text,uuid,text,text)', 'revision_responder(uuid,text,text)',
    'soporte_ganancias_solicitar(uuid,text)', 'soporte_ganancias_autorizar(uuid,integer)', 'soporte_ganancias_tomar(uuid)',
    'soporte_ganancias_revocar(uuid,text)', 'ganancia_exportacion_registrar(uuid,text,jsonb,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Capacidades del usuario actual en un negocio (para decidir qué pestañas mostrar; la autoridad sigue siendo cada función).
create or replace function public.ganancia_mis_capacidades(p_negocio uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'propietario', coalesce(public.is_barberia_de(p_negocio), false),
    'ver', public._gan_permiso(p_negocio, null, 'ver'),
    'ver_sede', exists (select 1 from public.ganancia_permiso where negocio_id = p_negocio and usuario_id = auth.uid() and ver),
    'configurar', public._gan_permiso(p_negocio, null, 'configurar'),
    'liquidar', public._gan_permiso(p_negocio, null, 'liquidar') or exists (select 1 from public.ganancia_permiso where negocio_id = p_negocio and usuario_id = auth.uid() and liquidar),
    'pagar', public._gan_permiso(p_negocio, null, 'pagar') or exists (select 1 from public.ganancia_permiso where negocio_id = p_negocio and usuario_id = auth.uid() and pagar),
    'exportar', public._gan_permiso(p_negocio, null, 'exportar'),
    'novedades', public._gan_permiso(p_negocio, null, 'novedades'));
$$;
revoke all on function public.ganancia_mis_capacidades(uuid) from public, anon, authenticated;
grant execute on function public.ganancia_mis_capacidades(uuid) to authenticated;

-- Accesos autorizados por propietarios, vigentes y disponibles para el agente (solo SuperSU). No expone datos financieros.
create or replace function public.soporte_ganancias_disponibles()
returns table (id uuid, negocio_id uuid, negocio_nombre text, motivo text, autorizado_at timestamptz, expira_at timestamptz, tomado_por_mi boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query
    select s.id, s.negocio_id, n.nombre, s.motivo, s.autorizado_at, s.expira_at, (s.agente_id = auth.uid())
    from public.soporte_acceso_ganancias s join public.negocio n on n.id = s.negocio_id
    where s.estado = 'AUTORIZADO' and s.revocado_at is null and s.expira_at > now() and (s.agente_id is null or s.agente_id = auth.uid())
    order by s.autorizado_at;
end $$;
revoke all on function public.soporte_ganancias_disponibles() from public, anon, authenticated;
grant execute on function public.soporte_ganancias_disponibles() to authenticated;
