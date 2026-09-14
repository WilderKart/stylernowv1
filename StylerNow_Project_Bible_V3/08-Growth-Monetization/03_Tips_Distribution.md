# 03 — Tips Distribution

## Objetivo
Definir cómo un Cliente agrega una propina dentro de la app y cómo se garantiza que llegue íntegra al Staff correcto, sin ambigüedad en Reservas de combo con más de un Staff involucrado.

## Alcance
Cubre la propina digital gestionada dentro de StylerNow. No cubre propina en efectivo entregada directamente en Sede (fuera del alcance de cualquier sistema digital, por definición).

## Reglas

### Momento de la propina

El Cliente puede agregar una propina en dos momentos: (a) al pagar la Seña, como una estimación anticipada, o (b) después de que la Reserva pasa a `COMPLETADA`, con el detalle real del servicio ya conocido (opción recomendada por defecto en la UI, ver `02-UX/06_Payments.md`).

### Cálculo y destino

- La propina es un monto que el Cliente define libremente (valor fijo o % del valor del Servicio, a elección del Cliente en la UI) — StylerNow no impone mínimos ni sugiere porcentajes agresivos por defecto.
- El 100% de la propina se acredita al `staff_id` de la Reserva. **StylerNow no retiene comisión de plataforma sobre propinas** (ver `02_Commissions.md`, regla explícita).
- La propina se procesa por la misma pasarela que la Seña, pero como un `pago` de `tipo = PROPINA` independiente, con su propio registro — nunca se mezcla con el monto de la Seña en un solo cargo sin desglose.

### Reparto en Reservas con más de un Staff (caso de combo)

Si una Reserva involucra un único `staff_id` (regla general de V1, ver `04-Data-Model/02_Relationships.md`: una Reserva tiene exactamente un Staff asignado), la propina no tiene ambigüedad de reparto — va completa a ese Staff. Si en el futuro se soporta multi-staff por Reserva (fuera de alcance V1, ver `Business_Rules_Bible.md`), este documento deberá actualizarse con una regla de reparto explícita antes de habilitar esa funcionalidad — no se lanza multi-staff sin que exista esa regla escrita primero.

### Visibilidad para el Staff

El Staff ve en su App Staff el desglose de propinas recibidas por periodo (día/semana/mes), acreditadas inmediatamente al confirmarse el pago de la propina (no espera a la liquidación del Wallet del Negocio, porque la propina no pasa por el Wallet del Negocio — es un flujo directo Cliente → Staff, mediado técnicamente por StylerNow pero sin retención del Negocio).

### Pago físico de la propina al Staff

Igual que la comisión de Staff (`02_Commissions.md`), el desembolso físico de la propina acumulada (transferencia al Staff) ocurre según el ciclo de liquidación que el Negocio gestione — en V1, StylerNow registra y muestra el monto adeudado por propinas al Staff, pero no ejecuta transferencias bancarias directas al Staff (esto es una Decisión abierta para una fase posterior, igual que el retiro automático de `02_Commissions.md`).

## Estados
Una `propina` sigue el mismo ciclo de estado que cualquier `pago` (`04-Data-Model/03_State_Machines.md`): `PENDIENTE` → `APROBADO` (o `RECHAZADO`), con posibilidad de `REEMBOLSADO` si el Cliente disputa.

## Permisos
- El Cliente decide libremente si agrega propina y su monto.
- El Staff ve únicamente sus propias propinas recibidas.
- La Barbería ve el agregado de propinas de su Negocio a nivel de reporte (para entender el desempeño de su Staff), pero no puede modificar ni retener una propina — es dinero del Staff, no del Negocio.

## Dependencias
- Depende de: `02_Commissions.md`, `03-Business-Rules/03_Payment_Rules.md`.
- De este documento dependen: `02-UX/06_Payments.md`, `05-API/04_Payments.md`, `09-CRM-Intelligence/03_AI_Staff.md` (propinas como señal de desempeño cualitativo del Staff).

## Casos límite

- **El Cliente agrega propina pero luego la Reserva se cancela antes de completarse** (caso de propina anticipada en el momento de la Seña). La propina se reembolsa al 100% automáticamente junto con la Seña, sin excepción — una propina nunca se retiene por un servicio que no se prestó.
- **El Cliente disputa (contracargo) un cobro que incluía Seña + propina en la misma transacción de pasarela.** Dado que se procesan como `pago` independientes (regla de arriba), la disputa se resuelve por separado para cada uno según corresponda.
- **Un Staff deja el Negocio con propinas ya acreditadas pero no liquidadas físicamente.** El monto adeudado permanece visible y reclamable — no se pierde ni se transfiere al Wallet del Negocio; es responsabilidad del Negocio liquidar lo pendiente al Staff que se retira, y StylerNow mantiene el registro como evidencia en caso de disputa.

## Criterios de aceptación
- [ ] Ninguna propina genera comisión de plataforma, verificable en el cálculo de cada transacción `tipo = PROPINA`.
- [ ] Toda propina asociada a una Reserva cancelada se reembolsa automáticamente al 100%.
- [ ] El Staff puede ver el desglose exacto de cada propina recibida, con fecha y Cliente asociado (si el Cliente no optó por anonimato, si esa opción existe en una fase posterior).

## Checklist
- [x] Completo
- [ ] Revisado
