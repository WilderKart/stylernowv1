import "server-only";

import { cookies } from "next/headers";
import { COOKIE_TEMA, COOKIE_TEMA_SISTEMA, esModoTema, temaEfectivo, type ModoTema, type TemaEfectivo } from "./preferencia";

/** Modo elegido (por defecto, claro: así la app se ve igual que antes para quien nunca lo cambió). */
export async function obtenerModoTema(): Promise<ModoTema> {
  try {
    const v = (await cookies()).get(COOKIE_TEMA)?.value;
    return esModoTema(v) ? v : "light";
  } catch {
    return "light";
  }
}

export async function obtenerTemaEfectivo(): Promise<TemaEfectivo> {
  try {
    const c = await cookies();
    return temaEfectivo(c.get(COOKIE_TEMA)?.value, c.get(COOKIE_TEMA_SISTEMA)?.value);
  } catch {
    return "light";
  }
}
