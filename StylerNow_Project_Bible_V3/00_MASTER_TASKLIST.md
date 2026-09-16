# 00 — Master Tasklist (documento vivo)

> Se actualiza en cada sesión de desarrollo y al cerrar cada módulo. Es el
> único lugar que responde "¿dónde estamos y qué falta?" sin releer todo el
> código o la Biblia de nuevo. Cada ítem cita el documento de la Biblia que
> lo especifica. Convención: `[x]` construido y verificado · `[~]` parcial ·
> `[ ]` no empezado.
>
> **Estructura de fases:** desde esta sesión sigue el "Orden Oficial de
> Ejecución" dado por el fundador (Fase 1 Plataforma Compartida → Fase 2
> Barbería → Fase 3 SuperSU CMS → Fase 4 App Staff → Fase 5 Marketplace
> Premium → Fase 6 Growth Engine), que reemplaza la numeración de fases de
> `01-PRD/04_Roadmap.md` como plan operativo — el Roadmap de la Biblia sigue
> siendo la fuente de las reglas de negocio, esto es el orden de construcción.
>
> **Regla de oro (fundador):** no se desarrolla por pantallas, se desarrolla
> por dominios completos. Un dominio cierra solo con: UI + backend + RLS +
> auditoría + estados vacíos/error/offline + responsive + accesibilidad +
> documentación + pruebas. No se avanza al siguiente módulo hasta cerrar el
> actual, salvo que falte una credencial o decisión de negocio no inferible
> de la Biblia — eso se deja anotado en "Propuestas pendientes de aprobación"
> y se sigue con lo que sí se puede avanzar.
>
> **Última actualización:** 2026-09-14 · commit `3be8fbb`

## Decisiones registradas (donde la orden oficial difiere de lo ya construido)

- **Pasarela de pago: Mercado Pago, no Wompi.** La orden oficial lista Wompi
  en el stack obligatorio, pero el usuario ya pidió explícitamente el cambio
  a Mercado Pago en una sesión anterior, con credenciales de prueba
  entregadas, dominio de correo verificado para sus notificaciones, y todo
  el flujo (Checkout Pro, webhook, reconciliación, reembolsos) construido y
  verificado end-to-end en producción. **No se revierte a Wompi** sin una
  instrucción explícita nueva — hacerlo tiraría infraestructura ya probada
  sin ninguna razón de negocio distinta a la que ya se resolvió.
- **Mapas: MapLibre + OpenStreetMap.** Sin conflicto — todavía no se construyó
  ninguna función de mapa. Se adopta tal cual lo pide la orden oficial cuando
  llegue el turno de Marketplace Premium (Fase 5).
- **Push: Firebase Cloud Messaging.** Sin conflicto, nada construido aún.
  Requiere credenciales propias del proyecto (API key, VAPID key, service
  account) que no existen todavía — queda en "Propuestas pendientes".

---

## Product Coverage Matrix (tablero maestro)

Vista de una sola tabla de todos los dominios del producto, más rápida de
leer que el detalle fase por fase de abajo. `RLS` = probado con pruebas
reales contra Supabase, no solo escrito. `QA` = casos límite cubiertos y
verificados, no solo "no lanza error en el camino feliz".

| Dominio | Backend | Frontend | RLS | QA | Estado |
|---|---|---|---|---|---|
| Marketplace + Booking + Pago (Módulo 1) | ✅ | ✅ | ✅ | ✅ | Cerrado |
| PWA Cliente (Perfil, nav, legal, offline) | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.1 Registro de Barbería | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.2 Dashboard | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.3 Gestión de Sedes | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.4 Gestión de Staff | ✅ | ✅ | ✅ | ✅ | Cerrado |
| ADR-006 Panel compartido Guardian | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.5 Servicios | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.6 Agenda | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.7 CRM | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.8 POS | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.9 Inventario | ✅ | ✅ | ✅ | ✅ | Cerrado |
| 2.10 Reportes | ✅ | ✅ | ✅ | ✅ | Cerrado — **Fase 2 completa** |
| Fase 3.1 — SuperSU: Dashboard + Negocios | ✅ | ✅ | ✅ | ✅ | Cerrado |
| Fase 3.2 — SuperSU: Configuración global | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 3.3 — SuperSU: Soporte + Auditoría | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 4 — App Staff | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 5.1 — Marketplace: Favoritos + Compartir | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 5.2 — Marketplace: Destacados/Ranking (Score) | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 5.3 — Marketplace: Mapa visual (MapLibre) | ✅ | ✅ | N/A | ⚠️ Manual pendiente | ✅ Cerrado |
| Fase 6.1 — Wallet: comisión de plataforma real | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 6.2 — Marketplace Ads (Destacado + Pin) | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 6.3 — Suscripciones (ciclo de vida, sin calendario automático de mora) | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 6.4 — IA Operacional, Horarios muertos (Nivel 0, sin IA) | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 6.5 — Dominio Lealtad completo (ADR-011: Wallet, Membresías, Gift Cards, Referidos, Sellos, Cashback, VIP, Familias, Corporativo, Referidos Staff, Motor IA) | ✅ | ✅ | ✅ | ✅ | ✅ Cerrado |
| Fase 6.6+ — Growth Engine (IA con LLM real de `09-CRM-Intelligence/*`, WhatsApp) | ⬜ | ⬜ | ⬜ | ⬜ | IA ya no bloqueada por credencial (OpenRouter+Nemotron conectados) — falta construir; WhatsApp sigue bloqueado sin credenciales (ver `docs/PENDING_DECISIONS.md`) |

Ver también `docs/TECH_DEBT_REGISTER.md` (mejoras que no bloquean) y
`docs/PENDING_DECISIONS.md` (decisiones que dependen de algo externo).

---

# FASE 1 — Plataforma Compartida

Fuente: `01-PRD/02_Functional_Architecture.md`, `02-UX/03_Client_PWA.md`,
`06-Security/04_Compliance_Colombia.md`. Base común a las 4 superficies —
después de cerrar esta fase no se vuelve a tocar salvo bugs.

## Ya existía (sesiones previas)
- [x] Esquema de base de datos completo (002-007), motor de reservas y pagos
      (008/009), RLS por tabla (006), auth OTP + magic link funcionando en
      producción, Mercado Pago Checkout Pro con reconciliación server-side,
      infraestructura de despliegue (Vercel + dominio + Supabase Auth URLs)

## Cerrado en esta sesión
- [x] **Service Worker** (`public/sw.js`) — cachea shell de la app (assets
      con hash de `_next/static`, íconos) con estrategia cache-first;
      documentos con network-first y respaldo de cache offline. Nunca
      cachea rutas transaccionales (`/api/`, `/auth/`, `supabase.co`) —
      consistente con `02-UX/03_Client_PWA.md`: "sin conexión se muestra
      un estado explícito, nunca datos potencialmente obsoletos"
- [x] **Prompt de instalación PWA** (`src/components/pwa/pwa-manager.tsx`)
      — aparece recién desde la 2ª visita (nunca en la primera, exigido
      explícito por la Biblia), usa `beforeinstallprompt` en
      Android/Chrome/Edge/desktop; en iOS Safari (sin esa API) muestra
      instrucciones manuales. Persiste visitas y descarte en localStorage
- [x] **Error Boundary global** — `src/app/error.tsx` (errores de
      segmento) + `src/app/global-error.tsx` (errores del propio
      RootLayout, sin depender de Tailwind/componentes por si eso es lo
      que rompió) + `src/app/not-found.tsx` (404 con la identidad visual
      de la app en vez del default de Next)
- [x] **Consentimiento legal versionado** (`06-Security/04_Compliance_
      Colombia.md`) — migración 010 pobló `texto_legal` con Política de
      Tratamiento de Datos y Términos v1 reales (Ley 1581 de 2012); nuevas
      páginas `/legal/terminos` y `/legal/politica-de-datos` leyendo la
      versión vigente desde la base; el checkbox del login ahora enlaza a
      las dos, y **se valida server-side** en `enviarCodigo` (antes solo
      era un gate del lado del cliente — cualquiera podía llamar a la
      action directo y saltárselo); la aceptación queda registrada en
      `aceptacion_legal` (upsert idempotente) desde los dos caminos de
      login (código tipeado y magic link) — antes esa tabla existía en el
      esquema desde la migración 004 pero nunca se usaba

## Pendiente — requiere credencial o decisión que no puede inferirse de la Biblia
- [ ] **Push Notifications (FCM)** — capa de abstracción de permisos lista
      para construir (`02-UX/03_Client_PWA.md` la pide para ser
      reemplazable por el plugin nativo de Capacitor sin tocar la pantalla
      que la consume), pero la integración real necesita un proyecto de
      Firebase del propio StylerNow (API key, VAPID key, service account)
      → **Propuesta pendiente de aprobación**: crear el proyecto Firebase
      y pasar las credenciales
- [ ] **Monitoreo / Analytics de producción** (`10-Operations/06_
      Analytics_Definitions.md`) → **Propuesta pendiente de aprobación**:
      Vercel Analytics + Speed Insights son gratis en el plan actual y no
      requieren credencial nueva (consistente con "nunca introducir
      dependencias de pago si existe una alternativa gratuita
      suficientemente sólida") — falta la confirmación para instalarlos
- [ ] **Auditoría visible** — la tabla `evento_auditoria` y los inserts ya
      existen (reservas, webhooks huérfanos, cancelaciones); la pantalla
      que la muestra es responsabilidad de SuperSU CMS (Fase 3) y Panel
      Negocio → Reportes (Fase 2.10) — no se construye una pantalla suelta
      ahora para no duplicar esa UI cuando lleguen esas fases

**Fase 1: cerrada salvo los 3 ítems de arriba, que quedan bloqueados por
credenciales/decisión de negocio, no por trabajo pendiente de ingeniería.**

---

# FASE 2 — Dominio Barbería (máxima prioridad — cuello de botella del proyecto)

Fuente: `02-UX/02_Onboarding.md` (wizard), `02-UX/09_Business_Panel.md`,
`03-Business-Rules/01_Roles.md` (matriz de permisos), `01-PRD/03_
Monetization.md` (planes). **Hoy ningún negocio puede existir realmente** —
sin este dominio, el Marketplace de Cliente se ve vacío en producción.

- [x] **2.1 Registro de Barbería** — wizard de 4 pasos, progreso persistente
      vía las tablas reales (sin tabla de "progreso" temporal — migración
      `011_registro_negocio.sql`, `src/app/panel/onboarding/`)
- [x] **2.2 Dashboard** — resumen del día, ver detalle abajo
- [x] **2.3 Gestión de Sedes** — dominio completo, ver detalle abajo
- [x] **2.4 Gestión de Staff** — dominio completo, ver detalle abajo
- [x] **2.5 Servicios** — dominio completo, ver detalle abajo
- [x] **2.6 Agenda** — dominio completo, ver detalle abajo
- [x] **2.7 CRM** — dominio completo, ver detalle abajo
- [x] **2.8 POS** — dominio completo, ver detalle abajo
- [x] **2.9 Inventario** — dominio completo, ver detalle abajo
- [x] **2.10 Reportes** — dominio completo, ver detalle abajo

**Criterio de cierre de Fase 2** (orden oficial): una Barbería puede operar
todo su negocio sin herramientas externas. **Cumplido** — con 2.1 a 2.10
cerrados, una Barbería puede registrarse, configurar Sedes/Servicios/
Staff, operar la Agenda, cobrar en Caja, gestionar su CRM e Inventario, y
ver sus Reportes — todo dentro de StylerNow, sin ninguna hoja de cálculo
ni sistema externo.

## Módulo 2.1 — detalle de lo construido

- Wizard de 4 pasos en `/panel/onboarding`: Datos+Plan → Sede → Servicios →
  Invitar Staff (opcional) → Enviar a aprobación
- Migración 011: columnas `negocio.telefono_contacto`/`email_contacto`/
  `onboarding_completo`; RPC `crear_suscripcion_inicial` (único puente
  válido para escribir en `suscripcion`, que solo admite SuperSU por RLS) y
  `enviar_negocio_a_aprobacion` (exige ≥1 Sede y ≥1 Servicio, server-side,
  no solo deshabilitando el botón); tabla `invitacion_staff` con RLS propia
- Plan: solo Raven/Jarl/Valhalla por autoservicio — Allfather se rechaza
  explícitamente con `ALLFATHER_REQUIERE_COTIZACION` (`01-PRD/03_
  Monetization.md`: "no existe un flujo de autoservicio para Allfather")
- Ubicación: geolocalización del navegador (botón "Usar mi ubicación"),
  sin mapa interactivo todavía — ese llega con MapLibre en Fase 5
- Logo: subida real a Storage (`negocio-media`, bucket ya existía desde
  migración 007)
- **Invitar Staff — alcance parcial, documentado, no un botón falso:** se
  crea una fila real en `invitacion_staff` y se envía un correo real vía
  Resend. La ACEPTACIÓN (crear el `vinculo_staff_negocio` real cuando la
  persona invitada inicia sesión) se construye en el **Módulo 2.4**, no acá
  — es explícitamente un paso opcional del wizard (02-UX/02_Onboarding.md)
- `/panel` — página raíz mínima (estado del negocio, mensaje de "en
  revisión"). **No es el Dashboard del Módulo 2.2** — es solo el destino
  necesario para que el wizard tenga a dónde llevar al negocio recién
  enviado a aprobación, sin inventar métricas falsas

## Bug real encontrado y corregido durante la verificación

`INSERT ... RETURNING` sobre `negocio` fallaba con "new row violates
row-level security policy" — **no por la política en sí** (se comprobó
directo contra Postgres que hasta una política trivial `with check (true)`
fallaba igual). Causa raíz: la política de SELECT que autoriza el
`RETURNING` depende de `is_barberia_de()`, que vuelve a consultar la MISMA
fila que se está insertando dentro del mismo comando — Postgres no logra
resolver esa visibilidad en el mismo `INSERT...RETURNING`. Sedes y
Servicios no tienen este problema porque su política de SELECT depende de
`negocio` (una tabla distinta, ya committeada), no de sí mismos.

**Corrección:** `crearOActualizarNegocio()` genera el `id` con
`crypto.randomUUID()` en el servidor y hace el INSERT sin `.select()`
encadenado — nunca pide `RETURNING`, así que el problema no aplica.
Diagnosticado con una conexión directa a Postgres (no solo supabase-js)
para descartar causas alternativas antes de tocar código.

## Módulo 2.3 — detalle de lo construido

Migraciones 013 y 014 · `src/app/panel/sedes/`, `src/components/negocio/
formulario-sede.tsx`, `src/components/panel/panel-nav.tsx`.

- **CRUD completo**: listado (`/panel/sedes`), crear (`/panel/sedes/nueva`),
  editar/detalle (`/panel/sedes/[id]`), cerrar temporal, reabrir, eliminar
  (soft delete = `cerrada_permanente`, nunca borrado físico)
- **Multi-sede real desde el día uno**: `crear_sede()` RPC enforza
  `plan.limite_sedes` (Raven/Jarl tope 1, Valhalla tope 5, Allfather sin
  tope) con `403 PLAN_LIMIT_EXCEEDED` — no una validación solo de UI
- **Sede principal**: columna `es_principal` con índice único parcial (una
  sola por negocio); la primera sede creada la hereda automático;
  `establecer_sede_principal()` para cambiarla. El Marketplace
  (`marketplace_buscar`) ahora muestra la sede PRINCIPAL en la tarjeta, no
  "la primera creada por fecha" como antes
- **Reglas de negocio protegidas server-side, no solo en la UI**:
  `cerrar_sede()` rechaza cerrar la única sede operativa
  (`ULTIMA_SEDE_OPERATIVA`) y rechaza cerrar una sede con Reservas activas
  futuras (`SEDE_CON_RESERVAS_ACTIVAS`) — nunca se puede dejar una cita
  huérfana ni un negocio sin dónde recibir reservas
- **Traslado de Staff completo** (`trasladar_staff()`, exclusivo de
  Barbería per `03-Business-Rules/01_Roles.md`): cambia `sede_activa_id`,
  audita antes/después en `evento_auditoria`. El historial y el Nivel
  PRO/EXPERT/MASTER se conservan gratis porque están indexados por
  `vinculo_id`, que no cambia en un traslado. El alcance de Guardian se
  recalcula solo — `is_guardian_de_sede()` ya evalúa `sede_activa_id` en
  vivo, así que mover la sede activa ES lo que cambia su alcance, sin un
  paso adicional
- **Horarios — excepciones, festivos, horario especial**: tabla
  `sede_horario_excepcion` nueva; `slots_disponibles()` la respeta (un
  festivo corta toda la sede ese día, un horario especial reemplaza el
  semanal solo para esa fecha) — sin esto la disponibilidad real nunca
  hubiera podido reflejar un cierre puntual
- **Ubicación**: dirección/ciudad/lat-lng ya se completan (por
  geolocalización del navegador, sin selector de mapa interactivo) — listo
  para MapLibre/OSM cuando llegue Fase 5, sin bloquear nada ahora
- **Reutilización**: `FormularioSede` es un componente nuevo, único lugar
  donde vive el formulario de sede (nombre/dirección/horario/ubicación) —
  antes vivía duplicado dentro del wizard de onboarding; ahora el wizard
  también lo usa

## Bugs reales encontrados y corregidos durante la verificación

1. **`max(uuid)` reintroducido** — al reescribir `slots_disponibles()` para
   soportar excepciones (migración 013), se copió una versión vieja de la
   función que todavía tenía el bug de `max(uuid)` ya corregido una vez en
   la migración 009. Encontrado por la prueba real (no a simple vista),
   corregido en la migración 014.
2. **`found` pisado entre dos SELECT** — la variable plpgsql `found` que
   marcaba "hay una excepción de horario ese día" quedaba sobreescrita por
   el SELECT de conteo de Servicios que corría después, antes de llegar al
   CTE que la necesitaba. Corregido capturando el valor en una variable
   propia (`v_hay_excepcion`) apenas se conoce.

Ambos se encontraron con pruebas reales contra la base (no revisión de
código a ojo) — exactamente la disciplina que pidió el fundador.

**Regresión verificada**: las 25 pruebas originales del motor de reservas
(Módulo 1, sesión anterior) se re-ejecutaron completas después de reescribir
`slots_disponibles()` — 25/25 siguen pasando. El cambio para soportar
excepciones de horario no rompió nada del flujo de reserva/pago existente.

## ADR-006 — Guardian comparte el Panel Negocio (decisión del fundador, implementada antes de 2.4)

Cambio de arquitectura explícito antes de seguir con Staff: el Panel
Negocio no esperaba a Fase 4 para darle a Guardian una vista funcional —
ver `ADR_006_Guardian_Panel_Compartido.md` y `Architecture_Decision_Log.md`
ADL-011 para el razonamiento completo. Resumen de lo construido:

- [x] **`resolverContexto()`** (`src/lib/auth/resolver-contexto.ts`) —
      resolutor único que determina `rol` (`BARBERIA`/`GUARDIAN`/`NINGUNO`),
      `negocioId`, `sedeId` y un objeto `permisos` explícito. No cachea
      nada entre requests — un traslado de Staff cambia el alcance en el
      siguiente request, sin logout (verificado)
- [x] **Navegación dinámica** — `PanelNav` recibe el `rol` y oculta
      "Sedes" para Guardian (administra la propia desde su Resumen, no
      una lista de sedes ajenas)
- [x] **`/panel` (Resumen) ramificado** — Barbería ve el negocio completo;
      Guardian ve solo su sede
- [x] **`/panel/sedes` y `/panel/sedes/[id]` con alcance real** — Guardian
      nunca ve el listado completo (se redirige directo a su propia sede);
      intentar abrir el detalle de una sede ajena devuelve 404; los
      botones de cerrar/reabrir/eliminar/marcar-principal/trasladar se
      **ocultan por completo** para Guardian (no solo se deshabilitan) — y
      las RPCs los rechazan igual si alguien las llamara directo
- [x] **`/panel/onboarding` protegido** — un Guardian ya no puede arrancar
      el wizard como si fuera a registrar un negocio nuevo

### Verificado end-to-end contra la base real (14/14)
Guardian edita su propia sede y agrega excepciones de horario · Guardian
NO puede editar ni agregar excepciones en una sede ajena del mismo negocio
· Guardian rechazado por las 5 RPCs exclusivas de Barbería (cerrar,
eliminar, marcar principal, crear sede, trasladar Staff) incluso sobre su
propia sede · Barbería SÍ puede trasladarlo · tras el traslado, el alcance
cambia al instante (edita la sede nueva, ya no la anterior) sin ningún
logout · el perfil Guardian se conserva, no se revoca por el traslado.

### Documentación actualizada con este cambio
`ADR_006_Guardian_Panel_Compartido.md` (nuevo) · `Architecture_Decision_
Log.md` (ADL-011) · `CHANGELOG.md` (nuevo, creado en esta sesión) · este
archivo.

## Módulo 2.4 — detalle de lo construido

Migración 015 · `src/app/panel/staff/`, `src/app/invitacion/[id]/`,
`src/lib/hooks/use-en-linea.ts`. Consume `resolverContexto()` directamente
— ninguna pantalla calcula su propio alcance comparando columnas a mano.

- **El TODO real que quedó abierto en 2.1 se cerró acá**: `invitarStaff()`
  solo registraba la fila y mandaba el correo — no existía ninguna forma de
  ACEPTAR. `responder_invitacion()` (RPC) crea de verdad el `staff` y el
  `vinculo_staff_negocio` cuando la persona invitada entra a
  `/invitacion/[id]` con el mismo correo y decide aceptar o rechazar. El
  wizard de onboarding (2.1) ahora llama al mismo RPC compartido
  (`crear_invitacion_staff`) en vez de duplicar la lógica de insert — una
  sola forma de invitar en todo el sistema.
- **Listado con búsqueda/filtro/orden/paginación reales** (`/panel/staff`):
  vista `vista_staff_negocio` (`security_invoker=true` — hereda el RLS real
  de las tablas base, no es una puerta de autorización propia) consultada
  directo con `.ilike()/.eq()/.range()/.order()` de supabase-js, sin RPC de
  lectura a medida. Estados vacíos, skeleton de carga, banner de "sin
  conexión" (`useEnLinea`, nuevo hook reutilizable) y "cargar más"
  incremental — nada mockeado.
- **Ciclo de vida completo del vínculo**, todo exclusivo de Barbería
  (`03-Business-Rules/01_Roles.md`), todo auditado en `evento_auditoria`
  (actor, fecha, negocio, antes/después) y sin borrado físico nunca:
  `promover_guardian` / `revocar_guardian`, `suspender_staff` /
  `reactivar_staff`, `retirar_staff` ("Eliminar acceso" de la matriz —
  revoca el perfil Guardian si lo tenía, sin período de gracia).
- **Invitaciones con ciclo completo**: pendiente, reenviada
  (`reenviar_invitacion`, extiende `expira_at` y cuenta reenvíos),
  cancelada (`cancelar_invitacion` — ya no es un DELETE, es un estado
  auditado; se quitó la política de DELETE de la tabla), expirada (lazy,
  al intentar responder una vencida), aceptada, rechazada (estado nuevo
  `RECHAZADA` en el enum).
- **Tope duro de plan aplicado a Staff** (`plan.staff_tope_absoluto` —
  hoy solo Raven, 2), igual que 2.3 lo aplicó a Sedes: se revisa al crear
  la invitación (contando vínculos activos + invitaciones pendientes, para
  no poder sobre-reservar el cupo) y otra vez al aceptar (por si el cupo
  se llenó mientras la invitación esperaba respuesta).
- **ADL-009 respetado explícitamente**: `responder_invitacion` rechaza con
  `YA_TIENE_VINCULO_ACTIVO` si la persona ya tiene un vínculo no-RETIRADO
  en OTRO negocio, con un mensaje legible en vez de dejar que la rechace el
  índice único a ciegas. Si vuelve a un negocio donde ya había estado
  (RETIRADO), reactiva la MISMA fila en vez de crear una nueva — el
  historial de Nivel PRO/EXPERT/MASTER, indexado por `vinculo_id`, no se
  pierde.
- **RLS corregido, no solo agregado**: el alcance de Guardian sobre
  `vinculo_staff_negocio` era el negocio completo (`is_guardian_de_negocio`)
  desde antes de este módulo — la matriz de Roles dice que "Ver
  compañeros" es 🏢 (una sola sede), no el negocio entero. Se corrigió en
  la misma migración que lo necesitaba, para no dejar la matriz de permisos
  desalineada del código. Nuevas políticas: `perfil_select_staff_interno`
  (Barbería/Guardian ven el teléfono/correo de su propio equipo — antes
  `perfil` solo era visible para uno mismo, SuperSU, o CRM de Clientes) y
  `negocio_select_invitado` (un invitado ve el nombre del negocio aunque
  todavía esté `PENDIENTE_APROBACION` y él mismo todavía no sea Staff).
- **`resolverContexto()` extendido con un rol nuevo, `STAFF`**: aceptar una
  invitación como Staff plano (o como Guardian sin sede todavía asignada)
  antes solo existía en teoría — en la práctica el resolutor los mandaba al
  wizard de "crear negocio" (`rol NINGUNO`), un destino roto. Ahora
  `/panel` les muestra una pantalla honesta con sus propios datos reales y
  una nota clara de que la App Staff completa es Fase 4 — nunca un
  Dashboard con datos inventados. Un vínculo `SUSPENDIDO` también se
  distingue (`estadoVinculo`) para mostrar por qué está bloqueado, en vez
  de la misma pantalla confusa.
- **`PermisosPanel` ganó 8 campos nuevos** (`invitarStaff`,
  `promoverGuardian`, `revocarGuardian`, `suspenderStaff`, `reactivarStaff`,
  `retirarStaff`, `cancelarInvitacionStaff`, `cambiarHorarioOtroStaff` —
  este último reservado para cuando exista Agenda, Guardian también lo
  tiene per la matriz) — ninguna pantalla de Staff calcula su propio
  alcance comparando `rol` a mano.
- **Historial auditable** en la ficha de cada Staff (`/panel/staff/[id]`):
  se lee directo de `evento_auditoria` (mismo patrón que ya usaba Sedes),
  visible solo para Barbería — RLS ya lo filtra así, la UI solo lo alinea.

### Verificado end-to-end contra la base real (44/44)
Invitar → aceptar (crea `staff` + `vinculo_staff_negocio` reales) → rechazar
(no crea nada) · solo el correo invitado puede responder su propia
invitación · reenviar extiende el vencimiento · cancelar es un estado, no
un DELETE, y no se puede cancelar dos veces · ADL-009: no se puede aceptar
un segundo vínculo activo en otro negocio · tope duro de plan (Raven = 2)
bloquea una 3ª invitación y se libera al retirar a alguien · promover/
revocar Guardian con sus reglas (`FALTA_SEDE_ACTIVA`, `YA_ES_GUARDIAN`,
`NO_ES_GUARDIAN`) · Guardian ve SOLO su sede en el listado, nunca otra
sede del mismo negocio · Guardian rechazado por las 6 acciones exclusivas
de Barbería (trasladar, suspender, retirar, invitar, revocarse el propio
Guardian, cancelar invitaciones) · Guardian NO ve el log de auditoría del
negocio — solo eventos donde él mismo fue el actor · suspender/reactivar/
retirar con sus transiciones válidas e inválidas · Barbería ve el correo
de su Staff, un tercero sin vínculo no · un invitado ve el nombre del
negocio antes de ser Staff · SuperSU conserva acceso total.

### Documentación actualizada con este módulo
Este archivo · `CHANGELOG.md`. No se abrió un ADR nuevo — todo lo
construido ejecuta decisiones ya tomadas en ADR-002 (roles) y ADR-006
(Panel compartido), sin un cambio de arquitectura nuevo que registrar.

### Propuestas pendientes de aprobación
- **Documentos del Staff** (2.4.2 los pide como "arquitectura preparada",
  no como pantalla ahora): cuando se necesiten, un bucket de Storage
  (`staff-documentos`) + una tabla `staff_documento` se agregan sin tocar
  el resolutor de permisos ni el RLS de este módulo — no se construyó nada
  de esto todavía porque no hay un requisito concreto de qué documento
  guardar ni quién debe verlo.
- **Editar comisión después de la invitación** vive en Finanzas (2.10, no
  construido) — hoy `comision_pct` se fija una sola vez al invitar y se
  muestra de solo lectura en la ficha del Staff.

## Módulo 2.2 — detalle de lo construido

Migración 016 · `src/app/panel/dashboard-actions.ts`,
`src/components/panel/dashboard-resumen.tsx`, `01-PRD/05_KPIs.md`
(sección "KPIs del Resumen del día", nueva — la Biblia no traía la fórmula
exacta de % de ocupación ni de ingresos del día, solo la mencionaba).

- **Mismo componente para Barbería y Guardian** (`<DashboardResumen>`) —
  el alcance (negocio completo vs. una sola sede) se resuelve en las RPCs
  server-side, nunca en el componente, siguiendo el mandato de ADR-006.
- **`dashboard_resumen_dia()`**: citas de hoy (distinto de `CANCELADA`),
  ingresos de hoy (solo `COMPLETADA` — una cita `CONFIRMADA` todavía no
  suma), % de ocupación (minutos reservados hoy ÷ minutos de
  `disponibilidad` configurada por Staff `ACTIVO` ese día, descontando
  bloqueos de ausencia — `null`, no `0%`, cuando no hay ninguna
  disponibilidad cargada) y la próxima cita `CONFIRMADA`.
- **`dashboard_ranking_staff_semana()`**: top 10 por comisión generada
  (`monto_total × comision_pct ÷ 100` de Reservas `COMPLETADA` de la
  semana en curso, lunes a domingo) — misma fórmula de comisión de Staff
  de `08-Growth-Monetization/02_Commissions.md`.
- **Línea de tiempo del día**: `SELECT` directo sobre `reserva`, sin RPC
  propio — ya lo protegen `reserva_select_barberia`/`reserva_select_
  guardian` (migración 006).
- **No se inventan métricas en 0**: si el negocio todavía no está
  `ACTIVO`, ni siquiera se consultan las RPCs — se muestra el mensaje de
  "en revisión" que ya existía, nunca un Dashboard con ceros falsos.
- **Simplificación V1 documentada** (no bloqueante): un bloqueo de
  ausencia que se solapa parcialmente con una franja de disponibilidad
  descuenta la franja completa, no solo la porción solapada — ver la nota
  en `01-PRD/05_KPIs.md`.

### Verificado end-to-end contra la base real (15/15)
Un tercero sin vínculo no puede pedir el resumen ni el ranking · citas/
ingresos/ocupación/próxima cita calculados correctamente con una
`COMPLETADA`, una `CONFIRMADA` futura y una `CANCELADA` (que no cuenta en
nada) · una sede sin Staff ni citas da 0 y ocupación `null` (no división
por cero) · Guardian obtiene el resumen de SU sede pero es rechazado si
pide otra sede o el negocio completo sin `p_sede_id` · ranking calcula
bien la comisión (50% de $50.000 = $25.000).

### Documentación actualizada con este módulo
`01-PRD/05_KPIs.md` (fórmulas nuevas), este archivo, `CHANGELOG.md`.

---

## Módulo 2.5 — detalle de lo construido

Migración 017 · `src/app/panel/servicios/`, `src/components/negocio/
formulario-servicio.tsx`, `src/components/negocio/formulario-combo.tsx`.
El CRUD base de `servicio` (RLS + trigger de protección de precio) ya
existía desde la migración 006 (construido junto al motor de reservas) —
esta migración completa lo que faltaba: cota superior de duración, y
Combos como catálogo real (nunca se había construido una pantalla).

- **Bug real de producción encontrado durante la verificación (el más
  importante de esta sesión):** `staff_servicio` está vacía por defecto y
  nunca tuvo una pantalla que la llenara — el motor de reservas
  (`slots_disponibles`, migración 008/009) exige una fila explícita de
  `staff_servicio` por cada Servicio para considerar a un Staff apto.
  **Ningún Servicio de ningún negocio era reservable por nadie hasta este
  módulo** — no por un bug del motor (esa lógica es correcta y ya estaba
  verificada), sino porque no existía ninguna UI para poblar esa tabla. La
  pantalla "Staff asignado" de `/panel/servicios/[id]` es la que cierra
  ese hueco. Se verificó explícitamente con una prueba real: `negocio_
  staff_publico()` no devuelve a nadie apto para un Servicio recién creado
  hasta asignar Staff a mano.
- **CRUD completo de Servicios** (`/panel/servicios`, `/panel/servicios/
  nuevo`, `/panel/servicios/[id]`): nombre, descripción, duración (rango
  5-480 min, antes solo tenía un mínimo de >0), precio, categoría de
  puntaje (reutiliza `categoria_puntaje` — Estándar/Premium/Complementario,
  ya existente para el Sistema de Niveles, `03-Business-Rules/05_Staff_
  Rewards.md` — nunca se inventó una categorización nueva), buffers.
  Activar/desactivar es soft delete (nunca borrado físico, Reservas
  conservan su referencia íntegra).
- **Validaciones server-side, no solo de UI**: duración fuera de rango y
  precio negativo ya eran `CHECK` constraints reales de la base (desde
  migración 002) — se verificaron con inserts directos, no solo leyendo el
  esquema. Nombre duplicado (mismo negocio, mismo nombre, otro Servicio
  ACTIVO) se valida en la Server Action.
- **Permisos según la matriz de Roles, reforzados por un trigger que ya
  existía**: Guardian puede editar duración y activar/desactivar (🏢) pero
  el trigger `trg_proteger_precio_servicio` (migración 006) rechaza
  cualquier cambio de precio que no venga de la Barbería — verificado con
  un UPDATE real de Guardian, no asumido.
- **Combos** (`servicio_combo` + `servicio_combo_item`, nuevo): agrupan 2+
  Servicios activos con un nombre propio; exclusivo de Barbería (se trata
  como decisión de precio/empaquetado, igual criterio que "Cambiar
  precio" de la matriz). Conectado de verdad al flujo de reserva del
  Cliente (`negocio/[slug]/reservar`): un combo aparece como un atajo de
  un toque que selecciona sus Servicios miembro — nunca quedó como un
  catálogo sin consumidor real.
  - `precio_total_override`/`duracion_minutos_override` (la "eficiencia de
    tiempo real" de `03-Business-Rules/02_Booking_Rules.md`) se guardan y
    se muestran, pero **no están conectados todavía al motor de
    disponibilidad** — conectarlos exige tocar `slots_disponibles`, un RPC
    crítico ya verificado dos veces en sesiones anteriores (bugs de
    `max(uuid)` y de `found` pisado). Se prioriza no arriesgar ese código
    por una función opcional del combo — registrado en
    `docs/TECH_DEBT_REGISTER.md`.
- **`PermisosPanel` ganó 6 campos nuevos** (`crearServicio`,
  `cambiarPrecioServicio`, `editarServicio`, `activarDesactivarServicio`,
  `gestionarCombos`, `asignarStaffServicio`) — ninguna pantalla de
  Servicios calcula su alcance comparando `rol` a mano.
- **Reutilización**: `FormularioServicio` es el único formulario de
  Servicio — el wizard de onboarding (2.1) y el Panel completo llaman a
  las mismas Server Actions (`crearServicio`/`eliminarServicio` se movieron
  de `onboarding/actions.ts` a `panel/servicios/actions.ts`, sin duplicar
  la lógica de validación).

### Verificado end-to-end contra la base real (20/20)
Duración fuera de rango y precio negativo rechazados por `CHECK`
constraints reales · Guardian rechazado al cambiar precio pero autorizado
a cambiar duración/estado · Barbería SÍ cambia el precio · Guardian NO
puede crear ni editar combos (RLS deja el UPDATE en 0 filas afectadas, no
en un error — verificado releyendo con `service_role`, no solo revisando
la ausencia de excepción) · un combo `INACTIVO` deja de ser visible
públicamente · **sin `staff_servicio`, nadie figura apto para un Servicio
— tras asignar, sí** (el hallazgo central del módulo) · un tercero anónimo
no puede alterar `staff_servicio` · desactivar un Servicio lo conserva
(`INACTIVO`, nunca borrado físico).

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`, `docs/TECH_DEBT_REGISTER.md` (override de
combo no conectado al motor de disponibilidad).

---

## Módulo 2.6 — detalle de lo construido

Migración 018 · `src/app/panel/agenda/`. `slots_disponibles()`,
`crear_reserva()` y `cancelar_reserva()` (migración 008/009, ya
verificadas dos veces en sesiones anteriores) **no se tocaron** — son la
autoridad de disponibilidad; este módulo agrega lo que faltaba para que
el Panel pueda operar sobre ellas.

- **Vista Día**: columnas por Staff de la sede activa, cuadrícula de 30
  minutos calculada desde el `horario_base` real de la Sede para ese día
  (min/max de sus ventanas; sin ventanas configuradas, fallback 07:00-21:00
  para no dejar la pantalla vacía). Citas coloreadas por estado, bloqueos
  de ausencia como región rayada. **Drag & drop real**: arrastrar una cita
  a la columna de otro Staff dispara `reasignar_staff_reserva` (mismo
  horario, valida las 7 reglas para el Staff destino). Cambiar el
  horario usa un selector explícito de horarios reales (`slots_
  disponibles`), no arrastre libre de píxeles — una decisión deliberada
  para no construir una interacción de tiempo-exacto poco confiable sin
  una librería de calendario dedicada.
- **Vista Semana**: columnas por Staff, una fila por día — el mockup
  exacto de `02-UX/09_Business_Panel.md` ("Vista semanal por Staff,
  columnas"). Tocar un día lleva a la Vista Día para la interacción
  completa.
- **Crear cita manual ("reserva telefónica")**: `crear_reserva_manual()`
  reutiliza `slots_disponibles()` — **las mismas 7 validaciones, sin
  atajos** (`02-UX/09_Business_Panel.md` lo exige explícitamente). Busca
  el Cliente entre quienes ya tuvieron una Reserva con el negocio (RLS
  `perfil_select_crm_negocio`, ya existente) — un Cliente genuinamente
  nuevo todavía no es buscable por este camino (ver `docs/PENDING_
  DECISIONS.md`, no bloqueante). `expira_at` se extiende a 24 h (vs. 10
  min del flujo online) porque acá no hay un Cliente completando el pago
  en el momento.
- **Reprogramar** (`reprogramar_reserva()`): mismas 7 validaciones sobre
  el nuevo horario, conserva `id`/Seña/historial. Cliente dentro de la
  ventana de reembolso parcial, o Negocio sin restricción de ventana
  (indisponibilidad sobrevenida del Staff, `03-Business-Rules/02_Booking_
  Rules.md`).
- **Reasignar Staff** (`reasignar_staff_reserva()`): exclusivo Barbería/
  Guardian de la Sede, valida que el nuevo Staff cumpla las 7 reglas para
  ese mismo horario (incluida su propia `staff_servicio`).
- **Cancelar**: reutiliza `cancelar_reserva()` tal cual — ya soportaba
  cancelación iniciada por el Negocio con reembolso 100%, no hizo falta
  ningún cambio.
- **Bloquear horario**: sin RPC nueva — `bloqueo_ausencia` ya tenía RLS
  completo (`bloqueo_ausencia_write_propio`/`_write_barberia_guardian`,
  migración 006) que ya permitía exactamente el INSERT/DELETE que la UI
  necesita.
- **Conflictos**: no se construyó un mecanismo nuevo de detección — los
  tres RPCs re-validan contra `slots_disponibles()` en el momento, y el
  índice de exclusión GIST de `reserva.rango` (migración 003) sigue
  siendo el lock real a nivel de base contra condiciones de carrera.

### Verificado end-to-end contra la base real (15/15)
Un tercero rechazado en las 3 RPCs nuevas · cliente inexistente rechazado
al crear una cita manual · el mismo horario ocupado es rechazado en un
segundo intento · el Cliente reprograma dentro de su ventana (conserva
`id`) pero es rechazado fuera de ella · el Negocio reprograma sin esa
restricción · reasignar a un Staff sin `staff_servicio` para ese Servicio
es rechazado, habilitarlo lo permite · cancelar desde el Negocio siempre
reembolsa 100% · un tercero no puede bloquear la agenda ajena, la
Barbería sí · las 3 acciones nuevas quedan en `evento_auditoria`.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`, `docs/PENDING_DECISIONS.md` (Cliente
genuinamente nuevo en una reserva manual, y si un Negocio debería poder
confirmar una cita manual sin cobrar Seña en el momento).

---

## Módulo 2.7 — detalle de lo construido

Migraciones 019-020 · `src/app/panel/crm/`. El bucket de Storage
`crm-fotos` y su RLS ya existían desde la migración 007 (previstos, nunca
usados hasta ahora) — esta es la primera vez que algo los consume de
verdad.

- **Listado** (`/panel/crm`): foto, nombre, visitas, LTV, última visita,
  etiquetas — búsqueda por nombre/teléfono, orden, "Solo VIP", paginación
  incremental. Filtros que no son columnas directas de la vista (sede,
  etiqueta, consentimiento de marketing) se resuelven ANTES como listas de
  `cliente_id` intersecadas, nunca después de paginar — evita el bug de
  "página vacía con resultados reales más adelante" que un filtro post-
  paginación produciría.
- **`vista_crm_cliente`** (`security_invoker=true`, hereda RLS real de
  `reserva`/`perfil`): agrega visitas, ticket promedio, última/primera
  visita y **LTV = Ticket promedio × frecuencia anual × 2**
  (`01-PRD/05_KPIs.md`, "LTV de Cliente (aproximado)") — un único lugar
  que lo calcula, nadie más lo recalcula distinto. Un Cliente que solo
  canceló o tuvo No-show sigue apareciendo (fila con visitas=0), tal cual
  exige `01_CRM_Complete.md`.
- **VIP dinámico, nunca guardado**: se calcula en cada lectura
  (`ltv >= $500.000`, el mismo número que la Biblia da como *ejemplo* de
  regla — no hay un umbral de plataforma fijo documentado). Esto es
  exactamente lo que pide el caso límite de `07_CRM.md`: la etiqueta no
  puede quedar "pegada" tras un reembolso que baje el LTV, y al no
  guardarse nunca, no hay nada que recalcular.
- **Detalle** (`/panel/crm/[clienteId]`): resumen (LTV, visitas, última
  visita, Puntos de fidelización reales vía `punto_fidelizacion`, servicio
  favorito y Staff preferido calculados por frecuencia), historial
  completo con reseña si la dejó, notas privadas (nunca visibles al
  Cliente — verificado), etiquetas manuales, galería de fotos.
- **Riesgo de abandono**: NO se inventa un score. `07_CRM.md` lo define
  como dependiente de `09-CRM-Intelligence/04_AI_Business.md` (IA de
  Fase 6) — la ficha lo muestra como "no disponible todavía", nunca un
  número falso.
- **Fotos con consentimiento real, no una casilla decorativa**:
  `reserva_foto.consentimiento` tiene `check (consentimiento = true)` —
  es **imposible** insertar una fila sin consentimiento explícito,
  verificado con un intento directo que la base rechaza.
- **Segmentación** (`/panel/crm/segmentos`): las 4 plantillas sugeridas
  por `01_CRM_Complete.md` (inactivos 45+ días, VIP sin visita reciente,
  cumpleañeros del mes, primera visita hace 7 días) más un constructor
  personalizado (etiqueta + LTV + última visita). Excluye automáticamente
  a quien retiró el consentimiento de marketing — no es una opción
  desactivable por defecto, tal cual exige el caso límite de
  `01_CRM_Complete.md`. Sin campañas todavía (Fase 6): el segmento hoy es
  una lista de Clientes real y útil por sí sola, no un catálogo colgado
  de una función que no existe.
- **Exportar clientes**: CSV real generado del listado completo (hasta
  5.000 filas), exclusivo de Barbería (`exportarClientes`, nuevo en
  `PermisosPanel`) — matriz de Roles.
- **Aislamiento entre negocios, verificado**: un Cliente que nunca
  reservó con un Negocio no aparece en su CRM ni con `service_role`
  suplantado por otro dueño — es la propiedad más importante de este
  módulo y la que más se probó.

### Verificado end-to-end contra la base real (14/14)
LTV calculado correctamente (2 Reservas de $40.000/$60.000 → ticket
promedio $50.000 → LTV $200.000) · aislamiento entre negocios (el Cliente
no aparece en el CRM de un negocio donde nunca reservó) · un tercero sin
vínculo no lee nada · las notas nunca son visibles al propio Cliente · un
tercero no puede escribir notas/fotos en un negocio ajeno · etiqueta
duplicada rechazada por constraint único · **una foto sin consentimiento
es rechazada por un `CHECK` real de la base** · una foto no puede
asociarse a un cliente que no es el de esa Reserva.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`.

---

## Módulo 2.8 — detalle de lo construido

Migración 021 · `src/app/panel/pos/`.

- **Hallazgo real de producción (el mismo patrón que `staff_servicio` en
  2.5): `punto_fidelizacion` tenía tabla y RLS de lectura desde el Módulo
  1, pero ningún código otorgaba Puntos todavía.** El sistema de
  fidelización de Cliente existía en el esquema pero nunca se había
  activado — esta migración es la primera vez que se otorgan Puntos de
  verdad (al completar una venta) y la primera vez que se canjean.
- **`completar_venta_pos()`**: una sola transacción que registra
  Productos vendidos durante la atención, canjea Puntos (FIFO, nunca deja
  el saldo bajo $0 — `03-Business-Rules/04_Lealtad.md`), cobra el Saldo
  restante (efectivo/datáfono propio — `03-Business-Rules/03_Payment_
  Rules.md`: "cobrado por el Negocio directamente en Sede"), registra
  Propina, marca la Reserva `COMPLETADA`, y otorga Puntos nuevos (10 por
  cada $10.000 del valor del **Servicio** — nunca de los Productos, la
  regla de acumulación de `04_Lealtad.md` es explícita: "Reserva
  completada", no "venta completada").
- **`cierre_caja_dia()`**: efectivo vs. digital (todo lo que no es
  `EFECTIVO` — datáfono propio y Mercado Pago) y total del día,
  exactamente el mockup `B6-POS`. Nunca ajusta discrepancias
  automáticamente (`QA-BIZ-084`) — solo suma lo que quedó registrado.
- **Catálogo de Productos** (`/panel/pos/productos`): CRUD simple,
  reutiliza el mismo enum `servicio_estado` (ACTIVO/INACTIVO) que
  `servicio` — Inventario (2.9) extiende esta misma tabla con stock, sin
  rediseñarla.
- **Autorización de quien cobra**: Barbería, Guardian de la Sede, o el
  propio Staff que atendió la cita (`reserva.staff_id = auth.uid()`) —
  consistente con que la venta ocurre "durante la atención".
- **Configuración de Puntos por Negocio**: `negocio.puntos_valor_100_cop`
  (tasa de canje, default $5.000) y `puntos_expiracion_meses` (rango
  6-24, `CHECK` real de la base — `04_Lealtad.md`).

### Verificado end-to-end contra la base real (14/14)
Un tercero no puede cobrar una venta ajena · el Staff que atendió sí
puede · saldo + producto calculado correctamente · Puntos otorgados solo
sobre el valor del Servicio (no el producto) · no se puede cobrar la
misma reserva dos veces · canjear Puntos descuenta el valor exacto según
la tasa configurada y los deja en 0 disponibles (consumo FIFO) · pedir
canjear más Puntos de los disponibles no rompe, aplica solo lo que hay,
el saldo nunca queda negativo · cierre de caja suma efectivo/digital/
total correctamente · un tercero no ve el cierre de caja ajeno ·
producto con precio negativo rechazado por `CHECK` real.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`.

---

## Módulo 2.9 — detalle de lo construido

Migración 022 · `src/app/panel/inventario/`. A diferencia de todos los
módulos anteriores, Inventario NO tenía documento de reglas de negocio en
la Biblia — ADL-009 lo había marcado explícitamente como Decisión abierta.
Esta migración ES esa fase posterior; el diseño completo, con su
razonamiento, queda formalizado en `ADR_009_Inventario_Stock_Por_Sede.md`
(ADL-014).

- **`producto_stock`, una fila por (Producto, Sede)** — nunca una
  cantidad única a nivel Negocio. `producto` (Módulo 2.8) sigue siendo el
  catálogo compartido; el conteo físico es por Sede, que es justamente
  por qué la matriz de Roles le da a Guardian alcance 🏢 (su Sede) en
  este módulo — verificado explícitamente: Guardian de sede A no puede
  tocar el stock de sede B.
- **Todo movimiento deja rastro**: `registrar_movimiento_inventario()`
  (entrada/salida) y `ajustar_stock()` (conteo físico, delta con signo)
  son el único camino de escritura — nunca un `UPDATE` directo de
  `stock_actual`. `movimiento_inventario` es el libro mayor real; el
  `stock_actual` cacheado es una derivación, nunca la fuente de verdad.
- **Conectado de verdad con POS y Servicios (el roadmap lo pedía
  explícitamente)**: `completar_venta_pos()` (migración 021) se extendió
  para descontar stock por dos caminos, ambos auditados: `SALIDA`
  (Productos vendidos directo en la venta) y `CONSUMO_SERVICIO`
  (`servicio_producto_consumo`, insumos que un Servicio gasta
  automáticamente al completarse — nunca se cobran, solo se descuentan).
  Se re-verificó la suite completa de POS (14/14) después de este cambio
  para confirmar que no rompió nada ya probado.
- **Solicitud de reposición** como paso previo a "registrar entrada"
  (la matriz de Roles las lista como dos acciones distintas): Guardian/
  Barbería piden reponer, Barbería la atiende — atenderla genera una
  ENTRADA real automáticamente, no es un estado que quede suelto.
- **"Configurar reglas" exclusivo de Barbería**: stock mínimo por
  (Producto, Sede) y las reglas de consumo automático por Servicio —
  verificado que Guardian es rechazado en ambas.
- **Alerta de stock bajo en tiempo de consulta**
  (`stock_actual <= stock_minimo`) — nunca una bandera guardada que se
  pueda desincronizar del conteo real.
- **Stock negativo permitido, sin `CHECK` que lo bloquee** (decisión
  consciente, documentada en el ADR): un problema de conteo no debe
  impedir cobrarle a un Cliente una cita ya hecha.

### Verificado end-to-end contra la base real (20/20)
Entrada/salida/ajuste correctos · un tercero rechazado · Guardian de una
sede rechazado en la sede ajena, autorizado en la propia ·
`CONSUMO_SERVICIO` no se puede registrar manualmente (solo lo genera
`completar_venta_pos`) · stock mínimo y consumo automático exclusivos de
Barbería, Guardian rechazado en ambos · solicitud de reposición: creada
por Guardian, atendida por Barbería genera una ENTRADA real, no se puede
atender dos veces · **el consumo automático de un Servicio completado
descuenta stock sin que el Producto se haya vendido en POS, trazado a la
Reserva exacta** · vender un Producto en POS y el consumo automático de
otro Servicio descuentan ambos correctamente en la misma sesión.

### Documentación actualizada con este módulo
`ADR_009_Inventario_Stock_Por_Sede.md` (nuevo), `Architecture_Decision_
Log.md` (ADL-014), este archivo, `CHANGELOG.md`.

---

## Módulo 2.10 — detalle de lo construido

Migración 023 · `src/app/panel/reportes/`.

- **Ingresos por semana/mes** (`reportes_ingresos_periodo()`): misma
  convención de GMV que Dashboard (2.2) y CRM (2.7) — solo Reservas
  `COMPLETADA` cuentan como ingreso real, nunca una `CONFIRMADA` todavía
  no cobrada. Gráfico de barras real (CSS, sin librería nueva) con el
  total del periodo.
- **Servicios más vendidos** (`reportes_servicios_top()`): ranking por
  veces vendido e ingresos, sobre `reserva_servicio.precio_congelado_
  unitario` (el precio real cobrado en su momento, no el precio actual
  del Servicio si cambió después).
- **Ranking de Staff con rango de fechas real**
  (`reportes_ranking_staff()`) — generaliza `dashboard_ranking_staff_
  semana()` (Módulo 2.2, que tenía la semana en curso fija) en vez de
  duplicar la fórmula de comisión por segunda vez: esa función pasa a ser
  un envoltorio delgado sobre esta misma (`select * from reportes_
  ranking_staff(...)`). Se re-verificó la suite completa de Dashboard
  (15/15) después del refactor para confirmar que no cambió ningún
  comportamiento ya probado.
- **Reseñas recibidas, responder públicamente** (QA-BIZ-089): no
  necesitó ninguna migración — `resena.respuesta_negocio` y la política
  `resena_update_respuesta_negocio` (`tiene_acceso_interno`) ya existían
  desde el Módulo 1 sin que nada las usara todavía.

### Verificado end-to-end contra la base real (10/10)
Un tercero rechazado en reportes de ingresos · ingresos del periodo
correctos (solo `COMPLETADA`) · agrupación inválida rechazada · Servicio
más vendido correcto (veces e ingresos) · ranking de Staff con rango
amplio vs. rango acotado da comisiones distintas y correctas (confirma
que el filtro de fechas funciona de verdad, no solo de nombre) ·
`dashboard_ranking_staff_semana` sigue funcionando igual tras el refactor
· un tercero no puede responder una reseña ajena (RLS en 0 filas
afectadas, verificado releyendo) · Barbería sí puede responder y la
respuesta queda guardada.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`.

---

# FASE 2 — CERRADA

Los 10 módulos (2.1 a 2.10) están construidos, verificados end-to-end
contra la base real, y documentados. Una Barbería puede operar su
negocio completo dentro de StylerNow — el criterio de cierre oficial de
la Fase, cumplido.

**Próxima fase a ejecutar: Fase 3 — SuperSU CMS.**

---

# FASE 3 — SuperSU CMS (completo, sin código, no una pantalla de aprobación)

Fuente: `02-UX/10_Super_Admin.md`. Superficie completamente separada del
Panel Negocio (`/admin`, guarda propia `requireSuperSU()` — nunca
reutiliza `resolverContexto()`, que es para los roles del lado Negocio).

- [x] **Dashboard global** (negocios activos/pendientes, MRR, citas del
      mes, ciudades activas) — ver detalle del Módulo 3.1 abajo
- [x] **Gestión de Negocios** (aprobar/rechazar/suspender/reactivar/dar de
      baja) — ver detalle del Módulo 3.1 abajo. "Cambiar plan" no se
      construyó en este módulo — hoy el Plan lo elige la propia Barbería
      en el wizard (2.1); un cambio forzado por SuperSU no tenía caso de
      uso identificado, queda en `docs/PENDING_DECISIONS.md`
- [x] **Moderación de reseñas reportadas** (Eliminar/Mantener) — ver
      detalle del Módulo 3.1 abajo. Incluye el camino de entrada que
      faltaba: reportar una reseña desde `/panel/reportes`
- [ ] Marketplace (destacados, anuncios, categorías) — depende de
      `08-Growth-Monetization/06_Advertising_System.md`, Fase 6
- [x] **Soporte** (tickets Abierto/En proceso/Resuelto, hilo de mensajes) —
      ver detalle del Módulo 3.3 abajo. Prioridades/SLA de
      `02-UX/10_Super_Admin.md` no se construyeron: la Biblia los nombra
      pero no define ningún valor concreto (qué prioridades existen, qué
      SLA en horas) — sin esa definición, construirlos sería inventar una
      regla de negocio no escrita
- [x] **Auditoría** — visor de `evento_auditoria` (ya poblada desde la
      Fase 1, nunca antes tuvo pantalla) en `/admin/auditoria`
      (completo, filtrable por actor) y en `/panel/auditoria` (Panel
      Negocio, solo Barbería, filtrable por entidad) — ver detalle del
      Módulo 3.3 abajo. Exportaciones no se construyeron: sin caso de uso
      real identificado todavía, se prioriza si un Negocio o SuperSU lo
      pide
- [x] **Configuración global** — comisión de plataforma, ciudades
      habilitadas, banners del Home, edición de Planes SaaS, textos
      legales versionados. Ver detalle del Módulo 3.2 abajo. Créditos IA,
      WhatsApp y Feature Flags no se construyeron: `credito_ia_lote`/
      `whatsapp_conversacion_lote`/`feature_flag` ya existen en el schema
      desde la migración 004 pero no tienen ningún consumidor real
      todavía (IA/WhatsApp son Fase 6) — una UI de configuración sin
      nada que configurar sería una pantalla sin efecto, contra la
      Regla de Oro. Se prioriza cuando Fase 6 les dé uso real.

## Módulo 3.1 — detalle de lo construido

Migraciones 024-025 · `src/app/admin/`, `src/lib/auth/require-supersu.ts`.

- **Hallazgo crítico, más grave que cualquier otro de esta sesión**: no
  existía NINGUNA forma de que un Negocio pasara de `PENDIENTE_
  APROBACION` a `ACTIVO`. El Panel Negocio (Módulo 2.1) ya le mostraba al
  dueño "tu negocio está en revisión", pero nadie del lado de StylerNow
  tenía cómo aprobarlo — la política RLS `negocio_update_barberia` ya
  permitía `is_supersu()` desde la migración 006, pero ninguna pantalla
  ni RPC auditado la usaba. **Todo negocio registrado en producción
  quedaría atascado para siempre sin este módulo.**
- **Transiciones de estado** siguiendo exactamente la máquina de
  `04-Data-Model/03_State_Machines.md`: `aprobar_negocio()`,
  `rechazar_negocio()` (requiere motivo), `suspender_negocio()`,
  `reactivar_negocio_supersu()`, `cancelar_negocio_supersu()` (terminal).
  Cada transición inválida (ej. aprobar un negocio ya `ACTIVO`) se
  rechaza explícitamente, no silenciosamente.
- **Suspender/cancelar reutiliza `cancelar_reserva()` tal cual** para
  cancelar en cascada las Reservas futuras confirmadas con reembolso 100%
  (QA-BIZ-102) — nunca se duplicó la lógica de reembolso ya verificada en
  el Módulo 1.
- **`admin_dashboard_resumen()`**: negocios activos/pendientes, MRR real
  (suma de `plan.precio_mensual` de suscripciones `ACTIVA`), ciudades
  activas, citas completadas del mes.
- **Moderación de reseñas**: `resena_estado` ya tenía el valor
  `REPORTADA` desde el Módulo 1, pero nada lo usaba — `reportar_resena()`
  (Barbería/Guardian, nuevo, conectado desde `/panel/reportes`) y
  `moderar_resena()` (SuperSU, Mantener/Eliminar) cierran el ciclo
  completo por primera vez.
- **Bug real encontrado por la prueba end-to-end** (no a simple vista):
  `moderar_resena()` intentaba asignar un `CASE` de texto plano a una
  columna `resena_estado` (enum) — Postgres no lo castea automático en un
  `UPDATE`. Corregido en la migración 025 (`013`→`014` fue el mismo
  patrón en la Fase 2: nunca se edita una migración ya aplicada, se
  corrige con una nueva).

### Verificado end-to-end contra la base real (18/18)
Un usuario que no es SuperSU rechazado en las 6 RPCs (aprobar, rechazar,
suspender, dashboard, reportar-ajeno, moderar) · el hallazgo crítico en
sí: un negocio pasa de `PENDIENTE_APROBACION` a `ACTIVO` · no se puede
aprobar dos veces · rechazar sin motivo rechazado · **suspender cancela
en cascada una Reserva futura confirmada con reembolso 100% real** ·
reactivar funciona · `CANCELADO` es terminal (no se puede reactivar) ·
Barbería reporta una reseña, SuperSU la modera y elimina.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`, `docs/TECH_DEBT_REGISTER.md` (impersonación
auditada, diferida), `docs/PENDING_DECISIONS.md` (cambio de Plan forzado
por SuperSU).

---

## Módulo 3.2 — detalle de lo construido

Migraciones 026-028 · `src/app/admin/configuracion/`.

- **Comisión de plataforma**: `negocio.comision_plataforma_pct` (desde la
  migración 002) era una columna por Negocio que en la práctica actuaba
  como un valor global fijo — nada la editaba nunca. Se agrega
  `configuracion_plataforma` (singleton) como fuente de verdad; al
  cambiarla, `actualizar_comision_plataforma_global()` actualiza en el
  mismo momento la columna de TODOS los Negocios, así el siguiente pago
  que se apruebe en cualquiera de ellos usa el valor nuevo de inmediato
  — sin recalcular pagos ya aprobados (`booking_engine.sql` lee el valor
  vigente del Negocio recién al aprobar el pago).
- **Bug real encontrado por la prueba end-to-end**: el `UPDATE` masivo
  sobre `negocio` fallaba con "UPDATE requires a WHERE clause" — Supabase
  exige `WHERE` explícito incluso dentro de una función `SECURITY
  DEFINER`. Corregido en la migración 028 con `where true`, sin tocar la
  026/027 ya aplicadas.
- **Ciudades habilitadas**: nueva tabla `ciudad_habilitada`, sembrada con
  todas las ciudades que ya tenían Negocios. `marketplace_buscar()` y el
  nuevo `marketplace_ciudades_disponibles()` (reemplaza el listado crudo
  de ciudades del Home) respetan la bandera de inmediato. Deshabilitar
  una ciudad **nunca** toca `negocio.estado` — es una acción de
  visibilidad de descubrimiento, distinta de `suspender_negocio()`
  (Módulo 3.1), verificado explícitamente.
- **Banners del Home**: nueva tabla `banner_home` (imagen, texto, link,
  vigencia, activo, orden) con RLS pública que solo expone banners
  activos y dentro de su ventana de vigencia — conectados de verdad en
  el Home del Marketplace (`src/app/page.tsx`), no solo en el CMS.
- **Planes SaaS**: `actualizar_plan()` edita el catálogo existente
  (precio, límites, funcionalidades) de los 4 planes ya seedeados
  (Raven/Jarl/Valhalla/Allfather). "Crear" un Plan nuevo no se construyó:
  `plan_codigo` es un enum sin quinto tramo definido en la Biblia de
  Monetización — extenderlo sin caso de uso real habría sido
  especulativo.
- **Textos legales versionados**: `publicar_texto_legal()` auto-
  incrementa la versión por tipo y nunca sobreescribe una versión ya
  aceptada por algún usuario.
- **Segundo hallazgo real, no menos grave que el de 3.1**: el mecanismo
  de re-aceptación legal **nunca existió realmente** — `registrarAceptacionLegal()`
  aceptaba en silencio la versión vigente de cada texto en CADA login,
  sin importar el flag `cambio_material` (que existía en el schema desde
  el Módulo 1 sin ningún consumidor). Esto significaba que aunque
  SuperSU publicara un cambio material, ningún usuario real lo vería
  nunca — quedaba aceptado automáticamente sin mostrarlo, incumpliendo
  el consentimiento explícito que exige Ley 1581/`06-Security/
  04_Compliance_Colombia.md`. Se corrigió: los cambios no materiales se
  siguen aceptando en silencio (sin friction innecesaria), pero un
  cambio material pendiente ahora bloquea al usuario en una pantalla
  nueva (`/legal/aceptar`) que muestra el texto completo y exige un
  checkbox explícito antes de continuar a donde iba — en su siguiente
  inicio de sesión, exactamente como exige la Biblia.

### Verificado end-to-end contra la base real (26/26)
Aislamiento contra un usuario que no es SuperSU en las 6 acciones ·
comisión global con efecto en tiempo real sobre un Negocio real ·
comisión fuera de rango rechazada · deshabilitar una ciudad oculta un
Negocio real de `marketplace_buscar`/`marketplace_ciudades_disponibles`
sin tocar su `estado` · rehabilitar lo restaura de inmediato · un banner
vencido no es visible públicamente aunque `activo=true`, uno vigente sí ·
desactivar un banner preserva su texto (`coalesce`) · editar un Plan no
toca `suscripcion` · publicar un texto legal incrementa la versión sin
borrar la anterior · un usuario sin fila en `aceptacion_legal` para la
versión nueva queda correctamente detectado como pendiente.

### Documentación actualizada con este módulo
Este archivo, `CHANGELOG.md`, ADL-016/ADL-017, `docs/TECH_DEBT_REGISTER.md`
(Créditos IA/WhatsApp/Feature Flags sin UI de configuración — diferido a
Fase 6, sin consumidor real todavía).

---

## Módulo 3.3 — detalle de lo construido

Migración 029 · `src/app/panel/soporte/`, `src/app/panel/auditoria/`,
`src/app/admin/soporte/`, `src/app/admin/auditoria/`.

- **Soporte**: nuevas tablas `ticket_soporte`/`ticket_mensaje`. Crear,
  ver y responder un ticket propio es 🔒 para cualquier rol
  (`03-Business-Rules/01_Roles.md`, matriz "Soporte") — implementado hoy
  para Barbería (Panel Negocio → Soporte) y SuperSU (`/admin/soporte`,
  cola completa con cambio de estado); Guardian/Staff/Cliente quedan con
  la misma RLS lista para cuando tengan su propia superficie (Fase 4/5).
  "Gestionar todos los tickets" es exclusivo SuperSU — todo write pasa
  por una RPC `SECURITY DEFINER` (nunca INSERT/UPDATE directo), así el
  `actor_tipo` de cada mensaje siempre se resuelve en servidor
  (`actor_tipo_soporte()`), nunca lo manda el cliente. Responder un
  ticket ya `RESUELTO` lo reabre automáticamente a `ABIERTO` — evita que
  una novedad real quede archivada en silencio.
- **Auditoría**: `evento_auditoria` existe y se puebla desde la Fase 1,
  pero nunca tuvo una pantalla — la RLS que la scopea (`auditoria_select_
  negocio` con `is_barberia_de()`, `auditoria_select_supersu`) también
  existía sin usar desde la migración 006. No se necesitó ninguna
  migración nueva para esto: solo construir el visor. Panel Negocio →
  Auditoría (exclusivo Barbería, filtrable por entidad) y `/admin/
  auditoria` (SuperSU, log completo de la plataforma, filtrable por
  actor) — el hallazgo de Fase 1 ("no existe un visor de auditoría")
  queda cerrado.

### Verificado end-to-end contra la base real (17/17)
Crear un ticket sin asunto es rechazado · el primer mensaje y las
respuestas quedan con el `actor_tipo` correcto resuelto en servidor · un
Negocio ajeno no puede ver ni responder un ticket que no creó · la propia
Barbería no puede cambiar el estado de su ticket (exclusivo SuperSU) ·
SuperSU responde y cambia el estado, quedando auditado en
`evento_auditoria` · responder un ticket `RESUELTO` lo reabre · una
Barbería lee el log de auditoría de su propio negocio · un Negocio ajeno
no ve ningún evento de un negocio que no es el suyo · SuperSU ve el log
completo.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`.

**Con este módulo, la Fase 3 — SuperSU CMS queda cerrada** en todo lo que
no depende de una fase posterior: Dashboard, Gestión de Negocios,
Moderación, Configuración global, Soporte y Auditoría están completos y
verificados. Solo queda pendiente "Marketplace (destacados/anuncios)",
explícitamente diferido a `08-Growth-Monetization/06_Advertising_System.md`
(Fase 6) por depender de un sistema de publicidad que todavía no existe.

---

**Próximo módulo a ejecutar: Fase 4 — App Staff.**

---

# FASE 4 — App Staff (aplicación propia, no una vista reducida del Panel)

Fuente: `02-UX/08_Staff_App.md`. Superficie propia en `/staff`, con su
propia guarda (`obtenerContextoStaff()`) — deliberadamente independiente
de `resolverContexto()`/Panel Negocio, para que un usuario que es Barbería
Y Staff a la vez (negocio de 1 persona) tenga ambas superficies accesibles
"indistintamente" (`01-PRD/02_Functional_Architecture.md`).

- [x] **Agenda** (día, check-in/check-out) — ver detalle abajo. Vista de
      semana no se construyó (V1: solo navegación día a día, suficiente
      para el caso de uso real de "atender lo de hoy")
- [x] **Clientes** (solo los atendidos por ese Staff)
- [x] **Ganancias** (comisiones, propinas — semana en curso) — historial
      por periodo más largo queda para cuando haya demanda real de
      filtrar por rango de fechas
- [x] **Niveles** (PRO/EXPERT/MASTER) — "Mi Nivel" con desglose en vivo
- [x] **Perfil** (datos, foto, disponibilidad, ausencias)
- [x] Guardian: mismos permisos adicionales aparecen automáticamente sobre
      la misma cuenta Staff cuando se otorga el perfil — nunca una segunda
      app o cuenta separada (`03-Business-Rules/01_Roles.md`); ya
      garantizado por reutilizar `vinculo_staff_negocio.es_guardian` sin
      ninguna lógica nueva
- [ ] Inicio (home con "hoy, próximo cliente, objetivos") no se construyó
      como pantalla separada — Agenda ya cubre "hoy" y "próximo cliente"; los
      "objetivos" de Staff son ADR-008 (diferido a Fase 6, sin IA todavía)

## Módulo 4 — detalle de lo construido

Migraciones 030-031 · `src/app/staff/`, `src/lib/auth/require-staff.ts`.

- **Hallazgo real, encontrado leyendo el schema antes de escribir código**:
  el sistema completo de Nivel PRO/EXPERT/MASTER (tabla `temporada`,
  `puntaje_staff_evento`, `nivel_staff_consolidado`, RLS, hasta una
  insignia en `/panel/staff/[id]`) llevaba desde la Fase 1 sin que se
  insertara jamás una sola fila — ninguna `temporada` existía, cero
  eventos de puntaje. El sistema estaba construido pero completamente
  inerte, igual que `punto_fidelizacion` en el Módulo 2.8 y la aprobación
  de Negocio en el Módulo 3.1.
- **Check-in / Check-out**: `EN_CURSO` existe en el enum desde la
  migración 001 y `checkin_at`/`checkout_at` en `reserva` desde la 003 —
  ninguna RPC los usaba. `iniciar_atencion_reserva()`/
  `finalizar_atencion_reserva()` (nuevas, solo el Staff dueño de la
  Reserva) los encienden. El check-out no cambia `estado`: la
  finalización real (`COMPLETADA`) sigue pasando por
  `completar_venta_pos()` en Caja — check-out solo marca que la atención
  terminó, antes del cobro.
- **Sistema de puntaje encendido, por primera vez, para 3 eventos
  directamente conectados a lo que este módulo ya construye**:
  Puntualidad (check-in con &gt;5 min de atraso, −10, dentro de
  `iniciar_atencion_reserva()`), Producción (`completar_venta_pos()`
  extendida una tercera vez para otorgar ESTANDAR +10/PREMIUM +25/
  COMPLEMENTARIO +8 por Servicio completado), Calidad (trigger nuevo
  `trg_puntos_resena_calidad` en `resena`, +15 por reseña de 5 estrellas
  — un trigger, no una RPC, para que funcione sin importar desde dónde se
  cree la reseña). "Cliente recurrente"/"Referido" (Calidad) y los bonos
  agregados "día/semana 100% puntual" quedan diferidos — requieren
  detección de recurrencia o un job de cierre periódico que no existen
  todavía (`docs/TECH_DEBT_REGISTER.md`).
- **Mi Nivel**: `staff_mi_nivel_actual()` lee en vivo de
  `puntaje_staff_evento`/`nivel_staff_consolidado` — nunca recalcula la
  fórmula en el cliente ni la duplica en una tabla nueva.
- **Mis Ganancias**: `reportes_ranking_staff()` (2.10) se extiende con un
  parámetro opcional `p_vinculo_id` para el caso de auto-servicio, en vez
  de duplicar la fórmula de comisión en una función paralela — mismo
  patrón que ya se usó para que `dashboard_ranking_staff_semana` (2.2)
  delegara en esta misma función.
- **Disponibilidad y Ausencias**: cero migraciones nuevas — `disponibilidad_
  write_propio`/`bloqueo_ausencia_write_propio` ya permitían que un Staff
  edite sus propias filas directamente desde la migración 006, sin ningún
  consumidor hasta ahora.
- **Bug real encontrado por la prueba end-to-end (migración 031)**: extender
  `reportes_ranking_staff()` con un parámetro nuevo en la migración 030
  **no reemplazó** la versión de 4 parámetros de la migración 023 —
  Postgres trata una firma distinta como una sobrecarga nueva, no un
  reemplazo. Ambas versiones coexistiendo rompían cualquier llamada
  ambigua entre ellas (incluida la de `dashboard_ranking_staff_semana`)
  con "Could not choose the best candidate function". Corregido
  eliminando explícitamente la sobrecarga vieja — lección para cualquier
  extensión futura de una función ya existente: si el nuevo parámetro no
  es el último de la lista original, o si se agregan varios a la vez,
  hay que verificar con una prueba real que la sobrecarga vieja
  desaparece, no asumir que `create or replace` la reemplaza sola.
- **Segundo bug real**: `finalizar_atencion_reserva()` (check-out) no
  cambia `estado` a propósito, pero por eso mismo un segundo check-out no
  tenía nada que lo bloqueara — pisaba `checkout_at` en silencio.
  Corregido agregando la validación de que `checkout_at` todavía sea
  nulo.

### Verificado end-to-end contra la base real (23/23)
Un Staff ajeno no puede hacer check-in/check-out de una Reserva que no es
suya · check-in con &gt;5 min de atraso penaliza Puntualidad −10 · no se
puede repetir check-in ni check-out · completar la venta en Caja sigue
funcionando igual que antes (regresión POS: saldo, propina, puntos de
fidelización) y además otorga +25 de Producción · una reseña de 5
estrellas otorga +15 de Calidad vía trigger · `staff_mi_nivel_actual()`
suma exactamente −10+25+15=30 con el desglose por categoría correcto · un
Staff no puede consultar el ranking de otro vínculo, sí el propio · la
Barbería sigue viendo el ranking completo sin el parámetro nuevo
(regresión 2.10) · las propinas se suman correctamente · un Staff
configura su propia disponibilidad/ausencia y no la de otro.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`, ADL-019,
ADL-020, `docs/TECH_DEBT_REGISTER.md` (bonos agregados de puntualidad,
cliente recurrente/referido, combo completo en Producción, vista de
semana en Agenda, Inicio como pantalla separada).

---

**Próximo módulo a ejecutar: Fase 5 — Marketplace Premium.**

---

# FASE 5 — Marketplace Premium (solo cuando existan negocios reales)

Fuente: `02-UX/04_Marketplace.md`, `08-Growth-Monetization/01_Marketplace_
Algorithm.md`.

- [x] **Mapa visual con pines** (MapLibre + OpenStreetMap) — ver detalle
      del Módulo 5.3 abajo. Con esto, la Fase 5 — Marketplace Premium
      queda completa en todo lo especificado por la Biblia
- [x] **Favoritos, compartir negocio** — ver detalle del Módulo 5.1 abajo
- [x] **Destacados, ranking** (`08-Growth-Monetization/01_Marketplace_
      Algorithm.md`) — Score de 6 componentes completo, ver detalle del
      Módulo 5.2 abajo
- [x] **SEO avanzado** — ya estaba construido desde antes de esta fase
      (`generateMetadata`, canonical, Open Graph, JSON-LD schema.org
      `HealthAndBeautyBusiness` en `/negocio/[slug]`) — se confirma acá,
      no se duplica. Recomendaciones no se construyeron: depende de un
      historial de Score/comportamiento por Cliente que no existe
      todavía — diferido a Fase 6

## Módulo 5.1 — detalle de lo construido (Favoritos + Compartir)

Migración 032 · `src/app/favoritos/`, `src/app/negocio/[slug]/actions.ts`,
`boton-favorito.tsx`, `boton-compartir.tsx`.

- **Favoritos**: nueva tabla `favorito_negocio` (par `cliente_id`/
  `negocio_id`, sin límite de cantidad como exige la Biblia). RLS
  autosuficiente (`for all using/with check (cliente_id = auth.uid())`)
  — ni una sola RPC, el propio Cliente inserta/borra su fila
  directamente, igual de simple que el patrón ya usado para
  Disponibilidad de Staff. Página `/favoritos` nueva (reutiliza
  `<NegocioCard>` del Home, cero componentes duplicados), botón de
  favorito en el perfil público del Negocio, entrada nueva en
  `<BottomNav>`.
- **Compartir**: no necesitó tabla ni RPC — el `slug` del Negocio ya es
  un link público indexado por SEO desde antes de esta fase. Web Share
  API en móvil, copiar al portapapeles como respaldo universal.

### Verificado end-to-end contra la base real (6/6)
Un usuario anónimo no puede insertar un favorito · un Cliente guarda dos
favoritos sin límite de cantidad · los favoritos persisten como filas
reales · un Cliente no puede insertar ni leer favoritos a nombre de otro
Cliente (RLS `with check` real, no solo `using`) · quitar un favorito
funciona.

### Incidente encontrado y corregido durante la verificación (no un bug de producto)
La limpieza de la prueba de este módulo (y, se descubrió al investigar,
la de varios módulos anteriores de esta sesión — POS, Comisión, Soporte,
App Staff) borraba el Negocio de prueba sin borrar antes su `wallet`
(creado automáticamente por `handle_new_negocio()`, migración 007, sin
`ON DELETE CASCADE` a propósito — un Negocio real nunca se borra
físicamente, "dar de baja" solo cambia `estado`). El `DELETE` fallaba en
silencio porque ningún script revisaba su `.error`, dejando **7 negocios
de prueba `ACTIVO` reales en la base de datos en vivo**, visibles en el
Marketplace. Se detectó al revisar manualmente el Home tras este módulo,
se limpiaron los 7 con un script de barrido, y se guardó como memoria
persistente para no repetir el error en scripts de verificación futuros
— no requirió ningún cambio de código de producto.

---

## Módulo 5.2 — detalle de lo construido (Destacados / Ranking — Score de 6 componentes)

Migraciones 033-039 · `marketplace_buscar()` reescrita, `marketplace_mi_posicion()`
(nueva), `negocio_visita_perfil` (nueva), `src/components/marketplace/filtros.tsx`
("Cerca de mí"), `negocio-card.tsx` (badge "Patrocinado"), `/negocio/[slug]/page.tsx`
(registro de visita), `/panel/reportes` (posición aproximada).

Implementa la fórmula completa de `08-Growth-Monetization/01_Marketplace_
Algorithm.md` — reemplaza el orden "RELEVANCIA" ad-hoc (solo calificación +
fecha) que existía desde la migración 013:

- **Rating_normalizado (25%)**: promedio bayesiano de reseñas de los
  últimos 12 meses, regresionado hacia el promedio de la plataforma
  (confianza=5) — un Negocio de 0 reseñas arranca exactamente en el
  promedio general, nunca en el peor extremo.
- **Proximidad_normalizada (20%)**: distancia real (haversine) a la
  ubicación del Cliente. **Nuevo en el Home**: chip "Cerca de mí" en
  `Filtros` que pide `navigator.geolocation` y pasa `p_lat`/`p_lng` — sin
  esto, este componente quedaba sin ningún disparador real en la UI. Caso
  límite de la Biblia implementado: auto-expansión de radio (10km→50km en
  incrementos de 5km) hasta encontrar ≥3 resultados.
- **Disponibilidad_normalizada (20%)**: primer slot libre dentro de 7
  días (reutiliza `slots_disponibles()`, ya verificado, sin duplicar su
  lógica), decreciente desde 48h.
- **Conversión_normalizada (15%)**: completadas ÷ visitas al perfil,
  últimos 90 días. **Hallazgo real**: nunca existió tracking de visitas —
  tabla nueva `negocio_visita_perfil` + RPC `registrar_visita_perfil()`,
  conectada en `/negocio/[slug]/page.tsx` (cada carga real de un perfil
  ahora deja rastro; verificado con un negocio real que sí quedó
  registrado).
- **Calidad_de_Staff (10%)**: proporción de Staff EXPERT/MASTER activo en
  la Sede — hoy siempre da 0 para todos (ninguna Temporada cerró jamás,
  ADL-020), un cero honesto, no fabricado.
- **Patrocinio_normalizado (10%)**: campaña `ACTIVA` con presupuesto
  disponible — hoy siempre da 0 (Ads es Fase 6), también honesto.
- **`marketplace_mi_posicion()`** (nueva): Permisos de la Biblia — "ningún
  Barbería puede ver el Score exacto de un competidor, solo su propia
  posición relativa aproximada". Devuelve un rango fijo
  (`TOP_10`/`TOP_25`/`TOP_50`/`RESTO`/`SIN_DATOS`), nunca un número —
  reutiliza `marketplace_buscar()` para no duplicar la fórmula. Nueva
  sección en `/panel/reportes`, exclusiva de Barbería (Guardian no tiene
  alcance sobre esto).
- **Badge "Patrocinado"**: `<NegocioCard>` ahora renderiza la etiqueta
  cuando `patrocinado=true` — criterio de aceptación explícito de la
  Biblia ("ningún resultado oculta la etiqueta Patrocinado").

### Bugs reales encontrados por la prueba end-to-end (5, todos corregidos hacia adelante — nunca editando una migración ya aplicada)
1. **Migración 034**: agregar `p_lat`/`p_lng` a `marketplace_buscar()`
   creó una sobrecarga en vez de reemplazar la función (mismo patrón que
   ADL-020/migración 031 en Fase 4) — rompía cualquier llamada de 6
   argumentos, incluida la del propio Home.
2. **Migración 035**: `avg(calificacion)` sin calificar con alias de
   tabla colisionaba con la columna de salida `calificacion` del propio
   `RETURNS TABLE` de la función — Postgres lo rechaza como ambiguo
   (`plpgsql.variable_conflict = error`, una protección real).
3. **Migración 036**: el mismo problema exacto con `id` dentro del
   cálculo de Calidad_de_Staff.
4. **Migración 037**: la CTE `puntuado` seleccionaba `distancia_km` dos
   veces (una vía `cd.*`, otra explícita) — columna duplicada, ambigua al
   referenciarla después.
5. **Migración 038**: `round(f.score, 3)` fallaba porque `score` se
   computaba mezclando `numeric` y `double precision` (de
   `extract(epoch from ...)`) — Postgres no tiene `round(double
   precision, integer)`, solo `round(numeric, integer)`.
6. **Migración 039, el más grave de los seis**: `marketplace_buscar()` no
   era `SECURITY DEFINER` — corría con la RLS del propio Cliente que
   llama (normalmente `anon`, sin sesión). `campana_publicitaria`,
   `vinculo_staff_negocio`/`nivel_staff_consolidado` y `reserva` nunca
   tuvieron una política de lectura pública, así que Patrocinio_
   normalizado y Calidad_de_Staff **siempre daban 0 para cualquier
   visitante real del Marketplace, sin importar los datos reales** — y la
   prueba de Conversión pasaba por pura coincidencia con el desempate por
   antigüedad, no porque el componente funcionara. Se encontró probando
   explícitamente con el cliente `anon` (no `service_role`) — exactamente
   la disciplina que exige este proyecto ("pruebas reales contra la base
   real", nunca solo `service_role`/admin).

### Verificado end-to-end contra la base real (14/14, con el cliente `anon` real)
Elegibilidad (`SUSPENDIDO`/sanción excluidos) · bayesiano (0 reseñas
queda entre un Negocio de 5★ y uno con una sola reseña de 1★, nunca en el
peor extremo) · proximidad real con geolocalización · auto-expansión de
radio hasta 50km · patrocinio (con verificación explícita de
`patrocinado=true` expuesto) · disponibilidad real (con Staff real
asignado, no un negocio vacío) · conversión real (con el desempate por
antigüedad jugando EN CONTRA del resultado esperado, para descartar falsos
positivos) · `marketplace_mi_posicion()` nunca expone un número, aislada
por negocio, accesible por SuperSU · estabilidad del desempate (misma
búsqueda, mismo orden).

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`, ADL-021,
`docs/TECH_DEBT_REGISTER.md` (bono de combo completo en Producción de
Staff Rewards ya cubierto en 2.5/2.9/4; segmentación de campaña
`ciudad`/`categoria` del Patrocinio no implementada, sin sistema de Ads
todavía; recomendaciones diferidas a Fase 6).

---

**Próximo módulo a ejecutar: Fase 5.3 — Marketplace: Mapa visual con pines (MapLibre + OpenStreetMap).**

---

## Módulo 5.3 — detalle de lo construido (Mapa visual)

Migración 040 · `src/components/marketplace/mapa-marketplace.tsx`,
`mapa-marketplace-lazy.tsx`, `src/app/page.tsx` (toggle Lista/Mapa),
paquete `maplibre-gl` (nuevo, `^6.10.0`).

- **`marketplace_buscar()` extendida** con `sede_latitud`/`sede_longitud`
  en su salida — el mapa necesita la ubicación de cada resultado, que
  antes no se devolvía. Postgres **no** permite `create or replace
  function` para cambiar el `RETURNS TABLE` de una función existente
  ("cannot change return type of existing function", un error explícito,
  a diferencia de la sobrecarga silenciosa de ADL-020/ADL-021 al agregar
  parámetros) — se corrigió con `drop function` + `create function`,
  nunca editando en sitio. Se re-verificó la suite completa del Módulo
  5.2 (14/14) tras el cambio — cero regresiones.
- **Toggle Lista/Mapa** en el Home, con el estado en la URL
  (`?vista=mapa`) — igual que el resto de `Filtros`, compartible y
  compatible con el botón atrás del navegador. Preserva todos los demás
  filtros activos al alternar.
- **`<MapaMarketplace>`**: MapLibre GL JS con tiles crudos de
  OpenStreetMap (sin proveedor de pago, ver `docs/PENDING_DECISIONS.md`
  para la nota de escala futura). Un pin por Negocio con Sede geolocalizada
  (nombre, rating, precio desde, link al perfil en el popup); si el
  Cliente activó "Cerca de mí" (Módulo 5.2), un pin distinto marca su
  propia ubicación. Estado vacío explícito si ningún resultado tiene
  ubicación cargada — nunca un mapa en blanco sin explicación.
- **Carga perezosa obligatoria**: MapLibre usa WebGL/canvas, no puede
  renderizar en el servidor. `next/dynamic` con `ssr:false` solo se
  permite dentro de un límite de Cliente — de ahí el wrapper
  `mapa-marketplace-lazy.tsx`, separado del componente real.

### Verificado
Build de producción limpio, `tsc`/`eslint` sin errores, smoke test contra
la base real (`/?vista=mapa` con un Negocio real geolocalizado responde
200 y su nombre aparece en el HTML). **Limitación explícita de esta
verificación**: no hay navegador disponible en este entorno para
confirmar visualmente que los tiles de OSM y los pines se renderizan
correctamente en el canvas WebGL — eso ocurre solo tras la hidratación en
el cliente, algo que `curl` no puede observar. Se recomienda una
verificación visual manual en un navegador real antes de considerar este
módulo validado end-to-end en la práctica.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`, `docs/
PENDING_DECISIONS.md` (proveedor de tiles a escala).

**Con este módulo, la Fase 5 — Marketplace Premium queda completa en
todo lo especificado explícitamente por la Biblia.**

---

**Próximo módulo a ejecutar: Fase 6 — Growth Engine.**

---

# FASE 6 — Growth Engine

Fuente: `08-Growth-Monetization/*`, `09-CRM-Intelligence/*`,
`AI_Credit_System.md`, `WhatsApp_Delivery_Engine.md`. Sin documento
dedicado para membresías/Gift Cards/referidos — quedan como Decisión
abierta hasta que el fundador defina su mecánica de negocio (no se
inventa una economía de puntos/descuentos sin esa definición).

- [x] **Wallet — comisión de plataforma real** (`02_Commissions.md`) —
      ver detalle del Módulo 6.1 abajo
- [x] **Marketplace Ads** (`06_Advertising_System.md`) — formatos
      Destacado y Pin patrocinado, ver detalle del Módulo 6.2 abajo.
      Banner y Promoción Flash NO se exponen todavía — decisión de
      alcance explícita, ver detalle abajo
- [x] **Suscripciones** (`04_Subscriptions_Lifecycle.md`) — ciclo de vida
      completo (upgrade/downgrade/suspensión/reactivación/cancelación), ver
      detalle del Módulo 6.3 abajo. El calendario automático de reintentos
      de `05_Billing_Failures.md` (Día 0/1/3/7/10) NO está construido —
      requiere Mercado Pago Preapproval, decisión de infraestructura de
      pagos pendiente en `docs/PENDING_DECISIONS.md`, no un recorte
      silencioso
- [ ] IA operacional (Cliente/Staff/Negocio, `09-CRM-Intelligence/*`),
      créditos IA (`AI_Credit_System.md`) — arquitectura de datos lista
      desde ADR-008 (Módulo 4). **Función 4 de `04_AI_Business.md`
      (Horarios muertos) ya construida — es Nivel 0, "sin IA" explícito
      de la propia Biblia, ver detalle del Módulo 6.4 abajo.** Las otras
      3 funciones (`02_AI_Client.md`, `03_AI_Staff.md`, Funciones 1-3 de
      `04_AI_Business.md`) siguen bloqueadas sin credenciales de un
      proveedor de LLM
- [ ] Motor WhatsApp inteligente (`WhatsApp_Delivery_Engine.md`) —
      bloqueado sin credenciales de WhatsApp Business API
- [ ] Membresías, Gift Cards, referidos — Decisión abierta, sin
      documento de reglas de negocio

## Módulo 6.1 — detalle de lo construido (Wallet: comisión de plataforma real)

Migraciones 041-042 · `src/app/panel/wallet/`, `src/lib/pagos/sincronizar.ts`,
`src/app/reserva/[id]/actions.ts`.

- **Hallazgo real, el más grave de toda la sesión hasta ahora**: `wallet`/
  `wallet_movimiento` existen desde la migración 003,
  `handle_new_negocio()` crea la fila de `wallet` de cada Negocio
  automáticamente desde la migración 007 — pero **cero filas se
  insertaron jamás en `wallet_movimiento`, y ningún `UPDATE` tocó
  `wallet.saldo_disponible` en toda la base de código**.
  `aplicar_evento_pago()` ya calculaba la comisión de plataforma y la
  guardaba en `pago.comision_plataforma_monto` (solo para auditoría),
  pero nunca acreditaba el monto neto al Wallet del Negocio — todo
  Negocio real habría cobrado señas para siempre sin que ese dinero
  llegara jamás a un saldo retirable.
- **`aplicar_evento_pago()` extendida**: al aprobar un pago, acredita
  `monto - comisión` al Wallet del Negocio con un `wallet_movimiento`
  real (tipo `COMISION`).
- **`revertir_comision_wallet()` (nueva)**: revierte proporcionalmente
  ese crédito en un reembolso total o parcial — conectada en los 3
  lugares del código (TypeScript, cliente admin) donde un `pago` pasa a
  `REEMBOLSADO`/`REEMBOLSADO_PARCIAL`.
- **`/panel/wallet` (nuevo, exclusivo Barbería)**: saldo disponible/
  retenido + historial de movimientos — la RLS que lo protege
  (`wallet_select_negocio`, `wallet_mov_select`) ya existía desde la
  migración 006, sin ninguna pantalla que la usara.
- **Segundo hallazgo, de seguridad, más grave que el primero**: la
  prueba end-to-end de este módulo detectó que `revoke all on function
  ... from public;` (usado para restringir `aplicar_evento_pago()` a
  llamadas server-to-server con `service_role`, sin ningún chequeo de
  autorización propio) **no bloqueaba en absoluto a un usuario
  `authenticated` cualquiera** — Supabase otorga privilegios de
  ejecución a `anon`/`authenticated` de forma independiente de `PUBLIC`,
  y revocar solo de `PUBLIC` no los toca. **Cualquier usuario autenticado
  de la plataforma podía llamar `aplicar_evento_pago()` directamente con
  un `p_pago_id` arbitrario y `p_estado='APROBADO'`, confirmando
  cualquier Reserva pendiente de pago sin haber pagado realmente** — un
  vector de fraude financiero real y activo en producción desde la
  migración 008 (Fase 1), no introducido por este módulo. Se corrigió
  (migración 042) revocando explícitamente de `anon, authenticated`
  además de `public`, en las 3 funciones del proyecto que dependían de
  este patrón (`aplicar_evento_pago`, `expirar_reservas_vencidas`,
  `revertir_comision_wallet`) — ninguna otra RPC del proyecto depende
  solo de este mecanismo, todas verifican autorización dentro de su
  propio cuerpo. Guardado como memoria persistente para no repetirlo.

### Verificado end-to-end contra la base real (14/14)
Aprobar un pago acredita el neto exacto (seña − comisión) al Wallet ·
reembolso total revierte el crédito completo · reembolso parcial (50%)
revierte proporcionalmente, ni de más ni de menos · reintentar el mismo
evento no duplica nada (idempotencia preexistente, sin regresión) ·
**ningún usuario autenticado puede invocar `revertir_comision_wallet()`
ni `aplicar_evento_pago()` directamente** (verificado también contra la
versión pre-fix, confirmando el hallazgo antes de corregirlo) · la
Barbería dueña lee su propio Wallet y movimientos, otra Barbería no ve
nada.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`, ADL-022
(hallazgo de seguridad, marcado como el más grave de la sesión).

---

## Módulo 6.2 — detalle de lo construido (Marketplace Ads)

Migraciones 043-047 · `src/app/panel/ads/`, extensión de `/admin/
configuracion` (tarifas + métricas agregadas), `marketplace_buscar()`
expone `campana_id`, `registrar_visita_perfil()` acepta la campaña de
origen, `NegocioCard`/Home/`negocio/[slug]` conectan clic e impresión
reales.

- **Alcance deliberadamente acotado, no un recorte silencioso**: de los 4
  formatos de `06_Advertising_System.md`, este módulo construye
  **Destacado y Pin patrocinado de punta a punta** (creación, activación
  con cobro real, pausa/reanudación/finalización, clics/impresiones
  reales, atribución, métricas). **Banner y Promoción Flash NO se
  exponen** en la UI de creación — Banner necesitaría además
  renderizarse en el carrusel del Home (hoy solo editorial, `banner_home`
  de la Fase 3.2) y Flash depende de notificaciones push, una Decisión
  Pendiente sin credencial de Firebase desde la Fase 1
  (`docs/PENDING_DECISIONS.md`) — exponer su creación sin que tuvieran
  ningún efecto real habría sido un botón muerto (Regla de Oro).
- **Cobro real en tiempo real desde el Wallet** (recién encendido en
  6.1): cada clic (CPC) o impresión (CPM) descuenta la tarifa de
  referencia (configurable por SuperSU) del Wallet del propio Negocio
  anunciante, con un `wallet_movimiento` real tipo `CAMPANA`. Nunca
  excede el `presupuesto_diario` ni el `presupuesto_total` — al
  alcanzarlos, la campaña pasa a `AGOTADA` automáticamente y el evento
  que la excedería no se cobra (invariante explícito de
  `03-Business-Rules/06_Marketplace_Ads.md`).
- **V1: `presupuesto_total` es obligatorio** (la Biblia lo describe como
  opcional) — sin él, el modelo de prepago necesitaría un job programado
  de recorte diario que no existe todavía (mismo tipo de limitación que
  el rollover de Temporada, ADL-020/Fase 4). Documentado explícitamente
  como simplificación, no un olvido.
- **Atribución real de Reservas**: `negocio_visita_perfil` (Módulo 5.2)
  se extiende con la campaña de origen del clic;
  `metricas_campana()` cuenta como atribuida toda Reserva `COMPLETADA`
  del mismo Cliente dentro de las 24 horas siguientes, calcula CTR y
  costo por Reserva atribuida — sin duplicar ninguna fórmula ya
  existente.
- **`marketplace_mi_posicion()`/Score sin cambios de fórmula**: Destacado
  y Pin usan hoy el mismo boost de `Patrocinio_normalizado` (Módulo 5.2)
  — la garantía posicional exclusiva del Pin (siempre en las primeras
  posiciones) y el límite de saturación (2 posiciones patrocinadas
  consecutivas máximo) quedan diferidos: tocan de nuevo el `ORDER BY` de
  `marketplace_buscar()`, ya corregido 5 veces en el Módulo 5.2, y
  merecen su propio módulo con foco exclusivo en ese riesgo antes de
  tocarlo una sexta vez.
- **SuperSU**: nueva sección en `/admin/configuracion` para las tarifas
  de referencia CPC/CPM y el gasto agregado de la plataforma
  (`06_Advertising_System.md`, Permisos). "SuperSU puede pausar
  cualquier campaña" ya funciona a nivel de RPC (verificado), pero sin
  un selector/listado de todas las campañas del proyecto en la UI de
  SuperSU todavía — diferido (ver `TECH_DEBT_REGISTER.md`).
- **Bugs reales de la misma familia ya documentada (ADL-020/021),
  corregidos de inmediato al escribir el código, sin necesitar una
  prueba que los expusiera primero**: agregar `campana_id` a
  `marketplace_buscar()` y un segundo parámetro a
  `registrar_visita_perfil()` exigían `drop function` + `create
  function` (migraciones 044-045) — aplicada la lección de las fases
  anteriores desde el primer intento.

### Verificado end-to-end contra la base real (22/22)
Plan Raven no puede crear campañas, Plan Jarl sí · activar sin saldo
suficiente se rechaza, con saldo se activa · un clic anónimo cobra el
CPC de referencia en tiempo real · superar el presupuesto diario agota
la campaña automáticamente SIN cobrar el evento que la excede · una
impresión CPM cobra el costo prorrateado · pausar/reanudar/finalizar
respetan la máquina de estados y los permisos (otra Barbería no puede,
SuperSU sí puede pausar cualquiera) · una campaña `FINALIZADA` nunca se
reactiva · una Reserva completada dentro de 24h de un clic/visita queda
atribuida correctamente en las métricas · otra Barbería no ve métricas
ajenas · solo SuperSU cambia las tarifas de referencia. **Se re-verificó
también la suite completa del Módulo 5.2 (14/14) y del Módulo 6.1
(14/14) tras tocar `marketplace_buscar()` y el flujo de Wallet de
nuevo — cero regresiones.**

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`, `docs/
TECH_DEBT_REGISTER.md` (Banner/Flash diferidos, garantía posicional del
Pin y saturación diferidas, selector de campañas para SuperSU, tope de
presupuesto total obligatorio).

---

## Módulo 6.3 — detalle de lo construido (Suscripciones)

Migraciones 048-049 · `src/app/panel/suscripcion/`, extensión de
`src/app/admin/actions.ts` y `src/app/admin/negocios/lista-negocios.tsx`
(mora/reactivación forzada), `vercel.json` + `src/app/api/cron/diario/`
(primer cron real del proyecto).

- **Alcance deliberadamente acotado, documentado como ADL-023, no un
  recorte silencioso**: el ciclo de vida de Suscripción se construyó
  completo y real (Upgrade inmediato con cobro único prorrateado,
  Downgrade programado con re-validación el día de ejecución,
  Suspensión/Reactivación/Cancelación con cascada real). El calendario
  automático de reintentos de cobro de `05_Billing_Failures.md` (Día
  0/1/3/7/10) queda **fuera de alcance**: requiere Mercado Pago
  Preapproval (suscripciones automáticas con tarjeta guardada) — una
  integración de pasarela distinta de Checkout Pro (lo único integrado
  hoy), no una extensión. Simularlo sin cobro real habría sido una
  automatización falsa, contra la Regla de Oro. Se construyó en su lugar
  el camino 100% manual de SuperSU (`marcar_negocio_en_mora`,
  `forzar_reactivacion_pago_externo`) que cubre el Caso límite explícito
  de la Biblia ("pagó por transferencia manual, SuperSU fuerza
  reactivación") sin depender del calendario automático — ver
  `docs/PENDING_DECISIONS.md`.
- **Upgrade real vía Checkout Pro**: `solicitar_upgrade_plan()` calcula
  el cobro prorrateado exacto (`01-PRD/03_Monetization.md`: diferencia de
  precio × días restantes del ciclo actual / 30, **sin reiniciar el
  ciclo**) y crea un `pago` real tipo `SUSCRIPCION` que se cobra vía
  Mercado Pago Checkout Pro, igual que la Seña de una Reserva. El Plan
  cambia en cuanto la pasarela confirma el pago.
- **Hallazgo real, corregido proactivamente antes de verificar**:
  `aplicar_evento_pago()` (el corazón de todo pago de la plataforma,
  compartido con Reservas) trataba "sin Reserva asociada" como "Reserva
  vencida" y reembolsaba automáticamente — sin una rama dedicada, **todo
  pago de upgrade real se habría auto-reembolsado en el instante en que
  la pasarela lo aprobara**. Se agregó una rama aislada para
  `tipo = 'SUSCRIPCION'` que actualiza el Plan directamente, sin tocar
  Wallet ni comisión (no es una transacción de Marketplace) ni Reserva
  alguna — verificado explícitamente que el Wallet del Negocio queda
  intacto tras un upgrade.
- **Downgrade programado y re-validado**: `solicitar_downgrade_plan()`
  valida los límites estructurales del Plan destino en el momento de
  pedirlo (Sedes activas vs. `limite_sedes`, Staff activo vs.
  `staff_tope_absoluto` — solo Raven tiene tope duro de Staff) y guarda
  el destino en `suscripcion.plan_codigo_destino` (columna que ya existía
  desde la migración 004, nunca usada hasta ahora). `ejecutar_downgrades_programados()`
  (pensada para el cron diario) **re-valida esos mismos límites el día de
  la ejecución** — si el exceso reapareció mientras tanto (Caso límite
  explícito de la Biblia: agenda un Staff extra justo antes del cambio de
  ciclo), el downgrade se cancela automáticamente en vez de ejecutarse a
  ciegas, y se notifica a la Barbería.
- **Suspensión/Reactivación/Cancelación — se extendieron las RPCs ya
  existentes desde la migración 024 (Módulo 3.1)**, agregando lo que
  `04_Subscriptions_Lifecycle.md` especifica y que no existía cuando se
  escribieron (no existían Wallet, Ads ni la columna
  `suscripcion.suspendido_causa`): sincronizar `suscripcion.estado`,
  pausar toda campaña publicitaria activa, cancelar la lista de espera.
  La cancelación (terminal) **finaliza** las campañas en vez de
  pausarlas, a diferencia de la suspensión (reversible). Ninguna
  campaña se reactiva sola al reactivar el Negocio — la Barbería la
  reanuda a mano, nunca gasto publicitario sorpresa.
- **Nueva: cancelación definitiva autoservicio** (`cancelar_negocio_propio`)
  — la Biblia permite que la propia Barbería dé de baja su Negocio, no
  solo SuperSU; comparte la misma cascada que la versión de SuperSU,
  sin duplicar lógica.
- **Primer cron real del proyecto**: `vercel.json` + `/api/cron/diario`,
  protegido con `CRON_SECRET` vía el mecanismo nativo de Vercel Cron (sin
  librerías adicionales). Desbloquea `expirar_reservas_vencidas()`
  (dormida desde la migración 008 — nada la invocaba jamás en producción,
  solo scripts de prueba) y la nueva `ejecutar_downgrades_programados()`.
  `CRON_SECRET` ya está configurado en las variables de entorno de Vercel
  (confirmado por el fundador) — el cron queda activo desde el próximo
  deploy.

### Verificado end-to-end contra la base real (51/51)
Upgrade calcula el monto prorrateado correcto y bloquea un segundo
upgrade concurrente, Allfather, mismo Plan y dirección inválida (Plan más
barato como "upgrade") · el pago de upgrade aprobado cambia el Plan de
inmediato **sin tocar el Wallet** (la corrección crítica de
`aplicar_evento_pago()`) · downgrade bloquea por exceso de Staff y se
programa una vez resuelto · el cron ejecuta el downgrade cuando los
límites ya están dentro de rango, y lo **cancela** (sin tocar el Plan
actual) si el exceso reapareció antes de ejecutar, con notificación real
· `ejecutar_downgrades_programados()` no es invocable por ningún usuario
autenticado (mismo patrón ADL-022) · suspensión por SuperSU pausa
campañas y cancela lista de espera automáticamente · reactivación no
reanuda campañas solas · `marcar_negocio_en_mora`/
`forzar_reactivacion_pago_externo` cubren el Caso límite de pago externo,
y correctamente rechazan forzar la reactivación de una suspensión por
infracción · cancelación autoservicio y de SuperSU finalizan campañas
(terminal) en vez de pausarlas · ninguna acción de SuperSU es invocable
por una Barbería ni sobre un Negocio ajeno. **Se re-verificó también la
suite completa de los Módulos 5.2 (14/14 → 15/15 con el nuevo caso),
6.1 (14/14) y 6.2 (22/22) tras tocar `aplicar_evento_pago()` y las RPCs de
suspensión/reactivación/cancelación de nuevo — cero regresiones.**

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`,
`docs/PENDING_DECISIONS.md` (Mercado Pago Preapproval), `docs/
TECH_DEBT_REGISTER.md` (calendario automático de reintentos, Puntos de
fidelización congelados sin canje todavía, enganchar Temporada/
Puntualidad al mismo cron), ADL-023.

## Módulo 6.4 — detalle de lo construido (IA Operacional, Función 4: Horarios muertos)

Migración 050 · extensión de `src/app/panel/reportes/` (`actions.ts`,
`page.tsx`, `vista-reportes.tsx`).

- **La única de las 4 funciones de `09-CRM-Intelligence/04_AI_Business.md`
  que la propia Biblia marca como "Nivel 0 (sin IA, gratuito, sin
  límite)... resuelto enteramente con reglas fijas, sin modelo de IA ni
  consumo de créditos"** — se construye ahora en su totalidad; las otras
  3 funciones de ese documento, más `02_AI_Client.md` y `03_AI_Staff.md`,
  requieren una credencial de proveedor de LLM que todavía no existe (ver
  `docs/PENDING_DECISIONS.md`) y quedan sin construir.
- `detectar_horarios_muertos()`: por cada franja de `disponibilidad` de
  cada Staff activo, calcula horas disponibles reales en las últimas 8
  semanas (descontando `bloqueo_ausencia`) contra horas efectivamente
  reservadas en esa misma franja, y devuelve las franjas con muestra
  suficiente (≥4h disponibles) y ocupación sistemáticamente baja (<30%).
- **Alcance recortado, no un olvido**: la Biblia describe que esta salida
  también "alimenta... una sugerencia de activar una Promoción Flash en
  esa franja específica" — Flash sigue bloqueada desde el Módulo 6.2
  (depende del motor de Push/Firebase, `docs/PENDING_DECISIONS.md`), así
  que se expone el insight puro en `/panel/reportes` sin ningún botón de
  acción que no tendría efecto real (Regla de Oro).
- **Permisos exactos de la Biblia**: exclusivo de Barbería (ve todas las
  Sedes) y Guardian (ve solo la Sede de su propio vínculo) — un Staff que
  no es Guardian recibe `NO_AUTORIZADO`, verificado explícitamente contra
  la base real, no solo inferido de la RLS de otras tablas.

### Verificado end-to-end contra la base real (7/7)
Una franja de 4h/semana sin ninguna Reserva en 8 semanas aparece con 0%
de ocupación y ~32h disponibles (4h × 8 ocurrencias) · al agregar
Reservas que cubren más del 30% de esas horas, la franja deja de
aparecer · otra Barbería no puede consultar los horarios muertos de un
negocio ajeno · un Staff que no es Guardian no puede invocar la función ·
un Guardian de la Sede sí puede, y ve la franja de su propia Sede.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`.

---

## Módulo 6.5 — detalle de lo construido (Dominio LEALTAD completo, ADR-011)

Migraciones 051-061 (schema, RLS, RPCs de los 12 sistemas, extensión de
`completar_venta_pos()`, SuperSU) · `src/lib/ia/ai-provider.ts` (OpenRouter
+ Nemotron con failover automático) · `src/app/lealtad/` (Cliente),
`src/app/panel/lealtad/` (Barbería), `src/app/admin/lealtad/` (SuperSU),
`src/app/staff/lealtad/` (App Staff) · extensión de
`src/app/panel/pos/actions.ts` (ascenso VIP automático).

- **Resuelve la Decisión Abierta de `docs/PENDING_DECISIONS.md`** que
  bloqueaba Membresías/Gift Cards/Referidos por falta de reglas de
  negocio — el fundador entregó la especificación completa vía ADR-011,
  ampliándolo a 12 sistemas que comparten un mismo motor. "Loyalty" se
  renombra a **Lealtad** en todo el producto nuevo (`03-Business-Rules/
  04_Lealtad.md`, antes `04_Loyalty.md` — los comentarios dentro de
  migraciones ya aplicadas, ej. `021_pos.sql`, no se editan
  retroactivamente).
- **Aislamiento de dinero explícito**: `lealtad_wallet` (saldo de
  recompensas por Cliente) es un dominio completamente separado de
  `wallet` (comisión de plataforma por Negocio, Módulo 6.1) y de
  `credito_ia_lote` (consumo de IA por Negocio) — nunca se fusionan,
  verificado explícitamente.
- **Módulo 1 — StylerWallet**: núcleo del dominio. Todo movimiento
  (`lealtad_movimiento`) queda auditado, nunca se borra. Helpers internos
  `_lealtad_wallet_id`/`_lealtad_acreditar` (revocados de
  `anon`/`authenticated`, mismo patrón ADL-022) crean el Wallet on-demand
  y acreditan de forma atómica.
- **Módulo 2 — Membresías**: planes configurables por Negocio (precio,
  duración 1/3/6/12 meses, límite de usos, descuento, congelación
  0/7/15/30 días). Suscripción vía cobro único real de Mercado Pago
  Checkout Pro (reusa `pago_tipo = 'MEMBRESIA'`, existente desde la
  migración 001 sin consumidor real hasta ahora). El uso del beneficio
  (Servicio incluido/descuento) se registra manualmente en el punto de
  servicio (`registrar_uso_membresia`) — deliberadamente NO integrado
  dentro de `slots_disponibles`/la creación de Reserva (el motor de
  disponibilidad crítico, ya con 2 bugs históricos corregidos) — mismo
  criterio ya aplicado a `servicio_combo` en el Módulo 2.5.
- **Módulos 3/10 — Gift Cards** (individuales y empresariales): digitales
  únicamente en V1 (física queda como arquitectura de datos lista, sin
  proveedor de impresión — ver `docs/TECH_DEBT_REGISTER.md`). PIN
  hasheado (`pgcrypto`), QR/código único. Nace `BLOQUEADA` hasta que el
  pago se aprueba (reusa `pago_tipo = 'GIFT_CARD'`, también existente
  desde la migración 001). Redención acredita el saldo completo al
  StylerWallet (simplificación V1: sin redención parcial). Lote masivo
  corporativo (`crear_lote_gift_cards_corporativo`, hasta 500 por lote).
- **Módulos 4/11 — Referidos (Cliente y Staff)**: recompensa se genera
  **solo** cuando el referido completa su primera Reserva pagada — se
  engancha directamente en `completar_venta_pos()` (4ª extensión de esa
  función, junto a Sellos/Cashback más abajo), calculando si es
  verdaderamente la primera Reserva `COMPLETADA` del Cliente ANTES de
  marcarla como tal. Nunca efectivo directo: la recompensa entra al
  StylerWallet del referente. Un Cliente solo puede activar UNA ruta
  (Cliente o Staff), nunca ambas — `unique` en `referido_cliente_id` de
  cada tabla, chequeado cruzado en las RPCs de registro.
- **Módulo 5 — Sellos digitales (**"ya no queda pendiente", pedido
  explícito**)**: construido completo. Un sello por campaña activa por
  Reserva elegible, otorgado automáticamente en `completar_venta_pos()`,
  nunca duplicado (índice único parcial por `reserva_id` + campaña —
  corregido en migración 053 tras detectar que la primera versión del
  índice era única solo por `reserva_id`, lo que habría bloqueado
  incorrectamente otorgar sello en dos campañas simultáneas). Canje
  manual al alcanzar el umbral (`canjear_sellos`).
- **Módulo 6 — Cashback**: % configurable sobre Servicios/Productos
  elegibles (vacío = todos), otorgado automáticamente en la misma
  extensión de `completar_venta_pos()`, acreditado directo al
  StylerWallet, respetando límite mensual si existe. Nunca efectivo.
- **Módulo 7 — Club VIP**: niveles renombrables por Negocio (semilla
  estándar Bronze/Silver/Gold/Black vía `sembrar_niveles_vip_default`),
  asignación manual (`asignar_vip`/`degradar_vip`, con historial) y
  ascenso automático por gasto acumulado (`evaluar_ascenso_vip_automatico`,
  enganchado desde `/panel/pos` tras cada venta — deliberadamente FUERA
  de `completar_venta_pos()` para no tocar esa función una 5ª vez sin
  necesidad estricta, con manejo best-effort que nunca rompe un cobro ya
  confirmado).
- **Módulo 8 — Paquetes familiares**: un titular agrupa miembros con
  límite configurable; un Cliente pertenece a una sola familia a la vez.
- **Módulo 9 — Suscripciones corporativas**: empresa compra cupos de
  beneficio para empleados, con vigencia y Sedes permitidas; reportes
  agregados de consumo (`reportes_corporativo`).
- **Módulo 12 — Motor de recompensas automáticas**: arquitectura Nivel
  0 (reglas fijas, 5 disparadores: Cliente inactivo, Cumpleaños, Objetivo
  logrado, Riesgo de abandono, Mejor horario — este último reusa
  `detectar_horarios_muertos()` del Módulo 6.4 sin duplicar la fórmula) +
  enganche real a IA (OpenRouter/Nemotron) para redactar sugerencias más
  elaboradas en el futuro. Toda sugerencia requiere confirmación humana
  antes de cualquier efecto de dinero — al confirmar, si la regla define
  `{"tipo":"CREDITO_WALLET","monto":N}`, se ejecuta ese único crédito
  automático soportado en V1; cualquier otra acción queda para que la
  Barbería la ejecute a mano.
- **Motor antifraude**: solo lo verificable sin infraestructura nueva —
  `CANJE_DUPLICADO` (PIN incorrecto en Gift Card) y `ABUSO_REFERIDO`
  (auto-referido). Detección de dispositivo repetido/IP sospechosa/
  múltiples cuentas queda diferida (requiere fingerprinting cliente-side +
  captura de IP en cada request, no existente en el proyecto — ver
  `docs/TECH_DEBT_REGISTER.md`). **Hallazgo real corregido antes de
  producción**: el primer intento de registrar el evento de fraude
  insertaba la fila INMEDIATAMENTE ANTES de un `raise exception` en la
  misma función — pero un `RAISE EXCEPTION` aborta TODA la transacción,
  incluyendo ese INSERT recién hecho; el evento de fraude nunca habría
  persistido. Se corrigió (migración 060) moviendo el registro a una RPC
  separada (`registrar_evento_fraude`, transacción propia) invocada desde
  la capa de servidor cuando el RPC principal devuelve el código de error
  específico — la única solución correcta sin `dblink`/`pg_background`
  (no instalados en este proyecto).
- **SuperSU** (`/admin/lealtad`): métricas agregadas de plataforma
  (saldo total en Wallets, Membresías/Gift Cards/Referidos/Cashback/VIP/
  Familias/Corporativo) y cola de revisión de eventos de fraude.
- **IA: OpenRouter + Nemotron con failover automático**
  (`src/lib/ia/ai-provider.ts`): cada llamada intenta OpenRouter primero;
  si falla (verificado forzando una key inválida), reintenta
  automáticamente con Nemotron (NVIDIA, vía tokenrouter.com). Ninguna
  clave vive en código — solo en variables de entorno. Desbloquea
  también las funciones de IA de `09-CRM-Intelligence/*` bloqueadas en
  `docs/PENDING_DECISIONS.md` (construcción pendiente, ya sin bloqueo de
  credencial). Nemotron: clave válida, modelo real confirmado
  (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` vía `/models`),
  pero la cuenta de tokenrouter.com tiene $0.00 de crédito — el respaldo
  está listo pero sin capacidad real hasta que se recargue (`docs/
  PENDING_DECISIONS.md`).
- **Hallazgo real corregido antes de producción**: `crear_gift_card()`
  fallaba con "function gen_random_bytes(integer) does not exist" —
  Supabase instala `pgcrypto` en el esquema `extensions`, no en `public`,
  y ninguna función del proyecto incluye `extensions` en su
  `search_path`. Se corrigió (migración 060) calificando el esquema
  explícito (`extensions.gen_random_bytes`/`crypt`/`gen_salt`) en vez de
  exponer todo el esquema `extensions` a cada función del proyecto.
- **Hallazgo real corregido antes de producción**: el cálculo de Cashback
  por Servicios específicos referenciaba `servicio.precio` — columna que
  no existe (`precio_base`). Se corrigió (migración 059) usando
  `reserva_servicio.precio_congelado_unitario` (el precio real cobrado en
  esa Reserva), más correcto que `precio_base` de catálogo.

### Verificado end-to-end contra la base real (51/51 + 7/7 + regresión completa)
Sellos/Cashback/Referido se otorgan automáticamente al completar una
venta en POS, sin duplicar en ventas repetidas · el referente (no el
referido) recibe la recompensa en su propio StylerWallet · Membresía se
activa solo tras el pago aprobado, sin tocar Wallet/Reserva ·  Gift Card
nace bloqueada, se activa con el pago, PIN incorrecto se rechaza y se
puede auditar en una transacción separada · redimir una Gift Card ya
canjeada se rechaza · `canjear_lealtad_wallet` nunca deja saldo negativo ·
niveles VIP estándar se siembran una sola vez · un Cliente no puede
pertenecer a dos familias · cupos corporativos se respetan · el motor de
recompensas reusa Horarios muertos sin duplicar fórmula, y el crédito
automático de una sugerencia confirmada nunca se duplica · RLS: ningún
Cliente ve el StylerWallet ni las sugerencias de otro. **Se re-verificó
también la suite completa de POS, App Staff, Wallet, Suscripciones,
Marketplace Score, Marketplace Ads y Horarios muertos tras las 4
extensiones de `completar_venta_pos()`/`aplicar_evento_pago()` — cero
regresiones en las 8 suites.**

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`,
`docs/PENDING_DECISIONS.md` (resuelve Membresías/Gift Cards/Referidos;
IA operacional ya no bloqueada por credencial; nueva entrada Nemotron sin
crédito), `docs/TECH_DEBT_REGISTER.md` (Gift Card física, detección de
dispositivo/IP, uso de Membresía no integrado a la creación de Reserva),
`ADR_011_Motor_Lealtad.md`, `03-Business-Rules/04_Lealtad.md` (renombrado
de `04_Loyalty.md`), ADL-024/025 (los dos hallazgos reales corregidos).

---

## ADR-012 — Component Registry Governance (shadcn/ui + rare-ui)

`components.json` · `src/components/ui/REGISTRY.md` (origen/versión/uso/
módulo de cada componente, tabla de retokenización) ·
`ADR_012_Component_Registry_Governance.md`.

- 8 reglas obligatorias para instalar cualquier componente de una
  librería externa sin pedir autorización previa cada vez: debe resolver
  una necesidad real de la Biblia, integrarse con el backend real, no
  romper el diseño aprobado, funcionar en dark mode (único tema del
  producto), ser accesible, ser responsive, quedar envuelto en el
  proyecto (nunca importado crudo del registry en más de un lugar), y
  documentado en `REGISTRY.md`.
- 12 componentes de shadcn/ui instalados: Skeleton, Sonner, Drawer,
  Calendar, Command Palette, Carousel, Empty States, Progress, Tooltip,
  Popover, Context Menu, OTP Input (+ Dialog como dependencia). Cada uno
  generaba tokens de color genéricos que no existen o colisionan
  semánticamente con el sistema de StylerNow (`bg-primary` de shadcn ≠
  `accent` de StylerNow) — se retokenizaron los 12 archivos con un script
  repetible (`fix-shadcn-tokens.mjs`), documentado como procedimiento
  estándar para el próximo componente que se instale.
- 5 componentes de `rare-ui`: `duration-picker`, `otp-input`,
  `emoji-reaction`, `animated-counter` (usado en Dashboard/Lealtad para
  las métricas numéricas), `fluid-orb`.
- **Skeleton real desplegado en las 9 áreas mínimas exigidas** vía
  `loading.tsx` (convención nativa de Next.js App Router — no requiere
  tocar ninguna lógica de datos existente): Dashboard, Agenda,
  Marketplace, Staff, CRM, Inventario, Reportes, Perfil, Panel SuperSU.
  El `loading.tsx` raíz (`src/app/loading.tsx`, con forma de Marketplace)
  también actúa como fallback de cualquier otra ruta sin `loading.tsx`
  propio — trade-off aceptado y documentado en vez de crear 10+ archivos
  genéricos adicionales.
- `Toaster` (Sonner) montado globalmente en `src/app/layout.tsx` — sin
  `next-themes` (no existe `ThemeProvider` en esta app, solo dark mode),
  tema fijado a `dark` y variables CSS mapeadas a los tokens propios.
- `Button` extendido de forma aditiva (`variant="outline"`,
  `size="icon"`, `buttonVariants()` exportado) para soportar las APIs que
  varios componentes de shadcn asumen — ningún call site existente se
  tocó.

### Documentación actualizada con este módulo
`CHANGELOG.md`, este archivo, `ADR_012_Component_Registry_Governance.md`,
`src/components/ui/REGISTRY.md`.

`26bebde`

---

## Lealtad — motor transversal de punta a punta (extiende el Módulo 6.5, ADR-011)

`062_lealtad_transversal_membresia_pos.sql` (5ª extensión de
`completar_venta_pos()`) · `063_lealtad_metricas_negocio.sql` ·
`src/app/panel/crm/actions.ts` + `[clienteId]/detalle-cliente.tsx` ·
`src/app/negocio/[slug]/page.tsx` · `src/app/panel/dashboard-actions.ts` +
`page.tsx`.

- El fundador pidió explícitamente que Lealtad dejara de ser un módulo
  aislado: debía poder recorrerse de punta a punta con Supabase real
  (comprar Membresía → aparece en Mi Lealtad → reserva → el sistema
  consume el beneficio automáticamente → refleja en Panel/App
  Staff/SuperSU) antes de considerar el dominio cerrado.
- **POS/Agenda**: al cobrar una Reserva, si el Cliente tiene una
  Membresía activa, cada Servicio de esa Reserva se descuenta
  automáticamente (100% si `servicio_ids` del plan está vacío o lo
  incluye; `descuento_pct` en caso contrario) — mismo criterio ya usado
  por `sello_campana`/`cashback_regla` para "vacío = aplica a todos".
- **CRM**: tarjeta de beneficios activos de cada Cliente (Membresía
  vigente, nivel VIP, progreso de cada campaña de Sellos, cashback
  pendiente) — todo con alcance de Negocio, no global.
- **Marketplace**: insignia "Sos {nivel} acá" visible en la página
  pública del Negocio si el Cliente visitante tiene nivel VIP asignado
  ahí.
- **Dashboard**: 3 métricas de Lealtad (Membresías activas, saldo total
  en Wallets de Lealtad, cashback otorgado) con `AnimatedCounter`.
- **Verificado end-to-end contra Supabase real (6/6)**: el descuento de
  Membresía es exacto según el plan configurado, `membresia_uso` y
  `usos_mes_actual` se actualizan automáticamente, un Cliente sin
  Membresía no recibe ningún descuento. Re-verificación completa de las
  8 suites de regresión existentes — cero regresiones.

### Documentación actualizada con este módulo
`CHANGELOG.md`, este archivo.

`8be079c`

---

## Módulo 6.6 — detalle de lo construido (AI OS: Monetización y Motor de Costos de IA, ADR-013)

Migraciones `064_ai_os_schema.sql` a `068_ai_os_memory_prompts_pago.sql` ·
`src/lib/ia/ai-provider.ts` (reescrito: Cost Optimizer real leyendo
`ai_modelo_config`) · `src/app/admin/ai/` (SuperSU AI Center) ·
`src/app/panel/ia/` (AI Workspace de Barbería) · extensión de
`src/app/panel/lealtad/actions.ts` (Motor de recompensas conectado a IA
real) · `src/app/api/cron/diario/route.ts` (3ª tarea: otorgamiento
mensual de créditos).

- **Principio oficial del ADR-013, aplicado en cada decisión**:
  "StylerNow nunca subsidia IA" — toda llamada con costo se financia con
  créditos del propio Negocio. Los créditos únicamente limitan **cuánto**
  puede usarse una función; **qué** funciones existen lo decide el Plan
  contratado (`plan_funcion_ia`), nunca un add-on que desbloquea función
  nueva.
- **AI Pricing Engine** (`ai_accion_costo`): 13 acciones seedeadas con la
  matriz oficial del ADR (costo en créditos, categoría, nivel de IA),
  100% editable por SuperSU vía `actualizar_accion_costo_ia()` — nada
  hardcodeado en TypeScript.
- **Cost Optimizer** (`ai_modelo_config`): orden de preferencia real
  (`orden_preferencia`), leído por `ai-provider.ts` en cada llamada.
  Ollama y Gemini quedan seedeados con `activo=false` (sin servidor
  local ni API key todavía — ver `docs/PENDING_DECISIONS.md`);
  OpenRouter y Nemotron activos y con failover automático verificado
  (heredado de ADR-011).
- **Credit Meter** (`consumir_creditos_ia`): valida primero que la
  función esté habilitada para el Plan del Negocio (`FUNCION_NO_INCLUIDA_EN_PLAN`),
  después que el saldo alcance (`CREDITOS_INSUFICIENTES`), consume FIFO
  por `fecha_otorgamiento` entre los lotes vigentes de `credito_ia_lote`
  — tabla que existe desde la migración 004 sin ningún consumidor real
  hasta ahora, mismo patrón "arquitectura lista, nunca conectada"
  encontrado varias veces en este proyecto. Nunca deja el saldo negativo
  (verificado). `otorgar_creditos_plan_mensual()` (revocada de
  `authenticated`, solo cron/`service_role`) y
  `comprar_paquete_creditos_ia()` (6ª rama de `aplicar_evento_pago()`,
  mismo patrón de cobro único que Suscripción/Membresía) son las dos
  únicas formas de acreditar créditos.
- **AI Memory** (`ai_memoria_negocio`): versionada de verdad — cada
  `guardar_memoria_ia()` marca la versión anterior `vigente=false` e
  inserta una fila nueva, nunca sobreescribe. `aprobar_memoria_ia()`,
  `olvidar_memoria_ia()` (único `DELETE` real de todo el proyecto fuera
  del patrón habitual de nunca borrar — mandato explícito del ADR-013:
  "el propietario podrá... olvidar información", auditado igual vía
  `payload_antes`) y `restaurar_version_memoria_ia()` (restaura creando
  una versión nueva, nunca revive la fila vieja).
- **Prompt Builder/Library** (`ai_prompt`): arquitectura completa
  (OFICIAL/PROPIO/COMPARTIDO/MARKETPLACE_FUTURO) sin Marketplace todavía,
  tal como pide el ADR. UI actual es un editor de texto simple, no un
  constructor visual de variables — ver `docs/TECH_DEBT_REGISTER.md`.
- **AI Cost Simulator** (`simular_consumo_ia`): reusa el mismo AI Pricing
  Engine, responde preguntas reales de "qué pasaría si" (Plan, Staff,
  Clientes) con una heurística de consumo documentada explícitamente
  (todavía no hay histórico real de consumo por Staff/Cliente para
  calibrar contra él).
- **Motor de recompensas de Lealtad conectado a IA real por primera
  vez**: `generarSugerenciasAction()` ahora redacta con el LLM real
  (`redactarSugerenciaConIA`) cuando la regla es Nivel 1/2 — consume
  créditos ANTES de llamar al proveedor (el costo se incurre aunque el
  parseo de la respuesta falle, consistente con "nunca subsidia"), lee
  `ai_memoria_negocio` (categoría TONO) como contexto de la Barbería, y
  cae de vuelta a la plantilla fija si faltan créditos, la función no
  está en el Plan, o el proveedor de IA falla. Resuelve la deuda técnica
  registrada en el Módulo 6.5 ("sugerencias de plantilla fija, falta
  conectar el LLM real").
- **SuperSU AI Center** (`/admin/ai`): resumen de consumo global (créditos
  consumidos, Negocios usando IA, costo estimado de proveedor por
  categoría), edición del AI Pricing Engine, del Cost Optimizer, de los
  paquetes de recarga, matriz de funciones por Plan, y el AI Cost
  Simulator.
- **AI Workspace de Barbería** (`/panel/ia`): saldo de créditos, compra de
  paquetes (Mercado Pago Checkout Pro, mismo patrón que Upgrade de Plan),
  Memoria de IA editable/aprobable/con historial/restaurable, Biblioteca
  de prompts (crear PROPIO/COMPARTIDO, ver OFICIAL), historial de consumo
  exportable a CSV, y **ROI de IA con métricas honestas**: créditos
  consumidos, costo estimado y consumo por categoría son reales; las
  métricas de resultado (clientes recuperados, reservas y ventas
  atribuidas a IA, tiempo ahorrado) se muestran explícitamente como "no
  medible todavía" en vez de inventar un número — no existe ningún
  mecanismo de trazabilidad de atribución en el proyecto (ver
  `docs/TECH_DEBT_REGISTER.md`). Exportación PDF/Excel queda diferida
  (solo CSV implementado); ver `docs/PENDING_DECISIONS.md`.
- **Hallazgo real corregido durante la construcción**: `ai_paquete_creditos.creditos`
  tenía un `check (creditos > 0)` que rechazaba el sentinela `null` del
  paquete "Enterprise" (cotización manual) — como la migración que creó
  esa restricción ya estaba aplicada, se corrigió con una migración
  nueva (`065_fix_paquete_creditos_enterprise.sql`) en vez de editar la
  aplicada, confirmando una vez más (like ya documentado en sesiones
  anteriores) que `supabase db push` envuelve cada archivo de migración
  en una única transacción todo-o-nada.
- **Hallazgo documentado (no bug)**: un parámetro `numeric` de una RPC
  sin `default` se genera como no-nullable en TypeScript aunque la base
  sí acepte `NULL` — ver ADL-026.

### Verificado end-to-end contra la base real (41/41 + regresión completa)
Saldo inicial en 0 · gating por Plan (`FUNCION_NO_INCLUIDA_EN_PLAN`) ·
rechazo por saldo insuficiente sin tocar el saldo · consumo FIFO real
entre lotes por `fecha_otorgamiento` · el saldo nunca queda negativo · un
Negocio no puede consumir créditos de otro · `otorgar_creditos_plan_mensual()`
bloqueada para `authenticated`, idempotente en una segunda corrida del
cron el mismo mes · compra de paquete + `aplicar_evento_pago()` acredita
el lote exacto, un segundo `aplicar_evento_pago()` sobre el mismo pago no
duplica (`YA_PROCESADO`) · Memoria: versionado, aprobación, olvido
(`DELETE` real auditado), restauración crean versión nueva, RLS aísla la
Memoria/Prompts de un Negocio ajeno · Prompt Library: tipos permitidos
por rol, RLS · AI Pricing Engine y Cost Simulator solo editables/usables
por SuperSU. Re-verificación completa de las 8 suites de regresión
existentes tras la 6ª extensión de `aplicar_evento_pago()` — cero
regresiones. `tsc --noEmit`, `eslint` y `next build` limpios.

### Documentación actualizada con este módulo
Este archivo (Coverage Matrix + detalle), `CHANGELOG.md`,
`ADR_013_AI_OS_Monetizacion.md`, `docs/PENDING_DECISIONS.md` (Gemini/
Ollama, prioridad del checkout de Membresía/Gift Card, export PDF/Excel),
`docs/TECH_DEBT_REGISTER.md` (Gemini/Ollama sin credencial, ROI
especulativo no medible, Prompt Builder sin constructor visual, checkout
de Membresía/Gift Card faltante), `Architecture_Decision_Log.md`
(ADL-026).

### Riesgos detectados
- **Hallazgo honesto sobre el Módulo 6.5 (Lealtad), encontrado durante
  este trabajo**: ni `suscribirse_membresia()` ni la compra de Gift Card
  tienen todavía una pantalla de Cliente que las invoque — ambas RPCs
  existen y están verificadas, pero el "recorrido completo" de comprar
  una Membresía/Gift Card con dinero real todavía no tiene un punto de
  entrada en el frontend de Cliente (la verificación transversal de
  Lealtad probó el consumo del beneficio insertando `cliente_membresia`
  directamente como `service_role`, no a través de una compra real). El
  paquete de créditos de IA sí quedó con su checkout completo (mismo
  patrón que Upgrade de Plan) porque era parte explícita del alcance de
  este módulo. Ver `docs/TECH_DEBT_REGISTER.md` y
  `docs/PENDING_DECISIONS.md`.
- No se construyeron pantallas dedicadas para cada función de IA
  orientada a Cliente/Staff con nombre propio (Concierge conversacional,
  búsqueda en lenguaje natural, Coach de Staff, voz a texto, Analista de
  Negocio) — el AI OS (P0) es la capa compartida que todas esas
  funciones necesitarán, y se probó de punta a punta a través del único
  consumidor real que ya existía (el Motor de recompensas de Lealtad).
  Construir cada superficie con nombre propio es la Fase 6 que sigue.

`b450aa6`

---

## Refactor transversal — `completar_venta_pos()` pasa a ser un Pipeline de Eventos

Migraciones `070_venta_pipeline_schema.sql`, `071_venta_pipeline_handlers.sql`,
`072_completar_venta_pos_pipeline.sql` · `src/app/panel/pos/actions.ts`
(elimina la 2ª llamada RPC de ascenso VIP, ahora un handler más).

- Pedido directo del fundador tras la 5ª extensión de esta función
  (Módulo 6.5, Lealtad): "evitar que se vuelva inmanejable a medida que
  StylerNow siga creciendo". Diagrama de referencia del fundador: `Venta
  confirmada → Pipeline → Pago, Membresía, Sellos, Cashback, Wallet, VIP,
  Inventario, Comisiones Staff, Reportes, IA, Auditoría`.
- **Fase crítica (sigue inline, sin cambios de comportamiento)**: Pago,
  Membresía y canje de Puntos determinan el MONTO cobrado — un fallo ahí
  debe abortar toda la venta, así que deliberadamente NO se convierten en
  handlers aislables. Inventario de la venta (productos vendidos +
  consumo automático) también sigue inline por la misma razón: afecta el
  total a cobrar antes de calcularlo.
- **Wallet no es un handler de este pipeline**, a propósito: la comisión
  de plataforma se acredita en `aplicar_evento_pago()`, un evento
  distinto (pago vía pasarela de una Reserva, no cierre de venta
  presencial en POS) — fusionarlos habría sido un error conceptual, no
  una simplificación.
- **Reportes e IA no tienen todavía handler**, a propósito: ninguno tiene
  hoy un consumidor real por-venta (Reportes ya lee las tablas vivas
  directamente; el Reward Engine de IA se dispara desde `/panel/lealtad`,
  no por venta) — agregar un handler vacío habría sido un "botón muerto"
  (Regla de Oro). El registro `venta_pipeline_handler` es exactamente el
  punto de extensión para cuando exista un consumidor real: una función
  nueva + una fila, sin tocar `completar_venta_pos()` nunca más.
- **7 handlers reales extraídos**, cada uno una función independiente
  registrada en `venta_pipeline_handler` (editable/deshabilitable por
  SuperSU sin deploy, mismo patrón que `ai_modelo_config`): Puntos de
  fidelización, Puntaje de Staff, Sellos, Cashback, Referidos de Cliente,
  Referidos de Staff, ascenso VIP automático (migrado desde una 2ª
  llamada RPC en `src/app/panel/pos/actions.ts` — cierra una ventana real
  de inconsistencia por fallo de red entre las dos llamadas), más la
  Auditoría resumen de la venta como último handler.
- **Aislamiento de fallos real**: el orquestador (`ejecutar_pipeline_venta_completada()`)
  ejecuta cada handler dentro de un `begin...exception when others...end`
  — un savepoint implícito de PL/pgSQL — así que un handler roto nunca
  deshace el cobro ya confirmado ni bloquea a los demás handlers. Ver
  ADL-027 para el detalle técnico y la distinción con ADL-024.

### Verificado end-to-end contra la base real (20/20 + regresión completa)
`completar_venta_pos()` devuelve exactamente la misma forma de resultado
que antes del refactor (más un array `pipeline` nuevo, aditivo) · el
ascenso VIP ocurre en la MISMA transacción sin la 2ª llamada externa · el
Puntaje de Staff se otorga igual que antes · **con un handler roto
insertado deliberadamente en el registro** (apuntando a una función SQL
inexistente): la venta se cobra igual, la Reserva queda `COMPLETADA`, el
Pago se registra igual, el resto de los handlers (antes y después del
roto en el orden) corre normalmente, y queda un `evento_auditoria`
`PIPELINE_HANDLER_FALLO` con el detalle del error · RLS: solo SuperSU lee
el registro de handlers. Re-verificación completa de las 9 suites de
regresión existentes tras el refactor — cero regresiones, mismo
comportamiento observable.

### Documentación actualizada con este refactor
Este archivo, `CHANGELOG.md`, `Architecture_Decision_Log.md` (ADL-027).

`fd8177b`

---

## ADR-014, Fase A — Checkout completo de Membresías (cierra el Módulo 6.5)

`src/app/negocio/[slug]/membresias/` (lista + detalle), `src/app/checkout/membresia/[planId]/`
(checkout real), `src/app/membresias/` (Mis Membresías, detalle,
historial), secciones nuevas en `src/app/lealtad/vista-lealtad.tsx` y
`src/app/negocio/[slug]/page.tsx`.

- Todo el backend ya existía y estaba verificado desde el Módulo 6.5 —
  esta fase es 100% frontend, reusando `suscribirse_membresia()`,
  `cancelar_membresia()`, `congelar_membresia()`,
  `reactivar_membresia_congelada()` y el patrón de checkout ya probado 3
  veces (`iniciarUpgrade`/`comprarPaqueteIa`).
- Recorrido completo real: el Cliente navega los planes de un Negocio,
  ve el detalle de beneficios, paga con Mercado Pago Checkout Pro, la
  Membresía se activa automáticamente al aprobarse el pago
  (`aplicar_evento_pago()`, rama MEMBRESIA, ya existente), y aparece
  tanto en `/membresias` como en la sección "Mis Membresías" del hub de
  Lealtad.
- El link "Ver Membresías" en la página pública del Negocio solo se
  muestra si existe al menos un plan activo — nunca un link muerto
  hacia una lista vacía (Regla de Oro).

### Verificado end-to-end contra la base real (15/15 + regresión completa)
Las queries EXACTAS con joins (`plan:plan_id(...)`, `negocio:negocio_id(...)`)
usadas por cada pantalla nueva se probaron contra Supabase real, no solo
compiladas — un alias mal escrito pasa `tsc` pero devuelve `null` en
producción. Compra real (`suscribirse_membresia` + `aplicar_evento_pago`),
RLS (un Cliente ajeno no ve la Membresía de otro), congelar/reactivar con
las reglas del plan. Re-verificación completa de las 9 suites de
regresión existentes — cero regresiones.

### Documentación actualizada con esta fase
Este archivo, `CHANGELOG.md`.

`ff1185c`

---

## ADR-014, Fase B — Checkout completo de Gift Cards + endurecimiento de seguridad

Migraciones `073_gift_card_checkout_y_seguridad_pos.sql` a
`076_fix_crear_gift_card_overload_ambiguo.sql` · `src/app/gift-cards/`
(hub, comprar, mis, canjear) · `src/app/panel/pos/actions.ts` +
`lista-pos.tsx` (canje desde Caja) · `src/app/lealtad/vista-lealtad.tsx`
(sección Gift Card reescrita).

- **Decisión de seguridad deliberada** (pedida explícitamente por el
  fundador: "canje únicamente desde POS"): el autoservicio remoto
  (`redimir_gift_card()`, el Cliente convertía su propia Gift Card a
  StylerWallet desde cualquier lugar) queda cerrado. El único canje real
  ahora es `redimir_gift_card_pos()` — exclusivo de Staff/Barbería del
  Negocio de la Gift Card, acredita el StylerWallet del Cliente
  PRESENTE (no de quien procesa el canje) — expuesto como una acción
  independiente en el Panel de Caja, no atada a una venta puntual.
  `consultar_gift_card()` (nueva, solo lectura, PIN-protegida) reemplaza
  al autoservicio para que el Cliente pueda verificar su código/saldo
  antes de ir al Negocio, sin mover un solo peso.
- Compra completa: elegir Negocio (búsqueda en vivo reusando
  `marketplace_buscar()`, sin RPC nueva), monto libre o rápido, para uno
  mismo o para otra persona (nombre/email/mensaje — 2 columnas nuevas en
  `gift_card`), PIN elegido por el comprador, checkout real vía Mercado
  Pago. RLS ampliada: el destinatario también ve la Gift Card que le
  regalaron, verificado contra su propio email en el JWT (nunca un
  email arbitrario).
- **Dos hallazgos de seguridad reales, encontrados por la propia suite
  de verificación de esta fase (no antes de escribirla)**:
  1. `revoke execute on function ... from authenticated` NO cerraba el
     autoservicio — Postgres otorga `EXECUTE` a `PUBLIC` por defecto en
     toda función nueva, y ese acceso implícito seguía abierto. Un
     Cliente real todavía podía canjear a distancia después de aplicada
     la migración que se suponía lo cerraba. Corregido revocando
     también de `public` — ver ADL-028 (espejo exacto de ADL-022).
  2. `create or replace function` extendiendo `crear_gift_card()` de 6 a
     8 parámetros creó un OVERLOAD nuevo en vez de reemplazar la
     función — ambas firmas coexistieron, y una llamada real con pocos
     argumentos se volvió ambigua para PostgREST
     ("Could not choose the best candidate function"). Corregido con un
     `drop function` explícito de la firma vieja — ver ADL-029.
- **Hallazgo repetido, no nuevo**: la migración 073 también reintrodujo
  el bug de ADL-025 (`gen_random_bytes`/`crypt` sin calificar el esquema
  `extensions`) al copiar el cuerpo de `crear_gift_card()` — corregido
  en la migración 074.

### Verificado end-to-end contra la base real (21/21 + regresión completa)
Compra con mensaje/destinatario, activación automática, RLS (comprador,
destinatario por email-JWT, tercero sin acceso), `consultar_gift_card()`
nunca mueve saldo, **el autoservicio remoto queda genuinamente cerrado**
(`permission denied`, no solo un mensaje de negocio), un Cliente no puede
usar la RPC de POS para sí mismo, Staff SÍ puede canjear a nombre del
Cliente presente y el saldo llega a la wallet correcta (no a la del
Staff), doble canje rechazado, Staff de un Negocio distinto no puede
canjear una Gift Card ajena, auditoría completa. Re-verificación completa
de las 9 suites de regresión existentes tras las migraciones — cero
regresiones. `tsc`/`eslint`/`next build` limpios.

### Documentación actualizada con esta fase
Este archivo, `CHANGELOG.md`, `Architecture_Decision_Log.md` (ADL-028,
ADL-029), `docs/TECH_DEBT_REGISTER.md` (gasto de StylerWallet en POS
todavía no conectado — decisión deliberada, no un olvido), memoria
persistente de sesión (dos hallazgos de REVOKE/overload documentados
para no repetirse en proyectos futuros).

### Riesgos detectados
- El StylerWallet (Gift Cards/Referidos/Cashback/VIP) sigue sin poder
  gastarse como método de pago DENTRO de una venta de POS — solo se
  puede acreditar (vía canje de Gift Card) y consultar. Conectarlo
  requiere un diseño de autorización nuevo (el Wallet no tiene alcance
  de Negocio) — ver `docs/TECH_DEBT_REGISTER.md`.

`ff1185c`

---

## ADR-014, Fase E+G — Regla definitiva de Recomendación IA + rol de Ollama

Documentación pura, sin cambio de código — ver `AI_Credit_System.md`,
`09-CRM-Intelligence/02_AI_Client.md`, `ADR_013_AI_OS_Monetizacion.md`,
`docs/PENDING_DECISIONS.md`, ADL-030, y el comentario actualizado en
`src/lib/ia/ai-provider.ts`.

- **Fase E**: "Recomendación Marketplace" (el widget del Home,
  `02_AI_Client.md`) es gratuita, algoritmo de plataforma, nunca consume
  créditos de ningún Negocio. "Recomendación IA del Negocio" (la acción
  `recomendacion` de `ai_accion_costo`) es la sugerencia personalizada
  del Motor de recompensas de Lealtad — consume créditos como cualquier
  otra función Negocio-facing. Eran dos funciones distintas desde el
  principio; el código ya estaba correcto, solo faltaba la aclaración.
- **Fase G**: Ollama nunca es una dependencia de producción — su rol
  queda fijado como exclusivamente de desarrollo interno (documentación,
  pruebas, clasificación). `ai_modelo_config` ya lo reflejaba sin cambio
  de código (`OLLAMA_BASE_URL` ausente por diseño en producción).

`3d4e930`

---

## ADR-014, Fase F (obligatoria) — Pipeline de Eventos como bus oficial de StylerNow

Migraciones `077_pipeline_eventos_global.sql`,
`078_completar_venta_pos_usa_pipeline_global.sql`.

- `venta_pipeline_handler`/`ejecutar_pipeline_venta_completada()`
  (ADL-027) se generalizan a `evento_pipeline_handler` (columna `evento`
  nueva, catálogo cerrado por `check`, sin tabla de referencia separada)
  y `ejecutar_pipeline_evento(p_evento_tipo, p_payload)` — mismo
  aislamiento de fallos real (savepoint implícito de PL/pgSQL) que ya
  probó ADL-027, ahora reutilizable para cualquier evento.
- `completar_venta_pos()` llama al bus genérico en vez de un nombre
  específico de venta — no vuelve a tocarse para agregar un handler
  nuevo de venta jamás.
- Catálogo oficial de eventos reconocidos: `venta_completada` (7
  handlers reales, heredados de ADL-027), `reserva_confirmada`,
  `cliente_registrado`, `plan_actualizado`, `staff_trasladado`. Los
  últimos 4 se reconocen en el `check` constraint (listos para un
  handler real el día que exista un consumidor) pero **deliberadamente
  sin ningún handler fabricado hoy** — ver ADL-031 para el porqué
  específico de cada uno (incluye un caso donde fabricar un handler
  habría contradicho una regla de negocio ya aprobada en
  `AI_Credit_System.md`).

### Verificado end-to-end contra la base real (22/22 + regresión completa)
Todo lo ya verificado en ADL-027 sigue igual (mismo resultado
observable, aislamiento de fallos real) + dos casos nuevos: un handler
registrado para `reserva_confirmada` NUNCA se ejecuta durante un evento
`venta_completada` (aislamiento real por tipo de evento, no solo por
handler individual) y el catálogo cerrado rechaza un nombre de evento
inventado. Re-verificación completa de las 9 suites de regresión
existentes — cero regresiones, mismo comportamiento observable de POS.

### Documentación actualizada con esta fase
Este archivo, `CHANGELOG.md`, `Architecture_Decision_Log.md` (ADL-031).

`ba3e1de`

---

**Próximo módulo a ejecutar: ADR-014, Fase C — Tracking real del ROI de
IA (`ai_interaction`/`ai_conversion`/`ai_roi_snapshot`) y Fase D
(exportación PDF/Excel) — únicas fases de ADR-014 sin cerrar. Motor
WhatsApp sigue bloqueado sin credenciales de WhatsApp Business API (ver
`docs/PENDING_DECISIONS.md`).**

---

# Planes oficiales (a implementar cuando llegue Fase 2.1 / Configuración)

| Plan | Sedes | Staff | Guardian | Créditos IA |
|---|---|---|---|---|
| Raven | 1 | 1 (+1 máx.) | No | 100 |
| Jarl | 1 | 5 | Sí | 600 |
| Valhalla | hasta 5 | 10 (+adicional configurable) | por sede | 2.500 |
| Allfather | personalizado | — | — | — |

Lógica de upgrade/downgrade se implementa desde el Módulo 2.1 (elección de
plan en el wizard), no se pospone a Configuración.

---

# Listo-para-lanzamiento (transversal, independiente de fase)

- [ ] `security-review` (skill del repo) sobre el estado final antes de lanzar
- [ ] `production-readiness` (skill del repo)
- [x] Textos legales reales (Términos, Política de Datos) — cerrado en Fase 1
- [x] Error Boundary global — cerrado en Fase 1
- [ ] Credenciales de Mercado Pago de **producción** (hoy son `TEST-`)
- [ ] Firebase (push) y proveedor de analytics — ver "Pendiente" de Fase 1

---

## Reporte de esta sesión

### Módulo cerrado
Fase 1 — Plataforma Compartida (Service Worker/PWA, Error Boundaries,
Consentimiento legal versionado). Los 3 ítems restantes de Fase 1 quedan
bloqueados por credencial/decisión, documentados arriba.

### Archivos creados
- `public/sw.js`
- `src/components/pwa/pwa-manager.tsx`
- `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`
- `src/app/legal/[slug]/page.tsx`
- `src/lib/auth/aceptacion-legal.ts`
- `supabase/migrations/010_seed_textos_legales.sql`

### Archivos modificados
- `src/app/layout.tsx` (monta `PwaManager`)
- `src/app/login/actions.ts` (`enviarCodigo` exige `aceptaTerminos`
  server-side; registra aceptación legal en `verificarCodigo`)
- `src/app/login/formulario.tsx` (pasa `aceptaTerminos`, agrega link a
  Términos, usa `Link` en vez de `<a>`)
- `src/app/auth/callback/route.ts` (registra aceptación legal también en
  el camino de magic link)

### Migraciones creadas
- `010_seed_textos_legales.sql` — Política de Tratamiento de Datos y
  Términos v1, aplicada en producción

### Componentes reutilizables creados
- `PwaManager` (banner de instalación + registro de SW)
- `registrarAceptacionLegal()` (compartido entre login por código y magic
  link, evita duplicar la lógica de upsert)

### RLS implementado
Ninguna política nueva — se reutilizó `aceptacion_legal_propia` (ya
existía desde la migración 006) y `texto_legal_select_publico` (lectura
pública, ya existía). Verificado que un usuario no puede leer ni escribir
la aceptación legal de otro.

### Casos límite cubiertos
- localStorage/sessionStorage bloqueado (navegación privada) no rompe el
  flujo de instalación PWA, solo omite el prompt
- Registro del Service Worker falla silenciosamente sin afectar el resto
  de la app
- Segundo login no duplica la fila de `aceptacion_legal` (upsert
  idempotente, verificado)
- `global-error.tsx` no depende de Tailwind ni de componentes propios,
  para sobrevivir si el problema está justamente ahí

### Pruebas realizadas
Script E2E contra la base real (creado y limpiado en la misma corrida):
existencia de los 2 textos legales, upsert de aceptación bajo RLS de un
usuario autenticado, no-duplicación en un segundo login, y aislamiento
RLS (un usuario no ve la aceptación de otro). 5/5 verificaciones OK.
`tsc --noEmit`, `eslint --max-warnings=0` y `next build` limpios.

### Documentación actualizada
Este archivo (`00_MASTER_TASKLIST.md`) — reestructurado a las 6 fases de
la orden oficial de ejecución, con la decisión de Mercado Pago vs Wompi
registrada explícitamente.

### Riesgos detectados
- El texto legal sembrado es un punto de partida razonable, **no una
  revisión de un abogado** — recomendado hacerlo revisar antes de un
  lanzamiento real con usuarios en producción.
- `manifest.json`/`sw.js` no fueron probados en un dispositivo iOS físico
  todavía (solo revisados por código) — el comportamiento de instalación
  en iOS puede variar entre versiones de Safari.

### Propuestas pendientes de aprobación
1. Crear proyecto Firebase para Push Notifications (necesito que lo
   crees vos y me pases API key + VAPID key + service account, o me
   autorices a guiarte paso a paso como hicimos con Resend/Mercado Pago).
2. Instalar Vercel Analytics + Speed Insights (gratis en el plan actual,
   sin credencial nueva) — confirmame y lo agrego.
3. Confirmar que seguimos con **Mercado Pago** (no Wompi) antes de tocar
   cualquier cosa relacionada a pagos en fases futuras.

**Siguiente módulo, arrancando ahora sin esperar respuesta: Fase 2 →
Módulo 2.1 — Registro de Barbería.**
