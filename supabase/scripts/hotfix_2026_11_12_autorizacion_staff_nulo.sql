-- HOTFIX de seguridad (P0), para pegar YA en el SQL editor de Supabase (no es una migración numerada:
-- la 116 incluye la misma corrección, así que aplicar ambos es seguro e idempotente).
-- Autorización que se evalúa a NULL cuando la reserva no tiene staff.
--
-- Encontrado el 2026-11-12 por las pruebas de la Directiva (tests/sql/directiva_116_118.sql) y
-- verificado en la definición vigente de producción.
--
-- En SQL, `v_reserva.staff_id = auth.uid()` con staff_id NULL da NULL (no false). En:
--   v_autorizado := is_barberia_de(...) or is_guardian_de_sede(...) or v_reserva.staff_id = auth.uid();
--   if not v_autorizado then raise exception 'NO_AUTORIZADO'; end if;
-- un usuario ajeno obtiene false OR false OR NULL = NULL, `not NULL` = NULL y el IF no se ejecuta:
-- la función NO rechaza al intruso. Afecta a:
--   * cancelar_reserva: cualquier usuario autenticado podía cancelar una reserva ajena sin staff
--     asignado (y la cancelación del propio cliente se trataba como del negocio: 100 % de reembolso).
--   * completar_venta_pos: cualquier usuario autenticado podía cerrar la venta POS (y registrar
--     pagos) de una reserva ajena sin staff asignado.
--
-- Independiente del resto: se puede aplicar YA. Parchea el texto vigente con verificación; si el
-- texto esperado no está, falla sin cambiar nada. La 116 reemplaza cancelar_reserva completa
-- con la misma corrección.

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.cancelar_reserva(uuid,text)'::regprocedure);
  if position('or v_reserva.staff_id = v_actor;' in v_def) > 0 then
    v_def := replace(v_def, 'v_es_cliente := v_reserva.cliente_id = v_actor;',
                            'v_es_cliente := coalesce(v_reserva.cliente_id = v_actor, false);');
    v_def := replace(v_def, 'v_es_negocio := public.is_barberia_de(v_reserva.negocio_id)',
                            'v_es_negocio := coalesce(public.is_barberia_de(v_reserva.negocio_id), false)');
    -- \s+ tolera CRLF al pegar desde un editor en Windows.
    v_def := regexp_replace(v_def, 'or\s+public\.is_guardian_de_sede\(v_reserva\.sede_id\)(\s+)or\s+v_reserva\.staff_id\s*=\s*v_actor;',
                            'or coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)\1or coalesce(v_reserva.staff_id = v_actor, false);');
    if position('coalesce(v_reserva.staff_id = v_actor, false)' in v_def) = 0 then
      raise exception 'cancelar_reserva: el parche no encontró el texto esperado; revisar a mano';
    end if;
    execute v_def;
  elsif position('coalesce(v_reserva.staff_id = v_actor, false)' in v_def) = 0 then
    raise exception 'cancelar_reserva cambió y no tiene la corrección: revisar a mano';
  end if;
end $$;

do $$
declare
  r record;
  v_def text;
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

-- Los grants no cambian con CREATE OR REPLACE, pero se reafirman (regla del proyecto: los 3 roles).
revoke all on function public.cancelar_reserva(uuid, text) from public, anon;
grant execute on function public.cancelar_reserva(uuid, text) to authenticated;
