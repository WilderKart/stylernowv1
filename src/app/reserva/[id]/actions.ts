"use server";

import { reembolsar } from "@/lib/pagos/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ResultadoCancelacion =
  | { ok: true; reembolsoMonto: number; reembolsoPct: number }
  | { ok: false; mensaje: string };

/**
 * POST /v1/reservas/{id}/cancelar (05-API/03_Bookings.md).
 *
 * La RPC decide el porcentaje según la ventana de cancelación del Negocio y registra
 * la auditoría; acá solo se ejecuta la devolución contra la pasarela. El monto nunca
 * viene del cliente: lo devuelve la base de datos.
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
      return { ok: false, mensaje: "No tenés permiso para cancelar esta reserva." };
    }
    return { ok: false, mensaje: error.message };
  }

  const r = (data ?? {}) as {
    pago_id?: string | null;
    reembolso_monto?: number;
    reembolso_pct?: number;
    motivo_catalogo?: string | null;
  };

  const monto = Number(r.reembolso_monto ?? 0);
  const pct = Number(r.reembolso_pct ?? 0);

  if (r.pago_id && monto > 0) {
    const admin = createAdminClient();
    const { data: pago } = await admin
      .from("pago")
      .select("id, monto, id_transaccion_pasarela")
      .eq("id", r.pago_id)
      .single();

    if (pago?.id_transaccion_pasarela) {
      try {
        const total = monto >= Number(pago.monto);
        await reembolsar(pago.id_transaccion_pasarela, total ? undefined : monto);

        await admin
          .from("pago")
          .update({
            estado: total ? "REEMBOLSADO" : "REEMBOLSADO_PARCIAL",
            monto_reembolsado: monto,
            motivo_reembolso: r.motivo_catalogo ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pago.id);
      } catch (e) {
        // La Reserva ya quedó cancelada: el horario se liberó igual. El reembolso
        // pendiente queda visible en auditoría para reintento manual.
        console.error("[cancelación] la pasarela rechazó el reembolso", r.pago_id, e);
        return {
          ok: false,
          mensaje:
            "Cancelamos la reserva, pero la devolución quedó pendiente. Soporte la resuelve en las próximas horas.",
        };
      }
    }
  }

  revalidatePath(`/reserva/${reservaId}`);
  revalidatePath("/mis-reservas");

  return { ok: true, reembolsoMonto: monto, reembolsoPct: pct };
}
