# 02 — Relationships

## Objetivo
Especificar la cardinalidad exacta entre cada par de entidades de `01_Entities.md`, para que el esquema físico no tenga ambigüedad de "uno a muchos" vs. "muchos a muchos" en ningún punto.

## Alcance
Relaciones de datos. No repite los campos de cada entidad (ya en `01_Entities.md`).

## Reglas

### Diagrama de relaciones (cardinalidad)

```
plan (1) ──── (N) suscripcion (N) ──── (1) negocio (1) ──── (N) sede
                                            │                    │
                                            │ (1)                │ (N)
                                            ▼                    ▼
                                      wallet (1)            recurso (N) ──── (1) recurso_tipo
                                                                  │
negocio (1) ──── (N) servicio (N) ──── (N) staff_servicio (N) ──── (1) staff
     │                  │                                              │
     │ (1)              │ (1, nullable)                                │ (N)
     │                  ▼                                              ▼
     │            recurso_tipo                              vinculo_staff_negocio (N) ──── (1) negocio
     │                                                              │            │
     │                                                              │ (1)        │ (N)
     │                                                              ▼            ▼
     │                                                      disponibilidad   bloqueo_ausencia
     │
     ▼ (1)
reserva (N) ──── (1) cliente
     │  │
     │  │ (1, tras asignación)
     │  └──────────────────────────► staff (vía vinculo_staff_negocio)
     │
     │ (1, nullable)
     └──────────────────────────► recurso
     │
     │ (N)
     ▼
reserva_servicio (N) ──── (1) servicio

reserva (1) ──── (N) pago
reserva (1) ──── (0..1) resena
reserva (1) ──── (0..N) propina ──── (1) staff

cliente (1) ──── (N) punto_fidelizacion (por negocio)
cliente (1) ──── (N) lista_espera

vinculo_staff_negocio (1) ──── (N) puntaje_staff_evento ──── (1) temporada
vinculo_staff_negocio (1) ──── (N) nivel_staff_consolidado ──── (1) temporada

negocio (1) ──── (N) campana_publicitaria
```

### Reglas de cardinalidad explícitas

| Relación | Cardinalidad | Nota |
|---|---|---|
| `negocio` – `sede` | 1 a N | Mínimo 1 Sede siempre (un Negocio sin Sede no puede operar) |
| `negocio` – `plan` (vía `suscripcion`) | N a 1, en el tiempo 1 a 1 | Un Negocio tiene una `suscripcion` activa a la vez; el historial de suscripciones pasadas se conserva (soft, no se borra) |
| `staff` – `negocio` (vía `vinculo_staff_negocio`) | N a N | Un Staff puede tener vínculos activos con más de un Negocio simultáneamente (ver `03-Business-Rules/01_Roles.md`) |
| `vinculo_staff_negocio` – `sede` | N a N (vía `disponibilidad`) | Un Staff puede tener disponibilidad configurada en más de una Sede del mismo Negocio |
| `servicio` – `staff` (vía `staff_servicio`) | N a N | No todo Staff presta todo Servicio |
| `reserva` – `servicio` (vía `reserva_servicio`) | N a N | Soporta combos |
| `reserva` – `staff` | N a 1 | Una Reserva tiene exactamente un Staff asignado (no soporta multi-staff en V1, ver `Business_Rules_Bible.md`) |
| `reserva` – `recurso` | N a 0..1 | Nullable — depende de si el Servicio lo requiere |
| `reserva` – `pago` | 1 a N | Una Reserva puede tener más de un `pago` (Seña + Saldo si el Negocio cobra el saldo también por la app) |
| `reserva` – `resena` | 1 a 0..1 | Máximo una reseña por Reserva (evita spam de reseñas) |
| `cliente` – `punto_fidelizacion` | 1 a N, particionado por `negocio_id` | Ver `Glossary.md`, entidad Punto |
| `cliente` – `negocio` | N a N (implícita, vía `reserva`) | No existe una tabla de "clientes de un Negocio" explícita — la relación se deriva de tener al menos una `reserva` |

### Regla de particionamiento multi-tenant

Toda entidad que cuelga directa o indirectamente de `negocio` lleva `negocio_id` como columna propia (no solo derivable por join), específicamente para que las políticas de RLS de `06-Security/02_RLS.md` puedan filtrar en una sola condición sin joins costosos ni, más importante, sin depender de que un join se ejecute correctamente para mantener el aislamiento.

## Estados
No aplica — este documento describe estructura, no ciclo de vida (ver `03_State_Machines.md`).

## Permisos
No aplica directamente — se hereda de `01_Entities.md` y `03-Business-Rules/01_Roles.md`.

## Dependencias
- Depende de: `01_Entities.md`.
- De este documento dependen: el esquema físico de base de datos (fuera de la Biblia, en el repositorio de código), `06-Security/02_RLS.md`, `05-API/01_Standards.md` (forma de los payloads anidados).

## Casos límite

- **Un `staff_id` queda sin ningún `vinculo_staff_negocio` activo** (se retiró de todos sus Negocios). La entidad `staff` no se elimina — conserva su identidad para poder reactivarse en el futuro; solo sus vínculos pasan a `RETIRADO`.
- **Una `reserva` referencia un `servicio` que luego se desactiva (soft delete).** La relación `reserva_servicio` no se ve afectada — apunta al `servicio_id` histórico, cuyo registro sigue existiendo con `estado = INACTIVO`, solo dejó de ser reservable para citas nuevas.
- **Un `recurso` se marca `FUERA_DE_SERVICIO` con Reservas futuras que lo requieren.** No elimina las Reservas existentes automáticamente; genera una alerta a la Barbería para reasignar Recurso o reprogramar, siguiendo el mismo patrón que "Staff cambia horario" en `03-Business-Rules/02_Booking_Rules.md`.

## Criterios de aceptación
- [ ] Cada relación N a N tiene su tabla puente explícita en el esquema físico (nunca se modela como un array serializado dentro de una fila).
- [ ] Toda entidad con `negocio_id` derivable indirectamente también lo tiene como columna directa.

## Checklist
- [x] Completo
- [ ] Revisado
