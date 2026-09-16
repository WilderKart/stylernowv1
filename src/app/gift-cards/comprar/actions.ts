"use server";

import { crearPreferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MENSAJES_ERROR: Record<string, string> = {
  MONTO_INVALIDO: "Elegí un monto válido.",
  PIN_INVALIDO: "El PIN debe tener al menos 4 dígitos.",
  NEGOCIO_NO_DISPONIBLE: "Ese Negocio no está disponible.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}
function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export interface NegocioBusqueda {
  id: string;
  nombre: string;
  slug: string;
}

export async function buscarNegociosParaGiftCard(texto: string): Promise<NegocioBusqueda[]> {
  if (!texto.trim()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("marketplace_buscar", { p_texto: texto.trim(), p_limite: 6 });
  return (data ?? []).map((n) => ({ id: n.id, nombre: n.nombre, slug: n.slug }));
}

export interface DatosCompraGiftCard {
  negocioId: string;
  monto: number;
  pin: string;
  destinatarioNombre?: string;
  destinatarioEmail?: string;
  mensaje?: string;
}

export type ResultadoInicioCompraGiftCard = { ok: true; url: string; pagoId: string } | { ok: false; mensaje: string };

export async function iniciarCompraGiftCard(datos: DatosCompraGiftCard): Promise<ResultadoInicioCompraGiftCard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Iniciá sesión para comprar una Gift Card." };

  const { data: pago, error } = await supabase.rpc("crear_gift_card", {
    p_negocio_id: datos.negocioId,
    p_monto: datos.monto,
    p_pin: datos.pin,
    p_destinatario_email: datos.destinatarioEmail || undefined,
    p_destinatario_nombre: datos.destinatarioNombre || undefined,
    p_mensaje: datos.mensaje || undefined,
  });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar la compra." };

  const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", datos.negocioId).single();

  const sitio = urlSitio();
  const esPublico = sitio.startsWith("https://");

  try {
    const preferencia = await crearPreferencia({
      pagoId: pago.id,
      titulo: `Gift Card ${negocio?.nombre ?? "StylerNow"}`,
      monto: Number(pago.monto),
      emailPagador: user.email,
      urlRetorno: `${sitio}/gift-cards/comprar?desde=pago&pagoId=${pago.id}`,
      urlWebhook: esPublico ? `${sitio}/api/webhooks/pasarela/mercadopago` : null,
    });

    await createAdminClient().from("pago").update({ id_preferencia_pasarela: preferencia.id }).eq("id", pago.id);

    return { ok: true, url: preferencia.url, pagoId: pago.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intentá de nuevo." };
  }
}

export type EstadoCompraGiftCard = { pago: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "SIN_PAGO"; giftCardId: string | null };

export async function consultarEstadoCompraGiftCard(pagoId: string): Promise<EstadoCompraGiftCard> {
  const supabase = await createClient();
  const { data: pago } = await supabase.from("pago").select("estado, metadata").eq("id", pagoId).maybeSingle();

  if (pago && pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(pagoId);
    } catch (e) {
      console.error("[gift-cards/comprar] no se pudo reconciliar el pago", e);
    }
  }

  const { data: actualizado } = await supabase.from("pago").select("estado, metadata").eq("id", pagoId).maybeSingle();
  if (!actualizado) return { pago: "SIN_PAGO", giftCardId: null };

  const giftCardId = (actualizado.metadata as { gift_card_id?: string } | null)?.gift_card_id ?? null;
  if (actualizado.estado === "APROBADO") return { pago: "APROBADO", giftCardId };
  return { pago: actualizado.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE", giftCardId: null };
}
