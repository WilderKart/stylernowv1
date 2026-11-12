"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/proveedor";

/** Pide la ubicación al navegador (solo para calcular distancias) y recarga la lista con lat/lng. */
export function UsarUbicacion() {
  const router = useRouter();
  const t = useT();
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pedir() {
    if (!navigator.geolocation) {
      setError(t("of.sin_ubic"));
      return;
    }
    setBuscando(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscando(false);
        router.push(`/ofertas?lat=${pos.coords.latitude.toFixed(4)}&lng=${pos.coords.longitude.toFixed(4)}`);
      },
      () => {
        setBuscando(false);
        setError(t("of.err_ubic"));
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <button type="button" onClick={pedir} disabled={buscando} className={`sn-btn sn-btn--secondary sn-btn--block ${buscando ? "is-loading" : ""}`}>
        <span className="sn-btn__txt">{t("of.usar_ubic")}</span>
        <span aria-hidden>↗</span>
      </button>
      {error ? <ErrorAviso>{error}</ErrorAviso> : null}
    </div>
  );
}
