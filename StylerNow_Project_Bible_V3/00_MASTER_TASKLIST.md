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
> **Última actualización:** 2026-09-14 · commit `365d3dc`

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

- [ ] 2.1 Registro de Barbería (wizard completo, progreso persistente)
- [ ] 2.2 Dashboard (ingresos, ocupación, próximas citas, plan, alertas)
- [ ] 2.3 Gestión de Sedes (crear/editar/cerrar/reactivar/trasladar)
- [ ] 2.4 Gestión de Staff (listado, detalle, CRUD, Guardian, matriz de roles)
- [ ] 2.5 Servicios (CRUD, categorías, combos, asignación a Staff)
- [ ] 2.6 Agenda (día/semana/Staff, drag & drop, bloqueos, conflictos)
- [ ] 2.7 CRM (historial, notas, etiquetas, LTV, riesgo de abandono)
- [ ] 2.8 POS (venta rápida, productos, propinas, saldo pendiente, recibos)
- [ ] 2.9 Inventario (entradas/salidas, consumo automático, alertas)
- [ ] 2.10 Reportes (ventas, Staff, servicios, ocupación, exportaciones)

**Criterio de cierre de Fase 2** (orden oficial): una Barbería puede operar
todo su negocio sin herramientas externas.

**Próximo módulo a ejecutar: 2.1 Registro de Barbería** — es el que
desbloquea todo lo demás (sin un negocio dado de alta, ninguno de los
módulos 2.2-2.10 tiene datos reales sobre los que operar).

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
