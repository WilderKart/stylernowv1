# 05 — Billing Failures

## Objetivo
Definir exactamente qué pasa cuando el cobro recurrente de una suscripción (o de una Membresía de Cliente) falla, con plazos concretos, para que "el Negocio se quedó sin pagar" nunca dependa de una revisión manual descubierta tarde.

## Alcance
Fallos de cobro recurrente (suscripción SaaS de Negocio, Membresía de Cliente). Los fallos de un cobro puntual (Seña de una Reserva) se resuelven de forma distinta y más simple: ver `03-Business-Rules/03_Payment_Rules.md` (Reserva simplemente no se confirma, no hay "reintento" porque no hay compromiso previo).

## Reglas

### Flujo de reintentos — Suscripción de Negocio

1. **Día 0** — intento de cobro automático en la fecha de renovación. Si falla, la `suscripcion` pasa de `ACTIVA` a `EN_MORA` inmediatamente. El Negocio sigue operando con normalidad durante `EN_MORA` (no pierde funcionalidad todavía).
2. **Día 1** — notificación a la Barbería (push + email) informando el fallo y el método para actualizar su medio de pago.
3. **Día 3** — segundo intento automático de cobro.
4. **Día 7** — tercer intento automático de cobro, y segunda notificación con advertencia explícita de suspensión próxima.
5. **Día 10** — si los 3 intentos fallaron, la `suscripcion` pasa a `SUSPENDIDA` y el Negocio entra en el flujo de suspensión de `04_Subscriptions_Lifecycle.md`.

Este periodo de gracia de 10 días (Día 0 a Día 10) es el estándar de plataforma; no es configurable por el Negocio (evita que un Negocio se autoextienda gracia indefinidamente) pero SuperSU puede extenderlo manualmente caso por caso (ej. problema conocido de la pasarela) con motivo registrado en auditoría.

### Flujo de reintentos — Membresía de Cliente

Más corto, porque el impacto de un fallo es menor (afecta solo al beneficio de un Cliente, no a la operación completa de un Negocio):

1. **Día 0** — falla el cobro. La Membresía pasa a `SUSPENDIDA_POR_IMPAGO` (ver `03-Business-Rules/04_Loyalty.md`). El Cliente pierde el beneficio de la Membresía de inmediato (no hay gracia de uso, a diferencia de la suscripción de Negocio).
2. **Día 1** — notificación al Cliente.
3. **Día 5** — segundo y último intento automático.
4. **Día 5, si falla** — la Membresía pasa a `CANCELADA` definitivamente; el Cliente puede volver a suscribirse manualmente cuando quiera, generando una Membresía nueva.

### Actualización de medio de pago durante `EN_MORA`

La Barbería (o el Cliente, para Membresía) puede actualizar su medio de pago en cualquier momento del periodo de gracia; al hacerlo, se dispara un intento de cobro inmediato (no espera al siguiente hito programado del flujo).

### Reintentos manuales vs. automáticos

Todo reintento automático queda registrado en auditoría con `actor_tipo = SISTEMA`. Un reintento fuera de este calendario (ej. SuperSU lo fuerza) requiere `actor_tipo = SUPER_ADMIN` con motivo.

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquina "Suscripción" (`ACTIVA` → `EN_MORA` → `SUSPENDIDA`), y `03-Business-Rules/04_Loyalty.md` para el estado de Membresía.

## Permisos
- Barbería actualiza su propio medio de pago y ve el estado de mora de su suscripción.
- Cliente actualiza su propio medio de pago de Membresía.
- SuperSU puede extender el periodo de gracia o forzar un reintento manual, con motivo obligatorio.

## Dependencias
- Depende de: `04_Subscriptions_Lifecycle.md`, `03-Business-Rules/03_Payment_Rules.md`, `03-Business-Rules/04_Loyalty.md`.
- De este documento dependen: `02-UX/11_Notifications.md` (las notificaciones de Día 1, 7 y 5), `07-QA/07_Payments.md`.

## Casos límite

- **El Negocio actualiza su medio de pago en el Día 9, un día antes de la suspensión, pero el nuevo medio también falla.** No se reinicia el conteo de 10 días desde el nuevo intento — el Negocio se suspende en el Día 10 tal como estaba programado, salvo que el nuevo intento sea exitoso.
- **La pasarela tiene una caída general que afecta a múltiples Negocios el mismo día del intento programado.** SuperSU puede, mediante `10-Operations/01_Feature_Flags.md`, pausar temporalmente el avance del calendario de reintentos a nivel plataforma mientras se resuelve el incidente de la pasarela, para no suspender masivamente Negocios por una falla ajena a ellos — esta pausa queda registrada como un evento de plataforma en `10-Operations/04_Logs_Policy.md`.
- **Un Cliente con Membresía `SUSPENDIDA_POR_IMPAGO` intenta reservar usando el beneficio de la Membresía el mismo día de la falla.** No puede — el beneficio se pierde inmediatamente al fallar el cobro (regla explícita arriba), sin gracia de uso; puede reservar normalmente pagando el precio estándar sin el beneficio.

## Criterios de aceptación
- [ ] El calendario de reintentos (Día 0/1/3/7/10 para Negocio; Día 0/1/5 para Membresía) se ejecuta automáticamente sin intervención manual en el caso estándar.
- [ ] Toda suspensión por impago es reversible automáticamente en el instante en que se recibe el pago pendiente.
- [ ] Ninguna suspensión por impago ocurre antes de agotar el calendario completo de reintentos, salvo decisión explícita y auditada de SuperSU.

## Checklist
- [x] Completo
- [ ] Revisado
