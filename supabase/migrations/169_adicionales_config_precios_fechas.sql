-- 169: Barberos adicionales (FASE 2A) — configuración global, precio por plan y función central de fechas.
--
-- Decisiones comerciales (vinculantes): adicionales en TODOS los planes; precio inicial 51.900 COP/mes por adicional, igual para los
-- cuatro planes pero editable POR PLAN desde SuperAdmin; límite por establecimiento 50 (configurable); máximo por lote configurable
-- (50 = PROPUESTA, pendiente de confirmar); periodo de 30 días desde el pago confirmado; gracia de 3 días; avisos 7/3/1 días.
-- Nada de esto vive en el código: todo está en estas tablas y se edita con auditoría (RPC de la 176).
--
-- Fechas: UNA sola función (adicional_fin_periodo / adicional_dias_para) en zona America/Bogota. Ni la interfaz ni el servidor
-- calculan vencimientos: los leen de la base.
-- Rollback: 169_adicionales_config_precios_fechas_REVERSION.sql.txt.

create table if not exists public.adicional_config (
  id boolean primary key default true check (id),                 -- singleton
  habilitado boolean not null default true,
  max_por_negocio int not null default 50 check (max_por_negocio between 1 and 1000),
  max_por_lote int not null default 50 check (max_por_lote between 1 and 1000),          -- PROPUESTA (50), pendiente de confirmar
  periodo_dias int not null default 30 check (periodo_dias between 1 and 366),
  gracia_dias int not null default 3 check (gracia_dias between 0 and 60),
  avisos_dias_antes int[] not null default '{7,3,1}'
    check (cardinality(avisos_dias_antes) between 0 and 6 and avisos_dias_antes <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,25,30]),
  checkout_expira_horas int not null default 24 check (checkout_expira_horas between 1 and 720),
  pago_pendiente_expira_dias int not null default 7 check (pago_pendiente_expira_dias between 1 and 30),
  activacion_manual_max_dias int not null default 366 check (activacion_manual_max_dias between 1 and 3660),
  zona_horaria text not null default 'America/Bogota',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.adicional_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.adicional_precio_plan (
  pais_codigo char(2) not null references public.pais(codigo),
  plan_codigo public.plan_codigo not null,
  precio_mensual numeric(12,2) not null check (precio_mensual > 0),
  moneda text not null default 'COP',
  activo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (pais_codigo, plan_codigo)
);
-- Sembrado: 51.900 COP para los cuatro planes en Colombia. US/MX/ES sin precio = no contratable hasta que SuperAdmin lo defina.
insert into public.adicional_precio_plan (pais_codigo, plan_codigo, precio_mensual, moneda)
select 'CO', p.codigo, 51900, 'COP' from public.plan p
on conflict (pais_codigo, plan_codigo) do nothing;

alter table public.adicional_config enable row level security;
alter table public.adicional_precio_plan enable row level security;
revoke all on public.adicional_config, public.adicional_precio_plan from public, anon, authenticated;
-- Lectura y escritura solo por RPC (security definer). Sin políticas = sin acceso directo para los roles de la API.

drop trigger if exists trg_auditar_adicional_config on public.adicional_config;
create trigger trg_auditar_adicional_config after insert or update or delete on public.adicional_config
  for each row execute function public._trg_auditar_cambio('adicional_config', '-', '*', '-');
drop trigger if exists trg_auditar_adicional_precio on public.adicional_precio_plan;
create trigger trg_auditar_adicional_precio after insert or update or delete on public.adicional_precio_plan
  for each row execute function public._trg_auditar_cambio('adicional_precio_plan', '-', '*', '-');

-- ── Función central de fechas (America/Bogota) ──────────────────────────────────────────────
-- Vencimiento = instante de inicio + periodo_dias días de calendario en hora de Bogotá (Colombia no tiene horario de verano:
-- coincide con +N×24 h, pero la intención queda explícita y no depende de la zona del servidor).
create or replace function public.adicional_fin_periodo(p_inicio timestamptz, p_dias int default null)
returns timestamptz language sql stable security definer set search_path = public as $$
  select ((p_inicio at time zone c.zona_horaria) + make_interval(days => coalesce(p_dias, c.periodo_dias))) at time zone c.zona_horaria
  from public.adicional_config c where c.id;
$$;
revoke all on function public.adicional_fin_periodo(timestamptz, int) from public, anon, authenticated;
grant execute on function public.adicional_fin_periodo(timestamptz, int) to authenticated, service_role;

create or replace function public.adicional_fecha_bogota(p_instante timestamptz)
returns date language sql stable security definer set search_path = public as $$
  select (p_instante at time zone c.zona_horaria)::date from public.adicional_config c where c.id;
$$;
revoke all on function public.adicional_fecha_bogota(timestamptz) from public, anon, authenticated;
grant execute on function public.adicional_fecha_bogota(timestamptz) to authenticated, service_role;

-- Días de calendario (hora de Bogotá) entre `p_desde` y `p_hasta`: negativo si ya pasó.
create or replace function public.adicional_dias_para(p_hasta timestamptz, p_desde timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select (public.adicional_fecha_bogota(p_hasta) - public.adicional_fecha_bogota(p_desde))::int;
$$;
revoke all on function public.adicional_dias_para(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.adicional_dias_para(timestamptz, timestamptz) to authenticated, service_role;

-- Índices de claves foráneas (regla de rendimiento de la migración 131: toda FK con índice).
create index if not exists adicional_config_updated_by_idx on public.adicional_config (updated_by);
create index if not exists adicional_precio_plan_updated_by_idx on public.adicional_precio_plan (updated_by);
