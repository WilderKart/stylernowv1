# 02 — Commissions

## Objetivo
Definir con precisión cómo se calcula y reparte la comisión de plataforma y la comisión interna del Negocio hacia su Staff, para que cada peso cobrado tenga una fórmula trazable.

## Alcance
Cubre dos niveles de comisión distintos que no deben confundirse: (1) **Comisión de plataforma** (StylerNow → retiene sobre la transacción), (2) **Comisión de Staff** (Negocio → paga/retiene hacia su Staff, configuración interna del Negocio que StylerNow solo facilita, no impone). No cubre propinas (`03_Tips_Distribution.md`, un concepto distinto: 100% para el Staff, sin comisión de plataforma).

## Reglas

### Comisión de plataforma

- Se calcula únicamente sobre el monto que StylerNow procesa como pasarela (la Seña, o el total si el Negocio activó "pago completo en app" — ver ADL-005 y `03-Business-Rules/03_Payment_Rules.md`).
- Tasa por defecto: **8%**, configurable por SuperSU dentro de un rango de 3% a 15% a nivel plataforma, y ajustable por Negocio individual dentro de ese rango (ej. negociación Allfather, ver `01-PRD/03_Monetization.md`).
- Se descuenta automáticamente al momento en que el `pago` pasa a `APROBADO`: el Negocio recibe el monto neto en su `wallet`, nunca recibe el bruto para luego pagar la comisión manualmente.
- No se cobra comisión sobre: propinas, venta de productos por POS fuera del Marketplace, Saldo pagado en Sede fuera de la app.

### Comisión de Staff (configuración interna del Negocio)

- La Barbería configura, por `vinculo_staff_negocio`, un `comision_pct` que determina qué porcentaje del valor del Servicio (no de la comisión de plataforma) se acredita como ingreso del Staff dentro de los reportes del Negocio.
- Esta comisión **no es un flujo de dinero que StylerNow ejecuta** — es un dato de reporte/cálculo que el Panel Negocio y la App Staff muestran para que el Negocio y el Staff sepan cuánto le corresponde a cada quien; el pago físico al Staff (efectivo, transferencia, nómina) ocurre fuera de StylerNow, salvo que el Negocio use la funcionalidad de Wallet para retiros programados (fuera de alcance de V1, ver Casos límite).
- La Barbería puede escalonar la comisión por Nivel PRO/EXPERT/MASTER del Staff (ver `03-Business-Rules/05_Staff_Rewards.md`, beneficios de EXPERT/MASTER), dentro de un rango razonable que evite comisiones del 0% o 100% (mínimo 20%, máximo 80%, para evitar configuraciones que serían indicio de fraude laboral o error de configuración).

### Wallet del Negocio

- El saldo neto de comisión de plataforma ya descontada se acumula en el `wallet` del Negocio.
- El Negocio puede solicitar retiro de su Wallet según el ciclo de liquidación configurado por SuperSU (por defecto, liquidación semanal a la cuenta bancaria registrada del Negocio).
- El Wallet también retiene fondos por: presupuesto de campañas publicitarias no consumido, y montos congelados durante una disputa de pago (`EN_DISPUTA`).

## Estados
El estado del `wallet` no es una máquina de estados compleja: es un saldo (`saldo_disponible`, `saldo_retenido`). Los movimientos del Wallet generan eventos de auditoría (`04-Data-Model/04_Audit.md`).

## Permisos
- Barbería ve el detalle completo de comisión de plataforma retenida y configura la comisión de Staff.
- Staff ve únicamente su propio % de comisión configurado y el cálculo de lo que le corresponde por Reserva atendida (no ve la comisión de plataforma que StylerNow retuvo, salvo que el Negocio decida mostrarlo).
- Solo SuperSU configura el rango permitido de comisión de plataforma y aprueba solicitudes de retiro del Wallet.

## Dependencias
- Depende de: `03-Business-Rules/03_Payment_Rules.md`, ADL-005, `01-PRD/03_Monetization.md`.
- De este documento dependen: `05-API/04_Payments.md`, `06-Security/03_Fraud.md` (comisiones anómalas como señal de fraude), `03-Business-Rules/05_Staff_Rewards.md`.

## Casos límite

- **Un Negocio Allfather negocia 3% de comisión de plataforma, fuera del rango estándar (3%-15%, en el límite inferior exacto).** Es válido dentro del rango — el rango estándar ya contempla ese piso; una comisión menor a 3% requeriría una entrada nueva del ADL ampliando el rango, no una excepción silenciosa.
- **Una Reserva se reembolsa al 100% después de que la comisión ya fue descontada y acreditada al Wallet del Negocio.** La comisión retenida también se revierte (se descuenta del Wallet, generando saldo negativo temporal si es necesario, que se compensa contra la siguiente liquidación) — nunca queda una comisión cobrada sobre una transacción que terminó en $0 para el Negocio.
- **Retiro automático programado al Staff desde el Wallet del Negocio (nómina automatizada).** Fuera de alcance de V1 — se documenta como Decisión abierta para una fase posterior (`01-PRD/04_Roadmap.md`); en V1 el Wallet solo gestiona el flujo Negocio ↔ StylerNow, no Negocio ↔ Staff.
- **Un Staff con comisión configurada al 80% (máximo permitido) atiende un Servicio premium de alto valor.** No hay tope adicional sobre el monto absoluto, solo sobre el porcentaje — el sistema no limita cuánto puede ganar un Staff de alto desempeño, solo protege contra configuraciones porcentuales fuera de rango razonable.

## Criterios de aceptación
- [ ] Toda comisión de plataforma descontada tiene un evento de auditoría con el monto exacto y la tasa aplicada.
- [ ] Un reembolso siempre revierte proporcionalmente la comisión de plataforma ya acreditada.
- [ ] Ningún `vinculo_staff_negocio` puede configurarse con comisión fuera del rango 20%-80%.

## Checklist
- [x] Completo
- [ ] Revisado
