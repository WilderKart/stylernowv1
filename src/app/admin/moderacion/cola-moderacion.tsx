"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { moderarResena, type ResenaModeracion } from "../actions";

export function ColaModeracion({ resenasIniciales, errorInicial }: { resenasIniciales: ResenaModeracion[]; errorInicial: string | null }) {
  const [resenas, setResenas] = useState(resenasIniciales);
  const [error, setError] = useState(errorInicial);
  const [accionando, setAccionando] = useState<string | null>(null);

  async function onModerar(resenaId: string, accion: "MANTENER" | "ELIMINAR") {
    setAccionando(resenaId);
    setError(null);
    const motivo = prompt(`Motivo de la decisión (${accion === "ELIMINAR" ? "eliminar" : "mantener"}):`) ?? undefined;
    const res = await moderarResena(resenaId, accion, motivo);
    setAccionando(null);
    if (!res.ok) return setError(res.error);
    setResenas((prev) => prev.filter((r) => r.id !== resenaId));
  }

  if (error) {
    return <p className="text-[12.5px] font-semibold text-danger">{error}</p>;
  }

  if (resenas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
        No hay reseñas reportadas pendientes de moderar.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {resenas.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-text">
              {r.clienteNombre} → {r.negocioNombre}
            </p>
            <Badge tone="accent">{"★".repeat(r.calificacion)}</Badge>
          </div>
          {r.comentario ? <p className="mt-1.5 text-[12.5px] text-text-muted">{r.comentario}</p> : null}
          <p className="mt-1 text-[11px] text-text-faint">{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" loading={accionando === r.id} onClick={() => onModerar(r.id, "MANTENER")}>
              Mantener
            </Button>
            <Button size="sm" variant="danger" loading={accionando === r.id} onClick={() => onModerar(r.id, "ELIMINAR")}>
              Eliminar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
