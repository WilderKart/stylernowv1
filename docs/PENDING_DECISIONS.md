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

## SuperSU: ¿cambiar el Plan de un Negocio a la fuerza?

- **Contexto:** `02-UX/10_Super_Admin.md` lista "cambiar plan" como acción de Gestión de Negocios, junto a aprobar/rechazar/suspender/reactivar. Hoy el Plan lo elige exclusivamente la propia Barbería en el wizard de registro (Módulo 2.1) y en su facturación.
- **Impacto:** sin esto, SuperSU no puede forzar un cambio de Plan (por ejemplo, degradar por impago, o subir manualmente como cortesía). No se construyó en el Módulo 3.1 porque no había un caso de uso concreto documentado ni claridad sobre si debe ser inmediato o al cierre del ciclo de facturación.
- **Recomendación:** definir junto con Configuración global (Módulo 3.2, gestión de Planes SaaS) si el cambio forzado de Plan es inmediato o nunca retroactivo a mitad de ciclo — igual que la regla ya definida para el Plan en sí.
- **Bloquea:** No — Aprobar/Rechazar/Suspender/Reactivar/Dar de baja ya cubren el ciclo de vida completo de un Negocio sin esta acción.

## Mapa del Marketplace: tiles crudos de OpenStreetMap vs. proveedor dedicado

- **Contexto:** el Mapa visual (Módulo 5.3, MapLibre + OpenStreetMap) usa el tile server público de OSM (`tile.openstreetmap.org`) directamente, sin ninguna credencial.
- **Impacto:** la [política de uso de OSM](https://operations.osmfoundation.org/policies/tiles/) desalienta tráfico de producción a gran volumen sobre ese servidor gratuito — es perfectamente válido para el volumen actual del proyecto (cero Negocios reales todavía), pero a escala real convendría migrar a un proveedor dedicado (MapTiler, Stadia Maps, Protomaps auto-hospedado, etc.), típicamente con una API key.
- **Recomendación:** revisar el volumen real de uso del Mapa cuando haya Negocios reales operando, y decidir en ese momento si migrar — cambiar el `ESTILO_OSM` de `src/components/marketplace/mapa-marketplace.tsx` por la URL de tiles del proveedor elegido es un cambio de una sola constante, no una reescritura.
- **Bloquea:** No — es una decisión de infraestructura para cuando haya tráfico real, no de negocio.

## Cómo agregar una entrada
Si te encontrás con algo que de verdad no podés resolver sin que el
fundador decida (falta una API key, hay una contradicción real en la
Biblia, una decisión cambia la arquitectura del producto): documentalo acá
con contexto/impacto/recomendación/si bloquea, y seguí avanzando en todo
lo que no dependa de esa respuesta.
