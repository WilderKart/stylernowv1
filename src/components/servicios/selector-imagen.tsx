"use client";

import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const MAX_LADO = 1200;

/** Lee la imagen elegida, la reduce a 1200 px y la entrega como data URL WebP (el servidor la revalida y la guarda). */
async function prepararImagen(archivo: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) throw new Error("Usa una imagen PNG, JPG o WebP.");
  if (archivo.size > 12 * 1024 * 1024) throw new Error("La imagen es demasiado pesada (máximo 12 MB).");
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No pudimos procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  const dataUrl = lienzo.toDataURL("image/webp", 0.85);
  if (dataUrl.length > 6 * 1024 * 1024) throw new Error("La imagen sigue siendo muy pesada. Prueba con otra.");
  return dataUrl;
}

/**
 * Selector de imagen OPCIONAL para un servicio propio. `actual` es la imagen ya guardada (si hay);
 * `onCambio` recibe la nueva imagen lista para subir, o null si la quitaron antes de guardar.
 */
export function SelectorImagen({
  actual,
  nuevo,
  onCambio,
}: {
  actual?: string | null;
  nuevo: string | null;
  onCambio: (dataUrl: string | null) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const mostrada = nuevo ?? actual ?? null;

  return (
    <div>
      <p className="sn-label mb-1.5">Imagen del servicio (opcional)</p>
      <div className="flex items-center gap-3">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrada} alt="Vista previa" className="size-20 shrink-0 border-2 border-border object-cover" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center border-2 border-dashed border-border text-text-faint">
            <ImagePlus className="size-6" aria-hidden />
          </span>
        )}
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" size="sm" variant="secondary" loading={procesando} onClick={() => entrada.current?.click()}>
            {mostrada ? "Cambiar imagen" : "Subir imagen"}
          </Button>
          {nuevo ? (
            <button type="button" onClick={() => onCambio(null)} className="flex items-center gap-1 text-[11.5px] font-semibold text-text-muted underline">
              <Trash2 className="size-3" aria-hidden /> Quitar la nueva
            </button>
          ) : null}
          <p className="text-[11px] text-text-faint">PNG, JPG o WebP. Si no subes una, se verá un recuadro neutro.</p>
        </div>
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setError(null);
          setProcesando(true);
          try {
            onCambio(await prepararImagen(f));
          } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos leer la imagen.");
          } finally {
            setProcesando(false);
          }
        }}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
