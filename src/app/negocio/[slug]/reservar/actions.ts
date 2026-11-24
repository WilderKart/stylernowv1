"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Acciones del flujo de Reserva (05-API/03_Bookings.md).
 *
 * Ninguna recibe precios ni duraciones: la RPC `crear_reserva` los recalcula desde la
 * base con la identidad de `auth.uid()`. Lo único que viaja es qué se quiere reservar.
 * Desde la migración 143 se reserva con `crear_reserva_autorizada`, que exige la autorización de
 * datos y guarda su evidencia en la MISMA transacción (y `crear_reserva` ya no es invocable directo).
 */

export type ResultadoReserva =
  | { ok: true; reservaId: string }
  | { ok: false; codigo: "SLOT_NO_DISPONIBLE" | "NO_AUTENTICADO" | "AUTORIZACION_DATOS" | "ERROR"; mensaje: string };

/** Traduce el mensaje de la excepción de plpgsql al código de dominio de la API. */
function codigoDeError(mensaje: string) {
  if (mensaje.includes("SLOT_NO_DISPONIBLE")) return "SLOT_NO_DISPONIBLE" as const;
  if (mensaje.includes("NO_AUTENTICADO")) return "NO_AUTENTICADO" as const;
  if (mensaje.includes("AUTORIZACION_DATOS_REQUERIDA")) return "AUTORIZACION_DATOS" as const;
  return "ERROR" as const;
}

export interface Slot {
  hora_inicio: string;
  hora_fin: string;
  staff_id: string | null;
  recurso_id: string | null;
  disponible: boolean;
}

export async function obtenerSlots(args: {
  sedeId: string;
  servicioIds: string[];
  fecha: string;
  staffId: string | null;
}): Promise<Slot[]> {
  if (args.servicioIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slots_disponibles", {
    p_sede_id: args.sedeId,
    p_servicio_ids: args.servicioIds,
    p_fecha: args.fecha,
    p_staff_id: args.staffId ?? undefined,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearReservaAction(args: {
  sedeId: string;
  servicioIds: string[];
  horaInicio: string;
  staffId: string | null;
  idempotencyKey: string;
  autorizaDatos: boolean;
}): Promise<ResultadoReserva> {
  // Aviso temprano; la base vuelve a exigirlo (AUTORIZACION_DATOS_REQUERIDA) aunque se salte esta acción.
  if (args.autorizaDatos !== true) {
    return { ok: false, codigo: "AUTORIZACION_DATOS", mensaje: "Para reservar debes autorizar el uso de tus datos para esta cita." };
  }
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("crear_reserva_autorizada", {
    p_sede_id: args.sedeId,
    p_servicio_ids: args.servicioIds,
    p_hora_inicio: args.horaInicio,
    p_staff_id: args.staffId ?? undefined,
    p_idempotency_key: args.idempotencyKey,
    p_autoriza_datos: true,
  });

  if (error) {
    const codigo = codigoDeError(error.message);
    return {
      ok: false,
      codigo,
      mensaje:
        codigo === "SLOT_NO_DISPONIBLE"
          ? "Ese horario acaba de ocuparse. Elige otro, ya actualizamos la lista."
          : codigo === "NO_AUTENTICADO"
            ? "Tu sesión expiró. Vuelve a iniciar sesión para reservar."
            : codigo === "AUTORIZACION_DATOS"
              ? "Para reservar debes autorizar el uso de tus datos para esta cita."
              : error.message,
    };
  }

  if (!data) return { ok: false, codigo: "ERROR", mensaje: "No se pudo crear la reserva." };
  return { ok: true, reservaId: data.id };
}

/** 03-Business-Rules/10_Waitlist_System.md — se ofrece siempre que no hay cupo visible. */
export async function unirseListaEspera(args: {
  negocioId: string;
  sedeId: string;
  servicioIds: string[];
  staffId: string | null;
  fecha: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, mensaje: "Inicia sesión para unirte a la lista de espera." };

  const { error } = await supabase.from("lista_espera").insert({
    cliente_id: user.id,
    negocio_id: args.negocioId,
    sede_id: args.sedeId,
    servicio_ids: args.servicioIds,
    staff_id: args.staffId,
    fecha_deseada_inicio: args.fecha,
    fecha_deseada_fin: args.fecha,
  });

  // 23505 = ya estás en la lista para esa fecha/servicios (índice único, migración 190): es un éxito idempotente.
  if (error && error.code !== "23505") return { ok: false, mensaje: "No pudimos anotarte en la lista de espera. Intenta de nuevo." };
  return { ok: true, mensaje: "Listo. Te avisamos apenas se libere un cupo ese día." };
}
