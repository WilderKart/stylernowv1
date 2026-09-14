# 06 — Webhooks

## Objetivo
Especificar el contrato técnico exacto de idempotencia y validación de webhooks entrantes (pasarela de pago) y salientes (integraciones futuras de Negocios Allfather), como implementación de la regla de negocio ya fijada en `03-Business-Rules/03_Payment_Rules.md`.

## Alcance
Webhooks entrantes de pasarela de pago (V1) y el diseño de webhooks salientes (Allfather, fase posterior). No cubre notificaciones push/WhatsApp al usuario final (`02-UX/11_Notifications.md`, un mecanismo distinto).

## Reglas

### Webhooks entrantes (pasarela de pago)

**Endpoint:** `POST /v1/webhooks/pasarela/{proveedor}` (ej. `.../pasarela/wompi`).

**Validación de autenticidad (antes que cualquier otra cosa):**
1. Verificar la firma HMAC del payload contra el secreto compartido específico del proveedor.
2. Si la firma no es válida: `401 UNAUTHORIZED`, no se procesa nada, se registra el intento en `10-Operations/04_Logs_Policy.md` como posible intento de suplantación.

**Idempotencia (regla de negocio ya fijada en `03-Business-Rules/03_Payment_Rules.md`, aquí su implementación exacta):**
1. Extraer el `id_transaccion_pasarela` del payload.
2. Buscar si ya existe un `pago` con ese `id_transaccion_pasarela` en un estado terminal (`APROBADO`, `RECHAZADO`) que ya fue procesado.
3. Si existe: responder `200 OK` inmediatamente sin ejecutar ningún efecto de negocio adicional (ni notificar de nuevo, ni recalcular comisión).
4. Si no existe o está en estado no terminal: procesar el evento, aplicar la transición de estado correspondiente (`04-Data-Model/03_State_Machines.md`), y **solo entonces** responder `200 OK`.

**Regla de respuesta rápida:** el endpoint responde `200 OK` en menos de 3 segundos incluso si el procesamiento downstream (notificaciones, recálculo de comisión) toma más tiempo — el procesamiento pesado se desacopla a una cola asíncrona, para que la pasarela nunca reintente por timeout percibido de nuestro lado (un reintento de la pasarela por timeout es indistinguible de un webhook duplicado legítimo, y la regla de idempotencia ya lo cubre, pero minimizar reintentos innecesarios reduce carga).

**Reintentos de la pasarela:** si nuestro endpoint responde `5xx` o no responde, se asume que la pasarela reintentará (comportamiento estándar de Wompi y proveedores similares) — nuestro sistema debe tolerar cualquier número de reintentos sin efecto acumulado, por la misma regla de idempotencia.

### Webhooks salientes (Allfather, diseño para fase posterior)

Un Negocio Allfather puede registrar una URL propia para recibir eventos (`reserva.confirmada`, `reserva.cancelada`, `pago.aprobado`). Reglas de diseño (no se implementa en V1, pero se documenta para no descubrirlo tarde):
- Cada evento saliente lleva su propio `id_evento` único y una firma HMAC generada con un secreto que StylerNow entrega al Negocio al registrar su endpoint.
- StylerNow reintenta un webhook saliente que falla (no-2xx) con backoff exponencial hasta 24 horas, luego lo marca como fallido y lo expone en un panel de "eventos no entregados" para reenvío manual.
- El Negocio receptor es responsable de su propia idempotencia del lado que recibe — StylerNow garantiza como mínimo "at-least-once", no "exactly-once", para webhooks salientes (a diferencia de los entrantes, donde StylerNow sí controla exactly-once del lado propio).

## Estados
No aplica una máquina de estados propia al webhook en sí — dispara transiciones sobre `pago` y `reserva` ya definidas en `04-Data-Model/03_State_Machines.md`.

## Permisos
No aplica un rol humano — la autenticación es por firma HMAC, no por token de usuario.

## Dependencias
- Depende de: `03-Business-Rules/03_Payment_Rules.md`, `04-Data-Model/03_State_Machines.md`, `05-API/01_Standards.md`.
- De este documento dependen: `06-Security/01_Security_Model.md` (validación de firma como control de seguridad), `10-Operations/04_Logs_Policy.md`, `07-QA/07_Payments.md` (caso de prueba obligatorio: enviar el mismo webhook dos veces).

## Casos límite

- **La pasarela envía un webhook de un `id_transaccion_pasarela` que no corresponde a ningún `pago` `PENDIENTE` conocido** (ej. la Reserva ya expiró y fue limpiada, o hay un desfase de datos). Se registra el evento igual (no se descarta silenciosamente) con estado `HUERFANO` para revisión manual, y se dispara un reembolso automático del monto si el webhook indica que el cobro sí se ejecutó del lado de la pasarela (consistente con la regla de "pago expirado que confirma tarde" de `03-Business-Rules/03_Payment_Rules.md`).
- **Dos webhooks distintos (aprobación y luego reembolso) llegan fuera de orden** (el de reembolso llega antes que el de aprobación, por un problema de red). El procesamiento valida la secuencia lógica: un reembolso sobre un `pago` que aún no está `APROBADO` se pone en cola de espera breve (reintento interno) antes de fallar, para tolerar pequeños desórdenes de llegada sin perder el evento.
- **La firma HMAC es válida pero el payload no corresponde al formato esperado del proveedor** (cambio de esquema no anunciado). Se responde `200 OK` (para no generar reintentos infinitos de un payload que nunca será válido) pero se registra como error crítico en `10-Operations/04_Logs_Policy.md` para atención inmediata del equipo — es la única excepción documentada a "todo error se refleja en el código de respuesta", justificada porque el problema aquí es nuestro, no del remitente, y generar reintentos no lo resuelve.

## Criterios de aceptación
- [ ] Un mismo webhook reenviado 10 veces produce exactamente un efecto de negocio, verificado con prueba automatizada.
- [ ] Ningún webhook se procesa sin validación de firma exitosa previa.
- [ ] El endpoint responde en menos de 3 segundos en el percentil 99, medido en `10-Operations/06_Analytics_Definitions.md`.

## Checklist
- [x] Completo
- [ ] Revisado
