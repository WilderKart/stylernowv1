# Auditoría final — ganancias del staff (migración 201)

Auditoría hecha por el mismo equipo que implementó (no independiente de verdad): se revisó cada función nueva contra la lista de la fase 22 y se probó con identidades reales. Conviene una revisión externa antes de operar con dinero de muchos negocios.

| Riesgo | Resultado |
|---|---|
| IDOR (cambiar id de profesional/sede/negocio/liquidación/regla) | Cubierto: identidad de `auth.uid()`; filtros ajenos se ignoran o devuelven vacío; objetos ajenos → «no encontrado». Pruebas SQL. |
| Escalamiento de privilegios | Hallazgo propio corregido (permiso de sede aceptado en operaciones de negocio completo). Probado. |
| Exposición entre negocios / sedes / profesionales | Probado con 6+ identidades. |
| RLS | SELECT por helper; sin INSERT/UPDATE/DELETE a `authenticated`; probado `insufficient_privilege`. |
| SECURITY DEFINER | `search_path` fijo; internas sin grants; las del panel revocadas a `public`/`anon`/`authenticated` y concedidas solo a `authenticated`; `definer_superficie.sql` sigue pasando. |
| Duplicados de comisión / liquidación / pago | `unique(reserva_id, servicio_id)`, `FOR UPDATE`, índices únicos parciales, clave de idempotencia. Probado (reproceso, reabrir, doble cierre, doble pago). |
| Alterar registros cerrados / auditoría | Trigger de inmutabilidad; correcciones solo por ajuste/anulación/reversión auditadas; `evento_auditoria` sin DELETE para usuarios. |
| SuperSU como puerta trasera | Sin lectura sin sesión; sesión = solicitud + autorización del propietario + un agente + expira; solo lectura; lecturas auditadas. Probado. |
| Exportación | Permiso `exportar`, mismo alcance, tope 5.000 filas, auditoría, CSV sin inyección de fórmulas. |
| Disponibilidad del negocio | El trigger no bloquea el POS si falla; queda auditado y se marca como novedad crítica. |

## No cubierto (ver `VULNERABILIDADES_Y_MEJORAS.md`)
Storage de evidencias, notificaciones, descuento por puntos, Excel/PDF nativos, IA, escritura excepcional de soporte, prueba de carga con volúmenes grandes.

## Revisión complementaria (2026-11-26)
Se revisó de nuevo la superficie expuesta con criterio independiente: Server Actions del panel y del profesional, ruta de exportación CSV, validación de filtros y los controles de la migración 201 (definer + `search_path`, `revoke`/`grant`, `_gan_permiso` con `p_sede is null`, trigger que no bloquea el POS). No aparecieron hallazgos nuevos; las evidencias y los comandos están en `EVIDENCIAS.md`. Esto **no sustituye** la revisión humana externa recomendada arriba.

## Veredicto
**IMPLEMENTACIÓN COMPLETA, CON RESTRICCIONES** (las de arriba). Validada en local; el estado de producción se registra en `PROGRESO.md`.
