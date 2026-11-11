"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { useState, useTransition } from "react";
import { pedirDevolucion } from "./actions";

export function BotonDevolucion({ deshabilitado, montoTexto }: { deshabilitado: boolean; montoTexto: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const r = await pedirDevolucion();
      if (r.ok) {
        setListo(true);
        setConfirmando(false);
      } else {
        setError(r.error);
      }
    });
  }

  if (listo) {
    return (
      <p role="status" className="sn-meta break-words">
        Solicitud enviada. Te avisaremos cuando se procese tu devolución.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {confirmando ? (
        <>
          <p className="body-sm break-words">
            ¿Pedir la devolución de <b>{montoTexto}</b> a tu medio de pago?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={confirmar} disabled={pendiente} className={`sn-btn sn-btn--ink ${pendiente ? "is-loading" : ""}`}>
              <span className="sn-btn__txt">Confirmar</span>
            </button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={pendiente} className="sn-btn sn-btn--secondary">
              <span>Cancelar</span>
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} disabled={deshabilitado} className="sn-btn sn-btn--secondary">
          <span>Pedir devolución</span>
        </button>
      )}
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
