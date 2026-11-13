"use server";

import { procesarReembolsosSinFallar } from "@/lib/pagos/reembolsos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ResultadoCancelacion =
  | {
      ok: true;
      reembolsoMonto: number;
      reembolsoPct: number;
      /** CONFIRMADA solo cuando la pasarela confirmó; EN_CURSO = solicitada, aún sin confirmar. */
      devolucion: "CONFIRMADA" | "EN_CURSO" | "NINGUNA";
    }
  | { ok: false; mensaje: string };

/**
 * POST /v1/reservas/{id}/cancelar (05-API/03_Bookings.md).
 *
 * La RPC decide el porcentaje según la política que el cliente aceptó al reservar y
 * encola el reembolso; aquí solo se dispara el worker. El monto nunca viene del cliente.
 */
export async function cancelarReservaAction(
  reservaId: string,
  motivo?: string
): Promise<ResultadoCancelacion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cancelar_reserva", {
    p_reserva_id: reservaId,
    p_motivo: motivo,
  });

  if (error) {
    if (error.message.includes("RESERVA_NO_CANCELABLE")) {
      return { ok: false, mensaje: "Esta reserva ya no se puede cancelar." };
    }
    if (error.message.includes("NO_AUTORIZADO")) {
      return { ok: false, mensaje: "No tienes permiso para cancelar esta reserva." };
    }
    return { ok: false, mensaje: error.message };
  }

  const r = (data ?? {}) as {
    reembolso_id?: string | null;
    reembolso_monto?: number;
    reembolso_pct?: number;
  };

  const monto = Number(r.reembolso_monto ?? 0);
  const pct = Number(r.reembolso_pct ?? 0);

  // La RPC ya dejó la solicitud en `reembolso` (ELEGIBLE); el worker la ejecuta y solo
  // la marca REEMBOLSADO con confirmación de la pasarela. Si falla, queda FALLIDO y se
  // reintenta: nunca se pierde ni se da por hecha.
  let devolucion: "CONFIRMADA" | "EN_CURSO" | "NINGUNA" = "NINGUNA";
  if (r.reembolso_id && monto > 0) {
    await procesarReembolsosSinFallar();
    const { data: fila } = await createAdminClient()
      .from("reembolso")
      .select("estado")
      .eq("id", r.reembolso_id)
      .maybeSingle();
    devolucion = fila?.estado === "REEMBOLSADO" ? "CONFIRMADA" : "EN_CURSO";
  }

  revalidatePath(`/reserva/${reservaId}`);
  revalidatePath("/mis-reservas");

  return { ok: true, reembolsoMonto: monto, reembolsoPct: pct, devolucion };
}
