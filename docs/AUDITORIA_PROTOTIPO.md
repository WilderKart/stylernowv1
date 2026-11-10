# Auditoría del prototipo brutalista

**Fecha:** 2026-11-10
**Fase:** 1 — auditoría; no autoriza implementación.
**Rama:** `feat/brutalist-ui` (ya era la rama activa al comenzar).
**Alcance:** comparación de la aplicación y el prototipo en el estado local actual.

## Alcance y método

Se revisaron las 105 pantallas HTML, el índice, `README.md`, `tokens.css`, `bundle.css` y `proto.css`; se extrajo el texto visible y se comprobaron sus enlaces. Los enlaces a archivos HTML del prototipo tienen destinos existentes; los controles son maquetas estáticas y no prueban lógica de producto. También se leyeron rutas, layouts, componentes de navegación, flujos de auth/reserva/pago, guards, migraciones y RLS pertinentes, PWA y dependencias.

El árbol ya estaba muy modificado y contenía archivos ajenos a esta auditoría. La evaluación refleja ese estado local, incluidos los cambios recientes de autenticación y las migraciones 081–084, que siguen sin commit. No se leyó ningún secreto ni contenido de variables de entorno. El prototipo no fue modificado.

## Reconocimiento técnico

| Área | Estado observado |
|---|---|
| Aplicación | Next.js 16.3.5 App Router, React 19.2, TypeScript y Tailwind CSS 4. Hay 71 archivos `page.tsx`; el Route Registry contiene rutas base y resuelve subrutas por prefijo. |
| UI | Primitivas propias en `src/components/ui` con Radix, `class-variance-authority`, Tailwind y utilidades propias; no hay paquete `shadcn` instalado como framework independiente. Hay Button, Input, Card, Skeleton, Empty, Rating, Dialog, Drawer y otros componentes. |
| Tema actual | `src/app/globals.css` usa fondo oscuro, acento ámbar, Oswald/Inter y radios de 13–16 px. El prototipo exige blanco/negro/naranja, Archivo/Space Mono, radios 0 y sombras duras. No son temas visualmente compatibles todavía. |
| Diseño prototipo | Tokens en `stylernow-prototipo/stylernow-prototipo/css/tokens.css`; componentes `sn-*` en `bundle.css`, utilidades `p-*` en `proto.css`. El prototipo establece mínimo táctil de 48 px, layout de teléfono de referencia de 390 px, tema oscuro por `data-theme` y tablas adaptables mediante contenedor. |
| Rutas | Auth y roles se resuelven con Supabase; `src/proxy.ts` solo decide público/protegido y no calcula roles. Los guards y la RLS siguen siendo la autoridad de acceso. Roles derivados: cliente, staff, guardian, barbería y SuperSU. No se debe convertir el selector visual del prototipo en escritura de rol. |
| Auth | Supabase Auth con OTP, contraseña, Google y recuperación; alta de cliente implícita mediante OTP. No se encontró OAuth de Apple. El consentimiento legal requerido en login no equivale a consentimientos opcionales para marketing o terceros. |
| Persistencia/RLS | Supabase Postgres y Storage, 84 migraciones y 91 tablas declaradas. El análisis estático encontró RLS habilitado en las 91; 89 tienen políticas explícitas y `intento_auth` y `password_history` no declaran políticas, por lo que su acceso queda denegado por defecto. Esto no sustituye una auditoría semántica de cada política. |
| i18n | `next-intl` y proveedores de traducción no están instalados ni referenciados. El layout fija `lang="es"`; las pantallas actuales están en español. EN/PT del prototipo es una brecha funcional, no solo un cambio de estilo. |
| PWA | Hay `manifest.json`, service worker y `PwaManager`. El prompt de instalación aparece después de visitas repetidas; el service worker cachea shell/assets, no datos transaccionales, y devuelve estado offline si no hay fallback. No existe una pantalla de instalación separada equivalente a G10. |
| Integraciones | El flujo de pago existente usa Mercado Pago Checkout Pro y reconciliación/webhooks. La decisión local documentada es conservar Mercado Pago; Wompi, Bre-B y otros medios del prototipo no autorizan cambiar proveedores ni reglas de cobro. |
| Calidad | `npm run build` incluye el chequeo de cobertura de auth y luego `next build`; `npm run lint` existe. No hay scripts `test` ni `typecheck` en `package.json`; Playwright no aparece como dependencia. La verificación de Fase 5 requerirá definir esos gates después de aprobación. |

### Criterio de estado

`CUBIERTA` significa que existe y funciona la capacidad principal equivalente y el trabajo de esta migración sería principalmente visual; no significa que el aspecto actual coincida. `PARCIAL` significa que existe una ruta, datos o lógica, pero faltan funciones/datos explícitos del prototipo. `SOLO UI` significa que existe UI de aplicación sin lógica conectada. `FALTA` significa que no se encontró equivalente de aplicación. Ninguna pantalla se clasificó `SOLO UI`: las maquetas HTML estáticas pertenecen al prototipo, no a la app. Las prioridades y esfuerzos son estimaciones iniciales, sujetas a aprobación.

## Resumen ejecutivo

| Estado | Pantallas | Porcentaje |
|---|---:|---:|
| CUBIERTA | 30 | 28,6 % |
| PARCIAL | 56 | 53,3 % |
| SOLO UI | 0 | 0 % |
| FALTA | 19 | 18,1 % |

Por tanto, el **81,9 %** tiene al menos una capacidad equivalente construida, aunque solo el **28,6 %** requiere estrictamente un rediseño sin completar producto. El **71,4 %** necesita trabajo funcional parcial o completo. Esto no es una comparación visual: la interfaz actual difiere sustancialmente del prototipo.

**Brechas de mayor riesgo:** consentimientos de propósito/terceros sin registro granular; selección de rol frente a roles derivados; planes y precios distintos; mockup de pago con proveedores que no usa la app; campos de precio por nivel sin soporte actual; ausencia de Mi Marca y superficies de privacidad. Ninguna de estas discrepancias debe resolverse cambiando reglas de negocio por inferencia.

## Qué falta para funcionar como el prototipo objetivo

El prototipo objetivo es la referencia visual y de navegación; no sustituye los datos, reglas ni controles de acceso de la app. Para llegar a él hacen falta tres tipos de trabajo:

| Trabajo | Alcance que indica la matriz | Resultado necesario |
|---|---|---|
| Sistema visual común | Las 105 pantallas; incluso las 30 `CUBIERTA` necesitan restyle. | Tokens brutalistas, tema claro/oscuro, Archivo/Space Mono y componentes React reutilizables para `sn-*`/`p-*`; layouts móvil/escritorio y accesibilidad responsive. |
| Completar lo existente | 56 `PARCIAL`. | Añadir las funciones/campos enumerados por pantalla sin cambiar queries, auth, reglas de negocio, guards o RLS actuales; mapear pestañas y enlaces a rutas reales. |
| Construir capacidades ausentes | 19 `FALTA`; no se halló UI de app sin lógica (`SOLO UI`: 0). | Diseñar frontend y, donde se apruebe, servicios/migraciones aditivas con RLS; entre otras: soporte de Cliente, privacidad granular, Mi Marca, chat y módulos admin que hoy no tienen superficie. |
| Reconciliar reglas | Temas en “Conflictos que requieren aprobación”. | Resolver primero selector de rol, catálogo/Plan Fundador, precio por nivel Staff, métodos de pago y propósitos A1–A9; el mockup no autoriza cambios de negocio. |
| Demostrar paridad | Fase 5 y validaciones todavía no ejecutadas. | Datos reales, estados de carga/vacío/error/offline, navegación por rol, pruebas de flujos y tamaños 360/390/1280/1440, desbordes y capturas comparativas contra las 105 pantallas. |

Orden funcional recomendado: registro/login → home/lista/mapa → perfil del negocio → reserva → pago → mis citas; después Profesional, Dueño y Super Admin. La matriz por código precisa para cada pantalla su estado, dependencia, esfuerzo y prioridad.

## Matriz de pantallas

Los nombres de archivo del prototipo se forman con el código de cada fila, por ejemplo `G01-Splash.html`, dentro de `stylernow-prototipo/stylernow-prototipo/pantallas/`. Las rutas de equivalencia son aproximadas cuando varias pantallas del prototipo son pasos de una sola página real.

### Generales G01–G17

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| G01 | Splash | Todos | No hay splash; `/` es marketplace (`src/app/page.tsx`) | FALTA | Arranque/transición visual independiente. | Ninguna. | S | P2 |
| G02 | Onboarding | Cliente | `/onboarding` (`src/app/onboarding/page.tsx`) | PARCIAL | Hay onboarding educativo, pero faltan los pasos y permisos del prototipo. | Ninguna para el contenido; ubicación vía navegador si se solicita. | M | P1 |
| G03 | Permisos | Cliente | Marketplace/mapa y PWA; sin pantalla de permisos | PARCIAL | Solicitud contextual de ubicación/notificaciones/cámara y preferencias revocables. | `sede.latitud/longitud`; APIs del navegador; PWA. | M | P1 |
| G04 | Idioma/región | Cliente | Sin selector equivalente; `/perfil` no tiene locale | FALTA | ES/EN/PT, país, moneda y zona horaria seleccionables. | `ciudad_habilitada`; `perfil` no guarda locale. | M | P1 |
| G05 | Ingreso | Cliente/todos | `/login` (`src/app/login/formulario.tsx`) | PARCIAL | OTP/contraseña/Google están; falta Apple y presentación del prototipo. | Supabase Auth, `perfil`, rate limit, proveedores OAuth. | M | P0 |
| G06 | Código | Cliente/todos | Paso OTP dentro de `/login`, sin ruta de código | PARCIAL | La verificación funciona, pero no es pantalla/ruta independiente; varían campos y estados. | Supabase Auth OTP, acciones de login y rate limit. | S | P0 |
| G07 | Registro | Cliente | Alta implícita en `/login` con OTP | PARCIAL | No hay registro independiente ni consentimiento de marketing opcional separado; la aceptación legal sí es requerida. | `auth.users`, `perfil`, `aceptacion_legal`, `texto_legal`. | M | P0 |
| G08 | Recuperar | Todos | `/login/recuperar` | CUBIERTA | Restyle y adaptación de componentes; mantener recuperación y sesión. | Supabase Auth, `password_history`, `session_version`. | S | P0 |
| G09 | Selector de rol | Cliente/staff/dueño | No existe; destino se deriva por contexto y guards | FALTA | No se puede asignar rol desde UI. Aclarar si se requiere selector de contexto solo para cuentas con varios accesos. | `perfil`, `negocio`, `vinculo_staff_negocio`, resolver de contexto. | M | P1 |
| G10 | Instalar PWA | Cliente | Prompt integrado en `PwaManager`; sin pantalla | PARCIAL | Vista de instrucciones iOS y la navegación dedicada del prototipo. | Manifest, service worker, APIs de instalación del navegador. | S | P2 |
| G11 | Notificaciones | Todos | Sin centro de notificaciones; tabla de envíos | PARCIAL | Bandeja, lectura, preferencias y navegación a detalle. | `notificacion_envio`, canales Push/Email disponibles; credencial Push pendiente según decisiones. | M | P1 |
| G12 | Ayuda/legal | Todos | `/legal/[slug]`, `/legal/aceptar`, soporte de panel | PARCIAL | FAQ y centro unificado cliente; mantener textos legales y versiones existentes. | `texto_legal`, `aceptacion_legal`, `ticket_soporte`, `ticket_mensaje`. | M | P2 |
| G13 | Soporte | Cliente | `/panel/soporte` es soporte del negocio; no hay portal de Cliente | PARCIAL | Crear/seguir tickets del Cliente y respuestas. | `ticket_soporte`, `ticket_mensaje`, RLS por solicitante/soporte. | M | P1 |
| G14 | Estados vacío/error/offline | Todos | `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `use-en-linea`, `sw.js` | PARCIAL | Unificar estados por pantalla y manejo offline sin servir datos transaccionales obsoletos. | No requiere tablas nuevas; datos se mantienen network-first. | M | P1 |
| G15 | Eliminar cuenta/exportar datos | Cliente | Sin ruta de autoservicio equivalente | FALTA | Exportación y supresión con confirmación, retención legal y dependencias. | `perfil`, `reserva`, `pago`, `resena`, `reserva_foto`, Storage/Auth. | L | P1 |
| G16 | Banner de cookies | Visitante/cliente | No se encontró banner ni gestor | FALTA | Consentimiento de analítica configurable; no hay PostHog/analytics en dependencias actuales. | Almacenamiento de preferencia; integraciones analíticas aún no presentes. | M | P1 |
| G17 | Centro de privacidad | Cliente | Legal actual (`/legal/aceptar`) no es centro de privacidad | PARCIAL | Historial, retiro, propósitos separados y autorización explícita opcional para terceros. | `aceptacion_legal`, `perfil.consentimiento_datos_at`, `reserva_foto`; falta tabla de consentimiento granular. | L | P0 |

### Cliente C01–C25 + C03b

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| C01 | Home | Cliente | `/` (`src/app/page.tsx`) | PARCIAL | Hay búsqueda/listado real; faltan composición editorial, personalización y datos del ejemplo. | `marketplace_buscar`, `banner_home`, `negocio`, `campana_publicitaria`. | M | P0 |
| C02 | Mapa | Cliente | `/?vista=mapa` y `MapaMarketplace` | CUBIERTA | Restyle; conservar consulta y selección por ubicación. | `marketplace_buscar`, `sede` geo, MapLibre/OSM. | S | P1 |
| C03 | Lista | Cliente | `/` en vista lista | CUBIERTA | Restyle; reemplazar tarjetas/datos estáticos solo por datos reales. | `marketplace_buscar`, `negocio`, `resena`, `servicio`. | S | P0 |
| C03b | Filtros | Cliente | `Filtros` dentro de `/`; no tiene ruta propia | PARCIAL | No hay hoja/ruta como tal y el conjunto de filtros del mockup no está cubierto íntegramente. | `marketplace_buscar`, ciudades y categorías; filtros de nivel/cola por verificar. | M | P1 |
| C04 | Perfil del negocio | Cliente/visitante | `/negocio/[slug]` | PARCIAL | Falta equivalencia completa de horario, fila y detalle de perfil/galería del mockup. | `negocio`, `sede`, `servicio`, `staff`, `resena`, `favorito_negocio`, `membresia_plan`. | M | P0 |
| C05 | Perfil del profesional | Cliente | Profesionales embebidos en `/negocio/[slug]`; sin perfil individual | PARCIAL | Portafolio, reseñas, perfil público y horarios por persona con URL propia. | `staff`, `vinculo_staff_negocio`, `nivel_staff_consolidado`, `resena`, `disponibilidad`. | M | P1 |
| C06 | Reserva: servicios | Cliente | Paso 1 de `/negocio/[slug]/reservar` | CUBIERTA | Restyle y datos reales; no sustituir reglas de servicio/combos. | `servicio`, `servicio_combo`, `servicio_combo_item`. | S | P0 |
| C07 | Reserva: profesional | Cliente | Paso 2 del flujo de reserva | PARCIAL | El nivel se muestra, pero el precio por nivel del prototipo no existe en el modelo/cálculo actual. Requiere decisión. | `staff`, `staff_servicio`, `nivel_staff_consolidado`, `servicio.precio_base`. | M | P0 |
| C08 | Reserva: hora | Cliente | Paso 3 del flujo de reserva | CUBIERTA | Restyle del selector de fecha/slots. | `disponibilidad`, `bloqueo_ausencia`, RPC de slots y motor de reservas. | S | P0 |
| C09 | Reserva: pago/resumen | Cliente | Paso 4 y `/reserva/[id]/pago` | PARCIAL | La reserva usa seña y Checkout Pro; faltan nota al profesional y elección interna de métodos del mockup. | `reserva`, `reserva_servicio`, `pago`, Mercado Pago, reglas de seña/reembolso. | M | P0 |
| C10 | Pago en proceso | Cliente | `/reserva/[id]/pago` | CUBIERTA | Restyle; mantener retorno, polling, reconciliación e idempotencia. | `pago`, `reserva`, Checkout Pro, webhook/sincronización. | S | P0 |
| C11 | Reserva confirmada | Cliente | `/reserva/[id]` | CUBIERTA | Restyle y mapeo de estados reales, no los datos de muestra. | `reserva`, `reserva_servicio`, `pago`, ruta ICS. | S | P0 |
| C12 | Fila virtual Cliente | Cliente | Acción de unirse en reserva; no hay pantalla de fila | PARCIAL | Posición, tiempo estimado, notificaciones y salida/cancelación visibles. | `lista_espera` y RLS existen; falta interfaz/actualización de posición. | M | P1 |
| C13 | Mis citas | Cliente | `/mis-reservas` | CUBIERTA | Restyle; las secciones existentes agrupan próximas e historial, aunque no replican todas las pestañas. | `reserva`, `reserva_servicio`, `negocio`, RLS de Cliente. | S | P0 |
| C14 | Detalle de cita | Cliente | `/reserva/[id]` | PARCIAL | Hay detalle/pago/cancelación; faltan chat y reprogramación real como los presenta el prototipo. | `reserva`, `pago`, reglas de cancelación, `sede`, `staff`. | M | P0 |
| C15 | Calificar | Cliente | No hay pantalla de Cliente; tabla y políticas de reseña sí existen | PARCIAL | Formulario, carga de fotos y envío posterior a una reserva completada. | `resena`, `reserva`, `reserva_foto`, Storage/RLS. | M | P1 |
| C16 | Favoritos | Cliente | `/favoritos` | PARCIAL | La vista actual cubre negocios; falta comprobar/añadir profesionales favoritos como categoría independiente. | `favorito_negocio`, `negocio`, `resena`, `servicio`. | S | P1 |
| C17 | My Look | Cliente | Sin pantalla Cliente; hay `reserva_foto` y notas CRM | PARCIAL | Historial antes/después, fórmula y permisos visibles al Cliente. | `reserva_foto`, `cliente_nota`, `reserva`, Storage; consentimiento de foto. | L | P1 |
| C18 | Puntos/gift cards | Cliente | `/lealtad`, `/gift-cards`, `/gift-cards/mis`, compra/canje | PARCIAL | Unificar la experiencia; validar disponibilidad de compra/canje frente al checkout real sin usar datos de ejemplo. | `punto_fidelizacion`, `lealtad_wallet`, `lealtad_movimiento`, `gift_card`, membresías. | M | P1 |
| C19 | Pagos/saldo | Cliente | Pagos en reserva; sin wallet/métodos guardados de Cliente | PARCIAL | Historial consolidado, saldo reembolsable y medios guardados que aparecen en el mockup. | `pago`; `wallet` existente es de negocio, no una wallet de Cliente. Mercado Pago. | L | P2 |
| C20 | Chat | Cliente/negocio | Sin conversación por reserva | FALTA | Mensajería y autorización por partes de la reserva; no confundir con tickets de soporte. | `reserva`, `ticket_soporte` no implementa chat de cita; faltan conversaciones/mensajes. | L | P2 |
| C21 | Perfil y preferencias | Cliente | `/perfil` | PARCIAL | Vista agregada de perfil, preferencias, privacidad, notificaciones y cambio de contexto. | `perfil`, `reserva`, lealtad, aceptación legal; falta centro de privacidad. | M | P1 |
| C22 | Referidos | Cliente | Sección dentro de `/lealtad`; no hay ruta dedicada | PARCIAL | Vista y acciones con flujo propio de invitación/seguimiento. | `referido_codigo`, `referido`, `referido_config`, `lealtad_movimiento`. | M | P2 |
| C23 | Ofertas | Cliente | Negocios patrocinados en `/`; sin página de ofertas | PARCIAL | Lista y filtros de ofertas promocionales; no equivale a mostrar anuncios patrocinados. | `campana_publicitaria`, `wallet`, `negocio`; reglas de oferta por definir. | M | P2 |
| C24 | Beneficios de marcas | Cliente | No existe superficie ni consentimiento de terceros | FALTA | Beneficios y checkbox separado, explícito, opcional y sin preselección. | No hay marca/beneficio ni registro granular; requiere tabla nueva con RLS. | L | P2 |
| C25 | Perfil con Mi Marca | Cliente/visitante | Perfil público estándar `/negocio/[slug]` | FALTA | Identidad visual/subdominio/app de marca configurables y servidos con aislamiento por negocio. | `negocio` no tiene entidad de branding white-label; se recomienda tabla aditiva. | L | P2 |

### Profesional B01–B14

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| B01 | Aceptar invitación | Staff | `/invitacion/[id]` | PARCIAL | La invitación existe; faltan pasos de portafolio, revisión y estados de perfil del prototipo. | `invitacion_staff`, `staff`, `vinculo_staff_negocio`, Storage. | M | P1 |
| B02 | Hoy | Staff | `/staff` redirige a `/staff/agenda` | PARCIAL | Resumen diario, KPIs e ingresos no existen como home independiente. | `reserva`, `pago`, `puntaje_staff_evento`, reportes. | M | P1 |
| B03 | Agenda | Staff | `/staff/agenda` | CUBIERTA | Restyle del calendario; conservar filtros de sede/alcance del rol. | `reserva`, `disponibilidad`, `bloqueo_ausencia`, RLS por Staff. | S | P1 |
| B04 | Bloquear horas | Staff | Agenda y `bloqueo_ausencia`; sin página equivalente de Staff | PARCIAL | Formulario/solicitud de bloqueos y días libres con los estados del mockup. | `bloqueo_ausencia`, `disponibilidad`, reglas de quién aprueba. | M | P1 |
| B05 | Detalle de cita | Staff | Agenda Staff; detalle dedicado no identificado | PARCIAL | Vista de cita con notas, acciones de inicio/finalización, falta y fotos. | `reserva`, `reserva_servicio`, `cliente_nota`, `reserva_foto`. | M | P1 |
| B06 | Cita rápida | Staff | Agenda de negocio; no hay pantalla independiente confirmada | PARCIAL | Flujo walk-in conforme a la decisión pendiente de Cliente nuevo/confirmación sin seña. | `reserva`, `perfil`, `servicio`, `pago`; decisiones abiertas en `docs/PENDING_DECISIONS.md`. | M | P1 |
| B07 | Fila virtual Staff | Staff | Agenda y `lista_espera`; sin gestión completa de fila | PARCIAL | Vista de cola, llamado de turno y control de estado. | `lista_espera`, `notificacion_envio`, `reserva`. | M | P1 |
| B08 | Mis clientes | Staff | `/staff/clientes` | CUBIERTA | Restyle y campos dinámicos; no usar nombres/visitas ficticios. | `reserva`, `perfil`, `cliente_nota`, alcance de vínculo/RLS. | S | P1 |
| B09 | Ficha del cliente | Staff | `/staff/clientes`; sin detalle dinámico individual comprobado | PARCIAL | Historial, preferencias, consentimiento, notas y métricas privadas. | `perfil`, `reserva`, `cliente_nota`, `cliente_etiqueta`, `reserva_foto`. | M | P1 |
| B10 | Cámara antes/después | Staff | Sin pantalla; `reserva_foto` y Storage sí existen | PARCIAL | Captura móvil, dos permisos separados (historial/portafolio) y revocación. | `reserva_foto`, Storage, consentimiento actual por foto; falta consentimiento histórico granular. | M | P2 |
| B11 | Perfil público | Staff | `/staff/perfil` privado y personal listado en perfil del negocio | PARCIAL | Ruta pública individual, portafolio, horarios y vista previa editable. | `staff`, `vinculo_staff_negocio`, `staff_servicio`, nivel consolidado. | M | P1 |
| B12 | Ingresos | Staff | No hay pantalla de ingresos/liquidaciones; hay comisión y métricas de negocio | PARCIAL | Vista personal de comisiones, propinas, periodos y liquidaciones. | `vinculo_staff_negocio.comision_pct`, `reserva`, `pago`; falta entidad de liquidación Staff. | L | P1 |
| B13 | Reputación/nivel | Staff | `/staff/nivel` | CUBIERTA | Restyle; respetar fórmula y umbrales de Staff de la Biblia, no valores del mockup. | `puntaje_staff_evento`, `temporada`, `nivel_staff_consolidado`, RPC `staff_mi_nivel_actual`. | S | P1 |
| B14 | Configuración | Staff | `/staff/perfil` | PARCIAL | Preferencias de notificación, passkey/dispositivos e idioma del prototipo no están reunidos. | `perfil`, Auth/session version, `notificacion_envio`; i18n inexistente. | M | P2 |

### Dueño móvil D00–D21

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| D00 | Más | Dueño | `PanelNav` con módulos; no hay `/panel/mas` | PARCIAL | Menú móvil agrupado y accesos que hoy están repartidos en navegación horizontal. | Route Registry y rutas `/panel/*`. | M | P2 |
| D01 | Alta del negocio | Dueño | `/panel/onboarding` | CUBIERTA | Restyle y mapeo del contenido; conservar validaciones, invitaciones y aprobación. | `negocio`, `sede`, `servicio`, `suscripcion`, `invitacion_staff`, RPC de registro. | S | P1 |
| D02 | Elegir plan | Dueño | `/panel/suscripcion` | PARCIAL | Los planes reales son Raven/Jarl/Valhalla/Allfather; el mockup presenta otros nombres, precios y Fundador. | `plan`, `suscripcion`, configuración de precios/addons. | M | P1 |
| D03 | Panel del día | Dueño | `/panel` | PARCIAL | Comparativos, ocupación, fila, caja y alertas según la composición del mockup. | `reserva`, dashboard RPC, `lista_espera`, POS, inventario, `resena`. | M | P1 |
| D04 | Agenda general | Dueño | `/panel/agenda` | CUBIERTA | Restyle móvil y acciones según permisos existentes. | `reserva`, `sede`, `staff`, disponibilidad/ausencias y RLS. | S | P1 |
| D05 | Servicios | Dueño | `/panel/servicios` | PARCIAL | Catálogo global no borrable y precios por PRO/EXPERT/MASTER no están equivalentes al `servicio.precio_base` actual. | `servicio`, `servicio_combo`, `servicio_combo_item`; sin catálogo global enlazado confirmado. | M | P1 |
| D06 | Equipo | Dueño | `/panel/staff`, `/panel/staff/nuevo`, `/panel/staff/[id]` | CUBIERTA | Restyle y estados de invitación/aprobación con datos reales. | `staff`, `vinculo_staff_negocio`, `invitacion_staff`, `staff_servicio`. | S | P1 |
| D07 | Sedes | Dueño | `/panel/sedes`, `/panel/sedes/nueva`, `/panel/sedes/[id]` | CUBIERTA | Restyle de lista/detalle; mantener reglas Guardian y alcance por sede. | `sede`, horarios, `vinculo_staff_negocio`, RLS. | S | P1 |
| D08 | Políticas | Dueño | Campos en `negocio`; sin ruta de edición dedicada equivalente | PARCIAL | Editor de anticipo, cancelación, tolerancia y no-show con validaciones/efectos. | Columnas de seña/reembolso en `negocio`, reserva y RPC de cancelación. | M | P1 |
| D09 | Pagos | Dueño | `/panel/wallet`; integración de pago por Mercado Pago | PARCIAL | No hay gestión de Wompi/Bre-B ni conexión de pasarela del mockup; no cambiar el proveedor decidido. | `pago`, `wallet`, `wallet_movimiento`, Mercado Pago. | L | P1 |
| D10 | Caja | Dueño | `/panel/pos`, `/panel/pos/caja` | CUBIERTA | Restyle de caja y cierre; validar métodos conforme a reglas y canales existentes. | `venta_producto`, `producto`, `pago`, pipeline POS. | S | P1 |
| D11 | Comisiones | Dueño | Datos de comisión en staff/reportes; sin vista de liquidación | PARCIAL | Configurar porcentaje y liquidar/pagar con historial verificable. | `vinculo_staff_negocio.comision_pct`, `reserva`, reportes; falta liquidación Staff. | L | P1 |
| D12 | Clientes/CRM | Dueño | `/panel/crm`, `/panel/crm/[clienteId]`, segmentos | CUBIERTA | Restyle de lista/ficha; preservar aislamiento multi-tenant y exportación. | `perfil`, `reserva`, `cliente_nota`, `cliente_etiqueta`, `reserva_foto`, RLS. | S | P1 |
| D13 | Inventario | Dueño | `/panel/inventario`, `/panel/inventario/consumo` | CUBIERTA | Restyle del listado/consumos; no cambiar datos de stock o movimientos. | `producto`, `producto_stock`, `movimiento_inventario`, `servicio_producto_consumo`. | S | P1 |
| D14 | Reseñas | Dueño | Sin inbox propio; respuesta/reportado existen en modelo y acciones | PARCIAL | Lista de reseñas del negocio, respuesta y estado leído/no respondido. | `resena`, RPC/políticas de respuesta y reportes. | M | P1 |
| D15 | Marketing | Dueño | `/panel/ads` y `/panel/ia`; sin gestor completo de promociones/WhatsApp | PARCIAL | Campañas a segmentos y envío multicanal con opt-in probado. | `campana_publicitaria`, `wallet`, CRM, `whatsapp_conversacion_lote`; envío WhatsApp depende de credenciales. | L | P2 |
| D16 | Fidelización | Dueño | `/panel/lealtad` | CUBIERTA | Restyle; preservar los módulos de lealtad existentes aunque excedan el prototipo. | Puntos, membresías, gift cards, sellos, referidos, cashback, VIP. | S | P1 |
| D17 | Reportes | Dueño | `/panel/reportes` | CUBIERTA | Restyle móvil y escritorio; mantener exportación/queries reales. | RPCs de reportes, `reserva`, POS, ventas y staff. | S | P1 |
| D18 | Vista de perfil | Dueño | Perfil público `/negocio/[slug]`; no hay modo preview de dueño | PARCIAL | Preview contextual y estado de completitud/fotos/horario editables. | `negocio`, `sede`, `servicio`, `staff`, `resena`, Storage. | M | P2 |
| D19 | Plan/facturación | Dueño | `/panel/suscripcion` | PARCIAL | Suscripción y lifecycle existen; no equiparar nombres/discount Fundador del mockup con planes actuales. | `plan`, `suscripcion`, `pago`; renovación automática recurrente sigue pendiente. | M | P1 |
| D20 | Publicidad | Dueño | `/panel/ads` | PARCIAL | Campañas existen; faltan inventario por zona/espacio y confirmar tarifas/duraciones 3/7/15/30 del prototipo. | `campana_publicitaria`, tarifas de ads, wallet y métricas. | M | P2 |
| D21 | Mi Marca | Dueño | Sin pantalla/configuración equivalente | FALTA | Branding, app/perfil de marca y publicación aislada por negocio. | No hay entidad white-label; propuesta `negocio_marca` con RLS. | L | P2 |

### Dueño escritorio DD03, DD04, DD10, DD12, DD17

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| DD03 | Panel escritorio | Dueño | `/panel` | PARCIAL | Datos del panel existen; falta la composición escritorio específica del prototipo. | Dashboard, reservas, POS, staff, inventario. | M | P1 |
| DD04 | Agenda escritorio | Dueño | `/panel/agenda` | CUBIERTA | Restyle/responsive de la agenda existente. | Reservas, sedes, staff, disponibilidad y ausencias. | S | P1 |
| DD10 | Caja escritorio | Dueño | `/panel/pos/caja` | CUBIERTA | Restyle/responsive; preservar acciones de caja. | POS, `venta_producto`, pagos y cierres. | S | P1 |
| DD12 | Clientes escritorio | Dueño | `/panel/crm` | CUBIERTA | Restyle de CRM existente, con exportación y scoping. | CRM, perfil, reservas, etiquetas, notas, RLS. | S | P1 |
| DD17 | Reportes escritorio | Dueño | `/panel/reportes` | CUBIERTA | Restyle/responsive de reportes existentes. | RPCs de reportes, ventas, reservas, staff. | S | P1 |

### Super Admin A01–A19

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| A01 | Dashboard | Super Admin | `/admin` | CUBIERTA | Restyle; conservar métricas reales, no las cifras de muestra. | RPC `admin_dashboard_resumen`, `negocio`, `suscripcion`, `reserva`. | S | P2 |
| A02 | CRM de negocios | Super Admin | `/admin/negocios` | CUBIERTA | Restyle de revisión/ciclo de vida. | `negocio`, `suscripcion`, RPCs de aprobación/suspensión, auditoría. | S | P2 |
| A03 | Usuarios | Super Admin | No hay gestión de usuarios equivalente | FALTA | Búsqueda, detalle y solicitudes ARCO/privacidad. | `auth.users`, `perfil`, reservas; falta superficie y política de producto. | L | P2 |
| A04 | Catálogo global | Super Admin | Servicios por negocio en `/panel/servicios`; no hay admin global | FALTA | Administrar catálogo global y su relación con catálogo de negocio. | `servicio` es por negocio; falta catálogo global confirmado. | L | P2 |
| A05 | Planes/precios por país | Super Admin | Parte de planes en `/admin/configuracion` | PARCIAL | Precios localizados por país/addons y nombres/reglas del prototipo contradicen catálogo actual. | `plan`, `suscripcion`, `ciudad_habilitada`, configuración global. | M | P2 |
| A06 | Promociones/Plan Fundador | Super Admin | Sin módulo de promociones de fundador | FALTA | Cupos, descuento, ventana y auditoría del Plan Fundador. | No se encontró entidad de campaña de fundador; no inferir precio ni duración. | L | P2 |
| A07 | Publicidad | Super Admin | Tarifas/métricas dentro de `/admin/configuracion` | PARCIAL | Administración del inventario y revisión de campañas, no solo configuración de precios. | `campana_publicitaria`, tarifas, wallet y métricas Ads. | M | P2 |
| A08 | Contenido | Super Admin | Banners dentro de `/admin/configuracion` | CUBIERTA | Restyle; la capacidad de banners está conectada, aunque consolidada. | `banner_home`, almacenamiento de imagen y RLS SuperSU. | S | P2 |
| A09 | Traducciones | Super Admin | Sin módulo ni i18n en cliente | FALTA | Traducción y publicación ES/EN/PT; decidir si usar catálogos estáticos o administrables. | No hay next-intl ni tablas de traducción. | L | P2 |
| A10 | Plantillas de mensajes | Super Admin | Sin editor equivalente | FALTA | Editor por canal, idioma, evento y aprobación de templates. | `notificacion_envio`; no se encontró tabla de plantillas. | M | P2 |
| A11 | Legal | Super Admin | Textos legales en `/admin/configuracion` | PARCIAL | Gestión por país/idioma, versión, vigencia y reconsentimiento completo. | `texto_legal`, `aceptacion_legal`, `publicar_texto_legal`. | M | P2 |
| A12 | Países | Super Admin | Ciudades dentro de `/admin/configuracion` | FALTA | Configuración de países, monedas, pasarelas, impuestos y zonas horarias. | `ciudad_habilitada`; no hay entidad de país/configuración regional. | L | P2 |
| A13 | Funciones/feature flags | Super Admin | Tabla `feature_flag`; sin pantalla equivalente | FALTA | Editor y asignación por plan/país/negocio con auditoría. | `feature_flag`, `plan_funcion_ia`, RLS/funciones existentes. | M | P2 |
| A14 | Moderación | Super Admin | `/admin/moderacion` | PARCIAL | La cola actual es de reseñas; faltan fotos, apodos, anuncios y contenido. | `resena`; otras colas de moderación no están modeladas. | M | P1 |
| A15 | Soporte | Super Admin | `/admin/soporte`, `/admin/soporte/[id]` | CUBIERTA | Restyle y vistas de datos reales. | `ticket_soporte`, `ticket_mensaje`, RLS/acciones SuperSU. | S | P1 |
| A16 | Salud/alertas | Super Admin | Sin consola de salud del sistema | FALTA | Métricas operativas, umbrales, alertas y estado de integraciones. | No hay observabilidad/alertas equivalente identificada. | L | P2 |
| A17 | Datos/insights | Super Admin | KPIs de `/admin`; no hay analítica agregada anonimizada | PARCIAL | Consultas por dominio y umbral de anonimización del prototipo. | `admin_dashboard_resumen`, reportes; falta modelo de insights. | L | P2 |
| A18 | Equipo interno | Super Admin | Sin administración de equipo/permisos | FALTA | Roles internos, MFA y permisos granulares. | `perfil.es_supersu`; no hay equipo/roles admin internos. | L | P2 |
| A19 | Auditoría | Super Admin | `/admin/auditoria` | CUBIERTA | Restyle y filtros; no alterar inmutabilidad/eventos. | `evento_auditoria`, RLS SuperSU y acciones admin. | S | P1 |

### Web W01–W02

| Código | Pantalla | Rol | Ruta/archivo actual equivalente | Estado | Qué falta | Dependencias de backend | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| W01 | Landing para negocios | Visitante/dueño | No hay landing B2B equivalente; `/onboarding` es onboarding de Cliente | FALTA | Landing de captación, planes y enlaces al alta con mensajes aprobados. | `plan`, `suscripcion`, onboarding; no requiere tabla nueva para la landing. | L | P1 |
| W02 | Perfil web público | Visitante/cliente | `/negocio/[slug]` | CUBIERTA | Restyle y optimización web; conservar SEO y lectura pública controlada. | `negocio`, `sede`, `servicio`, `staff`, `resena`. | S | P0 |

## Lo que la app ya tiene y el prototipo no cubre

No se recomienda retirar ninguna ruta ni capacidad. La recomendación es conservarla y darle el sistema visual nuevo; cuando una capacidad sea parte de una vista más amplia del prototipo, fusionar solo la presentación y mantener su URL/acciones.

| Ruta/función actual | No aparece como pantalla equivalente | Recomendación |
|---|---|---|
| `/panel/ia`, `/admin/ai` | AI OS, créditos, prompts, memoria y costo IA | Conservar; integrarlo en Marketing/Insights sin ocultar el control de costos. |
| `/panel/wallet` y transacciones del negocio | Wallet operativo del negocio | Conservar como Pagos/Wallet; no mezclar con saldo del Cliente. |
| `/panel/auditoria`, `/admin/auditoria` | Eventos de auditoría en las vistas de negocio y admin | Conservar con vistas separadas por alcance; nunca reducir historial/inmutabilidad. |
| `/panel/soporte`, detalle de ticket, `/admin/soporte` | Flujo de soporte completo solo parcialmente representado | Conservar; fusionar solo la navegación y mantener detalle/historial. |
| `/panel/inventario/consumo` | Configuración de consumo de producto por servicio | Conservar como subvista de Inventario. |
| `/panel/servicios/combos/*` | Editor/gestión de combos | Conservar en Catálogo/Servicios. |
| `/panel/pos/productos`, caja y checkout POS | Operaciones de venta detalladas | Conservar bajo Caja; no reemplazar por la vista resumida de caja. |
| `/panel/crm/segmentos`, `/panel/crm/[clienteId]` | Constructor de segmentos y detalle extendido CRM | Conservar dentro de Clientes/CRM. |
| `/panel/staff/[id]`, invitaciones y gestión por sede | Detalle de Staff/roles/alcance | Conservar dentro de Equipo. |
| `/staff/nivel`, `/staff/lealtad`, `/staff/perfil` | Lealtad y nivel del profesional no están completos en sus tabs | Conservar; integrar en navegación profesional manteniendo sus reglas. |
| `/membresias/*`, `/checkout/membresia/*` | Gestión/historial/checkout de membresía | Conservar dentro de Fidelización y Cuenta; no quitar rutas profundas. |
| `/gift-cards/comprar`, `/canjear`, `/mis` | Compra/canje/gestión extendidos | Conservar dentro de Puntos y gift cards. |
| `/legal/[slug]`, `/legal/aceptar` | Aceptación/versiones legales obligatorias | Conservar y enlazar desde Privacidad; no fusionar aceptación obligatoria con opt-ins. |
| `/auth/callback`, recuperación y cambio de contraseña | Retornos técnicos de auth | Conservar sin navegación visible salvo los pasos del usuario. |
| `/reserva/[id]/ics`, API de pagos/webhooks y APIs de CRM/reportes/IA | Rutas técnicas sin pantalla 1:1 | Conservar endpoints, callbacks e invariantes; no reemplazar por hrefs del prototipo. |
| Exports de CRM/reportes en CSV/PDF/XLSX | Exportación operativa fuera del mockup | Conservar; enlazar desde las vistas nuevas donde aplique. |

## Navegación: prototipo → rutas reales

Los archivos del prototipo enlazan entre sí por nombre de HTML. La tabla siguiente traduce los grupos de destino a rutas de la aplicación. “Sin destino” indica que el enlace del prototipo no tiene una ruta/función equivalente hoy, aunque su href HTML exista.

| Enlace/flujo prototipo | Ruta real equivalente | Estado del destino |
|---|---|---|
| G02 → G03 → G04 → G05 | `/onboarding` → `/login` | Parcial; falta permisos/idioma como pasos independientes. |
| G05 → G06 → G07 | `/login` (OTP/alta implícita) | Parcial; G06/G07 no tienen ruta propia; Google existe, Apple no. |
| G05 → G08 | `/login/recuperar` | Destino existente. |
| G05/G06 → G09 por rol | No hay selector; auth deriva el contexto y redirige | Sin destino equivalente; no cambiar la asignación de rol. |
| G10 → C01 | Prompt de instalación integrado → `/` | Parcial; no existe G10 como pantalla. |
| Tabbar cliente: Explorar → Mapa → Citas → Favoritos → Perfil | `/` → `/?vista=mapa` → `/mis-reservas` → `/favoritos` → `/perfil` | El app tabbar actual es Inicio/Citas/Favoritos/Lealtad/Perfil: Mapa está en Inicio; Lealtad reemplaza un tab del prototipo. |
| C01 → C03/C03b | `/` con filtros/query params | Lista y filtros comparten página; no hay rutas C03/C03b. |
| C02 → C04 | `/?vista=mapa` → `/negocio/[slug]` | Destino existente. |
| C03 → C04/C05 | `/` → `/negocio/[slug]`; profesional solo embebido | C04 parcial; C05 no tiene destino individual. |
| C04 → C06 → C07 → C08 | `/negocio/[slug]` → `/negocio/[slug]/reservar` | Pasos 1–3 son estado del mismo flujo, no rutas separadas. |
| C08 → C09 → C10 → C11 | Flujo → `/reserva/[id]/pago` → `/reserva/[id]` | Rutas existentes; métodos y reglas de precio/pago del prototipo no se trasladan automáticamente. |
| C11/C13 → C14 | `/mis-reservas` → `/reserva/[id]` | Destino existente. |
| C12, fila Cliente | Acción `unirseListaEspera` desde reserva; sin detalle de turno | Sin ruta de seguimiento/posición; backend `lista_espera` sí existe. |
| C15 → publicar reseña | No hay ruta/formulario cliente | Sin destino UI; `resena` y restricciones de reserva completada existen. |
| C16/C17/C18/C19/C21/C22 | `/favoritos`, `/lealtad`, `/gift-cards/*`, `/perfil` | Parcial; el prototipo agrupa en pantallas distintas y expone datos que hoy no todos tienen vista. |
| C20 Chat | No existe ruta de chat por reserva | Sin destino; tickets de soporte no son chat. |
| C24/C25 | No existe ruta de beneficios de terceros ni Mi Marca | Sin destino. |
| G11/G13/G15/G16/G17 | Sin centro de notificaciones, soporte Cliente, eliminación/cookies/privacidad | Sin destinos completos; solo hay envíos/notificaciones, soporte de negocio y aceptación legal parcial. |
| W01 → D01/D02 | No hay landing B2B; `/panel/onboarding` requiere auth | W01 sin destino; D01/D02 tienen equivalentes dentro del panel. |
| W02 → C04/C06 | `/negocio/[slug]` → `/negocio/[slug]/reservar` | Destino existente. |
| Tabbar profesional: Hoy/Agenda/Clientes/Ingresos/Perfil | `/staff` redirige a `/staff/agenda`; `/staff/agenda`, `/staff/clientes`, `/staff/nivel`, `/staff/perfil` | Hoy no es dashboard; Ingresos no tiene ruta equivalente; `nivel` y `lealtad` sí tienen rutas que el prototipo no tabula igual. |
| B01 invitación → aceptar | `/invitacion/[id]` | Ruta real; faltan datos/acciones de perfil público y portafolio. |
| D tabs: Panel/Agenda/Equipo/Caja/Más | `/panel`, `/panel/agenda`, `/panel/staff`, `/panel/pos`, sin `/panel/mas` | Los cuatro módulos existen; Más se resuelve hoy con navegación de módulos, no por una ruta móvil. |
| D05–D21, menú Más | Rutas `/panel/servicios`, `/sedes`, `/staff`, `/wallet`, `/crm`, `/inventario`, `/lealtad`, `/reportes`, `/suscripcion`, `/ads` | Varios destinos existentes; Políticas/Reseñas/Marketing/Mi Marca no tienen vista dedicada equivalente. |
| Tabbar escritorio DD03/DD04/DD10/DD12/DD17 | `/panel`, `/panel/agenda`, `/panel/pos/caja`, `/panel/crm`, `/panel/reportes` | Destinos existentes; hoy comparten layouts responsivos, sin equivalentes DD separados. |
| Navegación Super Admin A01–A19 | `/admin`, `/admin/negocios`, `/admin/moderacion`, `/admin/soporte`, `/admin/auditoria`, `/admin/configuracion`, `/admin/lealtad`, `/admin/ai` | 8 destinos consolidados; Usuarios, Catálogo global, Traducciones, Países, Salud y Equipo interno no tienen destino. |

## Brechas de datos y migraciones aditivas propuestas

“Existe” significa que se encontró modelo/lógica en el código/migraciones; no asegura que todo el flujo UI esté completo. No se propone ejecutar migraciones en esta fase.

| Dato/capacidad del prototipo | Estado real en BD/código | Propuesta aditiva (solo si se aprueba) |
|---|---|---|
| Niveles Staff PRO/EXPERT/MASTER | Existe `puntaje_staff_evento`, `temporada`, `nivel_staff_consolidado` y RPC `staff_mi_nivel_actual`; cálculo oficial en reglas de negocio. | No crear tablas de nivel. La tabla actual `servicio.precio_base` no soporta precios por nivel; si se confirma esa regla, agregar `servicio_tarifa_nivel` con vigencia y RLS por negocio, reutilizando el snapshot de precio de la reserva. No cambiar precios sin aprobación. |
| Puntos/recompensas | Existen `punto_fidelizacion`, `lealtad_wallet`, `lealtad_movimiento`, reglas/recompensas y pantallas de lealtad. | No crear un segundo modelo de puntos. Revisar paridad de la UI y reglas de canje. |
| Fila virtual | Existe `lista_espera`, `lista_espera_estado`, índices y RLS; el Cliente puede unirse desde el flujo. | No crear tabla duplicada. Completar UI/posición/notificaciones y acciones autorizadas para Staff/negocio. |
| Publicidad | Existen `campana_publicitaria`, métricas, wallet y tarifas/configuración. | Si la reserva por cupo/zona/fecha del prototipo necesita bloqueo de inventario, crear `inventario_publicitario_slot` con RLS: SuperSU administra; negocio consulta/solicita solo sus slots vía acción/RPC. Confirmar primero el significado de 3/7/15/30 días. |
| Mi Marca/white-label | No se encontró tabla/campos de marca por negocio; el perfil público es estándar. | Crear `negocio_marca` (negocio, logo, colores, dominio/estado/configuración aprobada) con RLS: dueño escribe su propio tenant; lectura pública solo de marca activa. Definir si implica subdominio, PWA o solo perfil antes de diseñar columnas. |
| Comisiones | Existe `vinculo_staff_negocio.comision_pct`, métricas de comisión y wallet del negocio. No se encontró historial de liquidación/pago de comisión a Staff. | Si el flujo D11/B12 se aprueba, agregar `liquidacion_staff` y `liquidacion_staff_detalle`, RLS por negocio y Staff propio, mutaciones por RPC auditada. No confundir comisión de plataforma con comisión de Staff. |
| Consentimientos A1–A9 | Existe `aceptacion_legal` versionada y `perfil.consentimiento_datos_at`; `reserva_foto` requiere su booleano. No existe historial por propósito/destinatario. G17 solo identifica explícitamente A3, A4, A5 y A6. | Agregar tabla append-only `consentimiento_datos` con usuario, propósito A1–A9, versión, estado, instante/canal, destinatario y categorías compartidas cuando corresponda. Sin default de aceptación; registrar solo después de acción explícita. RLS de lectura propia y escritura mediante Server Action/RPC que vincule `auth.uid()`; retiro como nuevo evento. Definir primero el significado de A1/A2/A7/A8/A9. |
| Valor heredado `consentimiento_marketing` | La columna de `perfil` tiene `default true`; no se encontraron referencias en `src`. No representa consentimiento explícito verificable ni autorización de terceros. | No reutilizarla para A5 ni cambiarla en esta fase. Confirmar su semántica antes de cualquier migración; la tabla de consentimientos nueva debe iniciar sin concesiones. |
| Perfil para beneficios de marca | `perfil` tiene email/fecha de nacimiento, pero no se halló tipo de cabello ni permiso por marca. | No recolectar campos adicionales hasta justificar finalidad y consentimiento. Si los beneficios lo requieren, agregar preferencias separadas y minimizadas; no inferir edad desde fecha de nacimiento para terceros sin permiso explícito. |
| Servicios del catálogo global | `servicio` pertenece a negocio; existe configuración de servicios por negocio, pero no se encontró entidad de catálogo global administrable. | Si el catálogo global no borrable es una regla aprobada, agregar `catalogo_servicio_global` con RLS de escritura SuperSU/lectura pública y, opcionalmente, una FK nullable nueva en `servicio`; no reinterpretar los registros existentes sin plan de mapeo. |
| Membresías, gift cards y referidos | Hay modelos y páginas de membresía/gift card/lealtad; flujos actuales deben mantenerse como fuente de verdad aunque el mockup sea distinto. | Ninguna tabla duplicada; validar compra/canje y estado real de los checkout. |
| Wallet/saldo/métodos de pago de Cliente | `wallet` corresponde al negocio; hay pagos y reembolsos por reserva, no se halló wallet/métodos guardados del Cliente como en C19. | No almacenar datos de tarjeta. Definir primero si el saldo reembolsable es una obligación de producto y cómo lo representa Mercado Pago; después evaluar un ledger de saldo de Cliente con RLS propia. |
| Chat de reserva | `ticket_soporte`/`ticket_mensaje` cubren soporte, no conversaciones Cliente-negocio. | Si C20 se aprueba, agregar `conversacion_reserva` y `mensaje_chat`; RLS limitado a participantes derivados de la reserva, con mensajes append-only y mutaciones validadas en servidor. |
| Bandeja de notificaciones | `notificacion_envio` registra envíos; no equivale a inbox con estado leído/acción del usuario. | Si se requiere G11, agregar `notificacion_usuario` con RLS por propietario y referencia de destino validada en servidor. |
| Locale de usuario | No hay `locale` en `perfil` ni sistema i18n instalado. | Tras elegir locales y estrategia, usar catálogos de traducción; añadir columna opcional `perfil.locale` solo si se debe persistir preferencia. Es aditivo. |
| Plan Fundador | No se encontró implementación de cupos/descuento/duración de la campaña del prototipo. El catálogo y la estrategia actuales usan Raven/Jarl/Valhalla/Allfather. | No renombrar planes ni modificar precio. Definir la oferta con Producto; después modelar una promoción/cupo aditiva si la regla se aprueba. |

**Regla RLS para toda tabla nueva:** `ENABLE ROW LEVEL SECURITY`, políticas de mínimo privilegio y pruebas de aislamiento por Cliente/Staff/Guardian/Barbería/SuperSU. Las funciones `SECURITY DEFINER` nuevas deberán validar identidad, tenant y acción dentro del servidor. No cambiar/eliminar tablas, columnas ni tipos existentes.

## Conflictos que requieren aprobación

| Tema | Código/regla actual | Prototipo | Decisión que no debe inferir desarrollo |
|---|---|---|---|
| Rol | Rol derivado desde Auth/relaciones; guards y RLS son autoridad. | Selector de Cliente/Profesional/Dueño. | Confirmar si será solo un selector de contexto disponible para roles existentes o si se omite. No permitir asignarse un rol desde UI. |
| Planes/Fundador | Estrategia actual: Raven/Jarl/Valhalla/Allfather, límites y precios definidos en documentación de monetización. | Listado/Essential/Studio/Prestige/Signature y 40 % por 6 meses con cupos. | Aprobación comercial de nombre, precio, límites, país, cupos, duración y elegibilidad. Mantener el catálogo actual hasta entonces. |
| Precio por nivel Staff | `servicio.precio_base` y precio congelado en reserva; los niveles afectan ranking/beneficios/comisión configurable, no el precio mostrado del servicio en el esquema actual. | Cada servicio muestra precio distinto PRO/EXPERT/MASTER y “el precio cambia”. | Confirmar si se introduce regla de precio por nivel. Si no, conservar precios por servicio y cambiar solo presentación. |
| Pasarela/métodos | Mercado Pago Checkout Pro es la integración y decisión documentada; cobro recurrente de suscripción tiene limitaciones conocidas. | Wompi, Bre-B, tarjeta guardada y métodos locales seleccionables. | Confirmar qué textos visuales son ilustrativos. No integrar pasarelas ni almacenar métodos por imitación del mockup. |
| Consentimientos | Tratamiento legal requerido se registra; marketing heredado tiene columna con default true sin uso actual. | Propósitos individuales y permiso A5 opcional para marcas. | Aprobar definiciones A1–A9, finalidad/datos/terceros y retención. El permiso a terceros debe ser independiente, explícito, opcional y sin selección previa. |
| Locales | App fija español y no tiene `next-intl`. | ES/EN/PT en onboarding, sitio y privacidad. | Confirmar locales y alcance de traducción antes de presentar la selección como funcional. |
| Caja/comisiones | POS y comisiones actuales siguen las reglas propias del negocio; no toda visualización equivale a liquidación de Staff. | Liquidar comisión desde una pantalla y pagos/métodos específicos. | Confirmar quién inicia/paga, cuándo se liquida y qué ledger debe quedar. |

## Plan recomendado después de aprobar

1. **Fase 2 — Sistema visual:** incorporar tokens a Tailwind/CSS, Archivo y Space Mono vía `next/font`, tema claro/oscuro y componentes reutilizables; conservar rutas, componentes de datos y funciones existentes. Sin librerías nuevas mientras las actuales cubran el caso.
2. **Fase 3 — Cliente P0:** ingreso/registro/recuperación y consentimiento legal → home/lista/mapa/filtros → perfil de negocio → reserva → pago → mis citas/detalle. Primero resolver las decisiones de selector de rol, pagos, precio por nivel y A1–A9.
3. **Fase 3 — superficies existentes P1:** profesional, fidelización, CRM, agenda, caja, inventario, sedes, suscripción y reportes. Aplicar restyle sobre acciones/queries/guards reales; datos de ejemplo del prototipo nunca pasan a producción.
4. **Fase 4 — brechas aprobadas:** soporte Cliente, notificaciones, privacidad, reseñas, chat, white-label, liquidaciones, inventario publicitario y superficies Super Admin ausentes. Solo migraciones aditivas con RLS, en el orden de prioridad acordado.
5. **Fase 5 — gates:** build/lint/typecheck/tests; configurar Playwright y usuarios de prueba; probar 360/390/1280/1440, desbordes, skeleton/vacío/error/offline, flujos autenticación/reserva/pago/cancelación/invitación/alta/plan/admin y capturas comparativas contra cada HTML.

### Decisiones para cerrar antes de implementar las brechas

- Confirmar qué significan los consentimientos A1/A2/A7/A8/A9; el prototipo solo nombra A3–A6.
- Confirmar si se descarta o se limita el selector de rol a cambio de contexto para identidades ya autorizadas.
- Confirmar si el plan Fundador y los nuevos nombres/precios sustituyen la estrategia actual o son solo contenido de referencia.
- Confirmar si se desea precio del servicio distinto por nivel Staff.
- Confirmar que Mercado Pago sigue siendo el único flujo de pago en app; definir si el resto de métodos del prototipo son texto ilustrativo.
- Confirmar si se aprueban Chat, Mi Marca y liquidaciones de comisión, y sus reglas de datos/retención.
- Confirmar locales de producto y si se construirá traducción administrable o catálogos versionados en código.

## Punto de parada

Fase 1 entregada. No se cambiaron componentes, rutas, autenticación, lógica, tablas, migraciones ni archivos del prototipo. No continuar a Fase 2–5 hasta aprobación de esta auditoría y de las decisiones anteriores.