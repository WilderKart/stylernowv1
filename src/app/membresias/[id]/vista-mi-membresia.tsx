"use client";

import { Fila, Filas, Sec, TicketCita } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { History } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelarMiMembresia, congelarMiMembresia, reactivarMiMembresia } from "./actions";
import { useIdioma, useT } from "@/lib/i18n/proveedor";

const ESTADO_TONO: Record<string, "ok" | "warn" | "err" | "info"> = {
  ACTIVA: "ok",
  PROXIMA_A_VENCER: "warn",
  SUSPENDIDA: "info",
  CANCELADA: "err",
  VENCIDA: "err",
};
const ESTADO_ETIQUETA = {
  ACTIVA: "mm.est_activa",
  PROXIMA_A_VENCER: "mm.est_proxima",
  SUSPENDIDA: "mm.est_suspendida",
  CANCELADA: "mm.est_cancelada",
  VENCIDA: "mm.est_vencida",
} as const;

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
  const t = useT();
  const loc = useIdioma() === "en" ? "en-US" : "es-CO";
  const plan = membresia.plan as unknown as Plan;
  const [pendiente, iniciarTransicion] = useTransition();
  const [mostrarCongelar, setMostrarCongelar] = useState(false);

  function cancelar() {
    if (!confirm(t("mm.confirm_cancelar"))) return;
    iniciarTransicion(async () => {
      const r = await cancelarMiMembresia(membresia.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(t("mm.cancelada"));
      window.location.reload();
    });
  }

  function congelar(dias: 7 | 15 | 30) {
    iniciarTransicion(async () => {
      const r = await congelarMiMembresia(membresia.id, dias);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(t("mm.congelada_dias", { dias }));
      setMostrarCongelar(false);
      window.location.reload();
    });
  }

  function reactivar() {
    iniciarTransicion(async () => {
      const r = await reactivarMiMembresia(membresia.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(t("mm.reactivada"));
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
          dia={cobro.toLocaleDateString(loc, { day: "2-digit" })}
          mes={cobro.toLocaleDateString(loc, { month: "short" }).replace(".", "")}
          estado={<Status tone={ESTADO_TONO[membresia.estado] ?? "info"}>{ESTADO_ETIQUETA[membresia.estado as keyof typeof ESTADO_ETIQUETA] ? t(ESTADO_ETIQUETA[membresia.estado as keyof typeof ESTADO_ETIQUETA]) : membresia.estado}</Status>}
          titulo={plan.nombre}
          lineas={[
            negocioNombre,
            t("mm.proximo_cobro_f", { fecha: cobro.toLocaleDateString(loc) }),
            membresia.congelada_hasta ? t("mm.congelada_hasta", { fecha: new Date(membresia.congelada_hasta).toLocaleDateString(loc) }) : null,
          ].filter(Boolean)}
          pie={
            <>
              <span className="sn-label">
                {plan.duracion_meses > 1 ? t("mm.cada_meses", { n: plan.duracion_meses }) : t("mm.cada_mes", { n: plan.duracion_meses })}
              </span>
              <span className="sn-price">{formatCOP(Number(plan.precio))}</span>
            </>
          }
        />
      </div>

      <Sec>{t("mm.sec_uso")}</Sec>
      <Filas>
        <Fila
          titulo={plan.limite_usos_mes ? t("mm.usos_disp") : t("mm.usos_sin_limite")}
          derecha={
            <span className="sn-fig text-[22px]">
              {membresia.usos_mes_actual}
              {plan.limite_usos_mes ? ` / ${plan.limite_usos_mes}` : ""}
            </span>
          }
        />
        <Fila icono={<History aria-hidden className="size-5" />} titulo={t("mm.historial_uso")} href={`/membresias/${membresia.id}/historial`} />
      </Filas>

      <Sec>{t("mm.sec_gestionar")}</Sec>
      <div className="flex flex-col gap-3 px-4">
        {puedeReactivar ? (
          <Button variant="secondary" size="lg" disabled={pendiente} onClick={reactivar}>
            {t("mm.reactivar")}
          </Button>
        ) : puedeCongelar ? (
          mostrarCongelar ? (
            <div className="flex flex-wrap gap-3">
              {[7, 15, 30].filter((d) => d <= plan.congelacion_max_dias).map((d) => (
                <Button key={d} variant="secondary" className="min-w-0 flex-1" disabled={pendiente} onClick={() => congelar(d as 7 | 15 | 30)}>
                  {t("mm.n_dias", { n: d })}
                </Button>
              ))}
            </div>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => setMostrarCongelar(true)}>
              {t("mm.congelar")}
            </Button>
          )
        ) : null}
        {puedeCancelar ? (
          <Button variant="danger" size="lg" disabled={pendiente} onClick={cancelar}>
            {t("mm.cancelar")}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
