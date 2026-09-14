# 10 — SuperSU CMS

## Objetivo
Especificar el CMS de plataforma, sin código, con el que el equipo de StylerNow opera todo el sistema (ver mockups `A1` a `A5`).

## Alcance
Todas las secciones del SuperSU CMS: Dashboard global, Gestión de Negocios, Planes, Configuración global sin código, Soporte/Moderación. No repite reglas ya definidas en `03-Business-Rules`/`08-Growth-Monetization`, las expone como interfaz operable.

## Reglas

### Dashboard global (ver mockup `A2-Dashboard`)

Negocios activos, MRR, citas totales en la red, mapa de ciudades activas, actividad reciente (aprobaciones, solicitudes nuevas, reseñas reportadas, pagos de suscripción recibidos) — cifras según `01-PRD/05_KPIs.md`.

### Gestión de Negocios (ver mockup `A3-Businesses`)

Tabla con estado (`PENDIENTE_APROBACION`/`ACTIVO`/`SUSPENDIDO`), acciones de Aprobar/Rechazar/Reactivar/Suspender, acceso a detalle completo de cada Negocio (incluye entrar en modo impersonación auditado, `03-Business-Rules/01_Roles.md`).

### Planes y Configuración global (ver mockup `A4-PlansCMS`), **todo sin código**

- **Comisión de plataforma**: slider/input numérico que actualiza el valor global en tiempo real (dentro del rango 3%-15% definido en `08-Growth-Monetization/02_Commissions.md`).
- **Ciudades habilitadas**: toggle por ciudad, afecta inmediatamente qué Negocios son descubribles en `08-Growth-Monetization/01_Marketplace_Algorithm.md` (filtro de elegibilidad geográfica).
- **Banners del Home**: editor de banners de Marketplace (imagen, texto, vigencia, toggle activo/inactivo) — control directo sobre contenido editorial de la Cliente PWA sin requerir despliegue de código.
- **Gestión de Planes SaaS**: crear/editar Plan (precio, límites de Sedes/Staff, funcionalidades habilitadas) — cambios a un Plan existente afectan solo a nuevas suscripciones o a la renovación siguiente de suscripciones existentes, nunca retroactivamente a mitad de un ciclo ya facturado.
- **Textos legales**: gestión del texto de Política de Tratamiento de Datos y Términos (`06-Security/04_Compliance_Colombia.md`), versionado (cada cambio genera una versión nueva, nunca sobreescribe silenciosamente el texto que un usuario ya aceptó).

### Soporte y Moderación (ver mockup `A5-Support`)

- Cola de reseñas reportadas con acción Eliminar/Mantener (`06-Security/03_Fraud.md`, vector 1).
- Tickets de soporte de Negocios, con estado (Abierto/En proceso/Resuelto).

## Estados
Este CMS opera sobre los estados ya definidos en `04-Data-Model/03_State_Machines.md` (Negocio, Reseña) y sobre configuración de plataforma sin máquina de estados propia (son valores de configuración con versión/auditoría, `04-Data-Model/04_Audit.md`).

## Permisos
Exclusivo de rol SuperSU. Ninguna acción de este CMS es accesible desde ninguna otra superficie.

## Dependencias
- Depende de: la totalidad de `03-Business-Rules`, `08-Growth-Monetization`, `06-Security`.
- De este documento dependen: `07-QA/05_Admin.md`.

## Casos límite

- **SuperSU cambia la comisión global mientras hay transacciones `pago` en curso (`PENDIENTE`).** El nuevo valor aplica a transacciones que se aprueben desde ese momento en adelante; una transacción ya con comisión calculada y en proceso de aprobación no se recalcula a mitad de vuelo (evita inconsistencia entre lo que el Cliente vio en el resumen de pago y lo que se cobra).
- **SuperSU deshabilita una ciudad que tiene Negocios `ACTIVO` operando en ella.** Los Negocios de esa ciudad dejan de ser descubribles en el Marketplace público inmediatamente, pero **no** se suspenden ni pierden su suscripción — es una acción de visibilidad de descubrimiento, distinta de suspender un Negocio (`08-Growth-Monetization/04_Subscriptions_Lifecycle.md`); sus Reservas ya confirmadas y su operación interna (Panel Negocio, App Staff) siguen funcionando con normalidad.
- **Un texto legal se actualiza y un Cliente antiguo nunca volvió a aceptar la versión nueva.** El sistema exige re-aceptación de los Términos actualizados en el siguiente inicio de sesión del Cliente si el cambio es material (definido por SuperSU al publicar la nueva versión), consistente con `06-Security/04_Compliance_Colombia.md`.

## Criterios de aceptación
- [ ] Todo cambio de configuración global queda registrado en `04-Data-Model/04_Audit.md` con el SuperSU responsable.
- [ ] Ningún cambio de Plan afecta retroactivamente una suscripción ya facturada en el ciclo actual.
- [ ] Deshabilitar una ciudad nunca suspende automáticamente los Negocios de esa ciudad.

## Checklist
- [x] Completo
- [ ] Revisado
