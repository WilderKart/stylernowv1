"use client";

import { Meta } from "@/components/brutal";
import type { ResenaProfesional } from "@/lib/cliente/profesionales";
import { useState, useTransition } from "react";
import { masResenasAction } from "./actions";
import { TAM_PAGINA_RESENAS } from "./constantes";

function cuando(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "HOY";
  if (dias === 1) return "AYER";
  if (dias < 7) return `HACE ${dias} DÍAS`;
  if (dias < 30) {
    const s = Math.floor(dias / 7);
    return `HACE ${s} ${s === 1 ? "SEMANA" : "SEMANAS"}`;
  }
  const m = Math.floor(dias / 30);
  return m < 12 ? `HACE ${m} ${m === 1 ? "MES" : "MESES"}` : "HACE MÁS DE 1 AÑO";
}

/** Reseñas del profesional con paginación «Ver más» (server action). */
export function ResenasLista({
  slug,
  staffId,
  iniciales,
  total,
}: {
  slug: string;
  staffId: string;
  iniciales: ResenaProfesional[];
  total: number;
}) {
  const [lista, setLista] = useState(iniciales);
  const [fin, setFin] = useState(iniciales.length < TAM_PAGINA_RESENAS || iniciales.length >= total);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function verMas() {
    setError(null);
    empezar(async () => {
      const r = await masResenasAction(slug, staffId, lista.length);
      if (!r.ok) return setError(r.error);
      setLista((l) => [...l, ...r.resenas]);
      if (r.resenas.length < TAM_PAGINA_RESENAS) setFin(true);
    });
  }

  if (lista.length === 0) {
    return (
      <div className="mx-4 mb-4 border-2 border-dashed border-line p-6 text-center">
        <Meta>Aún no tiene reseñas.</Meta>
      </div>
    );
  }

  return (
    <div>
      {lista.map((r) => (
        <article key={r.id} className="border-t border-grid-soft px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="sn-label text-signal">★ {r.calificacion}</span>
            <Meta>{cuando(r.created_at)}</Meta>
          </div>
          {r.comentario ? <p className="body-sm m-0 mt-1 break-words">{r.comentario}</p> : null}
          <Meta className="mt-1 block break-words">
            {r.cliente_nombre}
            {r.servicios ? ` · ${r.servicios}` : ""}
          </Meta>
          {r.respuesta_negocio ? (
            <p className="body-sm m-0 mt-2 border-l-2 border-line pl-3 break-words">
              <b>Respuesta del negocio: </b>
              {r.respuesta_negocio}
            </p>
          ) : null}
        </article>
      ))}
      {error ? (
        <p role="alert" className="sn-meta !text-danger px-4 py-2">
          {error}
        </p>
      ) : null}
      {!fin ? (
        <div className="px-4 pb-4">
          <button type="button" onClick={verMas} disabled={pendiente} className="sn-btn sn-btn--secondary w-full">
            {pendiente ? "Cargando..." : "Ver más reseñas"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
