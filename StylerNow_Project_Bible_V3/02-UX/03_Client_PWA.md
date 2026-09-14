# 03 — Client PWA

## Objetivo
Especificar la estructura de navegación y los requisitos técnicos de experiencia de la Cliente PWA como superficie completa, más allá de sus pantallas individuales (que se detallan en `04` a `07`).

## Alcance
Estructura general, navegación e instalabilidad de la Cliente PWA. El detalle de Marketplace, Booking, Payments y Appointments está en sus propios documentos.

## Reglas

### Navegación principal (bottom nav, ver mockups `C3`, `C7`, `C8`)

3 pestañas: **Inicio** (Marketplace/Home), **Citas** (próximas/historial), **Perfil** (datos, puntos, métodos de pago). Consistente con `01-PRD/02_Functional_Architecture.md`, responsabilidades de la Cliente PWA.

### Requisitos de instalabilidad (PWA)

- `manifest.json` con íconos, `theme_color`, `display: standalone`.
- Service Worker que cachea el shell de la app (assets estáticos) desde la primera visita, para carga instantánea en visitas posteriores.
- Prompt de instalación ("Agregar a inicio") mostrado después de la segunda visita del Cliente, nunca en la primera visita (evita fricción antes de que el Cliente entienda el valor).

### Preparación para Capacitor (ADL-003)

- Ningún componente depende de una API exclusiva de navegador sin equivalente en WebView (ej. se evita depender de comportamientos específicos de Safari/Chrome que no repliquen en un WebView empaquetado).
- El almacenamiento local usa `localStorage`/IndexedDB (portable a Capacitor) en vez de depender solo de cookies de sesión de navegador.
- Los permisos (ubicación, notificaciones) se solicitan a través de una capa de abstracción propia que, en la fase de empaquetado con Capacitor, se reemplaza por el plugin nativo correspondiente sin cambiar el código de la pantalla que lo consume.

### Responsive

Mobile-first (390-430px de referencia, ver mockups), con soporte funcional (no solo "que no se rompa") en tablet y desktop para el caso de un Cliente que reserva desde computador, consistente con el pedido original de "agendar desde móvil o PC".

### Rendimiento offline básico

- El shell de la app carga sin conexión (Service Worker).
- Datos transaccionales (disponibilidad, estado de Reservas) **no** se sirven desde caché offline — se muestra un estado de "sin conexión" explícito en vez de datos potencialmente obsoletos sobre disponibilidad real (ver `02-UX/12_Errors_States.md`).

## Estados
No aplica — documento de estructura de superficie.

## Permisos
Toda la superficie opera bajo el rol Cliente exclusivamente (`03-Business-Rules/01_Roles.md`).

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, ADL-003.
- De este documento dependen: `04_Marketplace.md`, `05_Booking.md`, `06_Payments.md`, `07_Appointments.md`, `10-Operations/05_Release_Process.md` (empaquetado Capacitor futuro).

## Casos límite

- **Un Cliente instala la PWA y luego StylerNow publica una actualización.** El Service Worker detecta la versión nueva en segundo plano y la aplica en la siguiente apertura de la app (nunca a mitad de una sesión activa con una Reserva en curso de creación, para no interrumpir un flujo de pago).
- **Un Cliente pierde conexión durante el flujo de reserva.** Ver `03-Business-Rules/02_Booking_Rules.md`, caso límite correspondiente, y `12_Errors_States.md` para el tratamiento visual exacto.
- **Un Cliente usa la PWA desde un navegador de escritorio sin las capacidades de instalación móvil.** La experiencia sigue siendo completamente funcional (reservar, pagar, gestionar citas) — el prompt de instalación simplemente no aparece en un contexto donde no aplica.

## Criterios de aceptación
- [ ] La app carga el shell en menos de 2 segundos en una red 3G simulada, en la segunda visita.
- [ ] Ningún componente de la Cliente PWA usa una API sin equivalente documentado para su futuro empaquetado en Capacitor.
- [ ] La navegación de 3 pestañas es consistente en el 100% de las pantallas de la superficie.

## Checklist
- [x] Completo
- [ ] Revisado
