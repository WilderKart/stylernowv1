# 02 — Booking Rules

## Objetivo
Definir con precisión cómo se crea, valida, modifica y cierra una Reserva — el núcleo transaccional de todo el sistema — para cualquier vertical y cualquier combinación de Staff y Recurso.

## Alcance
Reglas de negocio de la Reserva. La máquina de estados formal vive en `04-Data-Model/03_State_Machines.md`; este documento define **por qué** cada transición ocurre. Los contratos de API viven en `05-API/03_Bookings.md`.

## Reglas

### Qué compone una Reserva

Una Reserva requiere: `cliente_id`, `negocio_id`, `sede_id`, uno o más `servicio_id`, un `staff_id` (o el valor especial `CUALQUIERA_DISPONIBLE`), un `hora_inicio`, y opcionalmente un `recurso_id` si el Servicio lo requiere (ver ADL-002).

### Validación de disponibilidad (debe cumplirse TODO simultáneamente)

1. El Staff seleccionado no tiene otra Reserva que se solape en el rango `[hora_inicio, hora_inicio + duración_total)` en esa Sede.
2. El Staff está dentro de su horario laboral configurado para ese día (ver `04-Data-Model/01_Entities.md`, entidad Disponibilidad).
3. El Staff no tiene un bloqueo de ausencia activo en ese rango.
4. Si el Servicio requiere Recurso: el Recurso específico (o cualquiera de su tipo, según configuración de la Sede) está libre en el mismo rango.
5. La Sede está dentro de su horario de apertura configurado para ese día.
6. El `hora_inicio` no es anterior al momento actual más el "tiempo mínimo de anticipación" configurado por el Negocio (por defecto 0 minutos; configurable hasta 24 horas).
7. El `hora_inicio` no excede la "ventana máxima de reserva anticipada" configurada por el Negocio (por defecto 60 días).

Si cualquiera de estas condiciones falla al momento de confirmar, la Reserva se rechaza con un error específico (`05-API/03_Bookings.md`) y el Cliente ve el horario como no disponible — nunca se le deja intentar pagar una Reserva que después no se puede honrar.

### `CUALQUIERA_DISPONIBLE`

Cuando el Cliente no elige un Staff específico, el sistema asigna automáticamente el primer Staff que cumple las 7 condiciones de arriba **y** que tenga la especialidad requerida por el Servicio, priorizando (en este orden): (1) mayor Nivel PRO/EXPERT/MASTER, (2) menor número de Reservas ya asignadas ese día (para balancear carga), (3) orden aleatorio como desempate final. Esta asignación es definitiva al confirmar el pago — no se reasigna después salvo por una excepción de `03-Business-Rules/08_Edge_Cases.md`.

### Buffers

Cada Servicio puede tener un `buffer_previo` y `buffer_posterior` (minutos de limpieza/preparación) configurados por el Negocio. Los buffers se consideran parte del bloque ocupado del Staff y del Recurso a efectos de la validación de disponibilidad, pero **no son visibles ni cobrables al Cliente**.

### Reprogramación (reschedule)

- El Cliente puede reprogramar una Reserva en estado `CONFIRMADA` hasta el límite de tiempo definido por la política de cancelación del Negocio (ver `03-Business-Rules/03_Payment_Rules.md`).
- Reprogramar no genera una nueva Reserva: es una transición de la Reserva existente que conserva su `id`, su Seña ya pagada, y su historial.
- Reprogramar está sujeto a las mismas 7 validaciones de disponibilidad que una Reserva nueva, sobre el nuevo horario.
- El Negocio puede reprogramar una Reserva desde el Panel Negocio o la App Staff (ej. por indisponibilidad sobrevenida del Staff) — en ese caso se notifica obligatoriamente al Cliente y se le ofrece re-confirmar o cancelar con reembolso completo de la Seña (ver Caso límite "Staff cambia horario").

### Cancelación

- El Cliente puede cancelar desde Cliente PWA. El reembolso de la Seña depende de la ventana de cancelación (`03-Business-Rules/03_Payment_Rules.md`).
- El Negocio puede cancelar desde Panel Negocio o App Staff. Cancelación iniciada por el Negocio **siempre** reembolsa el 100% de la Seña al Cliente, sin excepción, independientemente de la ventana de tiempo.

### Combos de Servicios

Una Reserva puede incluir más de un Servicio (ej. "Corte + Barba"). La duración total es la suma de las duraciones individuales más los buffers correspondientes, salvo que el Negocio configure una duración de combo explícita menor (combos con eficiencia de tiempo real, ej. dos procesos que se hacen en paralelo). Si los Servicios del combo requieren distintas especialidades de Staff no cubiertas por un solo Staff, el combo no es reservable como una sola Reserva — se ofrece como dos Reservas encadenadas (fuera de alcance de V1 automatizar el encadenamiento; el Cliente las crea manualmente).

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquina "Reserva": `PENDIENTE_PAGO` → `CONFIRMADA` → `EN_CURSO` → `COMPLETADA`, con ramas a `CANCELADA` y `NO_SHOW`.

## Permisos
- Crear/cancelar/reprogramar su propia Reserva: Cliente.
- Ver y gestionar Reservas de su Sede/Negocio: Staff (propias), Guardian (su Sede), Barbería (todo el Negocio).
- Ver todas: SuperSU (para soporte, con impersonación auditada).

## Dependencias
- Depende de: `Glossary.md`, `01-PRD/02_Functional_Architecture.md`, `03-Business-Rules/01_Roles.md`.
- De este documento dependen: `04-Data-Model/01_Entities.md`, `04-Data-Model/03_State_Machines.md`, `05-API/03_Bookings.md`, `02-UX/05_Booking.md`, `03-Business-Rules/09_No_Show_Policy.md`, `03-Business-Rules/10_Waitlist_System.md`.

## Casos límite

- **Dos Reservas simultáneas para el mismo Staff/horario** (dos Clientes confirman en la misma fracción de segundo). Se resuelve con un lock optimista a nivel de base de datos sobre el rango `(staff_id, sede_id, hora_inicio, hora_fin)`: la segunda escritura que intente solapar recibe `409 CONFLICT` y su UI le muestra inmediatamente el horario como no disponible y le ofrece el siguiente slot libre o unirse a la Lista de espera.
- **El Staff cambia su horario laboral después de que ya existen Reservas confirmadas en el horario eliminado.** El cambio de horario no cancela Reservas existentes automáticamente; el sistema bloquea el intento de reducir el horario si hay Reservas `CONFIRMADA` que quedarían fuera del nuevo horario, y exige a la Barbería/Guardian reprogramar o cancelar (con reembolso) esas Reservas primero.
- **Un Servicio es eliminado del catálogo mientras existen Reservas futuras que lo referencian.** No se permite el borrado físico del Servicio si tiene Reservas futuras activas; se ofrece "desactivar" (deja de ser reservable para citas nuevas, pero las Reservas existentes conservan la referencia íntegra — ver `04-Data-Model/05_Data_Retention.md`, soft delete).
- **El Cliente pierde conexión a internet durante el paso de selección de horario, antes de pagar.** El horario no queda bloqueado (no hay "reserva temporal" de más de unos segundos de lock optimista); al recuperar conexión, el Cliente reintenta y puede encontrar el slot ya no disponible.
- **Recurso limitado sin Staff limitado** (ej. spa con 5 masajistas pero 2 camillas). La validación de disponibilidad de Recurso (regla 4) es la que efectivamente limita la Reserva aunque haya Staff libre; el sistema debe mostrar el horario como no disponible aunque exista un masajista libre, porque no hay camilla.
- **Un Negocio con Plan Raven (tope absoluto de 2 Staff) intenta que un tercer colaborador tome Reservas.** No aplica a nivel de Reserva — se bloquea antes, a nivel de invitación de Staff (`01-PRD/03_Monetization.md`).

## Criterios de aceptación
- [ ] Ninguna Reserva puede confirmarse sin pasar las 7 validaciones de disponibilidad, verificado por un lock a nivel de base de datos, no solo a nivel de aplicación.
- [ ] Una cancelación iniciada por el Negocio siempre resulta en reembolso completo, verificable en `04-Data-Model/04_Audit.md`.
- [ ] Reprogramar conserva el `id` original de la Reserva en el 100% de los casos.

## Checklist
- [x] Completo
- [ ] Revisado
