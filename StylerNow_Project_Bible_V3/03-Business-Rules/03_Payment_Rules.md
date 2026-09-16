# 03 — Payment Rules

## Objetivo
Definir cómo se cobra, reembolsa y concilia cada peso que pasa por StylerNow, para que un error de pago nunca dependa de una decisión ad-hoc de soporte.

## Alcance
Reglas de negocio de pagos (Seña, saldo, reembolsos, disputas). La integración técnica con la pasarela vive en `05-API/04_Payments.md`; la idempotencia de webhooks vive en `05-API/06_Webhooks.md` y se referencia aquí. El reparto de comisión y propina vive en `08-Growth-Monetization/02_Commissions.md` y `03_Tips_Distribution.md`.

## Reglas

### Componentes de un cobro

1. **Seña (Deposit)** — monto parcial cobrado al confirmar la Reserva, vía pasarela (Wompi u otras habilitadas: Nequi, PSE, tarjeta). Es el único monto que StylerNow procesa directamente como intermediario de pago en V1.
2. **Saldo** — el resto del valor del Servicio, cobrado por el Negocio directamente en Sede (efectivo, datáfono propio, u otro medio ajeno a StylerNow), salvo que el Negocio habilite "pago completo en app" (opcional, por Negocio).
3. **Propina** — opcional, agregada por el Cliente antes o después de la cita, dirigida a un Staff específico (`08-Growth-Monetization/03_Tips_Distribution.md`).

### Cálculo de la Seña

- El Negocio configura la Seña como un **monto fijo** o un **porcentaje del valor del Servicio**, por Servicio o como regla general del Negocio (el valor por Servicio, si existe, sobreescribe la regla general).
- Por defecto de plataforma (aplicable si el Negocio no configura nada): 20% del valor del Servicio, con un mínimo de $10.000 COP y un máximo de $50.000 COP por Reserva.
- La Seña nunca puede ser mayor al valor total del Servicio.

### Estados de pago

Ver máquina de estados completa en `04-Data-Model/03_State_Machines.md`. Resumen normativo:

- `PENDIENTE` — la pasarela no ha confirmado el cobro. La Reserva asociada permanece en `PENDIENTE_PAGO` (no bloquea el horario más de 10 minutos — ver Caso límite de expiración).
- `APROBADO` — la pasarela confirmó el cobro. Dispara la transición de la Reserva a `CONFIRMADA`.
- `RECHAZADO` — la pasarela rechazó el cobro. La Reserva vuelve a estar disponible para otro Cliente inmediatamente.
- `REEMBOLSADO` — el monto fue devuelto íntegramente al Cliente.
- `REEMBOLSADO_PARCIAL` — se devolvió una parte (ver regla de reembolso parcial).
- `EN_DISPUTA` — el Cliente inició un contracargo ante su banco/pasarela; congela cualquier reembolso automático hasta resolución manual por SuperSU.

### Política de reembolso de la Seña según ventana de cancelación

| Cancelación iniciada por | Ventana | Reembolso |
|---|---|---|
| Cliente | Más de 24h antes de la cita | 100% |
| Cliente | Entre 24h y 2h antes | 50% |
| Cliente | Menos de 2h antes | 0% (la Seña se retiene como compensación al Negocio por el espacio bloqueado) |
| Negocio (cualquier motivo) | Cualquier momento | 100%, siempre |
| Plataforma (Negocio suspendido, fraude, etc.) | Cualquier momento | 100%, siempre |

Estos umbrales (24h, 2h, 50%) son el valor por defecto de plataforma; un Negocio en Plan Jarl o superior puede configurar sus propios umbrales dentro de un rango que SuperSU define (mínimo de reembolso nunca inferior al 0%, ventana mínima de "reembolso total" nunca inferior a 6 horas, para proteger al Cliente de políticas abusivas).

### Reembolso parcial

Aplica cuando: (a) el Cliente cancela dentro de la ventana de 50%, (b) el Negocio completa la cita pero con un Servicio distinto/menor al reservado (ajuste manual, requiere justificación registrada), o (c) resolución de una disputa por SuperSU. Todo reembolso parcial requiere un motivo de un catálogo cerrado (no texto libre sin categorizar), para que sea auditable y reportable.

### Idempotencia de webhooks de pasarela

Regla de negocio (implementación técnica en `05-API/06_Webhooks.md`): **un mismo evento de pasarela nunca puede generar dos efectos de negocio**. Cada notificación de la pasarela trae un identificador único de transacción; si StylerNow ya procesó ese identificador, el webhook se reconoce y se responde `200 OK` sin repetir la transición de estado ni notificar dos veces al Cliente. Esto cubre explícitamente el escenario "Wompi duplica un webhook" mencionado como pregunta abierta en la misión original: la respuesta es que el sistema es idempotente por diseño, no por buena suerte.

### Pago expirado

Una Reserva en `PENDIENTE_PAGO` que no recibe confirmación de pago dentro de 10 minutos se cancela automáticamente y el horario vuelve a estar disponible. Si la pasarela confirma el pago **después** de la expiración (caso de latencia de red), el monto se reembolsa automáticamente al 100% y se notifica al Cliente para que intente reservar de nuevo, sin necesidad de intervención de soporte.

### Gift Cards y Membresías (pagos no ligados a una Reserva única)

- Una Gift Card se compra como una transacción independiente; su saldo se aplica como método de pago válido para la Seña o el saldo de una Reserva futura, sin comisión de plataforma adicional sobre su redención (la comisión ya se cobró, si aplica, al momento de la compra de la Gift Card).
- Una Membresía (ver `03-Business-Rules/04_Lealtad.md`) genera cobros recurrentes gestionados igual que una suscripción: mismas reglas de fallo de cobro que `08-Growth-Monetization/05_Billing_Failures.md`.

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquina "Pago".

## Permisos
- El Cliente inicia el cobro de su propia Seña; no puede modificar el monto (lo define el Negocio/plataforma).
- La Barbería configura el % o monto de Seña y la política de cancelación de su Negocio (dentro de los rangos permitidos por SuperSU).
- Solo SuperSU resuelve una disputa (`EN_DISPUTA`) o autoriza un reembolso fuera de las reglas automáticas.

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `Glossary.md`.
- De este documento dependen: `05-API/04_Payments.md`, `05-API/06_Webhooks.md`, `06-Security/03_Fraud.md`, `08-Growth-Monetization/02_Commissions.md`, `08-Growth-Monetization/03_Tips_Distribution.md`, `08-Growth-Monetization/05_Billing_Failures.md`.

## Casos límite

- **Webhook duplicado de Wompi.** Resuelto por la regla de idempotencia de arriba — se ignora el segundo evento con el mismo id de transacción, se responde `200 OK`, no se duplica el efecto de negocio.
- **Reembolso parcial cuando el Cliente ya usó parte del servicio** (ej. cancela después de iniciado, caso raro pero posible con Reservas de larga duración). Se trata como cancelación iniciada por el Cliente con 0% de ventana (ya en curso) salvo que el Negocio decida manualmente lo contrario, registrado como reembolso parcial con motivo "cortesía comercial".
- **Pago expirado que la pasarela confirma tarde.** Ver regla explícita arriba: reembolso automático al 100%, nunca se deja el dinero retenido sin Reserva asociada.
- **El Cliente disputa un cobro ante su banco (contracargo) mientras la Reserva ya fue `COMPLETADA`.** El estado de pago pasa a `EN_DISPUTA`; el Servicio ya prestado no se revierte, pero el caso se congela para revisión manual de SuperSU, quien decide si compensa al Negocio desde un fondo de disputas (política de negocio, no automatizada en V1).
- **Un Negocio configura una Seña del 20% pero el valor mínimo de $10.000 supera el 20% del Servicio** (ej. Servicio de $30.000, 20% = $6.000, pero el mínimo es $10.000). Gana el mínimo configurado, salvo que el mínimo supere el 100% del valor del Servicio, en cuyo caso la Seña se limita al 100% del Servicio (nunca se cobra más del valor total).

## Criterios de aceptación
- [ ] Todo webhook de pasarela es procesado de forma idempotente, verificable con una prueba que envía el mismo evento dos veces y confirma un solo efecto de negocio.
- [ ] Toda Reserva `PENDIENTE_PAGO` expira automáticamente a los 10 minutos sin intervención manual.
- [ ] Todo reembolso parcial tiene un motivo de un catálogo cerrado, nunca texto libre sin categoría.

## Checklist
- [x] Completo
- [ ] Revisado
