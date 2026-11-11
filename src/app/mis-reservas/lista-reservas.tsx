"use client";

import { Segmented } from "@/components/brutal";
import { diaYMes, EstadoReservaStatus, horaCorta, TicketCita, type EstadoReserva } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
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

const VACIO: Record<Pestana, string> = {
  proximas: "No tienes citas próximas.",
  pasadas: "Aún no tienes citas pasadas.",
  canceladas: "No tienes citas canceladas.",
};

/** Separa por momento y estado en el render (el servidor entrega la fecha actual como `ahora`). */
export function ListaReservas({ reservas, ahora }: { reservas: ReservaItem[]; ahora: number }) {
  const [pestana, setPestana] = useState<Pestana>("proximas");

  const esProxima = (r: ReservaItem) =>
    new Date(r.horaInicio).getTime() >= ahora &&
    (r.estado === "CONFIRMADA" || r.estado === "PENDIENTE_PAGO" || r.estado === "EN_CURSO");
  const esCancelada = (r: ReservaItem) => r.estado === "CANCELADA" || r.estado === "NO_SHOW";

  const grupos: Record<Pestana, ReservaItem[]> = {
    proximas: reservas.filter(esProxima),
    canceladas: reservas.filter((r) => !esProxima(r) && esCancelada(r)),
    pasadas: reservas.filter((r) => !esProxima(r) && !esCancelada(r)),
  };
  const visibles = grupos[pestana];

  return (
    <>
      <div className="px-4 pb-4">
        <Segmented<Pestana>
          aria-label="Filtrar citas"
          className="flex [&>button]:min-w-0 [&>button]:flex-1"
          value={pestana}
          onChange={setPestana}
          options={[
            { value: "proximas", label: `Próximas${grupos.proximas.length ? ` · ${grupos.proximas.length}` : ""}` },
            { value: "pasadas", label: "Pasadas" },
            { value: "canceladas", label: "Canceladas" },
          ]}
        />
      </div>

      {visibles.length === 0 ? (
        <div className="px-4 pb-4">
          <div className="sn-empty">
            <p className="section">{VACIO[pestana]}</p>
            {pestana === "proximas" ? (
              <Button asChild>
                <Link href="/">Explorar negocios</Link>
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
                  titulo={r.servicios || "Servicio"}
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
