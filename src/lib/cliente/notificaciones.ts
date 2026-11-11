import "server-only";
import { llamarRpc, type Resultado } from "./base";

/** C01 Notificaciones. Generadas por triggers de reserva y por el chat (ver migración 093/094). */
export type TipoNotificacion =
  | "CITA_CONFIRMADA"
  | "CITA_CANCELADA"
  | "CITA_REPROGRAMADA"
  | "CITA_RECORDATORIO"
  | "CALIFICAR_VISITA"
  | "CHAT_MENSAJE"
  | "OFERTA"
  | "SISTEMA";

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  /** Ya viene en el idioma del perfil (es/en). */
  titulo: string;
  cuerpo: string;
  reserva_id: string | null;
  negocio_id: string | null;
  leida: boolean;
  created_at: string;
}

export function listarNotificaciones(opts: { limite?: number; soloNoLeidas?: boolean } = {}): Promise<Resultado<Notificacion[]>> {
  return llamarRpc<Notificacion[]>("notificaciones_listar", {
    p_limite: opts.limite ?? 50,
    p_solo_no_leidas: opts.soloNoLeidas ?? false,
  });
}

export function contarNoLeidas(): Promise<Resultado<number>> {
  return llamarRpc<number>("notificaciones_no_leidas");
}

/** Devuelve true si cambió algo (false si ya estaba leída o no es suya). */
export function marcarNotificacionLeida(id: string): Promise<Resultado<boolean>> {
  return llamarRpc<boolean>("notificacion_marcar_leida", { p_id: id });
}

/** Devuelve cuántas marcó. */
export function marcarTodasLeidas(): Promise<Resultado<number>> {
  return llamarRpc<number>("notificaciones_marcar_todas_leidas");
}
