"use client";

import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { marcarFraudeRevisado, type EventoFraude, type MetricasLealtad } from "./actions";

const SEVERIDAD_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  BAJA: "neutral",
  MEDIA: "accent",
  ALTA: "danger",
};

export function VistaLealtadAdmin({ metricas, errorMetricas, eventosIniciales }: { metricas: MetricasLealtad | null; errorMetricas: string | null; eventosIniciales: EventoFraude[] }) {
  const [eventos, setEventos] = useState(eventosIniciales);

  async function onRevisar(id: string) {
    const res = await marcarFraudeRevisado(id);
    if (res.ok) setEventos((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div>
      {errorMetricas ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{errorMetricas}</p> : null}

      {metricas ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metrica etiqueta="Saldo en StylerWallets" valor={formatCOP(metricas.saldoTotalWallets)} />
          <Metrica etiqueta="Membresías activas" valor={metricas.membresiasActivas} />
          <Metrica etiqueta="Gift Cards activas" valor={metricas.giftCardsActivas} />
          <Metrica etiqueta="Saldo Gift Cards" valor={formatCOP(metricas.giftCardsSaldoTotal)} />
          <Metrica etiqueta="Referidos completados" valor={metricas.referidosCompletados} />
          <Metrica etiqueta="Campañas de Sellos activas" valor={metricas.sellosCampanasActivas} />
          <Metrica etiqueta="Cashback otorgado (histórico)" valor={formatCOP(metricas.cashbackOtorgadoTotal)} />
          <Metrica etiqueta="Miembros VIP" valor={metricas.vipMiembrosTotal} />
          <Metrica etiqueta="Grupos familiares" valor={metricas.familiasTotal} />
          <Metrica etiqueta="Cuentas corporativas activas" valor={metricas.cuentasCorporativasActivas} />
          <Metrica etiqueta="Eventos de fraude sin revisar" valor={metricas.eventosFraudeSinRevisar} alerta={metricas.eventosFraudeSinRevisar > 0} />
        </div>
      ) : null}

      <h2 className="font-display mb-3 text-[13px] font-bold uppercase text-text">Eventos de fraude sin revisar</h2>
      {eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">Sin eventos pendientes de revisión.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventos.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border-subtle bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-semibold text-text">{e.tipo.replaceAll("_", " ")}</p>
                    <Badge tone={SEVERIDAD_TONO[e.severidad] ?? "neutral"}>{e.severidad}</Badge>
                  </div>
                  <p className="mt-1 text-[10.5px] text-text-faint">{new Date(e.createdAt).toLocaleString("es-CO")}</p>
                  <pre className="mt-1.5 whitespace-pre-wrap text-[10.5px] text-text-faint">{JSON.stringify(e.payload)}</pre>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onRevisar(e.id)}>
                  Marcar revisado
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metrica({ etiqueta, valor, alerta }: { etiqueta: string; valor: string | number; alerta?: boolean }) {
  return (
    <Card className="text-center">
      <p className={`text-[18px] font-bold ${alerta ? "text-danger" : "text-text"}`}>{valor}</p>
      <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">{etiqueta}</p>
    </Card>
  );
}
