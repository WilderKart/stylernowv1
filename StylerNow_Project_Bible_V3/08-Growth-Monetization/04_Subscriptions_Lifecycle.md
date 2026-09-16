# 04 — Subscriptions Lifecycle

## Objetivo
Definir el ciclo de vida completo de la suscripción SaaS de un Negocio — upgrade, downgrade, suspensión, reactivación — para que ninguna transición de Plan dependa de una decisión manual de soporte no documentada.

## Alcance
Ciclo de vida de la `suscripcion` (ver `04-Data-Model/03_State_Machines.md` para el diagrama formal). Los fallos de cobro específicos y su flujo de reintentos están en `05_Billing_Failures.md`. Los precios y límites de cada Plan están en `01-PRD/03_Monetization.md`.

## Reglas

### Alta de un Negocio nuevo

Todo Negocio se crea directamente en un Plan (elegido en el onboarding, por defecto Raven si no elige explícitamente) y en estado `PENDIENTE_APROBACION` (ver `04-Data-Model/03_State_Machines.md`, máquina Negocio) hasta que SuperSU lo aprueba. La `suscripcion` se activa (`ACTIVA`) en el mismo momento en que el Negocio pasa a `ACTIVO` — no se cobra nada durante `PENDIENTE_APROBACION`.

### Upgrade

- Efectivo de inmediato al solicitarse (el Negocio obtiene las funcionalidades del Plan nuevo sin esperar al siguiente ciclo de facturación).
- El cobro se prorratea: se cobra la diferencia proporcional a los días restantes del ciclo actual (ver `01-PRD/03_Monetization.md`, regla de prorrateo).
- No requiere aprobación de SuperSU — es autoservicio desde el Panel Negocio.

### Downgrade

- Efectivo al **inicio del siguiente ciclo de facturación** (no inmediato), para que el Negocio no pierda funcionalidad que ya pagó en el ciclo actual.
- Bloqueado si el Negocio excede los límites estructurales del Plan destino (más Sedes o más Staff activo de los que el Plan destino permite) — debe resolver el exceso primero (reducir Sedes/Staff) antes de que el downgrade se programe.
- Downgrade de Valhalla a Jarl/Raven con más de 1 Sede activa: bloqueado hasta que el Negocio cierre o transfiera Sedes hasta llegar a 1 (ver Caso límite "cierre de Sede" abajo).

### Suspensión

Un Negocio pasa a `SUSPENDIDO` (la `suscripcion` pasa a `SUSPENDIDA`) por dos causas posibles:
1. **Impago** — tras agotar el flujo de reintentos de `05_Billing_Failures.md`.
2. **Infracción** — decisión manual de SuperSU (fraude, incumplimiento de términos, contenido inapropiado), con motivo obligatorio registrado en auditoría.

Efectos de la suspensión:
- El Negocio desaparece inmediatamente del Marketplace (no es descubrible por Clientes nuevos).
- Las Reservas futuras ya `CONFIRMADA` se cancelan automáticamente con reembolso al 100% (consistente con `Business_Rules_Bible.md`, pregunta de cierre de Sede — aplica el mismo principio a nivel Negocio completo).
- Cualquier campaña publicitaria activa se pausa (`03-Business-Rules/06_Marketplace_Ads.md`).
- El Panel Negocio, App Staff y accesos asociados quedan en modo de solo lectura (la Barbería puede ver su historial y datos, pero no crear Reservas nuevas ni operar) hasta la reactivación.
- Los Puntos de fidelización de Clientes en ese Negocio se congelan (`03-Business-Rules/04_Lealtad.md`).

### Reactivación

- Desde suspensión por impago: automática al recibirse el pago pendiente.
- Desde suspensión por infracción: requiere decisión explícita de SuperSU, nunca automática.
- Al reactivarse, el Negocio vuelve a ser descubrible en el Marketplace y sus Puntos de fidelización se descongelan (si no expiraron por tiempo mientras tanto).

### Cierre de Sede (dentro de un Negocio con Valhalla)

- La Barbería solicita el cierre de una Sede específica.
- Todas las Reservas futuras `CONFIRMADA` de esa Sede se cancelan con reembolso al 100%.
- Todas las entradas de `lista_espera` de esa Sede pasan a `CANCELADA` con notificación.
- El Staff cuyo único vínculo de disponibilidad era esa Sede queda con `vinculo_staff_negocio` en estado `ACTIVO` pero sin `disponibilidad` — la Barbería debe reasignarlo a otra Sede del mismo Negocio o el vínculo pasa a `SUSPENDIDO` tras 30 días sin reasignación.

### Cancelación definitiva del Negocio

- Solicitada por la Barbería o ejecutada por SuperSU en casos graves.
- Sigue el mismo efecto de cascada que la suspensión (cancelación de Reservas futuras, pausa de campañas), pero es terminal (`CANCELADO`, sin reactivación posible — para volver a operar, se requiere una alta nueva).
- Los datos se conservan según `04-Data-Model/05_Data_Retention.md`.

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquinas "Negocio" y "Suscripción".

## Permisos
- Barbería: solicita upgrade (inmediato), downgrade (programado), cierre de Sede, cancelación de su propio Negocio.
- SuperSU: aprueba el alta inicial, suspende por infracción, reactiva tras infracción, puede cancelar cualquier Negocio.

## Dependencias
- Depende de: `01-PRD/03_Monetization.md`, `04-Data-Model/03_State_Machines.md`, `03-Business-Rules/03_Payment_Rules.md`.
- De este documento dependen: `05_Billing_Failures.md`, `03-Business-Rules/10_Waitlist_System.md`, `03-Business-Rules/04_Lealtad.md`, `08-Growth-Monetization/06_Advertising_System.md`.

## Casos límite

- **Un Negocio en proceso de downgrade programado recibe, antes de que el downgrade se ejecute, más Reservas que exceden el nuevo límite (ej. agenda un cuarto Staff justo antes del cambio de ciclo).** El downgrade programado se re-valida el día de ejecución: si en ese momento el Negocio sigue excediendo el límite del Plan destino, el downgrade se cancela automáticamente y se notifica a la Barbería, permaneciendo en el Plan actual hasta que resuelva el exceso y lo solicite de nuevo.
- **Un Negocio suspendido por impago paga fuera del flujo automático (ej. transferencia manual verificada por soporte).** SuperSU puede forzar la reactivación manualmente, registrando el pago recibido fuera del flujo estándar, con el evento de auditoría correspondiente.
- **Un Negocio se suspende por infracción mientras tiene un Cliente a mitad de una Reserva `EN_CURSO`.** La Reserva en curso se deja completar (no se interrumpe un servicio que ya empezó); solo las Reservas futuras `CONFIRMADA` se cancelan.

## Criterios de aceptación
- [ ] Todo Negocio `SUSPENDIDO` desaparece del Marketplace en la siguiente consulta, sin excepción ni caché.
- [ ] Toda cancelación en cascada (Reservas, Lista de espera, campañas) por suspensión o cierre de Sede se ejecuta de forma atómica — no puede quedar un subconjunto a medio procesar.
- [ ] Un downgrade programado siempre re-valida límites el día de su ejecución, nunca se ejecuta ciegamente sobre el estado que tenía el Negocio al momento de solicitarlo.

## Checklist
- [x] Completo
- [ ] Revisado
