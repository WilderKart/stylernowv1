"use server";

import { obtenerEstadoSistema } from "@/lib/cliente/sistema";

export interface EstadoSistemaPublico {
  mantenimiento: boolean;
  versionMinima: string | null;
  versionActual: string | null;
}

/** Lectura pública y barata (una RPC). Ante cualquier fallo se asume "sin mantenimiento" para no bloquear la app. */
export async function consultarEstadoSistemaAction(): Promise<EstadoSistemaPublico> {
  const r = await obtenerEstadoSistema();
  if (!r.ok || !r.data) return { mantenimiento: false, versionMinima: null, versionActual: null };
  return {
    mantenimiento: r.data.mantenimiento === true,
    versionMinima: r.data.version_minima,
    versionActual: r.data.version_actual,
  };
}
