# 09 — No-Show Policy

## Objetivo
Definir cómo se detecta, penaliza y previene el No-show — la causa #1 de fricción operativa en negocios de citas — tanto del lado del Cliente como del Staff.

## Alcance
Cubre No-show atribuible al Cliente (no se presenta) y al Staff (no atiende una Reserva confirmada). No cubre la mecánica de reembolso (`03-Business-Rules/03_Payment_Rules.md`, ya referenciada) ni el puntaje del Staff (`05_Staff_Rewards.md`, ya referenciado) — este documento define **cuándo** algo se cataloga como No-show y qué pasa después a nivel de cuenta del Cliente.

## Reglas

### Definición

Una Reserva en estado `CONFIRMADA` se marca como `NO_SHOW` cuando transcurren **15 minutos** desde la `hora_inicio` sin que el Staff haya hecho check-in de la cita **y** sin que el Cliente haya cancelado previamente. La responsabilidad (Cliente o Staff) se determina así:

- Si el Staff hizo check-in pero el Cliente nunca llegó: `NO_SHOW` atribuible al **Cliente**.
- Si el Staff nunca hizo check-in y no reportó ausencia previa: `NO_SHOW` atribuible al **Staff**.
- Si ambos están presentes pero el Servicio no se realiza por otra razón (ej. desacuerdo): no es un No-show, es una `CANCELADA` en el momento, con la política de reembolso estándar aplicando desde ese instante.

### Consecuencias — No-show del Cliente

1. La Seña pagada **no se reembolsa** (retenida como compensación al Negocio, según `03-Business-Rules/03_Payment_Rules.md`).
2. Se registra un "strike" de No-show en el perfil del Cliente, visible para cualquier Negocio al que intente reservar después (no es privado — es una señal de confianza de plataforma, igual que una calificación).
3. **Umbral de bloqueo:** al tercer strike de No-show en una ventana móvil de 90 días, el Cliente queda obligado a pagar el 100% del valor del Servicio (no solo la Seña) por adelantado en cualquier Reserva nueva, durante los siguientes 90 días desde el tercer strike. Este estado se revierte automáticamente pasado ese periodo si no hay nuevos strikes.
4. Un Negocio individual puede, adicionalmente, bloquear a un Cliente específico de reservar en su propio Negocio tras un No-show (acción manual, no automática) — ver `03-Business-Rules/01_Roles.md`.

### Consecuencias — No-show del Staff

1. Penalización de −40 puntos en el Sistema PRO/EXPERT/MASTER (`05_Staff_Rewards.md`).
2. Reembolso automático al 100% de la Seña al Cliente (tratado igual que una cancelación del Negocio, `03-Business-Rules/03_Payment_Rules.md`).
3. El Cliente recibe una notificación de disculpa automática con opción de reagendar prioritariamente con cualquier otro Staff disponible del Negocio, sin costo adicional.
4. Reincidencia (2+ No-show de Staff atribuibles en 30 días) genera una alerta visible a la Barbería en su panel — no hay una acción automática sobre la cuenta del Staff más allá del puntaje; la decisión de gestión de personal es del Negocio.

### Prevención

- Recordatorios automáticos al Cliente (push + WhatsApp si está habilitado) 24h y 2h antes de la cita (`02-UX/11_Notifications.md`).
- La Seña obligatoria (`03-Business-Rules/03_Payment_Rules.md`) es en sí misma el mecanismo de prevención primario del producto.
- Un Cliente con historial de 0 strikes en los últimos 12 meses puede ser elegible (configuración de plataforma) para una Seña reducida, como incentivo — Decisión abierta de producto para una fase posterior; por defecto en V1 la Seña no varía por historial del Cliente.

## Estados
El strike de No-show no es una entidad con máquina de estados propia; es un evento contado sobre una ventana móvil de tiempo, recalculado en cada consulta (no un contador persistente que se decrementa manualmente).

## Permisos
- El sistema marca `NO_SHOW` automáticamente (no requiere acción manual de ningún rol) a los 15 minutos.
- El Staff puede marcar manualmente un No-show del Cliente **antes** de los 15 minutos si el contexto operativo lo justifica (ej. el Cliente avisó por otro canal que no llegará) — queda registrado igual, con el mismo efecto.
- La Barbería puede revertir manualmente un `NO_SHOW` marcado por error (ej. falla de check-in), lo cual revierte también la penalización de puntaje y el strike del Cliente, con un evento de auditoría explícito indicando el motivo de la reversión.

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `03-Business-Rules/03_Payment_Rules.md`, `03-Business-Rules/05_Staff_Rewards.md`.
- De este documento dependen: `04-Data-Model/03_State_Machines.md` (transición `CONFIRMADA` → `NO_SHOW`), `02-UX/11_Notifications.md`, `09-CRM-Intelligence/04_AI_Business.md` (riesgo de abandono considera historial de No-show).

## Casos límite

- **El Cliente llega tarde pero antes de los 15 minutos.** No es No-show; el Staff decide si aún puede atenderlo dentro del tiempo restante del bloque reservado o si debe reagendar — no hay penalización automática al Cliente si el Staff decide atenderlo.
- **Falla de conectividad impide que el Staff haga check-in a tiempo aunque el Cliente sí llegó.** Es el caso que justifica la reversión manual dla Barbería (regla de Permisos arriba); por eso el marcado automático es reversible, no definitivo sin supervisión.
- **Un Cliente alcanza el tercer strike justo cuando tiene una Reserva ya `CONFIRMADA` con Seña pagada bajo la regla anterior.** La Reserva ya confirmada no se ve afectada retroactivamente; la exigencia de pago 100% anticipado aplica solo a Reservas creadas después de cruzar el umbral.
- **Dos Negocios distintos reportan No-show del mismo Cliente el mismo día** (caso improbable pero posible si el Cliente reservó doble sin intención de cumplir ninguna). Ambos strikes cuentan de forma independiente hacia el umbral de plataforma — el umbral es agregado a nivel Cliente, no por Negocio.

## Criterios de aceptación
- [ ] Toda Reserva `CONFIRMADA` sin check-in ni cancelación transiciona automáticamente a `NO_SHOW` exactamente a los 15 minutos, sin intervención manual.
- [ ] El strike de No-show es visible a cualquier Negocio antes de que el Cliente confirme una Reserva nueva.
- [ ] Una reversión manual de un No-show revierte de forma consistente: strike del Cliente, puntaje del Staff (si aplica) y estado de reembolso.

## Checklist
- [x] Completo
- [ ] Revisado
