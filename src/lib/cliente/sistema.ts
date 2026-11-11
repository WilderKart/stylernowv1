import "server-only";
import { llamarRpc, type Resultado } from "./base";

/** C16 Estados del sistema (mantenimiento / nueva versión). Lectura pública (también anónima). */
export interface EstadoSistema {
  mantenimiento: boolean;
  inicio: string | null;
  fin_estimado: string | null;
  mensaje: string | null;
  version_actual: string | null;
  /** Si la versión del cliente es menor → mostrar «Nueva versión». */
  version_minima: string | null;
  /** Hora del servidor. */
  ahora: string;
}

export async function obtenerEstadoSistema(): Promise<Resultado<EstadoSistema | null>> {
  const r = await llamarRpc<EstadoSistema[]>("estado_sistema");
  if (!r.ok) return r;
  return { ok: true, data: r.data[0] ?? null };
}

/** Solo SuperSU (el RPC valida es_supersu): activa/desactiva mantenimiento y fija versiones. */
export function configurarSistema(p: {
  mantenimiento: boolean;
  inicio?: string;
  finEstimado?: string;
  mensaje?: string;
  versionActual?: string;
  versionMinima?: string;
}): Promise<Resultado<null>> {
  return llamarRpc<null>("supersu_configurar_sistema", {
    p_mantenimiento: p.mantenimiento,
    ...(p.inicio ? { p_inicio: p.inicio } : {}),
    ...(p.finEstimado ? { p_fin_estimado: p.finEstimado } : {}),
    ...(p.mensaje ? { p_mensaje: p.mensaje } : {}),
    ...(p.versionActual ? { p_version_actual: p.versionActual } : {}),
    ...(p.versionMinima ? { p_version_minima: p.versionMinima } : {}),
  });
}
