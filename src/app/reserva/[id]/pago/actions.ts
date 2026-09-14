"use server";

import { crearPreferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Base pública del sitio, usada por back_urls y notification_url de la pasarela. */
function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** ISO 8601 con offset explícito: Mercado Pago no acepta el sufijo "Z". */
function isoConOffset(fecha: string) {
  return new Date(fecha).toISOString().replace("Z", "+00:00");
}

export type ResultadoInicioPago =
  | { ok: true; url: string; pagoId: string; expiraAt: string | null }
  | { ok: false; mensaje: string; yaPagada?: boolean };

/**
 * POST /v1/reservas/{id}/pagos/sena (05-API/04_Payments.md).
 *
 * No cobra: crea el `pago` en PENDIENTE y devuelve la URL del checkout. El paso a
 * APROBADO ocurre únicamente por confirmación de la pasarela, nunca por esta respuesta.
 */
export async function iniciarPagoSena(reservaId: string): Promise<ResultadoInicioPago> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Iniciá sesión para completar el pago." };

  const { data: pago, error } = await supabase.rpc("crear_pago_sena", {
    p_reserva_id: reservaId,
  });

  if (error) {
    if (error.message.includes("PAGO_YA_PROCESADO")) {
      return { ok: false, mensaje: "Esta reserva ya está pagada.", yaPagada: true };
    }
    if (error.message.includes("RESERVA_NO_PAGABLE")) {
      return {
        ok: false,
        mensaje: "La reserva expiró o cambió de estado. Elegí un horario de nuevo.",
      };
    }
    return { ok: false, mensaje: error.message };
  }
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar el cobro." };

  // Datos de presentación del checkout (el monto ya lo fijó la base, no el cliente).
  const { data: reserva } = await supabase
    .from("reserva")
    .select("expira_at, negocio:negocio_id (nombre)")
    .eq("id", reservaId)
    .single();

  const nombreNegocio =
    (reserva?.negocio as { nombre: string } | null)?.nombre ?? "StylerNow";

  const sitio = urlSitio();
  // Sin URL pública (desarrollo local) la pasarela no puede notificar: la confirmación
  // llega por `consultarEstadoPago`, que consulta su API directamente.
  const esPublico = sitio.startsWith("https://");

  try {
    const preferencia = await crearPreferencia({
      pagoId: pago.id,
      titulo: `Seña · ${nombreNegocio}`,
      monto: Number(pago.monto),
      emailPagador: user.email,
      urlRetorno: `${sitio}/reserva/${reservaId}?desde=pago`,
      urlWebhook: esPublico ? `${sitio}/api/webhooks/pasarela/mercadopago` : null,
      expiraEn: reserva?.expira_at ? isoConOffset(reserva.expira_at) : null,
    });

    // `pago` no tiene política de escritura para roles de producto (06-Security/02_RLS.md):
    // el id de preferencia lo guarda el servidor con service_role.
    await createAdminClient()
      .from("pago")
      .update({ id_preferencia_pasarela: preferencia.id })
      .eq("id", pago.id);

    return {
      ok: true,
      url: preferencia.url,
      pagoId: pago.id,
      expiraAt: reserva?.expira_at ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intentá de nuevo.",
    };
  }
}

export type EstadoPago = {
  reserva: "PENDIENTE_PAGO" | "CONFIRMADA" | "CANCELADA" | "OTRO";
  pago: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "SIN_PAGO";
  detalle: string | null;
};

/**
 * Polling de la pantalla de pago. La confirmación de la pasarela es asíncrona
 * (02-UX/06_Payments.md): además de leer el estado local, reconcilia contra la API
 * para no depender de que el webhook haya llegado.
 */
export async function consultarEstadoPago(reservaId: string): Promise<EstadoPago> {
  const supabase = await createClient();

  const { data: reserva } = await supabase
    .from("reserva")
    .select("id, estado, cancelado_motivo")
    .eq("id", reservaId)
    .maybeSingle();

  if (!reserva) return { reserva: "OTRO", pago: "SIN_PAGO", detalle: null };

  const { data: pagos } = await supabase
    .from("pago")
    .select("id, estado")
    .eq("reserva_id", reservaId)
    .eq("tipo", "SENA")
    .order("created_at", { ascending: false });

  const pago = pagos?.[0];

  if (pago && pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(pago.id);
      return consultarEstadoLocal(reservaId);
    } catch (e) {
      console.error("[pago] no se pudo reconciliar con la pasarela", e);
    }
  }

  return {
    reserva:
      reserva.estado === "PENDIENTE_PAGO" ||
      reserva.estado === "CONFIRMADA" ||
      reserva.estado === "CANCELADA"
        ? reserva.estado
        : "OTRO",
    pago: pago
      ? pago.estado === "APROBADO" || pago.estado === "RECHAZADO"
        ? pago.estado
        : "PENDIENTE"
      : "SIN_PAGO",
    detalle: reserva.cancelado_motivo,
  };
}

/** Relectura tras reconciliar, sin volver a llamar a la pasarela. */
async function consultarEstadoLocal(reservaId: string): Promise<EstadoPago> {
  const supabase = await createClient();

  const [{ data: reserva }, { data: pagos }] = await Promise.all([
    supabase.from("reserva").select("estado, cancelado_motivo").eq("id", reservaId).maybeSingle(),
    supabase
      .from("pago")
      .select("estado")
      .eq("reserva_id", reservaId)
      .eq("tipo", "SENA")
      .order("created_at", { ascending: false }),
  ]);

  const pago = pagos?.[0];

  return {
    reserva:
      reserva?.estado === "PENDIENTE_PAGO" ||
      reserva?.estado === "CONFIRMADA" ||
      reserva?.estado === "CANCELADA"
        ? reserva.estado
        : "OTRO",
    pago: pago
      ? pago.estado === "APROBADO" || pago.estado === "RECHAZADO"
        ? pago.estado
        : "PENDIENTE"
      : "SIN_PAGO",
    detalle: reserva?.cancelado_motivo ?? null,
  };
}
