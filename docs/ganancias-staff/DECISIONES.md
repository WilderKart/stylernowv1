# Decisiones de diseño — ganancias del staff
1. Generación en la base (trigger sobre reserva → COMPLETADA), no en la app: cubre agenda, POS y walk-in; idempotente por `unique(reserva_id, servicio_id)`.
2. Una fila por servicio de la reserva. Descuento = (suma de servicios − total de la reserva) + beneficio de membresía, prorrateado. Los descuentos por puntos no se persisten hoy en la reserva y no se reflejan (limitación documentada).
3. Jerarquía de reglas: puntaje 8·profesional + 4·servicio + 2·categoría + 1·sede; sin regla → `comision_pct` del vínculo (base NETO); sin nada → SIN_REGLA + novedad. Reglas activas del mismo alcance no pueden solaparse (trigger).
4. Ninguna escritura directa: RLS solo SELECT; escrituras por RPC SECURITY DEFINER con identidad de `auth.uid()`.
5. SuperSU no es bypass: solo lee con una sesión autorizada por el propietario (5–240 min), tomada por un único agente, que expira sola; solo lectura; cada lectura se audita.
6. Capacidades financieras explícitas (`ganancia_permiso`) por sede o de todo el negocio; un permiso de sede NO sirve para operaciones de negocio completo.
7. Cierres no se reescriben: ajustes (+/−), anulación de pagos, reversión de liquidación; todo auditado.
8. Reembolso posterior a la comisión: se crea una novedad (no se mueve dinero automáticamente).
9. Los pagos al profesional se REGISTRAN manualmente (no se afirma pago automático).
