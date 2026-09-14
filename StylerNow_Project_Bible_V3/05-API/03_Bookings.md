# 03 — Bookings API

## Objetivo
Especificar el contrato de los endpoints de disponibilidad y Reserva, como implementación directa de `03-Business-Rules/02_Booking_Rules.md` y la máquina de estados de `04-Data-Model/03_State_Machines.md`.

## Alcance
Endpoints de consulta de disponibilidad, creación, reprogramación y cancelación de Reserva, y check-in/check-out. No cubre el cobro en sí (`04_Payments.md`).

## Reglas

### Endpoints

| Método y ruta | Rol mínimo | Propósito |
|---|---|---|
| `GET /v1/negocios/{negocio_id}/disponibilidad` | Público | Consulta slots disponibles dado `servicio_id`(s), `staff_id` opcional, rango de fechas — aplica las 7 validaciones de `03-Business-Rules/02_Booking_Rules.md` |
| `POST /v1/reservas` | Cliente | Crea una Reserva en `PENDIENTE_PAGO` (requiere `Idempotency-Key`, ver `01_Standards.md`) |
| `GET /v1/reservas/{id}` | Cliente (propia) / Staff (propia) / Guardian / Barbería / SuperSU | Detalle de una Reserva |
| `GET /v1/reservas` | Según rol | Lista paginada, filtrada por alcance del token |
| `PATCH /v1/reservas/{id}/reprogramar` | Cliente (propia, dentro de ventana) / Staff / Guardian / Barbería | Reprograma conservando el `id` |
| `POST /v1/reservas/{id}/cancelar` | Cliente (propia) / Staff / Guardian / Barbería | Cancela, dispara reembolso según `03-Business-Rules/03_Payment_Rules.md` |
| `POST /v1/reservas/{id}/checkin` | Staff (propia) / Guardian / Barbería | Transición `CONFIRMADA → EN_CURSO` |
| `POST /v1/reservas/{id}/checkout` | Staff (propia) / Guardian / Barbería | Transición `EN_CURSO → COMPLETADA` |

### Validación de disponibilidad como respuesta estructurada

`GET .../disponibilidad` retorna slots ya filtrados (nunca retorna un slot que luego fallaría al confirmar) — la respuesta incluye, por slot: `hora_inicio`, `hora_fin`, `staff_id` asignable, `recurso_id` (si aplica). Si no hay slots, retorna `[]` con un campo adicional `sugerencia_lista_espera: true` para que el cliente ofrezca `03-Business-Rules/10_Waitlist_System.md`.

### Errores específicos de dominio

| `code` | HTTP | Cuándo |
|---|---|---|
| `SLOT_NO_DISPONIBLE` | 409 | El slot solicitado ya no cumple las 7 validaciones al momento de confirmar |
| `PLAN_LIMIT_EXCEEDED` | 403 | (Contexto Negocio) límite estructural de Plan alcanzado |
| `RESERVA_NO_CANCELABLE` | 422 | Se intenta cancelar una Reserva en estado terminal |
| `VENTANA_REPROGRAMACION_VENCIDA` | 422 | El Cliente intenta reprogramar fuera del límite de su Negocio |
| `CHECKIN_FUERA_DE_VENTANA` | 422 | Se intenta check-in antes de la hora permitida o después de que ya se marcó `NO_SHOW` |

## Estados
Implementa exactamente `04-Data-Model/03_State_Machines.md`, máquina "Reserva". Ningún endpoint puede producir una transición no dibujada en ese diagrama.

## Permisos
Ver tabla de endpoints arriba; deriva de `03-Business-Rules/01_Roles.md`.

## Dependencias
- Depende de: `03-Business-Rules/02_Booking_Rules.md`, `04-Data-Model/01_Entities.md`, `04-Data-Model/03_State_Machines.md`, `05-API/01_Standards.md`, `05-API/02_Auth.md`.
- De este documento dependen: `02-UX/05_Booking.md`, `07-QA/02_Client.md`, `07-QA/03_Staff.md`.

## Casos límite

- **Dos requests de `POST /v1/reservas` para el mismo slot llegan casi simultáneamente.** El lock optimista de base de datos (`03-Business-Rules/02_Booking_Rules.md`) garantiza que solo uno recibe `201 Created`; el otro recibe `409 SLOT_NO_DISPONIBLE` de inmediato, sin timeout largo.
- **Un `POST /v1/reservas/{id}/checkin` llega después de que la Reserva ya transicionó a `NO_SHOW` automáticamente por el corte de 15 minutos.** Retorna `422 CHECKIN_FUERA_DE_VENTANA` — el Staff debe usar el flujo de reversión manual (`03-Business-Rules/09_No_Show_Policy.md`, a través de Barbería), no un check-in tardío silencioso.
- **Un cliente reintenta `POST /v1/reservas` con la misma `Idempotency-Key` tras un timeout de red, sin saber si la primera petición tuvo éxito.** Retorna la respuesta original (mismo `id` de Reserva, mismo estado) sin crear una segunda Reserva.

## Criterios de aceptación
- [ ] `GET .../disponibilidad` nunca retorna un slot que, al confirmarse inmediatamente después, resulte en `409` por una condición ya conocida al momento de la consulta.
- [ ] El 100% de las transiciones de estado de Reserva pasan por estos endpoints — ninguna transición ocurre por escritura directa a base de datos desde otra ruta del código.

## Checklist
- [x] Completo
- [ ] Revisado
