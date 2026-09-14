# 04 — Audit

## Objetivo
Definir el patrón único de auditoría que todo el sistema usa, de modo que "todo evento crítico debe ser reversible mediante auditoría" (la regla que ya declaraba `03-Business-Rules/08_Edge_Cases.md`) tenga una implementación concreta y no sea solo una aspiración.

## Alcance
Patrón de auditoría de datos de negocio. La auditoría técnica de infraestructura (logs de servidor, errores de aplicación) vive en `10-Operations/04_Logs_Policy.md` — son capas distintas: esta es auditoría de **qué cambió en el negocio**, esa es observabilidad de **qué hizo el sistema técnicamente**.

## Reglas

### El patrón: eventos inmutables, nunca edición en sitio

Ninguna entidad crítica del sistema (`reserva`, `pago`, `puntaje_staff_evento`, `punto_fidelizacion`, `suscripcion`, `resena` en su transición a `ELIMINADA`) se modifica destructivamente. Cada cambio de estado o de valor relevante genera una fila en `evento_auditoria` (ver `01_Entities.md`) con el estado anterior y el nuevo. Esto es lo que permite que ADL-006 ("todo cambio de puntaje queda registrado como evento inmutable") y la regla de recuperación de `03-Business-Rules/08_Edge_Cases.md` sean ciertas en la práctica, no solo en la documentación.

### Qué se audita (obligatorio)

| Entidad | Eventos auditados |
|---|---|
| `reserva` | Cada transición de estado (`03_State_Machines.md`), cada reprogramación (con horario anterior y nuevo) |
| `pago` | Cada transición de estado, cada reembolso (con monto y motivo categorizado) |
| `puntaje_staff_evento` | Es en sí mismo un log de auditoría — no requiere una tabla adicional, pero toda reversión de un evento debe insertar un evento opuesto explícito, nunca eliminar la fila original |
| `punto_fidelizacion` | Otorgamiento, canje (parcial o total), expiración, anulación por suspensión de Negocio |
| `suscripcion` | Cambio de Plan, fallo de cobro, suspensión, reactivación |
| `resena` | Reporte, decisión de moderación (mantener/eliminar), con el `actor_id` de SuperSU que decidió |
| Impersonación de SuperSU | Entrada y salida del modo, con motivo — ver `03-Business-Rules/01_Roles.md` |
| Configuración de plataforma (comisión, límites de Plan, ciudades habilitadas) | Todo cambio, con el `actor_id` de SuperSU |

### Estructura del evento

`entidad_tipo`, `entidad_id`, `accion` (ej. `TRANSICION_ESTADO`, `REEMBOLSO`, `REVERSION_PUNTAJE`), `actor_tipo` (`CLIENTE`/`STAFF`/`ADMIN_NEGOCIO`/`SUPER_ADMIN`/`SISTEMA`), `actor_id` (nullable si `actor_tipo = SISTEMA`, ej. expiración automática), `payload_antes`, `payload_despues`, `timestamp`, `motivo` (obligatorio cuando `accion` es una corrección o reversión manual; opcional en transiciones automáticas estándar).

### Retención del log de auditoría

El log de auditoría se retiene un mínimo de 5 años (alineado con la retención fiscal de `06-Security/04_Compliance_Colombia.md`), independientemente de si el Negocio o Cliente asociado solicita eliminación de sus datos personales (ver caso límite de Habeas Data en `03-Business-Rules/07_CRM.md`) — el log se anonimiza (se reemplaza el dato personal identificable por una referencia opaca) pero el evento en sí no se borra, porque es evidencia de integridad transaccional, no un dato de perfil.

## Estados
No aplica — un `evento_auditoria` es inmutable desde su creación, no tiene ciclo de vida propio.

## Permisos
- Una Barbería ve el log de auditoría de su propio Negocio (Reservas, Pagos, Puntaje de su Staff).
- Un Staff ve su propio log de `puntaje_staff_evento`.
- Solo SuperSU ve el log completo de impersonación y de configuración de plataforma.
- Nadie puede eliminar una fila de `evento_auditoria` desde ninguna superficie de producto — solo un proceso de anonimización por cumplimiento legal, ejecutado a nivel de infraestructura, puede tocar el dato personal referenciado (nunca la fila del evento en sí).

## Dependencias
- Depende de: `01_Entities.md`, `03_State_Machines.md`, ADL-006.
- De este documento dependen: `06-Security/01_Security_Model.md`, `06-Security/04_Compliance_Colombia.md`, `10-Operations/04_Logs_Policy.md`, `03-Business-Rules/05_Staff_Rewards.md` (que exige este patrón explícitamente).

## Casos límite

- **Un desarrollador necesita corregir un dato incorrecto que no fue causado por un evento de negocio** (ej. error de migración). Se documenta como una `accion = CORRECCION_TECNICA` con `actor_tipo = SISTEMA` y `motivo` obligatorio describiendo el ticket o incidente que la originó — nunca se hace un `UPDATE` silencioso sin fila de auditoría, ni siquiera para "arreglar" datos.
- **El volumen del log de auditoría crece de forma insostenible a largo plazo.** No se trunca ni se resume — se particiona/archiva a almacenamiento frío después de 12 meses (detalle técnico en `10-Operations/03_Disaster_Recovery.md`), pero sigue siendo consultable, solo con mayor latencia.
- **Dos eventos de auditoría parecen contradecirse** (ej. un reembolso y una reversión de reembolso muy seguidos). No se "limpia" el historial — ambos eventos permanecen visibles en orden cronológico; es responsabilidad de quien lee el log interpretarlo en secuencia, tal como ocurrió.

## Criterios de aceptación
- [ ] Ninguna entidad de la tabla "Qué se audita" puede cambiar de estado en producción sin generar una fila de auditoría correspondiente, verificable con una prueba automatizada.
- [ ] Una solicitud de eliminación de datos personales (Habeas Data) nunca borra una fila de `evento_auditoria`, solo anonimiza sus referencias a datos personales.

## Checklist
- [x] Completo
- [ ] Revisado
