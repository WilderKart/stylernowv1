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
 */
export async function verificarAccesoPanel(
  rolesPermitidos: Array<Extract<RolPanel, "BARBERIA" | "GUARDIAN">>,
  rutaActual: string
): Promise<ContextoUsuario> {
  const contexto = await resolverContexto();

  if (!contexto.userId) redirect(destinoSeguro(`/login?next=${rutaActual}`));
  if (contexto.rol === "NINGUNO") redirect(destinoSeguro("/panel/onboarding"));
  if (contexto.rol === "STAFF") forbidden();
  if (!rolesPermitidos.includes(contexto.rol)) forbidden();

  return contexto;
}
