"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { listarClientesCRM, listarCumpleanerosDelMes, type ClienteCRM } from "../actions";

function hoyMenos(dias: number) {
  return new Date(Date.now() - dias * 86400000).toISOString();
}

const PLANTILLAS = [
  { id: "inactivos45", etiqueta: "Clientes inactivos 45+ días" },
  { id: "vip_sin_visita", etiqueta: "VIP sin visita reciente" },
  { id: "cumpleaneros", etiqueta: "Cumpleañeros del mes" },
  { id: "primera_visita_7d", etiqueta: "Primera visita hace 7 días" },
] as const;

export function ConstructorSegmentos({
  negocioId,
  sedeIdFijo,
  etiquetasDisponibles,
}: {
  negocioId: string;
  sedeIdFijo: string | null;
  etiquetasDisponibles: string[];
}) {
  const [resultado, setResultado] = useState<ClienteCRM[] | null>(null);
  const [tituloResultado, setTituloResultado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [etiqueta, setEtiqueta] = useState("");
  const [ltvMin, setLtvMin] = useState("");
  const [ultimaVisitaAntes, setUltimaVisitaAntes] = useState("");
  const [soloConConsentimiento, setSoloConConsentimiento] = useState(true);

  async function onPlantilla(id: (typeof PLANTILLAS)[number]["id"], etiquetaTitulo: string) {
    setCargando(true);
    setError(null);
    setTituloResultado(etiquetaTitulo);

    if (id === "cumpleaneros") {
      const res = await listarCumpleanerosDelMes(negocioId, sedeIdFijo);
      setCargando(false);
      if (!res.ok) return setError(res.error);
      return setResultado(res.data);
    }

    const filtroBase = { negocioId, sedeId: sedeIdFijo ?? undefined, limite: 200 };
    const res = await listarClientesCRM(
      id === "inactivos45"
        ? { ...filtroBase, ultimaVisitaAntes: hoyMenos(45) }
        : id === "vip_sin_visita"
          ? { ...filtroBase, soloVip: true, ultimaVisitaAntes: hoyMenos(30) }
          : { ...filtroBase, primeraVisitaDespues: hoyMenos(7), primeraVisitaAntes: hoyMenos(6) }
    );
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setResultado(res.data.items);
  }

  async function onFiltrarPersonalizado() {
    setCargando(true);
    setError(null);
    setTituloResultado("Segmento personalizado");
    const res = await listarClientesCRM({
      negocioId,
      sedeId: sedeIdFijo ?? undefined,
      etiqueta: etiqueta || undefined,
      ltvMin: ltvMin ? Number(ltvMin) : undefined,
      ultimaVisitaAntes: ultimaVisitaAntes ? new Date(ultimaVisitaAntes).toISOString() : undefined,
      soloConConsentimientoMarketing: soloConConsentimiento,
      limite: 200,
    });
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setResultado(res.data.items);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
      <p className="mb-4 text-[12.5px] text-text-muted">
        Combiná filtros para armar una lista de Clientes — útil para campañas de
        notificación cuando ese módulo exista (Fase 6). Los segmentos siempre excluyen
        a quien retiró su consentimiento de marketing, salvo que lo desactives acá para
        solo mirar la lista.
      </p>

      <section className="mb-6">
        <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Plantillas sugeridas</h2>
        <div className="flex flex-col gap-2">
          {PLANTILLAS.map((p) => (
            <Button key={p.id} variant="secondary" loading={cargando} onClick={() => onPlantilla(p.id, p.etiqueta)}>
              {p.etiqueta}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">Personalizado</h2>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <select
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            className="h-10 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
          >
            <option value="">Cualquier etiqueta</option>
            {etiquetasDisponibles.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="LTV mínimo"
              value={ltvMin}
              onChange={(e) => setLtvMin(e.target.value)}
              className="h-10 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
            />
            <input
              type="date"
              placeholder="Sin visitas desde"
              value={ultimaVisitaAntes}
              onChange={(e) => setUltimaVisitaAntes(e.target.value)}
              className="h-10 rounded-lg border border-border bg-bg px-2 text-[12px] text-text"
            />
          </div>
          <label className="flex items-center gap-2 text-[11.5px] text-text-muted">
            <input type="checkbox" checked={soloConConsentimiento} onChange={(e) => setSoloConConsentimiento(e.target.checked)} />
            Solo Clientes con consentimiento de marketing vigente
          </label>
          <Button loading={cargando} onClick={onFiltrarPersonalizado}>
            Buscar
          </Button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {resultado ? (
        <section>
          <h2 className="font-display mb-2 text-[13px] font-bold uppercase text-text">
            {tituloResultado} — {resultado.length}
          </h2>
          {resultado.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">
              Ningún cliente coincide con este segmento.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {resultado.map((c) => (
                <li key={c.clienteId}>
                  <Link
                    href={`/panel/crm/${c.clienteId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5 hover:border-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-text">{c.nombre}</p>
                        {c.esVip ? <Badge tone="accent">VIP</Badge> : null}
                      </div>
                      <p className="text-[11px] text-text-faint">
                        {c.visitas} visitas · {c.ultimaVisita ? new Date(c.ultimaVisita).toLocaleDateString("es-CO") : "sin visitas"}
                      </p>
                    </div>
                    <p className="shrink-0 text-[12.5px] font-bold text-text">{formatCOP(c.ltv)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <Card className="border-dashed">
          <p className="text-center text-[12.5px] text-text-faint">
            Elegí una plantilla o armá un filtro personalizado para ver la lista.
          </p>
        </Card>
      )}
    </main>
  );
}
