# 02 — Migration Strategy

## Objetivo
Definir cómo se migran datos en los tres escenarios que la misión exige explícitamente: migración de un Negocio desde un sistema externo (competencia) hacia StylerNow, migración de Staff entre Sedes/Negocios, y migración de esquema de base de datos entre versiones de la plataforma.

## Alcance
Estrategia de migración de datos. No cubre el proceso de despliegue de código en sí (`05_Release_Process.md`).

## Reglas

### Migración de un Negocio desde un sistema externo (onboarding con datos existentes)

- Un Negocio que ya opera con otro sistema (o con hojas de cálculo) puede importar: catálogo de Servicios, lista de Clientes (con su consentimiento capturado en el momento de importación, `06-Security/04_Compliance_Colombia.md`), historial de Reservas pasadas (solo como dato informativo, no genera `pago` ni auditoría transaccional retroactiva, ver Casos límite).
- Formato de importación: plantilla CSV estandarizada, validada campo por campo antes de confirmar la carga (errores se muestran por fila, la importación no es todo-o-nada: las filas válidas se cargan y las inválidas se reportan para corrección).
- Un Negocio en migración desde un competidor con datos de disponibilidad de Staff se configura manualmente después de la importación de datos base — la disponibilidad no se infiere automáticamente de un sistema externo, por consistencia con la validación estricta de `03-Business-Rules/02_Booking_Rules.md`.

### Migración de Staff entre Sedes/Negocios

Ya cubierta como regla de negocio en `03-Business-Rules/01_Roles.md` y `03-Business-Rules/05_Staff_Rewards.md` (el puntaje no viaja entre Negocios, sí entre Sedes del mismo Negocio) — este documento solo añade la mecánica operativa: la Barbería ejecuta la reasignación desde `02-UX/09_Business_Panel.md`, que actualiza `disponibilidad` sin crear un `vinculo_staff_negocio` nuevo si es la misma relación Staff-Negocio.

### Migración de esquema de base de datos (versiones de plataforma)

- Toda migración de esquema es aditiva por defecto (agregar columna/tabla) y reversible (`down migration` disponible) antes de desplegarse a producción.
- Una migración destructiva (eliminar columna/tabla) requiere: (1) que el campo/tabla lleve al menos un ciclo de release completo marcado como deprecado primero, (2) confirmación de que ninguna entidad activa lo referencia, (3) respaldo completo antes de ejecutar (`03_Disaster_Recovery.md`).
- Las migraciones se ejecutan sin tiempo de inactividad perceptible para el usuario (estrategia expand-contract: agregar lo nuevo, migrar tráfico, remover lo viejo en un paso posterior).

## Estados
No aplica una máquina de estados de negocio — la migración de datos de un Negocio nuevo sigue el mismo flujo de onboarding de `02-UX/02_Onboarding.md`, solo con un origen de datos distinto (importado vs. manual).

## Permisos
- La Barbería ejecuta su propia importación de datos durante onboarding.
- Las migraciones de esquema técnico son responsabilidad exclusiva del equipo de ingeniería, coordinadas con `05_Release_Process.md`.

## Dependencias
- Depende de: `02-UX/02_Onboarding.md`, `03-Business-Rules/01_Roles.md`, `06-Security/04_Compliance_Colombia.md`, `03_Disaster_Recovery.md`.
- De este documento dependen: `05_Release_Process.md`.

## Casos límite

- **Un Negocio importa un historial de Reservas pasadas de un sistema externo.** No genera registros de `pago` ni comisión retroactiva (StylerNow nunca procesó esos pagos realmente) — se marca explícitamente como "Historial importado, no verificado por StylerNow" en la UI, para que nunca se confunda con una Reserva real completada dentro de la plataforma (esto también excluye ese historial del cálculo de reseñas verificadas, que exige una `reserva` real completada en StylerNow).
- **Un archivo de importación de Clientes incluye datos de personas que nunca dieron consentimiento a StylerNow.** El Negocio, como Encargado del Tratamiento (`06-Security/04_Compliance_Colombia.md`), declara explícitamente durante la importación que cuenta con la base legal para el tratamiento de esos datos (checkbox de responsabilidad legal); StylerNow no verifica individualmente cada consentimiento importado, pero registra la declaración del Negocio con timestamp como evidencia.
- **Una migración de esquema destructiva se ejecuta y se descubre después que un campo deprecado sí tenía referencias activas no detectadas.** Es exactamente el escenario que la regla de "un ciclo completo como deprecado antes de eliminar" busca prevenir; si ocurre de todas formas, se resuelve mediante el respaldo de `03_Disaster_Recovery.md` y se documenta como incidente en el `Architecture_Decision_Log.md`.

## Criterios de aceptación
- [ ] Ninguna importación de datos es todo-o-nada — errores parciales se reportan sin bloquear las filas válidas.
- [ ] Ningún historial importado se confunde con una transacción real de StylerNow en ningún reporte o cálculo de KPI.
- [ ] Toda migración de esquema destructiva pasa por al menos un ciclo de deprecación documentado antes de ejecutarse.

## Checklist
- [x] Completo
- [ ] Revisado
