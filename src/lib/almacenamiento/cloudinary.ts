import "server-only";

import { createHash } from "node:crypto";

/**
 * ADAPTADOR CLOUDINARY (2026-11-16, decisión B). Solo servidor: la clave secreta nunca sale de aquí.
 *
 * - Se activa únicamente si existen el nombre de la nube (CLOUDINARY_CLOUD_NAME o, si falta, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME),
 *   CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.
 *   Sin ellas, quien lo use debe seguir con Supabase Storage (comportamiento actual, sin cambios).
 * - Subida FIRMADA desde el servidor (nunca un preset sin firma en el navegador).
 * - `tipo: "authenticated"` para archivos privados: solo se ven con URL firmada (`urlFirmada`).
 *   Ojo: la firma de entrega NO caduca; para enlaces con vencimiento Cloudinary exige «token-based
 *   access» (plan de pago). Ver docs/evidencias/CLOUDINARY.md.
 * - No migra ni borra nada existente: eso requiere el procedimiento documentado y aprobación.
 */

export interface ConfigCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Nombre de la nube: acepta CLOUDINARY_CLOUD_NAME o NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (la que exista y no esté vacía). */
export function nombreDeLaNube(): string | undefined {
  return (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)?.trim() || undefined;
}

export function configCloudinary(): ConfigCloudinary | null {
  const cloudName = nombreDeLaNube();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/**
 * Firma de la API de subida: parámetros (sin file, api_key, resource_type, cloud_name) ordenados
 * alfabéticamente como `clave=valor` unidos por `&`, seguidos de la clave secreta, en SHA-1.
 */
export function firmarParametros(params: Record<string, string | number>, apiSecret: string): string {
  const cadena = Object.keys(params)
    .filter((k) => !["file", "api_key", "resource_type", "cloud_name"].includes(k) && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(cadena + apiSecret).digest("hex");
}

/**
 * Componente de firma de una URL de entrega (`s--XXXXXXXX--`): los primeros 8 caracteres del
 * SHA-1 en base64 URL-safe de «<ruta tras el tipo de entrega> + clave secreta».
 */
export function firmaDeEntrega(ruta: string, apiSecret: string): string {
  const digest = createHash("sha1")
    .update(ruta + apiSecret)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `s--${digest.slice(0, 8)}--`;
}

export interface ArchivoSubido {
  publicId: string;
  version: number;
  formato: string;
  tipo: "upload" | "authenticated";
  /** URL de entrega; en `authenticated` ya va firmada. */
  url: string;
  bytes: number;
}

const MIME_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Sube una imagen validada (jpeg/png/webp, máx. `maxBytes`) con firma del servidor. */
export async function subirImagenCloudinary(opciones: {
  bytes: Buffer;
  mime: string;
  carpeta: string;
  publicId: string;
  tipo?: "upload" | "authenticated";
  maxBytes?: number;
  config?: ConfigCloudinary;
}): Promise<ArchivoSubido> {
  const cfg = opciones.config ?? configCloudinary();
  if (!cfg) throw new Error("CLOUDINARY_NO_CONFIGURADO");
  if (!MIME_IMAGEN.has(opciones.mime)) throw new Error("TIPO_NO_PERMITIDO");
  if (opciones.bytes.byteLength > (opciones.maxBytes ?? 5 * 1024 * 1024)) throw new Error("ARCHIVO_DEMASIADO_GRANDE");

  const tipo = opciones.tipo ?? "upload";
  const params: Record<string, string | number> = {
    folder: opciones.carpeta,
    public_id: opciones.publicId,
    overwrite: "true",
    invalidate: "true",
    type: tipo,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const cuerpo = new FormData();
  for (const [k, v] of Object.entries(params)) cuerpo.append(k, String(v));
  cuerpo.append("api_key", cfg.apiKey);
  cuerpo.append("signature", firmarParametros(params, cfg.apiSecret));
  cuerpo.append("file", `data:${opciones.mime};base64,${opciones.bytes.toString("base64")}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`, {
    method: "POST",
    body: cuerpo,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as {
    public_id?: string;
    version?: number;
    format?: string;
    secure_url?: string;
    bytes?: number;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json?.public_id || !json.version || !json.format) {
    // El mensaje de Cloudinary no incluye la clave; aun así no se reenvía al navegador.
    throw new Error("CLOUDINARY_SUBIDA_FALLIDA");
  }
  return {
    publicId: json.public_id,
    version: json.version,
    formato: json.format,
    tipo,
    bytes: json.bytes ?? opciones.bytes.byteLength,
    url:
      tipo === "authenticated"
        ? urlFirmada(json.public_id, { version: json.version, formato: json.format, config: cfg })
        : (json.secure_url ?? ""),
  };
}

/** URL firmada de un archivo privado (`authenticated`). Opcionalmente con transformación (p. ej. `c_fill,w_400`). */
export function urlFirmada(
  publicId: string,
  opciones: { version: number; formato: string; transformacion?: string; config?: ConfigCloudinary }
): string {
  const cfg = opciones.config ?? configCloudinary();
  if (!cfg) throw new Error("CLOUDINARY_NO_CONFIGURADO");
  const ruta = `${opciones.transformacion ? `${opciones.transformacion}/` : ""}v${opciones.version}/${publicId}.${opciones.formato}`;
  return `https://res.cloudinary.com/${cfg.cloudName}/image/authenticated/${firmaDeEntrega(ruta, cfg.apiSecret)}/${ruta}`;
}

// ── Documentos privados (verificación del negocio) ───────────────────────────────────────

const MIME_DOCUMENTO = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Tipo real del archivo según sus primeros bytes. No se confía en el tipo que declara el navegador:
 * un ejecutable renombrado a .pdf no pasa. Devuelve null si no es PDF, JPEG, PNG ni WebP.
 */
export function tipoRealDeArchivo(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const arranca = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  if (bytes.length >= 5 && arranca(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (bytes.length >= 3 && arranca(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bytes.length >= 8 && arranca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (bytes.length >= 12 && arranca(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

/**
 * Sube un documento PRIVADO (`authenticated`): sin URL pública. Solo el servidor puede generar una URL firmada y
 * nunca se entrega al navegador; se lee a través de una ruta que autoriza cada lectura (ver /api/verificacion).
 */
export async function subirDocumentoPrivado(opciones: {
  bytes: Buffer;
  mime: string;
  carpeta: string;
  publicId: string;
  maxBytes?: number;
  config?: ConfigCloudinary;
}): Promise<{ publicId: string; version: number; formato: string; bytes: number }> {
  const cfg = opciones.config ?? configCloudinary();
  if (!cfg) throw new Error("CLOUDINARY_NO_CONFIGURADO");
  if (!MIME_DOCUMENTO.has(opciones.mime)) throw new Error("TIPO_NO_PERMITIDO");
  if (opciones.bytes.byteLength > (opciones.maxBytes ?? 8 * 1024 * 1024)) throw new Error("ARCHIVO_DEMASIADO_GRANDE");

  const params: Record<string, string | number> = {
    folder: opciones.carpeta,
    public_id: opciones.publicId,
    overwrite: "false",
    type: "authenticated",
    timestamp: Math.floor(Date.now() / 1000),
  };
  const cuerpo = new FormData();
  for (const [k, v] of Object.entries(params)) cuerpo.append(k, String(v));
  cuerpo.append("api_key", cfg.apiKey);
  cuerpo.append("signature", firmarParametros(params, cfg.apiSecret));
  cuerpo.append("file", `data:${opciones.mime};base64,${opciones.bytes.toString("base64")}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`, {
    method: "POST",
    body: cuerpo,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { public_id?: string; version?: number; format?: string; bytes?: number } | null;
  if (!res.ok || !json?.public_id || !json.version || !json.format) throw new Error("CLOUDINARY_SUBIDA_FALLIDA");
  return { publicId: json.public_id, version: json.version, formato: json.format, bytes: json.bytes ?? opciones.bytes.byteLength };
}

/**
 * Descarga un documento privado desde el servidor. Se usa la API de descarga privada de Cloudinary (firmada con el
 * secreto, solo servidor): a diferencia de la URL de entrega, no queda bloqueada por la restricción de Cloudinary a
 * servir PDF/ZIP públicamente, que era la causa de «no disponible» al abrir certificados en PDF.
 * Si esa vía falla, se intenta la URL firmada de entrega (imágenes). Ninguna URL sale del servidor.
 */
export async function leerDocumentoPrivado(
  publicId: string,
  version: number,
  formato: string,
  config?: ConfigCloudinary,
): Promise<{ cuerpo: ReadableStream<Uint8Array>; tipo: string; longitud: string | null }> {
  const cfg = config ?? configCloudinary();
  if (!cfg) throw new Error("CLOUDINARY_NO_CONFIGURADO");

  const params: Record<string, string | number> = {
    public_id: publicId,
    format: formato,
    type: "authenticated",
    timestamp: Math.floor(Date.now() / 1000),
  };
  const consulta = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  consulta.set("api_key", cfg.apiKey);
  consulta.set("signature", firmarParametros(params, cfg.apiSecret));
  let res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/download?${consulta}`, { cache: "no-store" });
  if (!res.ok || !res.body) {
    res = await fetch(urlFirmada(publicId, { version, formato, config: cfg }), { cache: "no-store" });
  }
  if (!res.ok || !res.body) throw new Error("DOCUMENTO_NO_DISPONIBLE");
  const tipoFormato: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const declarado = res.headers.get("content-type");
  return {
    cuerpo: res.body,
    tipo: tipoFormato[formato.toLowerCase()] ?? declarado ?? "application/octet-stream",
    longitud: res.headers.get("content-length"),
  };
}
