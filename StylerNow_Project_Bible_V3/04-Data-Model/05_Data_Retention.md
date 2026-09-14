# 05 — Data Retention

## Objetivo
Definir cuánto tiempo vive cada dato, cuándo se borra físicamente, cuándo solo se desactiva (soft delete), y cuándo se anonimiza — para que ninguna decisión de borrado sea ad-hoc.

## Alcance
Política de retención de datos de negocio. La retención de logs técnicos vive en `10-Operations/04_Logs_Policy.md`. La base legal colombiana que sustenta estos plazos vive en `06-Security/04_Compliance_Colombia.md`.

## Reglas

### Soft delete como default

Toda entidad que puede ser referenciada por un registro histórico (`servicio`, `recurso`, `staff`, `negocio`) usa **soft delete**: un campo `estado` (`ACTIVO`/`INACTIVO`) o equivalente, nunca un `DELETE` físico mientras existan referencias históricas. Esto es consecuencia directa de `04-Data-Model/02_Relationships.md`, caso límite de `servicio` desactivado con Reservas históricas.

### Tabla de retención por entidad

| Entidad | Retención mínima | Después de la retención | Motivo |
|---|---|---|---|
| `reserva`, `pago`, `evento_auditoria` (transaccionales/fiscales) | 5 años | Se archivan a almacenamiento frío, nunca se borran | Retención fiscal colombiana (`06-Security/04_Compliance_Colombia.md`) |
| Perfil de `cliente` (datos personales: nombre, teléfono, email) | Mientras la cuenta esté activa + 2 años de inactividad | Se anonimiza (no se borra el `id`, se reemplaza el dato identificable), salvo solicitud explícita de supresión, que se atiende de inmediato dentro de los límites de la fila de arriba | Habeas Data (derecho de portabilidad y minimización) |
| Notas y fotos de CRM (`03-Business-Rules/07_CRM.md`) | Igual que el perfil de Cliente al que pertenecen | Se eliminan físicamente al anonimizar el perfil (a diferencia del dato transaccional, no tienen valor fiscal) | Habeas Data |
| `punto_fidelizacion` (lote de puntos) | Hasta expiración (`03-Business-Rules/04_Loyalty.md`) + 1 año | Se archiva, no se borra (evidencia de pasivo histórico) | Auditoría financiera del Negocio |
| `puntaje_staff_evento` | Indefinida mientras el `vinculo_staff_negocio` exista; tras `RETIRADO`, 3 años | Se archiva | Trazabilidad del Sistema PRO/EXPERT/MASTER, posibles disputas |
| `resena` en estado `ELIMINADA` | Indefinida (no se borra físicamente) | Permanece oculta pero consultable por SuperSU | Evidencia de moderación, posible disputa legal |
| Logs de sesión / autenticación | 12 meses | Se borran físicamente | No son datos de negocio, solo seguridad operativa — ver `10-Operations/04_Logs_Policy.md` |

### Anonimización (definición operativa)

Anonimizar un `cliente` significa: reemplazar `nombre`, `telefono`, `email`, `fecha_nacimiento` por valores no identificables (ej. `"Cliente eliminado #{id}"`), conservando el `id` interno y todas las relaciones (`reserva`, `pago`, `punto_fidelizacion`) intactas para que la integridad referencial y los reportes históricos del Negocio no se rompan.

### Derecho de portabilidad

Un Cliente puede solicitar una exportación de sus propios datos (Reservas, Puntos, reseñas escritas) en un formato legible, dentro de un plazo máximo de 15 días hábiles desde la solicitud, conforme a `06-Security/04_Compliance_Colombia.md`.

## Estados
No aplica una máquina de estados adicional — el soft delete usa el campo `estado` ya definido por entidad en `01_Entities.md`.

## Permisos
- El Cliente puede solicitar supresión o portabilidad de sus propios datos desde Cliente PWA.
- Solo SuperSU (o un proceso automatizado programado, con `actor_tipo = SISTEMA`) ejecuta la anonimización o el archivado a almacenamiento frío.

## Dependencias
- Depende de: `01_Entities.md`, `04_Audit.md`, `03-Business-Rules/07_CRM.md`, `03-Business-Rules/04_Loyalty.md`.
- De este documento dependen: `06-Security/04_Compliance_Colombia.md`, `10-Operations/02_Migration_Strategy.md`, `10-Operations/03_Disaster_Recovery.md`.

## Casos límite

- **Un Cliente solicita supresión pero tiene una Reserva `CONFIRMADA` futura.** Se le informa que debe cancelar o completar la Reserva antes de procesar la supresión completa; sus datos de contacto permanecen activos hasta ese momento (no se puede anonimizar un contacto que el Negocio aún necesita para prestar un servicio ya pagado).
- **Un Negocio se cancela definitivamente (`CANCELADO`).** Sus datos transaccionales siguen la retención de 5 años igual que cualquier otro; su perfil público desaparece del Marketplace de inmediato, pero los datos no se destruyen — SuperSU conserva acceso para efectos de auditoría y eventuales requerimientos legales.
- **Se solicita portabilidad de datos y el Cliente tiene actividad en 5 Negocios distintos.** La exportación incluye la actividad de todos los Negocios donde el Cliente tuvo Reservas (es su dato, particionado por Negocio pero suyo en agregado), no requiere 5 solicitudes separadas.

## Criterios de aceptación
- [ ] Ninguna entidad transaccional se borra físicamente antes de cumplir su retención mínima, verificable por ausencia de sentencias `DELETE` físicas sobre esas tablas en el código de aplicación.
- [ ] Una solicitud de portabilidad se resuelve dentro de 15 días hábiles, medible y monitoreado.
- [ ] Una anonimización preserva el 100% de la integridad referencial de las entidades relacionadas.

## Checklist
- [x] Completo
- [ ] Revisado
