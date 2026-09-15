"use client";

import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { listarAuditoriaNegocio, type EventoAuditoria } from "./actions";

const ENTIDADES = [
  { valor: "", etiqueta: "Todas" },
  { valor: "reserva", etiqueta: "Reservas" },
  { valor: "pago", etiqueta: "Pagos" },
  { valor: "resena", etiqueta: "Reseñas" },
  { valor: "vinculo_staff_negocio", etiqueta: "Staff" },
  { valor: "sede", etiqueta: "Sedes" },
] as const;

export function VistaAuditoria({ eventosIniciales, errorInicial }: { eventosIniciales: EventoAuditoria[]; errorInicial: string | null }) {
  const [eventos, setEventos] = useState(eventosIniciales);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);

  async function onFiltrar(valor: string) {
    setFiltro(valor);
    setCargando(true);
    setError(null);
    const res = await listarAuditoriaNegocio(valor || undefined);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setEventos(res.data);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-1 text-[22px] font-bold uppercase text-text">Auditoría</h1>
      <p className="mb-5 text-[12px] text-text-faint">
        Historial completo e inmutable de lo que pasó en tu negocio — últimos 200 eventos.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {ENTIDADES.map((e) => (
          <button
            key={e.valor}
            type="button"
            onClick={() => onFiltrar(e.valor)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
              filtro === e.valor ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay eventos de auditoría en esa categoría todavía.
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
                {e.actorTipo} · {new Date(e.createdAt).toLocaleString("es-CO")}
                {e.motivo ? ` · ${e.motivo}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
