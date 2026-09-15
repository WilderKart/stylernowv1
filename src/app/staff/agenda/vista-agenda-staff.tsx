"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { hora, sumarDias } from "@/lib/formato";
import { useEffect, useState } from "react";
import { hacerCheckIn, hacerCheckOut, listarMisCitas, type CitaStaff } from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "accent" | "neutral"> = {
  CONFIRMADA: "accent",
  EN_CURSO: "accent",
  COMPLETADA: "success",
  NO_SHOW: "danger",
  PENDIENTE_PAGO: "neutral",
};

function inicioDiaISO(fecha: string) {
  return new Date(`${fecha}T00:00:00-05:00`).toISOString();
}

export function VistaAgendaStaff({
  citasIniciales,
  errorInicial,
  fechaInicial,
}: {
  citasIniciales: CitaStaff[];
  errorInicial: string | null;
  fechaInicial: string;
}) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [citas, setCitas] = useState(citasIniciales);
  const [cargando, setCargando] = useState(false);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [error, setError] = useState(errorInicial);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function cargarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    setCargando(true);
    setError(null);
    const res = await listarMisCitas(inicioDiaISO(nuevaFecha), inicioDiaISO(sumarDias(nuevaFecha, 1)));
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setCitas(res.data);
  }

  async function onCheckIn(id: string) {
    setAccionando(id);
    setError(null);
    const res = await hacerCheckIn(id);
    setAccionando(null);
    if (!res.ok) return setError(res.error);
    cargarFecha(fecha);
  }

  async function onCheckOut(id: string) {
    setAccionando(id);
    setError(null);
    const res = await hacerCheckOut(id);
    setAccionando(null);
    if (!res.ok) return setError(res.error);
    cargarFecha(fecha);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => cargarFecha(sumarDias(fecha, -1))} className="text-[13px] font-bold text-accent">
          ← Anterior
        </button>
        <p className="text-[13px] font-semibold text-text">
          {new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <button type="button" onClick={() => cargarFecha(sumarDias(fecha, 1))} className="text-[13px] font-bold text-accent">
          Siguiente →
        </button>
      </div>

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : citas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          No tenés citas ese día.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {citas.map((c) => {
            const minutosParaNoShow = c.estado === "CONFIRMADA" && !c.checkinAt ? 15 - (ahora - new Date(c.horaInicio).getTime()) / 60000 : null;
            const proximoANoShow = minutosParaNoShow !== null && minutosParaNoShow <= 15 && minutosParaNoShow > 0;
            return (
              <li key={c.id} className="rounded-2xl border border-border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-bold text-text">
                      {hora(c.horaInicio)} · {c.clienteNombre}
                    </p>
                    <p className="text-[11.5px] text-text-faint">{c.servicios || "Sin servicios"}</p>
                  </div>
                  <Badge tone={ESTADO_TONO[c.estado] ?? "neutral"}>{c.estado.replace("_", " ")}</Badge>
                </div>

                {proximoANoShow ? (
                  <p className="mt-2 text-[11.5px] font-bold text-danger">
                    ⚠ A {Math.max(0, Math.round(minutosParaNoShow!))} min de marcarse como No-Show automático — hacé check-in o avisá al negocio.
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {c.estado === "CONFIRMADA" ? (
                    <Button size="sm" loading={accionando === c.id} onClick={() => onCheckIn(c.id)}>
                      Check-in
                    </Button>
                  ) : null}
                  {c.estado === "EN_CURSO" && !c.checkoutAt ? (
                    <Button size="sm" variant="secondary" loading={accionando === c.id} onClick={() => onCheckOut(c.id)}>
                      Check-out
                    </Button>
                  ) : null}
                  {c.checkoutAt ? <p className="self-center text-[11px] text-text-faint">Atención finalizada — falta cobrar en Caja</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
