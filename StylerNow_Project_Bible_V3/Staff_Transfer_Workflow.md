# Staff Transfer Workflow

## Objetivo
Especificar el flujo operativo completo de trasladar un Staff (con o sin perfil Guardian) de una Sede a otra dentro del mismo Negocio, consolidando en un solo lugar lo que antes estaba disperso entre `03-Business-Rules/01_Roles.md` (regla de negocio) y `10-Operations/02_Migration_Strategy.md` (mención operativa). Ambos documentos remiten aquí para el detalle completo; no lo repiten.

## Alcance
El traslado de un Staff entre Sedes del mismo Negocio, ejecutado por la cuenta Barbería. El caso específico del perfil Guardian durante un traslado está detallado en `Guardian_Lifecycle.md` — este documento cubre el flujo general, válido para cualquier Staff.

## Reglas

### Cuándo se usa este flujo (vs. otros similares)

- **Traslado** (este documento): un Staff existente, `vinculo_staff_negocio ACTIVO`, cambia su `sede_activa_id` dentro del mismo `negocio_id`. Es la única operación cubierta aquí.
- **No es un traslado**: un Staff que se retira de un Negocio y luego se vincula a otro Negocio distinto — eso es un `vinculo_staff_negocio` nuevo (`03-Business-Rules/01_Roles.md`, ADL-009: un Staff nunca tiene dos vínculos no-`RETIRADO` simultáneos), no un traslado.
- **No es un traslado**: un Staff que atiende ocasionalmente en otra Sede sin cambiar su `sede_activa_id` — no soportado en V1 (un Staff opera desde una única sede activa a la vez; si el negocio necesita cobertura cruzada puntual, la solución es un traslado temporal explícito, no una disponibilidad multi-sede simultánea).

### Precondiciones

1. El Staff a trasladar tiene `vinculo_staff_negocio = ACTIVO`.
2. La sede destino pertenece al mismo `negocio_id` que la sede origen.
3. La sede destino está en estado operativo (no `CERRADA_TEMPORALMENTE` ni en proceso de cierre permanente, `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`).

### Flujo paso a paso

1. **Barbería inicia el traslado** desde el Panel Negocio (`02-UX/09_Business_Panel.md`, sección Gestión del Staff → "Cambiar sede"), seleccionando el Staff y la sede destino.
2. **Validación de Reservas en conflicto**: el sistema revisa si el Staff tiene Reservas `CONFIRMADA` futuras en la sede origen. Si las tiene, se presenta a Barbería la lista completa antes de continuar — el traslado no puede ejecutarse silenciosamente mientras existan compromisos pendientes sin resolver.
3. **Resolución de Reservas en conflicto** (Barbería elige, por cada Reserva en conflicto): (a) reprogramar con el mismo Staff después de la fecha efectiva del traslado si el Cliente puede desplazarse a la sede destino, (b) reasignar a otro Staff disponible de la sede origen, o (c) cancelar con reembolso 100% (`03-Business-Rules/03_Payment_Rules.md`, cancelación iniciada por el Negocio siempre reembolsa completo). El traslado no se ejecuta hasta que las 3 opciones se hayan resuelto para el 100% de las Reservas en conflicto.
4. **Ejecución del traslado**: `sede_activa_id` se actualiza a la sede destino, con fecha/hora efectiva (inmediata por defecto; Barbería puede programar una fecha futura si prefiere coordinar el cambio con antelación — en ese caso el Staff sigue operando en la sede origen hasta la fecha efectiva).
5. **Efectos automáticos en cascada**:
   - Los permisos de alcance 🏢 (si el Staff tiene perfil Guardian) migran a la nueva sede — ver `Guardian_Lifecycle.md` para el detalle exacto.
   - La `disponibilidad` configurada del Staff para la sede origen queda archivada (no se borra — se conserva como histórico, consistente con `04-Data-Model/05_Data_Retention.md`, soft delete); el Staff debe configurar su `disponibilidad` en la sede destino (Barbería puede pre-configurarla como parte del mismo flujo, paso opcional).
   - El Staff deja de aparecer en el flujo de selección de Staff (`03-Business-Rules/02_Booking_Rules.md`) de la sede origen para Reservas nuevas, y empieza a aparecer en la sede destino, desde la fecha efectiva.
6. **Notificación**: el Staff recibe una notificación del traslado (categoría "Confirmación/recordatorio" de `WhatsApp_Delivery_Engine.md`) con la sede destino y la fecha efectiva.
7. **Auditoría**: evento `STAFF_TRASLADADO` (ver `Guardian_Lifecycle.md` para la estructura exacta del evento, compartida entre Staff con y sin perfil Guardian).

### Qué NO viaja con el traslado (permanece en la sede origen o en el Negocio, según corresponda)

- El historial de Reservas ya `COMPLETADA` permanece asociado al `staff_id` (viaja con la persona, no con la sede) y sigue siendo visible en su App Staff sin importar la sede actual.
- Las notas y etiquetas de CRM que el Staff escribió sobre Clientes permanecen en el Negocio (`03-Business-Rules/07_CRM.md`), accesibles por cualquier Staff/Guardian con alcance sobre esos Clientes, independiente de en qué sede esté ahora el autor original de la nota.
- El puntaje PRO/EXPERT/MASTER de la temporada en curso viaja con el Staff sin ningún ajuste (`03-Business-Rules/05_Staff_Rewards.md`, es por Negocio, no por Sede).

## Estados
El traslado en sí no es una entidad con estado propio — es una acción atómica que modifica `sede_activa_id` sobre un `vinculo_staff_negocio` ya `ACTIVO`, sin afectar el `estado` de ese vínculo (`04-Data-Model/03_State_Machines.md`).

## Permisos
Exclusivo de la cuenta Barbería. Ni el propio Staff ni un Guardian (ni siquiera el Guardian de la sede origen o destino) pueden iniciar o aprobar un traslado — consistente con `03-Business-Rules/01_Roles.md`, Principios de arquitectura, punto 5 ("El rol Barbería es el único que puede... trasladar personal entre sedes").

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md`, `03-Business-Rules/02_Booking_Rules.md`, `03-Business-Rules/03_Payment_Rules.md`, `Guardian_Lifecycle.md`, `04-Data-Model/05_Data_Retention.md`.
- De este documento dependen: `02-UX/09_Business_Panel.md`, `10-Operations/02_Migration_Strategy.md` (referencia cruzada, ya no repite el flujo), `07-QA/04_Business.md`.

## Casos límite

- **La sede destino no tiene ningún Servicio en común con la especialidad del Staff trasladado.** No es un bloqueo técnico (el Staff puede trasladarse igual), pero la UI advierte a Barbería que el Staff no podrá recibir Reservas en la sede destino hasta que se le asignen Servicios compatibles (`staff_servicio`, `04-Data-Model/02_Relationships.md`) — una advertencia, no una restricción.
- **Un Cliente tenía una Reserva `CONFIRMADA` y fue reasignado a otro Staff como parte de la resolución de conflicto (paso 3, opción b).** El Cliente recibe notificación del cambio de Staff asignado a su Reserva (no solo de un traslado interno que no le compete) — desde su perspectiva es equivalente a una reasignación de profesional (`03-Business-Rules/02_Booking_Rules.md`).
- **Barbería programa un traslado con fecha efectiva futura y luego cambia de opinión antes de que llegue esa fecha.** Puede cancelar el traslado programado sin restricciones — no genera ningún efecto hasta su fecha efectiva, por lo que cancelarlo antes es una operación limpia sin necesidad de "revertir" nada.
- **Dos traslados se programan para el mismo Staff con fechas efectivas distintas antes de que el primero se ejecute.** El sistema solo permite un traslado programado pendiente a la vez por Staff — el segundo intento debe cancelar o modificar el primero, nunca coexisten dos traslados pendientes contradictorios.

## Criterios de aceptación
- [ ] Ningún traslado se ejecuta mientras existan Reservas `CONFIRMADA` en conflicto sin resolver.
- [ ] Todo traslado genera exactamente un evento de auditoría `STAFF_TRASLADADO`, verificable con sede origen, sede destino y fecha efectiva.
- [ ] El historial y puntaje del Staff son idénticos antes y después de cualquier traslado, verificado por comparación de snapshots en pruebas.

## Checklist
- [x] Completo
- [ ] Revisado
