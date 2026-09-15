"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

const MENSAJES_ERROR: Record<string, string> = {
  ASUNTO_REQUERIDO: "Escribí un asunto para tu ticket.",
  MENSAJE_REQUERIDO: "El mensaje no puede estar vacío.",
  TICKET_NO_ENCONTRADO: "No encontramos ese ticket.",
  NO_AUTORIZADO: "No tenés permiso sobre ese ticket.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export interface TicketResumen {
  id: string;
  asunto: string;
  estado: string;
  createdAt: string;
  updatedAt: string;
}

export async function listarMisTickets(): Promise<Resultado<TicketResumen[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("ticket_soporte")
      .select("id, asunto, estado, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((t) => ({ id: t.id, asunto: t.asunto, estado: t.estado, createdAt: t.created_at, updatedAt: t.updated_at })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface MensajeTicket {
  id: string;
  autorId: string;
  actorTipo: string;
  mensaje: string;
  createdAt: string;
}

export async function obtenerHiloTicket(ticketId: string): Promise<Resultado<{ ticket: TicketResumen; mensajes: MensajeTicket[] }>> {
  try {
    const { supabase } = await usuarioActual();
    const [{ data: ticket, error: eTicket }, { data: mensajes, error: eMensajes }] = await Promise.all([
      supabase.from("ticket_soporte").select("id, asunto, estado, created_at, updated_at").eq("id", ticketId).single(),
      supabase.from("ticket_mensaje").select("id, autor_id, actor_tipo, mensaje, created_at").eq("ticket_id", ticketId).order("created_at"),
    ]);
    if (eTicket) return { ok: false, error: eTicket.message };
    if (eMensajes) return { ok: false, error: eMensajes.message };
    return {
      ok: true,
      data: {
        ticket: { id: ticket.id, asunto: ticket.asunto, estado: ticket.estado, createdAt: ticket.created_at, updatedAt: ticket.updated_at },
        mensajes: (mensajes ?? []).map((m) => ({ id: m.id, autorId: m.autor_id, actorTipo: m.actor_tipo, mensaje: m.mensaje, createdAt: m.created_at })),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearTicket(asunto: string, mensaje: string, negocioId: string | null): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("crear_ticket_soporte", {
      p_asunto: asunto,
      p_mensaje: mensaje,
      p_negocio_id: negocioId ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/soporte");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function responderTicket(ticketId: string, mensaje: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("responder_ticket_soporte", { p_ticket_id: ticketId, p_mensaje: mensaje });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath(`/panel/soporte/${ticketId}`);
    revalidatePath("/panel/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
