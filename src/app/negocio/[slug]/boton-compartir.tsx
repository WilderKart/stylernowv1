"use client";

import { useState } from "react";

/**
 * "Compartir" (02-UX/04_Marketplace.md): un link público al mismo `slug`
 * indexado por SEO — no necesita backend, el link ya existe y es público.
 * Web Share API cuando el navegador la soporta (móvil), copiar al
 * portapapeles como respaldo universal.
 */
export function BotonCompartir({ nombre, slug }: { nombre: string; slug: string }) {
  const [copiado, setCopiado] = useState(false);

  async function onClick() {
    const url = `${window.location.origin}/negocio/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, url });
      } catch {
        /* el usuario canceló el diálogo nativo — no es un error */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* portapapeles no disponible (contexto no seguro, permiso denegado) */
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Compartir"
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-text-muted"
    >
      {copiado ? (
        <span className="text-[9.5px] font-bold uppercase text-success">Copiado</span>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" />
        </svg>
      )}
    </button>
  );
}
