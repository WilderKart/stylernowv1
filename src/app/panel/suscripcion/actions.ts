"use server";

import { crearPreferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre este negocio.",
  NEGOCIO_NO_ACTIVO: "Tu negocio debe estar activo para cambiar de Plan.",
  SUSCRIPCION_NO_ACTIVA: "Tu suscripción no está activa — contactá a soporte.",
  ALLFATHER_REQUIERE_COTIZACION: "Allfather se cotiza directamente con el equipo de StylerNow, no es autoservicio.",
  YA_ESTA_EN_ESE_PLAN: "Ya estás en ese Plan.",
  UPGRADE_YA_EN_PROCESO: "Ya tenés un upgrade pendiente de pago.",
  NO_ES_UPGRADE: "Ese Plan no es un upgrade respecto al actual.",
  NO_ES_DOWNGRADE: "Ese Plan no es un downgrade respecto al actual.",
  MONTO_INVALIDO: "No se pudo calcular el monto a cobrar.",
  EXCEDE_LIMITE_SEDES: "Tenés más Sedes activas de las que permite ese Plan — cerrá Sedes hasta llegar al límite antes de programar el downgrade.",
  EXCEDE_LIMITE_STAFF: "Tenés más Staff activo del que permite ese Plan — retirá Staff hasta llegar al límite antes de programar el downgrade.",
  SIN_DOWNGRADE_PROGRAMADO: "No tenés ningún downgrade programado para cancelar.",
  MOTIVO_REQUERIDO: "Tenés que indicar un motivo.",
  TRANSICION_INVALIDA: "Tu negocio no está en un estado que permita esta acción.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type PlanCodigo = "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER";

export interface PlanCatalogo {
  codigo: string;
  nombre: string;
  precioMensual: number | null;
  limiteSedes: number | null;
  staffIncluido: number | null;
  guardianDisponible: boolean;
  marketplaceAdsDisponible: boolean;
}

export interface MiSuscripcion {
  planCodigo: string;
  estado: string;
  fechaProximoCobro: string;
  planCodigoDestino: string | null;
  suspendidoCausa: string | null;
}

export async function obtenerCatalogoPlanes(): Promise<Resultado<PlanCatalogo[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plan")
      .select("codigo, nombre, precio_mensual, limite_sedes, staff_incluido, guardian_disponible, marketplace_ads_disponible")
      .order("precio_mensual", { ascending: true, nullsFirst: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        precioMensual: p.precio_mensual !== null ? Number(p.precio_mensual) : null,
        limiteSedes: p.limite_sedes,
        staffIncluido: p.staff_incluido,
        guardianDisponible: p.guardian_disponible,
        marketplaceAdsDisponible: p.marketplace_ads_disponible,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function obtenerMiSuscripcion(negocioId: string): Promise<Resultado<MiSuscripcion>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suscripcion")
      .select("plan_codigo, estado, fecha_proximo_cobro, plan_codigo_destino, suspendido_causa")
      .eq("negocio_id", negocioId)
      .single();
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: {
        planCodigo: data.plan_codigo,
        estado: data.estado,
        fechaProximoCobro: data.fecha_proximo_cobro,
        planCodigoDestino: data.plan_codigo_destino,
        suspendidoCausa: data.suspendido_causa,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export type ResultadoInicioUpgrade =
  | { ok: true; url: string; pagoId: string }
  | { ok: false; mensaje: string };

/** Cobro único prorrateado (01-PRD/03_Monetization.md) — nunca reinicia el ciclo de facturación. */
export async function iniciarUpgrade(negocioId: string, planCodigoNuevo: PlanCodigo): Promise<ResultadoInicioUpgrade> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Iniciá sesión de nuevo." };

  const { data: pago, error } = await supabase.rpc("solicitar_upgrade_plan", {
    p_negocio_id: negocioId,
    p_plan_codigo_nuevo: planCodigoNuevo,
  });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar el upgrade." };

  const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", negocioId).single();

  const sitio = urlSitio();
  const esPublico = sitio.startsWith("https://");

  try {
    const preferencia = await crearPreferencia({
      pagoId: pago.id,
      titulo: `Upgrade de Plan a ${planCodigoNuevo} · ${negocio?.nombre ?? "StylerNow"}`,
      monto: Number(pago.monto),
      emailPagador: user.email,
      urlRetorno: `${sitio}/panel/suscripcion?desde=pago`,
      urlWebhook: esPublico ? `${sitio}/api/webhooks/pasarela/mercadopago` : null,
    });

    await createAdminClient().from("pago").update({ id_preferencia_pasarela: preferencia.id }).eq("id", pago.id);

    return { ok: true, url: preferencia.url, pagoId: pago.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intentá de nuevo." };
  }
}

export type EstadoUpgrade = { pago: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "SIN_PAGO" };

export async function consultarEstadoUpgrade(pagoId: string): Promise<EstadoUpgrade> {
  const supabase = await createClient();
  const { data: pago } = await supabase.from("pago").select("estado").eq("id", pagoId).maybeSingle();

  if (pago && pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(pagoId);
      const { data: actualizado } = await supabase.from("pago").select("estado").eq("id", pagoId).maybeSingle();
      return { pago: (actualizado?.estado as "APROBADO" | "RECHAZADO" | undefined) ?? "PENDIENTE" };
    } catch (e) {
      console.error("[suscripcion] no se pudo reconciliar el pago de upgrade", e);
    }
  }

  return { pago: pago ? (pago.estado === "APROBADO" || pago.estado === "RECHAZADO" ? pago.estado : "PENDIENTE") : "SIN_PAGO" };
}

export async function solicitarDowngrade(negocioId: string, planCodigoDestino: PlanCodigo): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("solicitar_downgrade_plan", {
      p_negocio_id: negocioId,
      p_plan_codigo_destino: planCodigoDestino,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarDowngradeProgramado(negocioId: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancelar_downgrade_programado", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarMiNegocio(negocioId: string, motivo: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancelar_negocio_propio", { p_negocio_id: negocioId, p_motivo: motivo });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/suscripcion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
