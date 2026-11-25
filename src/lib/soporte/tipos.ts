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
