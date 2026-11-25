"use client";

import { useTerminologia } from "@/components/panel/terminologia-contexto";
import { aplicarTerminologia } from "@/lib/terminologia";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decidirAusencia, decidirHorario, type SolicitudAusenciaFila, type SolicitudHorarioFila } from "./actions";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const TIPOS: Record<string, string> = { PERMISO: "Permiso", VACACIONES: "Vacaciones", INCAPACIDAD: "Incapacidad", OTRO: "Otro" };
const fecha = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

export function VistaSolicitudes({ ausencias, horarios, disponible }: { ausencias: SolicitudAusenciaFila[]; horarios: SolicitudHorarioFila[]; disponible: boolean }) {
  const tm = useTerminologia();
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<{ tipo: "ausencia" | "horario"; id: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmarCitas, setConfirmarCitas] = useState<{ id: string; citas: number } | null>(null);

  async function aprobarAusencia(id: string, conCitas = false) {
    setOcupado(id);
    setError(null);
    const r = await decidirAusencia(id, true, "", conCitas);
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    if (r.requiereConfirmacion) return setConfirmarCitas({ id, citas: r.requiereConfirmacion });
    router.refresh();
  }
  async function aprobarHorario(id: string) {
    setOcupado(id);
    setError(null);
    const r = await decidirHorario(id, true, "");
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }
  async function rechazar() {
    if (!rechazando) return;
    if (motivo.trim().length < 3) return setError(aplicarTerminologia("Escribe un motivo para rechazar (lo verá el barbero).", tm));
    setOcupado(rechazando.id);
    setError(null);
    const r = rechazando.tipo === "ausencia" ? await decidirAusencia(rechazando.id, false, motivo.trim()) : await decidirHorario(rechazando.id, false, motivo.trim());
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setRechazando(null);
    setMotivo("");
    router.refresh();
  }

  const nada = ausencias.length === 0 && horarios.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(26px,8vw,36px)] font-bold uppercase leading-none text-text">
          Solicitudes del <span className="text-accent">equipo</span>
        </h1>
        <p className="text-[13.5px] leading-relaxed text-text-muted">
          Tus barberos proponen sus ausencias y cambios de horario; nada cambia en la agenda hasta que tú lo apruebas. Al aprobar una ausencia, ese tiempo
          queda bloqueado automáticamente.
        </p>
      </header>

      {!disponible ? <p className="border-2 border-dashed border-border px-3 py-4 text-[12.5px] text-text-muted">Esta función se está activando. Vuelve en unos minutos.</p> : null}
      {disponible && nada ? <p className="border-2 border-dashed border-border px-3 py-8 text-center text-[12.5px] text-text-muted">No hay solicitudes pendientes.</p> : null}
      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {ausencias.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Ausencias por aprobar">
          <h2 className="font-display text-[14px] font-bold uppercase text-text">Ausencias ({ausencias.length})</h2>
          {ausencias.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2">
              <p className="text-[13.5px] font-bold text-text">
                {a.staffNombre} · {TIPOS[a.tipo] ?? a.tipo}
              </p>
              <p className="text-[12.5px] text-text-muted">
                {fecha(a.fechaInicio)} → {fecha(a.fechaFin)}
              </p>
              {a.motivo ? <p className="text-[12px] text-text-faint">{a.motivo}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={ocupado === a.id} onClick={() => void aprobarAusencia(a.id)}>
                  Aprobar
                </Button>
                <Button size="sm" variant="secondary" disabled={ocupado !== null} onClick={() => { setRechazando({ tipo: "ausencia", id: a.id }); setMotivo(""); setError(null); }}>
                  Rechazar
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {horarios.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Horarios por aprobar">
          <h2 className="font-display text-[14px] font-bold uppercase text-text">Cambios de horario ({horarios.length})</h2>
          {horarios.map((h) => (
            <Card key={h.id} className="flex flex-col gap-2">
              <p className="text-[13.5px] font-bold text-text">{h.staffNombre}</p>
              <ul className="grid grid-cols-1 gap-1 text-[12.5px] text-text-muted sm:grid-cols-2">
                {[...h.propuesta].sort((x, y) => ((x.dia_semana + 6) % 7) - ((y.dia_semana + 6) % 7)).map((d) => (
                  <li key={d.dia_semana}>
                    <b className="text-text">{DIAS[d.dia_semana]}</b> {d.hora_inicio.slice(0, 5)} – {d.hora_fin.slice(0, 5)}
                  </li>
                ))}
                {h.propuesta.length === 0 ? <li>Sin días de atención.</li> : null}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={ocupado === h.id} onClick={() => void aprobarHorario(h.id)}>
                  Aprobar
                </Button>
                <Button size="sm" variant="secondary" disabled={ocupado !== null} onClick={() => { setRechazando({ tipo: "horario", id: h.id }); setMotivo(""); setError(null); }}>
                  Rechazar
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {rechazando ? (
        <Card className="flex flex-col gap-3 border-danger">
          <label className="flex flex-col gap-2">
            <span className="sn-label">Motivo del rechazo (lo verá el barbero)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border-2 border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:shadow-hard"
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={ocupado === rechazando.id} onClick={() => void rechazar()}>
              Confirmar rechazo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        isOpen={confirmarCitas !== null}
        onOpenChange={(a) => {
          if (!a) setConfirmarCitas(null);
        }}
        title="Hay citas en ese rango"
        description={aplicarTerminologia(`Este barbero tiene ${confirmarCitas?.citas ?? 0} cita(s) agendada(s) en esas fechas. Las citas NO se cancelan solas: tendrás que reagendarlas o reasignarlas. ¿Aprobar de todos modos?`, tm)}
        confirmLabel="Aprobar de todos modos"
        cancelLabel="Volver"
        onConfirm={() => {
          const c = confirmarCitas;
          setConfirmarCitas(null);
          if (c) void aprobarAusencia(c.id, true);
        }}
        onCancel={() => setConfirmarCitas(null)}
      />
    </div>
  );
}
