# 04 — Payments API

## Objetivo
Especificar el contrato de los endpoints de cobro, reembolso y consulta de pago, como implementación directa de `03-Business-Rules/03_Payment_Rules.md`.

## Alcance
Endpoints de iniciación de cobro (Seña, Saldo, Propina, Gift Card, Membresía) y reembolso. La recepción de confirmaciones asíncronas de la pasarela vive en `06_Webhooks.md`.

## Reglas

### Endpoints

| Método y ruta | Rol mínimo | Propósito |
|---|---|---|
| `POST /v1/reservas/{id}/pagos/sena` | Cliente (propia) | Inicia el cobro de la Seña, retorna URL/token de la pasarela para completar el flujo de pago |
| `POST /v1/reservas/{id}/pagos/propina` | Cliente (propia) | Inicia el cobro de propina, independiente de la Seña |
| `GET /v1/reservas/{id}/pagos` | Cliente (propia) / Staff / Guardian / Barbería | Lista los `pago` asociados a una Reserva |
| `POST /v1/pagos/{id}/reembolsar` | Barbería / SuperSU | Ejecuta reembolso (total o parcial con `motivo` de catálogo cerrado, ver `03-Business-Rules/03_Payment_Rules.md`) |
| `POST /v1/gift-cards` | Cliente | Compra una Gift Card |
| `POST /v1/membresias` | Cliente | Suscribe una Membresía a un Negocio |

### Iniciación de cobro (patrón)

`POST .../pagos/sena` no cobra directamente — crea un `pago` en estado `PENDIENTE` y retorna los datos necesarios para que el cliente (app) redirija o embeba el flujo de la pasarela (Wompi). El `pago` solo pasa a `APROBADO` cuando llega el webhook correspondiente (`06_Webhooks.md`), nunca por la respuesta síncrona de este endpoint — el cliente debe hacer polling a `GET /v1/reservas/{id}/pagos` o recibir un evento en tiempo real (websocket/push) para saber cuándo se confirmó, dado que la confirmación real es asíncrona.

### Reembolsos

`POST /v1/pagos/{id}/reembolsar` exige `motivo` de un enum cerrado: `CANCELACION_CLIENTE_VENTANA_TOTAL`, `CANCELACION_CLIENTE_VENTANA_PARCIAL`, `CANCELACION_NEGOCIO`, `NO_SHOW_STAFF`, `AJUSTE_SERVICIO`, `RESOLUCION_DISPUTA`, `CORTESIA_COMERCIAL`. No acepta texto libre como único motivo (puede acompañarse de una nota, pero siempre clasificado). El monto de reembolso se valida contra el monto original disponible del `pago` (nunca puede reembolsarse más de lo cobrado, ni reembolsarse dos veces el mismo monto — un segundo intento sobre el mismo `pago` ya `REEMBOLSADO` retorna `422`).

### Errores específicos de dominio

| `code` | HTTP | Cuándo |
|---|---|---|
| `MONTO_SENA_INVALIDO` | 422 | El monto calculado de Seña no corresponde a la configuración del Negocio (protección contra manipulación del cliente) |
| `PAGO_YA_PROCESADO` | 409 | Se intenta iniciar un cobro sobre una Reserva que ya tiene un `pago` `APROBADO` del mismo `tipo` |
| `REEMBOLSO_EXCEDE_DISPONIBLE` | 422 | El monto solicitado de reembolso supera lo disponible para reembolsar |
| `MOTIVO_REEMBOLSO_INVALIDO` | 422 | El `motivo` no pertenece al enum cerrado |

## Estados
Implementa `04-Data-Model/03_State_Machines.md`, máquina "Pago".

## Permisos
Ver tabla de endpoints; deriva de `03-Business-Rules/01_Roles.md` y `03-Business-Rules/03_Payment_Rules.md`.

## Dependencias
- Depende de: `03-Business-Rules/03_Payment_Rules.md`, `08-Growth-Monetization/02_Commissions.md`, `08-Growth-Monetization/03_Tips_Distribution.md`, `05-API/06_Webhooks.md`.
- De este documento dependen: `02-UX/06_Payments.md`, `07-QA/07_Payments.md`, `06-Security/03_Fraud.md`.

## Casos límite

- **El Cliente cierra la app justo después de iniciar el cobro de Seña, antes de completar el flujo de la pasarela.** El `pago` queda `PENDIENTE`; si no se aprueba dentro de 10 minutos, la Reserva expira automáticamente (`03-Business-Rules/03_Payment_Rules.md`) y el `pago` pasa a `RECHAZADO` por timeout, sin requerir que el Cliente vuelva a abrir la app.
- **Se solicita un reembolso parcial dos veces sobre el mismo `pago`, cada vez por la mitad del monto disponible.** El sistema valida el monto disponible restante en cada solicitud (no el monto original) — la segunda solicitud parcial se valida contra lo que queda después de la primera, evitando reembolsar más de lo cobrado en total.
- **Un intento de compra de Gift Card falla en la pasarela.** No se emite ninguna Gift Card ni saldo; se comporta igual que cualquier `pago` `RECHAZADO` — el Cliente puede reintentar.

## Criterios de aceptación
- [ ] Ningún reembolso puede exceder el monto disponible del `pago` original, verificado a nivel de API, no solo de UI.
- [ ] Todo `pago` iniciado pero nunca confirmado por webhook expira consistentemente con la Reserva asociada.
- [ ] El 100% de los reembolsos tienen un `motivo` del enum cerrado.

## Checklist
- [x] Completo
- [ ] Revisado
