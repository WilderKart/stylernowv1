"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Cumplimiento de citas ya confirmadas con la suscripción restringida (migración 164).
 * Solo se llaman RPC que la base permite sobre citas PREVIAS: completar en caja SIN productos, no-show y cancelar. La autorización real
 * (dueño/Guardian de ESE negocio y de esa sede) la decide cada RPC; aquí no se recibe ni se confía en ningún negocio_id del navegador.
 */

type Resultado = { ok: true } | { ok: false; error: string };

const MENSAJES: Record<string, string> = {
  SUSCRIPCION_RESTRINGIDA: "Con la suscripción restringida no se pueden agregar productos ni operaciones nuevas a la cita.",
  NO_AUTORIZADO: "No tienes permiso sobre esta cita.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa cita.",
};

function traducir(mensaje: string): string {
  const clave = Object.keys(MENSAJES).find((k) => mensaje.includes(k));
  return clave ? MENSAJES[clave] : mensaje;
}

async function ejecutar(
  rpc: "completar_venta_pos" | "marcar_no_show" | "cancelar_reserva",
  reservaId: string,
  motivo?: string
): Promise<Resultado> {
  if (typeof reservaId !== "string" || reservaId.length < 30) return { ok: false, error: "Cita inválida." };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Inicia sesión de nuevo." };
    const { error } =
      rpc === "completar_venta_pos"
        ? await supabase.rpc("completar_venta_pos", { p_reserva_id: reservaId })
        : rpc === "marcar_no_show"
          ? await supabase.rpc("marcar_no_show", { p_reserva_id: reservaId, p_motivo: motivo ?? "El cliente no se presentó" })
          : await supabase.rpc("cancelar_reserva", { p_reserva_id: reservaId, p_motivo: motivo ?? "Cancelada por el negocio" });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel/cumplimiento");
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Cobra la cita en efectivo, sin productos, y la deja COMPLETADA (la atención la finaliza el profesional desde su agenda). */
export async function completarCitaPrevia(reservaId: string): Promise<Resultado> {
  return ejecutar("completar_venta_pos", reservaId);
}

export async function marcarNoShowCitaPrevia(reservaId: string): Promise<Resultado> {
  return ejecutar("marcar_no_show", reservaId, "El cliente no se presentó");
}

export async function cancelarCitaPrevia(reservaId: string): Promise<Resultado> {
  return ejecutar("cancelar_reserva", reservaId, "Cancelada por el negocio (suscripción restringida)");
}
