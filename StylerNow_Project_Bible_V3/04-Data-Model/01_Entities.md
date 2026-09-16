# 01 — Entities

## Objetivo
Definir cada entidad de datos del sistema — genérica a cualquier vertical — con sus campos normativos, sin especificar SQL (eso es responsabilidad de la implementación; este documento es el diseño que la implementación debe respetar).

## Alcance
Entidades de dominio. No incluye tablas puramente técnicas de infraestructura (sesiones, cachés). Las relaciones entre estas entidades están en `02_Relationships.md`; sus ciclos de vida en `03_State_Machines.md`.

## Reglas

### `negocio`
Tenant raíz. Campos normativos: `id`, `nombre`, `slug` (único, usado en URL de Marketplace), `categoria` (multi-valor: barbería, salón, spa, tatuajes, etc. — ver `Glossary.md`), `plan_id`, `estado` (ver State Machines), `identificacion_fiscal` (genérico, no asume solo NIT/Cédula — ADL-008), `ciudad`, `fecha_alta`, `comision_plataforma_pct` (override opcional dentro del rango de su Plan).

### `sede`
Campos: `id`, `negocio_id`, `nombre`, `direccion`, `ciudad`, `zona_horaria`, `horario_base` (estructura por día de la semana), `estado`.

### `staff`
Entidad genérica (ver ADL-001). Campos: `id`, `usuario_id`, `nombre`, `foto`, `especialidad` (texto libre configurado por el Negocio: "barbero", "estilista", "manicurista", etc. — es un **valor de dato**, nunca un tipo de entidad distinto), `bio`.

### `vinculo_staff_negocio`
Relación con atributos propios entre `staff` y `negocio` (no es una tabla puente vacía — tiene ciclo de vida propio). **Corregido por ADL-009: es 1:1 activo por Staff** (todo Staff pertenece a una única Barbería a la vez — ya no N:N con vínculos simultáneos a varios Negocios). Campos: `id`, `staff_id` (único mientras el vínculo esté `ACTIVO`/`INVITADO`/`SUSPENDIDO` — un Staff solo puede tener un vínculo no-`RETIRADO` a la vez), `negocio_id` (`business_id`), `sede_activa_id` (`branch_id` — la Sede vigente del Staff; un Staff puede tener `disponibilidad` configurada en más de una Sede, pero su `sede_activa_id` es siempre una sola, la que determina su alcance operativo del día), `es_guardian` (boolean — perfil Guardian otorgado/retirado por la Barbería, ver `03-Business-Rules/01_Roles.md`), `estado` (`INVITADO`/`ACTIVO`/`SUSPENDIDO`/`RETIRADO`), `comision_pct`, `fecha_ingreso`.

### `disponibilidad`
Horario laboral de un `vinculo_staff_negocio` por Sede. Campos: `id`, `vinculo_staff_negocio_id`, `sede_id`, `dia_semana`, `hora_inicio`, `hora_fin`.

### `bloqueo_ausencia`
Excepciones puntuales a la disponibilidad (vacaciones, incapacidad, cita personal). Campos: `id`, `vinculo_staff_negocio_id`, `fecha_inicio`, `fecha_fin`, `motivo`.

### `servicio`
Campos: `id`, `negocio_id`, `nombre`, `descripcion`, `duracion_minutos`, `precio_base`, `categoria_puntaje` (`estandar`/`premium`/`complementario` — ver `03-Business-Rules/05_Staff_Rewards.md`), `requiere_recurso_tipo_id` (nullable — ver ADL-002), `buffer_previo_minutos`, `buffer_posterior_minutos`, `estado` (`ACTIVO`/`INACTIVO`, soft delete — ver `05_Data_Retention.md`).

### `staff_servicio`
Tabla puente: qué Staff puede prestar qué Servicio (un Staff no necesariamente presta todos los Servicios del Negocio). Campos: `staff_id`, `servicio_id`.

### `recurso_tipo` y `recurso`
`recurso_tipo` (ej. "camilla", "cabina", "silla") define una categoría; `recurso` es la instancia física dentro de una Sede (ej. "Camilla 2"). Campos de `recurso`: `id`, `sede_id`, `recurso_tipo_id`, `nombre`, `estado` (`DISPONIBLE`/`FUERA_DE_SERVICIO`).

### `cliente`
Entidad global (no particionada por Negocio — ver `Glossary.md`). Campos: `id`, `usuario_id`, `nombre`, `telefono`, `email`, `fecha_nacimiento` (opcional, para regla de cumpleaños de `03-Business-Rules/04_Lealtad.md`), `fecha_registro`.

### `reserva`
La entidad transaccional central. Campos: `id`, `cliente_id`, `negocio_id`, `sede_id`, `staff_id` (asignado, nunca nulo tras confirmación — incluso si se pidió "cualquiera", se registra el Staff resultante), `recurso_id` (nullable), `hora_inicio`, `hora_fin`, `estado` (ver State Machines), `monto_total`, `monto_sena`, `precio_congelado` (snapshot del precio del Servicio al momento de confirmar — ver `Business_Rules_Bible.md`).

### `reserva_servicio`
Tabla puente: los Servicios (uno o más, combo) que componen una Reserva. Campos: `reserva_id`, `servicio_id`, `precio_congelado_unitario`.

### `pago`
Campos: `id`, `reserva_id` (o `gift_card_id`/`membresia_id` para pagos no ligados a una Reserva), `tipo` (`SENA`/`SALDO`/`GIFT_CARD`/`MEMBRESIA`), `monto`, `estado` (ver State Machines), `pasarela` (`WOMPI`, etc.), `id_transaccion_pasarela` (único, base de la idempotencia — ver `05-API/06_Webhooks.md`), `comision_plataforma_monto`.

### `propina`
Campos: `id`, `reserva_id`, `staff_id` (destinatario), `monto`.

### `punto_fidelizacion` (lote)
Campos: `id`, `cliente_id`, `negocio_id`, `cantidad`, `cantidad_disponible` (decrece con canjes, FIFO), `fecha_otorgamiento`, `fecha_expiracion`, `origen` (evento que lo generó).

### `puntaje_staff_evento`
El log inmutable de eventos del Sistema PRO/EXPERT/MASTER (ver `03-Business-Rules/05_Staff_Rewards.md`). Campos: `id`, `vinculo_staff_negocio_id`, `temporada_id`, `evento`, `puntos_delta`, `referencia_tipo`, `referencia_id`, `timestamp`.

### `temporada`
Campos: `id`, `fecha_inicio`, `fecha_fin`, `estado` (`EN_CURSO`/`CERRADA`/`CONSOLIDADA`).

### `nivel_staff_consolidado`
Snapshot del Nivel alcanzado por un `vinculo_staff_negocio` al cierre de cada `temporada`. Campos: `vinculo_staff_negocio_id`, `temporada_id`, `puntaje_final`, `nivel`.

### `resena`
Campos: `id`, `reserva_id` (una reseña siempre referencia la Reserva que la origina — reseñas verificadas por diseño), `cliente_id`, `negocio_id`, `staff_id`, `calificacion` (1-5), `comentario`, `estado` (`VISIBLE`/`REPORTADA`/`ELIMINADA`).

### `lista_espera`
Ver `03-Business-Rules/10_Waitlist_System.md`. Campos: `id`, `cliente_id`, `negocio_id`, `sede_id`, `staff_id` (nullable), `fecha_deseada_inicio`, `fecha_deseada_fin`, `estado`, `orden_fifo` (timestamp de creación, base del orden).

### `campana_publicitaria`
Campos: `id`, `negocio_id`, `formato` (`DESTACADO`/`PIN`/`BANNER`/`FLASH`), `presupuesto_diario`, `presupuesto_total`, `fecha_inicio`, `fecha_fin`, `estado`.

### `plan`
Campos: `id`, `nombre`, `precio_mensual`, `limite_sedes`, `limite_staff`, `funcionalidades` (lista de flags habilitados).

### `suscripcion`
Vínculo entre `negocio` y `plan` con su propio ciclo de vida (ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`). Campos: `id`, `negocio_id`, `plan_id`, `estado`, `fecha_inicio_ciclo`, `fecha_proximo_cobro`.

### `wallet`
Campos: `id`, `titular_tipo` (`NEGOCIO`/`CLIENTE`), `titular_id`, `saldo`.

### `evento_auditoria`
Ver `04_Audit.md` para el detalle completo del patrón. Campos: `id`, `entidad_tipo`, `entidad_id`, `accion`, `actor_tipo`, `actor_id`, `payload_antes`, `payload_despues`, `timestamp`, `motivo` (obligatorio en acciones de reversión/corrección).

## Estados
Ver `03_State_Machines.md` para las entidades con ciclo de vida propio (`negocio`, `reserva`, `pago`, `vinculo_staff_negocio`, `suscripcion`, `campana_publicitaria`, `lista_espera`, `temporada`).

## Permisos
Ver `03-Business-Rules/01_Roles.md` — el acceso a cada entidad sigue la matriz de roles; la implementación técnica de ese acceso vive en `06-Security/02_RLS.md`.

## Dependencias
- Depende de: `Glossary.md`, todo `03-Business-Rules`.
- De este documento dependen: `02_Relationships.md`, `03_State_Machines.md`, `05-API` (contratos reflejan estos campos), `06-Security/02_RLS.md`.

## Casos límite

- **Un Servicio requiere Recurso en un Negocio, pero no en otro** (ej. "masaje" requiere camilla en un spa, pero un Negocio de masajes a domicilio no usa Recurso físico registrado). `requiere_recurso_tipo_id` es nullable y configurable por Negocio a nivel de su propio `servicio`, nunca un valor fijo a nivel de categoría global.
- **Un Cliente nunca se registra formalmente (reserva como invitado).** Fuera de alcance de V1: toda Reserva requiere un `cliente_id` autenticado, para que la Seña, el historial y el Sistema de fidelización funcionen. No existe modo invitado.
- **Una persona trabajó en un Negocio, se retiró (`RETIRADO`), y ahora quiere vincularse a un Negocio distinto.** Válido: al estar `RETIRADO` su vínculo anterior, puede crear un `vinculo_staff_negocio` nuevo con otro `negocio_id` — sigue siendo la misma identidad `staff`, pero nunca tiene dos vínculos no-`RETIRADO` simultáneos (ADL-009).

## Criterios de aceptación
- [ ] Toda entidad transaccional (`reserva`, `pago`, `puntaje_staff_evento`) tiene un campo de auditoría verificable (quién y cuándo la creó/modificó).
- [ ] Ningún campo de esta lista es específico de una sola vertical (ej. no existe un campo `tipo_corte`).

## Checklist
- [x] Completo
- [ ] Revisado
