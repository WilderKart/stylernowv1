"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

/**
 * Enlace público de reservas del negocio (puente de 4.1 / 5.4): se pega como "enlace de reservas" en Google
 * Business Profile, Instagram y Facebook. Sin comisión por cliente nuevo. El slug ya es público.
 */
export function EnlaceReserva({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(false);
  const ruta = `/negocio/${slug}/reservar`;

  async function copiar() {
    setError(false);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${ruta}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError(true);
    }
  }

  return (
    <Card className="mb-3">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Tu enlace de reservas</p>
      <p className="mt-1 break-all text-[13px] text-text">{ruta}</p>
      <p className="mt-1 text-[12px] text-text-faint">
        Pégalo como botón de reservas en Google Business Profile, Instagram y Facebook. Sin comisión por cliente nuevo.
      </p>
      <button
        type="button"
        onClick={copiar}
        className="mt-3 h-11 w-full border-2 border-border bg-accent text-[13px] font-bold uppercase text-ink"
      >
        {copiado ? "¡Enlace copiado!" : "Copiar enlace"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-danger">No pudimos copiarlo; selecciona el texto y cópialo a mano.</p> : null}
    </Card>
  );
}
