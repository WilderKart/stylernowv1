# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Cada entrada de módulo referencia su commit y el ítem correspondiente en
`StylerNow_Project_Bible_V3/00_MASTER_TASKLIST.md`, que es el detalle vivo
— este archivo es el resumen cronológico, no repite el detalle técnico.

## [No liberado]

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
todavía, decisión consciente de alcance).

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
