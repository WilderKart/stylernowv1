"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import {
  activarCampana,
  crearCampana,
  finalizarCampana,
  obtenerMetricasCampana,
  pausarCampana,
  type CampanaAdmin,
  type MetricasCampana,
} from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  BORRADOR: "neutral",
  ACTIVA: "success",
  PAUSADA: "accent",
  AGOTADA: "danger",
  FINALIZADA: "neutral",
};

const FORMATO_ETIQUETA: Record<string, string> = { DESTACADO: "Destacado", PIN: "Pin patrocinado" };

export function VistaAds({
  negocioId,
  planInsuficiente,
  campanasIniciales,
  errorInicial,
}: {
  negocioId: string;
  planInsuficiente: boolean;
  campanasIniciales: CampanaAdmin[];
  errorInicial: string | null;
}) {
  const [campanas, setCampanas] = useState(campanasIniciales);
  const [creando, setCreando] = useState(false);
  const error = errorInicial;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-bold uppercase text-text">Publicidad</h1>
        {!planInsuficiente ? (
          <Button size="sm" variant="secondary" onClick={() => setCreando((v) => !v)}>
            {creando ? "Cancelar" : "Nueva campaña"}
          </Button>
        ) : null}
      </div>
      <p className="mb-6 text-[12px] text-text-faint">
        Destacá tu negocio en el Marketplace. El gasto se descuenta de tu Wallet en tiempo real, nunca supera tu presupuesto diario.
      </p>

      {planInsuficiente ? (
        <Card className="mb-6 border-accent/30 bg-accent-soft">
          <p className="text-[12.5px] text-text-muted">Necesitás el Plan Jarl o superior para crear campañas publicitarias.</p>
        </Card>
      ) : null}

      {creando ? (
        <FormularioCampana
          negocioId={negocioId}
          onCreada={(c) => {
            setCampanas((prev) => [c, ...prev]);
            setCreando(false);
          }}
        />
      ) : null}

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {campanas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          Todavía no creaste ninguna campaña.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {campanas.map((c) => (
            <TarjetaCampana key={c.id} campana={c} onActualizar={(actualizada) => setCampanas((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)))} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FormularioCampana({ negocioId, onCreada }: { negocioId: string; onCreada: (c: CampanaAdmin) => void }) {
  const [formato, setFormato] = useState<"DESTACADO" | "PIN">("DESTACADO");
  const [unidadCobro, setUnidadCobro] = useState<"CPC" | "CPM">("CPC");
  const [presupuestoDiario, setPresupuestoDiario] = useState("20000");
  const [presupuestoTotal, setPresupuestoTotal] = useState("300000");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    setGuardando(true);
    setError(null);
    const res = await crearCampana({
      negocioId,
      formato,
      unidadCobro: formato === "DESTACADO" ? "CPC" : unidadCobro,
      presupuestoDiario: Number(presupuestoDiario),
      presupuestoTotal: Number(presupuestoTotal),
      fechaFin: null,
    });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    onCreada({
      id: res.data.id, formato, unidadCobro: formato === "DESTACADO" ? "CPC" : unidadCobro,
      presupuestoDiario: Number(presupuestoDiario), presupuestoTotal: Number(presupuestoTotal),
      gastoTotal: 0, estado: "BORRADOR", impresiones: 0, clics: 0, fechaInicio: null, fechaFin: null,
    });
  }

  return (
    <Card className="mb-6 flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Formato</label>
        <div className="flex gap-2">
          {(["DESTACADO", "PIN"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormato(f)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${formato === f ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
            >
              {FORMATO_ETIQUETA[f]}
            </button>
          ))}
        </div>
      </div>

      {formato === "PIN" ? (
        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Unidad de cobro</label>
          <div className="flex gap-2">
            {(["CPC", "CPM"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnidadCobro(u)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${unidadCobro === u ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
              >
                {u === "CPC" ? "Por clic" : "Por mil vistas"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-text-faint">Destacado se cobra siempre por clic (CPC).</p>
      )}

      <div className="flex gap-3">
        <Input label="Presupuesto diario (COP)" type="number" value={presupuestoDiario} onChange={(e) => setPresupuestoDiario(e.target.value)} />
        <Input label="Presupuesto total (COP)" type="number" value={presupuestoTotal} onChange={(e) => setPresupuestoTotal(e.target.value)} />
      </div>

      {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
      <Button size="sm" loading={guardando} onClick={crear} className="self-start">
        Crear campaña (queda en borrador)
      </Button>
    </Card>
  );
}

function TarjetaCampana({ campana, onActualizar }: { campana: CampanaAdmin; onActualizar: (c: CampanaAdmin) => void }) {
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<MetricasCampana | null>(null);
  const [verMetricas, setVerMetricas] = useState(false);

  async function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>, estadoOptimista?: string) {
    setAccionando(true);
    setError(null);
    const res = await fn();
    setAccionando(false);
    if (!res.ok) return setError(res.error ?? "Error inesperado.");
    if (estadoOptimista) onActualizar({ ...campana, estado: estadoOptimista });
  }

  async function toggleMetricas() {
    if (verMetricas) return setVerMetricas(false);
    const res = await obtenerMetricasCampana(campana.id);
    if (res.ok) setMetricas(res.data);
    setVerMetricas(true);
  }

  return (
    <li className="rounded-2xl border border-border-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-bold text-text">
            {FORMATO_ETIQUETA[campana.formato] ?? campana.formato} · {campana.unidadCobro}
          </p>
          <p className="text-[11.5px] text-text-faint">
            {formatCOP(campana.gastoTotal)} gastado de {campana.presupuestoTotal !== null ? formatCOP(campana.presupuestoTotal) : "presupuesto abierto"} ·{" "}
            {formatCOP(campana.presupuestoDiario)}/día
          </p>
        </div>
        <Badge tone={ESTADO_TONO[campana.estado] ?? "neutral"}>{campana.estado}</Badge>
      </div>

      {error ? <p className="mt-2 text-[11.5px] font-semibold text-danger">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {campana.estado === "BORRADOR" || campana.estado === "PAUSADA" ? (
          <Button size="sm" loading={accionando} onClick={() => ejecutar(() => activarCampana(campana.id), "ACTIVA")}>
            {campana.estado === "BORRADOR" ? "Activar" : "Reanudar"}
          </Button>
        ) : null}
        {campana.estado === "ACTIVA" ? (
          <Button size="sm" variant="secondary" loading={accionando} onClick={() => ejecutar(() => pausarCampana(campana.id), "PAUSADA")}>
            Pausar
          </Button>
        ) : null}
        {["BORRADOR", "ACTIVA", "PAUSADA"].includes(campana.estado) ? (
          <Button size="sm" variant="ghost" loading={accionando} onClick={() => ejecutar(() => finalizarCampana(campana.id), "FINALIZADA")}>
            Finalizar
          </Button>
        ) : null}
        <button type="button" onClick={toggleMetricas} className="text-[11.5px] font-semibold text-accent">
          {verMetricas ? "Ocultar métricas" : "Ver métricas"}
        </button>
      </div>

      {verMetricas && metricas ? (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3">
          <MetricaMini etiqueta="Impresiones" valor={metricas.impresiones} />
          <MetricaMini etiqueta="Clics" valor={metricas.clics} />
          <MetricaMini etiqueta="CTR" valor={`${metricas.ctr}%`} />
          <MetricaMini etiqueta="Reservas atrib." valor={metricas.reservasAtribuidas} />
          <MetricaMini etiqueta="Costo/Reserva" valor={metricas.costoPorReserva !== null ? formatCOP(metricas.costoPorReserva) : "—"} />
          <MetricaMini etiqueta="Restante" valor={formatCOP(metricas.presupuestoRestante)} />
        </div>
      ) : null}
    </li>
  );
}

function MetricaMini({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="text-center">
      <p className="text-[13px] font-bold text-text">{valor}</p>
      <p className="text-[9.5px] uppercase tracking-wide text-text-faint">{etiqueta}</p>
    </div>
  );
}
