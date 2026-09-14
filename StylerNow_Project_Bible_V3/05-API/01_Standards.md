# 01 — API Standards

## Objetivo
Fijar las convenciones que todo endpoint de StylerNow debe seguir — versionado, formato de error, paginación, idempotencia general, límites de tasa — para que las 4 superficies consuman una API consistente sin sorpresas.

## Alcance
Estándares transversales de la API REST/JSON de StylerNow. Los contratos específicos de cada dominio están en `02_Auth.md` a `06_Webhooks.md`.

## Reglas

### Versionado

- Toda ruta se prefija con versión explícita: `/v1/...`. No hay versión implícita ("sin prefijo = v1"): siempre se declara.
- Un cambio incompatible (breaking change: remover un campo, cambiar su tipo, cambiar el significado de un valor) requiere una versión nueva (`/v2/...`); un cambio aditivo (agregar un campo opcional nuevo) no requiere nueva versión.
- Una versión de API se soporta un mínimo de 12 meses después de publicarse la siguiente, con aviso de deprecación en el header `Deprecation` y `Sunset` (fecha exacta) desde el día en que se anuncia el retiro.

### Formato de error estándar

Todo error HTTP (4xx/5xx) responde el mismo sobre JSON:

```json
{
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "El Negocio alcanzó el límite de Staff de su Plan actual.",
    "details": { "limite": 3, "actual": 3 },
    "request_id": "req_8f2a..."
  }
}
```

`code` es un identificador estable en `SCREAMING_SNAKE_CASE` (nunca cambia de texto entre versiones menores — el cliente puede hacer `switch` sobre él); `message` es legible mas no se usa para lógica de negocio del cliente; `request_id` permite correlacionar con `10-Operations/04_Logs_Policy.md`.

### Paginación

Toda colección usa paginación basada en cursor (`?cursor=...&limit=...`), nunca offset (evita resultados inconsistentes cuando la colección cambia entre páginas, relevante para listados de Reservas o Clientes que mutan constantemente). Respuesta: `{ "data": [...], "next_cursor": "..." o null }`.

### Idempotencia de escrituras (general, más allá de webhooks)

Toda operación `POST` que crea un recurso con efecto financiero o transaccional (crear Reserva, procesar pago, crear campaña) acepta un header `Idempotency-Key` provisto por el cliente. Si la misma clave se reenvía dentro de 24 horas, la API retorna la respuesta original sin repetir el efecto — protege contra doble-clic del usuario y contra reintentos automáticos del cliente ante timeout de red, complementario a la idempotencia de webhooks de `06_Webhooks.md`.

### Límites de tasa (rate limiting)

| Contexto | Límite |
|---|---|
| Por `cliente_id` autenticado | 120 requests/minuto |
| Por `negocio_id` autenticado (Panel Negocio/App Staff) | 300 requests/minuto |
| Endpoints públicos de Marketplace (sin autenticación) | 60 requests/minuto por IP |
| SuperSU | 600 requests/minuto |

Al exceder el límite: `429 TOO_MANY_REQUESTS` con header `Retry-After`.

### Autenticación y autorización

Ver `02_Auth.md`. Regla transversal: todo endpoint (excepto Marketplace público de solo lectura) requiere un token válido; el rol y `negocio_id`/`cliente_id` del token determinan qué puede ver/hacer según `03-Business-Rules/01_Roles.md` — nunca se confía en un `negocio_id` enviado en el cuerpo de la petición para decidir alcance de datos (siempre se deriva del token, ver `06-Security/02_RLS.md`).

### Campos de fecha y moneda

- Toda fecha/hora se transmite en formato ISO 8601 con offset explícito (nunca hora local ambigua sin zona).
- Todo monto monetario se transmite como entero en la unidad mínima de la moneda (centavos de COP no aplica — COP no tiene subunidad práctica, por lo que el monto es un entero en pesos, documentado explícitamente por endpoint para evitar el error clásico de asumir centavos donde no aplican).

## Estados
No aplica — este documento define convenciones, no una entidad.

## Permisos
No aplica directamente — se hereda de `02_Auth.md` para cada endpoint específico.

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, `03-Business-Rules/01_Roles.md`.
- De este documento dependen: `02_Auth.md` a `06_Webhooks.md`, y todo el código de las 4 superficies.

## Casos límite

- **Dos requests con la misma `Idempotency-Key` pero payload distinto.** Se rechaza el segundo con `422 IDEMPOTENCY_KEY_CONFLICT` — la clave debe representar exactamente la misma operación, no se usa como clave de reemplazo.
- **Un cliente sigue usando una versión de API ya pasada su fecha `Sunset`.** Responde `410 GONE` con un `code = API_VERSION_RETIRED` y un `message` apuntando a la versión vigente — nunca se apaga silenciosamente sin ese código explícito.
- **Un Negocio con actividad legítima muy alta (temporada pico) excede el límite de tasa estándar.** Puede solicitar un límite elevado a SuperSU (ajuste manual por `negocio_id`, registrado en configuración de plataforma) — no hay elevación automática.

## Criterios de aceptación
- [ ] El 100% de los endpoints retorna el formato de error estándar, sin excepciones ad-hoc.
- [ ] Toda colección paginada usa cursor, verificable por ausencia de parámetros `offset`/`page` en el código.
- [ ] Toda operación de creación con efecto financiero soporta `Idempotency-Key`.

## Checklist
- [x] Completo
- [ ] Revisado
