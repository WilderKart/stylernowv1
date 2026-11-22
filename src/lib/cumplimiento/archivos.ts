import { createHash, randomUUID } from "node:crypto";

/**
 * Validación de adjuntos de una solicitud pública. El navegador NO es de fiar: el tipo se decide por la FIRMA BINARIA del contenido
 * (no por la extensión ni por el Content-Type que declara el cliente). Solo PDF, PNG y JPEG; 5 MB; PDF sin contenido activo.
 * Límite honesto: no hay antivirus. Estas reglas reducen la superficie (sin ejecutables, scripts, SVG ni HTML) pero no
 * sustituyen un escáner de malware; los archivos nunca se sirven públicamente (bucket privado, enlace firmado de 60 s solo para el SuperAdmin,
 * siempre como descarga).
 */
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ARCHIVOS = 3;

export type ArchivoValido = { buffer: Buffer; mime: "application/pdf" | "image/png" | "image/jpeg"; ext: "pdf" | "png" | "jpg"; sha256: string; nombre: string };

const PDF_ACTIVO = /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/;

export function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\.{2,}/g, ".").trim();
  return (base || "archivo").slice(0, 100);
}

export function validarArchivo(nombre: string, bytes: Uint8Array): { ok: true; archivo: ArchivoValido } | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, error: "Cada archivo debe pesar máximo 5 MB." };
  const b = Buffer.from(bytes);
  let mime: ArchivoValido["mime"]; let ext: ArchivoValido["ext"];
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") {
    mime = "application/pdf"; ext = "pdf";
    if (PDF_ACTIVO.test(b.toString("latin1"))) return { ok: false, error: "El PDF contiene elementos activos y no se admite. Envíalo como imagen o PDF simple." };
  } else if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    mime = "image/png"; ext = "png";
  } else if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    mime = "image/jpeg"; ext = "jpg";
  } else return { ok: false, error: "Solo se admiten archivos PDF, PNG o JPG." };
  return { ok: true, archivo: { buffer: b, mime, ext, sha256: createHash("sha256").update(b).digest("hex"), nombre: nombreSeguro(nombre) } };
}

/** Ruta en el bucket: `<ticket>/<uuid>.<ext>`. Nada del nombre del usuario entra en la ruta. */
export function rutaAdjunto(ticketId: string, ext: string): string {
  return `${ticketId}/${randomUUID()}.${ext}`;
}
