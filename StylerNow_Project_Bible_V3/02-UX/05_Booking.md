# 05 — Booking UX

## Objetivo
Especificar, pantalla por pantalla, el flujo de reserva del Cliente — el momento de mayor valor del producto — como implementación visual de `03-Business-Rules/02_Booking_Rules.md`.

## Alcance
Flujo de selección de Servicio, Staff y horario, hasta el resumen previo al pago (el pago en sí es `06_Payments.md`). Incluye la oferta de Lista de espera cuando no hay disponibilidad.

## Reglas

### Paso 1 — Selección de Servicio(s)

Desde el perfil del Negocio (`04_Marketplace.md`), el Cliente selecciona uno o más Servicios (combo, `03-Business-Rules/02_Booking_Rules.md`). La UI muestra el subtotal y duración acumulada en tiempo real conforme se agregan Servicios.

### Paso 2 — Selección de Staff (ver mockup `C5-BookingFlow`)

- Lista de Staff que puede prestar el/los Servicio(s) seleccionados (`staff_servicio`, `04-Data-Model/02_Relationships.md`), con foto, nombre y badge de Nivel si aplica.
- Opción "Cualquiera disponible" siempre presente y visualmente distinta (no es "otro Staff más", se comunica como la opción más rápida).

### Paso 3 — Selección de horario

- Calendario semanal/mensual con navegación por flechas.
- Grid de horarios disponibles del día seleccionado, ya filtrados por las 7 validaciones de `03-Business-Rules/02_Booking_Rules.md` (nunca se muestra un slot que fallará al confirmar).
- Slots no disponibles se muestran tachados/deshabilitados, no simplemente ausentes, para que el Cliente entienda que existían pero están ocupados (mejor comprensión que un vacío silencioso).
- Si no hay disponibilidad en el rango visible, se ofrece explícitamente el botón "Avisarme cuando haya cupo" → entra al flujo de `03-Business-Rules/10_Waitlist_System.md`.

### Paso 4 — Resumen

Antes de pasar a pago: Servicio(s), Staff, Sede, fecha/hora, precio total, monto de Seña a pagar, política de cancelación aplicable (resumida, con link a detalle completo) — el Cliente nunca paga sin ver la política de cancelación primero.

## Estados
Refleja el estado `PENDIENTE_PAGO` de `04-Data-Model/03_State_Machines.md` desde el momento en que el Cliente confirma el resumen y pasa a pago.

## Permisos
Exclusivo de Cliente autenticado (no existe modo invitado, `04-Data-Model/01_Entities.md`).

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `03-Business-Rules/10_Waitlist_System.md`, `05-API/03_Bookings.md`.
- De este documento dependen: `06_Payments.md`, `07-QA/02_Client.md`.

## Casos límite

- **El Cliente selecciona Servicios que ningún Staff individual puede prestar juntos** (especialidades distintas sin traslape). La UI lo indica explícitamente en el Paso 2 ("Ningún profesional ofrece esta combinación") y sugiere reservar por separado — consistente con `03-Business-Rules/02_Booking_Rules.md`, regla de combos sin Staff único.
- **El Cliente vuelve atrás desde el Paso 3 al Paso 1 y cambia el Servicio.** El horario previamente seleccionado se descarta (la duración pudo cambiar); el Cliente repite la selección de horario desde cero, sin quedar en un estado inconsistente.
- **El slot elegido deja de estar disponible entre el Paso 3 y el envío del Paso 4** (otro Cliente lo tomó primero). Al intentar pasar a pago, la validación se repite server-side (`05-API/03_Bookings.md`) y, si falla, el Cliente regresa automáticamente al Paso 3 con un mensaje claro y el grid ya actualizado.

## Criterios de aceptación
- [ ] Ningún slot mostrado como disponible en el Paso 3 falla al confirmarse en el mismo flujo continuo, salvo condición de carrera genuina (cubierta arriba).
- [ ] El Cliente siempre ve la política de cancelación antes de pagar, sin excepción.
- [ ] La oferta de Lista de espera aparece siempre que no hay disponibilidad visible, nunca se omite silenciosamente.

## Checklist
- [x] Completo
- [ ] Revisado
