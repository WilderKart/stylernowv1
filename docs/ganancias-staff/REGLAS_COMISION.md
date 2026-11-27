# Reglas de comisión

## Qué se puede configurar (`comision_regla`)
Porcentaje (0–100), **base** (`NETO` = después de descuento · `PRECIO_ORIGINAL`), alcance opcional por **profesional, servicio o categoría (no ambos), sede**, vigencia (`vigente_desde`/`vigente_hasta`), motivo, autor y versión.

## Jerarquía (determinista)
Puntaje = 8·profesional + 4·servicio + 2·categoría + 1·sede. Gana el mayor; empate → `vigente_desde` más reciente → creada más reciente.

| Orden | Regla |
|---|---|
| 1 | profesional + servicio (+sede) |
| 2 | profesional + categoría |
| 3 | profesional |
| 4 | servicio |
| 5 | categoría |
| 6 | sede |
| 7 | general del negocio |
| 8 | sin regla → `vinculo_staff_negocio.comision_pct` (base NETO) |
| 9 | nada → `SIN_REGLA` (comisión 0) + novedad `SERVICIO_SIN_REGLA` |

Dos reglas **activas** del mismo alcance no pueden solaparse en fechas (trigger `REGLA_SOLAPADA`), así no hay ambigüedad entre iguales.

## Versionado y no retroactividad
Una regla no se edita: «Reemplazar» crea la versión n+1 y deja la anterior INACTIVA; «Desactivar» exige motivo. Cada cambio queda en `evento_auditoria`. Cambiar reglas **nunca** altera comisiones ya generadas: cada `staff_ganancia` guarda `regla_id`, `regla_version`, `pct`, `base_tipo` y `base_comision`.

## Cálculo
```
descuento_total = min( max(Σ precios − monto_total_reserva, 0) + beneficio de membresía , Σ precios )
descuento_línea = prorrateo por precio (la última línea absorbe el redondeo)
valor_neto      = precio_original − descuento_línea
base            = NETO ? valor_neto : precio_original
comisión        = min( round(base × pct / 100, 2), base )
participación   = valor_neto − comisión
```
Los productos vendidos en el POS **no** generan comisión de servicio. Los descuentos por puntos canjeados no se guardan hoy en la reserva y no se reflejan (ver mejoras).

## Previsualización
`comision_previsualizar` calcula cuánto recibiría el profesional y cuánto el negocio para un precio/descuento dado, sin guardar nada.
