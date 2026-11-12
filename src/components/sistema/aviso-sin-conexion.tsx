"use client";

import { useEnLinea } from "@/lib/hooks/use-en-linea";
import { WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n/proveedor";

/**
 * Aviso de "sin conexión" (C16). Es una franja fija y no una pantalla completa: así las pantallas
 * que el service worker sí tiene en caché siguen siendo legibles.
 */
export function AvisoSinConexion() {
  const enLinea = useEnLinea();
  const t = useT();
  if (enLinea) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[90] flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-warning px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-ink"
    >
      <span className="sn-label flex items-center gap-2">
        <WifiOff aria-hidden className="size-4" /> {t("off.sin_conexion")}
      </span>
      <span className="body-sm min-w-0 flex-1">{t("off.txt")}</span>
      <button type="button" onClick={() => window.location.reload()} className="sn-label min-h-12 cursor-pointer px-2 underline">
        {t("off.reintentar")}
      </button>
    </div>
  );
}
