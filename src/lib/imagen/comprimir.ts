/**
 * Utilidad centralizada de compresión de imágenes en el navegador, antes de subirlas a
 * Supabase Storage. Único punto que decide formato, tamaño y validación de TODOS los
 * cargadores de imágenes de la app (avatares de cliente y staff, logo/portada/fotos de
 * negocio y fotos de servicios, fotos de resultados del CRM).
 *
 * Reglas (Fase 1 — endurecimiento de subidas):
 *  - Salida SIEMPRE WebP calidad 0.8 (si el navegador no soporta WebP, cae a JPEG 0.8).
 *  - `avatar`: lado máximo 512×512 (fotos de perfil de clientes y staff).
 *  - `media`:  ancho máximo 1280 px manteniendo la proporción (negocios, portadas, logos,
 *              fotos de servicios y de resultados).
 *  - Entrada: solo `image/jpeg`, `image/png` o `image/webp`, y como máximo 5 MB.
 *  - No cambia buckets, nombres de archivo ni políticas RLS: solo transforma los bytes.
 */

export type ModoImagen = "avatar" | "media";

export type ResultadoImagen<T> = { ok: true; data: T } | { ok: false; error: string };

const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const CALIDAD = 0.8;
const LADO_AVATAR = 512;
const ANCHO_MEDIA = 1280;

/** Valida tipo y peso del archivo elegido por la persona. Devuelve el error (o null si está bien). */
function validar(archivo: File): string | null {
  if (!MIME_PERMITIDOS.includes(archivo.type)) return "Usa una imagen JPG, PNG o WebP.";
  if (archivo.size > MAX_ORIGINAL_BYTES) return "La imagen no puede superar 5 MB.";
  return null;
}

function calcularTamano(ancho: number, alto: number, modo: ModoImagen) {
  if (modo === "avatar") {
    const escala = Math.min(1, LADO_AVATAR / Math.max(ancho, alto));
    return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
  }
  const escala = Math.min(1, ANCHO_MEDIA / ancho);
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

async function aBlobWebp(lienzo: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", CALIDAD));
  if (webp) return webp;
  // Navegador sin soporte WebP: se mantiene la calidad 0.8 en JPEG.
  return new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/jpeg", CALIDAD));
}

/** Comprime y redimensiona. Devuelve un `File` listo para subir (WebP, nombre `imagen.webp`). */
export async function comprimirImagen(archivo: File, modo: ModoImagen): Promise<ResultadoImagen<File>> {
  const error = validar(archivo);
  if (error) return { ok: false, error };

  try {
    const bitmap = await createImageBitmap(archivo);
    const { ancho, alto } = calcularTamano(bitmap.width, bitmap.height, modo);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return { ok: false, error: "No pudimos procesar la imagen." };
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    const blob = await aBlobWebp(lienzo);
    if (!blob) return { ok: false, error: "No pudimos procesar la imagen." };
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return { ok: true, data: new File([blob], `imagen.${ext}`, { type: blob.type }) };
  } catch {
    return { ok: false, error: "No pudimos leer la imagen." };
  }
}

/** Igual que `comprimirImagen` pero devuelve un data URL (para Server Actions que envían base64). */
export async function comprimirADataUrl(archivo: File, modo: ModoImagen): Promise<ResultadoImagen<string>> {
  const r = await comprimirImagen(archivo, modo);
  if (!r.ok) return r;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = () => reject(new Error("lectura"));
      lector.readAsDataURL(r.data);
    });
    return { ok: true, data: dataUrl };
  } catch {
    return { ok: false, error: "No pudimos leer la imagen." };
  }
}
