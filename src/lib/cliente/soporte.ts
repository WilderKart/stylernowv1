import "server-only";
import { llamarRpc, type Resultado } from "./base";

/** C13 Ayuda y soporte. Las FAQ son contenido estático de la UI (no hay tabla). */
export type CategoriaTicket = "CITA" | "PAGO" | "CUENTA" | "OTRO";

export interface TicketCreado {
  id: string;
  asunto: string;
  estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO";
  created_at: string;
}

/** «ENVIAR TICKET». `reservaId` opcional vincula el número de cita en el mensaje. Máx. 5 tickets / 24 h. */
export function crearTicket(categoria: CategoriaTicket, mensaje: string, reservaId?: string): Promise<Resultado<TicketCreado>> {
  return llamarRpc<TicketCreado>("cliente_crear_ticket", {
    p_categoria: categoria,
    p_mensaje: mensaje,
    ...(reservaId ? { p_reserva_id: reservaId } : {}),
  });
}

export interface TicketResumen {
  ticket_id: string;
  /** «#T-0192»-style: «#T-A3F9». */
  codigo: string;
  categoria: CategoriaTicket;
  asunto: string;
  estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO";
  created_at: string;
  updated_at: string;
}
export const listarTickets = (limite = 30): Promise<Resultado<TicketResumen[]>> => llamarRpc<TicketResumen[]>("cliente_listar_tickets", { p_limite: limite });

export interface MensajeTicket {
  id: string;
  actor_tipo: string;
  mensaje: string;
  es_mio: boolean;
  created_at: string;
}
export const mensajesTicket = (ticketId: string): Promise<Resultado<MensajeTicket[]>> => llamarRpc<MensajeTicket[]>("cliente_ticket_mensajes", { p_ticket_id: ticketId });

/** Responder en un ticket propio (RPC existente responder_ticket_soporte). */
export const responderTicket = (ticketId: string, mensaje: string): Promise<Resultado<unknown>> =>
  llamarRpc("responder_ticket_soporte", { p_ticket_id: ticketId, p_mensaje: mensaje });
