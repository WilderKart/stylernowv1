"use client";

import { confirmar } from "@/components/ui/confirmar";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { fechaHoraLarga } from "@/lib/formato";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarCitaPrevia, completarCitaPrevia, marcarNoShowCitaPrevia } from "./actions";

export interface CitaPendiente {
  id: string;
  horaInicio: string;
  estado: string;
  cliente: string;
  servicios: string;
  monto: number;
}

/** Citas ya confirmadas antes del bloqueo: se pueden cobrar/completar, marcar no-show o cancelar. No se mueven de fecha. */
export function ListaCitasPendientes({ citas, puedeActuar }: { citas: CitaPendiente[]; puedeActuar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  if (citas.length === 0) {
    return <p className="text-[12.5px] text-text-muted">No tienes citas confirmadas pendientes de cumplir.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {mensaje ? (
        <p role="status" className={mensaje.tipo === "ok" ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>
          {mensaje.texto}
        </p>
      ) : null}
      {citas.map((c) => (
        <Card key={c.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-text">{c.cliente}</p>
              <p className="text-[12px] text-text-muted">
                {fechaHoraLarga(c.horaInicio)} · {c.servicios || "Servicio"}
              </p>
            </div>
            <Badge tone={c.estado === "EN_CURSO" ? "accent" : "neutral"}>{c.estado === "EN_CURSO" ? "En curso" : "Confirmada"}</Badge>
          </div>
          {puedeActuar ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pendiente}
                onClick={() => {
                  if (!window.confirm("¿Cobrar en efectivo y completar esta cita?")) return;
                  setMensaje(null);
                  iniciar(async () => {
                    const r = await completarCitaPrevia(c.id);
                    if (r.ok) {
                      setMensaje({ tipo: "ok", texto: "Listo." });
                      router.refresh();
                    } else {
                      setMensaje({ tipo: "error", texto: r.error });
                    }
                  });
                }}
              >
                Cobrar y completar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pendiente}
                onClick={async () => {
                  if (!(await confirmar("¿Marcar que el cliente no se presentó?"))) return;
                  setMensaje(null);
                  iniciar(async () => {
                    const r = await marcarNoShowCitaPrevia(c.id);
                    if (r.ok) {
                      setMensaje({ tipo: "ok", texto: "Listo." });
                      router.refresh();
                    } else {
                      setMensaje({ tipo: "error", texto: r.error });
                    }
                  });
                }}
              >
                No se presentó
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={pendiente}
                onClick={async () => {
                  if (!(await confirmar("¿Cancelar esta cita? Se avisará al cliente."))) return;
                  setMensaje(null);
                  iniciar(async () => {
                    const r = await cancelarCitaPrevia(c.id);
                    if (r.ok) {
                      setMensaje({ tipo: "ok", texto: "Listo." });
                      router.refresh();
                    } else {
                      setMensaje({ tipo: "error", texto: r.error });
                    }
                  });
                }}
              >
                Cancelar cita
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}