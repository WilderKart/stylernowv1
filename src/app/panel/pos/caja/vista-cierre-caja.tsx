"use client";

import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { obtenerCierreCaja, type CierreCaja } from "../actions";

export function VistaCierreCaja({
  negocioId,
  sedeId,
  cierreInicial,
  errorInicial,
}: {
  negocioId: string;
  sedeId: string | null;
  cierreInicial: CierreCaja | null;
  errorInicial: string | null;
}) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [fecha, setFecha] = useState(hoy);
  const [cierre, setCierre] = useState(cierreInicial);
  const [error, setError] = useState(errorInicial);
  const [cargando, setCargando] = useState(false);

  async function onCambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    setCargando(true);
    setError(null);
    const res = await obtenerCierreCaja(negocioId, sedeId, nuevaFecha);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setCierre(res.data);
  }

  return (
    <div>
      <input
        type="date"
        value={fecha}
        max={hoy}
        onChange={(e) => onCambiarFecha(e.target.value)}
        className="mb-5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-[13.5px] text-text"
      />

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : cierre ? (
        <div className="flex flex-col gap-3">
          <Card>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Efectivo</p>
            <p className="mt-1 text-[20px] font-bold text-text">{formatCOP(cierre.efectivo)}</p>
          </Card>
          <Card>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Digital (datáfono + Mercado Pago)</p>
            <p className="mt-1 text-[20px] font-bold text-text">{formatCOP(cierre.digital)}</p>
          </Card>
          <Card className="border-accent/30 bg-accent-soft">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-accent">Total del día</p>
            <p className="mt-1 text-[22px] font-bold text-text">{formatCOP(cierre.total)}</p>
          </Card>
          <p className="text-[11px] text-text-faint">
            Incluye Señas, Saldos y Propinas cobrados y aprobados ese día — nunca ajusta discrepancias
            automáticamente, solo muestra lo que quedó registrado.
          </p>
        </div>
      ) : null}
    </div>
  );
}
