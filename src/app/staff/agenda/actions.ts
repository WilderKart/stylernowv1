"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa cita.",
  NO_AUTORIZADO: "Esa cita no es tuya.",
  RESERVA_NO_INICIABLE: "Solo puedes hacer check-in de una cita confirmada.",
  CHECKIN_SOLO_EL_DIA_DE_LA_CITA: "El check-in solo se puede hacer el día de la cita. Si el cliente te pidió moverla, usa «Reprogramar».",
  CLIENTE_DEBE_SOLICITARLO: "Solo puedes reprogramar si el cliente lo solicitó. Confírmalo para continuar.",
  HORARIO_NO_DISPONIBLE: "Ese horario ya no está disponible. Elige otro.",
  HORARIO_INVALIDO: "Elige un horario futuro.",
  RESERVA_NO_REAGENDABLE: "Esta cita ya no se puede reprogramar.",
  RESERVA_NO_FINALIZABLE: "Solo puedes hacer check-out de una cita en curso.",
  RESERVA_NO_COMPLETABLE: "Esta cita ya no se puede completar.",
  SUSCRIPCION_RESTRINGIDA: "La suscripción del negocio no permite completar esta acción.",
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

export async function completarCitaSinPos(reservaId: string): Promise<Resultado> {
  try {
    const id = z.string().uuid("Cita inválida.").parse(reservaId);
    const { supabase } = await usuarioActual();
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const { error } = await rpc("completar_reserva_sin_pos", { p_reserva_id: id });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/staff/agenda");
    revalidatePath("/panel/agenda");
    revalidatePath("/panel/lealtad");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducirError(e.message) : "Error inesperado." };
  }
}

export interface HorarioLibre {
  horaInicio: string;
  horaFin: string;
}

/** Horarios libres para mover una de MIS citas (mismo barbero y servicios). La base vuelve a validar quién puede. */
export async function listarHorariosParaReprogramar(reservaId: string, fecha: string): Promise<Resultado<HorarioLibre[]>> {
  try {
    const id = z.string().uuid().parse(reservaId);
    const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(fecha);
    const { supabase } = await usuarioActual();
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: { hora_inicio: string; hora_fin: string }[] | null; error: { message: string } | null }>;
    const { data, error } = await rpc("slots_para_reagendar", { p_reserva_id: id, p_fecha: dia });
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((x) => ({ horaInicio: x.hora_inicio, horaFin: x.hora_fin })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducirError(e.message) : "Error inesperado." };
  }
}

/**
 * El barbero mueve la cita SOLO porque el cliente lo pidió (clienteSolicito debe ser true: queda en auditoría).
 * La agenda se actualiza al instante y se le avisa al cliente.
 */
export async function reprogramarCitaPorSolicitudDelCliente(reservaId: string, horaISO: string, clienteSolicito: boolean): Promise<Resultado> {
  try {
    const id = z.string().uuid().parse(reservaId);
    if (!clienteSolicito) return { ok: false, error: traducirError("CLIENTE_DEBE_SOLICITARLO") };
    const hora = z.string().datetime({ offset: true }).parse(horaISO);
    const { supabase } = await usuarioActual();
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const { error } = await rpc("reagendar_reserva", { p_reserva_id: id, p_nuevo_inicio: hora, p_cliente_solicito: true });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/staff/agenda");
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducirError(e.message) : "Error inesperado." };
  }
}
