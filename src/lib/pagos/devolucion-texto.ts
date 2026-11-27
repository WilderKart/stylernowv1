import type { Traductor } from "@/lib/i18n/diccionario";
import { formatCOP } from "@/lib/utils";
import type { Devolucion } from "./devolucion";

/**
 * Frase que ve el cliente antes de cancelar, según cuánto pagó:
 *  · sin excedente (anticipo solo)  → el texto de siempre ("X, N % del anticipo" / sin reembolso);
 *  · pagó el servicio completo      → desglosa el resto del servicio y la parte del anticipo.
 */
export function textoDevolucion(t: Traductor, d: Devolucion, formato: "reserva" | "cancelar"): string {
  if (d.exceso <= 0) {
    if (d.pct === 0) return t(formato === "reserva" ? "rv.sin_reembolso" : "canc.sin_reembolso");
    return t(formato === "reserva" ? "rv.con_reembolso" : "canc.con_reembolso", { monto: formatCOP(d.monto), pct: d.pct });
  }
  if (d.pct === 100 || d.anticipo <= 0) return t("devol.todo", { monto: formatCOP(d.monto) });
  if (d.pct === 0) return t("devol.solo_resto", { monto: formatCOP(d.monto), anticipo: formatCOP(d.anticipo) });
  return t("devol.mixto", {
    monto: formatCOP(d.monto),
    exceso: formatCOP(d.exceso),
    parte: formatCOP(d.anticipoDevuelto),
    pct: d.pct,
    retenido: formatCOP(d.anticipoRetenido),
  });
}
