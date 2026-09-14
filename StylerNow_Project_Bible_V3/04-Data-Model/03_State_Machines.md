# 03 — State Machines

## Objetivo
Definir, para cada entidad con ciclo de vida, el conjunto cerrado de estados y las transiciones válidas — de modo que ninguna transición no listada aquí pueda ocurrir en el código.

## Alcance
Máquinas de estado de dominio. La implementación (enum de base de datos, guardas) vive en el código; este documento es lo que esa implementación debe reflejar exactamente.

## Reglas

### Reserva

```
PENDIENTE_PAGO ──(pago aprobado)──▶ CONFIRMADA ──(hora_inicio + check-in)──▶ EN_CURSO ──(check-out)──▶ COMPLETADA
      │                                   │                                       
      │(expira 10 min / pago rechazado)   │(cancelación Cliente o Negocio)
      ▼                                   ▼
  CANCELADA                          CANCELADA
                                          │
                                          │(15 min sin check-in, sin cancelación)
                                          ▼
                                      NO_SHOW
```

Transiciones válidas: `PENDIENTE_PAGO → CONFIRMADA`, `PENDIENTE_PAGO → CANCELADA`, `CONFIRMADA → EN_CURSO`, `CONFIRMADA → CANCELADA`, `CONFIRMADA → NO_SHOW`, `EN_CURSO → COMPLETADA`. Ninguna otra transición es válida (ej. `COMPLETADA` nunca vuelve a `CONFIRMADA`; una corrección se hace con una `reserva` nueva, nunca revirtiendo el estado terminal). Reglas de negocio detrás de cada transición: `03-Business-Rules/02_Booking_Rules.md` y `03-Business-Rules/09_No_Show_Policy.md`.

### Pago

```
PENDIENTE ──(webhook aprobado)──▶ APROBADO ──(solicitud de reembolso)──▶ REEMBOLSADO
     │                                │                                        
     │(webhook rechazado /            │(reembolso parcial)
     │ timeout)                       ▼
     ▼                          REEMBOLSADO_PARCIAL
 RECHAZADO                            │
                                       │(contracargo del Cliente)
                              APROBADO ──▶ EN_DISPUTA ──(resolución SuperSU)──▶ APROBADO / REEMBOLSADO
```

Reglas: `03-Business-Rules/03_Payment_Rules.md`.

### Vínculo Staff–Negocio

```
INVITADO ──(acepta invitación)──▶ ACTIVO ──(Barbería/Guardian suspende)──▶ SUSPENDIDO ──(reactiva)──▶ ACTIVO
    │                                  │                                                              
    │(invitación expira/rechazada)     │(Staff o Negocio termina la relación)
    ▼                                  ▼
RETIRADO                          RETIRADO
```

`RETIRADO` es terminal salvo reingreso, que crea un `vinculo_staff_negocio` **nuevo** (no reabre el anterior) — ver `03-Business-Rules/05_Staff_Rewards.md`, caso límite de renuncia y reingreso, para el tratamiento del puntaje en ese caso. Un Staff nunca tiene dos vínculos no-`RETIRADO` simultáneos (ADL-009).

**El perfil Guardian (`es_guardian`) es un flag independiente de este ciclo de vida, no un estado propio**: se activa/desactiva sobre un vínculo ya `ACTIVO` mediante una acción directa de la Barbería (Convertir en Guardian / Quitar perfil Guardian, `03-Business-Rules/01_Roles.md`), sin pasar por ninguna transición intermedia, y se fuerza revocación de sesión en el mismo instante (`06-Security/02_RLS.md`, casos límite). De igual forma, `sede_activa_id` cambia mediante la acción "Cambiar sede (traslado)" sin afectar el `estado` del vínculo.

### Negocio

```
PENDIENTE_APROBACION ──(SuperSU aprueba)──▶ ACTIVO ──(impago / infracción)──▶ SUSPENDIDO ──(resuelve)──▶ ACTIVO
        │                                            │                                │
        │(SuperSU rechaza)                       │(Barbería cancela / SuperSU da de baja)
        ▼                                             ▼
   RECHAZADO                                     CANCELADO
```

`CANCELADO` es terminal. Reglas: `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`.

### Suscripción (Plan de un Negocio)

```
ACTIVA ──(fallo de cobro)──▶ EN_MORA ──(reintentos agotados)──▶ SUSPENDIDA ──(pago recibido)──▶ ACTIVA
   │                                                                  │
   │(cancelación voluntaria)                                          │(90 días sin resolución)
   ▼                                                                  ▼
CANCELADA ◀──────────────────────────────────────────────────────────┘
```

Reglas completas: `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` y `08-Growth-Monetization/05_Billing_Failures.md`.

### Campaña Publicitaria

```
BORRADOR ──(Barbería activa)──▶ ACTIVA ──(Barbería pausa)──▶ PAUSADA ──(Barbería reanuda)──▶ ACTIVA
                                  │                                                    
                                  │(presupuesto agotado)          (fecha_fin alcanzada)
                                  ▼                                        ▼
                              AGOTADA                                FINALIZADA
```

Reglas: `03-Business-Rules/06_Marketplace_Ads.md`, `08-Growth-Monetization/06_Advertising_System.md`.

### Lista de espera (entrada)

```
ACTIVA ──(cupo libre detectado)──▶ NOTIFICADA ──(confirma y paga en 15 min)──▶ CONVERTIDA
   │                                    │
   │(vence fecha deseada)               │(no confirma a tiempo)
   ▼                                    ▼
EXPIRADA_FECHA                    ACTIVA (vuelve a la cola, si aún hay tiempo) / EXPIRADA_FECHA

ACTIVA ──(Cliente cancela)──▶ CANCELADA
```

Reglas: `03-Business-Rules/10_Waitlist_System.md`.

### Temporada (Sistema PRO/EXPERT/MASTER)

```
EN_CURSO ──(fecha_fin alcanzada)──▶ CERRADA ──(snapshot de nivel_staff_consolidado generado)──▶ CONSOLIDADA
```

`CONSOLIDADA` es el único estado desde el cual la temporada siguiente puede leer el "Nivel consolidado - 1 escalón" (ver `03-Business-Rules/05_Staff_Rewards.md`, regla de Degradación).

### Reseña

```
VISIBLE ──(reportada por un usuario)──▶ REPORTADA ──(SuperSU decide: mantener)──▶ VISIBLE
                                              │
                                              │(SuperSU decide: eliminar)
                                              ▼
                                          ELIMINADA
```

`ELIMINADA` no borra físicamente el registro (soft delete, ver `05_Data_Retention.md`) — dejar de mostrarse es distinto de dejar de existir, para preservar la auditoría de moderación.

## Estados
Este documento **es** la definición de Estados para todo el sistema — no delega a otro documento.

## Permisos
Ver quién puede disparar cada transición en el documento de reglas de negocio de cada dominio (referenciado en cada máquina arriba); en general, las transiciones automáticas (por tiempo o por evento de pasarela) no requieren un actor humano, y quedan registradas con `actor_tipo = SISTEMA` en `04_Audit.md`.

## Dependencias
- Depende de: `01_Entities.md`, y de cada documento de `03-Business-Rules` referenciado en cada máquina.
- De este documento dependen: `05-API` (los endpoints de transición reflejan exactamente estas máquinas), `07-QA` (cada transición y cada no-transición inválida es un caso de prueba).

## Casos límite

- **Se intenta forzar una transición no listada** (ej. `COMPLETADA → CONFIRMADA`). Debe rechazarse a nivel de aplicación y, si es técnicamente posible, a nivel de base de datos (constraint o trigger) — nunca debe depender únicamente de que la UI no ofrezca el botón.
- **Dos transiciones válidas podrían aplicar al mismo tiempo** (ej. una Reserva `CONFIRMADA` alcanza simultáneamente la ventana de No-show y recibe un check-in de último segundo). Gana la transición que corresponde al evento que se procesa primero en la cola de eventos del sistema; el check-in, si se procesa antes del corte de 15 minutos, previene el No-show — es una condición de carrera resuelta por orden de procesamiento, no por prioridad de reglas.

## Criterios de aceptación
- [ ] Cada máquina de estado de este documento tiene una prueba de "transición inválida rechazada" en `07-QA` para cada arista no dibujada en el diagrama.
- [ ] Ningún estado terminal (`COMPLETADA`, `CANCELADA`, `NO_SHOW`, `RECHAZADO`, `CANCELADO`, `FINALIZADA`, `CONVERTIDA`, `EXPIRADA_FECHA`, `ELIMINADA`, `CONSOLIDADA`) tiene una transición de salida en la implementación.

## Checklist
- [x] Completo
- [ ] Revisado
