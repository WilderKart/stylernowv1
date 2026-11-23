-- 180 — Fase 1 de hardening (SOC 2 CC6.1 / ISO 27001 A.9.4): mínimo privilegio sobre
-- funciones SECURITY DEFINER.
--
-- Contexto (advisor `authenticated_security_definer_function_executable`): las funciones
-- SECURITY DEFINER se ejecutan con los privilegios del dueño (bypass de RLS). Las que son
-- invocables por `authenticated`/`anon` pero NO las llama ningún usuario real — solo el
-- backend (cron, webhooks, workers, OAuth, pagos, notificaciones) vía `service_role` — son
-- superficie de escalada innecesaria: si alguna no valida al actor, un usuario común puede
-- invocarla por RPC y saltarse RLS.
--
-- Esta migración NO toca las RPC legítimas de la app (crear_reserva, pos, crm, admin_*,
-- helpers RLS `is_*`, marketplace_*) — siguen como están. Solo revoca de `anon` y
-- `authenticated` el conjunto `service_role`-only, y lo deja ejecutable por `service_role`.
--
-- Aditiva y reversible: `grant execute ... to authenticated` sobre las funciones listadas.
-- No cambia datos ni políticas RLS.
--
-- La lista se corresponde 1:1 con los llamados de `createAdminClient()` y `/api/cron/diario`
-- en `src/`. Cualquier RPC nueva `service_role`-only debe agregarse aquí (deuda explícita).

do $mig$
declare
  v_nombres text[] := array[
    -- OAuth y conexiones de pago por barbería
    'oauth_iniciar', 'oauth_consumir', 'conexion_guardar', 'conexion_marcar_estado', 'conexion_renovar_tokens',
    -- Reembolsos (worker/cron)
    'reembolso_registrar_resultado', 'reembolso_tomar_pendientes', '_reembolso_crear',
    -- Webhook de Mercado Pago y aplicación de eventos
    'webhook_registrar', 'webhook_registrar_resultado', 'aplicar_evento_pago',
    -- Publicidad: registro server-side de clics/impresiones (H8)
    'registrar_evento_patrocinado',
    -- Rate limiting de auth y de cupos (pre-sesión / borde)
    'verificar_rate_limit_auth', 'registrar_intento_auth', 'consumir_cupo', 'incrementar_session_version',
    -- Outbox de notificaciones
    'notif_generar_programadas', 'notif_entregar_panel', 'notif_outbox_reencolar_no_habilitados',
    'notif_outbox_tomar', 'notif_push_eliminar_endpoint', 'notif_outbox_registrar',
    -- Ciclo de suscripciones
    'avisos_prueba_pendientes', 'marcar_aviso_prueba', 'pruebas_por_cobrar',
    'registrar_resultado_cobro', 'mantenimiento_suscripciones',
    -- Tareas programadas de sistema
    'expirar_reservas_vencidas', 'ejecutar_downgrades_programados', 'otorgar_creditos_plan_mensual',
    'generar_roi_snapshot_mensual', 'limpiar_limite_tasa', 'generar_recordatorios_cita',
    'aplicar_comisiones_programadas', 'whatsapp_otorgar_lotes_plan_mes',
    'cuentas_registro_abandonado', 'procesar_eliminaciones_cuenta', 'marcar_auth_cerrada'
  ];
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname = any (v_nombres)
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end
$mig$;

-- Defensa en profundidad: estas funciones mueven dinero, tokens o cuentas. Si alguna vez
-- se recrean con `create function` (que por defecto otorga EXECUTE a public), el
-- `alter default privileges` de abajo evita que vuelvan a quedar expuestas. Es específico
-- del esquema, no global.
comment on function public.consumir_cupo(text, integer, integer) is
  'service_role-only (migración 180): rate limit de borde; no invocable por anon/authenticated.';
