# Recuperar una reserva cuyo bloqueo temporal expiró (migración 205)

**Principio:** expirar el bloqueo (10 min) significa perder el *bloqueo*, no el turno. La decisión se toma en el servidor, con la disponibilidad real.

## Auditoría previa (lo que ya existía y se reutilizó)
- Bloqueo = `reserva.estado = PENDIENTE_PAGO` + `expira_at` (10 min). `crear_reserva` lo crea y llama a `expirar_reservas_vencidas()` (cancela con motivo `PAGO_EXPIRADO` y rechaza pagos `PENDIENTE`). También corre en el cron diario.
- Anti-solapamiento atómico: restricciones `EXCLUDE` `reserva_sin_solape_staff` y `_recurso` sobre `rango`, para `PENDIENTE_PAGO/CONFIRMADA/EN_CURSO`.
- Disponibilidad: `slots_disponibles` (servicio activo y por sede, profesional activo y publicable, horario, ausencias, anticipación).
- Pago directo: `registrar_pago_directo_reserva` (migración 194) confirma la cita al subir el comprobante; `pago_reserva` conserva monto, hash, referencia.
- Reagendar existente (`reagendar_reserva`) mueve la MISMA reserva; se siguió el mismo criterio (no se crean reservas nuevas).
- **El defecto:** `registrar_pago_directo_reserva`, `aceptar_politica_reserva` y el cobro respondían `RESERVA_NO_PAGABLE` («expiró o cambió de estado») aunque el horario siguiera libre, y un comprobante de una transferencia ya hecha se rechazaba.

## Qué hace ahora
| Situación (`reserva_estado_recuperacion`) | Qué ve el cliente |
|---|---|
| `VIGENTE` | La pantalla de pago normal |
| `DISPONIBLE` | «Tu tiempo de reserva terminó… el horario todavía está disponible» → **CONTINUAR CON ESTE HORARIO** (nuevo bloqueo de 10 min sobre la misma reserva) |
| `NO_DISPONIBLE` | «Este horario ya no está disponible» → **VER OTROS HORARIOS** (alternativas reales, se mueve la misma reserva) |
| `PAGO_REPORTADO_DISPONIBLE` | «Recibimos tu comprobante» → **RECUPERAR MI TURNO** (queda confirmada, sin pagar otra vez) |
| `PAGO_REPORTADO_NO_DISPONIBLE` | «Tu pago está registrado» → elegir otro horario; el comprobante, monto y referencia se conservan |
| `NO_RECUPERABLE` | Cancelaciones reales: no se revierten; invita a reservar de nuevo |

## Seguridad y concurrencia
- Todo en funciones `SECURITY DEFINER` con `auth.uid()`; solo el cliente dueño de la reserva (otro recibe «no encontrada»). Las internas (`_reserva_cupo`, `_reserva_recuperar_interno`) no se ejecutan desde la API; `anon` sin acceso.
- La reserva se bloquea `FOR UPDATE` (reintentos/doble clic del mismo cliente quedan idempotentes) y el turno se re-adquiere con un `UPDATE` que pasa por las restricciones `EXCLUDE`: si otro cliente lo tomó entre la consulta y la adquisición, el `UPDATE` falla y se responde `NO_DISPONIBLE`. No hay consulta-y-luego-escritura sin protección.
- El comprobante nunca se elimina ni se confirma solo: queda `REPORTADO` y lo verifica el negocio, como en todo pago directo.
- El SuperSU no interviene.

## Pruebas
- `tests/sql/recuperar_reserva_bloqueo.sql` — recuperación con turno libre, reintentos sin duplicados, turno ocupado + alternativas + reubicación de la misma reserva, comprobante con y sin turno libre (conservación), servicio inactivo, profesional retirado, accesos ajenos / anónimo / edición directa / función interna, cancelación real, reserva confirmada.
- `tests/sql/recuperar_reserva_concurrencia.sh` — dos sesiones simultáneas con el mismo turno: gana una, la otra espera el candado y recibe `NO_DISPONIBLE`.
- Navegador (local): escenarios A y B completos.

## Riesgos pendientes
- `expirar_reservas_vencidas()` se invoca al diagnosticar (como `crear_reserva`); es global y barato, pero cada visita a esa pantalla lo ejecuta.
- Pago con **Mercado Pago**: si el cliente paga *después* de expirar, la lógica existente (`aplicar_evento_pago`) reembolsa porque la reserva ya no está pendiente; no se cambió.
- El comprobante guardado queda en una reserva que el negocio ve cancelada hasta que el cliente elige otro horario; el aviso al dueño ya existía.
