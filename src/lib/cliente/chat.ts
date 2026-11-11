import "server-only";
import { llamarRpc, type Resultado } from "./base";

/**
 * C04 Chat con el negocio. Un hilo por reserva; los mensajes son append-only.
 * Participantes: el cliente de la reserva y dueño/guardián/staff asignado del negocio.
 * Para refrescar usa polling sobre listarMensajes (no hay realtime habilitado).
 */
export interface MensajeChat {
  id: string;
  autor_rol: "CLIENTE" | "NEGOCIO";
  es_mio: boolean;
  cuerpo: string;
  created_at: string;
  /** Solo relevante en mis mensajes: el otro lado ya lo leyó («LEÍDO»). */
  leido_por_otro?: boolean;
}

/** Devuelve el mensaje creado. Errores: CHAT_CERRADO, DEMASIADOS_MENSAJES, MENSAJE_VACIO… */
export async function enviarMensaje(reservaId: string, cuerpo: string): Promise<Resultado<MensajeChat>> {
  const r = await llamarRpc<MensajeChat[]>("chat_enviar", { p_reserva_id: reservaId, p_cuerpo: cuerpo });
  if (!r.ok) return r;
  const m = r.data?.[0];
  return m ? { ok: true, data: m } : { ok: false, codigo: "ERROR", error: "Algo salió mal. Inténtalo de nuevo." };
}

/** Últimos mensajes en orden cronológico. `antes` (ISO) pagina hacia atrás. [] si aún no hay conversación. */
export function listarMensajes(reservaId: string, opts: { limite?: number; antes?: string } = {}): Promise<Resultado<MensajeChat[]>> {
  return llamarRpc<MensajeChat[]>("chat_listar", {
    p_reserva_id: reservaId,
    p_limite: opts.limite ?? 50,
    ...(opts.antes ? { p_antes: opts.antes } : {}),
  });
}

/** Marca el hilo como leído por mí (y sus notificaciones CHAT_MENSAJE). */
export function marcarChatLeido(reservaId: string): Promise<Resultado<boolean>> {
  return llamarRpc<boolean>("chat_marcar_leido", { p_reserva_id: reservaId });
}
