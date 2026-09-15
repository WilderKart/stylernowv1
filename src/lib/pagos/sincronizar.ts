import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buscarPagoPorReferencia, obtenerPago, reembolsar, type PagoPasarela } from "./mercadopago";

/**
 * Reconciliación de un cobro contra la pasarela.
 *
 * Es el único camino por el que un `pago` cambia de estado, y lo comparten el webhook
 * (05-API/06_Webhooks.md) y el retorno del Cliente desde el checkout. En ambos casos el
 * estado se lee de la API de Mercado Pago, nunca del cuerpo del webhook ni de la URL de
 * retorno — así un tercero no puede confirmar una Reserva falsificando una notificación.
 *
 * La idempotencia vive en `aplicar_evento_pago`: reenviar el mismo evento N veces
 * produce exactamente un efecto de negocio.
 */

export type ResultadoSincronizacion =
  | { estado: "APROBADO"; reservaId: string | null }
  | { estado: "RECHAZADO"; reservaId: string | null }
  | { estado: "PENDIENTE" }
  | { estado: "SIN_CAMBIOS"; motivo: string }
  | { estado: "REEMBOLSADO"; motivo: string };

async function aplicar(pagoId: string, pagoPasarela: PagoPasarela): Promise<ResultadoSincronizacion> {
  const admin = createAdminClient();

  if (pagoPasarela.estado === "PENDIENTE") return { estado: "PENDIENTE" };

  const { data, error } = await admin.rpc("aplicar_evento_pago", {
    p_pago_id: pagoId,
    p_id_transaccion: pagoPasarela.id,
    p_estado: pagoPasarela.estado,
    p_payload: {
      id: pagoPasarela.id,
      status: pagoPasarela.estadoCrudo,
      status_detail: pagoPasarela.detalle,
      payment_method_id: pagoPasarela.metodo,
      transaction_amount: pagoPasarela.monto,
    },
  });

  if (error) throw new Error(`aplicar_evento_pago: ${error.message}`);

  const r = (data ?? {}) as {
    procesado?: boolean;
    requiere_reembolso?: boolean;
    motivo?: string;
    reserva_id?: string | null;
  };

  if (!r.procesado) return { estado: "SIN_CAMBIOS", motivo: r.motivo ?? "SIN_EFECTO" };

  // 03-Business-Rules/03_Payment_Rules.md: pago que confirma después de la expiración
  // de la Reserva se reembolsa al 100%, sin intervención de soporte.
  if (r.requiere_reembolso) {
    await reembolsar(pagoPasarela.id);
    await admin
      .from("pago")
      .update({
        estado: "REEMBOLSADO",
        monto_reembolsado: pagoPasarela.monto,
        motivo_reembolso: "CANCELACION_NEGOCIO",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pagoId);
    // 02_Commissions.md: la comisión ya acreditada al Wallet (aplicar_evento_pago)
    // se revierte proporcionalmente — nunca queda comisión cobrada sobre un pago
    // que terminó reembolsado al 100%.
    await admin.rpc("revertir_comision_wallet", { p_pago_id: pagoId, p_monto_reembolsado: pagoPasarela.monto });

    return { estado: "REEMBOLSADO", motivo: r.motivo ?? "RESERVA_EXPIRADA" };
  }

  return pagoPasarela.estado === "APROBADO"
    ? { estado: "APROBADO", reservaId: r.reserva_id ?? null }
    : { estado: "RECHAZADO", reservaId: r.reserva_id ?? null };
}

/** Camino del retorno del checkout y del polling de la pantalla de pago. */
export async function sincronizarPago(pagoId: string): Promise<ResultadoSincronizacion> {
  const pasarela = await buscarPagoPorReferencia(pagoId);
  if (!pasarela) return { estado: "PENDIENTE" };
  return aplicar(pagoId, pasarela);
}

/** Camino del webhook: llega el id de la transacción, no el de nuestro `pago`. */
export async function sincronizarDesdeTransaccion(
  idTransaccion: string
): Promise<ResultadoSincronizacion> {
  const pasarela = await obtenerPago(idTransaccion);
  const pagoId = pasarela.referenciaExterna;

  const admin = createAdminClient();

  // Webhook cuyo `external_reference` no corresponde a ningún `pago` conocido:
  // se registra como HUERFANO para revisión y se devuelve el dinero si se cobró
  // (05-API/06_Webhooks.md, caso límite — nunca se descarta en silencio).
  const { data: pago } = pagoId
    ? await admin.from("pago").select("id").eq("id", pagoId).maybeSingle()
    : { data: null };

  if (!pago) {
    await admin.from("evento_auditoria").insert({
      entidad_tipo: "pago",
      entidad_id: null,
      accion: "WEBHOOK_HUERFANO",
      actor_tipo: "SISTEMA",
      payload_despues: {
        id_transaccion: pasarela.id,
        external_reference: pagoId,
        status: pasarela.estadoCrudo,
        monto: pasarela.monto,
      },
    });

    if (pasarela.estado === "APROBADO") await reembolsar(pasarela.id);
    return { estado: "REEMBOLSADO", motivo: "HUERFANO" };
  }

  return aplicar(pago.id, pasarela);
}
