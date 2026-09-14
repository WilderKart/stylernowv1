# 09 — Business Panel

## Objetivo
Especificar la estructura completa del Panel Negocio, la superficie de administración operativa del Negocio (ver mockups `B1` a `B8`).

## Alcance
Todas las secciones del Panel Negocio: Dashboard, Agenda, Servicios/Staff, Clientes (CRM), Caja/POS, Reportes, Reseñas, Configuración. No repite las reglas de negocio detrás de cada sección (ya en `03-Business-Rules` y `08-Growth-Monetization`), las conecta visualmente.

## Reglas

### Navegación (sidebar)

Dashboard, Agenda, Servicios, Staff, Clientes, Caja, Reportes, Reseñas, Configuración — consistente con la matriz de permisos de `03-Business-Rules/01_Roles.md` (Guardian ve una versión con alcance limitado a su propia Sede en Agenda/Caja/Clientes; no ve Configuración de plan/facturación).

### Dashboard (ver mockup `B2-Dashboard`)

Resumen del día: citas de hoy, ingresos del día, % de ocupación, próxima cita, línea de tiempo del día, ranking de Staff de la semana (por comisión generada). Todas las cifras siguen las fórmulas de `01-PRD/05_KPIs.md`.

### Agenda (ver mockup `B3-Agenda`)

Vista semanal por Staff (columnas), con bloques de citas coloreados por estado, opción de bloquear horario (crea `bloqueo_ausencia`) y crear una cita manualmente en nombre de un Cliente (ej. reserva telefónica) — esta creación manual sigue exactamente las mismas 7 validaciones de disponibilidad de `03-Business-Rules/02_Booking_Rules.md`, sin atajos.

### Servicios y Staff (ver mockup `B4-ServicesStaff`)

- Tabla editable de Servicios (nombre, duración, precio, categoría de puntaje, Recurso requerido).
- Lista de Staff con foto, horario resumen, % de comisión configurado (`08-Growth-Monetization/02_Commissions.md`), acceso a invitar nuevo Staff.

### Clientes / CRM (ver mockup `B5-Clients`)

Tabla de Clientes atendidos por el Negocio: visitas, gasto total (LTV), última visita, etiquetas. Implementación visual de `03-Business-Rules/07_CRM.md`.

### Caja/POS (ver mockup `B6-POS`)

- Registro de venta de Servicio adicional o producto físico durante la atención (ej. venta de producto de cuidado personal).
- Resumen de cierre de caja del día: efectivo vs. digital, total del día.
- Aplicación de descuento por canje de Puntos de fidelización (`03-Business-Rules/04_Loyalty.md`) directamente desde esta pantalla.

### Reportes (ver mockup `B7-ReportsReviews`)

Gráfico de ingresos por semana/mes, servicios más vendidos, ranking de Staff, y sección de reseñas recibidas con opción de responder públicamente.

### Configuración (ver mockup `B8-Settings`)

Plan de suscripción actual (con opción de upgrade/downgrade, `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`), historial de facturación, métodos de cobro del Negocio (para recibir liquidaciones del Wallet).

## Estados
Cada sección refleja los estados de las entidades subyacentes ya definidos en `04-Data-Model/03_State_Machines.md` — el Panel no introduce estados de UI propios más allá de estados de formulario estándar (borrador/guardado).

## Permisos
Ver `03-Business-Rules/01_Roles.md` — Barbería ve todo; Guardian ve alcance limitado a su Sede en Agenda, Caja y Clientes, y no ve Configuración de plan/facturación ni puede invitar/remover Staff de otras Sedes.

## Dependencias
- Depende de: la totalidad de `03-Business-Rules` y `08-Growth-Monetization`, `01-PRD/05_KPIs.md`.
- De este documento dependen: `07-QA/04_Business.md`.

## Casos límite

- **Un Guardian intenta acceder a Configuración desde la URL directamente** (sin pasar por la navegación, que ya oculta la opción). Bloqueado a nivel de API/RLS (`06-Security/02_RLS.md`), no solo oculto en la navegación — devuelve `403 FORBIDDEN`.
- **La Barbería crea una Reserva manual para un horario que ya tiene una Reserva de otro Cliente (error humano).** La misma validación de `03-Business-Rules/02_Booking_Rules.md` se aplica sin excepción — el Panel Negocio no tiene un "modo forzado" para saltarse el lock de disponibilidad.
- **El cierre de caja del día no cuadra** (diferencia entre lo registrado y lo contado físicamente). El Panel permite registrar la diferencia con una nota, pero no oculta ni ajusta automáticamente el número — la discrepancia queda visible como dato de auditoría, no se "corrige" silenciosamente.

## Criterios de aceptación
- [ ] Ninguna acción del Panel Negocio se salta una validación de `03-Business-Rules` "por ser administrador".
- [ ] Un Guardian nunca ve datos de otra Sede del mismo Negocio, verificado tanto en UI como en API.
- [ ] Todo número mostrado en Reportes coincide exactamente con la fórmula de `01-PRD/05_KPIs.md`.

## Checklist
- [x] Completo
- [ ] Revisado
