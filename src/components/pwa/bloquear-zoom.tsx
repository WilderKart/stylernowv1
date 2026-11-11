"use client";

import { useEffect } from "react";

/**
 * Comportamiento de app móvil: el pellizco (pinch) y el doble toque no deben hacer zoom de la página
 * ni "abrirla" dejando ver contenido fuera de los bordes. Android/Chrome respetan `touch-action` y el
 * viewport; iOS Safari ignora `user-scalable=no` por accesibilidad, así que además se cancelan sus
 * eventos de gesto. Las zonas con su propio zoom (el mapa) manejan el pellizco con sus propios eventos
 * táctiles y no se ven afectadas.
 */
export function BloquearZoom() {
  useEffect(() => {
    const cancelar = (e: Event) => e.preventDefault();
    const cancelarPellizco = (e: TouchEvent) => {
      // `scale` solo existe en Safari iOS; en otros navegadores basta con touch-action.
      const escala = (e as TouchEvent & { scale?: number }).scale;
      if ((typeof escala === "number" && escala !== 1) || e.touches.length > 1) {
        const destino = e.target as HTMLElement | null;
        if (destino?.closest?.(".maplibregl-map")) return; // el mapa gestiona su propio zoom
        e.preventDefault();
      }
    };

    document.addEventListener("gesturestart", cancelar);
    document.addEventListener("gesturechange", cancelar);
    document.addEventListener("gestureend", cancelar);
    document.addEventListener("touchmove", cancelarPellizco, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", cancelar);
      document.removeEventListener("gesturechange", cancelar);
      document.removeEventListener("gestureend", cancelar);
      document.removeEventListener("touchmove", cancelarPellizco);
    };
  }, []);

  return null;
}
