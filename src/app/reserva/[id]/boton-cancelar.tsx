"use client";

import { ErrorAviso, Fila } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { X } from "lucide-react";
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
      <Fila
        icono={<X aria-hidden className="size-5" />}
        titulo="Cancelar cita"
        meta={
          reembolsoPct === 0
            ? "Sin reembolso de la seña en este momento"
            : `Te devolvemos ${formatCOP(reembolsoEstimado)} si cancelas ahora`
        }
        peligro
        onClick={() => setConfirmando(true)}
      />
    );
  }

  return (
    <div className="m-4 border-2 border-danger p-4 shadow-hard">
      <h3 className="section">¿Cancelamos tu turno?</h3>
      <p className="body-sm mt-2 break-words">
        {reembolsoPct === 0
          ? "Estás dentro de la ventana sin reembolso: la seña queda para el negocio por el espacio reservado."
          : `Te devolvemos ${formatCOP(reembolsoEstimado)} (${reembolsoPct}% de la seña) al mismo medio de pago.`}
      </p>

      {error ? (
        <div className="mt-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" className="min-w-0 flex-1" onClick={() => setConfirmando(false)} disabled={cargando}>
          No, mantener
        </Button>
        <Button variant="danger" className="min-w-0 flex-1" loading={cargando} onClick={cancelar}>
          Sí, cancelar
        </Button>
      </div>
    </div>
  );
}
