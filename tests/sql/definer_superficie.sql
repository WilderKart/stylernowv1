-- Fase 1 (T2) — Mínimo privilegio sobre funciones SECURITY DEFINER (migración 180).
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/definer_superficie.sql
-- Base LOCAL únicamente. Verifica que las funciones `service_role`-only (cron, webhooks,
-- OAuth, pagos, notificaciones, rate limiting) NO sean ejecutables por anon/authenticated.

begin;

do $$
declare
  v_nombres text[] := array[
    'oauth_iniciar', 'oauth_consumir', 'conexion_guardar', 'conexion_marcar_estado', 'conexion_renovar_tokens',
    'reembolso_registrar_resultado', 'reembolso_tomar_pendientes', '_reembolso_crear',
    'webhook_registrar', 'webhook_registrar_resultado', 'aplicar_evento_pago',
    'registrar_evento_patrocinado',
    'verificar_rate_limit_auth', 'registrar_intento_auth', 'consumir_cupo', 'incrementar_session_version',
    'notif_generar_programadas', 'notif_entregar_panel', 'notif_outbox_reencolar_no_habilitados',
    'notif_outbox_tomar', 'notif_push_eliminar_endpoint', 'notif_outbox_registrar',
    'avisos_prueba_pendientes', 'marcar_aviso_prueba', 'pruebas_por_cobrar',
    'registrar_resultado_cobro', 'mantenimiento_suscripciones',
    'expirar_reservas_vencidas', 'ejecutar_downgrades_programados', 'otorgar_creditos_plan_mensual',
    'generar_roi_snapshot_mensual', 'limpiar_limite_tasa', 'generar_recordatorios_cita',
    'aplicar_comisiones_programadas', 'whatsapp_otorgar_lotes_plan_mes',
    'cuentas_registro_abandonado', 'procesar_eliminaciones_cuenta', 'marcar_auth_cerrada'
  ];
  v text;
begin
  select string_agg(p.proname, ', ') into v
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.proname = any (v_nombres)
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if v is not null then
    raise exception 'FALLA T2: funciones service_role-only ejecutables por anon/authenticated: %', v;
  end if;

  -- Y service_role SÍ debe poder ejecutarlas (no se rompió el backend).
  select string_agg(p.proname, ', ') into v
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.proname = any (v_nombres)
     and not has_function_privilege('service_role', p.oid, 'execute');
  if v is not null then
    raise exception 'FALLA T2: funciones que service_role necesita y perdió acceso: %', v;
  end if;

  raise notice 'OK T2: superficie definer reducida y backend intacto';
end $$;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE SUPERFICIE DEFINER PASARON'; end $$;
rollback;
