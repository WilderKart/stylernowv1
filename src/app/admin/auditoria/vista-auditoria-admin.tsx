"use client";

import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { listarAuditoriaAdmin, type EventoAuditoriaAdmin } from "./actions";

const ACTORES = [
  { valor: "", etiqueta: "Todos" },
  { valor: "SUPERSU", etiqueta: "SuperSU" },
  { valor: "BARBERIA", etiqueta: "Barbería" },
  { valor: "GUARDIAN", etiqueta: "Guardian" },
  { valor: "STAFF", etiqueta: "Staff" },
  { valor: "CLIENTE", etiqueta: "Cliente" },
  { valor: "SISTEMA", etiqueta: "Sistema" },
] as const;

export function VistaAuditoriaAdmin({ eventosIniciales, errorInicial }: { eventosIniciales: EventoAuditoriaAdmin[]; errorInicial: string | null }) {
  const [eventos, setEventos] = useState(eventosIniciales);
  const [actorTipo, setActorTipo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);

  async function onFiltrar(valor: string) {
    setActorTipo(valor);
    setCargando(true);
    setError(null);
    const res = await listarAuditoriaAdmin({ actorTipo: valor || undefined });
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setEventos(res.data);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ACTORES.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => onFiltrar(a.valor)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
              actorTipo === a.valor ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay eventos en esa categoría.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventos.map((e) => (
            <li key={e.id} className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-text">{e.accion.replaceAll("_", " ")}</p>
                <Badge tone="neutral">{e.entidadTipo}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-text-faint">
                {e.actorTipo}
                {e.negocioNombre ? ` · ${e.negocioNombre}` : ""} · {new Date(e.createdAt).toLocaleString("es-CO")}
                {e.motivo ? ` · ${e.motivo}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
