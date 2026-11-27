# Modelo de datos (migración 201)

Reutiliza: `reserva`, `reserva_servicio`, `servicio`, `sede`, `perfil`, `staff`, `vinculo_staff_negocio` (`comision_pct` como respaldo), `pago`, `membresia_uso`, `evento_auditoria`.

| Tabla | Propósito | Mutable (solo estas columnas) |
|---|---|---|
| `ganancia_permiso` | capacidades financieras por persona/sede | (se reemplaza por upsert/borrado desde función; el trigger de inmutabilidad no aplica: no es historial) |
| `comision_regla` | reglas con vigencia y versión | estado, vigente_hasta, datos de desactivación |
| `staff_ganancia` | registro financiero por servicio (valores congelados) | estado_comision |
| `ganancia_liquidacion` | cierre por profesional/período | estado, pagado, datos de reversión |
| `ganancia_liquidacion_item` | qué entró en el cierre | activo |
| `ganancia_ajuste` | correcciones +/− | liquidacion_id |
| `ganancia_pago` | pagos al profesional (registro manual) | estado y datos de anulación |
| `ganancia_novedad` | hallazgos y su gestión | estado, asignación, resolución |
| `ganancia_revision` | solicitudes del profesional | estado, respuesta, decisión |
| `soporte_acceso_ganancias` | sesiones de soporte | estado, autorización, agente, vigencia |

Integridad: FKs a `negocio` (cascade), unicidad `(reserva_id, servicio_id)`, índices únicos parciales de ítems activos, checks de rangos y estados, `numero` de liquidación por identidad. `staff_id`/`cliente_id` no llevan FK a `auth.users` a propósito: el historial financiero no debe desaparecer si se elimina una cuenta (se conserva el nombre en la liquidación y el registro).

Índices: `(negocio_id, fecha_local desc)`, `(staff_id, fecha_local desc)`, `(sede_id, fecha_local desc)`, `(negocio_id, estado_comision)`, y por negocio/estado en novedades, revisiones, reglas y accesos.
