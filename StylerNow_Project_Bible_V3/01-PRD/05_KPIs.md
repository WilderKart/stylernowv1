# 05 — KPIs

## Objetivo
Definir cada métrica que el equipo usa para evaluar el producto, con fórmula exacta, para que "conversión" o "retención" no signifiquen algo distinto en cada dashboard.

## Alcance
KPIs de producto y negocio a nivel plataforma. Las definiciones técnicas de cómo se calculan (SQL, agregaciones) viven en `10-Operations/06_Analytics_Definitions.md`; este documento fija el significado de negocio.

## Reglas

### KPIs de adquisición y Marketplace

| KPI | Fórmula | Frecuencia |
|---|---|---|
| Negocios activos | Conteo de Negocios en estado `ACTIVO` (ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`) | Diaria |
| Tasa de aprobación de onboarding | Negocios aprobados ÷ Negocios que enviaron solicitud, en un periodo | Semanal |
| Ciudades activas | Conteo de ciudades con al menos 1 Negocio `ACTIVO` | Semanal |
| Conversión de Marketplace | Reservas iniciadas desde el Marketplace ÷ Visitas a perfil de Negocio desde el Marketplace | Diaria |

### KPIs transaccionales

| KPI | Fórmula | Frecuencia |
|---|---|---|
| Reservas totales | Conteo de Reservas en estado distinto de `CANCELADA` creadas en el periodo | Diaria |
| Tasa de No-show | Reservas en estado `NO_SHOW` ÷ Reservas `CONFIRMADA` cuya fecha ya pasó | Semanal |
| Tasa de cancelación | Reservas `CANCELADA` ÷ Reservas creadas en el periodo | Semanal |
| Ticket promedio | Suma de montos totales de Reservas completadas ÷ número de Reservas completadas | Semanal |
| GMV (Gross Merchandise Value) | Suma de montos totales de todas las Reservas completadas en el periodo (incluye lo pagado en Sede, no solo la Seña) | Mensual |

### KPIs de monetización

| KPI | Fórmula | Frecuencia |
|---|---|---|
| MRR (Monthly Recurring Revenue) | Suma de precios de Plan de todos los Negocios `ACTIVO`, normalizado a mensual | Mensual |
| ARPU (Average Revenue Per User) de Negocio | MRR ÷ Negocios `ACTIVO` | Mensual |
| Ingreso por comisión | Suma de comisión de plataforma retenida sobre Señas procesadas en el periodo | Mensual |
| Ingreso por publicidad | Suma de gasto ejecutado en Marketplace Ads en el periodo | Mensual |
| Churn de Negocios | Negocios que pasan a `CANCELADO` en el periodo ÷ Negocios `ACTIVO` al inicio del periodo | Mensual |

### KPIs de retención y fidelización (Cliente)

| KPI | Fórmula | Frecuencia |
|---|---|---|
| Clientes recurrentes | Clientes con 2+ Reservas completadas en los últimos 90 días ÷ Clientes con al menos 1 Reserva completada en los últimos 90 días | Mensual |
| LTV de Cliente (aproximado) | Ticket promedio × frecuencia promedio de visitas anuales × 2 años (horizonte de referencia) | Trimestral |
| Riesgo de abandono | Definido operativamente en `09-CRM-Intelligence/04_AI_Business.md` (modelo, no fórmula simple) | Semanal |

### KPIs del Resumen del día (Panel Negocio — `02-UX/09_Business_Panel.md`)

Estos KPIs no existían en este documento aunque `02-UX/09_Business_Panel.md`
y `07-QA/04_Business.md` (QA-BIZ-031) ya los referenciaban — se completan
acá para que ningún KPI se calcule de dos formas distintas (criterio de
aceptación de este documento). "Hoy"/"esta semana" se calculan en huso
horario `America/Bogota`, no UTC — ver `src/lib/formato.ts`.

| KPI | Fórmula | Frecuencia |
|---|---|---|
| Citas de hoy | Conteo de Reservas cuya `hora_inicio` cae hoy, en estado distinto de `CANCELADA` | Tiempo real |
| Ingresos del día | Suma de `monto_total` de Reservas `COMPLETADA` cuya `hora_inicio` cae hoy — extensión de la fórmula de GMV a un solo día; una cita `CONFIRMADA` pero todavía no completada no suma acá | Tiempo real |
| % de ocupación del día | Minutos reservados hoy (Reservas distintas de `CANCELADA`, un `NO_SHOW` sigue contando porque igual ocupó la agenda) ÷ minutos de `disponibilidad` configurada hoy por el Staff `ACTIVO` de la Sede (o del Negocio si es vista agregada), descontando bloqueos de ausencia que se solapen con esa franja. `null` (no `0%`) cuando no hay ninguna disponibilidad configurada ese día — evita mostrar "0% de ocupación" cuando en realidad nadie tiene agenda cargada | Tiempo real |
| Comisión generada por Staff (ranking semanal) | Suma de (`monto_total` × `comision_pct` ÷ 100) de Reservas `COMPLETADA` de esa persona en la semana en curso (lunes a domingo) — misma fórmula de comisión de Staff de `08-Growth-Monetization/02_Commissions.md`, agregada por semana | Tiempo real |

**Simplificación V1 documentada** (no un bloqueante de lanzamiento, igual
que la predicción de ocupación de IA en `09-CRM-Intelligence/04_AI_
Business.md`): un bloqueo de ausencia que se solapa PARCIALMENTE con una
franja de disponibilidad descuenta la franja completa, no solo la porción
solapada. Para el caso típico (vacaciones, día de incapacidad completo)
esto es exacto; un refinamiento a nivel de minuto exacto es candidato de
mejora continua, no una corrección urgente.

### KPIs de Staff (Sistema PRO/EXPERT/MASTER)

| KPI | Fórmula | Frecuencia |
|---|---|---|
| Distribución de niveles | % de Staff en PRO / EXPERT / MASTER sobre el total de Staff activo | Mensual |
| Tasa de degradación de nivel | Staff que baja de nivel en una temporada ÷ Staff evaluado en esa temporada | Por temporada (ver `03-Business-Rules/05_Staff_Rewards.md`) |
| Producción promedio por Staff | Suma de puntos de producción del periodo ÷ número de Staff activo | Mensual |

## Estados
No aplica — las métricas no tienen ciclo de vida propio; se recalculan sobre el estado de otras entidades.

## Permisos
- SuperSU ve todos los KPIs a nivel plataforma.
- Barbería ve únicamente los KPIs recalculados sobre su propio Negocio (Reservas, GMV, No-show, retención de sus Clientes).
- Staff ve únicamente sus propios KPIs de producción (parte de App Staff).

## Dependencias
- Depende de: `04-Data-Model/03_State_Machines.md` (los KPIs se calculan sobre estados definidos ahí).
- De este documento depende: `10-Operations/06_Analytics_Definitions.md` (implementación técnica exacta de cada fórmula).

## Casos límite

- **Una Reserva pasa de `CONFIRMADA` a `NO_SHOW` después de que ya se calculó el KPI semanal.** Los KPIs históricos no se recalculan retroactivamente salvo corrección de un bug; el número de la semana en que se calculó queda como snapshot. El estado actualizado se refleja en el periodo donde ocurre el cambio.
- **Un Negocio cambia de Plan a mitad de mes.** El MRR de ese mes se prorratea según la regla de `01-PRD/03_Monetization.md`, no se cuenta el precio completo de ambos planes.
- **Un Cliente hace una Reserva y la cancela el mismo día.** Cuenta en "Reservas creadas" pero no en GMV ni en Ticket promedio (solo Reservas completadas cuentan para esos dos).

## Criterios de aceptación
- [ ] Cada KPI mostrado en cualquier dashboard de cualquier superficie tiene una entrada correspondiente en esta tabla.
- [ ] Ningún KPI se calcula de dos formas distintas en dos lugares distintos del producto.

## Checklist
- [x] Completo
- [ ] Revisado
