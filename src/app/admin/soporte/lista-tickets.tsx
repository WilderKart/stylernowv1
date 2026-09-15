"use client";

import { Badge } from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";
import { listarTicketsAdmin, type TicketAdmin } from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "accent"> = {
  ABIERTO: "accent",
  EN_PROCESO: "accent",
  RESUELTO: "success",
};

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "ABIERTO", etiqueta: "Abiertos" },
  { valor: "EN_PROCESO", etiqueta: "En proceso" },
  { valor: "RESUELTO", etiqueta: "Resueltos" },
] as const;

export function ListaTickets({ ticketsIniciales, errorInicial }: { ticketsIniciales: TicketAdmin[]; errorInicial: string | null }) {
  const [tickets, setTickets] = useState(ticketsIniciales);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);

  async function onFiltrar(valor: string) {
    setFiltro(valor);
    setCargando(true);
    setError(null);
    const res = await listarTicketsAdmin(valor || undefined);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setTickets(res.data);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => onFiltrar(f.valor)}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
              filtro === f.valor ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No hay tickets en ese estado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/soporte/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 hover:border-accent/40"
              >
                <div>
                  <p className="text-[13.5px] font-semibold text-text">{t.asunto}</p>
                  <p className="text-[11px] text-text-faint">
                    {t.negocioNombre ?? "Sin negocio"} · {new Date(t.updatedAt).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <Badge tone={ESTADO_TONO[t.estado] ?? "accent"}>{t.estado.replace("_", " ")}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
