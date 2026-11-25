import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { BUCKET_ADJUNTOS, type MensajeChat } from "./tipos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export const COLUMNAS_MENSAJE = "id, conversacion_id, negocio_id, remitente_rol, cuerpo, created_at, leido_at, adjunto_url, adjunto_tipo, adjunto_nombre";

type FilaMensaje = {
  id: string;
  conversacion_id: string;
  negocio_id: string;
  remitente_rol: string;
  cuerpo: string;
  created_at: string;
  leido_at: string | null;
  adjunto_url: string | null;
  adjunto_tipo: string | null;
  adjunto_nombre: string | null;
};

/** Convierte filas en mensajes y firma las URLs de los adjuntos con la sesión de quien lee (Storage aplica su propia política). */
export async function mapearMensajes(supabase: Cliente, filas: FilaMensaje[]): Promise<MensajeChat[]> {
  const rutas = filas.map((f) => f.adjunto_url).filter((r): r is string => Boolean(r));
  const firmadas = new Map<string, string>();
  if (rutas.length > 0) {
    const { data } = await supabase.storage.from(BUCKET_ADJUNTOS).createSignedUrls(rutas, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl);
  }
  return filas.map((m) => ({
    id: m.id,
    conversacionId: m.conversacion_id,
    negocioId: m.negocio_id,
    remitenteRol: m.remitente_rol as "BARBERIA" | "SUPERSU",
    cuerpo: m.cuerpo,
    createdAt: m.created_at,
    leido: m.leido_at !== null,
    adjunto: m.adjunto_url && m.adjunto_tipo ? { tipo: m.adjunto_tipo as "IMAGEN" | "PDF", nombre: m.adjunto_nombre ?? "adjunto", url: firmadas.get(m.adjunto_url) ?? null } : null,
  }));
}
