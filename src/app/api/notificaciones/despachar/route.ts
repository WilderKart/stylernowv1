import { timingSafeEqual } from "node:crypto";
import { procesarOutbox } from "@/lib/notificaciones/worker";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

/**
 * POST /api/notificaciones/despachar — despacho inmediato del outbox.
 *
 * La base (trigger de la migración 198, vía pg_net) llama aquí en cuanto se encola un aviso, para que el push salga en segundos
 * y no al día siguiente. La autorización NO es una sesión ni una cabecera que el navegador pueda inventar: es un secreto que
 * se generó dentro de la base (Vault) y que solo ella y el servidor (service_role) conocen. Sin él → 401. No lee el cuerpo y
 * no devuelve datos de nadie: solo conteos.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: NextRequest) {
  const recibido = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!recibido || recibido.length > 200) return new Response("no autorizado", { status: 401 });

  const admin = createAdminClient() as unknown as { rpc: (n: string) => Promise<{ data: unknown; error: unknown }> };
  const { data, error } = await admin.rpc("notif_despacho_secreto");
  if (error || typeof data !== "string" || data.length < 16 || !iguales(recibido, data)) {
    return new Response("no autorizado", { status: 401 });
  }

  // Sin regenerar recordatorios programados: esto es solo "hay avisos nuevos, envíalos".
  const r = await procesarOutbox(50, { programadas: false });
  return Response.json({ tomadas: r.tomadas, por_estado: r.por_estado, panel: r.panel_entregadas, errores: r.errores.length });
}
