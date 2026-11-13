import "server-only";

/**
 * Motivo de un cambio administrativo para la auditoría (migración 123).
 *
 * Las RPC antiguas de SuperSU (admin_set_pais, admin_set_plan_precio, …) no tienen parámetro
 * `p_motivo`. En vez de cambiar su firma (crearía sobrecargas), el servidor manda el motivo en la
 * cabecera `x-auditoria-motivo` (base64 de UTF-8, porque las cabeceras HTTP son ASCII) y el trigger
 * de evento_auditoria lo guarda en las filas de esa petición que no traigan motivo propio.
 * La autorización NO depende de esto: la RPC sigue exigiendo is_supersu() en la base.
 */

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

/** Normaliza y valida el motivo. Devuelve null si no cumple el mínimo. */
export function validarMotivo(motivo: unknown): string | null {
  if (typeof motivo !== "string") return null;
  const limpio = motivo.replace(/\s+/g, " ").trim().slice(0, MOTIVO_MAX);
  return limpio.length >= MOTIVO_MIN ? limpio : null;
}

/** Adjunta el motivo como cabecera a una consulta o RPC de supabase-js antes de ejecutarla. */
export function conMotivo<T extends { setHeader(nombre: string, valor: string): T }>(consulta: T, motivo: string): T {
  return consulta.setHeader("x-auditoria-motivo", Buffer.from(motivo, "utf8").toString("base64"));
}
