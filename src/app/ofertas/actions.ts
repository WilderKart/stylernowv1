"use server";

import { consentirBeneficiosMarcas } from "@/lib/cliente/ofertas";
import { revalidatePath } from "next/cache";

export type ResultadoConsentimiento = { ok: true; activo: boolean } | { ok: false; error: string };

/** El consentimiento lo decide el usuario con la casilla; la identidad sale de la sesión en la BD. */
export async function cambiarConsentimientoMarcas(otorgado: boolean): Promise<ResultadoConsentimiento> {
  const r = await consentirBeneficiosMarcas(otorgado === true);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/ofertas");
  return { ok: true, activo: r.data.activo };
}
