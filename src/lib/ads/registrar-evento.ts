import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Registro de clics e impresiones de Marketplace Ads (hallazgo H8). Antes la página llamaba directamente a las RPC desde
 * la sesión del visitante (o anónimo), que cobraban de la billetera del anunciante sin validar nada. Ahora:
 *  - solo el servidor puede registrar (RPC restringida a service_role, migración 111);
 *  - la huella del llamador se calcula aquí (usuario autenticado, o IP + agente) con una sal secreta;
 *  - el clic exige un usuario autenticado y la campaña debe pertenecer al negocio indicado (lo valida la RPC);
 *  - la BD deduplica por huella/campaña/tipo/día y limita eventos por huella.
 * Nunca lanza: un fallo de analítica no debe romper la página.
 */
async function huellaDe(usuarioId: string | null) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const agente = h.get("user-agent") ?? "";
  const base = usuarioId ? `u:${usuarioId}` : `a:${ip}|${agente}`;
  const sal = process.env.SUPABASE_SECRET_KEY ?? "";
  return createHash("sha256").update(`${sal}|${base}`).digest("hex");
}

export async function registrarEventoAnuncio(
  tipo: "CLIC" | "IMPRESION",
  campanaId: string,
  negocioId: string | null,
  usuarioId: string | null,
) {
  try {
    if (tipo === "CLIC" && !usuarioId) return; // identidad requerida para cobrar un clic
    const admin = createAdminClient();
    await (admin as unknown as {
      rpc: (n: string, a: object) => Promise<unknown>;
    }).rpc("registrar_evento_patrocinado", {
      p_tipo: tipo,
      p_campana_id: campanaId,
      p_negocio_id: negocioId ?? "00000000-0000-0000-0000-000000000000",
      p_huella: await huellaDe(usuarioId),
    });
  } catch {
    /* analítica: se ignora */
  }
}
