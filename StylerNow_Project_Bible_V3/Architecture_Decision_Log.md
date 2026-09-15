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

## Checklist
- [x] Completo (vivo — se agregan entradas nuevas conforme surgen decisiones)
- [ ] Revisado
