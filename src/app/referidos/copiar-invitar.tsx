"use client";

import { useState } from "react";

/** Copiar el código y compartir la invitación. Solo usa el código (que ya llegó del servidor). */
export function CopiarInvitar({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setAviso(null);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAviso("No pudimos copiar. Selecciona el código y cópialo a mano.");
    }
  }

  async function compartir() {
    const texto = `Usa mi código ${codigo} en StylerNow y los dos ganamos saldo cuando completes tu primera cita.`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "StylerNow", text: texto, url });
      } else {
        await navigator.clipboard.writeText(`${texto} ${url}`);
        setAviso("Invitación copiada. Pégala en tu chat.");
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
          <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <button type="button" onClick={compartir} className="sn-btn sn-btn--primary sn-btn--block">
        <span>Compartir invitación</span>
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
