# 00 — Master Tasklist (documento vivo)

> Se actualiza en cada sesión de desarrollo. Es el único lugar que responde
> "¿dónde estamos y qué falta?" sin tener que releer todo el código o la
> Biblia de nuevo. Cada ítem cita el documento de la Biblia que lo especifica.
> Convención: `[x]` construido y verificado · `[~]` construido parcialmente ·
> `[ ]` no empezado.
>
> **Última actualización:** 2026-09-14 · commit `pendiente` (perfil + bottom nav)

## Cómo leer esto

El roadmap oficial (`01-PRD/04_Roadmap.md`) define 4 fases de producto. Este
documento desglosa la **Fase 1 (MVP)** por superficie (`01-PRD/02_Functional_
Architecture.md`: Cliente PWA, Panel Negocio, App Staff, SuperSU CMS) porque
es donde estamos parados, y deja Fases 2-4 como lista de referencia al final.

**Estado en una frase:** el motor transaccional (reservas, pagos, auth) y la
mitad del Cliente PWA están construidos y probados de punta a punta. Panel
Negocio, App Staff y SuperSU CMS — las otras 3 superficies — **no existen
todavía**. Sin al menos un Panel Negocio mínimo, ningún negocio puede darse
de alta, y el Marketplace se ve vacío aunque el resto funcione perfecto.

---

## Fase 0 — Fundación documental

- [x] Biblia del Proyecto completa (`StylerNow_Project_Bible_V3/`)

## Plataforma compartida (base común a las 4 superficies)

Fuente: `01-PRD/02_Functional_Architecture.md` — "no existen bases de datos
ni lógica de negocio duplicadas entre superficies".

- [x] Esquema de base de datos completo — 002 a 007 (identidad, negocio,
      transaccional, growth, RLS, triggers/storage)
- [x] Motor de disponibilidad y reservas — 008/009 (`slots_disponibles`,
      `crear_reserva`, lock por `EXCLUDE USING gist`, las 7 validaciones de
      `03-Business-Rules/02_Booking_Rules.md`)
- [x] Cálculo de Seña y reembolsos por ventana (`03-Business-Rules/03_
      Payment_Rules.md`)
- [x] Webhook idempotente de pasarela (`05-API/06_Webhooks.md`)
- [x] RLS completo por tabla (`06-Security/02_RLS.md`) — helpers
      `is_supersu`, `is_barberia_de`, `is_staff_de`, `is_guardian_de_sede`
- [x] Auth: login por código OTP + magic link funcional de punta a punta
      (`05-API/02_Auth.md`) — Resend como SMTP, dominio propio verificado
      (`mail.stylernow.com`)
- [x] Pagos: Mercado Pago Checkout Pro, reconciliación server-side,
      reembolsos (`05-API/04_Payments.md`)
- [x] Infraestructura de despliegue: Vercel + dominio + Supabase Auth URLs
      configuradas y funcionando en producción
- [ ] Consentimiento legal versionado — existe `perfil.consentimiento_
      datos_at` pero no hay tabla `texto_legal`/`aceptacion_legal` poblada
      ni pantalla que muestre el texto real (`06-Security/04_Compliance_
      Colombia.md`) — hoy el checkbox de login no vincula a un texto legal
      real, solo a un link `/legal/politica-de-datos` que no existe
- [ ] Service Worker — `manifest.json` completo con íconos (✅), pero no
      hay `sw.js`: cero cacheo de shell, cero instalabilidad real todavía
      (`02-UX/03_Client_PWA.md`)
- [ ] Auditoría (`evento_auditoria`) — la tabla y algunos inserts existen
      (reservas, webhooks huérfanos) pero no hay pantalla en ninguna
      superficie que la muestre todavía (llega con SuperSU CMS y Panel
      Negocio → Reportes)

---

## Superficie 1 — Cliente PWA

Fuente: `02-UX/02_Onboarding.md`, `03_Client_PWA.md`, `04_Marketplace.md`,
`05_Booking.md`, `06_Payments.md`, `07_Appointments.md`.

### Onboarding y cuenta
- [x] Slides de valor (3 pantallas) → `/onboarding`
- [x] Login/registro unificado por código OTP + magic link → `/login`
      (el registro y el login son el mismo flujo — no hay una pantalla
      "Crear cuenta" separada, es la decisión correcta de diseño, no un
      bug: `signInWithOtp` con `shouldCreateUser:true` cubre ambos casos)
- [ ] **Consentimiento de datos como paso propio con texto real** — hoy es
      un checkbox que apunta a un link roto (`/legal/politica-de-datos`
      no existe); falta la página y el texto legal versionado
- [ ] Permiso de ubicación (opcional, "cerca de mí") — no implementado
- [ ] Permiso de notificaciones push (opcional) — no implementado, no hay
      ni la capa de abstracción que pide `03_Client_PWA.md` para Capacitor
- [x] **Completar perfil tras el primer login** (nombre, teléfono) —
      `verificarCodigo` y `/auth/callback` detectan `telefono is null`
      (señal de primer login) y desvían una sola vez a `/perfil?
      bienvenida=1` antes de seguir al destino original

### Navegación de superficie
- [~] **Bottom nav de 3 pestañas (Inicio / Citas / Perfil)** — construido
      (`src/components/layout/bottom-nav.tsx`) y montado en Home, Mis
      Reservas y Perfil. **No** está en el perfil de Negocio ni en el
      flujo de reserva/pago a propósito: esas pantallas ya tienen su
      propio CTA fijo abajo y agregar una segunda barra fija competiría
      con él — cobertura real hoy es "pantallas de recorrido", no el
      100% literal que pide `03_Client_PWA.md`

### Marketplace (`04_Marketplace.md`)
- [x] Descubrimiento: búsqueda, filtros por categoría/orden/ciudad
- [x] Perfil público de Negocio con SEO/JSON-LD
- [x] Reseñas — **solo lectura** (ver pendiente abajo)
- [ ] Filtro "Cerca de mí" reactivo a geolocalización — el chip existe
      visualmente en `filtros.tsx` pero no dispara ninguna consulta con
      ubicación real
- [ ] Vista de mapa con pines — no implementada (alterna con lista)
- [ ] Carrusel de Negocios patrocinados (`03-Business-Rules/06_
      Marketplace_Ads.md`) — depende de Fase 2 (Marketplace Ads), no
      bloquea Fase 1
- [ ] **Favoritos** (guardar negocio, sin límite) — tabla no existe en el
      esquema, RPC no existe, UI no existe
- [ ] **Compartir negocio** (link público) — el perfil ya es indexable
      por slug, falta solo el botón de compartir en la UI

### Booking (`05_Booking.md`)
- [x] Flujo de 4 pasos completo (servicio → staff → horario → resumen)
- [x] Combos de servicios sin Staff único → mensaje explícito
- [x] Lista de espera — alta desde el flujo (`unirseListaEspera`)
- [ ] Lista de espera — **notificación cuando se libera un cupo**
      (`03-Business-Rules/10_Waitlist_System.md`) no está implementada:
      hoy el Cliente se anota pero nadie le avisa nunca (requiere el
      motor de notificaciones, ver Plataforma compartida)

### Payments (`06_Payments.md`)
- [x] Pago de Seña vía Mercado Pago, con política de cancelación visible
      antes de pagar
- [x] Timeout de UX a los 30s con mensaje de "podés cerrar la app"
- [ ] Propina (antes o después de la cita) — tabla `pago` ya soporta
      `tipo='PROPINA'`, no hay ninguna pantalla ni acción todavía
- [ ] Gestión de métodos de pago guardados (enmascarados) — no aplica
      hasta integrar guardado de tarjeta de Mercado Pago (Fase 2+)

### Appointments (`07_Appointments.md`)
- [x] Listado "Próximas"/"Historial" → `/mis-reservas`
- [x] Cancelación con monto de reembolso mostrado antes de confirmar
- [ ] **Reagendar** una Reserva `CONFIRMADA` (reutilizar Paso 3 del
      booking) — no implementado, hoy solo se puede cancelar y volver a
      reservar desde cero
- [ ] **Calificar (dejar reseña)** dentro de los 30 días de `COMPLETADA`
      — no existe la pantalla ni la acción; hoy las reseñas solo se leen,
      nunca se escriben desde la app
- [ ] Detalle de reembolso aplicado visible en el detalle de una Reserva
      `CANCELADA`/`NO_SHOW` — parcialmente cubierto (se muestra el
      motivo genérico), falta el desglose exacto de monto reembolsado

### Perfil (dentro de la Biblia, pestaña del bottom nav)
- [x] **Página de perfil** → `/perfil` — editar nombre/teléfono, ver
      total de puntos de fidelización disponibles, cerrar sesión
- [ ] Editar avatar (subida a Storage, bucket `avatars` ya existe desde
      la migración 007) — no implementado en esta pasada
- [ ] Desglose de puntos por negocio (hoy se muestra un total agregado
      cruzando todos los negocios, no por negocio individual)

**Resumen Cliente PWA:** el núcleo transaccional (reservar y pagar) está
completo y verificado. Lo que falta es lo que rodea ese núcleo: perfil,
navegación persistente, favoritos, reseñas propias, reagendar, permisos
nativos. Es la superficie más avanzada pero no está "cerrada".

---

## Superficie 2 — Panel Negocio — **0% construido**

Fuente: `02-UX/09_Business_Panel.md`, `02-UX/02_Onboarding.md` (wizard).

- [ ] **Wizard de onboarding de Negocio** (4 pasos: datos, sedes,
      servicios, invitar staff) con progreso guardado entre sesiones —
      **bloqueante**: sin esto no puede existir un solo Negocio real, y
      por eso el Marketplace de Cliente se ve vacío
- [ ] Dashboard (KPIs del negocio)
- [ ] Agenda multi-Staff (vista de calendario del lado del Negocio)
- [ ] Servicios y Staff (catálogo, precios, asignar Staff a Servicios,
      invitar/remover Staff, otorgar/quitar Guardian)
- [ ] Clientes/CRM básico
- [ ] Caja/POS (cobro de Saldo en sede)
- [ ] Reportes y reseñas recibidas (con opción de responder)
- [ ] Configuración (política de cancelación, % de Seña, plan y
      facturación)

**Por qué es la próxima prioridad real:** ninguna otra superficie ni
funcionalidad del Cliente se puede probar con datos reales sin esto. Hoy
el único negocio que existe en la base es el que crea y borra el script
de verificación end-to-end.

## Superficie 3 — App Staff — **0% construido**

Fuente: `02-UX/08_Staff_App.md`.

- [ ] Navegación principal propia (no es una vista reducida del Panel)
- [ ] Agenda del día propia + check-in/check-out
- [ ] Mi Nivel (PRO/EXPERT/MASTER) y detalle de puntaje
- [ ] Clientes atendidos por ese Staff (no el CRM completo)
- [ ] Perfil/Ganancias (comisiones, propinas, bloquear disponibilidad)

## Superficie 4 — SuperSU CMS — **0% construido**

Fuente: `02-UX/10_Super_Admin.md`.

- [ ] Dashboard global de plataforma
- [ ] Gestión de Negocios — **bloqueante junto con el wizard de Negocio**:
      aunque exista el wizard, todo Negocio nace en `PENDIENTE_APROBACION`
      y nunca aparece en el Marketplace sin que alguien lo apruebe; sin
      esta pantalla, aprobar hoy requiere un UPDATE manual en la base
- [ ] Planes y configuración global (sin código)
- [ ] Soporte y moderación (incluye moderar reseñas reportadas)

---

## Criterio de salida de Fase 1 (`01-PRD/04_Roadmap.md`, textual)

> "Un Cliente puede descubrir, reservar y pagar una seña; un Negocio puede
> operar su agenda completa; SuperSU puede aprobar Negocios y cobrar
> comisión — todo sin intervención manual fuera de la plataforma."

Hoy: la primera cláusula está verificada de punta a punta. La segunda y la
tercera dependen enteramente de las superficies en 0% de arriba.

---

## Fase 2 — Marketplace y crecimiento (no empezada)
- [ ] Algoritmo completo de ranking (`08-Growth-Monetization/01_
      Marketplace_Algorithm.md`)
- [ ] Marketplace Ads autoservicio
- [ ] Sistema PRO/EXPERT/MASTER activo con impacto real (tablas ya
      existen desde la migración 003, sin UI ni cron que las alimente)
- [ ] Multi-sede (Plan Valhalla)

## Fase 3 — Inteligencia y retención (no empezada)
- [ ] CRM completo
- [ ] IA operacional (recomendaciones, predicción de ocupación)
- [ ] Membresías y Gift Cards
- [ ] Notificaciones WhatsApp avanzadas (campañas)

## Fase 4 — Escala y empaquetado móvil (no empezada)
- [ ] Empaquetado Capacitor
- [ ] Plan Allfather con API dedicada
- [ ] Compliance más allá de Colombia

---

## Listo-para-lanzamiento (transversal, independiente de fase)

No es "una fase más" — son controles que hay que pasar sí o sí antes de
producción real, sin importar cuántas fases de producto estén cerradas.

- [ ] `security-review` (skill del repo) sobre el estado final antes de
      lanzar
- [ ] `production-readiness` (skill del repo) — build, RLS, secretos,
      CSP, error boundaries, monitoreo
- [ ] Textos legales reales (Términos, Política de Datos) — hoy son
      links rotos
- [ ] Página de error genérica / `error.tsx` global (no existe todavía;
      un error no controlado hoy muestra la pantalla default de Next)
- [ ] Analytics / observabilidad de producción (`10-Operations/06_
      Analytics_Definitions.md`)
- [ ] Credenciales de Mercado Pago de **producción** (hoy son `TEST-`)
- [ ] Dominio de envío de correo migrado del subdominio compartido
      (`mail.stylernow.com`) — este ya es del dominio real, no hace
      falta migrar nada acá, queda como está ✅

---

## Próximo paso recomendado

**Panel Negocio, mínimo viable primero:** wizard de onboarding (Datos →
Sede → Servicios) + una pantalla de aprobación en SuperSU (aunque sea
solo una tabla con botón Aprobar/Rechazar, no todo el CMS). Con eso se
cierra el círculo completo: un Negocio real se da de alta, se aprueba, y
aparece en el Marketplace donde ya se lo puede reservar y pagar de punta
a punta — el resto de cada superficie (reportes, CRM, agenda multi-staff)
se construye después con el círculo ya cerrado y demostrable.
