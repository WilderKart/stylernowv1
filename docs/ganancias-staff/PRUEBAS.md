# Pruebas

| Suite | Qué cubre | Cómo correr |
|---|---|---|
| `tests/sql/ganancias_staff.sql` | Generación automática (estado y **flujo real del POS**), idempotencia (reproceso, reabrir/completar), inmutabilidad, reglas (jerarquía, solape, permisos, rangos, negocio ajeno, versionado), aislamiento (profesional vs. profesional, negocio A vs. B, admin de sede, permiso de sede vs. negocio), RLS directa, escritura directa denegada, liquidación (doble cierre, pagos parciales, sobrepago, doble clic, anulación, reversión, re-cierre), novedades (sin duplicados, justificación), revisión (una abierta, no auto-responder), soporte (sin sesión, sin autorización, con sesión, otro negocio, no-escritura, otro usuario, expirado), auditoría | `docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/ganancias_staff.sql` (transacción con `rollback`) |
| `tests/ganancias-lib.test.ts` | CSV seguro, rangos rápidos, validación de filtros | `npx vitest run tests/ganancias-lib.test.ts` |
| Regresión SQL | `definer_superficie`, `pagos_whatsapp_mi_marca`, `publicidad_saldo_y_sedes_extra`, `limites_plan_156` | mismo comando con cada archivo |

Verificación visual local: build de producción contra el Supabase local con datos de ejemplo (ver `EVIDENCIAS.md`).
