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

## Fase 6 — AI OS: falta credencial de Gemini

- **Contexto:** el Cost Optimizer del ADR-013 define un orden oficial de proveedores. Hoy `ai_modelo_config` tiene Gemini seedeado con `activo=false` porque no existe `GEMINI_API_KEY`.
- **Impacto:** el Cost Optimizer funciona completo hoy con OpenRouter (principal) + Nemotron (respaldo, heredado de ADR-011) — ningún consumidor de IA está bloqueado. Agregar Gemini solo ampliaría las opciones de costo/calidad disponibles.
- **Recomendación:** proveer `GEMINI_API_KEY` cuando el fundador lo considere necesario — no requiere cambio de código, el Cost Optimizer la detecta sola.
- **Bloquea:** No — es un proveedor adicional, no el único camino de IA.

## ~~Fase 6 — AI OS: rol de Ollama en la plataforma~~ (Resuelta por ADR-014, Fase G)

- **Resolución (2026-09-16):** Ollama no se elimina del Cost Optimizer, pero su rol queda oficialmente fijado — **nunca** es una dependencia de producción (ningún consumidor real, facturable a un Negocio, puede depender de que un servidor Ollama esté disponible); su uso legítimo es exclusivamente de **desarrollo interno**: documentación, pruebas, clasificación y tareas internas del equipo, corriendo en la máquina del desarrollador. `ai_modelo_config` ya refleja esto correctamente sin cambio de código: la fila `ollama-local` solo se activa si `OLLAMA_BASE_URL` existe en el entorno — ausente por diseño en Vercel/producción, presente solo si un desarrollador lo configura en su `.env.local` para sus propias pruebas. Ver `ADR_013_AI_OS_Monetizacion.md` (nota de la Fase G) y el comentario correspondiente en `src/lib/ia/ai-provider.ts`.
- **Bloquea:** No aplica — ya resuelta, sin decisión de infraestructura pendiente (operar un servidor Ollama de producción queda explícitamente descartado, no solo diferido).

## Fase 6 — Lealtad: checkout de Cliente para Membresía y Gift Card no construido

- **Contexto:** `suscribirse_membresia()` y la compra de Gift Card (Módulo 6.5) están completas y verificadas del lado del backend, pero ninguna tiene un botón/checkout real en el frontend de Cliente — a diferencia de Upgrade de Plan y del paquete de créditos de IA (Módulo 6.6), que sí replican el patrón completo de Mercado Pago Checkout Pro. Encontrado durante el Módulo 6.6 al buscar un ejemplo de checkout existente para replicar.
- **Impacto:** un Cliente no puede hoy comprar una Membresía ni una Gift Card con dinero real desde la app — el recorrido transversal de Lealtad (ver Módulo 6.5/6.6 en `00_MASTER_TASKLIST.md`) se verificó insertando el registro de Membresía directamente vía `service_role`, no a través de una compra real. El dominio Lealtad no queda genuinamente cerrado de punta a punta hasta que esto exista.
- **Recomendación:** construir el checkout (patrón ya probado 3 veces: `iniciarUpgrade`/`comprarPaqueteIa`) para Membresía en `/negocio/[slug]` (donde el Cliente ya ve los Servicios del Negocio) y para Gift Card en una pantalla nueva o dentro de `/lealtad`. Es trabajo de alcance conocido y bajo riesgo — la pregunta para el fundador es de prioridad, no de diseño.
- **Bloquea:** No al resto de Lealtad (todo lo demás del dominio funciona), pero sí bloquea poder decir que el dominio Lealtad está 100% cerrado de punta a punta con dinero real.

## Fase 6 — ROI de IA: métricas de atribución de resultado no son medibles todavía

- **Contexto:** la extensión del ADR-012/013 pide un ROI Dashboard con clientes recuperados, reservas generadas por IA, ventas atribuidas y tiempo ahorrado. Ninguna de estas existe hoy como dato: no hay ningún mecanismo que vincule una sugerencia/acción de IA con un resultado de negocio posterior (¿esta Reserva ocurrió *por* la sugerencia de IA, o el Cliente hubiera vuelto igual?).
- **Impacto:** `/panel/ia` muestra hoy solo métricas reales y verificables (créditos consumidos, costo estimado, consumo por categoría) — las métricas de atribución se documentan explícitamente como "no medible todavía" en la UI, en vez de inventar una fórmula sin datos reales detrás.
- **Recomendación:** definir con el fundador un mecanismo de atribución (ej. marcar en `reserva`/`pago` un `origen_ia` cuando la Reserva nace de un flujo asistido por IA, con una ventana de atribución explícita) antes de construir el cálculo — es una decisión de producto (qué cuenta como "generado por IA"), no solo una consulta SQL nueva.
- **Bloquea:** No al resto del AI OS — es una mejora del ROI Dashboard, no del motor de créditos/costos en sí.

## Fase 6 — Exportación de reportes: PDF/Excel no implementados (solo CSV)

- **Contexto:** la extensión del ADR-012/013 pide exportación PDF/Excel/CSV del ROI de IA. Se implementó CSV (sin dependencia nueva, generado en el cliente). El proyecto no tiene hoy ninguna librería de generación de PDF ni Excel.
- **Impacto:** el historial de consumo de IA se puede exportar y analizar en cualquier hoja de cálculo (CSV cubre ese caso de uso), pero no hay un reporte con formato/branding (PDF) ni un archivo `.xlsx` con múltiples hojas.
- **Recomendación:** cuando el fundador confirme que vale la pena la inversión, elegir una librería (ej. `jsPDF` para PDF, `exceljs` para Excel) — es una decisión de alcance/costo de mantenimiento, no una necesidad bloqueante hoy.
- **Bloquea:** No.

## ~~Fase 6 — AI OS: ¿la función `recomendacion` es la misma que "Recomendación de Negocios al Cliente"?~~ (Resuelta por ADR-014, Fase E)

- **Resolución (2026-09-16):** son dos funciones distintas. **Recomendación Marketplace** (`02_AI_Client.md`) es gratuita, algoritmo de plataforma — nunca consume créditos de ningún Negocio. **Recomendación IA del Negocio** (la acción `recomendacion` de `ai_accion_costo`) es la sugerencia personalizada del Motor de recompensas de Lealtad para un Cliente específico ante un disparador — consume créditos como cualquier otra función Negocio-facing. El código ya estaba correcto (cobrable al Negocio); solo faltaba esta aclaración en la Biblia, ahora agregada en `AI_Credit_System.md` y `02_AI_Client.md`.

## Fase 6 — ROI de IA: metodología de "tiempo ahorrado" no definida

- **Contexto:** `ai_roi_snapshot` (ADR-014, Fase C) tiene una columna `tiempo_ahorrado_minutos_estimado` que queda siempre `null` — no existe ninguna metodología de estimación acordada (¿minutos que tomaría redactar manualmente una sugerencia vs. que la genere la IA? ¿un valor fijo por acción? ¿algo medido con datos reales de Staff?).
- **Impacto:** el ROI Dashboard no muestra "tiempo ahorrado" — se omite en vez de inventar un número, consistente con "nunca estimaciones inventadas" (ADR-014, Fase C).
- **Recomendación:** el fundador define la fórmula cuando la considere necesaria — es una decisión de negocio (qué se considera "tiempo ahorrado" y con qué línea base), no una decisión técnica.
- **Bloquea:** No — el resto del ROI (créditos, costo, conversiones, monto atribuido) ya es real y se muestra hoy.

## Fase 6 — ROI de IA: campaña enviada/apertura/clic no medibles (falta motor de campañas)

- **Contexto:** la extensión del ADR-012/013 y ADR-014 Fase C piden medir "campaña enviada", "apertura" y "clic" como eventos del ROI de IA. El proyecto no tiene ningún motor de entrega de campañas multicanal (email/WhatsApp) — WhatsApp está explícitamente diferido (ver más abajo), y no existe tracking de apertura/clic de ningún canal.
- **Impacto:** el ROI de IA mide honestamente lo que sí tiene una fuente de datos real (créditos consumidos, costo, Reservas/Ventas atribuidas a una sugerencia de IA confirmada) — no incluye campaña/apertura/clic.
- **Recomendación:** construir esto requiere decidir primero el motor de entrega (Email vía Resend, ya usado en el proyecto para otros fines, es el candidato más cercano) antes de que el tracking tenga algo real que medir — es una decisión de alcance/infraestructura, no una tabla adicional.
- **Bloquea:** No — el resto del ROI de IA ya es real y útil sin esto.

## Cómo agregar una entrada
Si te encontrás con algo que de verdad no podés resolver sin que el
fundador decida (falta una API key, hay una contradicción real en la
Biblia, una decisión cambia la arquitectura del producto): documentalo acá
con contexto/impacto/recomendación/si bloquea, y seguí avanzando en todo
lo que no dependa de esa respuesta.
