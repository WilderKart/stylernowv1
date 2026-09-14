# 07 — Appointments UX (Mis Citas)

## Objetivo
Especificar la pantalla de gestión de citas del Cliente (próximas e historial), como implementación visual de las transiciones de `04-Data-Model/03_State_Machines.md`, máquina "Reserva".

## Alcance
Vista del Cliente sobre sus propias Reservas. La vista equivalente para Staff/Negocio está en `08_Staff_App.md` y `09_Business_Panel.md`.

## Reglas

### Estructura (ver mockup `C7-MyAppointments`)

Dos pestañas: **Próximas** y **Historial**.

**Próximas**: Reservas en `PENDIENTE_PAGO` (raro que llegue a verse, expira rápido), `CONFIRMADA`, `EN_CURSO`. La más próxima en el tiempo se destaca visualmente arriba con badge de estado ("CONFIRMADA") y acciones directas: Reagendar, Cancelar.

**Historial**: Reservas `COMPLETADA`, `CANCELADA`, `NO_SHOW`. Cada una con acceso a "Calificar" si es `COMPLETADA` y aún no tiene `resena` asociada (ventana de calificación: ver Casos límite).

### Detalle de una Reserva

Al tocar una Reserva: Servicio(s), Staff, Sede con dirección/mapa, monto pagado (Seña) y saldo pendiente (si aplica), estado del pago, y — si está `CANCELADA` o `NO_SHOW` — el detalle del reembolso aplicado (`03-Business-Rules/03_Payment_Rules.md`), para que el Cliente entienda exactamente cuánto y por qué se le devolvió o no.

### Acciones

- **Reagendar**: disponible solo si la Reserva está `CONFIRMADA` y dentro de la ventana permitida (`03-Business-Rules/02_Booking_Rules.md`) — reutiliza el flujo de `05_Booking.md` a partir del Paso 3 (mismo Servicio/Staff, nuevo horario).
- **Cancelar**: solicita confirmación explícita mostrando el monto exacto de reembolso que corresponde según la ventana vigente (`03-Business-Rules/03_Payment_Rules.md`) — el Cliente ve la cifra antes de confirmar, nunca después.
- **Calificar**: abre el formulario de reseña (estrellas + comentario opcional), disponible dentro de los 30 días posteriores a `COMPLETADA`.

## Estados
Esta pantalla es una vista directa sobre `04-Data-Model/03_State_Machines.md`, máquina "Reserva" — no introduce estados propios.

## Permisos
Exclusivo de Cliente autenticado sobre sus propias Reservas.

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `03-Business-Rules/03_Payment_Rules.md`, `04-Data-Model/03_State_Machines.md`.
- De este documento dependen: `07-QA/02_Client.md`.

## Casos límite

- **Una Reserva pasa a `NO_SHOW` mientras el Cliente tenía la pantalla de "Próximas" abierta.** La UI se actualiza (vía notificación en tiempo real o al refrescar) y la Reserva se mueve automáticamente a "Historial" sin que el Cliente tenga que hacer nada.
- **El Cliente intenta calificar una Reserva después de 30 días.** La opción "Calificar" desaparece de la UI; no hay excepción manual en V1 (una reseña muy tardía tiene menor valor de señal para el Marketplace).
- **El Cliente tiene una Reserva `CANCELADA` por el Negocio y quiere entender por qué.** El detalle de la Reserva muestra el motivo si el Negocio lo proporcionó al cancelar (campo opcional en el flujo de cancelación de `09_Business_Panel.md`), o un mensaje genérico si no se proporcionó, nunca un vacío sin explicación.

## Criterios de aceptación
- [ ] El monto de reembolso mostrado antes de confirmar una cancelación coincide exactamente con el monto que efectivamente se procesa.
- [ ] Ninguna Reserva completada permite calificación después de 30 días, validado también server-side, no solo ocultando el botón.

## Checklist
- [x] Completo
- [ ] Revisado
