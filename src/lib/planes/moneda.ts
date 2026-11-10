/** Formato de moneda por país. No convierte monedas: cada país tiene su precio propio en BD. */
export type MonedaCodigo = "COP" | "USD" | "EUR" | "MXN";

const SIN_DECIMALES: MonedaCodigo[] = ["COP", "MXN"];

/** Idioma de la interfaz → locale de Intl. El país decide moneda; el idioma, el formato. */
export function formatearMoneda(monto: number, moneda: string, locale: string): string {
  const entero = Number.isInteger(monto) || SIN_DECIMALES.includes(moneda as MonedaCodigo);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: entero ? 0 : 2,
  }).format(monto);
}
