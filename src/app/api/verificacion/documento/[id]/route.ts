import { configCloudinary, leerDocumentoPrivado } from "@/lib/almacenamiento/cloudinary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

/**
 * GET /api/verificacion/documento/[id]
 *
 * Entrega un documento privado SOLO al propietario del negocio o a SuperSU, y deja cada lectura en auditoría.
 * Los bytes pasan por aquí: la URL firmada de Cloudinary no sale nunca del servidor ni llega al navegador.
 * «No existe» y «no es tuyo» responden igual (404) para no revelar qué identificadores existen.
 */
export async function GET(_request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("no encontrado", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("no autorizado", { status: 401 });
  if (!configCloudinary()) return new Response("no disponible", { status: 503 });

  const { data, error } = await (createAdminClient() as unknown as RpcSinTipos).rpc("autorizar_lectura_documento_srv", {
    p_actor: user.id,
    p_documento_id: id,
  });
  if (error || !data) return new Response("no encontrado", { status: 404 });
  const d = data as { public_id: string; version: number; formato: string };

  try {
    const doc = await leerDocumentoPrivado(d.public_id, d.version, d.formato);
    return new Response(doc.cuerpo, {
      headers: {
        "Content-Type": doc.tipo,
        ...(doc.longitud ? { "Content-Length": doc.longitud } : {}),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="documento.${d.formato}"`,
        "X-Content-Type-Options": "nosniff",
        // El documento se muestra como contenido inerte: sin scripts ni recursos externos.
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("no disponible", { status: 502 });
  }
}
