# Arquitectura — Ganancias, comisiones y liquidaciones del staff

Migración **201**. Extiende StylerNow; no crea una app aparte ni una máquina de estados paralela para las reservas.

## Flujo
```
Agenda / POS / walk-in ──► reserva.estado = COMPLETADA  (completar_venta_pos, completar_reserva_sin_pos)
                                   │  trigger AFTER UPDATE (SECURITY DEFINER, nunca bloquea la operación)
                                   ▼
                          _ganancia_generar(reserva)      ← idempotente: unique(reserva_id, servicio_id)
                                   │  una fila por servicio
                                   ▼
        staff_ganancia  (precio, descuento, base, %, comisión, participación, regla y versión usadas)
                                   │
        liquidacion_cerrar ──► ganancia_liquidacion + _item   (cierre inmutable)
                                   │
        liquidacion_registrar_pago ──► ganancia_pago  (REGISTRO manual; StylerNow no mueve dinero)
        ganancia_ajustar / ganancia_pago_anular / liquidacion_revertir  (correcciones auditadas)
```

## Separación de conceptos (fase 2.2)
| Concepto | Dónde vive |
|---|---|
| Servicio prestado | `reserva` (+ `reserva_servicio`) — sin cambios |
| Producción / base / comisión | `staff_ganancia` |
| Obligación de pago | `ganancia_liquidacion.total_neto` |
| Pago al profesional | `ganancia_pago` |
| Ajuste / reversión | `ganancia_ajuste`, `liquidacion_revertir`, `ganancia_pago_anular` |
| Cobro al cliente | `pago` (existente); se *deriva* en `_gan_estado_cobro` |
| Auditoría | `evento_auditoria` vía `_auditar` (existente) |

Estados independientes: servicio (`reserva.estado`), cobro (derivado), comisión (`staff_ganancia.estado_comision`: SIN_REGLA, PENDIENTE, EN_REVISION, LIQUIDADA, REVERTIDA) y liquidación (`ganancia_liquidacion.estado`: CERRADA, PAGADA_PARCIAL, PAGADA, REVERTIDA).

## Capas y confianza
- **Base de datos = autoridad.** RLS solo SELECT; cada escritura es una función que deriva la identidad de `auth.uid()` y valida negocio, sede y capacidad.
- **Server Actions / rutas** derivan el negocio de la sesión (`resolverContexto`), validan con zod y delegan en esas funciones.
- **Interfaz** solo muestra; ocultar un botón nunca es el control.
- SuperSU no tiene bypass: ver `SEGURIDAD.md` y `GUIA_SUPERSU.md`.

## Superficies
- Panel de negocio: `/panel/ganancias` (pestañas Ganancias, Liquidaciones, Reglas, Novedades, Revisiones, Permisos y soporte), `/panel/ganancias/liquidacion/[id]` (comprobante), `/panel/ganancias/exportar` (CSV).
- Profesional: `/staff/ganancias` y su comprobante.
- SuperSU: `/admin/ganancias-soporte`.

## Decisiones y límites conocidos
Ver `DECISIONES.md` y `VULNERABILIDADES_Y_MEJORAS.md`.
