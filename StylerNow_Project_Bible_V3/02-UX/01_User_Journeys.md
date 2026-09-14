# 01 — User Journeys

## Objetivo
Mapear los recorridos end-to-end de cada rol a través de las 4 superficies, como referencia maestra de la que se derivan los documentos de pantalla específicos (`02` a `10` de esta carpeta).

## Alcance
Journeys a nivel de flujo (secuencia de pasos), no el detalle visual de cada pantalla (eso vive en el documento de cada superficie). No repite reglas de negocio ya fijadas en `03-Business-Rules` — las referencia.

## Reglas

### Journey — Cliente: descubrir y reservar por primera vez

`Onboarding → Registro/Login → Home (Marketplace) → Búsqueda/filtro → Perfil de Negocio → Selección de Servicio(s) → Selección de Staff (o "cualquiera") → Selección de horario → Resumen → Pago de Seña → Confirmación → (recordatorios automáticos) → Check-in en Sede (lo hace el Staff) → Servicio prestado → Check-out → Reseña opcional → Puntos acreditados`

Puntos de fricción cubiertos por reglas ya definidas: sin disponibilidad → oferta de Lista de espera (`03-Business-Rules/10_Waitlist_System.md`); pago fallido → reintento o cancelación automática (`03-Business-Rules/03_Payment_Rules.md`).

### Journey — Cliente: gestionar una cita existente

`Mis citas (próximas) → Detalle de Reserva → [Reprogramar | Cancelar] → Confirmación de la acción → Reembolso según ventana (si aplica)`

### Journey — Staff: día operativo típico

`Login App Staff → Agenda del día → Check-in de la primera cita → Atender → Check-out → (repetir) → Ver puntaje/Nivel actualizado en tiempo real → Fin del día`

### Journey — Staff: onboarding a un Negocio nuevo

`Recibe invitación (email/SMS) → Acepta → Completa perfil (foto, bio, especialidad) → Barbería/Guardian configura su disponibilidad y Servicios asignados → Vínculo pasa a ACTIVO (`03-Business-Rules/01_Roles.md`) → Aparece en el flujo de selección de Staff del Cliente`

### Journey — Barbería: onboarding del Negocio

`Registro → Datos del Negocio → Alta de Sede(s) → Carga de Servicios y precios → Invitación de Staff → Configuración de Seña y política de cancelación → Envío a aprobación → (SuperSU aprueba) → Negocio ACTIVO y visible en Marketplace`

### Journey — Barbería: operación diaria

`Login Panel Negocio → Dashboard (resumen del día) → Agenda → Gestión de una incidencia (reprogramar, bloquear horario) → Caja/POS al cierre → Revisión de reportes semanales`

### Journey — SuperSU: aprobación y gobierno de plataforma

`Login CMS → Cola de Negocios pendientes → Revisión de solicitud → Aprobar/Rechazar → Configuración periódica de comisión/banners/ciudades → Moderación de reseñas reportadas → Soporte de tickets`

## Estados
No aplica — este documento describe flujos, no una entidad con ciclo de vida (los estados de cada entidad involucrada están en `04-Data-Model/03_State_Machines.md`).

## Permisos
Cada journey respeta la matriz de `03-Business-Rules/01_Roles.md` — ningún paso de un journey de un rol requiere una acción que ese rol no tiene permitida.

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, `03-Business-Rules` (todo el dominio), `Glossary.md`.
- De este documento dependen: `02` a `10` de esta carpeta (cada uno detalla un tramo de estos journeys a nivel de pantalla).

## Casos límite

- **Un Cliente abandona el journey de reserva a mitad de camino** (cierra la app antes de pagar). No queda ningún estado "a medias" persistente más allá del `pago PENDIENTE` con expiración de 10 minutos (`03-Business-Rules/03_Payment_Rules.md`) — el journey es reanudable desde cero, no desde un punto guardado, en V1.
- **Un Staff es también Barbería de su propio Negocio** (negocio de 1 persona). Su journey combina "operación diaria" y "onboarding de Negocio" bajo la misma sesión de usuario, alternando entre Panel Negocio y App Staff sin fricción (`01-PRD/02_Functional_Architecture.md`, caso límite de rol combinado).

## Criterios de aceptación
- [ ] Cada paso de cada journey de este documento corresponde a una pantalla concreta documentada en `02` a `10`.
- [ ] Ningún journey requiere un paso que contradiga una regla de `03-Business-Rules`.

## Checklist
- [x] Completo
- [ ] Revisado
