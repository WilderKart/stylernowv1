-- 164 · FASE 2B · Núcleo del estado «suscripción restringida» (bloqueo operativo).
--
-- Una sola fuente de verdad, en la base:
--   · fechas centrales en America/Bogota (suscripcion_dia / suscripcion_inicio_dia / suscripcion_fecha_limite);
--   · _estado_operativo_en(negocio, instante)  → jsonb con operativo / estado / motivo / límites (interna, probable con instante simulado);
--   · negocio_estado_operativo(negocio)        → lo mismo «ahora», con detalle solo para dueño, equipo activo y SuperSU;
--   · negocio_operativo(negocio) / negocio_acepta_reservas(negocio) → booleanos;
--   · _exigir_operativo(negocio) / _exigir_operativo_sede / _exigir_operativo_reserva → guardias reutilizables (SUSCRIPCION_RESTRINGIDA).
--
-- Reglas (decisiones del propietario, 2026-11-18):
--   · Prueba: día 1 = día de inicio (hora Colombia); días 1..N operativos; el día N+1 sin pago confirmado → restringido (N = prueba_dias, 14).
--   · Pago confirmado: periodo de 30 días (suscripcion_periodo_dias). Día 1 = día del pago, día 30 último pagado, día 31 = gracia
--     (suscripcion_gracia_dias = 1), día 32 restringido si no hay nuevo pago.
--   · El estado se DERIVA de las fechas, nunca de que el cron diario ya haya movido el estado: a las 00:00 de Bogotá del día de bloqueo
--     el negocio queda restringido aunque el cron corra horas después.
--   · La gracia de la prueba es 0 (prueba_gracia_dias); la gracia del periodo pagado sigue siendo suscripcion_gracia_dias, ahora 1
--     (antes 3 y compartida con la prueba).
--   · Gracia ≠ día completo de servicio: por defecto opera (gracia_permite_operar = true) con aviso de renovación; SuperAdmin puede
--     apagarlo y la gracia pasa a restringir igual que el bloqueo, dejando solo el pago.
--   · Activación manual de SuperAdmin (090): opera mientras manual_hasta (o sin fecha); no depende de fecha_proximo_cobro ni de prueba_fin.
--   · Sin fila de suscripción (negocio ACTIVO heredado/de fixtures): OPERATIVO con estado SIN_SUSCRIPCION, igual que el contrato anterior de
--     negocio_puede_recibir_reservas (coalesce(...,true)). El alta (crear_suscripcion_inicial) siempre crea la fila; ver riesgo en el informe. Otros estados de negocio no ACTIVO → restringido.
--
-- Probada en LOCAL (tests/sql/restringida_164.sql). Aplicar en producción solo con autorización. Reversión: 160_..._REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

-- ── Configuración editable desde SuperAdmin ─────────────────────────────────────────────────────────
alter table public.configuracion_plataforma
  add column if not exists suscripcion_periodo_dias integer not null default 30,
  add column if not exists prueba_gracia_dias integer not null default 0,
  add column if not exists gracia_permite_operar boolean not null default true;
alter table public.configuracion_plataforma drop constraint if exists suscripcion_config_valida;
alter table public.configuracion_plataforma
  add constraint suscripcion_config_valida check (suscripcion_periodo_dias between 1 and 366 and prueba_gracia_dias between 0 and 30);

-- ── Función central de fechas (la única que decide el «día» de una suscripción) ───────────────────────
create or replace function public.suscripcion_dia(p_ts timestamptz)
 returns date language sql stable set search_path to 'public'
as $function$ select (p_ts at time zone 'America/Bogota')::date $function$;

create or replace function public.suscripcion_inicio_dia(p_dia date)
 returns timestamptz language sql stable set search_path to 'public'
as $function$ select (p_dia::timestamp) at time zone 'America/Bogota' $function$;

-- Primer instante NO cubierto: inicio del día (Bogotá) que sigue a «p_dias» días contando el día de p_inicio como día 1.
-- Ej.: pago el 1 → día 30 último pagado → límite = 00:00 del día 31 (que es el día de gracia).
create or replace function public.suscripcion_fecha_limite(p_inicio timestamptz, p_dias integer)
 returns timestamptz language sql stable set search_path to 'public'
as $function$ select public.suscripcion_inicio_dia(public.suscripcion_dia(p_inicio) + p_dias) $function$;

-- Número de día dentro del ciclo (1 = día de inicio), en hora de Colombia.
create or replace function public.suscripcion_numero_dia(p_inicio timestamptz, p_ahora timestamptz)
 returns integer language sql stable set search_path to 'public'
as $function$ select (public.suscripcion_dia(p_ahora) - public.suscripcion_dia(p_inicio) + 1)::int $function$;

revoke all on function public.suscripcion_dia(timestamptz), public.suscripcion_inicio_dia(date),
  public.suscripcion_fecha_limite(timestamptz, integer), public.suscripcion_numero_dia(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.suscripcion_dia(timestamptz), public.suscripcion_inicio_dia(date),
  public.suscripcion_fecha_limite(timestamptz, integer), public.suscripcion_numero_dia(timestamptz, timestamptz) to authenticated, service_role;

-- ── Estado operativo derivado de las fechas (interna: acepta el instante para poder probar bordes) ───
create or replace function public._estado_operativo_en(p_negocio uuid, p_ahora timestamptz)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_n public.negocio; v_s public.suscripcion; v_cfg record;
  v_gracia int; v_limite timestamptz; v_fin_gracia timestamptz; v_fase text; v_motivo text; v_opera boolean;
  v_pagado boolean; v_inicio timestamptz;
begin
  select * into v_n from public.negocio where id = p_negocio;
  if not found then
    return jsonb_build_object('operativo', false, 'estado', 'RESTRINGIDO', 'motivo', 'NEGOCIO_INEXISTENTE', 'ahora', p_ahora, 'zona', 'America/Bogota');
  end if;
  select suscripcion_gracia_dias as g, prueba_gracia_dias as pg, gracia_permite_operar as op
    into v_cfg from public.configuracion_plataforma where id;
  select * into v_s from public.suscripcion where negocio_id = p_negocio;

  if v_n.estado = 'PENDIENTE_APROBACION' then
    return jsonb_build_object('operativo', true, 'estado', 'EN_CONFIGURACION', 'motivo', null, 'ahora', p_ahora, 'zona', 'America/Bogota',
                              'suscripcion_estado', v_s.estado, 'plan_codigo', v_s.plan_codigo, 'puede_pagar', false, 'activacion_manual', coalesce(v_s.activacion_manual, false));
  end if;
  if v_n.estado <> 'ACTIVO' then
    return jsonb_build_object('operativo', false, 'estado', 'RESTRINGIDO', 'motivo', 'NEGOCIO_NO_ACTIVO', 'ahora', p_ahora, 'zona', 'America/Bogota',
                              'suscripcion_estado', v_s.estado, 'plan_codigo', v_s.plan_codigo, 'puede_pagar', false, 'activacion_manual', coalesce(v_s.activacion_manual, false));
  end if;
  if v_s.id is null then
    return jsonb_build_object('operativo', true, 'estado', 'SIN_SUSCRIPCION', 'motivo', null, 'ahora', p_ahora, 'zona', 'America/Bogota',
                              'puede_pagar', false, 'activacion_manual', false);
  end if;

  -- ¿Alguna vez se pagó un plan? (distingue «prueba vencida» de «periodo pagado vencido» cuando el estado ya se movió).
  v_pagado := exists (select 1 from public.pago p where p.negocio_id = p_negocio and p.tipo = 'SUSCRIPCION'
                        and p.estado = 'APROBADO' and p.metadata->>'concepto' = 'PLAN');

  -- Activación manual de SuperAdmin: opera mientras dure; sin fecha, hasta que SuperAdmin la revierta.
  if v_s.activacion_manual and v_s.estado in ('TRIAL', 'ACTIVA') then
    v_opera := v_s.manual_hasta is null or p_ahora < v_s.manual_hasta;
    return jsonb_build_object('operativo', v_opera,
      'estado', case when v_opera then (case v_s.estado when 'TRIAL' then 'PRUEBA' else 'PAGADO' end) else 'RESTRINGIDO' end,
      'motivo', case when v_opera then null else 'ACTIVACION_MANUAL_VENCIDA' end,
      'suscripcion_estado', v_s.estado, 'plan_codigo', v_s.plan_codigo, 'activacion_manual', true,
      'limite_servicio', v_s.manual_hasta, 'bloqueo_desde', v_s.manual_hasta, 'puede_pagar', false,
      'ahora', p_ahora, 'zona', 'America/Bogota');
  end if;

  if v_s.estado = 'TRIAL' then
    v_limite := coalesce(v_s.prueba_fin, v_s.fecha_proximo_cobro); v_gracia := v_cfg.pg; v_inicio := coalesce(v_s.prueba_inicio, v_s.fecha_inicio_ciclo);
    v_fin_gracia := v_limite + make_interval(days => v_gracia);
    if p_ahora < v_limite then v_fase := 'PRUEBA'; v_opera := true;
    elsif p_ahora < v_fin_gracia then v_fase := 'GRACIA'; v_opera := v_cfg.op; v_motivo := 'PRUEBA_VENCIDA';
    else v_fase := 'RESTRINGIDO'; v_opera := false; v_motivo := 'PRUEBA_VENCIDA'; end if;
  elsif v_s.estado = 'ACTIVA' then
    v_limite := v_s.fecha_proximo_cobro; v_gracia := v_cfg.g; v_inicio := v_s.fecha_inicio_ciclo;
    v_fin_gracia := v_limite + make_interval(days => v_gracia);
    if p_ahora < v_limite then v_fase := 'PAGADO'; v_opera := true;
    elsif p_ahora < v_fin_gracia then v_fase := 'GRACIA'; v_opera := v_cfg.op; v_motivo := 'PERIODO_VENCIDO';
    else v_fase := 'RESTRINGIDO'; v_opera := false; v_motivo := 'PERIODO_VENCIDO'; end if;
  elsif v_s.estado = 'EN_MORA' then
    -- La gracia guardada manda; si falta (EN_MORA sin gracia_fin) se calcula desde el vencimiento y, sin él, se restringe.
    v_limite := case when v_pagado then v_s.fecha_proximo_cobro else coalesce(v_s.prueba_fin, v_s.fecha_proximo_cobro) end;
    v_inicio := coalesce(v_s.fecha_inicio_ciclo, v_s.prueba_inicio);
    v_fin_gracia := coalesce(v_s.gracia_fin, v_limite + make_interval(days => case when v_pagado then v_cfg.g else v_cfg.pg end));
    if p_ahora < v_fin_gracia then v_fase := 'GRACIA'; v_opera := v_cfg.op; v_motivo := case when v_pagado then 'PERIODO_VENCIDO' else 'PRUEBA_VENCIDA' end;
    else v_fase := 'RESTRINGIDO'; v_opera := false; v_motivo := case when v_pagado then 'PERIODO_VENCIDO' else 'PRUEBA_VENCIDA' end; end if;
  else
    v_fase := 'RESTRINGIDO'; v_opera := false; v_limite := null; v_fin_gracia := null; v_inicio := v_s.fecha_inicio_ciclo;
    v_motivo := case v_s.estado when 'REQUIERE_PLAN' then 'REQUIERE_PLAN' when 'SUSPENDIDA' then 'SUSPENDIDA' else 'CANCELADA' end;
  end if;

  return jsonb_build_object(
    'operativo', v_opera, 'estado', v_fase, 'motivo', v_motivo,
    'suscripcion_estado', v_s.estado, 'plan_codigo', v_s.plan_codigo, 'activacion_manual', false,
    'limite_servicio', v_limite, 'bloqueo_desde', v_fin_gracia,
    'dia_ciclo', case when v_inicio is null then null else greatest(public.suscripcion_numero_dia(v_inicio, p_ahora), 1) end,
    'dias_restantes', case when v_limite is null then null else greatest(public.suscripcion_dia(v_limite) - public.suscripcion_dia(p_ahora), 0) end,
    'puede_pagar', v_s.estado in ('TRIAL', 'ACTIVA', 'EN_MORA', 'REQUIERE_PLAN')
                   or (v_s.estado = 'SUSPENDIDA' and coalesce(v_s.suspendido_causa, 'IMPAGO') = 'IMPAGO'),
    'ahora', p_ahora, 'zona', 'America/Bogota');
end
$function$;
revoke all on function public._estado_operativo_en(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public._estado_operativo_en(uuid, timestamptz) to service_role;

-- ── Lectura pública del estado ───────────────────────────────────────────────────────────────────
create or replace function public.negocio_operativo(p_negocio_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select coalesce((public._estado_operativo_en(p_negocio_id, now()) ->> 'operativo')::boolean, false) $function$;
revoke all on function public.negocio_operativo(uuid) from public, anon, authenticated;
grant execute on function public.negocio_operativo(uuid) to authenticated, service_role;

-- Para la página pública (anónimos incluidos): solo un sí/no; sin fechas ni motivos.
create or replace function public.negocio_acepta_reservas(p_negocio_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select public.negocio_operativo(p_negocio_id) $function$;
revoke all on function public.negocio_acepta_reservas(uuid) from public, anon, authenticated;
grant execute on function public.negocio_acepta_reservas(uuid) to anon, authenticated, service_role;

-- Detalle: dueño, equipo activo y SuperSU; cualquier otro solo recibe operativo/estado, sin fechas ni motivo.
create or replace function public.negocio_estado_operativo(p_negocio_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v jsonb := public._estado_operativo_en(p_negocio_id, now());
begin
  if coalesce(public.is_supersu(), false) or coalesce(public.is_barberia_de(p_negocio_id), false)
     or exists (select 1 from public.vinculo_staff_negocio vs
                 where vs.negocio_id = p_negocio_id and vs.staff_id = auth.uid() and vs.estado in ('ACTIVO', 'SUSPENDIDO')) then
    return v;
  end if;
  return jsonb_build_object('operativo', v->'operativo', 'estado', case when (v->>'operativo')::boolean then 'OPERATIVO' else 'RESTRINGIDO' end);
end
$function$;
revoke all on function public.negocio_estado_operativo(uuid) from public, anon, authenticated;
grant execute on function public.negocio_estado_operativo(uuid) to authenticated, service_role;

-- ── Guardias reutilizables (un solo punto de control para RPC y disparadores) ────────────────────────
create or replace function public._exigir_operativo(p_negocio_id uuid)
 returns void language plpgsql stable security definer set search_path to 'public'
as $function$
declare v jsonb;
begin
  if coalesce(public.is_supersu(), false) then return; end if;
  v := public._estado_operativo_en(p_negocio_id, now());
  if not coalesce((v->>'operativo')::boolean, false) then
    raise exception 'SUSCRIPCION_RESTRINGIDA' using errcode = 'P0001', detail = coalesce(v->>'motivo', 'RESTRINGIDO'),
      hint = 'El negocio tiene la suscripción restringida: solo puede consultar el histórico, pagar y cumplir las citas ya confirmadas.';
  end if;
end
$function$;
revoke all on function public._exigir_operativo(uuid) from public, anon, authenticated;

create or replace function public._exigir_operativo_sede(p_sede_id uuid)
 returns void language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_neg uuid;
begin
  select negocio_id into v_neg from public.sede where id = p_sede_id;
  if v_neg is null then return; end if;   -- la función que llama responde «no existe» con su propio código
  perform public._exigir_operativo(v_neg);
end
$function$;
revoke all on function public._exigir_operativo_sede(uuid) from public, anon, authenticated;

create or replace function public._exigir_operativo_reserva(p_reserva_id uuid)
 returns void language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_neg uuid;
begin
  select negocio_id into v_neg from public.reserva where id = p_reserva_id;
  if v_neg is null then return; end if;
  perform public._exigir_operativo(v_neg);
end
$function$;
revoke all on function public._exigir_operativo_reserva(uuid) from public, anon, authenticated;

-- ── Reutiliza el contrato anterior (reserva nueva + WhatsApp) sobre la función central ────────────────
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.negocio_puede_recibir_reservas(uuid)'::regprocedure);
  if position('select coalesce((' in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA negocio_puede_recibir_reservas'; end if;
  -- Cuerpo nuevo completo: la función antigua es SQL puro de 4 líneas y se sustituye entera a propósito (misma firma, mismos grants).
  execute $f$
    create or replace function public.negocio_puede_recibir_reservas(p_negocio_id uuid)
     returns boolean language sql stable security definer set search_path to 'public'
    as $b$ select public.negocio_operativo(p_negocio_id) $b$ $f$;
end $$;

do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.trg_reserva_exige_plan()'::regprocedure);
  if position('NEGOCIO_REQUIERE_PLAN' in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA trg_reserva_exige_plan'; end if;
  v_nuevo := replace(v_def, 'raise exception ''NEGOCIO_REQUIERE_PLAN'';', 'raise exception ''SUSCRIPCION_RESTRINGIDA'' using errcode = ''P0001'', detail = coalesce(public._estado_operativo_en(new.negocio_id, now())->>''motivo'', ''RESTRINGIDO'');');
  if v_nuevo = v_def then raise exception 'ANCLA_SIN_CAMBIO trg_reserva_exige_plan'; end if;
  execute v_nuevo;
end $$;

-- Gracia de la suscripción principal: de 3 a 1 día (decisión 2026-11-18). Sigue editable desde /admin/configuracion.
update public.configuracion_plataforma set suscripcion_gracia_dias = 1, updated_at = now() where id and suscripcion_gracia_dias = 3;
alter table public.configuracion_plataforma alter column suscripcion_gracia_dias set default 1;

commit;
