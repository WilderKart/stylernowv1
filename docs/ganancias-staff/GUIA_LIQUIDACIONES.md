# Guía de liquidaciones

- **Períodos**: diario, semanal, quincenal, mensual o personalizado (solo cambia la etiqueta; el corte real son las fechas desde–hasta, sin fechas futuras).
- **Qué entra**: comisiones del profesional en estado PENDIENTE dentro del período (y de la sede elegida, si la hay) + todos sus ajustes pendientes. Quedan fuera las que estén EN REVISIÓN o SIN REGLA. El total debe ser positivo.
- **Parcial**: liquida solo una sede o un tramo de fechas; lo demás sigue pendiente. El pago también puede ser parcial: cada pago descuenta del saldo y la liquidación pasa a *Pago parcial* → *Pagada*.
- **Doble clic / reintento**: el segundo cierre no encuentra pendientes; un pago repetido con la misma clave devuelve el ya registrado.
- **Pagos**: se registran con monto, medio, referencia y fecha; no pueden exceder el saldo. *Anular pago* exige motivo (mín. 10) y recalcula el saldo.
- **Revertir**: solo si no hay pagos vigentes; las comisiones y ajustes vuelven a pendientes y se puede volver a cerrar. La liquidación revertida queda visible.
- **Comprobante**: `/panel/ganancias/liquidacion/{id}` (y el del profesional): negocio, sede, profesional, período, servicios, ajustes, pagos y saldo; se imprime o guarda como PDF.
