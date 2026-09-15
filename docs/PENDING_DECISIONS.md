# Decisiones Pendientes

Decisiones que dependen de algo que el equipo de desarrollo no puede
resolver por sí solo (una credencial, una elección de negocio). Cada una
indica explícitamente si **bloquea** el desarrollo actual o no — si no
bloquea, el desarrollo sigue avanzando en paralelo sin esperar respuesta.

## Push Notifications (Firebase)

- **Contexto:** el motor de notificaciones (`WhatsApp_Delivery_Engine.md`) prioriza Push como primer canal, más económico que WhatsApp/Email.
- **Impacto:** sin credenciales de Firebase (API key, VAPID key, service account), el canal Push no puede activarse — el sistema sigue funcionando con Email como canal disponible.
- **Recomendación:** crear un proyecto Firebase (gratuito hasta cierto volumen) y proveer las 3 credenciales.
- **Bloquea:** No. El desarrollo del resto de la plataforma no depende de esto.

## Vercel Analytics + Speed Insights

- **Contexto:** observabilidad básica de producción, gratuita en el plan actual de Vercel.
- **Impacto:** sin esto, no hay visibilidad de Core Web Vitals ni tráfico real en producción.
- **Recomendación:** confirmar instalación — no requiere ninguna credencial nueva, solo una confirmación explícita antes de agregar el paquete.
- **Bloquea:** No.

## Pasarela de pago: Mercado Pago (decisión ya tomada, no reabrir)

- **Contexto:** el proyecto empezó con Wompi; el fundador pidió el cambio a Mercado Pago explícitamente al inicio de esta sesión larga de desarrollo, con credenciales de prueba entregadas directamente.
- **Impacto:** toda la integración de pagos (Checkout Pro, webhooks, reconciliación) está construida sobre Mercado Pago.
- **Recomendación:** ninguna — esto ya no es una decisión abierta, se registra acá únicamente para que nadie la reabra sin instrucción explícita nueva del fundador.
- **Bloquea:** No aplica — ya resuelta.

## Objetivos de Staff — implementación diferida (ADR-008)

- **Contexto:** se pidió preparar la arquitectura de objetivos de Staff (cortes, ventas, reseñas, puntualidad, clientes recurrentes) sin implementar IA.
- **Impacto:** el diseño de datos ya está documentado en `ADR_008_Objetivos_Staff.md`; construirlo ahora dependería de Reportes (2.10) e IA de Negocio (Fase 6), ninguno construido todavía.
- **Recomendación:** implementar cuando se ejecute Fase 6, reutilizando exactamente las fórmulas de KPI ya definidas.
- **Bloquea:** No — es una decisión de secuenciación, no una decisión de negocio abierta.

## Reserva manual: Cliente genuinamente nuevo (walk-in sin cuenta)

- **Contexto:** `crear_reserva_manual()` (Módulo 2.6, Agenda) requiere que el Cliente ya exista en `perfil` — un walk-in que nunca usó StylerNow no tiene fila ahí, y no puede representarse porque `reserva.cliente_id` referencia `auth.users` obligatoriamente.
- **Impacto:** el Panel solo puede agendar citas manuales para clientes que ya tuvieron alguna Reserva antes con ese negocio (buscables vía `perfil_select_crm_negocio`) — no para alguien completamente nuevo que llama por primera vez.
- **Recomendación:** dos caminos posibles, ninguno implementado todavía: (a) el Staff le pide al Cliente que se registre primero (comparte el link del Marketplace) antes de agendarlo, o (b) se construye un mecanismo de "perfil invitado" creado server-side (sin cuenta real, o con una cuenta que se completa después). (b) es un cambio de arquitectura real — toca el significado de `cliente_id` en toda la base — y no debería decidirse sin involucrar al fundador.
- **Bloquea:** No — el caso de "cliente que ya reservó antes y llama de nuevo" (el más común) ya funciona completo.

## Reserva manual: ¿confirmar sin cobrar Seña en el momento?

- **Contexto:** una cita creada desde el Panel (`crear_reserva_manual()`) nace en `PENDIENTE_PAGO`, igual que cualquier Reserva — necesita que alguien complete el pago de la Seña (el Cliente por su cuenta, o el Staff por teléfono) antes de quedar `CONFIRMADA`.
- **Impacto:** para una reserva telefónica donde el negocio confía en el Cliente (pago en efectivo al llegar), este flujo obliga a un paso de pago online que puede no tener sentido en ese caso.
- **Recomendación:** definir si Barbería puede marcar una cita manual como `CONFIRMADA` sin pasar por Mercado Pago (confianza del negocio) — y si eso debería vivir acá o esperar al módulo de POS (2.8), que es quien maneja pagos en efectivo/en sede.
- **Bloquea:** No — la cita ya aparece en la Agenda en `PENDIENTE_PAGO`, útil para planificación aunque el pago no esté resuelto todavía.

## Cómo agregar una entrada
Si te encontrás con algo que de verdad no podés resolver sin que el
fundador decida (falta una API key, hay una contradicción real en la
Biblia, una decisión cambia la arquitectura del producto): documentalo acá
con contexto/impacto/recomendación/si bloquea, y seguí avanzando en todo
lo que no dependa de esa respuesta.
