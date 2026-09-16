"use client";

import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelarMiMembresia, congelarMiMembresia, reactivarMiMembresia } from "./actions";

const ESTADO_TONO: Record<string, "success" | "danger" | "neutral" | "accent"> = {
  ACTIVA: "success",
  PROXIMA_A_VENCER: "accent",
  SUSPENDIDA: "neutral",
  CANCELADA: "danger",
  VENCIDA: "danger",
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

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">{negocioNombre}</p>
            <p className="mt-0.5 text-[16px] font-bold text-text">{plan.nombre}</p>
          </div>
          <Badge tone={ESTADO_TONO[membresia.estado] ?? "neutral"}>{ESTADO_ETIQUETA[membresia.estado] ?? membresia.estado}</Badge>
        </div>
        <p className="mt-3 text-[13px] text-text-muted">{formatCOP(Number(plan.precio))} cada {plan.duracion_meses} mes{plan.duracion_meses > 1 ? "es" : ""}</p>
        <p className="text-[12px] text-text-faint">Próximo cobro: {new Date(membresia.fecha_proximo_cobro).toLocaleDateString("es-CO")}</p>
        {membresia.congelada_hasta ? (
          <p className="text-[12px] text-text-faint">Congelada hasta: {new Date(membresia.congelada_hasta).toLocaleDateString("es-CO")}</p>
        ) : null}
      </Card>

      <section className="mt-5">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-faint">Uso este mes</h2>
        <Card className="text-center">
          <p className="text-[22px] font-bold text-text">{membresia.usos_mes_actual}{plan.limite_usos_mes ? ` / ${plan.limite_usos_mes}` : ""}</p>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">{plan.limite_usos_mes ? "Usos disponibles" : "Usos (sin límite)"}</p>
        </Card>
      </section>

      <Link href={`/membresias/${membresia.id}/historial`} className="mt-3 block text-center text-[12px] font-bold uppercase text-accent">
        Ver historial de uso →
      </Link>

      <section className="mt-6 flex flex-col gap-2">
        {puedeReactivar ? (
          <Button variant="outline" disabled={pendiente} onClick={reactivar}>Reactivar Membresía</Button>
        ) : puedeCongelar ? (
          mostrarCongelar ? (
            <div className="flex gap-2">
              {[7, 15, 30].filter((d) => d <= plan.congelacion_max_dias).map((d) => (
                <Button key={d} variant="outline" className="flex-1" disabled={pendiente} onClick={() => congelar(d as 7 | 15 | 30)}>
                  {d} días
                </Button>
              ))}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setMostrarCongelar(true)}>Congelar Membresía</Button>
          )
        ) : null}
        {puedeCancelar ? (
          <button type="button" disabled={pendiente} onClick={cancelar} className="text-center text-[12px] font-bold uppercase text-danger">
            Cancelar Membresía
          </button>
        ) : null}
      </section>
    </main>
  );
}
