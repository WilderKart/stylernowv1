"use client";

import { useSyncExternalStore } from "react";

/** Estado de conectividad real del navegador — para mostrar un estado "sin
 * conexión" honesto en pantallas que dependen de datos frescos del servidor
 * (listados con búsqueda/filtro en vivo), en vez de fallar en silencio.
 *
 * Implementado con useSyncExternalStore: en el servidor (y en la hidratación) siempre devuelve
 * `true`. Antes el estado inicial se calculaba con `typeof navigator === "undefined"`, pero desde
 * Node 21 `navigator` existe en el servidor y NO tiene `onLine` (undefined): el servidor pintaba el
 * aviso "sin conexión" en todas las páginas dinámicas aunque el usuario estuviera conectado. */
function suscribir(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

export function useEnLinea() {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine !== false, // solo "sin conexión" cuando el navegador lo afirma explícitamente
    () => true,
  );
}
