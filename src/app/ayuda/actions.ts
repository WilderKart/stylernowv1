"use server";

import { crearTicket, responderTicket, type CategoriaTicket } from "@/lib/cliente/soporte";
import { revalidatePath } from "next/cache";

const CATEGORIAS: CategoriaTicket[] = ["CITA", "PAGO", "CUENTA", "OTRO"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Res = { ok: true; codigo?: string } | { ok: false; error: string };

/** «ENVIAR TICKET». La identidad sale de la sesión en servidor (RPC con auth.uid()). */
export async function crearTicketAccion(categoria: string, mensaje: string): Promise<Res> {
  if (!CATEGORIAS.includes(categoria as CategoriaTicket)) return { ok: false, error: "Elige un tema válido." };
  const texto = (mensaje ?? "").trim();
  if (texto.length < 5) return { ok: false, error: "Cuéntanos qué pasó (mínimo 5 caracteres)." };
  if (texto.length > 2000) return { ok: false, error: "El mensaje es demasiado largo." };
  const r = await crearTicket(categoria as CategoriaTicket, texto);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/ayuda");
  return { ok: true, codigo: `#T-${r.data.id.replace(/-/g, "").slice(0, 4).toUpperCase()}` };
}

export async function responderTicketAccion(ticketId: string, mensaje: string): Promise<Res> {
  if (!UUID.test(ticketId)) return { ok: false, error: "No encontramos ese ticket." };
  const texto = (mensaje ?? "").trim();
  if (!texto) return { ok: false, error: "Escribe un mensaje." };
  if (texto.length > 2000) return { ok: false, error: "El mensaje es demasiado largo." };
  const r = await responderTicket(ticketId, texto);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/ayuda/ticket/${ticketId}`);
  revalidatePath("/ayuda");
  return { ok: true };
}
