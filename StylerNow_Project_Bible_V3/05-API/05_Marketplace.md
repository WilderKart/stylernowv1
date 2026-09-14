# 05 — Marketplace API

## Objetivo
Especificar el contrato de los endpoints públicos de descubrimiento y los endpoints de gestión de campañas publicitarias, como implementación de `08-Growth-Monetization/01_Marketplace_Algorithm.md` y `06_Advertising_System.md`.

## Alcance
Endpoints de búsqueda/perfil público de Negocio y de gestión de campañas. No cubre disponibilidad de horarios en detalle (eso es `03_Bookings.md`, aunque el perfil de Negocio la referencia).

## Reglas

### Endpoints públicos

| Método y ruta | Rol mínimo | Propósito |
|---|---|---|
| `GET /v1/marketplace/buscar` | Público | Búsqueda con filtros (ciudad, categoría, precio, calificación, disponibilidad); retorna resultados ya ordenados por Score con `patrocinado: true/false` explícito por resultado |
| `GET /v1/marketplace/negocios/{slug}` | Público | Perfil público completo: fotos, Servicios, Staff, reseñas visibles, promociones activas |
| `GET /v1/marketplace/negocios/{slug}/resenas` | Público | Listado paginado de reseñas `VISIBLE` |

### Endpoints de gestión (Negocio)

| Método y ruta | Rol mínimo | Propósito |
|---|---|---|
| `POST /v1/negocios/{id}/campanas` | Barbería | Crea una campaña (`BORRADOR`) |
| `POST /v1/negocios/{id}/campanas/{cid}/activar` | Barbería | Transición a `ACTIVA`, valida presupuesto disponible en Wallet |
| `POST /v1/negocios/{id}/campanas/{cid}/pausar` | Barbería / SuperSU | Transición a `PAUSADA` |
| `GET /v1/negocios/{id}/campanas/{cid}/metricas` | Barbería | Impresiones, clics, CTR, Reservas atribuidas, gasto |

### Endpoints de moderación (SuperSU)

| Método y ruta | Rol mínimo | Propósito |
|---|---|---|
| `POST /v1/resenas/{id}/reportar` | Cliente / Barbería | Marca una reseña como `REPORTADA` |
| `POST /v1/resenas/{id}/moderar` | SuperSU | Decide `VISIBLE` (mantener) o `ELIMINADA`, con `motivo` obligatorio |
| `PATCH /v1/negocios/{id}/elegibilidad-marketplace` | SuperSU | Activa/desactiva la elegibilidad de un Negocio en el ranking (sanción por fraude) |

### Regla de transparencia del Score (limitada)

`GET /v1/marketplace/buscar` nunca retorna el valor numérico exacto del Score de un resultado — solo el orden ya calculado y el flag `patrocinado`. Esto es consistente con `08-Growth-Monetization/01_Marketplace_Algorithm.md`, Permisos: ningún Barbería puede hacer ingeniería inversa del algoritmo exacto desde la API pública.

## Estados
Ver `04-Data-Model/03_State_Machines.md`, máquinas "Campaña Publicitaria" y "Reseña".

## Permisos
Ver tablas arriba; deriva de `03-Business-Rules/01_Roles.md`.

## Dependencias
- Depende de: `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `08-Growth-Monetization/06_Advertising_System.md`, `03-Business-Rules/06_Marketplace_Ads.md`.
- De este documento dependen: `02-UX/04_Marketplace.md`, `07-QA/06_Marketplace.md`.

## Casos límite

- **Una búsqueda no retorna resultados dentro del radio configurado.** Ver `08-Growth-Monetization/01_Marketplace_Algorithm.md`, caso límite de ampliación automática de radio — el endpoint refleja esto con un campo `radio_ampliado: true` en la respuesta quien consume la API sepa que se relajó el filtro original.
- **Se solicita el perfil de un Negocio `SUSPENDIDO` o `CANCELADO` directamente por su `slug`** (ej. un link compartido previamente). Retorna `404 NEGOCIO_NO_DISPONIBLE` — no se distingue entre "no existe" y "suspendido" en la respuesta pública, para no filtrar información operativa a terceros, aunque internamente el log de auditoría sí distingue la causa.
- **Una Barbería intenta activar una campaña sin saldo suficiente en su Wallet.** Retorna `402 SALDO_INSUFICIENTE` (no `403`, para distinguir semánticamente un problema de pago de uno de permisos) con el monto faltante en `details`.

## Criterios de aceptación
- [ ] Ningún resultado de búsqueda expone el Score numérico exacto.
- [ ] Un Negocio suspendido o cancelado nunca es accesible vía su perfil público, verificado con prueba automatizada.
- [ ] Toda métrica de campaña coincide exactamente con lo calculado internamente para facturación (no hay dos fuentes de verdad para el mismo número).

## Checklist
- [x] Completo
- [ ] Revisado
