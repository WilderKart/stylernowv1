/** Tipos y límites compartidos del chat de soporte (servidor y navegador). */

export type AdjuntoChat = {
  tipo: "IMAGEN" | "PDF";
  nombre: string;
  /** URL firmada y temporal (1 h) del bucket privado; null si no se pudo firmar. */
  url: string | null;
};

export type MensajeChat = {
  id: string;
  conversacionId: string;
  negocioId: string;
  remitenteRol: "BARBERIA" | "SUPERSU";
  cuerpo: string;
  createdAt: string;
  leido: boolean;
  adjunto: AdjuntoChat | null;
};

/** Adjunto ya subido a Storage, listo para enviarse con el mensaje. */
export type AdjuntoSubido = { ruta: string; tipo: "IMAGEN" | "PDF"; nombre: string };

export const LIMITE_IMAGEN_BYTES = 500 * 1024;
export const LIMITE_PDF_BYTES = 5 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export const BUCKET_ADJUNTOS = "soporte-adjuntos";

/**
 * Mensaje de texto armado directo desde el evento de tiempo real (fila de `soporte_mensaje`), para pintarlo al instante sin
 * esperar una consulta. Los mensajes con adjunto devuelven null: necesitan URL firmada y se cargan con la consulta normal.
 */
export function mensajeDesdeEvento(fila: unknown): MensajeChat | null {
  const f = fila as Record<string, unknown> | null;
  if (!f || typeof f.id !== "string" || typeof f.conversacion_id !== "string" || typeof f.cuerpo !== "string") return null;
  if (f.remitente_rol !== "BARBERIA" && f.remitente_rol !== "SUPERSU") return null;
  if (f.adjunto_url) return null;
  return {
    id: f.id,
    conversacionId: f.conversacion_id,
    negocioId: typeof f.negocio_id === "string" ? f.negocio_id : "",
    remitenteRol: f.remitente_rol,
    cuerpo: f.cuerpo,
    createdAt: typeof f.created_at === "string" ? f.created_at : new Date().toISOString(),
    leido: f.leido_at != null,
    adjunto: null,
  };
}
