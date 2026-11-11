"use client";

import { Fila, Filas, Sec, TicketCita } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { History } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelarMiMembresia, congelarMiMembresia, reactivarMiMembresia } from "./actions";

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  PROXIMA_A_VENCER: "warn",
  SUSPENDIDA: "info",
  CANCELADA: "err",
  VENCIDA: "err",
};
const ESTADO_ETIQUETA: Record<string, string> = {
  ACTIVA: "Activa",
  PROXIMA_A_VENCER: "Próxima a vencer",
  SUSPENDIDA: "Congelada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
};

interface Plan {
  nombre: string;
  precio: number;
  duracion_meses: number;
  descuento_pct: number;
  limite_usos_mes: number | null;
  congelacion_max_dias: number;
  prioridad_reserva: boolean;
  regalo_cumpleanos: string | null;
  servicio_ids: string[];
}
interface Membresia {
  id: string;
  estado: string;
  fecha_inicio: string;
  fecha_proximo_cobro: string;
  congelada_hasta: string | null;
  usos_mes_actual: number;
  plan: unknown;
}

export function VistaMiMembresia({ membresia, negocioNombre }: { membresia: Membresia; negocioNombre: string }) {
  const plan = membresia.plan as unknown as Plan;
  const [pendiente, iniciarTransicion] = useTransition();
  const [mostrarCongelar, setMostrarCongelar] = useState(false);

  function cancelar() {
    if (!confirm("¿Cancelar tu Membresía? Dejarás de recibir sus beneficios al terminar el ciclo actual.")) return;
    iniciarTransicion(async () => {
      const r = await cancelarMiMembresia(membresia.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Membresía cancelada.");
      window.location.reload();
    });
  }

  function congelar(dias: 7 | 15 | 30) {
    iniciarTransicion(async () => {
      const r = await congelarMiMembresia(membresia.id, dias);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Membresía congelada por ${dias} días.`);
      setMostrarCongelar(false);
      window.location.reload();
    });
  }

  function reactivar() {
    iniciarTransicion(async () => {
      const r = await reactivarMiMembresia(membresia.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Membresía reactivada.");
      window.location.reload();
    });
  }

  const puedeCongelar = membresia.estado === "ACTIVA" && plan.congelacion_max_dias > 0;
  const puedeReactivar = membresia.estado === "SUSPENDIDA" && membresia.congelada_hasta && new Date(membresia.congelada_hasta) <= new Date();
  const puedeCancelar = !["CANCELADA", "VENCIDA"].includes(membresia.estado);
  const cobro = new Date(membresia.fecha_proximo_cobro);

  return (
    <main className="flex flex-1 flex-col pb-10">
      <div className="p-4">
        <TicketCita
          dia={cobro.toLocaleDateString("es-CO", { day: "2-digit" })}
          mes={cobro.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
          estado={<Status tone={ESTADO_TONO[membresia.estado] ?? "info"}>{ESTADO_ETIQUETA[membresia.estado] ?? membresia.estado}</Status>}
          titulo={plan.nombre}
          lineas={[
            negocioNombre,
            `Próximo cobro: ${cobro.toLocaleDateString("es-CO")}`,
            membresia.congelada_hasta ? `Congelada hasta: ${new Date(membresia.congelada_hasta).toLocaleDateString("es-CO")}` : null,
          ].filter(Boolean)}
          pie={
            <>
              <span className="sn-label">
                Cada {plan.duracion_meses} mes{plan.duracion_meses > 1 ? "es" : ""}
              </span>
              <span className="sn-price">{formatCOP(Number(plan.precio))}</span>
            </>
          }
        />
      </div>

      <Sec>01 / Uso este mes</Sec>
      <Filas>
        <Fila
          titulo={plan.limite_usos_mes ? "Usos disponibles" : "Usos (sin límite)"}
          derecha={
            <span className="sn-fig text-[22px]">
              {membresia.usos_mes_actual}
              {plan.limite_usos_mes ? ` / ${plan.limite_usos_mes}` : ""}
            </span>
          }
        />
        <Fila icono={<History aria-hidden className="size-5" />} titulo="Historial de uso" href={`/membresias/${membresia.id}/historial`} />
      </Filas>

      <Sec>02 / Gestionar</Sec>
      <div className="flex flex-col gap-3 px-4">
        {puedeReactivar ? (
          <Button variant="secondary" size="lg" disabled={pendiente} onClick={reactivar}>
            Reactivar membresía
          </Button>
        ) : puedeCongelar ? (
          mostrarCongelar ? (
            <div className="flex flex-wrap gap-3">
              {[7, 15, 30].filter((d) => d <= plan.congelacion_max_dias).map((d) => (
                <Button key={d} variant="secondary" className="min-w-0 flex-1" disabled={pendiente} onClick={() => congelar(d as 7 | 15 | 30)}>
                  {d} días
                </Button>
              ))}
            </div>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => setMostrarCongelar(true)}>
              Congelar membresía
            </Button>
          )
        ) : null}
        {puedeCancelar ? (
          <Button variant="danger" size="lg" disabled={pendiente} onClick={cancelar}>
            Cancelar membresía
          </Button>
        ) : null}
      </div>
    </main>
  );
}
