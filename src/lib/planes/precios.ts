/**
 * Cálculo de precios de suscripción. Funciones puras: todo valor sale de la BD
 * (plan_precio, pais), nada se escribe a mano en componentes.
 *
 * Reglas del negocio:
 *  - Anual: paga `mesesPagadosAnual` (10) y usa 12 meses.
 *  - Fundador: porcentaje de descuento (30 %). Mensual: sobre el precio del mes durante los meses fundador (3).
 *    Anual: una sola vez y solo sobre un mes (el primero); luego precio normal. Add-ons, publicidad y WhatsApp extra se cobran completos.
 *  - Los «2 meses gratis» del anual son una promoción de lanzamiento modificable sin previo aviso (Términos 8(f)).
 *  - Precios de ES y MX se publican + IVA (`precioMasImpuesto`).
 */
export type CicloFacturacion = "MENSUAL" | "ANUAL";

export interface EntradaPrecio {
  precioMensual: number;
  ciclo: CicloFacturacion;
  mesesPagadosAnual: number;
  /** 0 si no aplica el descuento fundador. */
  descuentoFundadorPct: number;
}

export interface PrecioCalculado {
  /** Precio de lista por ciclo (mensual, o anual = mensual × meses pagados). */
  lista: number;
  /** Lo que realmente se cobra por ciclo, con descuento fundador si aplica. */
  final: number;
  /** Monto descontado por ciclo. */
  ahorro: number;
  /** Meses de uso que cubre un ciclo. */
  mesesCubiertos: 1 | 12;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularPrecio(e: EntradaPrecio): PrecioCalculado {
  const anual = e.ciclo === "ANUAL";
  const lista = redondear(anual ? e.precioMensual * e.mesesPagadosAnual : e.precioMensual);
  const pct = Math.min(Math.max(e.descuentoFundadorPct, 0), 100);
  // Mensual: el descuento fundador se aplica al cobro del mes (la duración, 3 meses, la controla la suscripción fundador).
  // Anual: no hay 3 meses; el descuento se aplica UNA sola vez y solo sobre el valor de un mes (el primero); la renovación va a precio normal.
  const descuento = anual ? e.precioMensual * (pct / 100) : lista * (pct / 100);
  const final = redondear(lista - descuento);
  return { lista, final, ahorro: redondear(lista - final), mesesCubiertos: anual ? 12 : 1 };
}
