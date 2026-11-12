"use client";

import { Segmented } from "@/components/brutal";
import { diaYMes, EstadoReservaStatus, horaCorta, TicketCita, type EstadoReserva } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/proveedor";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

export interface ReservaItem {
  id: string;
  estado: EstadoReserva;
  horaInicio: string;
  zonaHoraria: string;
  negocio: string;
  profesional: string | null;
  servicios: string;
  montoTotal: number;
}

type Pestana = "proximas" | "pasadas" | "canceladas";

const VACIO = {
  proximas: "citas.vacio_proximas",
  pasadas: "citas.vacio_pasadas",
  canceladas: "citas.vacio_canceladas",
} as const;

/** Separa por momento y estado en el render (el servidor entrega la fecha actual como `ahora`). */
export function ListaReservas({ reservas, ahora }: { reservas: ReservaItem[]; ahora: number }) {
  const t = useT();
  const [pestana, setPestana] = useState<Pestana>("proximas");

  const esProxima = (r: ReservaItem) =>
    new Date(r.horaInicio).getTime() >= ahora &&
    (r.estado === "CONFIRMADA" || r.estado === "PENDIENTE_PAGO" || r.estado === "EN_CURSO");
  const esCancelada = (r: ReservaItem) => r.estado === "CANCELADA" || r.estado === "NO_SHOW";

  // Próximas: la primera en asistir (día y hora más cercanos) va arriba y las más lejanas al final.
  // Pasadas y canceladas: la más reciente primero.
  const porFecha = (a: ReservaItem, b: ReservaItem) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime();
  const grupos: Record<Pestana, ReservaItem[]> = {
    proximas: reservas.filter(esProxima).sort(porFecha),
    canceladas: reservas.filter((r) => !esProxima(r) && esCancelada(r)).sort((a, b) => porFecha(b, a)),
    pasadas: reservas.filter((r) => !esProxima(r) && !esCancelada(r)).sort((a, b) => porFecha(b, a)),
  };
  const visibles = grupos[pestana];

  return (
    <>
      <div className="px-4 pb-4">
        <Segmented<Pestana>
          aria-label={t("citas.filtrar")}
          className="flex [&>button]:min-w-0 [&>button]:flex-1"
          value={pestana}
          onChange={setPestana}
          options={[
            { value: "proximas", label: `${t("citas.proximas")}${grupos.proximas.length ? ` · ${grupos.proximas.length}` : ""}` },
            { value: "pasadas", label: t("citas.pasadas") },
            { value: "canceladas", label: t("citas.canceladas") },
          ]}
        />
      </div>

      {visibles.length === 0 ? (
        <div className="px-4 pb-4">
          <div className="sn-empty">
            <p className="section">{t(VACIO[pestana])}</p>
            {pestana === "proximas" ? (
              <Button asChild>
                <Link href="/">{t("citas.explorar")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="p-stack px-4 pb-4">
          {visibles.map((r) => {
            const dm = diaYMes(r.horaInicio, r.zonaHoraria);
            return (
              <li key={r.id}>
                <TicketCita
                  href={`/reserva/${r.id}`}
                  dia={dm.dia}
                  mes={dm.mes}
                  estado={<EstadoReservaStatus estado={r.estado} />}
                  titulo={r.servicios || t("citas.servicio")}
                  lineas={[
                    `${r.profesional ? `${r.profesional} · ` : ""}${horaCorta(r.horaInicio, r.zonaHoraria)} · ${r.negocio}`,
                    formatCOP(r.montoTotal),
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
