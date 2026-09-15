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
| 2.5 Servicios | ⬜ | ⬜ | ⬜ | ⬜ | Siguiente |
| 2.6 Agenda | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| 2.7 CRM | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| 2.8 POS | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| 2.9 Inventario | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| 2.10 Reportes | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| Fase 3 — SuperSU CMS | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| Fase 4 — App Staff | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| Fase 5 — Marketplace Premium | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
| Fase 6 — Growth Engine | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente (ADR-008 deja el diseño de Objetivos de Staff listo) |

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
- [ ] 2.5 Servicios (CRUD, categorías, combos, asignación a Staff)
- [ ] 2.6 Agenda (día/semana/Staff, drag & drop, bloqueos, conflictos)
- [ ] 2.7 CRM (historial, notas, etiquetas, LTV, riesgo de abandono)
- [ ] 2.8 POS (venta rápida, productos, propinas, saldo pendiente, recibos)
- [ ] 2.9 Inventario (entradas/salidas, consumo automático, alertas)
- [ ] 2.10 Reportes (ventas, Staff, servicios, ocupación, exportaciones)

**Criterio de cierre de Fase 2** (orden oficial): una Barbería puede operar
todo su negocio sin herramientas externas.

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

**Próximo módulo a ejecutar: 2.5 — Servicios.** Con 2.1, 2.2, 2.3 y 2.4
cerrados, se retoma el orden oficial de la Fase 2 completo.

---

# FASE 3 — SuperSU CMS (completo, sin código, no una pantalla de aprobación)

Fuente: `02-UX/10_Super_Admin.md`.

- [ ] Dashboard global (negocios, usuarios, ingresos, actividad, salud)
- [ ] Gestión de Negocios (aprobar/rechazar/suspender/reactivar/cambiar plan)
- [ ] Marketplace (moderación, destacados, anuncios, categorías)
- [ ] Soporte (tickets, conversaciones, prioridades, SLA)
- [ ] Auditoría (logs, eventos, exportaciones)
- [ ] Configuración global (planes Raven/Jarl/Valhalla/Allfather, créditos
      IA, WhatsApp, Feature Flags) — todo editable desde interfaz, nunca
      SQL manual

---

# FASE 4 — App Staff (aplicación propia, no una vista reducida del Panel)

Fuente: `02-UX/08_Staff_App.md`.

- [ ] Inicio (hoy, próximo cliente, objetivos)
- [ ] Agenda (día/semana, check-in, finalizar servicio)
- [ ] Clientes (solo los atendidos por ese Staff)
- [ ] Ganancias (comisiones, propinas, historial)
- [ ] Niveles (PRO/EXPERT/MASTER)
- [ ] Guardian: mismos permisos adicionales aparecen automáticamente sobre
      la misma cuenta Staff cuando se otorga el perfil — nunca una segunda
      app o cuenta separada (`03-Business-Rules/01_Roles.md`)

---

# FASE 5 — Marketplace Premium (solo cuando existan negocios reales)

- [ ] Mapa + geolocalización (MapLibre + OpenStreetMap)
- [ ] Favoritos, compartir negocio
- [ ] Destacados, ranking (`08-Growth-Monetization/01_Marketplace_
      Algorithm.md`)
- [ ] SEO avanzado, recomendaciones

---

# FASE 6 — Growth Engine

- [ ] IA operacional, membresías, Gift Cards, referidos, campañas,
      automatizaciones, créditos IA, motor WhatsApp inteligente

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
