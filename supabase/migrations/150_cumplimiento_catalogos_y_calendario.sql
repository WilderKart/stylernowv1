-- 150 · Centro de Cumplimiento y PQRS — Grupo A/C: catálogo de tipos de caso, catálogo de plazos (versionado y con estado de
--       verificación jurídica) y calendario de días hábiles de Colombia.
--
-- Reglas de diseño
--  * Los plazos NO están en el código: viven en `caso_plazo_regla` y los edita el SuperAdmin (por RPC auditada, migración 151).
--  * Cada regla declara su `estado_verificacion`. Solo VERIFICADO_LEGALMENTE se presenta como obligación legal. Lo demás se
--    muestra como «provisional» o «plazo interno» (el sistema nunca lo vende como ley).
--  * Verificados literalmente el 2026-11-17 (Función Pública, Gestor Normativo): Ley 1581/2012 art. 14 (consulta: 10 días hábiles,
--    +5) y art. 15 (reclamo: 15 días hábiles, +8; subsanación a los 5 días; desistimiento a los 2 meses; «reclamo en trámite»
--    en 2 días hábiles; traslado en 2 días hábiles). Todo lo demás queda pendiente de verificación.
--  * Festivos: se calculan con la regla vigente (Ley 51 de 1983 / Ley Emiliani + Semana Santa por cómputo de Pascua) y se guardan
--    en una tabla editable. NO están verificados contra el calendario oficial del año: `verificado = false` hasta que alguien
--    los confirme (decreto/calendario oficial).
--  * Reversión: drop table caso_plazo_regla, caso_tipo, festivo_co cascade; drop function de este archivo (nada más depende de ellos
--    hasta la migración 151).

-- ── Tipos de caso ──────────────────────────────────────────────────────────
create table if not exists public.caso_tipo (
  codigo text primary key check (codigo ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  categoria text not null check (categoria in ('DATOS_PERSONALES', 'CONSUMIDOR', 'PQRS', 'SEGURIDAD', 'LEGAL', 'OPERATIVO')),
  nombre text not null check (length(nombre) between 3 and 120),
  descripcion text,
  publico boolean not null default true,                -- ¿se puede radicar sin cuenta desde el formulario público?
  requiere_identificacion boolean not null default false, -- ¿pide documento de identidad? (minimización: solo si hace falta)
  es_critico boolean not null default false,            -- prioridad CRÍTICA y alerta inmediata
  prioridad_base text not null default 'NORMAL' check (prioridad_base in ('CRITICA', 'ALTA', 'NORMAL', 'BAJA')),
  sla_interno_dias_habiles integer check (sla_interno_dias_habiles between 1 and 90),
  sla_interno_horas integer check (sla_interno_horas between 1 and 720),
  requiere_revision_juridica boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caso_tipo_sla_uno check (not (sla_interno_dias_habiles is not null and sla_interno_horas is not null))
);

-- ── Plazos (versionados) ───────────────────────────────────────────────────
create table if not exists public.caso_plazo_regla (
  id uuid primary key default gen_random_uuid(),
  tipo_codigo text not null references public.caso_tipo(codigo),
  version integer not null default 1 check (version >= 1),
  plazo integer check (plazo between 1 and 365),
  unidad text not null default 'DIAS_HABILES' check (unidad in ('DIAS_HABILES', 'DIAS_CALENDARIO', 'HORAS')),
  norma text,
  articulo text,
  fuente_url text check (fuente_url is null or fuente_url ~ '^https://'),
  inicio_conteo text not null default 'DIA_SIGUIENTE_RECEPCION'
    check (inicio_conteo in ('DIA_SIGUIENTE_RECEPCION', 'RECLAMO_COMPLETO', 'RADICACION')),
  prorroga_max integer check (prorroga_max between 1 and 90),          -- días adicionales permitidos (misma unidad)
  prorroga_requiere_motivo boolean not null default true,
  subsanacion_dias integer check (subsanacion_dias between 1 and 90),  -- plazo para requerir al solicitante
  subsanacion_unidad text check (subsanacion_unidad in ('DIAS_HABILES', 'DIAS_CALENDARIO')),
  desistimiento_meses integer check (desistimiento_meses between 1 and 24),
  traslado_dias_habiles integer check (traslado_dias_habiles between 1 and 30),
  leyenda_tramite_dias_habiles integer check (leyenda_tramite_dias_habiles between 1 and 30),
  estado_verificacion text not null default 'PENDIENTE_VERIFICACION' check (estado_verificacion in
    ('VERIFICADO_LEGALMENTE', 'PENDIENTE_VERIFICACION', 'PLAZO_INTERNO', 'NO_APLICABLE', 'CONFIGURACION_PROVISIONAL')),
  verificado_at date,
  verificado_por text,
  observaciones text,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo_codigo, version),
  -- Un plazo marcado «verificado» debe poder rastrearse: norma, artículo, fuente, fecha y quién.
  constraint caso_plazo_verificado_completo check (estado_verificacion <> 'VERIFICADO_LEGALMENTE'
    or (norma is not null and articulo is not null and fuente_url is not null and verificado_at is not null
        and verificado_por is not null and plazo is not null))
);
create unique index if not exists caso_plazo_regla_activa_uq on public.caso_plazo_regla (tipo_codigo) where activa;

-- ── Calendario ─────────────────────────────────────────────────────────────
create table if not exists public.festivo_co (
  fecha date primary key,
  nombre text not null,
  origen text not null default 'CALCULADO' check (origen in ('CALCULADO', 'OFICIAL', 'MANUAL')),
  verificado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.caso_tipo enable row level security;
alter table public.caso_plazo_regla enable row level security;
alter table public.festivo_co enable row level security;
revoke all on public.caso_tipo, public.caso_plazo_regla, public.festivo_co from public, anon, authenticated;
grant select on public.caso_tipo, public.caso_plazo_regla, public.festivo_co to authenticated;
drop policy if exists caso_tipo_select_supersu on public.caso_tipo;
create policy caso_tipo_select_supersu on public.caso_tipo for select to authenticated using (coalesce(public.is_supersu(), false));
drop policy if exists caso_plazo_regla_select_supersu on public.caso_plazo_regla;
create policy caso_plazo_regla_select_supersu on public.caso_plazo_regla for select to authenticated using (coalesce(public.is_supersu(), false));
drop policy if exists festivo_co_select_supersu on public.festivo_co;
create policy festivo_co_select_supersu on public.festivo_co for select to authenticated using (coalesce(public.is_supersu(), false));

-- ── Festivos de Colombia (cálculo) ─────────────────────────────────────────
-- Pascua (algoritmo gregoriano anónimo / Meeus-Jones-Butcher). Domingo de Pascua del año dado.
create or replace function public.pascua(p_anio integer)
returns date language plpgsql immutable set search_path = public as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
begin
  a := p_anio % 19; b := p_anio / 100; c := p_anio % 100; d := b / 4; e := b % 4; f := (b + 8) / 25;
  g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31; dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_anio, mes, dia);
end $$;

-- Traslada al lunes siguiente (o el mismo día si ya es lunes): Ley Emiliani.
create or replace function public._lunes_siguiente(p_fecha date)
returns date language sql immutable set search_path = public as $$
  select p_fecha + ((8 - extract(isodow from p_fecha)::int) % 7);
$$;

create or replace function public.calcular_festivos_co(p_anio integer)
returns table (fecha date, nombre text) language plpgsql immutable set search_path = public as $$
declare v_p date := public.pascua(p_anio);
begin
  -- Fijos
  return query values
    (make_date(p_anio, 1, 1), 'Año Nuevo'), (make_date(p_anio, 5, 1), 'Día del Trabajo'),
    (make_date(p_anio, 7, 20), 'Grito de Independencia'), (make_date(p_anio, 8, 7), 'Batalla de Boyacá'),
    (make_date(p_anio, 12, 8), 'Inmaculada Concepción'), (make_date(p_anio, 12, 25), 'Navidad');
  -- Trasladables al lunes (Ley 51 de 1983)
  return query values
    (public._lunes_siguiente(make_date(p_anio, 1, 6)), 'Reyes Magos'),
    (public._lunes_siguiente(make_date(p_anio, 3, 19)), 'San José'),
    (public._lunes_siguiente(make_date(p_anio, 6, 29)), 'San Pedro y San Pablo'),
    (public._lunes_siguiente(make_date(p_anio, 8, 15)), 'Asunción de la Virgen'),
    (public._lunes_siguiente(make_date(p_anio, 10, 12)), 'Día de la Raza'),
    (public._lunes_siguiente(make_date(p_anio, 11, 1)), 'Todos los Santos'),
    (public._lunes_siguiente(make_date(p_anio, 11, 11)), 'Independencia de Cartagena');
  -- Semana Santa (jueves y viernes) y festivos que dependen de la Pascua (lunes siguientes)
  return query values
    (v_p - 3, 'Jueves Santo'), (v_p - 2, 'Viernes Santo'),
    (public._lunes_siguiente(v_p + 39), 'Ascensión del Señor'),
    (public._lunes_siguiente(v_p + 60), 'Corpus Christi'),
    (public._lunes_siguiente(v_p + 68), 'Sagrado Corazón de Jesús');
end $$;

-- Siembra 2026-2035 (idempotente). No sobrescribe filas OFICIAL/MANUAL que alguien haya confirmado.
insert into public.festivo_co (fecha, nombre, origen, verificado)
select f.fecha, f.nombre, 'CALCULADO', false
from generate_series(2026, 2035) a(anio), lateral public.calcular_festivos_co(a.anio) f
on conflict (fecha) do nothing;

-- ── Funciones de calendario ────────────────────────────────────────────────
create or replace function public.fecha_colombia(p_ts timestamptz)
returns date language sql immutable set search_path = public as $$
  select (p_ts at time zone 'America/Bogota')::date;
$$;

create or replace function public.es_dia_habil(p_fecha date)
returns boolean language sql stable set search_path = public as $$
  select extract(isodow from p_fecha) < 6 and not exists (select 1 from public.festivo_co f where f.fecha = p_fecha);
$$;

-- Suma días hábiles. El día de partida NO cuenta: el primer día contado es el siguiente hábil.
-- Si p_dias = 0 devuelve el primer día hábil igual o posterior a la fecha.
create or replace function public.sumar_dias_habiles(p_inicio date, p_dias integer)
returns date language plpgsql stable set search_path = public as $$
declare d date := p_inicio; n int := 0;
begin
  if p_dias < 0 or p_dias > 400 then raise exception 'DIAS_FUERA_DE_RANGO'; end if;
  if p_dias = 0 then
    while not public.es_dia_habil(d) loop d := d + 1; end loop;
    return d;
  end if;
  while n < p_dias loop
    d := d + 1;
    if public.es_dia_habil(d) then n := n + 1; end if;
  end loop;
  return d;
end $$;

-- Días hábiles transcurridos entre dos fechas (a exclusivo, b inclusivo). Negativo si b < a.
create or replace function public.dias_habiles_entre(p_a date, p_b date)
returns integer language plpgsql stable set search_path = public as $$
declare d date; n int := 0;
begin
  if p_b = p_a then return 0; end if;
  if p_b < p_a then return -public.dias_habiles_entre(p_b, p_a); end if;
  d := p_a;
  while d < p_b loop d := d + 1; if public.es_dia_habil(d) then n := n + 1; end if; end loop;
  return n;
end $$;

-- Fecha límite = final del último día del plazo (23:59:59 hora de Colombia). Para HORAS: recibido + n horas.
create or replace function public.calcular_fecha_limite(p_recibido timestamptz, p_plazo integer, p_unidad text)
returns timestamptz language plpgsql stable set search_path = public as $$
declare v_dia date;
begin
  if p_plazo is null then return null; end if;
  if p_unidad = 'HORAS' then return p_recibido + make_interval(hours => p_plazo); end if;
  if p_unidad = 'DIAS_CALENDARIO' then v_dia := public.fecha_colombia(p_recibido) + p_plazo;
  elsif p_unidad = 'DIAS_HABILES' then v_dia := public.sumar_dias_habiles(public.fecha_colombia(p_recibido), p_plazo);
  else raise exception 'UNIDAD_INVALIDA'; end if;
  return (v_dia + time '23:59:59') at time zone 'America/Bogota';
end $$;

revoke all on function public.pascua(integer), public._lunes_siguiente(date), public.calcular_festivos_co(integer),
  public.fecha_colombia(timestamptz), public.es_dia_habil(date), public.sumar_dias_habiles(date, integer),
  public.dias_habiles_entre(date, date), public.calcular_fecha_limite(timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.es_dia_habil(date), public.sumar_dias_habiles(date, integer), public.dias_habiles_entre(date, date),
  public.calcular_fecha_limite(timestamptz, integer, text), public.fecha_colombia(timestamptz) to authenticated, service_role;

-- ── Semilla del catálogo de tipos ──────────────────────────────────────────
insert into public.caso_tipo (codigo, categoria, nombre, publico, requiere_identificacion, es_critico, prioridad_base, sla_interno_dias_habiles, sla_interno_horas, requiere_revision_juridica, orden) values
  -- A. Datos personales
  ('DATOS_CONSULTA',        'DATOS_PERSONALES', 'Consulta de datos personales',                    true, true,  false, 'ALTA',   null, null, false, 10),
  ('DATOS_COPIA',           'DATOS_PERSONALES', 'Solicitud de copia de información',               true, true,  false, 'ALTA',   null, null, true,  11),
  ('DATOS_INFO_TRATAMIENTO','DATOS_PERSONALES', 'Información sobre el tratamiento de mis datos',   true, false, false, 'ALTA',   null, null, true,  12),
  ('DATOS_RECLAMO',         'DATOS_PERSONALES', 'Reclamo de datos personales',                     true, true,  false, 'ALTA',   null, null, false, 13),
  ('DATOS_ACTUALIZACION',   'DATOS_PERSONALES', 'Actualización de datos',                          true, true,  false, 'ALTA',   null, null, false, 14),
  ('DATOS_RECTIFICACION',   'DATOS_PERSONALES', 'Rectificación de datos',                          true, true,  false, 'ALTA',   null, null, false, 15),
  ('DATOS_SUPRESION',       'DATOS_PERSONALES', 'Supresión de datos',                              true, true,  false, 'ALTA',   null, null, false, 16),
  ('DATOS_REVOCATORIA',     'DATOS_PERSONALES', 'Revocatoria de la autorización',                  true, true,  false, 'ALTA',   null, null, false, 17),
  ('DATOS_INCUMPLIMIENTO',  'DATOS_PERSONALES', 'Incumplimiento de obligaciones de protección de datos', true, true, false, 'ALTA', null, null, false, 18),
  ('DATOS_OTRO',            'DATOS_PERSONALES', 'Otro asunto de habeas data',                      true, true,  false, 'ALTA',   15,   null, true,  19),
  -- B. Consumidor
  ('CONS_SERVICIO',         'CONSUMIDOR', 'Reclamación por servicio',        true, false, false, 'ALTA',   15, null, true, 20),
  ('CONS_COBRO',            'CONSUMIDOR', 'Cobro',                           true, false, false, 'ALTA',   15, null, true, 21),
  ('CONS_FACTURACION',      'CONSUMIDOR', 'Facturación',                     true, false, false, 'NORMAL', 15, null, true, 22),
  ('CONS_PUBLICIDAD',       'CONSUMIDOR', 'Publicidad',                      true, false, false, 'NORMAL', 15, null, true, 23),
  ('CONS_INFORMACION',      'CONSUMIDOR', 'Información',                     true, false, false, 'NORMAL', 15, null, true, 24),
  ('CONS_RESERVA',          'CONSUMIDOR', 'Reserva',                         true, false, false, 'NORMAL', 15, null, true, 25),
  ('CONS_CANCELACION',      'CONSUMIDOR', 'Cancelación',                     true, false, false, 'NORMAL', 15, null, true, 26),
  ('CONS_REEMBOLSO',        'CONSUMIDOR', 'Reembolso',                       true, false, false, 'ALTA',   15, null, true, 27),
  ('CONS_INCUMPLIMIENTO',   'CONSUMIDOR', 'Incumplimiento',                  true, false, false, 'ALTA',   15, null, true, 28),
  ('CONS_CALIDAD',          'CONSUMIDOR', 'Calidad del servicio',            true, false, false, 'NORMAL', 15, null, true, 29),
  ('CONS_OTRO',             'CONSUMIDOR', 'Otro asunto de consumidor',       true, false, false, 'NORMAL', 15, null, true, 30),
  -- C. PQRS general
  ('PQRS_PETICION',         'PQRS', 'Petición',     true, false, false, 'NORMAL', 15, null, true,  40),
  ('PQRS_QUEJA',            'PQRS', 'Queja',        true, false, false, 'NORMAL', 15, null, true,  41),
  ('PQRS_RECLAMO',          'PQRS', 'Reclamo',      true, false, false, 'NORMAL', 15, null, true,  42),
  ('PQRS_SUGERENCIA',       'PQRS', 'Sugerencia',   true, false, false, 'BAJA',   30, null, false, 43),
  ('PQRS_FELICITACION',     'PQRS', 'Felicitación', true, false, false, 'BAJA',   30, null, false, 44),
  -- D. Seguridad y privacidad (críticos)
  ('SEG_INCIDENTE',         'SEGURIDAD', 'Incidente de seguridad',   true, false, true, 'CRITICA', null, 24, true, 50),
  ('SEG_ACCESO_NO_AUTORIZADO','SEGURIDAD','Acceso no autorizado',    true, false, true, 'CRITICA', null, 24, true, 51),
  ('SEG_FILTRACION',        'SEGURIDAD', 'Filtración',               true, false, true, 'CRITICA', null, 24, true, 52),
  ('SEG_PERDIDA_INFO',      'SEGURIDAD', 'Pérdida de información',   true, false, true, 'CRITICA', null, 24, true, 53),
  ('SEG_USO_INDEBIDO',      'SEGURIDAD', 'Uso indebido de datos',    true, false, true, 'CRITICA', null, 24, true, 54),
  ('SEG_OTRO',              'SEGURIDAD', 'Otro incidente',           true, false, true, 'ALTA',    null, 48, true, 55),
  -- E. Legal y contractual
  ('LEGAL_CONTRACTUAL',     'LEGAL', 'Solicitud contractual',        true,  false, false, 'NORMAL', 15, null, true, 60),
  ('LEGAL_DISPUTA',         'LEGAL', 'Disputa',                      true,  false, false, 'ALTA',   15, null, true, 61),
  ('LEGAL_DOCUMENTACION',   'LEGAL', 'Solicitud de documentación',   true,  false, false, 'NORMAL', 15, null, true, 62),
  ('LEGAL_COMUNICACION',    'LEGAL', 'Comunicación legal',           true,  false, false, 'ALTA',   10, null, true, 63),
  ('LEGAL_AUTORIDAD',       'LEGAL', 'Solicitud de una autoridad',   false, false, true,  'CRITICA', null, 24, true, 64),
  ('LEGAL_OTRO',            'LEGAL', 'Otro asunto legal',            true,  false, false, 'NORMAL', 15, null, true, 65),
  -- F. Operativo
  ('OPE_TECNICO',           'OPERATIVO', 'Problema técnico',  true, false, false, 'NORMAL', 5, null, false, 70),
  ('OPE_CUENTA',            'OPERATIVO', 'Cuenta',            true, false, false, 'NORMAL', 5, null, false, 71),
  ('OPE_PLATAFORMA',        'OPERATIVO', 'Plataforma',        true, false, false, 'NORMAL', 5, null, false, 72),
  ('OPE_PAGO',              'OPERATIVO', 'Pago',              true, false, false, 'ALTA',   5, null, false, 73),
  ('OPE_RESERVA',           'OPERATIVO', 'Reserva',           true, false, false, 'NORMAL', 5, null, false, 74),
  ('OPE_OTRO',              'OPERATIVO', 'Otro',              true, false, false, 'BAJA',   10, null, false, 79)
on conflict (codigo) do nothing;

-- ── Semilla de plazos ──────────────────────────────────────────────────────
-- 1) Verificados: Ley 1581 arts. 14 y 15 (lectura literal 2026-11-17).
insert into public.caso_plazo_regla (tipo_codigo, plazo, unidad, norma, articulo, fuente_url, inicio_conteo, prorroga_max,
  estado_verificacion, verificado_at, verificado_por, observaciones)
values ('DATOS_CONSULTA', 10, 'DIAS_HABILES', 'Ley 1581 de 2012', 'art. 14',
  'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981', 'DIA_SIGUIENTE_RECEPCION', 5,
  'VERIFICADO_LEGALMENTE', date '2026-11-17', 'Lectura literal en Función Pública (agente); pendiente de revisión por abogado',
  'Si no es posible atender en 10 días hábiles se informa al interesado, antes del vencimiento, los motivos y la fecha en que se atenderá, que no podrá superar 5 días hábiles más.')
on conflict do nothing;

insert into public.caso_plazo_regla (tipo_codigo, plazo, unidad, norma, articulo, fuente_url, inicio_conteo, prorroga_max,
  subsanacion_dias, subsanacion_unidad, desistimiento_meses, traslado_dias_habiles, leyenda_tramite_dias_habiles,
  estado_verificacion, verificado_at, verificado_por, observaciones)
select t, 15, 'DIAS_HABILES', 'Ley 1581 de 2012', 'art. 15',
  'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981', 'RECLAMO_COMPLETO', 8,
  5, 'DIAS_HABILES', 2, 2, 2,
  'VERIFICADO_LEGALMENTE', date '2026-11-17', 'Lectura literal en Función Pública (agente); pendiente de revisión por abogado',
  'Reclamo completo: 15 días hábiles desde el día siguiente a su recibo (+8 con motivo). Incompleto: requerir dentro de 5 días siguientes (la norma dice «días»; se interpreta hábiles, Ley 4 de 1913 art. 62: confirmar con abogado); 2 meses sin respuesta = desistimiento. Leyenda «reclamo en trámite» en 2 días hábiles. Traslado por falta de competencia en 2 días hábiles.'
from unnest(array['DATOS_RECLAMO', 'DATOS_ACTUALIZACION', 'DATOS_RECTIFICACION', 'DATOS_SUPRESION', 'DATOS_REVOCATORIA',
                  'DATOS_INCUMPLIMIENTO']) t
on conflict do nothing;

-- 2) Asimiladas a consulta: provisional hasta confirmación jurídica.
insert into public.caso_plazo_regla (tipo_codigo, plazo, unidad, norma, articulo, fuente_url, prorroga_max, estado_verificacion, observaciones)
select t, 10, 'DIAS_HABILES', 'Ley 1581 de 2012', 'art. 14 (por analogía)',
  'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981', 5, 'CONFIGURACION_PROVISIONAL',
  'Se trata como consulta (art. 14). Falta confirmar con abogado si la solicitud de copia/información cae en el art. 14.'
from unnest(array['DATOS_COPIA', 'DATOS_INFO_TRATAMIENTO']) t
on conflict do nothing;

-- 3) Consumidor: Ley 1480 art. 58 (15 días hábiles). Aplicabilidad a StylerNow NO confirmada → provisional.
insert into public.caso_plazo_regla (tipo_codigo, plazo, unidad, norma, articulo, estado_verificacion, observaciones)
select t, 15, 'DIAS_HABILES', 'Ley 1480 de 2011', 'art. 58', 'CONFIGURACION_PROVISIONAL',
  'Plazo indicado por el propietario; NO verificado literalmente. Antes de tratarlo como obligación de StylerNow hay que confirmar si StylerNow es el destinatario jurídicamente obligado (frente al establecimiento, que presta el servicio).'
from unnest(array['CONS_SERVICIO', 'CONS_COBRO', 'CONS_FACTURACION', 'CONS_PUBLICIDAD', 'CONS_INFORMACION', 'CONS_RESERVA',
                  'CONS_CANCELACION', 'CONS_REEMBOLSO', 'CONS_INCUMPLIMIENTO', 'CONS_CALIDAD', 'CONS_OTRO']) t
on conflict do nothing;

-- 4) Petición y demás: sin plazo legal cargado; rige el plazo interno del tipo.
insert into public.caso_plazo_regla (tipo_codigo, plazo, unidad, estado_verificacion, observaciones)
select codigo, null, 'DIAS_HABILES', 'PENDIENTE_VERIFICACION',
  'Sin plazo legal verificado. Se usa el plazo interno del tipo de caso y se muestra como «interno», no como ley.'
from public.caso_tipo
where categoria in ('PQRS', 'SEGURIDAD', 'LEGAL', 'OPERATIVO') or codigo = 'DATOS_OTRO'
on conflict do nothing;
