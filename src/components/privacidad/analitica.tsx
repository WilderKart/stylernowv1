"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect, useState } from "react";

const CLAVE = "stylernow_cookies_v1";

/**
 * Analítica de Vercel (visitas y rendimiento web) SOLO si la persona aceptó las cookies de analítica en el banner.
 * Sin elección o con «solo necesarias» no se carga nada. Escucha el evento que dispara el banner al elegir.
 */
export function AnaliticaConsentida() {
  const [permitida, setPermitida] = useState(false);

  useEffect(() => {
    const leer = () => {
      try {
        const v = localStorage.getItem(CLAVE);
        setPermitida(v ? JSON.parse(v).analitica === true : false);
      } catch {
        setPermitida(false);
      }
    };
    leer();
    window.addEventListener("stylernow:cookies", leer);
    return () => window.removeEventListener("stylernow:cookies", leer);
  }, []);

  if (!permitida) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
