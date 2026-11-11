import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lee el estado de un `pago` de COMPRA del propio usuario (gift card o membresía).
 *
 * La RLS de `pago` (pago_select_cliente) solo deja a un cliente leer pagos ligados a una reserva
 * suya: un pago de gift card o de membresía NO tiene reserva, así que el comprador no podía ver su
 * propio pago y la pantalla se quedaba "esperando la confirmación" para siempre aunque el pago ya
 * estuviera aprobado. En vez de ampliar la política de una tabla de dinero, se lee con service_role
 * y SE COMPRUEBA EN SERVIDOR que el pago es del usuario que pregunta:
 *   - GIFT_CARD: la gift card referenciada en metadata fue comprada por él (gift_card.comprador_id).
 *   - MEMBRESIA: metadata.cliente_id es él.
 * Si no es suyo, se responde como si no existiera (sin revelar que el pago existe).
 */
export type TipoCompra = "GIFT_CARD" | "MEMBRESIA";

export interface PagoPropio {
  estado: string;
  metadata: Record<string, unknown> | null;
}

export async function leerPagoPropio(pagoId: string, userId: string, tipo: TipoCompra): Promise<PagoPropio | null> {
  const admin = createAdminClient();
  const { data: pago } = await admin.from("pago").select("estado, tipo, metadata").eq("id", pagoId).maybeSingle();
  if (!pago || pago.tipo !== tipo) return null;

  const metadata = (pago.metadata ?? null) as Record<string, unknown> | null;

  if (tipo === "MEMBRESIA") {
    if (metadata?.cliente_id !== userId) return null;
  } else {
    const giftCardId = typeof metadata?.gift_card_id === "string" ? metadata.gift_card_id : null;
    if (!giftCardId) return null;
    const { data: gc } = await admin.from("gift_card").select("comprador_id").eq("id", giftCardId).maybeSingle();
    if (!gc || gc.comprador_id !== userId) return null;
  }

  return { estado: pago.estado, metadata };
}
