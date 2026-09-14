# 10 — Waitlist System (Lista de Espera)

## Objetivo
Definir cómo un Cliente se registra en una lista de espera cuando su horario/Staff preferido está lleno, y cómo el sistema le notifica automáticamente si se libera un cupo, sin intervención manual del Negocio.

## Alcance
Cubre la mecánica de registro, notificación y expiración de una entrada de lista de espera. No cubre la validación de disponibilidad en sí (`03-Business-Rules/02_Booking_Rules.md`, ya referenciada).

## Reglas

### Cuándo se ofrece la Lista de espera

Cuando un Cliente busca un slot (Servicio + Staff específico o "cualquiera" + fecha) y no hay disponibilidad que cumpla las 7 validaciones de `02_Booking_Rules.md`, la Cliente PWA ofrece unirse a la Lista de espera para ese criterio de búsqueda específico, en vez de solo mostrar "no disponible".

### Qué registra una entrada de Lista de espera

`cliente_id`, `negocio_id`, `sede_id`, `servicio_id`(s), `staff_id` (opcional — puede ser "cualquiera"), `fecha_deseada` (un día específico o un rango de hasta 7 días), `franja_horaria_preferida` (opcional: mañana/tarde/noche o rango exacto).

### Disparo de notificación

Cuando se libera un cupo que cumple los criterios de una o más entradas de Lista de espera activas (por cancelación, reprogramación, o el Negocio abre un horario nuevo), el sistema:

1. Identifica todas las entradas compatibles, ordenadas por **orden de registro** (FIFO — el primero en anotarse es el primero en ser notificado).
2. Notifica **solo a la primera entrada de la cola** (push + email/WhatsApp), con una ventana de **15 minutos** para confirmar y pagar la Seña antes de que el cupo se libere para el siguiente en la cola o para el Marketplace general.
3. Si el primero no confirma dentro de los 15 minutos, se notifica automáticamente al segundo, y así sucesivamente.
4. Si nadie en la cola confirma, el cupo vuelve a estar disponible públicamente en el flujo de reserva normal.

### Expiración de una entrada

Una entrada de Lista de espera expira automáticamente al finalizar la `fecha_deseada` (o el último día del rango) sin haber sido notificada exitosamente, o a los 30 días de creada si no se especificó fecha (caso "cualquier día disponible pronto"), lo que ocurra primero.

### Límite

Un Cliente puede tener un máximo de **5 entradas activas simultáneas** en toda la plataforma (no por Negocio), para evitar que la cola se sature con registros especulativos de un mismo usuario.

## Estados
`ACTIVA` → `NOTIFICADA` → `CONVERTIDA` (el Cliente confirmó y pagó) / `EXPIRADA_VENTANA` (no confirmó a tiempo, vuelve a `ACTIVA` para permitir que el sistema notifique al siguiente, pero esta entrada específica pasa al final de la cola si el Cliente quiere seguir esperando) / `EXPIRADA_FECHA` (venció la fecha deseada) / `CANCELADA` (el Cliente la retira manualmente).

## Permisos
- El Cliente crea, ve y cancela sus propias entradas.
- El Staff/Barbería ve el tamaño agregado de la cola de espera para su agenda (útil para decidir si abrir un horario extra), sin ver el detalle de contacto de cada Cliente en cola hasta que ese Cliente efectivamente confirme una Reserva.

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `Glossary.md`.
- De este documento dependen: `02-UX/05_Booking.md`, `02-UX/11_Notifications.md`, `04-Data-Model/03_State_Machines.md`, `05-API/03_Bookings.md`.

## Casos límite

- **Se libera un cupo y hay 3 entradas compatibles en cola al mismo tiempo, pero el cupo desaparece (otro proceso lo toma) antes de notificar a la segunda.** El sistema revalida disponibilidad real inmediatamente antes de notificar a cada entrada de la cola (no asume que el cupo sigue libre solo porque se detectó libre unos segundos antes) — si ya no está disponible, simplemente no se notifica a nadie más y el ciclo termina sin conversión.
- **El Cliente que iba primero en la cola ya reservó ese mismo slot por otro medio mientras esperaba en la Lista.** Su entrada de Lista de espera se marca `CONVERTIDA` automáticamente al detectar la Reserva nueva que cumple sus criterios, sin necesidad de que pase por el flujo de notificación.
- **Un Cliente se anota en Lista de espera para "cualquier Staff" pero luego el único cupo libre es de un Staff específico que el Cliente, en el momento de confirmar, no quiere.** Puede rechazar la notificación sin penalización (no cuenta como No-show ni afecta su cuenta); su entrada pasa a `EXPIRADA_VENTANA` y, si quiere, puede volver a anotarse.
- **El Negocio cierra la Sede permanentemente mientras hay entradas de Lista de espera activas para esa Sede.** Todas las entradas pasan a `CANCELADA` con notificación explicativa al Cliente, consistente con `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` (cierre de Sede).

## Criterios de aceptación
- [ ] La notificación de cupo liberado siempre respeta el orden FIFO de registro.
- [ ] Ninguna entrada de Lista de espera puede bloquear o reservar un cupo sin que el Cliente confirme y pague explícitamente dentro de la ventana de 15 minutos.
- [ ] Un Cliente nunca puede tener más de 5 entradas activas simultáneas, validado en la API de creación.

## Checklist
- [x] Completo
- [ ] Revisado
