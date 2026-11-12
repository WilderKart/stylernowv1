"use client";

import { Status } from "@/components/brutal";
import { useT } from "@/lib/i18n/proveedor";
import { Check, ChevronLeft, Clock, X } from "lucide-react";
import Link from "next/link";

/**
 * Piezas de ui-cliente que llevan texto traducible. Son componentes de cliente (usan useT) para poder
 * renderizarse tanto desde Server Components como desde componentes de cliente.
 */

export function EnlaceVolver({ href }: { href: string }) {
  const t = useT();
  return (
    <Link href={href} className="sn-iconbtn" aria-label={t("comun.volver")}>
      <ChevronLeft aria-hidden />
    </Link>
  );
}

const ESTADOS_RESERVA = {
  PENDIENTE_PAGO: { tone: "warn", etiqueta: "estado.pendiente_pago", icono: Clock },
  CONFIRMADA: { tone: "ok", etiqueta: "estado.confirmada", icono: Check },
  EN_CURSO: { tone: "info", etiqueta: "estado.en_curso", icono: Clock },
  COMPLETADA: { tone: "info", etiqueta: "estado.completada", icono: Check },
  CANCELADA: { tone: "err", etiqueta: "estado.cancelada", icono: X },
  NO_SHOW: { tone: "err", etiqueta: "estado.no_show", icono: X },
} as const;

export type EstadoReserva = keyof typeof ESTADOS_RESERVA;

/** Estado de una reserva con el color/ícono del prototipo. */
export function EstadoReservaStatus({ estado }: { estado: EstadoReserva }) {
  const t = useT();
  const e = ESTADOS_RESERVA[estado];
  const Icono = e.icono;
  return (
    <Status tone={e.tone} icon={<Icono aria-hidden className="size-3.5" />}>
      {t(e.etiqueta)}
    </Status>
  );
}

/** Texto "Ver detalle ↗" del pie de un ticket. */
export function VerDetalle() {
  const t = useT();
  return <span className="sn-label">{t("comun.ver_detalle")}</span>;
}

/** Esqueleto de carga estándar de las pantallas de Cliente (ADR-012). */
export function PantallaCargandoCliente({ filas = 4 }: { filas?: number }) {
  const t = useT();
  return (
    <div aria-busy="true" aria-label={t("comun.cargando_aria")} className="mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col bg-bg">
      <div className="p-top">
        <span className="w-2" />
        <span className="sn-skel h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="sn-skel h-36 w-full" />
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="sn-skel h-[60px] w-full" />
        ))}
      </div>
    </div>
  );
}
