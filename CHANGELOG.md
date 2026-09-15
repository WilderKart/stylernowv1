# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada de módulo referencia su commit y el ítem correspondiente en
`StylerNow_Project_Bible_V3/00_MASTER_TASKLIST.md`, que es el detalle vivo
— este archivo es el resumen cronológico, no repite el detalle técnico.

## [No liberado]

### Corregido — Vulnerabilidad de seguridad crítica: `aplicar_evento_pago()` invocable por cualquier usuario autenticado
**El hallazgo más grave de todo el proyecto hasta la fecha.** `revoke all on function ... from public;` (usado desde la migración 008, Fase 1, para restringir la función que confirma pagos y Reservas a llamadas server-to-server con `service_role`) nunca bloqueó realmente a los roles `anon`/`authenticated` — Supabase les otorga privilegios de ejecución de forma independiente de `PUBLIC`. Cualquier usuario autenticado de la plataforma podía llamar `aplicar_evento_pago()` directamente con un `p_pago_id` arbitrario y `p_estado='APROBADO'`, **confirmando cualquier Reserva pendiente de pago sin haber pagado realmente** — un vector de fraude financiero real y activo en producción. Corregido revocando explícitamente de `anon, authenticated` en las 3 funciones del proyecto que dependían de este patrón sin chequeo de autorización propio. Ninguna otra RPC del proyecto está expuesta de la misma forma. `11c9e7a`

### Añadido — Fase 6, Módulo 6.1: Wallet — comisión de plataforma real
`wallet`/`wallet_movimiento` existían desde la migración 003 y
`handle_new_negocio()` crea la fila de cada Negocio automáticamente
desde la migración 007 — pero cero filas se insertaron jamás en
`wallet_movimiento` ni ningún `UPDATE` tocó `saldo_disponible` en toda
la base de código. `aplicar_evento_pago()` extendida para acreditar el
monto neto (seña − comisión) al Wallet en cada pago aprobado; nueva
`revertir_comision_wallet()` revierte proporcionalmente en reembolsos
totales/parciales, conectada en los 3 lugares donde un pago pasa a
reembolsado. Nueva pantalla `/panel/wallet` (Barbería) con saldo y
movimientos — la RLS que la protege ya existía desde la migración 006
sin ninguna pantalla que la usara. Verificado: 14/14 casos reales.
`11c9e7a`

### Añadido — Fase 5, Módulo 5.3: Marketplace — Mapa visual (cierra la Fase 5)
`<MapaMarketplace>` con MapLibre GL JS (paquete nuevo) y tiles crudos de
OpenStreetMap — toggle Lista/Mapa en el Home con estado en la URL
(`?vista=mapa`), un pin por Negocio geolocalizado con popup (nombre,
rating, precio, link al perfil), pin distinto para la propia ubicación
del Cliente si activó "Cerca de mí" (Módulo 5.2). `marketplace_buscar()`
se extendió con `sede_latitud`/`sede_longitud` — Postgres no permite
`create or replace function` para cambiar el `RETURNS TABLE` de una
función existente (error explícito, distinto de la sobrecarga silenciosa
de ADL-020/ADL-021 al agregar parámetros), corregido con `drop function`
+ `create function`. Se re-verificó la suite completa del Módulo 5.2
(14/14) tras el cambio — cero regresiones. **Con este módulo, la Fase 5
— Marketplace Premium queda completa** en todo lo especificado por la
Biblia. Nota honesta: sin navegador disponible en este entorno para
confirmar visualmente el renderizado WebGL de tiles/pines tras la
hidratación — verificado hasta donde `curl`/build/tsc pueden alcanzar.
`a464e9a`

### Añadido — Fase 5, Módulo 5.2: Marketplace — Destacados/Ranking (Score de 6 componentes)
Implementa la fórmula completa de `08-Growth-Monetization/01_Marketplace_
Algorithm.md`, reemplazando el orden ad-hoc que `marketplace_buscar()`
usaba desde la migración 013: Rating bayesiano (12 meses, regresionado al
promedio de plataforma), Proximidad real (nuevo chip "Cerca de mí" en el
Home, auto-expansión de radio 10-50km), Disponibilidad (7 días,
reutilizando `slots_disponibles()`), Conversión (tabla nueva
`negocio_visita_perfil` + `registrar_visita_perfil()`, conectada en el
perfil público), Calidad de Staff y Patrocinio (honestamente en 0 hoy,
sin datos fabricados). Nueva `marketplace_mi_posicion()` expone solo un
rango aproximado (nunca el Score exacto), en `/panel/reportes`.
**Bug más grave encontrado por la prueba end-to-end** (probando con el
cliente `anon` real, no `service_role`): la función no era `SECURITY
DEFINER`, así que corría con la RLS del visitante anónimo — Patrocinio y
Calidad de Staff siempre daban 0 sin importar los datos reales, y la
prueba de Conversión pasaba por coincidencia con el desempate por
antigüedad. Corregido junto con otros 4 bugs de tipos/ambigüedad SQL, en
5 migraciones forward sucesivas. Verificado: 14/14 casos reales con el
cliente `anon`. `433bd5f`

### Añadido — Fase 5, Módulo 5.1: Marketplace — Favoritos + Compartir
`favorito_negocio` (nueva, sin límite de cantidad, RLS autosuficiente sin
RPC) conectada en el perfil público del Negocio y una página nueva
`/favoritos`. Compartir reutiliza el `slug` ya indexado por SEO — Web
Share API en móvil, portapapeles como respaldo. SEO avanzado (metadatos,
Open Graph, JSON-LD schema.org) ya estaba construido de una fase
anterior, se confirma sin duplicar. Verificado: 6/6 casos reales.
**Incidente encontrado durante la verificación, sin ser un bug de
producto**: la limpieza de varios scripts de prueba de esta sesión (POS,
Comisión, Soporte, App Staff, Favoritos) dejaba negocios de prueba
`ACTIVO` reales en la base de datos por no borrar su `wallet` antes
(sin `ON DELETE CASCADE` a propósito) — 7 negocios de prueba detectados y
limpiados manualmente, guardado como lección persistente para scripts
futuros. `53ed2ab`

### Añadido — Fase 4: App Staff (cierra la Fase 4)
Superficie propia `/staff` (Agenda, Mi Nivel, Clientes, Perfil), guarda
independiente de `resolverContexto()` para que una persona que es
Barbería y Staff a la vez tenga ambas superficies accesibles.
**Hallazgo real**: el sistema completo de Nivel PRO/EXPERT/MASTER llevaba
desde la Fase 1 sin insertar jamás una fila — cero temporadas, cero
eventos de puntaje. Este módulo lo enciende: check-in/check-out
(`EN_CURSO`/`checkin_at`/`checkout_at` existían desde las migraciones 001
y 003 sin ninguna RPC que los usara) penaliza Puntualidad; completar la
venta en Caja (`completar_venta_pos()`, extendida una tercera vez) otorga
Producción; un trigger nuevo en `resena` otorga Calidad por 5 estrellas.
"Mis Ganancias" extiende `reportes_ranking_staff()` (2.10) con
auto-servicio en vez de duplicar la fórmula de comisión. Disponibilidad y
Ausencias no necesitaron ninguna migración — la RLS de auto-servicio ya
existía desde el Módulo 1 sin usar. **Dos bugs reales encontrados por la
prueba end-to-end**: extender una función con un parámetro nuevo no
reemplaza la sobrecarga vieja en Postgres (rompía
`dashboard_ranking_staff_semana`), y un segundo check-out pisaba
`checkout_at` en silencio — ambos corregidos en una migración nueva.
Verificado: 23/23 casos reales. `ace5b3d`

### Añadido — Fase 3, Módulo 3.3: SuperSU — Soporte + Auditoría (cierra la Fase 3)
Tickets de soporte (`ticket_soporte`/`ticket_mensaje`, nuevos): crear/ver/
responder un ticket propio para Barbería (`/panel/soporte`) y gestión
completa de la cola con cambio de estado para SuperSU (`/admin/soporte`).
Todo write pasa por una RPC `SECURITY DEFINER` — el `actor_tipo` de cada
mensaje se resuelve siempre en servidor, nunca lo manda el cliente.
Responder un ticket ya resuelto lo reabre automáticamente. Visor de
Auditoría (`/panel/auditoria` para Barbería, `/admin/auditoria` para
SuperSU): `evento_auditoria` se puebla desde la Fase 1 pero nunca tuvo
pantalla — tampoco se necesitó ninguna migración para leerla, la RLS que
la scopea ya existía sin usar desde la migración 006. **Con este módulo,
la Fase 3 — SuperSU CMS queda cerrada** (salvo Marketplace/anuncios,
diferido a Fase 6). Verificado: 17/17 casos reales, sin bugs encontrados.
`6ce6975`

### Añadido — Fase 3, Módulo 3.2: SuperSU — Configuración global
Comisión de plataforma (antes una columna por Negocio que en la práctica
actuaba como constante fija, ahora un valor global real que
`actualizar_comision_plataforma_global()` propaga de inmediato a todos los
Negocios), ciudades habilitadas (oculta un Negocio del Marketplace sin
tocar su `estado` — distinto de suspenderlo), banners del Home (con RLS
pública por vigencia/activo, conectados de verdad en `/`), edición de
Planes SaaS, y publicación versionada de textos legales.
**Segundo hallazgo real de esta fase**: el mecanismo de "re-aceptación
forzada" ante un cambio legal material nunca existió — el código aceptaba
en silencio la versión vigente en cada login sin importar el flag
`cambio_material`. Se corrigió con una pantalla de bloqueo nueva
(`/legal/aceptar`) que exige aceptación explícita antes de continuar.
**Bug real encontrado por la prueba end-to-end**: Supabase rechaza todo
`UPDATE` sin `WHERE` incluso dentro de una función `SECURITY DEFINER`
("UPDATE requires a WHERE clause") — corregido en una migración nueva
(028), sin tocar la 026 ya aplicada. Verificado: 26/26 casos reales.
`82cc14c`

### Añadido — Fase 3, Módulo 3.1: SuperSU — Dashboard global + Gestión de Negocios
Nueva superficie `/admin`, completamente separada del Panel Negocio (guarda
propia `requireSuperSU()`, nunca pasa por `resolverContexto()`).
**Hallazgo crítico**: no existía ninguna forma de aprobar un Negocio — todo
registro quedaba atascado en `PENDIENTE_APROBACION` para siempre. Se
construyeron las transiciones completas de la máquina de estados
(`aprobar_negocio`, `rechazar_negocio`, `suspender_negocio`,
`reactivar_negocio_supersu`, `cancelar_negocio_supersu`), reutilizando
`cancelar_reserva()` para el reembolso 100% en cascada al suspender/cancelar,
sin duplicar esa lógica. También se cerró el ciclo de moderación de reseñas
reportadas (`reportar_resena()` desde `/panel/reportes`, `moderar_resena()`
desde `/admin/moderacion`) — un bug real de tipos (CASE sin castear al enum
`resena_estado`) se encontró con la prueba end-to-end y se corrigió en una
migración nueva (025), nunca editando la 024 ya aplicada. Verificado: 18/18
casos reales. `9fbc82a`

### Añadido — Fase 2, Módulo 2.10: Reportes (cierra la Fase 2)
Ingresos por semana/mes (gráfico de barras real), servicios más vendidos,
ranking de Staff con rango de fechas real, reseñas recibidas con
respuesta pública. `dashboard_ranking_staff_semana` (2.2) se refactorizó
para delegar en `reportes_ranking_staff()` en vez de duplicar la fórmula
de comisión — re-verificada su suite completa (15/15) tras el cambio, sin
regresiones. Responder reseñas no necesitó ninguna migración: la columna
y la política ya existían desde el Módulo 1 sin uso. Verificado: 10/10
casos reales. **Con este módulo, los 10 dominios de la Fase 2 (2.1-2.10)
quedan cerrados — una Barbería puede operar su negocio completo dentro de
StylerNow.** `0969266`

### Añadido — Fase 2, Módulo 2.9: Inventario
Inventario no tenía documento de reglas de negocio en la Biblia (ADL-009
lo había marcado como Decisión abierta) — esta migración formaliza el
diseño completo (`ADR_009_Inventario_Stock_Por_Sede.md`, ADL-014):
`producto_stock` lleva el conteo por (Producto, Sede), nunca una cantidad
única a nivel Negocio, consistente con el alcance de Sede que la matriz
de Roles ya le daba a Guardian. Todo movimiento pasa por
`registrar_movimiento_inventario()`/`ajustar_stock()` y deja rastro en
`movimiento_inventario`. Conectado de verdad con POS: `completar_venta_pos()`
ahora también descuenta stock, tanto por venta directa de Productos como
por consumo automático configurado por Servicio
(`servicio_producto_consumo`) — se re-verificó la suite completa de POS
(14/14) tras el cambio. Solicitud de reposición, stock mínimo con alerta
en tiempo real, "Configurar reglas" exclusivo de Barbería. Verificado:
20/20 casos reales. `19c609e`

### Añadido — Fase 2, Módulo 2.8: POS
`completar_venta_pos()`: registra Productos vendidos durante la atención,
canjea Puntos de fidelización (FIFO, nunca bajo $0), cobra el Saldo
restante (efectivo/datáfono propio), registra Propina, marca la Reserva
COMPLETADA y otorga Puntos nuevos — todo en una sola transacción.
**Hallazgo real de producción**: el sistema de Puntos de fidelización
tenía tabla y RLS desde el Módulo 1 pero nunca otorgaba Puntos — esta es
la primera vez que se activa de verdad. `cierre_caja_dia()` da el
resumen efectivo/digital/total del día. Catálogo de Productos simple
(`/panel/pos/productos`). Verificado: 14/14 casos reales, incluyendo el
canje FIFO exacto y que el saldo nunca queda negativo. `5d2c07e`

### Añadido — Fase 2, Módulo 2.7: CRM
Listado (foto, nombre, visitas, LTV, última visita, etiquetas) con
búsqueda/filtro/orden/paginación real. `vista_crm_cliente` calcula LTV =
Ticket promedio × frecuencia anual × 2 (`01-PRD/05_KPIs.md`) en un único
lugar. Etiqueta "VIP" dinámica (nunca guardada, así nunca queda "pegada"
tras un reembolso). Ficha de Cliente completa: resumen, Puntos de
fidelización reales, servicio favorito/Staff preferido, historial con
reseñas, notas privadas, fotos con consentimiento — `reserva_foto` tiene
un `CHECK` real que hace imposible guardar una foto sin consentimiento
explícito, no es solo una casilla de UI. Segmentación con las 4
plantillas de la Biblia + constructor personalizado, exportación CSV
exclusiva de Barbería. Riesgo de abandono se muestra honesto como "no
disponible" (depende de IA de Fase 6) en vez de un número inventado.
Verificado: 14/14 casos reales, incluyendo el aislamiento entre negocios.
`aa2e803`

### Añadido — Fase 2, Módulo 2.6: Agenda
Vista Día (columnas por Staff, cuadrícula real según el horario de la
Sede, drag & drop para reasignar Staff) y Vista Semana (columnas por
Staff, una fila por día — el mockup exacto de la Biblia). Crear cita
manual ("reserva telefónica"), reprogramar y reasignar Staff reutilizan
`slots_disponibles()` — las mismas 7 validaciones que el flujo online,
sin atajos. Cancelar reutiliza `cancelar_reserva()` tal cual (ya
soportaba reembolso 100% desde el Negocio). Bloquear horario no necesitó
ninguna RPC nueva — su RLS ya estaba completo. Verificado: 15/15 casos
reales. `13c37af`

### Añadido — Fase 2, Módulo 2.5: Servicios
CRUD completo (duración con rango 5-480 min, precio, categoría de puntaje,
buffers), Combos (agrupan servicios con nombre propio, conectados de
verdad al flujo de reserva del Cliente como atajo de un toque) y Staff
asignado por Servicio. **Hallazgo real de producción**: `staff_servicio`
nunca tuvo una pantalla que la llenara — el motor de reservas exige una
fila explícita por Servicio para considerar a un Staff apto, así que
ningún Servicio de ningún negocio era reservable por nadie hasta este
módulo. La pantalla "Staff asignado" cierra ese hueco. Verificado: 20/20
casos reales, incluyendo ese hallazgo (antes/después de asignar Staff). `d99a39c`

### Añadido — Gobernanza del proyecto: Product Coverage Matrix, deuda técnica, decisiones pendientes
`00_MASTER_TASKLIST.md` gana una Product Coverage Matrix (Backend/Frontend/
RLS/QA por dominio, tablero maestro de un vistazo). Documentos nuevos:
`docs/TECH_DEBT_REGISTER.md` (mejoras que no bloquean producción) y
`docs/PENDING_DECISIONS.md` (decisiones que dependen de algo externo,
cada una marcada explícitamente si bloquea o no). ADR-007 (Timeline
Laboral del Staff — formaliza que `evento_auditoria` + `nivel_staff_
consolidado` YA son ese historial, sin tabla nueva; `obtenerHistorialStaff()`
ahora combina ambas fuentes) y ADR-008 (Objetivos de Staff — arquitectura
de datos documentada por adelantado para Fase 6, sin implementación
todavía, decisión consciente de alcance). `bc7319d`

### Añadido — Fase 2, Módulo 2.2: Dashboard
Resumen del día del Panel Negocio, mismo componente para Barbería y
Guardian: citas de hoy, ingresos del día (solo Reservas completadas), % de
ocupación (minutos reservados ÷ disponibilidad configurada), próxima cita
y ranking de Staff de la semana por comisión generada. Completa en
`01-PRD/05_KPIs.md` las fórmulas de ocupación e ingresos diarios que la
Biblia mencionaba pero no definía. Verificado: 15/15 casos reales,
incluyendo que Guardian solo puede pedir el resumen de su propia sede.
`11c716f`

### Añadido — Fase 2, Módulo 2.4: Gestión de Staff
Dominio completo sobre `resolverContexto()`: listado con búsqueda/filtro/
orden/paginación real (vista `vista_staff_negocio`, RLS heredado), ciclo de
vida entero del vínculo (promover/revocar Guardian, suspender/reactivar,
retirar) y — el TODO que había quedado abierto desde el Módulo 2.1 —
aceptar/rechazar una invitación de verdad en `/invitacion/[id]`, que recién
ahí crea el `staff` y el `vinculo_staff_negocio` reales. Corrige además el
alcance de Guardian sobre `vinculo_staff_negocio`, que hasta ahora era el
negocio completo en vez de solo su sede. Verificado: 44/44 casos reales
contra la base, incluyendo el tope duro de Staff por plan y ADL-009 (un
Staff nunca tiene dos vínculos activos a la vez). `36b3a3d`

### Añadido — ADR-006: Guardian comparte el Panel Negocio con permisos dinámicos
Decisión de arquitectura del fundador: en vez de esperar a Fase 4 (App
Staff), Guardian opera dentro del mismo Panel Negocio que la Barbería,
con alcance resuelto en cada request por `resolverContexto()` — sin
segunda copia de componentes. Verificado: Guardian administra su propia
sede, no puede tocar sedes ajenas ni las 5 acciones exclusivas de
Barbería, y el traslado cambia su alcance al instante sin logout.
Ver `ADR_006_Guardian_Panel_Compartido.md`, ADL-011.

### Añadido — Fase 2, Módulo 2.3: Gestión de Sedes
CRUD completo, límite de sedes por plan enforzado server-side, sede
principal, traslado de Staff con auditoría, excepciones de horario
(festivos/cierres/horario especial) que `slots_disponibles()` respeta.
`aecd986`

### Añadido — Perfil de Cliente: código de país, fecha de nacimiento, intereses
Selector de código de país (Colombia por defecto), fecha de nacimiento y
categorías de interés, enmarcados como incentivo para recordatorios y
futuros beneficios de fidelización. `6485509`

### Añadido — Fase 2, Módulo 2.1: Registro de Barbería
Wizard de 4 pasos (datos+plan, sede, servicios, invitar staff), progreso
persistente vía las tablas reales del dominio. Cierra el cuello de botella
que impedía que existiera cualquier negocio real en la plataforma. `dde7703`

### Añadido — Fase 1: cierre de Plataforma Compartida
Service Worker + prompt de instalación PWA, Error Boundaries globales,
consentimiento legal versionado (textos reales + aplicación server-side).
`365d3dc`

### Añadido — Cliente PWA: Perfil, navegación y completar datos al primer login
Página `/perfil`, bottom nav de 3 pestañas, desvío de una sola vez a
completar nombre/teléfono tras el primer login. `e1c3b49`

### Corregido — Login: magic link completo y persistencia del paso "código"
El link "Iniciar sesión" del correo no autenticaba nada (faltaba
`/auth/callback`); el paso 2 del login se perdía al cambiar de pestaña.
`4c32fab`

### Corregido — Íconos PWA faltantes
`manifest.json` referenciaba íconos que nunca se generaron. `f10fa0d`

### Corregido — El sitio completo caía en Vercel si faltaban variables de Supabase
El proxy no tenía guarda ante configuración incompleta. `9da8b6e`

## [0.1.0] — Auth, onboarding y Módulo 1 Cliente
Marketplace, perfil público de Negocio, flujo de reserva de 4 pasos, pago
de Seña con Mercado Pago, motor de disponibilidad con lock por base de
datos. `bc8896c`
