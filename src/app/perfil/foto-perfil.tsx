"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Avatar } from "@/components/brutal";
import { Camera, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { comprimirImagen } from "@/lib/imagen/comprimir";
import { quitarFotoPerfil, subirFotoPerfil } from "./foto-actions";

const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024; // la persona puede elegir hasta 5 MB (regla central de subidas)

/** Avatar del perfil con subida opcional de foto (hasta 5 MB). */
export function FotoPerfil({ nombre, avatarUrl }: { nombre: string; avatarUrl: string | null }) {
  const t = useT();
  const [url, setUrl] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return setError(t("foto.formato"));
    if (archivo.size > MAX_ORIGINAL_BYTES) return setError(t("foto.pesada"));
    iniciar(async () => {
      // Avatar: WebP calidad 0.8, lado máx. 512 px (utilidad central).
      const comprimida = await comprimirImagen(archivo, "avatar");
      if (!comprimida.ok) return setError(t("foto.ilegible"));
      const datos = new FormData();
      datos.append("foto", comprimida.data);
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
            aria-label={url ? t("foto.cambiar_aria") : t("foto.subir_aria")}
          >
            <Camera aria-hidden /> {pendiente ? t("foto.subiendo") : url ? t("foto.cambiar") : t("foto.subir")}
          </button>
          {url ? (
            <button type="button" disabled={pendiente} onClick={quitar} className="sn-chip !min-h-12" aria-label={t("foto.quitar_aria")}>
              <Trash2 aria-hidden /> {t("foto.quitar")}
            </button>
          ) : null}
        </div>
      </div>
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={elegida} tabIndex={-1} aria-hidden />
      <p className="sn-help">{t("foto.ayuda")}</p>
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
