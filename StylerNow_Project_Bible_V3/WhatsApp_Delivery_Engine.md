# WhatsApp Delivery Engine

## Objetivo
Especificar el motor que decide, para cada notificación, cuál es el canal más económico disponible que aún cumple el objetivo de que el destinatario la reciba a tiempo — reemplazando la estrategia anterior donde WhatsApp era tratado como canal casi principal. Este documento es la fuente única de verdad del orden de canales y de la lógica de decisión; `02-UX/11_Notifications.md` (el catálogo de notificaciones) consume esta lógica sin redefinirla.

## Alcance
Motor de selección de canal y su relación con el consumo de conversaciones WhatsApp API (recurso de costo variable, `ADR_001_Monetization_Principles.md`). No redefine el catálogo de notificaciones en sí (qué evento dispara qué mensaje) — eso sigue en `02-UX/11_Notifications.md`.

## Reglas

### Prioridad oficial de canales (de más a menos económico)

1. **Push** — costo marginal ≈ $0 para StylerNow (infraestructura propia de notificaciones push). Canal por defecto para cualquier destinatario con la app instalada y permiso de push otorgado.
2. **Email** — costo marginal muy bajo (proveedor de envío transaccional por volumen). Canal por defecto para destinatarios sin push disponible, o como copia de respaldo de eventos críticos.
3. **WhatsApp API** — costo marginal real por conversación, medido contra la asignación mensual del Plan (`01-PRD/03_Monetization.md`, `AI_Credit_System.md` para el patrón equivalente de créditos — aquí son "conversaciones" en vez de "créditos", mismo principio). Se usa solo cuando Push y Email no son suficientes o no están disponibles.
4. **wa.me** (link de WhatsApp sin API oficial, abre un chat pre-llenado que el destinatario debe enviar manualmente) — costo marginal $0 para StylerNow, pero **no es una notificación push real**: requiere que el destinatario tome una acción para "enviarse" el mensaje a sí mismo o abrir el link. Se usa como último recurso, típicamente embebido como botón de acción dentro de una notificación Push/Email ya entregada (ej. "Confirmar por WhatsApp" como CTA), nunca como el mecanismo primario de entrega de un mensaje.

### Algoritmo de decisión (ejecutado por cada notificación, en este orden)

```
1. ¿El destinatario tiene push habilitado Y la app puede recibirlo ahora? 
   → SÍ: enviar por Push. FIN.
   → NO: continuar.

2. ¿El evento es crítico (ver clasificación abajo) O el destinatario no tiene push habilitado?
   → SÍ: enviar por Email (siempre disponible si hay email registrado). 
   → Si el evento es crítico, Email se envía EN PARALELO al Push exitoso, no solo como fallback (ver "Eventos críticos" abajo).

3. ¿El Negocio tiene WhatsApp API habilitado (Plan Jarl+) Y el Cliente/Staff dio consentimiento de ese canal 
   Y el Negocio tiene conversaciones WhatsApp disponibles este mes (AI_Credit_System.md, mismo patrón de medición)?
   → SÍ: enviar también por WhatsApp API, solo para los eventos que su prioridad de negocio justifica (ver tabla abajo) — no todos los eventos usan WhatsApp aunque esté disponible.
   → NO: no se usa este canal; si el evento lo requiere igual, cae a wa.me como botón de acción dentro de la notificación ya enviada por Push/Email.

4. wa.me nunca es el canal primario — solo aparece como acción secundaria embebida.
```

### Clasificación de eventos por canal (reemplaza la tabla anterior de `02-UX/11_Notifications.md` que asignaba WhatsApp como canal casi por defecto)

| Categoría de evento | Canal primario | Canal secundario/paralelo |
|---|---|---|
| Confirmación de Reserva, recordatorios (24h/2h) | Push | Email si no hay push; WhatsApp API solo si el Negocio lo tiene habilitado y el evento es de alto valor de conversión (recordatorio 24h, no el de 2h) |
| Cancelación por el Negocio, No-show del Staff (disculpa) | Push + Email en paralelo (evento crítico) | WhatsApp API si disponible, como refuerzo adicional dado el impacto en la confianza del Cliente |
| Cupo de Lista de espera liberado (ventana de 15 min) | Push | Email inmediato en paralelo (evento sensible al tiempo, se maximiza probabilidad de entrega); WhatsApp API si disponible, también en paralelo — este es el único caso donde se justifica usar los 3 canales simultáneamente, por la ventana corta de 15 minutos |
| Puntos por expirar, notificaciones informativas de bajo impacto | Push únicamente (o centro de notificaciones in-app si no hay push) | Nunca WhatsApp — no justifica el costo variable para un evento de bajo impacto |
| Fallos de cobro, suspensión de Negocio (dirigidos a Barbería) | Push + Email en paralelo (evento crítico administrativo) | WhatsApp API si disponible |

### Eventos críticos (definición)

Un evento es "crítico" cuando su no-entrega tiene consecuencia financiera o de confianza directa: cancelaciones, No-show, fallos de cobro, suspensión de cuenta, cupo de lista de espera con ventana corta. Los eventos críticos **siempre** se envían por Email en paralelo al intento de Push (no como fallback secuencial que espera a que el Push falle) — la probabilidad de entrega importa más que el ahorro marginal de un envío de Email adicional para este subconjunto pequeño de eventos.

### Consumo y medición de conversaciones WhatsApp

- Cada Plan tiene una asignación mensual de conversaciones WhatsApp API (`01-PRD/03_Monetization.md`): Raven 20, Jarl 100, Valhalla 500, Allfather personalizado.
- El conteo de "conversación" sigue la definición estándar del proveedor de WhatsApp Business API (una ventana de 24 horas de intercambio con un destinatario cuenta como una conversación, no cada mensaje individual dentro de ella).
- Al agotar la asignación del mes, el motor deja de usar WhatsApp API automáticamente para el resto del ciclo — degrada a Push + Email + wa.me como botón, sin bloquear ninguna notificación (el destinatario sigue recibiendo el evento, solo no por ese canal específico).
- El Negocio puede comprar conversaciones adicionales, mismo mecanismo de paquetes que `AI_Credit_System.md` (paquete de conversaciones, con su propio precio de referencia gestionado por SuperSU).
- No hay acumulación (rollover) de conversaciones no usadas entre ciclos, consistente con el mismo principio que los créditos IA.

## Estados
No aplica una máquina de estados propia — el motor decide un canal por evento en tiempo de envío; el consumo de conversaciones sigue el mismo patrón de lote (`ACTIVO`/`AGOTADO`/`EXPIRADO`) que `AI_Credit_System.md`.

## Permisos
- Barbería/Guardian ven el consumo de conversaciones WhatsApp de su alcance.
- Solo Barbería puede comprar un paquete adicional de conversaciones.
- Solo SuperSU configura el precio de referencia de los paquetes y la asignación mensual por Plan.

## Dependencias
- Depende de: `ADR_001_Monetization_Principles.md`, `01-PRD/03_Monetization.md`, `AI_Credit_System.md` (mismo patrón de medición de recurso variable).
- De este documento dependen: `02-UX/11_Notifications.md` (el catálogo de notificaciones debe reflejar esta clasificación de canal, no la estrategia anterior centrada en WhatsApp), `07-QA/08_Notifications.md` (casos de prueba del motor de decisión).

## Casos límite

- **Un Cliente no tiene push habilitado ni email registrado (caso raro, solo celular).** Cae directamente a WhatsApp API si el Negocio lo tiene habilitado y el Cliente dio consentimiento; si no, cae a SMS — Decisión abierta: SMS no está en el alcance de V1 como canal de respaldo, se documenta como limitación conocida (en este caso extremo, el Cliente solo recibe la información dentro de la app en su próxima apertura).
- **El cupo de Lista de espera se libera y el Negocio ya agotó sus conversaciones WhatsApp del mes.** El evento sigue usando Push + Email en paralelo (ya son obligatorios para este evento por ser sensible al tiempo); solo se omite el refuerzo de WhatsApp, sin afectar la entrega del evento en sí.
- **Un Negocio Raven (sin WhatsApp API disponible, ver `01-PRD/03_Monetization.md`, Raven no incluye Guardian ni... espera, Raven sí incluye 20 conversaciones WhatsApp) intenta usar WhatsApp para un recordatorio de 24h.** Raven sí tiene una asignación de WhatsApp (20/mes) aunque sea el Plan más básico — el motor la usa igual según la clasificación de eventos, simplemente con un tope mensual más bajo que Planes superiores.
- **Dos eventos críticos del mismo Cliente ocurren casi simultáneamente** (ej. cancelación y luego oferta de reagendar). Cada uno se evalúa de forma independiente por el motor; no se deduplica ni se combina en un solo envío, para no perder claridad sobre cada evento — ver `02-UX/11_Notifications.md`, regla de que cada notificación transaccional es distinta.

## Criterios de aceptación
- [ ] Ningún evento de "bajo impacto" (ver tabla) se envía nunca por WhatsApp API, verificado por auditoría de configuración.
- [ ] Todo evento crítico se envía por Push y Email en paralelo, nunca solo como fallback secuencial.
- [ ] El consumo de conversaciones WhatsApp nunca excede la asignación del Plan sin pasar por la compra explícita de un paquete adicional.
- [ ] wa.me nunca aparece como el único canal de un evento — siempre es un refuerzo secundario sobre un envío ya realizado por Push o Email.

## Checklist
- [x] Completo
- [ ] Revisado
