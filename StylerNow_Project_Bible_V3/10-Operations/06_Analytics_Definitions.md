# 06 — Analytics Definitions

## Objetivo
Traducir cada KPI de negocio de `01-PRD/05_KPIs.md` a su definición técnica exacta (fuente de datos, agregación, ventana de tiempo), para que un ingeniero de datos y un CPO nunca calculen el mismo KPI de dos formas distintas.

## Alcance
Implementación técnica de las fórmulas ya fijadas en `01-PRD/05_KPIs.md`. No introduce KPIs nuevos — cualquier métrica nueva se define primero ahí, y su implementación técnica se agrega aquí después.

## Reglas

### Principio de fuente única

Todo KPI se calcula desde las tablas transaccionales de origen (`04-Data-Model/01_Entities.md`), nunca desde una tabla de resumen pre-agregada que pueda desincronizarse — cualquier tabla de agregación (para performance de dashboards) se trata como una caché derivada, recalculable en cualquier momento desde el origen, nunca como la fuente de verdad en sí misma.

### Definición técnica por KPI (extracto representativo — todo KPI de `01-PRD/05_KPIs.md` sigue este mismo patrón de documentación)

| KPI | Fuente | Ventana | Nota de implementación |
|---|---|---|---|
| Negocios activos | `negocio` donde `estado = ACTIVO` | Snapshot al momento de la consulta | No es una suma acumulada histórica, es un conteo del estado actual |
| Tasa de No-show | `reserva` donde `estado = NO_SHOW` ÷ `reserva` donde `estado IN (NO_SHOW, COMPLETADA)` y `hora_inicio` ya pasó | Semanal móvil | Excluye explícitamente `CANCELADA` del denominador (una cancelación no es un No-show, `03-Business-Rules/09_No_Show_Policy.md`) |
| MRR | Suma de `plan.precio_mensual` de toda `suscripcion` en `ACTIVA`, normalizado a base mensual | Snapshot mensual (primer día del mes) | Un Negocio en `EN_MORA` (aún no suspendido) sigue contando en el MRR — el MRR mide compromiso de ingreso, no cobro efectivamente recibido (ese es un KPI de caja distinto, no definido en V1) |
| Conversión de Marketplace | `reserva` creada con `origen = MARKETPLACE` ÷ eventos de "vista de perfil" desde Marketplace | Diaria | Requiere que cada vista de perfil público genere un evento de analítica propio, distinto de una request de API estándar — ver instrumentación abajo |

### Instrumentación de eventos de producto (no transaccionales)

Ciertos KPIs (Conversión de Marketplace, CTR de campañas de `08-Growth-Monetization/06_Advertising_System.md`) requieren eventos de analítica de producto que no corresponden a una escritura de negocio (ej. "vista de perfil" no crea ninguna entidad de dominio) — estos eventos se capturan en una capa de analítica de producto separada de las tablas transaccionales, con su propia retención (ver `04-Data-Model/05_Data_Retention.md`, no cubierta por la retención transaccional de 5 años, sino tratada como dato de producto con una retención de 24 meses).

## Estados
No aplica — documento de definición de cálculo, no de entidad.

## Permisos
El acceso a cada KPI calculado sigue la matriz de `01-PRD/05_KPIs.md` (SuperSU ve todo; Negocio ve lo propio; Staff ve lo suyo).

## Dependencias
- Depende de: `01-PRD/05_KPIs.md`, `04-Data-Model/01_Entities.md`.
- De este documento dependen: los dashboards de las 4 superficies, `05_Release_Process.md` (umbral de tasa de error para rollout progresivo se define con el mismo rigor).

## Casos límite

- **Un KPI calculado en tiempo real (Dashboard) difiere ligeramente de un reporte generado por lote nocturno para el mismo periodo.** Se documenta como comportamiento esperado si el reporte de lote usa datos consolidados de fin de día y el dashboard usa datos en vivo con transacciones aún en curso — la diferencia debe ser transitoria y converger al finalizar el día, nunca una discrepancia estructural.
- **Un Negocio cuestiona un número de KPI mostrado en su Panel.** Debe ser posible, para el equipo de soporte, reconstruir exactamente ese número desde las tablas de origen siguiendo la definición de este documento — si no es reconstruible, es un defecto de implementación, no una explicación aceptable de "así lo calcula el sistema".

## Criterios de aceptación
- [ ] Todo KPI de `01-PRD/05_KPIs.md` tiene una entrada correspondiente en este documento antes de implementarse en cualquier dashboard.
- [ ] Ningún KPI se calcula desde una tabla de agregación sin que exista una forma de recalcularlo desde el origen para efectos de auditoría.

## Checklist
- [x] Completo
- [ ] Revisado
