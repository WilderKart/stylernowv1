import "server-only";
import { forbidden, redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { resolverContexto, type ContextoUsuario, type RolPanel } from "@/lib/auth/resolver-contexto";

/**
 * ADR-015 v1.2 — Capa de Compatibilidad de Autorización (transición
 * controlada, no un parche). Reemplaza el bloque de 3 líneas repetido en
 * ~27 páginas de `/panel` por un único punto de entrada, sin tocar el resto
 * de cada archivo (`PanelNav`, comparaciones `contexto.rol === "GUARDIAN"`,
 * `sedeId`, etc. siguen exactamente igual — `RolPanel` sigue en MAYÚSCULA).
 *
 * La migración completa a un `Contexto` unificado en minúscula (eliminar
 * `RolPanel`, `PanelNav` tipado por Permission Registry) queda documentada
 * como trabajo futuro en `ADR_016_Authorization_Refactor.md` — no se ejecuta
 * aquí para no arriesgar código de autorización ya verificado.
 *
 * "ADMIN" (administrador delegado, migración 158/161) es OPT-IN: una página solo lo admite si lo pide expresamente en
 * `rolesPermitidos`. Las ~27 páginas existentes piden ["BARBERIA","GUARDIAN"], así que un administrador recibe 403 en todas ellas
 * salvo en las que se revisaron para él (hoy solo /panel/staff). Denegado por defecto.
 */
export async function verificarAccesoPanel(
  rolesPermitidos: Array<Extract<RolPanel, "BARBERIA" | "ADMIN" | "GUARDIAN">>,
  rutaActual: string
): Promise<ContextoUsuario> {
  const contexto = await resolverContexto();

  if (!contexto.userId) redirect(destinoSeguro(`/login?next=${rutaActual}`));
  if (contexto.rol === "NINGUNO") redirect(destinoSeguro("/panel/onboarding"));
  if (contexto.rol === "STAFF") forbidden();
  if (!rolesPermitidos.includes(contexto.rol)) forbidden();

  return contexto;
}
