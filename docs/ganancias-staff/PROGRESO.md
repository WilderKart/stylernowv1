# Ganancias del staff — progreso (actualizar en cada hito)

## Hecho
- Investigación (fase 1): no existía registro de ganancias/liquidaciones. Reutilizado: `vinculo_staff_negocio.comision_pct` (fallback), `evento_auditoria`/`_auditar`, `is_barberia_de`, `is_supersu`, `completar_venta_pos`/`completar_reserva_sin_pos` (ambos terminan en reserva.estado = COMPLETADA).
- Migración 201 (local aplicada y probada; **NO aplicada en prod**): tablas `ganancia_permiso`, `comision_regla`, `staff_ganancia`, `ganancia_liquidacion(_item)`, `ganancia_ajuste`, `ganancia_pago`, `ganancia_novedad`, `ganancia_revision`, `soporte_acceso_ganancias`; trigger sobre `reserva`; RPC de reglas/lectura/liquidación/pagos/novedades/revisión/soporte.
- Prueba `tests/sql/ganancias_staff.sql` (identidades reales, aislamiento, idempotencia, POS real, soporte con expiración): OK.
- Regresión local: definer_superficie, pagos_whatsapp_mi_marca, publicidad, limites_plan_156 OK. `aislamiento_multiempresa` falla por CHECKIN_SOLO_EL_DIA (previo, depende de fecha); `libro_122`/`auditoria_123` chocan con el SuperSU único local (previo).

## Pendiente
- UI panel negocio (`/panel/ganancias`), UI profesional (`/staff/ganancias`), exportación CSV, navegación, tests vitest.
- Auditoría independiente, aplicar 201 en prod (+registro en schema_migrations), push a main, verificación.
- Documentos: ARQUITECTURA, REGLAS_COMISION, MATRIZ_PERMISOS, SEGURIDAD, MODELO_DATOS, GUIA_*, PRUEBAS, AUDITORIA_FINAL, VULNERABILIDADES_Y_MEJORAS.

## Actualización 2026-11-26 (despliegue)
- Migración 201 **aplicada en producción** (transacción única) y registrada como `20261126060000`. Verificado: 10 tablas con RLS, 2 triggers, `anon` sin ejecución, internas no invocables, sin INSERT directo, 1 SuperSU, 0 reservas completadas previas.
- Pruebas: vitest 367 OK; SQL ganancias_staff OK; build y lint OK. Verificación visual local de panel, liquidaciones, reglas, novedades, permisos y vista del profesional.
- No verificado en producción con pagos/servicios reales (aún no hay servicios completados).
