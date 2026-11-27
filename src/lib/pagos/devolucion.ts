/**
 * Devolución al cancelar una reserva (migración 207). Espejo de `cancelar_reserva`: solo para MOSTRAR la cifra antes de
 * confirmar; la que se ejecuta siempre es la que calcula la base de datos.
 *
 * Lo pagado se reparte en dos: el ANTICIPO (lo único que la política de cancelación puede retener) y el EXCEDENTE del servicio
 * (si el cliente pagó el servicio completo, lo que pasa del anticipo; siempre se devuelve si la cita no se presta).
 *     devolución = excedente + anticipo × pct / 100
 * Ejemplo: servicio 30.000, anticipo 10.000 → pct 100: 30.000 · pct 50: 25.000 · pct 0: 20.000.
 */

export interface Devolucion {
  /** Cuánto se devuelve en total. */
  monto: number;
  /** Porcentaje de la política que se aplica al anticipo (0–100). */
  pct: number;
  /** Parte de lo pagado que es anticipo. */
  anticipo: number;
  /** Parte del servicio pagada por encima del anticipo. */
  exceso: number;
  /** Parte del anticipo que se devuelve. */
  anticipoDevuelto: number;
  /** Parte del anticipo que se queda el negocio. */
  anticipoRetenido: number;
}

export function calcularDevolucion(params: { pagado: number; anticipoBase: number | null | undefined; pct: number }): Devolucion {
  const pagado = Math.max(Number(params.pagado) || 0, 0);
  // Sin anticipo base (reservas anteriores, o negocios que no cobran el total) el anticipo es todo lo pagado.
  const anticipo = Math.min(params.anticipoBase == null ? pagado : Math.max(Number(params.anticipoBase), 0), pagado);
  const exceso = pagado - anticipo;
  const pct = Math.min(Math.max(params.pct, 0), 100);
  const anticipoDevuelto = Math.round((anticipo * pct) / 100);
  return {
    monto: exceso + anticipoDevuelto,
    pct,
    anticipo,
    exceso,
    anticipoDevuelto,
    anticipoRetenido: anticipo - anticipoDevuelto,
  };
}

/** Horas mínimas de anticipación con las que el negocio puede cancelar una reserva (migración 207). */
export const HORAS_MINIMAS_CANCELACION_NEGOCIO = 2;

/** true si al negocio todavía le falta tiempo suficiente para cancelar esta reserva. */
export function negocioPuedeCancelar(horaInicioISO: string, ahora: number = Date.now()): boolean {
  return (new Date(horaInicioISO).getTime() - ahora) / 3_600_000 >= HORAS_MINIMAS_CANCELACION_NEGOCIO;
}
