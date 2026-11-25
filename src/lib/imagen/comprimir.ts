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

const MAX_COMPROBANTE_BYTES = 300 * 1024;

/**
 * Comprobante de pago: WebP/JPEG que pesa menos de 300 KB (baja el ancho y la calidad por pasos hasta lograrlo).
 * Se sube directo a Storage desde el navegador, sin pasar por una Server Action (evita el límite de 1 MB).
 */
export async function comprimirComprobante(archivo: File): Promise<ResultadoImagen<File>> {
  const error = validar(archivo);
  if (error) return { ok: false, error };
  try {
    const bitmap = await createImageBitmap(archivo);
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d");
    if (!ctx) return { ok: false, error: "No pudimos procesar la imagen." };
    for (const [ancho, calidad] of [[1100, 0.8], [900, 0.7], [760, 0.6], [640, 0.5], [520, 0.45]] as const) {
      const escala = Math.min(1, ancho / bitmap.width);
      lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
      lienzo.height = Math.max(1, Math.round(bitmap.height * escala));
      ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
      let blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", calidad));
      if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/jpeg", calidad));
      if (blob && blob.size <= MAX_COMPROBANTE_BYTES) {
        bitmap.close?.();
        return { ok: true, data: new File([blob], `comprobante.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }) };
      }
    }
    bitmap.close?.();
    return { ok: false, error: "No pudimos reducir la imagen lo suficiente. Prueba con otra captura." };
  } catch {
    return { ok: false, error: "No pudimos leer la imagen." };
  }
}

/** SHA-256 en hexadecimal (64 caracteres) de los bytes del archivo. */
export async function sha256Hex(archivo: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
