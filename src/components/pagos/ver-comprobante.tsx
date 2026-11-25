"use client";

import { obtenerPagoDeReserva, type PagoDeReserva } from "@/lib/pagos-directos/comprobante-actions";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";

const ETIQUETA: Record<PagoDeReserva["estado"], string> = {
  REPORTADO: "Pago reportado (en revisión)",
  VERIFICADO: "Pago verificado",
  RECHAZADO: "Pago no recibido",
};

/** Foto del comprobante en SOLO LECTURA (sin aprobar, rechazar ni modificar nada). */
export function VerComprobante({ reservaId }: { reservaId: string }) {
  const [pago, setPago] = useState<PagoDeReserva | null | undefined>(undefined);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  async function abrir() {
    setAbierto((v) => !v);
    if (pago !== undefined) return;
    setCargando(true);
    setPago(await obtenerPagoDeReserva(reservaId));
    setCargando(false);
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={abrir} className="font-mono text-[10.5px] font-bold uppercase text-text-muted underline" aria-expanded={abierto}>
        {abierto ? "Ocultar comprobante" : "Ver comprobante del anticipo"}
      </button>
      {abierto ? (
        <div className="mt-2 border-2 border-border p-2 text-[12px] text-text">
          {cargando ? <p>Cargando…</p> : null}
          {pago === null ? <p>Esta cita no tiene un comprobante de pago directo.</p> : null}
          {pago ? (
            <>
              <p className="font-bold">
                {ETIQUETA[pago.estado]} · {formatCOP(pago.montoReportado)}
                {pago.referencia ? ` · ${pago.referencia}` : ""}
              </p>
              {pago.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- comprobante privado con URL firmada temporal
                <img src={pago.url} alt="Comprobante de pago" className="mt-2 max-h-80 w-full object-contain" />
              ) : (
                <p className="mt-1 text-text-muted">No se pudo cargar la imagen.</p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
