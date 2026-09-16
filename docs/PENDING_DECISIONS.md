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

## ~~Fase 6 — IA operacional: falta credencial de un proveedor de LLM~~ (Resuelta el 2026-09-16)

- **Resuelta.** El fundador proveyó una API key de OpenRouter (más Nemotron como respaldo automático, ver entrada de abajo) — `src/lib/ia/ai-provider.ts` (ADR-011). Función 4 de `04_AI_Business.md` (Horarios muertos) ya estaba construida sin necesitar esto (es Nivel 0). Las 3 funciones restantes que sí necesitan un LLM real (`02_AI_Client.md`, `03_AI_Staff.md`, Funciones 1-3 de `04_AI_Business.md`) quedan como el próximo trabajo pendiente de Fase 6 — la credencial ya no es el bloqueo, solo falta construirlas.

## Fase 6 — Motor WhatsApp inteligente: falta credencial de WhatsApp Business API

- **Contexto:** `WhatsApp_Delivery_Engine.md` especifica un motor de notificaciones por WhatsApp como canal principal.
- **Impacto:** sin credenciales de WhatsApp Business API (Meta), no se puede construir el envío real — el canal Email/Push ya cubre notificaciones básicas.
- **Recomendación:** proveer las credenciales cuando estén disponibles.
- **Bloquea:** Solo el motor de WhatsApp — no bloquea el resto de la plataforma.

## ~~Fase 6 — Membresías, Gift Cards, Referidos: sin documento de reglas de negocio~~ (Resuelta por ADR-011)

- **Resuelta el 2026-09-16.** El fundador entregó la especificación completa del dominio Lealtad (ADR-011), que no solo resuelve Membresías/Gift Cards/Referidos sino que los amplía a 12 sistemas (+ Sellos, Cashback, VIP, Familias, Corporativo, Referidos de Staff, motor de recompensas por IA). Construido completo — ver `00_MASTER_TASKLIST.md`, sección Fase 6 / Dominio Lealtad.

## Fase 6 — Motor Nemotron (respaldo de IA): cuenta sin crédito

- **Contexto:** ADR-011 pide un segundo proveedor de IA como respaldo automático de OpenRouter — se conectó Nemotron/NVIDIA vía `tokenrouter.com` (`src/lib/ia/ai-provider.ts`). La clave es válida y el modelo real (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`) se confirmó por `/models`.
- **Impacto:** la cuenta de tokenrouter.com tiene $0.00 de crédito ("insufficient_user_quota") — el respaldo está completamente conectado y el failover automático funciona (verificado forzando una falla en OpenRouter), pero hoy no tiene capacidad real si ambos proveedores fallaran a la vez. Mientras OpenRouter siga funcionando (gratuito), esto no afecta la operación normal.
- **Recomendación:** recargar la cuenta en tokenrouter.com cuando el fundador lo considere necesario — no requiere ningún cambio de código.
- **Bloquea:** No — es un respaldo, no el proveedor principal.

## Fase 6 — Cobro recurrente real de Suscripción: falta Mercado Pago Preapproval + medio de pago guardado

- **Contexto:** `08-Growth-Monetization/05_Billing_Failures.md` especifica un calendario automático de reintentos (Día 0/1/3/7/10) que reintenta cobrar la suscripción mensual de un Negocio. La integración de pago hoy (`src/lib/pagos/mercadopago.ts`) es Checkout Pro — genera una preferencia de cobro único cada vez, sin ningún concepto de tarjeta guardada. Mercado Pago sí ofrece un producto distinto para esto (Preapproval / suscripciones automáticas), pero es una integración distinta, no una extensión de la actual, y requiere habilitarlo en la cuenta comercial.
- **Impacto:** sin esto, el "intento de cobro automático" del Día 0/3/7 no puede ser real — se construyó en su lugar (Módulo 6.3) todo lo que sí es real hoy: Upgrade con cobro único prorrateado vía Checkout Pro, Downgrade programado con re-validación, y el camino 100% manual de SuperSU para marcar `EN_MORA` / forzar reactivación por pago externo. El calendario automático de reintentos queda sin construir.
- **Recomendación:** cuando el fundador decida, habilitar Mercado Pago Preapproval en la cuenta comercial y definir el flujo de "guardar medio de pago" en el Panel Negocio (Checkout Pro no lo soporta) — en ese momento se construye el calendario Día 0/1/3/7/10 real sobre esa base.
- **Bloquea:** Solo el calendario automático de reintentos de cobro — el resto del ciclo de vida de Suscripción (upgrade, downgrade, suspensión, cancelación, camino manual de mora) ya funciona completo sin esto.

## Cómo agregar una entrada
Si te encontrás con algo que de verdad no podés resolver sin que el
fundador decida (falta una API key, hay una contradicción real en la
Biblia, una decisión cambia la arquitectura del producto): documentalo acá
con contexto/impacto/recomendación/si bloquea, y seguí avanzando en todo
lo que no dependa de esa respuesta.
