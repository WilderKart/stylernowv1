"use server";

import { compartirFotoMyLook } from "@/lib/cliente/mylook-pagos";
import { revalidatePath } from "next/cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoCompartir = { ok: true; compartida: boolean } | { ok: false; error: string };

/** Publica/retira las fotos de una cita del portafolio del profesional. La BD valida que sean del usuario. */
export async function compartirFotos(fotoIds: string[], compartir: boolean): Promise<ResultadoCompartir> {
  if (!Array.isArray(fotoIds) || fotoIds.length === 0 || fotoIds.length > 20 || !fotoIds.every((i) => typeof i === "string" && UUID.test(i))) {
    return { ok: false, error: "Foto inválida." };
  }
  for (const id of fotoIds) {
    const r = await compartirFotoMyLook(id, compartir === true);
    if (!r.ok) return { ok: false, error: r.error };
  }
  revalidatePath("/mi-look");
  return { ok: true, compartida: compartir === true };
}
