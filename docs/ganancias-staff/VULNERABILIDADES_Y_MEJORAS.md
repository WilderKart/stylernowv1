# Vulnerabilidades detectadas, correcciones y mejoras pendientes

## Encontradas y corregidas durante el desarrollo
| # | Hallazgo | Corrección |
|---|---|---|
| 1 | Un permiso de **sede** pasaba verificaciones de **negocio completo** (`p_sede is null` aceptaba cualquier permiso con sede): un administrador de una sede podía liquidar todo el negocio. | `_gan_permiso`: con `p_sede` nulo exige permiso de negocio completo. Cubierto en `ganancias_staff.sql`. |
| 2 | Pagos sin sede: un administrador de sede habría visto pagos de otras sedes. | `ganancia_pago.sede_id` y política por sede. |
| 3 | Un error al generar la comisión habría **bloqueado** el cobro/cierre del servicio en el POS. | Trigger con manejo de excepción: audita `GANANCIA_GENERACION_FALLIDA`; la novedad crítica lo marca. |
| 4 | El agente de soporte no podía descubrir sesiones autorizadas (RLS solo permite ver las tomadas) o habría hecho falta abrir la tabla. | `soporte_ganancias_disponibles()` (solo SuperSU, sin datos financieros). |
| 5 | CSV: inyección de fórmulas en celdas de texto. | `celdaCsv` antepone `'` (con prueba). |
| 6 | Confirmación duplicada en el formulario genérico (reenvío tras confirmar). | Bandera `yaConfirmado`. |

## Mejoras / límites conocidos (no resueltos)
1. **Descuento por puntos canjeados** no se guarda en la reserva, así que no reduce la base; hay que persistirlo en el POS para reflejarlo.
2. **Reembolsos**: se genera una novedad `REEMBOLSO_SIN_AJUSTE`; el ajuste lo decide el negocio (no hay reversión automática de comisión).
3. **Evidencia adjunta** (solicitudes de revisión, comprobante de pago): los campos existen y validan prefijo `{negocio}/`, pero **no hay bucket de Storage ni UI de subida**; pendiente de diseñar con políticas por negocio, tamaño y MIME.
4. **Notificaciones** (fase 19): no se integraron al sistema existente; hoy la visibilidad es por pantalla.
5. **Exportación**: CSV implementado; Excel/PDF nativos no (el comprobante se imprime/guarda como PDF desde el navegador).
6. **Analítica con IA** (fase 14): solo reglas deterministas de novedades; no se añadió IA.
7. **Notas de rendimiento**: `ganancias_listar` calcula el estado de cobro por fila; con volúmenes muy grandes conviene materializarlo.
8. **Fecha de corte** usa `current_date` del servidor (UTC) para impedir períodos futuros; en horario nocturno de Colombia puede permitir el día siguiente.
9. **Intervención de soporte con escritura**: no implementada a propósito.
10. `libro_122`, `auditoria_123` y `aislamiento_multiempresa` (SQL previos) fallan en local por el SuperSU único y una condición de fecha; no están relacionados con este módulo.
