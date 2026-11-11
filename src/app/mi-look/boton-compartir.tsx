"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { useState, useTransition } from "react";
import { compartirFotos } from "./actions";

export function BotonCompartir({ fotoIds, compartida }: { fotoIds: string[]; compartida: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function alternar() {
    setError(null);
    iniciar(async () => {
      const r = await compartirFotos(fotoIds, !compartida);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={alternar}
        disabled={pendiente}
        aria-pressed={compartida}
        className={`sn-btn ${compartida ? "sn-btn--ink" : "sn-btn--secondary"}`}
      >
        <span className="sn-btn__txt">{compartida ? "Compartida" : "Compartir"}</span>
        <span aria-hidden>{compartida ? "✓" : "↗"}</span>
      </button>
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
