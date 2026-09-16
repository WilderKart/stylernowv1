# 04 — Lealtad

> Renombrado por ADR-011 (2026-09-16): el dominio completo de recompensas
> de StylerNow se llama oficialmente **Lealtad** en todo el producto —
> "Loyalty" no se vuelve a usar. Este documento cubre Puntos de Cliente
> (el sistema original); el resto de los 12 módulos del dominio Lealtad
> (Wallet, Membresías, Gift Cards, Referidos, Sellos, Cashback, VIP,
> Familias, Corporativo, Referidos de Staff, motor de IA) vive en
> `ADR_011_Motor_Lealtad.md`.

## Objetivo
Definir el sistema de fidelización del **Cliente** (distinto del Sistema PRO/EXPERT/MASTER, que es para Staff — ver `05_Staff_Rewards.md`) para que la acumulación, expiración y canje de Puntos sea predecible y auditable.

## Alcance
Cubre Puntos de Cliente, Membresías y su interacción con Gift Cards. No cubre el sistema de niveles del Staff (documento separado por diseño, ver `Glossary.md`).

## Reglas

### Acumulación de Puntos

| Acción | Puntos |
|---|---|
| Reserva completada (`COMPLETADA`) | 10 puntos por cada $10.000 COP del valor total pagado |
| Reseña dejada (con texto, no solo estrellas) | +15 puntos |
| Referido que completa su primera Reserva | +50 puntos (para quien refiere) |
| Cumpleaños del Cliente (mes de cumpleaños, una vez al año) | +30 puntos |

Los Puntos se otorgan por Negocio: un Cliente tiene un saldo de Puntos independiente por cada Negocio donde ha sido atendido (no es un saldo global de plataforma), porque el canje de Puntos es un descuento que asume cada Negocio, no StylerNow.

### Canje

- El Negocio configura la tasa de canje (por defecto: 100 puntos = $5.000 COP de descuento sobre el Saldo, nunca sobre la Seña).
- El canje de Puntos no puede dejar el valor a pagar en Sede por debajo de $0 — el excedente de Puntos no usado permanece en el saldo del Cliente.
- Los Puntos no son transferibles entre Clientes ni canjeables por dinero en efectivo.

### Expiración

- Los Puntos expiran a los **12 meses** de haberse otorgado, calculado individualmente por lote de otorgamiento (FIFO: los puntos más antiguos expiran primero y se consumen primero en un canje).
- 30 días antes de que un lote expire, el Cliente recibe una notificación (`02-UX/11_Notifications.md`) indicándole el monto que está por perder.
- Un Negocio no puede configurar una expiración menor a 6 meses ni mayor a 24 meses (rango que protege tanto al Cliente de perder valor arbitrariamente rápido, como al Negocio de un pasivo de puntos indefinido).

### Membresías

- Una Membresía es una suscripción del Cliente hacia un Negocio específico (ej. "3 cortes al mes por $89.000"), con cobro recurrente mensual gestionado con las mismas reglas de fallo de cobro que `08-Growth-Monetization/05_Billing_Failures.md`.
- Una Membresía activa no otorga Puntos adicionales sobre las Reservas que cubre (para evitar doble beneficio), pero sí sobre reseñas y referidos.
- Cancelar una Membresía no reembolsa el periodo en curso; el Cliente conserva el beneficio hasta el fin del ciclo ya pagado.

## Estados

**Lote de Puntos:** `ACTIVO` → `USADO_PARCIAL` → `AGOTADO` / `EXPIRADO`.
**Membresía:** `ACTIVA` → `PENDIENTE_RENOVACION` → `RENOVADA` / `CANCELADA` / `SUSPENDIDA_POR_IMPAGO`.

## Permisos
- El Cliente ve y canjea sus propios Puntos y gestiona su propia Membresía.
- La Barbería configura la tasa de canje y expiración (dentro de rango permitido) y ve el pasivo total de Puntos otorgados y no canjeados de su Negocio (para gestión financiera).
- SuperSU define los rangos permitidos de configuración a nivel plataforma.

## Dependencias
- Depende de: `Glossary.md`, `03-Business-Rules/03_Payment_Rules.md`.
- De este documento dependen: `09-CRM-Intelligence/01_CRM_Complete.md` (LTV incluye pasivo de puntos), `08-Growth-Monetization/05_Billing_Failures.md` (Membresías).

## Casos límite

- **Un Cliente acumula Puntos en un Negocio que luego se suspende (`SUSPENDIDO`, ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`).** Los Puntos quedan congelados (no canjeables) mientras el Negocio esté suspendido; si el Negocio se reactiva, los Puntos vuelven a estar disponibles salvo que ya hayan expirado por tiempo. Si el Negocio se cancela definitivamente, los Puntos se anulan sin compensación (están atados a ese Negocio específico, según la regla de acumulación por Negocio).
- **El Cliente cambia de teléfono/email** (su identificador de cuenta). Los Puntos están atados al `cliente_id` interno, no al teléfono/email, por lo que sobreviven a un cambio de dato de contacto siempre que sea el mismo usuario autenticado el que hace el cambio (ver `03-Business-Rules/07_CRM.md`, caso de cambio de contacto).
- **Un lote de Puntos expira justo el mismo día en que el Cliente intenta canjearlo.** Se evalúa la expiración al momento exacto de la solicitud de canje (no al inicio del día); si expiró, no es canjeable y se informa al Cliente con el motivo específico.
- **El Negocio reduce la tasa de canje después de que el Cliente ya acumuló puntos con la tasa anterior.** Los Puntos ya otorgados se canjean según la tasa vigente **al momento del canje**, no la vigente al momento de otorgamiento — la tasa de canje no es un contrato congelado por lote, es una configuración viva del Negocio (se comunica el cambio al Cliente en la pantalla de canje, nunca de forma oculta).

## Criterios de aceptación
- [ ] Ningún Punto se canjea después de su fecha de expiración, verificado a nivel de transacción, no solo de UI.
- [ ] El saldo de Puntos de un Cliente en un Negocio suspendido queda visible pero no canjeable.
- [ ] Toda notificación de expiración próxima se dispara exactamente 30 días antes, no antes ni después.

## Checklist
- [x] Completo
- [ ] Revisado
