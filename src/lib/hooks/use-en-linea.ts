"use client";

import { useEffect, useState } from "react";

/** Estado de conectividad real del navegador — para mostrar un estado "sin
 * conexión" honesto en pantallas que dependen de datos frescos del servidor
 * (listados con búsqueda/filtro en vivo), en vez de fallar en silencio. */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setEnLinea(true);
    const onOffline = () => setEnLinea(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return enLinea;
}
