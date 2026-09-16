"use server";

import { crearPreferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MENSAJES_ERROR: Record<string, string> = {
  PLAN_NO_DISPONIBLE: "Este plan ya no está disponible.",
  YA_TIENE_MEMBRESIA_ACTIVA: "Ya tenés una Membresía activa en este Negocio.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}
function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type ResultadoInicioCompraMembresia =
  | { ok: true; url: string; pagoId: string }
  | { ok: false; mensaje: string };

export async function iniciarCompraMembresia(planId: string): Promise<ResultadoInicioCompraMembresia> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Iniciá sesión para comprar la Membresía." };

  const { data: pago, error } = await supabase.rpc("suscribirse_membresia", { p_plan_id: planId });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar la compra." };

  const { data: plan } = await supabase.from("membresia_plan").select("nombre, negocio:negocio_id (nombre)").eq("id", planId).single();
  const negocio = plan?.negocio as unknown as { nombre: string } | null;

  const sitio = urlSitio();
  const esPublico = sitio.startsWith("https://");

  try {
    const preferencia = await crearPreferencia({
      pagoId: pago.id,
      titulo: `Membresía ${plan?.nombre ?? ""} · ${negocio?.nombre ?? "StylerNow"}`,
      monto: Number(pago.monto),
      emailPagador: user.email,
      urlRetorno: `${sitio}/checkout/membresia/${planId}?desde=pago&pagoId=${pago.id}`,
      urlWebhook: esPublico ? `${sitio}/api/webhooks/pasarela/mercadopago` : null,
    });

    await createAdminClient().from("pago").update({ id_preferencia_pasarela: preferencia.id }).eq("id", pago.id);

    return { ok: true, url: preferencia.url, pagoId: pago.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intentá de nuevo." };
  }
}

export type EstadoCompraMembresia = { pago: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "SIN_PAGO"; membresiaId: string | null };

export async function consultarEstadoCompraMembresia(pagoId: string): Promise<EstadoCompraMembresia> {
  const supabase = await createClient();
  const { data: pago } = await supabase.from("pago").select("estado, negocio_id, metadata").eq("id", pagoId).maybeSingle();

  if (pago && pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(pagoId);
    } catch (e) {
      console.error("[checkout/membresia] no se pudo reconciliar el pago", e);
    }
  }

  const { data: actualizado } = await supabase.from("pago").select("estado, negocio_id, metadata").eq("id", pagoId).maybeSingle();
  if (!actualizado) return { pago: "SIN_PAGO", membresiaId: null };

  if (actualizado.estado === "APROBADO") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const planId = (actualizado.metadata as { plan_id?: string } | null)?.plan_id;
    const { data: membresia } = await supabase
      .from("cliente_membresia")
      .select("id")
      .eq("plan_id", planId ?? "")
      .eq("cliente_id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { pago: "APROBADO", membresiaId: membresia?.id ?? null };
  }

  return { pago: actualizado.estado === "RECHAZADO" ? "RECHAZADO" : "PENDIENTE", membresiaId: null };
}
