"use server";

import { cancelarEliminacion, exportarMisDatos, solicitarEliminacion } from "@/lib/cliente/cuenta";
import { revalidatePath } from "next/cache";

/** Exportar: la sesión sale de las cookies en servidor; el RPC solo devuelve datos del propio usuario. */
export async function exportarDatosAccion(): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  const r = await exportarMisDatos();
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, json: JSON.stringify(r.data, null, 2) };
}

/** Paso 2 de 2. La confirmación se vuelve a validar en servidor (y otra vez en la BD). */
export async function solicitarEliminacionAccion(confirmacion: string): Promise<{ ok: true; programadaPara: string } | { ok: false; error: string }> {
  if ((confirmacion ?? "").trim().toUpperCase() !== "ELIMINAR") return { ok: false, error: "Escribe ELIMINAR para confirmar." };
  const r = await solicitarEliminacion("ELIMINAR");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/cuenta");
  return { ok: true, programadaPara: r.data.programada_para };
}

export async function cancelarEliminacionAccion(): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await cancelarEliminacion();
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/cuenta");
  return { ok: true };
}
