"use server";

import { tabla } from "@/lib/pagos-directos/sin-tipos";
import { createClient } from "@/lib/supabase/server";

export interface PagoDeReserva {
  pagoId: string;
  estado: "REPORTADO" | "VERIFICADO" | "RECHAZADO";
  montoReportado: number;
  referencia: string | null;
  url: string | null;
}

/**
 * Solo lectura: el pago directo de una cita y un enlace temporal (10 min) a la foto del comprobante.
 * Lo usa el POS y la agenda del barbero. No aprueba, rechaza ni modifica nada: RLS y las políticas de Storage ya limitan
 * la lectura a quien tiene acceso interno al negocio de esa cita (o al cliente dueño del soporte).
 */
export async function obtenerPagoDeReserva(reservaId: string): Promise<PagoDeReserva | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const r = (await tabla(supabase, "pago_reserva")
      .select("id, estado, monto_reportado, referencia_corta, comprobante_url")
      .eq("reserva_id", reservaId)
      .eq("metodo", "TRANSFERENCIA_DIRECTA")
      .order("created_at", { ascending: false })
      .limit(1)) as unknown as {
      data: { id: string; estado: PagoDeReserva["estado"]; monto_reportado: number; referencia_corta: string | null; comprobante_url: string | null }[] | null;
    };
    const p = r.data?.[0];
    if (!p) return null;
    let url: string | null = null;
    if (p.comprobante_url) {
      const { data } = await supabase.storage.from("pagos-directos").createSignedUrl(p.comprobante_url, 600);
      url = data?.signedUrl ?? null;
    }
    return { pagoId: p.id, estado: p.estado, montoReportado: Number(p.monto_reportado), referencia: p.referencia_corta, url };
  } catch {
    return null;
  }
}
