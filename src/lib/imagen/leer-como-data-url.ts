/**
 * Prepara una imagen elegida por el usuario para enviarla a una Server Action.
 *
 * Las Server Actions de Next aceptan como máximo 1 MB por petición (límite por defecto). Antes se enviaba la
 * foto original en base64 y cualquier imagen de más de ~700 KB fallaba en silencio: por eso "el logo nunca
 * se subía" (auditoría 2026-11-14). Aquí se reduce en el navegador a un lado máximo de `maxLado` px y se
 * re-codifica como WebP (o JPEG si el navegador no soporta WebP) hasta quedar por debajo de ~900 KB.
 */
const LIMITE_BYTES = 900 * 1024;

export async function leerComoDataUrl(
  archivo: File,
  maxMb: number,
  maxLado = 1200,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
    return { ok: false, error: "Usa una imagen PNG, JPG o WebP." };
  }
  if (archivo.size > maxMb * 1024 * 1024) return { ok: false, error: `La imagen no puede superar ${maxMb} MB.` };

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return { ok: false, error: "No pudimos procesar la imagen." };
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    for (const calidad of [0.85, 0.72, 0.6, 0.45]) {
      let dataUrl = lienzo.toDataURL("image/webp", calidad);
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = lienzo.toDataURL("image/jpeg", calidad);
      // Tamaño aproximado en bytes del contenido base64.
      if ((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75 <= LIMITE_BYTES) return { ok: true, dataUrl };
    }
    return { ok: false, error: "La imagen es demasiado pesada incluso comprimida. Prueba con otra." };
  } catch {
    return { ok: false, error: "No pudimos leer la imagen." };
  }
}
