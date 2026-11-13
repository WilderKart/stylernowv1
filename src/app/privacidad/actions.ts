"use server";

import { guardarPrivacidad, type PropositoConsentimiento } from "@/lib/cliente/privacidad";
import { revalidatePath } from "next/cache";

const PROPOSITOS: PropositoConsentimiento[] = ["analitica", "personalizacion", "ofertas_cercanas", "beneficios_marcas", "marketing_whatsapp"];

/** «GUARDAR PREFERENCIAS». Solo acepta los propósitos del centro de privacidad con valores booleanos estrictos. */
export async function guardarPreferenciasPrivacidad(
  prefs: Partial<Record<PropositoConsentimiento, boolean>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limpio: Partial<Record<PropositoConsentimiento, boolean>> = {};
  for (const p of PROPOSITOS) {
    if (typeof prefs?.[p] === "boolean") limpio[p] = prefs[p];
  }
  const r = await guardarPrivacidad(limpio);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/privacidad");
  return { ok: true };
}
