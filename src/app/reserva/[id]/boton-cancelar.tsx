"use client";

import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelarReservaAction } from "./actions";

/**
 * Cancelación desde la Cliente PWA. Antes de ejecutar muestra cuánto se devuelve
 * según la ventana: nunca se cancela sin que el Cliente vea la consecuencia.
 */
export function BotonCancelar({
  reservaId,
  reembolsoEstimado,
  reembolsoPct,
}: {
  reservaId: string;
  reembolsoEstimado: number;
  reembolsoPct: number;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    setCargando(true);
    setError(null);
    const r = await cancelarReservaAction(reservaId);
    setCargando(false);

    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    router.refresh();
  }

  if (!confirmando) {
    return (
      <Button variant="ghost" size="sm" className="w-full" onClick={() => setConfirmando(true)}>
        Cancelar reserva
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-danger/40 bg-danger-soft p-4">
      <p className="text-[13px] font-semibold text-text">¿Cancelamos tu turno?</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
        {reembolsoPct === 0
          ? "Estás dentro de la ventana sin reembolso: la seña queda para el negocio por el espacio reservado."
          : `Te devolvemos ${formatCOP(reembolsoEstimado)} (${reembolsoPct}% de la seña) al mismo medio de pago.`}
      </p>

      {error ? <p className="mt-2 text-[12px] font-semibold text-danger">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => setConfirmando(false)}
          disabled={cargando}
        >
          No, mantener
        </Button>
        <Button variant="danger" size="sm" className="flex-1" loading={cargando} onClick={cancelar}>
          Sí, cancelar
        </Button>
      </div>
    </div>
  );
}
