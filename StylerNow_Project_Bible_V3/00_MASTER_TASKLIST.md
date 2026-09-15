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
| Fase 5.2 — Marketplace: Destacados/Ranking (Score) | ⬜ | ⬜ | ⬜ | ⬜ | Siguiente |
| Fase 5.3 — Marketplace: Mapa + geolocalización | ⬜ | ⬜ | ⬜ | ⬜ | Pendiente |
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
  el saldo bajo $0 — `03-Business-Rules/04_Loyalty.md`), cobra el Saldo
  restante (efectivo/datáfono propio — `03-Business-Rules/03_Payment_
  Rules.md`: "cobrado por el Negocio directamente en Sede"), registra
  Propina, marca la Reserva `COMPLETADA`, y otorga Puntos nuevos (10 por
  cada $10.000 del valor del **Servicio** — nunca de los Productos, la
  regla de acumulación de `04_Loyalty.md` es explícita: "Reserva
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
  6-24, `CHECK` real de la base — `04_Loyalty.md`).

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

- [ ] Mapa + geolocalización (MapLibre + OpenStreetMap)
- [x] **Favoritos, compartir negocio** — ver detalle del Módulo 5.1 abajo
- [ ] Destacados, ranking (`08-Growth-Monetization/01_Marketplace_
      Algorithm.md`) — fórmula de Score de 6 componentes ya
      completamente especificada en la Biblia, pendiente de implementar
- [x] **SEO avanzado** — ya estaba construido desde antes de esta fase
      (`generateMetadata`, canonical, Open Graph, JSON-LD schema.org
      `HealthAndBeautyBusiness` en `/negocio/[slug]`) — se confirma acá,
      no se duplica. Recomendaciones no se construyeron: depende del
      motor de Score (arriba), sin sentido construirlas antes

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

**Próximo módulo a ejecutar: Fase 5.2 — Marketplace: Destacados/Ranking (Score).**

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
