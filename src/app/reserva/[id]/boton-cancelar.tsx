"use client";

import { ErrorAviso, Fila } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO } from "@/lib/pagos-directos/aviso";
import type { Devolucion } from "@/lib/pagos/devolucion";
import { textoDevolucion } from "@/lib/pagos/devolucion-texto";
import { formatCOP } from "@/lib/utils";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelarReservaAction } from "./actions";
import { useT } from "@/lib/i18n/proveedor";

/**
 * Cancelación desde la Cliente PWA. Antes de ejecutar muestra cuánto se devuelve
 * según la ventana: nunca se cancela sin que el Cliente vea la consecuencia.
 */
export function BotonCancelar({
  reservaId,
  devolucion,
  pagoDirecto = false,
  sinAnticipo = false,
}: {
  reservaId: string;
  /** Cuánto se devuelve si cancela ahora (anticipo según la política + excedente del servicio, si pagó el total). */
  devolucion: Devolucion;
  /** Anticipo transferido directo al comercio: StylerNow no reembolsa, se muestra el aviso en vez de un monto. */
  pagoDirecto?: boolean;
  /** La reserva no tiene anticipo: no hay nada que devolver y se cancela sin cargo. */
  sinAnticipo?: boolean;
}) {
  const router = useRouter();
  const t = useT();
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
        titulo={t("canc.cancelar_cita")}
        meta={
          pagoDirecto
            ? devolucion.monto > 0
              ? t("canc.devolvemos_meta", { monto: formatCOP(devolucion.monto) }) + " (a cargo del negocio)"
              : "Anticipo pagado directo al comercio: sin reembolso de StylerNow"
            : sinAnticipo
            ? "Sin anticipo: puedes cancelar sin ningún cargo"
            : devolucion.monto <= 0
            ? t("canc.sin_reembolso_meta")
            : t("canc.devolvemos_meta", { monto: formatCOP(devolucion.monto) })
        }
        peligro
        onClick={() => setConfirmando(true)}
      />
    );
  }

  return (
    <div className="m-4 border-2 border-danger p-4 shadow-hard">
      <h3 className="section">{t("canc.cancelamos")}</h3>
      <p className="body-sm mt-2 break-words">
        {pagoDirecto
          ? devolucion.monto > 0
            ? t("devol.directo", { pagado: formatCOP(devolucion.anticipo + devolucion.exceso), monto: formatCOP(devolucion.monto) })
            : AVISO_PAGO_DIRECTO_SIN_REEMBOLSO
          : textoDevolucion(t, devolucion, "cancelar")}
      </p>

      {error ? (
        <div className="mt-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" className="min-w-0 flex-1" onClick={() => setConfirmando(false)} disabled={cargando}>
          {t("canc.no_mantener")}
        </Button>
        <Button variant="danger" className="min-w-0 flex-1" loading={cargando} onClick={cancelar}>
          {t("canc.si_cancelar")}
        </Button>
      </div>
    </div>
  );
}
