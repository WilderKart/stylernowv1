# 11 — Notifications

## Objetivo
Definir cada notificación que el sistema envía, su disparador exacto y a quién, para que ninguna comunicación al usuario dependa de una decisión de último momento del equipo de desarrollo. **El canal de entrega de cada evento ya no se fija aquí de forma manual** — se decide en tiempo real por `WhatsApp_Delivery_Engine.md`, que este documento consume como motor de decisión. Este documento es el catálogo de **qué** se envía y a **quién**; el motor decide **por dónde**.

## Alcance
Catálogo de eventos que disparan comunicación al usuario. La lógica de selección de canal (Push/Email/WhatsApp API/wa.me) y la gestión del recurso variable "conversaciones WhatsApp" viven en `WhatsApp_Delivery_Engine.md` — este documento no la repite. No cubre campañas de marketing generadas por IA (`09-CRM-Intelligence/04_AI_Business.md`, que usa el mismo motor de entrega pero con contenido dinámico).

## Reglas

### Catálogo de notificaciones (disparador → destinatario → categoría de evento)

La columna "Categoría" remite a la tabla de clasificación de `WhatsApp_Delivery_Engine.md`, que determina el canal real en tiempo de envío.

| Evento | Destinatario | Categoría (`WhatsApp_Delivery_Engine.md`) |
|---|---|---|
| Reserva confirmada (pago aprobado) | Cliente | Confirmación/recordatorio |
| Recordatorio 24h antes de la cita | Cliente | Confirmación/recordatorio (elegible a WhatsApp API si el Negocio lo tiene habilitado) |
| Recordatorio 2h antes de la cita | Cliente | Confirmación/recordatorio (solo Push — ver `WhatsApp_Delivery_Engine.md`, este recordatorio específico no usa WhatsApp) |
| Reserva cancelada por el Negocio | Cliente | Crítico |
| Reserva reprogramada | Cliente | Confirmación/recordatorio |
| No-show marcado (Cliente) | Cliente | Informativo de bajo impacto (detalle de retención de Seña) |
| No-show marcado (Staff) — disculpa automática | Cliente | Crítico |
| Cupo de Lista de espera liberado | Cliente (primero en la cola) | Lista de espera (ventana de 15 min — los 3 canales en paralelo según `WhatsApp_Delivery_Engine.md`) |
| Puntos por expirar en 30 días | Cliente | Informativo de bajo impacto |
| Nueva cita asignada | Staff | Confirmación/recordatorio |
| Cambio/cancelación de una cita propia | Staff | Confirmación/recordatorio |
| Nivel PRO/EXPERT/MASTER alcanzado o cambiado | Staff | Informativo de bajo impacto |
| Fallo de cobro de suscripción (Día 1, 7) | Barbería | Crítico (administrativo) |
| Negocio suspendido | Barbería | Crítico (administrativo) |
| Nueva solicitud de Negocio pendiente | SuperSU | Email + panel interno (no pasa por el motor de canal — es un evento interno de plataforma) |
| Reseña reportada | SuperSU | Panel interno (no pasa por el motor de canal) |

### Reglas de frecuencia y silenciamiento

- El Cliente puede desactivar notificaciones no transaccionales (promocionales, recomendaciones de IA) sin afectar las transaccionales (confirmación, recordatorios, cancelaciones) — separación obligatoria de categorías, consistente con `06-Security/04_Compliance_Colombia.md`, derecho de oposición.
- Ninguna notificación transaccional puede desactivarse completamente (ej. no se puede apagar el aviso de que una Reserva fue cancelada) — es información operativa esencial, no marketing.
- Desactivar un canal específico (ej. el Cliente retira su consentimiento de WhatsApp) no desactiva el evento — el motor de `WhatsApp_Delivery_Engine.md` simplemente deja de considerar ese canal para ese destinatario y usa el siguiente disponible según prioridad.

## Estados
No aplica — las notificaciones son eventos disparados, no entidades con ciclo de vida propio más allá de `enviada`/`leída` (estado técnico de entrega, no de negocio).

## Permisos
El sistema envía automáticamente según el catálogo; ningún rol de producto puede enviar una notificación transaccional arbitraria a un usuario fuera de este catálogo (evita spam interno).

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `03-Business-Rules/03_Payment_Rules.md`, `03-Business-Rules/09_No_Show_Policy.md`, `03-Business-Rules/10_Waitlist_System.md`, `03-Business-Rules/04_Lealtad.md`, `08-Growth-Monetization/05_Billing_Failures.md`, `WhatsApp_Delivery_Engine.md`.
- De este documento dependen: `07-QA/08_Notifications.md`, `09-CRM-Intelligence/04_AI_Business.md`.

## Casos límite

- **Un Cliente no tiene permiso de push habilitado** (lo rechazó en onboarding, `02-UX/02_Onboarding.md`). El motor de `WhatsApp_Delivery_Engine.md` cae automáticamente a Email; el evento sigue disparándose desde este catálogo sin cambios — la decisión de canal es responsabilidad exclusiva del motor, no de este documento.
- **La ventana de 15 minutos de Lista de espera transcurre sin que la notificación de push llegue a tiempo.** Cubierto por la regla de `WhatsApp_Delivery_Engine.md` de usar los 3 canales en paralelo para este evento específico, precisamente por su sensibilidad al tiempo.
- **Un Staff recibe notificación de "Nivel alcanzado" en un Negocio donde también es Barbería.** Recibe la notificación en su contexto de Staff normalmente; no hay supresión especial por tener rol combinado.

## Criterios de aceptación
- [ ] Toda fila del catálogo de este documento tiene un disparador verificable en el código (evento de dominio → notificación), sin notificaciones "fantasma" no documentadas ni reglas de negocio que generan notificación sin estar aquí.
- [ ] Ninguna notificación transaccional puede desactivarse por el usuario.
- [ ] Ninguna fila de este catálogo especifica un canal directamente — todas remiten a una categoría de `WhatsApp_Delivery_Engine.md`, para que la decisión de canal tenga una única fuente de verdad.

## Checklist
- [x] Completo — canal delegado al motor de `WhatsApp_Delivery_Engine.md`
- [ ] Revisado
