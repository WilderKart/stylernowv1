"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * Recuperación de una reserva cuyo bloqueo temporal expiró (migración 205). Todo se decide en la base de datos, con la identidad de la sesión:
 * aquí solo se reenvía la intención del cliente y se traduce el resultado a mensajes sin tecnicismos. La re-adquisición del turno es atómica
 * (restricciones EXCLUDE de la tabla de reservas), no una consulta seguida de una escritura.
 */
export type ResultadoRecuperar =
  | { ok: true; resultado: "RECUPERADA" | "VIGENTE" | "YA_CONFIRMADA"; estado: string | null }
  | { ok: false; codigo: "NO_DISPONIBLE" | "NO_RECUPERABLE" | "ERROR"; mensaje: string };

export interface HorarioAlternativo {
  horaInicio: string;
  staffId: string | null;
  staffNombre: string | null;
}

type Rpc = (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
const uuid = z.string().uuid();

export async function recuperarReserva(reservaId: string, nuevaHora?: string, nuevoStaff?: string): Promise<ResultadoRecuperar> {
  const p = z
    .object({ reservaId: uuid, nuevaHora: z.string().datetime({ offset: true }).optional(), nuevoStaff: uuid.optional() })
    .safeParse({ reservaId, nuevaHora, nuevoStaff });
  if (!p.success) return { ok: false, codigo: "ERROR", mensaje: "No pudimos revisar tu reserva. Intenta de nuevo." };

  const supabase = (await createClient()) as unknown as { rpc: Rpc; auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, codigo: "ERROR", mensaje: "Inicia sesión para continuar." };

  const { data, error } = await supabase.rpc("reserva_recuperar", {
    p_reserva_id: p.data.reservaId,
    p_nueva_hora: p.data.nuevaHora ?? null,
    p_nuevo_staff: p.data.nuevoStaff ?? null,
  });
  if (error) return { ok: false, codigo: "ERROR", mensaje: "No pudimos revisar tu reserva. Intenta de nuevo." };

  const r = data as { resultado?: string; estado?: string } | null;
  switch (r?.resultado) {
    case "RECUPERADA":
    case "VIGENTE":
    case "YA_CONFIRMADA":
      return { ok: true, resultado: r.resultado, estado: r.estado ?? null };
    case "NO_DISPONIBLE":
      return { ok: false, codigo: "NO_DISPONIBLE", mensaje: "Ese horario ya no está disponible. Elige otro." };
    case "NO_RECUPERABLE":
      return { ok: false, codigo: "NO_RECUPERABLE", mensaje: "Esta reserva ya no se puede retomar." };
    default:
      return { ok: false, codigo: "ERROR", mensaje: "No pudimos revisar tu reserva. Intenta de nuevo." };
  }
}

export async function alternativasReserva(reservaId: string): Promise<{ ok: true; horarios: HorarioAlternativo[] } | { ok: false; mensaje: string }> {
  if (!uuid.safeParse(reservaId).success) return { ok: false, mensaje: "No pudimos cargar los horarios." };
  const supabase = (await createClient()) as unknown as { rpc: Rpc };
  const { data, error } = await supabase.rpc("reserva_alternativas", { p_reserva_id: reservaId, p_dias: 5 });
  if (error) return { ok: false, mensaje: "No pudimos cargar los horarios. Intenta de nuevo." };
  const filas = (data ?? []) as Array<{ hora_inicio: string; staff_id: string | null; staff_nombre: string | null }>;
  return { ok: true, horarios: filas.map((f) => ({ horaInicio: f.hora_inicio, staffId: f.staff_id, staffNombre: f.staff_nombre })) };
}
