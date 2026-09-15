"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { aceptarPendientes } from "./actions";

export function VistaAceptarLegal({
  next,
  textos,
}: {
  next: string;
  textos: { id: string; tipo: string; version: number; contenido: string; titulo: string }[];
}) {
  const router = useRouter();
  const [aceptando, setAceptando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const todosMarcados = textos.every((t) => marcados.has(t.id));

  function toggle(id: string) {
    setMarcados((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  async function confirmar() {
    setAceptando(true);
    setError(null);
    const res = await aceptarPendientes();
    setAceptando(false);
    if (!res.ok) return setError(res.error ?? "Error inesperado.");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {textos.map((t) => (
        <div key={t.id} className="rounded-2xl border border-border-subtle bg-surface p-4">
          <p className="mb-2 text-[13px] font-bold text-text">
            {t.titulo} <span className="text-text-faint">· versión {t.version}</span>
          </p>
          <div className="mb-3 max-h-52 overflow-y-auto rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-text-muted">
            {t.contenido.split("\n\n").filter(Boolean).map((p, i) => (
              <p key={i} className="mb-2">
                {p}
              </p>
            ))}
          </div>
          <label className="flex items-start gap-2.5 text-[12.5px] text-text-muted">
            <input type="checkbox" checked={marcados.has(t.id)} onChange={() => toggle(t.id)} className="mt-0.5 size-4 shrink-0 accent-accent" />
            Leí y acepto {t.titulo.toLowerCase()}.
          </label>
        </div>
      ))}

      {error ? <p className="text-[12.5px] font-semibold text-danger">{error}</p> : null}

      <Button size="lg" disabled={!todosMarcados} loading={aceptando} onClick={confirmar}>
        Aceptar y continuar
      </Button>
    </div>
  );
}
