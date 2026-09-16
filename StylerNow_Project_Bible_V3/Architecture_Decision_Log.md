# Architecture Decision Log (ADL)

## Objetivo

Registrar toda decisión de arquitectura o de negocio que, de quedar implícita, obligaría a un desarrollador a adivinar. Cada entrada es inmutable una vez aceptada: para cambiar una decisión se agrega una entrada nueva que **supera** a la anterior (nunca se edita una entrada pasada).

## Alcance

Decisiones de producto, datos, seguridad, monetización y proceso que afectan a más de un documento de la Biblia.

## Formato

Cada decisión tiene: **Fecha, Decisión, Motivo, Impacto, Estado** (`Activa` / `Superada por ADL-XXX`).

---

### ADL-001 — Staff es una entidad genérica, no "barbero"
**Fecha:** 2026-09-14
**Decisión:** Todo el sistema (datos, API, UI, documentación) usa `Staff` como entidad genérica para cualquier profesional que presta un Servicio. "Barbero" nunca es un nombre de tabla, endpoint, rol o estado.
**Motivo:** El brief de producto exige soporte multi-vertical desde el día uno (barberías, salones, estilistas, manicuristas, lashistas, tatuadores, spa, masajes, grooming, multi-servicio). Modelar sobre "barbero" obligaría a una migración de dominio completa al incorporar la segunda vertical.
**Impacto:** Afecta `04-Data-Model`, `05-API`, `02-UX`, todos los mockups y todo `07-QA`.
**Estado:** Activa.

### ADL-002 — Existe una entidad `Recurso` independiente del Staff
**Fecha:** 2026-09-14
**Decisión:** La capacidad de una Reserva puede estar limitada por el Staff, por un Recurso físico (silla, camilla, cabina, cama), o por ambos simultáneamente. El modelo de reservas siempre valida disponibilidad de Staff **y** de Recurso cuando el Servicio lo requiere.
**Motivo:** En verticales como spa o masajes, el cuello de botella real suele ser el número de camillas, no el número de terapeutas. Sin esta entidad, el modelo de reservas quedaría sesgado hacia negocios donde 1 Staff = 1 slot de capacidad, lo cual es falso para varias verticales objetivo.
**Impacto:** `04-Data-Model/01_Entities.md`, `03-Business-Rules/02_Booking_Rules.md`, `02-UX/05_Booking.md`.
**Estado:** Activa.

### ADL-003 — La PWA es la superficie de Cliente primaria; Capacitor es una fase posterior, no un rediseño
**Fecha:** 2026-09-14
**Decisión:** La Cliente PWA se construye con arquitectura y componentes que asumen empaquetado futuro vía Capacitor (sin dependencias de navegador que no tengan equivalente en WebView, uso de `localStorage`/IndexedDB en vez de solo cookies, diseño responsive mobile-first, permisos push vía Web Push con fallback a plugin nativo). No se construyen dos bases de código.
**Motivo:** El brief exige que la PWA "quede preparada para convertirse posteriormente en aplicación móvil mediante Capacitor" sin construir la app nativa ahora.
**Impacto:** `02-UX/03_Client_PWA.md`, `01-PRD/02_Functional_Architecture.md`, `10-Operations/05_Release_Process.md`.
**Estado:** Activa.

### ADL-004 — Multi-tenancy por `negocio_id` con RLS a nivel de fila, no bases de datos separadas
**Fecha:** 2026-09-14
**Decisión:** Todos los Negocios comparten el mismo esquema de base de datos. El aislamiento se garantiza con Row Level Security (RLS) filtrando por `negocio_id` en cada tabla que lo requiera, nunca confiando en filtros de aplicación.
**Motivo:** Es el patrón estándar para SaaS multi-tenant de este tamaño (costo operativo bajo, escalabilidad suficiente para cientos de Negocios) y es el que documenta `06-Security/02_RLS.md`.
**Impacto:** `04-Data-Model`, `06-Security`, `05-API`.
**Estado:** Activa.

### ADL-005 — La comisión de plataforma se cobra sobre la Seña procesada en la app, no sobre el total del servicio
**Fecha:** 2026-09-14
**Decisión:** StylerNow solo retiene comisión sobre el monto que efectivamente procesa como pasarela de pago (la Seña). El saldo pagado en Sede en efectivo u otro medio no genera comisión de plataforma, salvo que el Negocio elija procesar el pago completo por la app (ver `08-Growth-Monetization/02_Commissions.md`).
**Motivo:** Es coherente con el mockup ya construido (pantalla de pago de seña) y evita que StylerNow dependa de que el Negocio reporte honestamente ingresos que no pasaron por la plataforma.
**Impacto:** `08-Growth-Monetization/02_Commissions.md`, `05-API/04_Payments.md`, `06-Security/03_Fraud.md`.
**Estado:** Activa.

### ADL-006 — El Sistema PRO/EXPERT/MASTER es una mecánica de producto pública, auditable y reversible
**Fecha:** 2026-09-14
**Decisión:** Todo cambio de puntaje de un Staff queda registrado como un evento inmutable de auditoría (nunca solo se actualiza un contador). El Nivel se recalcula por temporada, con degradación posible. La lógica de puntaje vive en un único lugar (`03-Business-Rules/05_Staff_Rewards.md`) y toda superficie (Marketplace, comisión, App Staff) lee de ahí, nunca reimplementa el cálculo.
**Motivo:** Es el diferenciador de producto declarado explícitamente en el brief; una implementación inconsistente entre superficies destruiría la confianza de los Staff en el sistema de recompensas.
**Impacto:** `03-Business-Rules/05_Staff_Rewards.md`, `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `04-Data-Model/04_Audit.md`.
**Estado:** Activa.

### ADL-007 — QA se documenta al final, después de que exista toda regla de negocio, dato, API y seguridad
**Fecha:** 2026-09-14
**Decisión:** La carpeta `07-QA` se completa en la última fase del plan de expansión (ver `00_AUDIT_REPORT.md`, Sección 6).
**Motivo:** Escribir casos de prueba antes de que existan las reglas que prueban produce placeholders disfrazados de casos de prueba, justo lo que la misión prohíbe explícitamente.
**Impacto:** Orden de ejecución de todo el proyecto documental.
**Estado:** Activa.

### ADL-008 — Colombia es el mercado de lanzamiento; el cumplimiento normativo se documenta para Colombia primero, con el modelo preparado para extenderse
**Fecha:** 2026-09-14
**Decisión:** `06-Security/04_Compliance_Colombia.md` documenta Habeas Data (Ley 1581 de 2012, Decreto 1377 de 2013), facturación electrónica DIAN y retención de datos fiscales. El modelo de datos no hardcodea reglas colombianas en el esquema (ej. el campo de identificación fiscal es genérico, no asume solo Cédula/NIT).
**Motivo:** El brief pide explícitamente "compliance colombiano, Habeas Data" y el negocio es "el sistema operativo para barberías modernas" de Colombia, pero la arquitectura no debe impedir expansión regional futura.
**Impacto:** `06-Security/04_Compliance_Colombia.md`, `04-Data-Model/01_Entities.md`.
**Estado:** Activa.

### ADL-009 — Corrección del modelo de roles: 4 cuentas reales + Guardian como perfil de Staff
**Fecha:** 2026-09-14
**Decisión:** Se corrige el modelo de roles de la Biblia. El modelo anterior (ADL implícito en la primera versión de `03-Business-Rules/01_Roles.md`) definía 5 roles como cuentas independientes: Cliente, Staff, Manager de Sede, Admin de Negocio, Super Admin. El modelo corregido, definido explícitamente por el usuario, establece que **solo existen 4 tipos de cuenta**: Cliente, Staff, Barbería (antes "Admin de Negocio") y SuperSU (antes "Super Admin"). **Guardian** (antes "Manager de Sede") **no es una cuenta independiente** — es un perfil operativo que se otorga o retira sobre una cuenta Staff existente, con alcance de permisos limitado a la `sede_activa` (`branch_id`) del Staff. Además, en el modelo corregido todo Staff pertenece a una única Barbería (se retira la posibilidad de vínculos simultáneos con más de un Negocio que el modelo anterior permitía).
**Motivo:** Simplifica la arquitectura de autorización (4 cuentas reales en vez de 5), refleja con más fidelidad cómo opera en la práctica un negocio de este tipo (el "encargado de sede" casi siempre es un barbero/estilista de confianza que sigue trabajando como tal, no una cuenta de otra naturaleza), y fue especificado explícitamente por el usuario con una matriz de permisos completa que debe regir el sistema.
**Impacto:** Reemplaza por completo `03-Business-Rules/01_Roles.md`. Afecta `Glossary.md`, `06-Security/02_RLS.md`, `04-Data-Model/01_Entities.md` (campos `sede_activa`/`es_guardian` en `vinculo_staff_negocio`, y esa entidad pasa a ser 1:1 con `staff` en vez de N:N con `negocio`), `04-Data-Model/03_State_Machines.md`, y toda mención de "Admin de Negocio", "Manager de Sede" o "Super Admin" a lo largo de la Biblia (~49 documentos). La propagación de nomenclatura en el resto de los documentos se ejecuta en el mismo cambio que esta entrada del ADL.

**Tabla de equivalencia de términos (para la propagación):**

| Término anterior | Término corregido |
|---|---|
| Admin de Negocio / Admin de Negocio (Owner) | Barbería |
| Manager de Sede | Guardian (perfil de Staff, no cuenta) |
| Super Admin | SuperSU |
| Super Admin CMS (nombre de superficie) | SuperSU CMS |
| `negocio_id` en el contexto de autorización | `business_id` (alcance Barbería) |
| — (no existía) | `branch_id` / `sede_activa` (alcance Guardian) |

**Estado:** Activa. Supera y reemplaza toda mención anterior del modelo de 5 roles.

### ADL-010 — Segunda corrección integral: monetización renombrada, principio financiero, IA por créditos, motor de WhatsApp, ADRs formales
**Fecha:** 2026-09-14
**Decisión:** Corrección y expansión integral de la Biblia en 5 frentes, todos por instrucción explícita y no negociable del negocio:
1. **Planes SaaS renombrados**: Raven (antes Starter), Jarl (antes Growth), Valhalla (antes MultiSede), Allfather (antes Enterprise), con precios y límites nuevos y exactos (ver `01-PRD/03_Monetization.md`). Se corrige explícitamente una mención errónea de "30 Staff" en Valhalla — el límite incluido correcto es 10 Staff.
2. **Principio financiero formalizado**: StylerNow nunca subsidia costos variables (IA, WhatsApp, almacenamiento, procesamiento pesado) — ver `ADR_001_Monetization_Principles.md`.
3. **Sistema de IA por créditos**: toda función de IA de `09-CRM-Intelligence` consume Créditos IA de una asignación mensual por Plan, con arquitectura de 3 niveles (Nivel 0 reglas, Nivel 1 IA económica, Nivel 2 IA premium) — ver `AI_Credit_System.md`.
4. **Motor de entrega WhatsApp reprioritizado**: WhatsApp deja de ser canal principal; el orden de prioridad pasa a ser Push → Email → WhatsApp API → wa.me, con selección automática del canal más económico — ver `WhatsApp_Delivery_Engine.md`. Esto reemplaza la estrategia de notificaciones documentada originalmente en `02-UX/11_Notifications.md`, que trataba WhatsApp como canal casi primario.
5. **Confirmación y formalización en ADR del modelo de roles** ya corregido en ADL-009 (4 cuentas + Guardian como perfil), ahora documentado también como `ADR_002_Role_Architecture.md` en formato de decisión arquitectónica completa (Contexto/Decisión/Consecuencias/Alternativas), además del registro breve del ADL.
**Motivo:** Instrucción explícita y detallada del negocio, con criterio de finalización no negociable ("estas decisiones ya están aprobadas, no debes cambiarlas").
**Impacto:** `01-PRD/03_Monetization.md` (reescrito), `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` y `05_Billing_Failures.md` (límites y flujos actualizados a los nuevos Planes), `09-CRM-Intelligence/02_AI_Client.md`, `03_AI_Staff.md`, `04_AI_Business.md` (costo en créditos por función), `02-UX/11_Notifications.md` (canal reprioritizado), y documentos nuevos: `ADR_001_Monetization_Principles.md`, `ADR_002_Role_Architecture.md`, `Pricing_Strategy.md`, `AI_Credit_System.md`, `WhatsApp_Delivery_Engine.md`, `Guardian_Lifecycle.md`, `Staff_Transfer_Workflow.md`. Se hizo un barrido global de nomenclatura (Starter/Growth/MultiSede/Enterprise → Raven/Jarl/Valhalla/Allfather) en toda la Biblia, con la misma disciplina de concordancia gramatical usada en ADL-009.

**Nota sobre documentos "nuevos obligatorios" no duplicados:** siguiendo la regla explícita de "si la información ya existe, amplíala en lugar de duplicarla", los siguientes documentos solicitados por nombre ya existían con otro nombre y fueron **expandidos in situ**, no duplicados:
- `Role_Permissions_Matrix.md` → ya es `03-Business-Rules/01_Roles.md` (contiene la matriz maestra completa).
- `Marketplace_Algorithm.md` → ya es `08-Growth-Monetization/01_Marketplace_Algorithm.md`.
- `Staff_Level_System.md` → ya es `03-Business-Rules/05_Staff_Rewards.md` (Sistema PRO/EXPERT/MASTER).
- `Billing_Lifecycle.md` → ya cubierto conjuntamente por `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` y `05_Billing_Failures.md`.
- `Glossary.md` y `Architecture_Decision_Log.md` → ya existían desde la primera corrección (ADL-009) y fueron actualizados, no recreados.

**Estado:** Activa. Supera cualquier mención anterior de los nombres de Plan antiguos o de un modelo de WhatsApp centrado en ese canal como principal.

### ADL-011 — El Panel Negocio es una única superficie compartida entre Barbería y Guardian
**Fecha:** 2026-09-14
**Decisión:** Guardian no espera a la Fase 4 (App Staff) para tener una superficie funcional — opera dentro del mismo Panel Negocio que la Barbería, con alcance limitado a su `sede_activa` resuelto en cada request por una función central (`resolverContexto()`), nunca por una segunda copia de los componentes ni por lógica de permisos calculada a mano en cada pantalla.
**Motivo:** Instrucción explícita del fundador durante la construcción del Módulo 2.4: esperar a Fase 4 contradecía ADR-002 (Guardian ya está definido como un perfil que opera con alcance de sede, no como usuario de una app de Staff aparte).
**Impacto:** `02-UX/09_Business_Panel.md`, todos los módulos restantes de Fase 2 (heredan el mecanismo de alcance sin reconstruirlo), documento nuevo `ADR_006_Guardian_Panel_Compartido.md`.
**Estado:** Activa.

### ADL-012 — El Timeline Laboral del Staff reutiliza `evento_auditoria` y `nivel_staff_consolidado`, sin tabla nueva
**Fecha:** 2026-09-14
**Decisión:** El historial permanente de un Staff (ingreso, traslados, Guardian, suspensión, reactivación, retiro, y en el futuro Nivel y reconocimientos) no vive en una tabla nueva — se lee combinando `evento_auditoria` (ya inmutable, sin política de `DELETE`) y `nivel_staff_consolidado` (ya inmutable por temporada cerrada) en un único punto de lectura (`obtenerHistorialStaff()`).
**Motivo:** Instrucción del fundador de formalizar un "Timeline Laboral" completo; construir una tabla paralela habría duplicado exactamente lo que `evento_auditoria` ya hace, violando la Regla de Oro.
**Impacto:** Documento nuevo `ADR_007_Timeline_Laboral_Staff.md`, `src/app/panel/staff/actions.ts` (fusiona ambas fuentes), `src/app/panel/staff/[id]/detalle-staff.tsx`.
**Estado:** Activa.

### ADL-013 — Objetivos de Staff: arquitectura documentada, implementación diferida a Fase 6
**Fecha:** 2026-09-14
**Decisión:** Se documenta por adelantado qué tipos de objetivo tendrá Staff (cortes, ventas, reseñas, puntualidad, clientes recurrentes) y que cada uno reutiliza una fórmula que YA existe en la Biblia (KPIs, CRM) — pero no se construye ninguna tabla, RPC ni pantalla en esta sesión, porque depende de Reportes (2.10) e IA de Negocio (Fase 6), ninguno construido todavía.
**Motivo:** Instrucción del fundador de "preparar la arquitectura sin implementar IA"; construirlo ahora sería una funcionalidad desconectada de los módulos que le dan sentido.
**Impacto:** Documento nuevo `ADR_008_Objetivos_Staff.md`, entrada en `docs/PENDING_DECISIONS.md`.
**Estado:** Activa — diseño fijado, implementación pendiente de Fase 6.

### ADL-014 — Inventario: stock por (Producto, Sede), resuelve la Decisión abierta de ADL-009
**Fecha:** 2026-09-15
**Decisión:** Inventario no tenía documento de reglas de negocio propio — solo la matriz de permisos de `01_Roles.md`, que le da a Guardian alcance de su Sede. Se modela `producto_stock` como una fila por (Producto, Sede) — nunca una cantidad única a nivel Negocio — y se conecta con POS (`completar_venta_pos()` ahora también descuenta stock, tanto por venta directa como por consumo automático configurado por Servicio).
**Motivo:** El alcance 🏢 de Guardian en la matriz de Roles no tendría sentido si el stock fuera una sola cantidad compartida entre Sedes; el roadmap pide explícitamente conectar Inventario con Staff/Servicios/Sedes.
**Impacto:** Documento nuevo `ADR_009_Inventario_Stock_Por_Sede.md`, migración 022, `completar_venta_pos()` extendida (migración 021 → 022, misma función).
**Estado:** Activa.

### ADL-015 — SuperSU es una superficie propia (`/admin`), nunca una extensión de `resolverContexto()`
**Fecha:** 2026-09-15
**Decisión:** `/admin` tiene su propia guarda (`requireSuperSU()`, verifica `perfil.es_supersu` directo) en vez de sumar un cuarto rol a `resolverContexto()`. Las transiciones de estado de Negocio (`aprobar/rechazar/suspender/reactivar/cancelar`) reutilizan `cancelar_reserva()` para el reembolso en cascada — nunca se duplicó esa lógica ya verificada en el Módulo 1.
**Motivo:** La Biblia (`02-UX/10_Super_Admin.md`) es explícita: "ninguna acción de este CMS es accesible desde ninguna otra superficie" — mezclarlo con `resolverContexto()` (que resuelve el contexto de un usuario *dentro* de un Negocio) habría sido conceptualmente incorrecto, SuperSU no pertenece a ningún Negocio.
**Impacto:** Descubrió y cerró un hallazgo crítico: ningún Negocio podía pasar de `PENDIENTE_APROBACION` a `ACTIVO` — la política RLS ya lo permitía desde la migración 006 pero nada la usaba. `src/lib/auth/require-supersu.ts`, `src/app/admin/*`, migraciones 024-025.
**Estado:** Activa.

### ADL-016 — Comisión de plataforma: singleton `configuracion_plataforma` que propaga a `negocio` en cada escritura
**Fecha:** 2026-09-15
**Decisión:** `negocio.comision_plataforma_pct` (migración 002) queda como la columna que de verdad se lee al aprobar un pago, pero deja de ser la fuente de verdad editable — una tabla singleton nueva (`configuracion_plataforma`) es lo que SuperSU edita, y cada escritura hace un `UPDATE` masivo que propaga el valor a todos los Negocios en la misma transacción.
**Motivo:** La Biblia describe un único control global ("slider que actualiza el valor global en tiempo real"), pero el schema real modela la comisión por Negocio (para permitir, a futuro, una tarifa negociada individual). Un singleton que propaga evita crear dos fuentes de verdad divergentes sin cerrar la puerta a una tarifa por Negocio el día que exista un caso de uso real.
**Impacto:** Migraciones 026 y 028 (bug real: Supabase exige `WHERE` explícito en todo `UPDATE`, incluso dentro de `SECURITY DEFINER` — sin él, el `UPDATE` sin filtro fallaba).
**Estado:** Activa.

### ADL-017 — Re-aceptación legal material: gate explícito en `/legal/aceptar`, nunca auto-aceptación silenciosa
**Fecha:** 2026-09-15
**Decisión:** `registrarAceptacionLegal()` deja de aceptar automáticamente CUALQUIER versión vigente de un texto legal en cada login. Ahora distingue: una versión con `cambio_material = false` se sigue aceptando en silencio (sin fricción); una versión con `cambio_material = true` que el usuario no aceptó explícitamente bloquea su login en una pantalla nueva (`/legal/aceptar`) hasta que la acepte de forma explícita.
**Motivo:** Se encontró, leyendo el código existente durante la construcción de "Textos legales versionados" (Módulo 3.2), que la función anterior ignoraba por completo la columna `cambio_material` (existente desde el Módulo 1) — cualquier cambio, material o no, se aceptaba en silencio sin mostrárselo nunca al usuario. Esto incumplía el consentimiento explícito exigido por la Ley 1581/`06-Security/04_Compliance_Colombia.md` y dejaba sin ningún efecto real la funcionalidad de "publicar con cambio material" que este mismo módulo estaba construyendo.
**Impacto:** `src/lib/auth/aceptacion-legal.ts` (reescrito), `src/app/legal/aceptar/*` (nuevo), `src/app/login/actions.ts`, `src/app/login/formulario.tsx`, `src/app/auth/callback/route.ts`.
**Estado:** Activa.

### ADL-018 — Auditoría: visor nuevo, cero migraciones — la RLS ya existía sin usar desde la migración 006
**Fecha:** 2026-09-15
**Decisión:** `/panel/auditoria` y `/admin/auditoria` (Módulo 3.3) se construyeron sin ninguna migración nueva. `evento_auditoria` ya tenía RLS completa (`auditoria_select_negocio` con `is_barberia_de()`, `auditoria_select_actor`, `auditoria_select_supersu`) desde la migración 006, y la tabla se puebla desde la Fase 1 — solo faltaba la pantalla.
**Motivo:** Consistente con el patrón ya repetido varias veces esta sesión (`texto_legal`, `punto_fidelizacion`, la aprobación de Negocio): la arquitectura de datos y autorización a menudo se adelanta correctamente en fases tempranas, pero queda inerte hasta que un módulo posterior construye la interfaz que la usa. Se documenta explícitamente para que quede claro que esto fue intencional (leer la RLS existente antes de escribir una migración nueva), no un descuido.
**Impacto:** `src/app/panel/auditoria/`, `src/app/admin/auditoria/`. Cierra el ítem de deuda técnica abierto desde la Fase 1 ("no existe un visor de auditoría").
**Estado:** Activa.

### ADL-019 — App Staff (`/staff`) es una superficie independiente de `resolverContexto()`
**Fecha:** 2026-09-15
**Decisión:** `/staff` tiene su propia guarda (`obtenerContextoStaff()`, resuelve el vínculo activo directo desde `vinculo_staff_negocio`) en vez de reutilizar `resolverContexto()` (que resuelve el Panel Negocio). A diferencia de `requireSuperSU()`, esta guarda no redirige cuando no hay vínculo activo — el layout de `/staff` renderiza un estado vacío explicando la situación, nunca una pantalla en blanco.
**Motivo:** `01-PRD/02_Functional_Architecture.md` es explícito: una persona puede ser Barbería de su propio Negocio Y tener un vínculo de Staff (negocio de 1 persona) y debe poder usar ambas superficies "indistintamente". Acoplar `/staff` a `resolverContexto()` (que resuelve una sola identidad por request para el Panel) habría forzado a elegir una sola.
**Impacto:** `src/lib/auth/require-staff.ts`, `src/app/staff/*`. `/panel` ahora redirige `rol === "STAFF"` directo a `/staff` en vez de mostrar un placeholder "todavía no construido".
**Estado:** Activa.

### ADL-020 — El sistema de Nivel PRO/EXPERT/MASTER se enciende solo para eventos ya conectados a un flujo real, el resto queda diferido explícitamente
**Fecha:** 2026-09-15
**Decisión:** De las 3 categorías de puntaje (Producción, Calidad, Puntualidad) y sus ~8 eventos documentados en `03-Business-Rules/05_Staff_Rewards.md`, este módulo solo implementa los que se conectan de forma directa y verificable a una acción real ya construida: check-in tardío (Puntualidad), Servicio completado en Caja (Producción), reseña de 5 estrellas (Calidad). "Cliente recurrente", "Referido" y los bonos agregados de "día/semana 100% puntual" NO se implementan — requieren lógica de detección (qué es "recurrente") o un job de cierre periódico (rollover de temporada) que no existen todavía.
**Motivo:** Construir esos eventos ahora habría significado inventar reglas de detección no especificadas con precisión suficiente en la Biblia para implementarlas con confianza, o construir infraestructura de cron/Edge Function fuera del alcance de un módulo de UI — mejor encender lo verificable end-to-end hoy y documentar el resto como deuda explícita que inventar una regla.
**Impacto:** Migración 030 (`iniciar_atencion_reserva`, `completar_venta_pos` extendida, trigger `trg_puntos_resena_calidad`), `docs/TECH_DEBT_REGISTER.md`.
**Estado:** Activa — el resto de eventos se agrega cuando su lógica de origen (detección de recurrencia, motor de rollover) se construya.

### ADL-021 — El Score del Marketplace exige SECURITY DEFINER: una función pública nunca debe asumir que el visitante anónimo tiene acceso RLS a las tablas internas que necesita agregar
**Fecha:** 2026-09-15
**Decisión:** `marketplace_buscar()` (Módulo 5.2) se declara `SECURITY DEFINER` — no porque necesite un chequeo de autorización propio (es pública, cualquiera la llama sin restricción), sino porque internamente agrega datos de tablas (`campana_publicitaria`, `vinculo_staff_negocio`, `nivel_staff_consolidado`, `reserva`) cuya RLS está, correctamente, restringida al negocio dueño o a SuperSU. Sin `SECURITY DEFINER`, esas subconsultas se ejecutan con los privilegios del visitante anónimo real y devuelven cero filas siempre, sin importar los datos reales — dos de los seis componentes del Score (Patrocinio, Calidad de Staff) quedaban permanentemente en 0 y un tercero (Conversión) parecía funcionar solo por coincidencia con el desempate.
**Motivo:** Se encontró probando explícitamente con el cliente `anon` real (no `service_role`) — la disciplina de este proyecto de "probar con el mismo cliente que usa la app real" es precisamente lo que expuso un bug que una prueba con credenciales de administrador nunca habría detectado, porque `service_role` bypasea RLS por completo.
**Impacto:** Migración 039. Regla general para cualquier RPC pública futura que agregue datos de múltiples tablas: si alguna de esas tablas tiene RLS restringida a un rol distinto del que llamará la función en producción, la función necesita `SECURITY DEFINER` — y la prueba de verificación debe ejercitarla con el rol real (`anon`/`authenticated` de un usuario sin privilegios), nunca solo con `service_role`.
**Estado:** Activa.

### ADL-022 — CRÍTICO: `revoke ... from public` no protege una función de `anon`/`authenticated` en Supabase — el hallazgo de seguridad más grave de todo el proyecto
**Fecha:** 2026-09-15
**Decisión:** Toda función pensada para ser invocada exclusivamente por código de servidor con `service_role` (nunca por un Cliente real) debe revocar explícitamente de `public, anon, authenticated` — nunca confiar en que revocar solo de `public` es suficiente.
**Motivo:** Se encontró, mediante la prueba end-to-end del Módulo 6.1 (Wallet), que `aplicar_evento_pago()` — la función que confirma un pago y una Reserva, existente desde la migración 008 (Fase 1) — podía ser invocada directamente por **cualquier usuario autenticado de la plataforma**, sin pasar por el webhook de Mercado Pago ni por ninguna verificación real de pago. Un atacante podía confirmar cualquier Reserva ajena pendiente de pago llamando la función con un `p_pago_id` arbitrario y `p_estado='APROBADO'` — un vector de fraude financiero real, activo en producción desde el inicio del proyecto, no introducido por ningún cambio reciente. La causa raíz: Supabase otorga privilegios de ejecución a `anon`/`authenticated` de forma independiente de `PUBLIC` (vía `alter default privileges` a nivel de proyecto) — `revoke ... from public` no toca esos privilegios propios.
**Impacto:** Migración 042 corrige las 3 funciones del proyecto que dependían de este patrón sin chequeo de autorización interno propio (`aplicar_evento_pago`, `expirar_reservas_vencidas`, `revertir_comision_wallet`). Se auditó el resto de las RPCs del proyecto: ninguna otra depende exclusivamente de este mecanismo — todas verifican autorización (`is_barberia_de()`, `is_supersu()`, comparación de `auth.uid()`) dentro de su propio cuerpo, así que no están expuestas aunque `authenticated` pueda técnicamente invocarlas. Guardado como memoria persistente para cualquier función futura de este patrón, en este proyecto o en cualquier otro sobre Supabase.
**Estado:** Activa — corregido y verificado.

### ADL-023 — Módulo 6.3 (Suscripciones): alcance recortado a lo que es real sin cobro recurrente + primer cron real del proyecto
**Fecha:** 2026-09-15
**Decisión:** El ciclo de vida de Suscripción (upgrade, downgrade programado con re-validación, suspensión/reactivación/cancelación con cascada real, camino manual de mora) se construyó completo y real. El calendario automático de reintentos de cobro (`05_Billing_Failures.md`, Día 0/1/3/7/10) se dejó explícitamente fuera de alcance: requiere Mercado Pago Preapproval (suscripciones automáticas con tarjeta guardada) — una integración de pasarela distinta de Checkout Pro (lo único integrado hoy), no una extensión. Simularlo sin cobro real habría sido una automatización falsa, contra la Regla de Oro. Se construyó en su lugar el Upgrade con cobro único real (prorrateado, vía Checkout Pro) y el camino 100% manual de SuperSU (`marcar_negocio_en_mora`, `forzar_reactivacion_pago_externo`) que cubre el Caso límite explícito de la Biblia ("pagó por transferencia manual, SuperSU fuerza reactivación") sin depender del calendario automático.
**Motivo:** Evitar exactamente el patrón "arquitectura lista, nunca conectada" ya encontrado varias veces esta sesión (Wallet nunca acreditado, puntaje de Staff nunca calculado, visitas de Marketplace nunca registradas) — pero en la dirección opuesta: no construir un calendario de días que nada avanza jamás, en vez de construir una tabla que nada consume.
**Impacto:** Se aprovechó la ocasión para construir el primer cron real del proyecto (`vercel.json` + `/api/cron/diario`, protegido por `CRON_SECRET` vía el mecanismo nativo de Vercel Cron), desbloqueando `expirar_reservas_vencidas()` (dormida desde la migración 008, migración 042 la había asegurado pero nada la invocaba nunca) y la nueva `ejecutar_downgrades_programados()`. Requiere que `CRON_SECRET` se agregue a las variables de entorno de Vercel y se haga un deploy — pendiente en `TECH_DEBT_REGISTER.md`, no controlable desde este entorno. Módulos futuros con la misma necesidad (rollover de Temporada, bonos de Puntualidad — Fase 4) pueden engancharse a esta misma ruta en vez de abrir infraestructura nueva cada vez.
**Estado:** Activa.

### ADL-024 — `RAISE EXCEPTION` aborta la transacción completa: un evento de auditoría insertado justo antes nunca persiste
**Fecha:** 2026-09-16
**Decisión:** Ninguna función SQL debe insertar un evento de auditoría/fraude inmediatamente antes de un `raise exception` en la misma llamada, esperando que ambos efectos ocurran. Cuando se necesita registrar un intento fallido Y rechazarlo, el registro debe hacerse desde una llamada de sistema **separada** (otra transacción) después de que el error llega al llamador — nunca dentro de la función que también falla.
**Motivo:** Encontrado escribiendo el motor antifraude del dominio Lealtad (ADR-011): `registrar_referido()` y `redimir_gift_card()` insertaban una fila en `lealtad_fraude_evento` inmediatamente antes de `raise exception` (auto-referido / PIN incorrecto). Un `RAISE EXCEPTION` en PL/pgSQL aborta TODA la transacción de la llamada, incluyendo cualquier `INSERT` hecho microsegundos antes — el evento de fraude nunca habría llegado a persistir en producción, precisamente en el caso que más importa auditar (un intento real de fraude). Postgres no soporta transacciones autónomas nativas (requeriría `dblink`/`pg_background`, no instalados en este proyecto).
**Impacto:** Migración 060 elimina los INSERT-antes-de-raise y agrega `registrar_evento_fraude()`, una RPC separada que la capa de servidor (o el propio Cliente, auto-limitado a reportarse a sí mismo) invoca en su propia transacción al capturar el código de error específico. Verificado explícitamente: el evento de fraude ahora sí persiste. Regla general para cualquier función futura de este proyecto que combine "rechazar" con "auditar el intento".
**Estado:** Activa — corregido y verificado.

### ADL-025 — Las extensiones de Supabase viven en el esquema `extensions`, no en `public`
**Fecha:** 2026-09-16
**Decisión:** Cualquier función que use `pgcrypto` (`gen_random_bytes`, `crypt`, `gen_salt` — no confundir con `gen_random_uuid()`, que es nativo de Postgres 13+ desde `public`) debe calificar el esquema explícitamente (`extensions.gen_random_bytes(...)`) en vez de agregar `extensions` al `search_path` del proyecto entero.
**Motivo:** `crear_gift_card()` (ADR-011) falló con "function gen_random_bytes(integer) does not exist" pese a que `pgcrypto` está habilitado desde la migración 001. Causa: Supabase instala las extensiones en el esquema `extensions` por convención, y toda función de este proyecto usa `set search_path = public` (sin incluir `extensions`) — un patrón deliberado de este codebase para no exponer accidentalmente otras funciones de extensiones a cada función nueva.
**Impacto:** Migración 060 corrige las 3 funciones afectadas calificando el esquema explícitamente. Regla general para cualquier función futura que necesite `pgcrypto` u otra extensión instalada por Supabase fuera de `public`.
**Estado:** Activa — corregido y verificado.

### ADL-026 — Un parámetro `numeric`/`text` de una RPC sin `default` en SQL se genera como no-nullable en TypeScript, aunque la base de datos sí acepte `NULL`
**Fecha:** 2026-09-16
**Decisión:** Cuando una RPC necesita aceptar legítimamente `NULL` en un parámetro (ej. "precio a cotizar manualmente" de un paquete Enterprise), y ese parámetro no tiene `default null` en la firma SQL, el tipo generado por Supabase (`src/types/database.ts`) lo marca como `number`/`string` obligatorio, nunca `| null` — un cast explícito (`as number`) es la solución correcta en la capa de servidor, no una señal de bug.
**Motivo:** Encontrado en `actualizar_paquete_creditos_ia(p_paquete_id uuid, p_precio_cop numeric, p_activo boolean)` (AI OS, ADR-013): el paquete "Enterprise" tiene `precio_cop = null` a propósito (cotización manual, sin autoservicio), y SuperSU necesita poder togglear su `activo` sin verse forzado a inventar un precio. El generador de tipos de Supabase infiere la nulabilidad de un parámetro de función a partir de si tiene `default` en SQL, no de si el tipo de columna subyacente permite `NULL` — son dos cosas distintas.
**Impacto:** Ningún cambio de esquema necesario. Regla general para cualquier RPC futura de este proyecto con un parámetro legítimamente nulleable sin valor por defecto: castear en la capa de servidor (`p_parametro: valor as TipoDeclarado`) en vez de agregar un `default null` artificial a la función SQL solo para conformar al generador de tipos.
**Estado:** Activa — documentado, sin corrección de esquema necesaria.

### ADL-027 — `completar_venta_pos()` se convierte en un Pipeline de Eventos: un `begin...exception when others...end` local aísla el fallo de un handler sin abortar la transacción completa
**Fecha:** 2026-09-16
**Decisión:** `completar_venta_pos()` (5 extensiones acumuladas desde la migración 021) deja de crecer con un bloque más por cada sistema nuevo. Se divide en dos fases: una **fase crítica** (validación, Productos/Inventario de la venta, Membresía, canje de Puntos, Pago, marcar Reserva `COMPLETADA`) que sigue inline porque determina el monto cobrado — un fallo ahí debe abortar toda la venta — y un **Pipeline de Eventos `venta_completada`** (`venta_pipeline_handler` + `ejecutar_pipeline_venta_completada()`, migraciones 070-072) que ejecuta cada sistema satélite (Puntos otorgados, Puntaje de Staff, Sellos, Cashback, Referidos de Cliente/Staff, ascenso VIP, Auditoría resumen) como una función independiente, registrada en una tabla editable por SuperSU en vez de hardcodeada — mismo patrón ya usado en `ai_modelo_config`/`ai_accion_costo`.
**Motivo:** Pedido directo del fundador tras la 5ª extensión de esta función, para "evitar que se vuelva inmanejable a medida que StylerNow siga creciendo". El mecanismo de aislamiento es un `begin ... exception when others then <auditar el fallo>; end;` alrededor de cada handler dentro del orquestador — en PL/pgSQL este bloque crea un **savepoint implícito**: si el handler lanza una excepción, Postgres deshace SOLO lo que ese handler alcanzó a hacer y continúa con el resto del `for` loop, sin propagar el error hacia `completar_venta_pos()`. Esto es DISTINTO del hallazgo de ADL-024 (un `INSERT` justo antes de un `RAISE EXCEPTION` sin capturar, que sí aborta todo porque el error se propaga sin que nada lo detenga en el camino) — acá el error se atrapa localmente en cada iteración, así que el `INSERT` de auditoría del fallo (`PIPELINE_HANDLER_FALLO`) hecho DESPUÉS de capturarlo sí persiste con normalidad, sin necesitar una RPC separada ni `dblink`/`pg_background`.
**Impacto:** Verificado explícitamente insertando un handler que apunta a una función SQL inexistente (`undefined_function`): la venta se cobra igual, la Reserva queda `COMPLETADA`, el resto de los handlers (antes y después del roto en el orden de ejecución) corre normalmente, y queda un evento de auditoría del fallo específico — 20/20 casos, incluyendo el ascenso VIP automático migrado de una 2ª llamada RPC desde TypeScript (`src/app/panel/pos/actions.ts`) a un handler más del pipeline, cerrando una ventana real donde un fallo de red entre las dos llamadas podía saltarse la evaluación de ascenso. Agregar un sistema nuevo al pipeline (Reportes, IA, etc., el día que exista un consumidor real por-venta) ya no requiere tocar `completar_venta_pos()`: es una función nueva + una fila en `venta_pipeline_handler`.
**Estado:** Activa — implementado y verificado.

## Checklist
- [x] Completo (vivo — se agregan entradas nuevas conforme surgen decisiones)
- [ ] Revisado
