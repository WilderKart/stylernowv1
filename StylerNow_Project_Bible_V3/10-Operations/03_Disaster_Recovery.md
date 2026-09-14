# 03 — Disaster Recovery

## Objetivo
Definir los objetivos de recuperación (cuánto se puede perder, cuánto se puede tardar en recuperar) y el procedimiento de respaldo, para que una falla de infraestructura nunca sea el momento en que el equipo descubre que no había un plan.

## Alcance
Continuidad de datos y servicio a nivel plataforma. No cubre la reversión de una transacción de negocio individual (eso es auditoría, `04-Data-Model/04_Audit.md`) — este documento cubre la pérdida o indisponibilidad de infraestructura completa.

## Reglas

### Objetivos de recuperación

- **RPO (Recovery Point Objective) — pérdida máxima aceptable de datos:** 15 minutos. Los respaldos/replicación deben garantizar que, ante una falla catastrófica, se pierda como máximo 15 minutos de transacciones.
- **RTO (Recovery Time Objective) — tiempo máximo de indisponibilidad:** 4 horas para restaurar el servicio transaccional core (Reservas, Pagos); 24 horas para funcionalidades no core (Reportes avanzados, IA).

### Respaldo

- Respaldo completo de base de datos diario, retenido 30 días.
- Replicación continua (near-real-time) para minimizar el RPO de 15 minutos.
- Los respaldos se prueban con una restauración real (no solo se generan y se asume que funcionan) en un ambiente aislado, con una frecuencia mínima trimestral — un respaldo nunca probado no cuenta como un respaldo confiable.

### Priorización de recuperación por criticidad

1. **Crítico (RTO 4h):** autenticación, Reservas, Pagos, RLS/seguridad.
2. **Alto (RTO 12h):** Marketplace, Notificaciones, App Staff (agenda y check-in).
3. **Medio (RTO 24h):** Reportes, CRM, Sistema PRO/EXPERT/MASTER (su cálculo puede recuperarse desde el log de auditoría, que es inmutable y no se pierde con la misma prioridad que datos transaccionales activos).
4. **Bajo (RTO 48h+):** IA/recomendaciones, Marketplace Ads (puede pausarse temporalmente sin efecto de negocio grave más allá de pérdida de ingresos publicitarios de ese periodo).

### Comunicación durante un incidente

Un incidente que afecta disponibilidad se comunica a los Negocios activos (banner en Panel Negocio/App Staff) dentro de los primeros 30 minutos del incidente confirmado, con actualizaciones cada hora hasta resolución, consistente con el principio de transparencia de `06-Security/01_Security_Model.md`.

## Estados
No aplica una máquina de estados de negocio — este documento define un procedimiento operativo, no una entidad.

## Permisos
La ejecución de restauración es responsabilidad del equipo de ingeniería/infraestructura; SuperSU recibe la comunicación de estado del incidente y decide comunicación adicional a Negocios si el incidente lo amerita más allá del banner automático.

## Dependencias
- Depende de: `04-Data-Model/05_Data_Retention.md`, `04-Data-Model/04_Audit.md`, `06-Security/01_Security_Model.md`.
- De este documento dependen: `04_Logs_Policy.md`, `02_Migration_Strategy.md` (respaldo previo a migraciones destructivas).

## Casos límite

- **Ocurre una falla catastrófica justo durante la ventana de procesamiento de webhooks de pago (`05-API/06_Webhooks.md`).** La idempotencia por `id_transaccion_pasarela` es lo que garantiza que, al restaurar desde el respaldo más reciente y reprocesar eventos de la pasarela que pudieron perderse en los últimos 15 minutos (RPO), no se generen efectos duplicados — el diseño de idempotencia de pagos y el de disaster recovery son complementarios por diseño, no coincidencia.
- **Un respaldo trimestral de prueba falla al restaurarse.** Se trata como incidente crítico inmediato (no se espera al siguiente trimestre) — se corrige el proceso de respaldo y se repite la prueba de restauración antes de considerar el sistema recuperado de ese hallazgo.
- **El incidente afecta solo a una región/proveedor específico de infraestructura, no a toda la plataforma.** La comunicación se ajusta al alcance real (no se alarma a Negocios no afectados), pero el procedimiento de RPO/RTO aplica igual dentro del alcance afectado.

## Criterios de aceptación
- [ ] Todo respaldo se prueba con restauración real al menos trimestralmente, con evidencia documentada.
- [ ] Un incidente simulado de caída completa se resuelve dentro del RTO de 4 horas para los sistemas críticos, verificable en un simulacro (game day).
- [ ] Ninguna restauración desde respaldo genera datos duplicados en transacciones de pago, gracias a la idempotencia ya garantizada por `05-API/06_Webhooks.md`.

## Checklist
- [x] Completo
- [ ] Revisado
