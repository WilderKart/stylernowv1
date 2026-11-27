"use server";

import { requireSuperSU } from "@/lib/auth/require-supersu";
import { llamar, type Resultado } from "@/lib/ganancias/rpc";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Soporte de ganancias (SuperSU). Aquí NO hay lectura libre: solo se puede tomar un acceso que el PROPIETARIO pidió y autorizó, que
 * esté vigente y que no haya tomado otra persona. La base vuelve a validarlo y nunca concede escritura.
 */
export async function tomarAcceso(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await requireSuperSU();
  const p = z.object({ acceso: z.string().uuid() }).safeParse(Object.fromEntries(fd.entries()));
  if (!p.success) return { ok: false, error: "Datos inválidos." };
  const r = await llamar("soporte_ganancias_tomar", { p_acceso: p.data.acceso });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/ganancias-soporte");
  return { ok: true };
}

export async function cerrarAcceso(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await requireSuperSU();
  const p = z.object({ acceso: z.string().uuid() }).safeParse(Object.fromEntries(fd.entries()));
  if (!p.success) return { ok: false, error: "Datos inválidos." };
  const r = await llamar("soporte_ganancias_revocar", { p_acceso: p.data.acceso, p_motivo: "Cerrado por el agente de soporte" });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/ganancias-soporte");
  return { ok: true };
}
