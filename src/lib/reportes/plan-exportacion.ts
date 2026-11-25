export interface FuncionesPlanReportes {
  periodo: boolean;
  avanzados: boolean;
  consolidado: boolean;
}

export type DecisionExportacion =
  | { ok: true; desde: string | undefined; hasta: string | undefined; agrupacion: "semana" | "mes" }
  | { ok: false };

export const MENSAJE_EXPORTACION_PLAN = "Esta exportación no está incluida en tu plan actual.";

/**
 * Misma política que las Server Actions de /panel/reportes (migración 192):
 *  - sin `periodo` (Essential): solo el día de hoy; rechaza semana/mes y rangos distintos de hoy.
 *  - sin `consolidado`: un negocio con más de una sede debe indicar la sede.
 * Pura y sin I/O para poder probarla sin base de datos.
 */
export function evaluarExportacionIngresos(entrada: {
  funciones: FuncionesPlanReportes;
  agrupacion?: "semana" | "mes";
  desde?: string;
  hasta?: string;
  sedeId?: string;
  sedesActivas: number;
  hoy: string;
}): DecisionExportacion {
  const { funciones, agrupacion, desde, hasta, sedeId, sedesActivas, hoy } = entrada;
  if (!sedeId && !funciones.consolidado && sedesActivas > 1) return { ok: false };
  if (!funciones.periodo) {
    if (agrupacion) return { ok: false };
    if ((desde && desde !== hoy) || (hasta && hasta !== hoy)) return { ok: false };
    return { ok: true, desde: hoy, hasta: hoy, agrupacion: "mes" };
  }
  return { ok: true, desde, hasta, agrupacion: agrupacion ?? "mes" };
}
