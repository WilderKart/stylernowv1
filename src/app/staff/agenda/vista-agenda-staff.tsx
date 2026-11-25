"use client";

import { VerComprobante } from "@/components/pagos/ver-comprobante";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { hora, sumarDias } from "@/lib/formato";
import { useEffect, useState } from "react";
import { completarCitaSinPos, hacerCheckIn, hacerCheckOut, listarHorariosParaReprogramar, listarMisCitas, reprogramarCitaPorSolicitudDelCliente, type CitaStaff, type HorarioLibre } from "./actions";

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

/** Día de hoy (America/Bogotá) en formato AAAA-MM-DD; la base vuelve a validar con la zona horaria de la sede. */
function hoyBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
function esHoy(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) === hoyBogota();
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
    if (res.aviso) toast.warning(res.aviso);
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

  // Reprogramar: solo a petición del cliente (se confirma con una casilla y queda registrado).
  const [reprogramando, setReprogramando] = useState<string | null>(null);
  const [diaNuevo, setDiaNuevo] = useState("");
  const [horarios, setHorarios] = useState<HorarioLibre[] | null>(null);
  const [horaElegida, setHoraElegida] = useState<string | null>(null);
  const [clientePidio, setClientePidio] = useState(false);

  function abrirReprogramar(id: string) {
    setReprogramando(id);
    setDiaNuevo("");
    setHorarios(null);
    setHoraElegida(null);
    setClientePidio(false);
    setError(null);
  }
  async function cargarHorarios(dia: string) {
    setDiaNuevo(dia);
    setHoraElegida(null);
    setHorarios(null);
    if (!reprogramando || !dia) return;
    const r = await listarHorariosParaReprogramar(reprogramando, dia);
    if (!r.ok) return setError(r.error);
    setHorarios(r.data);
  }
  async function confirmarReprogramar() {
    if (!reprogramando || !horaElegida) return;
    setAccionando(reprogramando);
    setError(null);
    const r = await reprogramarCitaPorSolicitudDelCliente(reprogramando, horaElegida, clientePidio);
    setAccionando(null);
    if (!r.ok) return setError(r.error);
    setReprogramando(null);
    cargarFecha(fecha);
  }

  async function onCompletarSinPos(id: string) {
    setAccionando(id);
    setError(null);
    const res = await completarCitaSinPos(id);
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
          No tienes citas ese día.
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

                {c.estado === "CONFIRMADA" || c.estado === "EN_CURSO" ? <VerComprobante reservaId={c.id} /> : null}

                {proximoANoShow ? (
                  <p className="mt-2 text-[11.5px] font-bold text-danger">
                    ⚠ A {Math.max(0, Math.round(minutosParaNoShow!))} min de marcarse como No-Show automático — haz check-in o avisá al negocio.
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {c.estado === "CONFIRMADA" ? (
                    esHoy(c.horaInicio) ? (
                      <Button size="sm" loading={accionando === c.id} onClick={() => onCheckIn(c.id)}>
                        Check-in
                      </Button>
                    ) : (
                      <p className="self-center text-[11.5px] text-text-faint">El check-in se habilita el día de la cita.</p>
                    )
                  ) : null}
                  {c.estado === "CONFIRMADA" && !c.checkinAt ? (
                    <Button size="sm" variant="secondary" disabled={accionando !== null} onClick={() => abrirReprogramar(c.id)}>
                      Reprogramar
                    </Button>
                  ) : null}
                  {c.estado === "EN_CURSO" && !c.checkoutAt ? (
                    <Button size="sm" variant="secondary" loading={accionando === c.id} onClick={() => onCheckOut(c.id)}>
                      Check-out
                    </Button>
                  ) : null}
                  {c.checkoutAt && c.estado !== "COMPLETADA" ? (
                    <Button size="sm" variant="ghost" loading={accionando === c.id} onClick={() => onCompletarSinPos(c.id)}>
                      Completar sin POS
                    </Button>
                  ) : null}
                  {c.checkoutAt && c.estado !== "COMPLETADA" ? <p className="self-center text-[11px] text-text-faint">Atención finalizada — falta cobrar en Caja</p> : null}
                </div>

                {reprogramando === c.id ? (
                  <div className="mt-3 flex flex-col gap-3 border-t-2 border-border pt-3">
                    <p className="text-[12px] leading-relaxed text-text-muted">
                      Solo reprograma si <b>el cliente te lo pidió</b>. El cliente también puede cambiar su cita desde su reserva.
                    </p>
                    <label className="flex flex-col gap-1.5">
                      <span className="sn-label">Nuevo día</span>
                      <input
                        type="date"
                        min={hoyBogota()}
                        value={diaNuevo}
                        onChange={(e) => void cargarHorarios(e.target.value)}
                        className="min-h-11 w-full border-2 border-border bg-bg px-3 text-[14px] text-text outline-none focus:shadow-hard"
                      />
                    </label>
                    {diaNuevo && horarios === null ? <p className="text-[12px] text-text-faint">Buscando horarios…</p> : null}
                    {horarios && horarios.length === 0 ? <p className="text-[12px] text-text-muted">No hay horarios libres ese día. Prueba con otro.</p> : null}
                    {horarios && horarios.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {horarios.map((h) => (
                          <li key={h.horaInicio}>
                            <button
                              type="button"
                              onClick={() => setHoraElegida(h.horaInicio)}
                              aria-pressed={horaElegida === h.horaInicio}
                              className={`min-h-10 border-2 px-3 font-mono text-[12px] font-bold ${horaElegida === h.horaInicio ? "border-border bg-signal text-ink" : "border-border text-text"}`}
                            >
                              {hora(h.horaInicio)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <label className="flex items-start gap-2 text-[12.5px] text-text">
                      <input type="checkbox" checked={clientePidio} onChange={(e) => setClientePidio(e.target.checked)} className="mt-0.5" />
                      El cliente me pidió este cambio de horario.
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" loading={accionando === c.id} disabled={!horaElegida || !clientePidio} onClick={() => void confirmarReprogramar()}>
                        Confirmar nuevo horario
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setReprogramando(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
