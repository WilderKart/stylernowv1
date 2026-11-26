"use server";

import { llamar, type Resultado } from "@/lib/ganancias/rpc";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * El profesional solo PIDE una revisión; no puede alterar ningún valor. La base verifica que el registro sea suyo (si no lo es,
 * responde igual que si no existiera) y que no haya otra solicitud abierta para el mismo registro.
 */
export async function solicitarRevision(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const p = z
    .object({
      tipo: z.enum(["GANANCIA", "LIQUIDACION", "PAGO", "AJUSTE"]),
      objeto: z.string().uuid(),
      motivo: z.string().trim().min(10).max(500),
    })
    .safeParse(Object.fromEntries(fd.entries()));
  if (!p.success) return { ok: false, error: "Escribe el motivo con al menos 10 caracteres." };
  const r = await llamar("revision_solicitar", { p_tipo: p.data.tipo, p_objeto: p.data.objeto, p_motivo: p.data.motivo, p_evidencia_path: null });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/staff/ganancias");
  return { ok: true };
}
