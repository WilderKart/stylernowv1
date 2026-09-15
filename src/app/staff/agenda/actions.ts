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
  RESERVA_NO_ENCONTRADA: "No encontramos esa cita.",
  NO_AUTORIZADO: "Esa cita no es tuya.",
  RESERVA_NO_INICIABLE: "Solo podés hacer check-in de una cita confirmada.",
  RESERVA_NO_FINALIZABLE: "Solo podés hacer check-out de una cita en curso.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export interface CitaStaff {
  id: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  montoTotal: number;
  servicios: string;
  checkinAt: string | null;
  checkoutAt: string | null;
}

export async function listarMisCitas(desdeISO: string, hastaISO: string): Promise<Resultado<CitaStaff[]>> {
  try {
    const { supabase, userId } = await usuarioActual();
    const { data, error } = await supabase
      .from("reserva")
      .select(
        `id, estado, hora_inicio, hora_fin, monto_total, checkin_at, checkout_at,
         cliente:cliente_id (nombre, telefono),
         reserva_servicio (servicio:servicio_id (nombre))`
      )
      .eq("staff_id", userId)
      .neq("estado", "CANCELADA")
      .gte("hora_inicio", desdeISO)
      .lt("hora_inicio", hastaISO)
      .order("hora_inicio", { ascending: true });
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      data: (data ?? []).map((r) => {
        const cliente = r.cliente as unknown as { nombre: string; telefono: string | null } | null;
        return {
          id: r.id,
          horaInicio: r.hora_inicio,
          horaFin: r.hora_fin,
          estado: r.estado,
          clienteNombre: cliente?.nombre ?? "Cliente",
          clienteTelefono: cliente?.telefono ?? null,
          montoTotal: r.monto_total,
          servicios: (r.reserva_servicio ?? [])
            .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
            .filter(Boolean)
            .join(" + "),
          checkinAt: r.checkin_at,
          checkoutAt: r.checkout_at,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function hacerCheckIn(reservaId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("iniciar_atencion_reserva", { p_reserva_id: reservaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/staff/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function hacerCheckOut(reservaId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("finalizar_atencion_reserva", { p_reserva_id: reservaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/staff/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
