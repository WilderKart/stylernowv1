"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";

/** Copiar el código y compartir la invitación. Solo usa el código (que ya llegó del servidor). */
export function CopiarInvitar({ codigo }: { codigo: string }) {
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setAviso(null);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAviso(t("ref.err_copiar"));
    }
  }

  async function compartir() {
    const texto = t("ref.texto_invitar", { codigo });
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "StylerNow", text: texto, url });
      } else {
        await navigator.clipboard.writeText(`${texto} ${url}`);
        setAviso(t("ref.copiada"));
      }
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-stretch gap-2">
        <div className="poster-4 flex min-h-12 min-w-0 flex-1 basis-40 items-center break-all border-2 border-line px-3 py-2">{codigo}</div>
        <button
          type="button"
          onClick={copiar}
          className={`sn-btn ${copiado ? "sn-btn--primary" : "sn-btn--secondary"}`}
          style={copiado ? { background: "var(--success)" } : undefined}
        >
          <span aria-live="polite">{copiado ? t("ref.copiado") : t("ref.copiar")}</span>
        </button>
      </div>
      <button type="button" onClick={compartir} className="sn-btn sn-btn--primary sn-btn--block">
        <span>{t("ref.compartir")}</span>
        <span aria-hidden>↗</span>
      </button>
      {aviso ? (
        <p role="status" className="sn-meta break-words">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
