"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { useState, useTransition } from "react";
import { pedirDevolucion } from "./actions";
import { useT } from "@/lib/i18n/proveedor";

export function BotonDevolucion({ deshabilitado, montoTexto }: { deshabilitado: boolean; montoTexto: string }) {
  const t = useT();
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
        {t("pg.solicitud_enviada")}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {confirmando ? (
        <>
          <p className="body-sm break-words">
            {t("pg.pedir_confirm", { monto: montoTexto })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={confirmar} disabled={pendiente} className={`sn-btn sn-btn--ink ${pendiente ? "is-loading" : ""}`}>
              <span className="sn-btn__txt">{t("pg.confirmar")}</span>
            </button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={pendiente} className="sn-btn sn-btn--secondary">
              <span>{t("comun.cancelar")}</span>
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} disabled={deshabilitado} className="sn-btn sn-btn--secondary">
          <span>{t("pg.pedir")}</span>
        </button>
      )}
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
