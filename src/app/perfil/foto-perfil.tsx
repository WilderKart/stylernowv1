"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Avatar } from "@/components/brutal";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { quitarFotoPerfil, subirFotoPerfil } from "./foto-actions";

const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024; // lo que la persona puede elegir: hasta 10 MB
const LADO_MAXIMO = 1024; // se reduce antes de enviar (ligero y rápido)

/** Reduce la foto en el navegador: lado máx. 1024 px, WebP ~0,85. Devuelve null si el navegador no puede leerla. */
async function reducir(archivo: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();
    for (const calidad of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", calidad));
      if (blob && blob.size <= 1_800_000) return blob;
    }
    return null;
  } catch {
    return null;
  }
}

/** Avatar del perfil con subida opcional de foto (hasta 10 MB). */
export function FotoPerfil({ nombre, avatarUrl }: { nombre: string; avatarUrl: string | null }) {
  const [url, setUrl] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    if (archivo.size > MAX_ORIGINAL_BYTES) return setError("La foto pesa más de 10 MB. Elige una más liviana.");
    iniciar(async () => {
      const reducida = await reducir(archivo);
      if (!reducida) return setError("No pudimos leer esa imagen. Prueba con otra.");
      const datos = new FormData();
      datos.append("foto", new File([reducida], "foto.webp", { type: "image/webp" }));
      const r = await subirFotoPerfil(datos);
      if (r.ok) setUrl(r.data.url);
      else setError(r.error);
    });
  }

  function quitar() {
    setError(null);
    iniciar(async () => {
      const r = await quitarFotoPerfil();
      if (r.ok) setUrl(null);
      else setError(r.error);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-4">
        <Avatar name={nombre} src={url} size="lg" />
        <div className="flex min-w-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => entrada.current?.click()}
            className="sn-chip !min-h-12"
            aria-label={url ? "Cambiar foto de perfil" : "Subir foto de perfil"}
          >
            <Camera aria-hidden /> {pendiente ? "Subiendo…" : url ? "Cambiar foto" : "Subir foto"}
          </button>
          {url ? (
            <button type="button" disabled={pendiente} onClick={quitar} className="sn-chip !min-h-12" aria-label="Quitar foto de perfil">
              <Trash2 aria-hidden /> Quitar
            </button>
          ) : null}
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={elegida} tabIndex={-1} aria-hidden />
      <p className="sn-help">Opcional · JPG, PNG o WebP · hasta 10 MB</p>
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
