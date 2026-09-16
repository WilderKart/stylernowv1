"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre esta Membresía.",
  TRANSICION_INVALIDA: "Esa acción no es posible en el estado actual de tu Membresía.",
  DIAS_CONGELACION_INVALIDOS: "Ese número de días de congelación no está permitido por este plan.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export async function cancelarMiMembresia(id: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_membresia", { p_cliente_membresia_id: id });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath(`/membresias/${id}`);
  return { ok: true };
}

export async function congelarMiMembresia(id: string, dias: 7 | 15 | 30): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("congelar_membresia", { p_cliente_membresia_id: id, p_dias: dias });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath(`/membresias/${id}`);
  return { ok: true };
}

export async function reactivarMiMembresia(id: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivar_membresia_congelada", { p_cliente_membresia_id: id });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath(`/membresias/${id}`);
  return { ok: true };
}
