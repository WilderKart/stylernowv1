import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Límite de tasa por IP / clave, respaldado en BD (RPC `consumir_cupo`, migración 112, solo service_role).
 * Devuelve `{ ok: false, retryAfter }` (segundos) cuando se excede; úsalo para responder 429 con `Retry-After`
 * en Route Handlers o para devolver un error amable en Server Actions. Si la RPC no existe todavía o falla,
 * NO bloquea (fail-open) para no tumbar el login; el aviso queda en el log del servidor.
 */
export async function ipDelLlamador() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "sin-ip";
}

export async function limitar(nombre: string, clave: string, limite: number, ventanaSeg: number) {
  try {
    const admin = createAdminClient() as unknown as {
      rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const huella = createHash("sha256").update(clave).digest("hex").slice(0, 32);
    const { data, error } = await admin.rpc("consumir_cupo", {
      p_clave: `${nombre}:${huella}`,
      p_limite: limite,
      p_ventana_seg: ventanaSeg,
    });
    if (error) {
      console.error("[rate-limit] fail-open:", error.message);
      return { ok: true as const };
    }
    const espera = Number(data ?? 0);
    return espera > 0 ? { ok: false as const, retryAfter: espera } : { ok: true as const };
  } catch (e) {
    console.error("[rate-limit] fail-open:", e);
    return { ok: true as const };
  }
}
