# 12 — Errors & States (Empty, Loading, Error, Offline)

## Objetivo
Definir el tratamiento visual estándar de los cuatro estados no felices de cualquier pantalla — vacío, cargando, error, sin conexión — para que ninguna pantalla de las 4 superficies improvise su propio patrón.

## Alcance
Patrones de UI transversales. Los mensajes de error específicos de dominio (`code` de `05-API/01_Standards.md`) se traducen a estos patrones, no se muestran como JSON crudo en ningún caso.

## Reglas

### Estado vacío (Empty state)

Toda lista/colección que puede estar legítimamente vacía (Mis citas sin próximas, Clientes sin resultados de filtro, Servicios de un Negocio nuevo) muestra: un ícono/ilustración simple, un texto explicando por qué está vacío, y — cuando aplica — una acción primaria para resolverlo (ej. "Aún no tienes citas · Explora barberías cerca de ti" con botón al Marketplace).

### Estado de carga (Loading)

- Nunca una pantalla en blanco sin indicación.
- Contenido que tarda menos de 300ms no muestra spinner (evita parpadeo perceptible); más de 300ms muestra skeleton screens (siluetas de la estructura del contenido) en vez de un spinner genérico centrado, para reducir la percepción de espera.
- Ninguna acción que dispara una escritura (confirmar pago, cancelar, check-in) permite un segundo tap mientras está en curso — el botón se deshabilita visualmente durante la espera.

### Estado de error

- Todo error de `05-API/01_Standards.md` se traduce a un mensaje en lenguaje humano específico del contexto (nunca "Ha ocurrido un error" genérico cuando el `code` permite un mensaje más útil).
- Errores recuperables (ej. `SLOT_NO_DISPONIBLE`) ofrecen una acción de recuperación inmediata (volver a elegir horario).
- Errores no recuperables por el usuario (ej. `5xx` de servidor) ofrecen reintentar y, si persiste, un canal de contacto a soporte.

### Estado sin conexión (Offline)

- Se detecta la pérdida de conexión y se muestra un indicador persistente pero no bloqueante (banner superior), consistente con `02-UX/03_Client_PWA.md`, regla de que datos transaccionales nunca se sirven desde caché offline.
- Ninguna acción que requiere red (pagar, confirmar, check-in) se permite iniciar mientras el indicador de offline está activo — se deshabilita con explicación, en vez de fallar silenciosamente al intentarlo.
- Al recuperar conexión, la pantalla activa se refresca automáticamente (nunca queda con datos potencialmente obsoletos sin que el usuario lo sepa).

## Estados
Este documento define los 4 estados de UI transversales en sí mismos: `VACIO`, `CARGANDO`, `ERROR`, `SIN_CONEXION`, aplicables a cualquier pantalla sobre su estado de datos normal.

## Permisos
No aplica — es un patrón de presentación transversal a todos los roles.

## Dependencias
- Depende de: `05-API/01_Standards.md` (catálogo de `code` de error), `02-UX/03_Client_PWA.md`.
- De este documento dependen: todas las demás pantallas de `02-UX`, `07-QA` (cada pantalla debe tener casos de prueba para sus 4 estados).

## Casos límite

- **Un error de red ocurre justo después de que una escritura crítica (pago) ya se procesó del lado del servidor, pero la respuesta nunca llega al cliente.** La UI no asume fallo — muestra un estado de "verificando" y consulta el estado real antes de permitir un reintento, para no arriesgar una doble escritura sobre una operación que de hecho sí tuvo éxito (consistente con `Idempotency-Key` de `05-API/01_Standards.md`).
- **Una lista vacía es resultado de un filtro demasiado restrictivo, no de ausencia real de datos** (ej. Clientes filtrados por una etiqueta que nadie tiene). El estado vacío en este caso ofrece "Quitar filtros" como acción primaria, distinto del estado vacío genuino de "aún no hay datos".
- **El indicador de offline persiste por error aunque la conexión ya volvió** (falso negativo de detección). Se revalida activamente cada cierto intervalo corto (ej. cada 5 segundos) mientras el indicador está activo, para no dejar al usuario bloqueado más tiempo del necesario por una detección obsoleta.

## Criterios de aceptación
- [ ] Ninguna pantalla de ninguna de las 4 superficies puede quedar en blanco sin uno de estos 4 estados explícitos.
- [ ] Ningún mensaje de error de dominio se muestra como texto técnico crudo (`code` o stack trace) a un usuario final.
- [ ] Ninguna acción de escritura permite doble envío durante su propio estado de carga.

## Checklist
- [x] Completo
- [ ] Revisado
