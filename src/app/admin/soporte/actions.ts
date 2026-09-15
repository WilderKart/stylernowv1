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
  NO_AUTORIZADO: "No tenés permiso de SuperSU.",
  MENSAJE_REQUERIDO: "El mensaje no puede estar vacío.",
  TICKET_NO_ENCONTRADO: "No encontramos ese ticket.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export interface TicketAdmin {
  id: string;
  asunto: string;
  estado: string;
  negocioNombre: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listarTicketsAdmin(estado?: string): Promise<Resultado<TicketAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    let q = supabase
      .from("ticket_soporte")
      .select("id, asunto, estado, created_at, updated_at, negocio:negocio_id (nombre)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (estado) q = q.eq("estado", estado as "ABIERTO" | "EN_PROCESO" | "RESUELTO");
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((t) => ({
        id: t.id,
        asunto: t.asunto,
        estado: t.estado,
        negocioNombre: (t.negocio as unknown as { nombre: string } | null)?.nombre ?? null,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface MensajeTicketAdmin {
  id: string;
  autorId: string;
  actorTipo: string;
  mensaje: string;
  createdAt: string;
}

export async function obtenerHiloTicketAdmin(
  ticketId: string
): Promise<Resultado<{ ticket: TicketAdmin; mensajes: MensajeTicketAdmin[] }>> {
  try {
    const { supabase } = await usuarioActual();
    const [{ data: ticket, error: eTicket }, { data: mensajes, error: eMensajes }] = await Promise.all([
      supabase.from("ticket_soporte").select("id, asunto, estado, created_at, updated_at, negocio:negocio_id (nombre)").eq("id", ticketId).single(),
      supabase.from("ticket_mensaje").select("id, autor_id, actor_tipo, mensaje, created_at").eq("ticket_id", ticketId).order("created_at"),
    ]);
    if (eTicket) return { ok: false, error: eTicket.message };
    if (eMensajes) return { ok: false, error: eMensajes.message };
    return {
      ok: true,
      data: {
        ticket: {
          id: ticket.id,
          asunto: ticket.asunto,
          estado: ticket.estado,
          negocioNombre: (ticket.negocio as unknown as { nombre: string } | null)?.nombre ?? null,
          createdAt: ticket.created_at,
          updatedAt: ticket.updated_at,
        },
        mensajes: (mensajes ?? []).map((m) => ({ id: m.id, autorId: m.autor_id, actorTipo: m.actor_tipo, mensaje: m.mensaje, createdAt: m.created_at })),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function responderTicketAdmin(ticketId: string, mensaje: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("responder_ticket_soporte", { p_ticket_id: ticketId, p_mensaje: mensaje });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath(`/admin/soporte/${ticketId}`);
    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarEstadoTicket(ticketId: string, estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO"): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_estado_ticket", { p_ticket_id: ticketId, p_estado: estado });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath(`/admin/soporte/${ticketId}`);
    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
