import { LIMITE_IMAGEN_BYTES } from "./tipos";

/**
 * Reduce una imagen en el navegador a menos de 500 KB (WebP, lado máximo 1600 px) antes de subirla directo a Storage.
 * Se baja primero la calidad y, si hace falta, el tamaño. Devuelve null si el navegador no puede procesarla.
 */
export async function comprimirImagen(archivo: File): Promise<{ blob: Blob; extension: "webp" | "jpg" } | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    let escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    for (let intento = 0; intento < 6; intento++) {
      const ancho = Math.max(1, Math.round(bitmap.width * escala));
      const alto = Math.max(1, Math.round(bitmap.height * escala));
      const lienzo = document.createElement("canvas");
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, ancho, alto);
      for (const calidad of [0.85, 0.7, 0.55, 0.4]) {
        const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/webp", calidad));
        if (blob && blob.size <= LIMITE_IMAGEN_BYTES) {
          bitmap.close();
          return { blob, extension: blob.type === "image/webp" ? "webp" : "jpg" };
        }
      }
      escala *= 0.75;
    }
    bitmap.close();
    return null;
  } catch {
    return null;
  }
}
