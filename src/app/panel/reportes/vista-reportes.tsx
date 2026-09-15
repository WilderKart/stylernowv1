"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import {
  obtenerIngresosPeriodo,
  obtenerRankingStaffPeriodo,
  reportarResena,
  responderResena,
  type PuntoIngreso,
  type RankingStaffReporte,
  type ResenaRecibida,
  type ServicioTop,
} from "./actions";

export function VistaReportes({
  negocioId,
  sedeIdFijo,
  sedes,
  ingresosIniciales,
  serviciosIniciales,
  rankingInicial,
  resenasIniciales,
}: {
  negocioId: string;
  sedeIdFijo: string | null;
  sedes: { id: string; nombre: string }[] | null;
  ingresosIniciales: PuntoIngreso[];
  serviciosIniciales: ServicioTop[];
  rankingInicial: RankingStaffReporte[];
  resenasIniciales: ResenaRecibida[];
}) {
  const [sedeId, setSedeId] = useState<string>(sedeIdFijo ?? "");
  const [agrupacion, setAgrupacion] = useState<"semana" | "mes">("semana");
  const [ingresos, setIngresos] = useState(ingresosIniciales);
  const [ranking, setRanking] = useState(rankingInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCambiarFiltro(nuevaSede: string, nuevaAgrupacion: "semana" | "mes") {
    setSedeId(nuevaSede);
    setAgrupacion(nuevaAgrupacion);
    setCargando(true);
    setError(null);
    const [resIngresos, resRanking] = await Promise.all([
      obtenerIngresosPeriodo({ negocioId, sedeId: nuevaSede || undefined, agrupacion: nuevaAgrupacion }),
      obtenerRankingStaffPeriodo({ negocioId, sedeId: nuevaSede || undefined }),
    ]);
    setCargando(false);
    if (!resIngresos.ok) return setError(resIngresos.error);
    setIngresos(resIngresos.data);
    if (resRanking.ok) setRanking(resRanking.data);
  }

  const maxIngreso = Math.max(1, ...ingresos.map((p) => p.ingresos));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold uppercase text-text">Reportes</h1>
        <div className="flex gap-2">
          {sedes && sedes.length > 1 ? (
            <select
              value={sedeId}
              onChange={(e) => onCambiarFiltro(e.target.value, agrupacion)}
              className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none"
            >
              <option value="">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-1 rounded-full border border-border p-1">
            <button
              type="button"
              onClick={() => onCambiarFiltro(sedeId, "semana")}
              className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${agrupacion === "semana" ? "bg-accent text-bg" : "text-text-muted"}`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => onCambiarFiltro(sedeId, "mes")}
              className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${agrupacion === "mes" ? "bg-accent text-bg" : "text-text-muted"}`}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      <section className="mb-8">
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Ingresos por {agrupacion}</h2>
        {cargando ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
        ) : ingresos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Todavía no hay Reservas completadas en este periodo.
          </p>
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-4" style={{ height: 180 }}>
            {ingresos.map((p) => (
              <div key={p.periodo} className="flex min-w-[36px] flex-1 flex-col items-center gap-1" title={`${formatCOP(p.ingresos)} · ${p.citasCompletadas} citas`}>
                <div
                  className="w-full rounded-t-md bg-accent"
                  style={{ height: `${Math.max(4, (p.ingresos / maxIngreso) * 120)}px` }}
                />
                <p className="text-[9px] text-text-faint">{new Date(`${p.periodo}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11.5px] text-text-faint">
          Total del periodo: {formatCOP(ingresos.reduce((a, p) => a + p.ingresos, 0))}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Servicios más vendidos</h2>
        {serviciosIniciales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Todavía no hay Servicios completados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {serviciosIniciales.map((s, i) => (
              <li key={s.servicioId} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-muted">{i + 1}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-text">{s.nombre}</p>
                    <p className="text-[11px] text-text-faint">{s.vecesVendido} veces</p>
                  </div>
                </div>
                <p className="text-[12.5px] font-bold text-text">{formatCOP(s.ingresos)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Ranking de Staff</h2>
        {ranking.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
            Sin comisiones generadas todavía en este periodo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <li key={r.vinculoId} className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-muted">{i + 1}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-text">{r.nombre}</p>
                    <p className="text-[11px] text-text-faint">
                      {r.reservasCompletadas} reservas{r.sedeNombre ? ` · ${r.sedeNombre}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-[12.5px] font-bold text-text">{formatCOP(r.comisionGenerada)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SeccionResenas resenasIniciales={resenasIniciales} />
    </main>
  );
}

function SeccionResenas({ resenasIniciales }: { resenasIniciales: ResenaRecibida[] }) {
  const [resenas, setResenas] = useState(resenasIniciales);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onResponder(resenaId: string) {
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);
    const res = await responderResena(resenaId, texto);
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setResenas((prev) => prev.map((r) => (r.id === resenaId ? { ...r, respuestaNegocio: texto.trim() } : r)));
    setRespondiendo(null);
    setTexto("");
  }

  async function onReportar(resenaId: string) {
    const motivo = prompt("¿Por qué querés reportar esta reseña? (lenguaje abusivo, contenido falso, etc.)");
    if (!motivo) return;
    setError(null);
    const res = await reportarResena(resenaId, motivo);
    if (!res.ok) return setError(res.error);
    setResenas((prev) => prev.filter((r) => r.id !== resenaId));
  }

  return (
    <section>
      <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Reseñas recibidas</h2>
      {error ? <p className="mb-3 text-[12.5px] font-semibold text-danger">{error}</p> : null}
      {resenas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
          Todavía no recibiste ninguna reseña.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {resenas.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-text">{r.clienteNombre}</p>
                <Badge tone="accent">{"★".repeat(r.calificacion)}</Badge>
              </div>
              {r.comentario ? <p className="mt-1.5 text-[12.5px] text-text-muted">{r.comentario}</p> : null}
              {r.respuestaNegocio ? (
                <div className="mt-2 rounded-xl bg-surface-2 p-2.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Tu respuesta</p>
                  <p className="mt-0.5 text-[12px] text-text">{r.respuestaNegocio}</p>
                </div>
              ) : respondiendo === r.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escribí tu respuesta pública..."
                    className="min-h-[70px] rounded-xl border border-border bg-bg p-2.5 text-[12.5px] text-text outline-none focus:border-accent/60"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" loading={guardando} disabled={!texto.trim()} onClick={() => onResponder(r.id)}>
                      Publicar respuesta
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRespondiendo(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRespondiendo(r.id);
                      setTexto("");
                    }}
                    className="text-[11.5px] font-semibold text-accent"
                  >
                    Responder públicamente
                  </button>
                  <button type="button" onClick={() => onReportar(r.id)} className="text-[11.5px] font-semibold text-text-faint">
                    Reportar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
