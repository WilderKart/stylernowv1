/**
 * Cálculo de precios de suscripción. Funciones puras: todo valor sale de la BD
 * (plan_precio, pais), nada se escribe a mano en componentes.
 *
 * Reglas del negocio:
 *  - Anual: paga `mesesPagadosAnual` (10) y usa 12 meses.
 *  - Fundador: porcentaje de descuento (30 %) sobre el 100 % del precio, solo a la
 *    suscripción mensual; add-ons, publicidad y WhatsApp extra se cobran completos.
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
  // El descuento fundador no se combina con el ciclo anual.
  const pct = anual ? 0 : Math.min(Math.max(e.descuentoFundadorPct, 0), 100);
  const final = redondear(lista * (1 - pct / 100));
  return { lista, final, ahorro: redondear(lista - final), mesesCubiertos: anual ? 12 : 1 };
}
