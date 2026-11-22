"use server";

import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Verificación de negocios (SuperSU). Cero confianza: aquí se exige SuperSU y las funciones de la migración 157
 * lo vuelven a exigir en la base, validan la transición permitida y dejan cada decisión en el historial inmutable.
 */

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  MOTIVO_REQUERIDO: "Escribe el motivo de la decisión (mínimo 10 caracteres).",
  TRANSICION_NO_PERMITIDA: "Esa decisión no es posible desde el estado actual.",
  ESTADO_INVALIDO: "Estado no válido.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos completar la acción. Intenta de nuevo.";
}

const esquema = z.object({
  negocioId: z.string().uuid(),
  nuevo: z.enum(["VERIFICADA", "REQUIERE_CORRECCION", "RECHAZADA", "REVOCADA"]),
  motivo: z.string().trim().min(10).max(1000),
});

export async function decidirVerificacion(entrada: z.input<typeof esquema>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperSU();
  const p = esquema.safeParse(entrada);
  if (!p.success) return { ok: false, error: MENSAJES.MOTIVO_REQUERIDO };
  const supabase = (await createClient()) as unknown as RpcSinTipos;
  const { error } = await supabase.rpc("admin_decidir_verificacion", {
    p_negocio_id: p.data.negocioId,
    p_nuevo: p.data.nuevo,
    p_motivo: p.data.motivo,
  });
  if (error) return { ok: false, error: traducir(error.message) };
  revalidatePath("/admin/verificaciones");
  revalidatePath("/admin/verificaciones/" + p.data.negocioId);
  return { ok: true };
}
