-- 178: el cron diario (/api/cron/diario, clave service_role) puede ejecutar las cuatro funciones de mantenimiento que llama.
--
-- Hallazgo: ejecutar_downgrades_programados, expirar_reservas_vencidas, generar_roi_snapshot_mensual y otorgar_creditos_plan_mensual solo tenían
-- ACL de postgres, así que la llamada del cron con service_role fallaba con permiso denegado.
-- Patrón del proyecto: REVOKE de public, anon y authenticated (los tres son independientes) + GRANT solo a service_role.
-- Seguridad: no se abre nada al navegador; las funciones siguen siendo solo de servidor. No toca datos.
-- Reversión: 178_cron_diario_service_role_execute_REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

do $$
declare
  v_firma text;
  v_firmas constant text[] := array[
    'public.ejecutar_downgrades_programados()',
    'public.expirar_reservas_vencidas()',
    'public.generar_roi_snapshot_mensual()',
    'public.otorgar_creditos_plan_mensual()'
  ];
begin
  foreach v_firma in array v_firmas loop
    -- Debe existir con esa firma exacta; si no, se aborta sin cambios.
    if to_regprocedure(v_firma) is null then
      raise exception 'FUNCION_NO_ENCONTRADA % (firma exacta requerida)', v_firma;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', v_firma);
    execute format('grant execute on function %s to service_role', v_firma);
  end loop;
end $$;

commit;
