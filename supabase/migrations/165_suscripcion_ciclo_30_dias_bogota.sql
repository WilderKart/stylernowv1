-- 165 · FASE 2B · Ciclo de la suscripción principal en días de calendario de Colombia (depende de 160 y de 133).
--
--   · trg_pago_plan_activar (133): pago confirmado → periodo de 30 días (configuración suscripcion_periodo_dias; ciclo ANUAL = 365),
--     contado por día de Bogotá: día 1 = día del pago, día 30 último pagado; fecha_proximo_cobro = 00:00 de Bogotá del día 31.
--     Se conserva «no se pierden días»: si aún queda periodo pagado o de prueba, el nuevo empieza al terminar.
--   · mantenimiento_suscripciones (133): prueba vencida → REQUIERE_PLAN de inmediato (gracia de prueba 0; si SuperAdmin la sube, pasa por
--     EN_MORA hasta prueba_fin + gracia); periodo pagado vencido → EN_MORA con gracia_fin = fecha_proximo_cobro + gracia (determinista,
--     no depende de la hora en que corra el cron). El estado operativo se deriva de las fechas (164), el cron solo sincroniza el estado visible.
--   · iniciar_prueba_negocio_srv/srv2 (118) y admin_activar_negocio_manual (090): el fin de prueba/vigencia usa la función central de fechas.
-- Reversión: 161_..._REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

create or replace function public._parchar_funcion(p_firma regprocedure, p_ancla text, p_nuevo text, p_todas boolean default false)
 returns void language plpgsql set search_path to 'public'
as $function$
declare v_def text; v_res text;
begin
  v_def := replace(pg_get_functiondef(p_firma), chr(13), '');
  if position(p_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA en %: «%»', p_firma, left(p_ancla, 80); end if;
  if p_todas then v_res := replace(v_def, p_ancla, p_nuevo);
  else v_res := overlay(v_def placing p_nuevo from position(p_ancla in v_def) for char_length(p_ancla)); end if;
  execute v_res;
end $function$;

-- ── Pago de plan: 30 días por día de Bogotá ─────────────────────────────────────────────────────────
select public._parchar_funcion('public.trg_pago_plan_activar()'::regprocedure,
  'v_desde + v_intervalo',
  'public.suscripcion_fecha_limite(v_desde, case v_ciclo when ''ANUAL'' then 365 else (select suscripcion_periodo_dias from public.configuracion_plataforma where id) end)', true);

-- ── Mantenimiento diario ────────────────────────────────────────────────────────────────────────────
select public._parchar_funcion('public.mantenimiento_suscripciones()'::regprocedure,
  'v_fund int; v_manual int; r record;', 'v_fund int; v_manual int; r record; v_pg int;');
select public._parchar_funcion('public.mantenimiento_suscripciones()'::regprocedure,
  'select coalesce(suscripcion_gracia_dias, 3) into v_gracia from public.configuracion_plataforma where id;',
  'select coalesce(suscripcion_gracia_dias, 1), coalesce(prueba_gracia_dias, 0) into v_gracia, v_pg from public.configuracion_plataforma where id;');
select public._parchar_funcion('public.mantenimiento_suscripciones()'::regprocedure,
  E'update public.suscripcion set estado = ''EN_MORA'', gracia_fin = now() + make_interval(days => v_gracia), updated_at = now()\n     where estado = ''TRIAL''',
  E'update public.suscripcion set estado = case when v_pg > 0 then ''EN_MORA''::public.suscripcion_estado else ''REQUIERE_PLAN''::public.suscripcion_estado end,\n            gracia_fin = case when v_pg > 0 then prueba_fin + make_interval(days => v_pg) end, updated_at = now()\n     where estado = ''TRIAL''');
select public._parchar_funcion('public.mantenimiento_suscripciones()'::regprocedure,
  E'update public.suscripcion set estado = ''EN_MORA'', gracia_fin = now() + make_interval(days => v_gracia), updated_at = now()\n     where estado = ''ACTIVA''',
  E'update public.suscripcion set estado = ''EN_MORA'', gracia_fin = fecha_proximo_cobro + make_interval(days => v_gracia), updated_at = now()\n     where estado = ''ACTIVA''');
select public._parchar_funcion('public.mantenimiento_suscripciones()'::regprocedure,
  '''PRUEBA_VENCIDA_EN_GRACIA'', ''SISTEMA''',
  'case when v_pg > 0 then ''PRUEBA_VENCIDA_EN_GRACIA'' else ''PRUEBA_VENCIDA_RESTRINGIDA'' end, ''SISTEMA''');

-- ── Fin de prueba y vigencia manual por la función central ──────────────────────────────────────────
select public._parchar_funcion('public.iniciar_prueba_negocio_srv(uuid, uuid, plan_codigo, text, text, text, text, text, text, text)'::regprocedure,
  'v_fin := now() + make_interval(days => v_cfg.prueba_dias);', 'v_fin := public.suscripcion_fecha_limite(now(), v_cfg.prueba_dias);');
select public._parchar_funcion('public.iniciar_prueba_negocio_srv2(uuid, uuid, plan_codigo, text, text, text, text, text, text, text, text, text)'::regprocedure,
  'v_fin := now() + make_interval(days => v_cfg.prueba_dias);', 'v_fin := public.suscripcion_fecha_limite(now(), v_cfg.prueba_dias);');
select public._parchar_funcion('public.admin_activar_negocio_manual(uuid, text, plan_codigo, text, text, integer, text)'::regprocedure,
  'now() + make_interval(days => p_dias)', 'public.suscripcion_fecha_limite(now(), p_dias)');

drop function public._parchar_funcion(regprocedure, text, text, boolean);
commit;
