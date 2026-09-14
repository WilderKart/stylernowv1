# 06 — Payments UX

## Objetivo
Especificar la pantalla de pago de Seña y el flujo de propina, como implementación visual de `03-Business-Rules/03_Payment_Rules.md` y `08-Growth-Monetization/03_Tips_Distribution.md`.

## Alcance
UX de pago dentro del flujo de Reserva y de gestión de métodos de pago del perfil del Cliente. No cubre la integración técnica con la pasarela (`05-API/04_Payments.md`).

## Reglas

### Pantalla de pago de Seña (ver mockup `C6-BookingPay`)

- Resumen fijo en la parte superior: Servicio, Staff, fecha/hora, monto total, monto de Seña a pagar (destacado).
- Selector de método de pago: Nequi, PSE, tarjeta de crédito/débito (u otros habilitados por la pasarela). Métodos ya guardados del Cliente aparecen preseleccionados si existen.
- Aviso de seguridad visible ("Pago seguro procesado por Wompi") para generar confianza.
- Botón de acción único: "Pagar $[monto] y confirmar" — nunca dos botones de pago compitiendo en la misma pantalla.
- Estado de carga explícito mientras se espera la confirmación de la pasarela (nunca una pantalla congelada sin feedback, dado que la confirmación es asíncrona — `05-API/04_Payments.md`).

### Confirmación

Tras el pago aprobado: pantalla de confirmación con opción de "Agregar a calendario" (genera un archivo `.ics` o integración con calendario del dispositivo) y resumen final de la cita.

### Propina (ver `08-Growth-Monetization/03_Tips_Distribution.md`)

- Ofrecida en dos momentos posibles: opcionalmente durante el pago de Seña (estimación anticipada) y, por defecto recomendado, después de que la Reserva pasa a `COMPLETADA` (notificación push con acceso directo a agregar propina).
- Selector de monto: chips predefinidos (ej. 10%/15%/20% del valor del Servicio) + opción de monto personalizado. Ningún porcentaje sugerido está preseleccionado por defecto (el Cliente elige activamente, nunca un cargo tácito).

### Gestión de métodos de pago (Perfil, ver mockup `C8-UserProfile`)

Lista de métodos guardados, opción de agregar/eliminar, ninguno se muestra con el número completo (enmascarado, ej. "Nequi ****4471") — dato sensible nunca expuesto en claro en la UI.

## Estados
Refleja `04-Data-Model/03_State_Machines.md`, máquina "Pago".

## Permisos
Exclusivo de Cliente autenticado sobre sus propios pagos.

## Dependencias
- Depende de: `03-Business-Rules/03_Payment_Rules.md`, `08-Growth-Monetization/03_Tips_Distribution.md`, `05-API/04_Payments.md`.
- De este documento dependen: `07_Appointments.md`, `07-QA/07_Payments.md`.

## Casos límite

- **El pago tarda más de lo esperado en confirmarse** (latencia de la pasarela). La pantalla de carga tiene un timeout visual de UX razonable (ej. 30 segundos) tras el cual, si aún no hay respuesta, informa al Cliente que puede cerrar la app con seguridad porque recibirá una notificación cuando se confirme, sin dejarlo indefinidamente en una rueda de carga.
- **El pago es rechazado por la pasarela.** Mensaje de error específico si la pasarela lo provee (ej. "fondos insuficientes"), con opción inmediata de reintentar con otro método, sin perder la selección de Servicio/Staff/horario ya hecha (esos datos persisten mientras la Reserva original siga vigente en `PENDIENTE_PAGO` dentro de la ventana de 10 minutos).
- **El Cliente intenta agregar una propina superior a un límite razonable** (posible error de tipeo, ej. varios millones en vez de miles). La UI solicita confirmación explícita adicional para montos que excedan 3 veces el valor del Servicio, como protección contra errores de digitación, no como un límite duro de negocio.

## Criterios de aceptación
- [ ] Ninguna pantalla de pago permite doble envío del mismo cobro (botón se deshabilita tras el primer tap, consistente con `Idempotency-Key` de `05-API/01_Standards.md`).
- [ ] Ningún método de pago guardado se muestra con datos sensibles completos.
- [ ] La propina nunca aparece preseleccionada con un monto por defecto.

## Checklist
- [x] Completo
- [ ] Revisado
