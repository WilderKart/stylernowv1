"use server";

import { crearPreferenciaDePago } from "@/lib/pagos/cobro";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  NEGOCIO_NO_ACTIVO: "Tu negocio debe estar activo para cambiar de Plan.",
  SUSCRIPCION_NO_ACTIVA: "Tu suscripción no está activa — contacta a soporte.",
  SIGNATURE_REQUIERE_COTIZACION: "Signature se cotiza directamente con el equipo de StylerNow, no es autoservicio.",
  YA_ESTA_EN_ESE_PLAN: "Ya estás en ese Plan.",
  UPGRADE_YA_EN_PROCESO: "Ya tienes un upgrade pendiente de pago.",
  NO_ES_UPGRADE: "Ese Plan no es un upgrade respecto al actual.",
  NO_ES_DOWNGRADE: "Ese Plan no es un downgrade respecto al actual.",
  MONTO_INVALIDO: "No se pudo calcular el monto a cobrar.",
  EXCEDE_LIMITE_SEDES: "Tienes más Sedes activas de las que permite ese Plan — cierra Sedes hasta llegar al límite antes de programar el downgrade.",
  EXCEDE_LIMITE_STAFF: "Tienes más Staff activo del que permite ese Plan — retira Staff hasta llegar al límite antes de programar el downgrade.",
  SIN_DOWNGRADE_PROGRAMADO: "No tienes ningún downgrade programado para cancelar.",
  MOTIVO_REQUERIDO: "Tienes que indicar un motivo.",
  TRANSICION_INVALIDA: "Tu negocio no está en un estado que permita esta acción.",
  SUSCRIPCION_CANCELADA: "Tu suscripción está cancelada. Escríbele a soporte para reactivarla.",
  SUSPENDIDA_POR_INFRACCION: "Tu cuenta está suspendida por una revisión. Escríbele a soporte.",
  ACTIVACION_MANUAL_VIGENTE: "Tu plan lo activó el equipo de StylerNow. Cuando termine esa activación podrás pagarlo aquí.",
  AUN_NO_TOCA_RENOVAR: "Podrás renovar tu plan en los 7 días anteriores a su vencimiento.",
  PLAN_REQUERIDO: "Elige un plan para continuar.",
  CICLO_INVALIDO: "Elige facturación mensual o anual.",
  PAIS_SIN_PASARELA: "Todavía no recibimos pagos en línea en tu país. Escríbele a soporte.",
  PAGO_SUSCRIPCION_EN_PROCESO: "Ya tienes un pago de suscripción en proceso. Espera a que se confirme.",
  PLAN_SIN_PRECIO: "Ese plan no tiene precio publicado en tu país.",
  PLAN_REQUIERE_COTIZACION: "Ese plan se cotiza directamente con el equipo de StylerNow.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type PlanCodigo = "ESSENTIAL" | "STUDIO" | "PRESTIGE" | "SIGNATURE";

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
  ciclo: "MENSUAL" | "ANUAL";
  paisCodigo: string;
  pruebaFin: string | null;
  graciaFin: string | null;
  activacionManual: boolean;
  manualTipo: string | null;
  manualHasta: string | null;
  /** Días enteros que faltan (calculados en servidor); null si no aplica. */
  diasPrueba: number | null;
  diasGracia: number | null;
  /** La prueba se inició con tarjeta (solo entonces se cobra al terminar). */
  conTarjeta: boolean;
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.max(0, Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000));
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
      .select(
        "plan_codigo, estado, fecha_proximo_cobro, plan_codigo_destino, suspendido_causa, ciclo, pais_codigo, prueba_fin, gracia_fin, activacion_manual, manual_tipo, manual_hasta, metodo_pago_proveedor"
      )
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };

    // Negocio sin fila de suscripción (anterior al modelo de planes): se trata como "requiere plan".
    // No es un error: la pantalla le muestra cómo elegir plan.
    if (!data) {
      const { data: negocio } = await supabase.from("negocio").select("plan_codigo, pais_codigo").eq("id", negocioId).maybeSingle();
      return {
        ok: true,
        data: {
          planCodigo: negocio?.plan_codigo ?? "ESSENTIAL",
          estado: "REQUIERE_PLAN",
          fechaProximoCobro: new Date().toISOString(),
          planCodigoDestino: null,
          suspendidoCausa: null,
          ciclo: "MENSUAL",
          paisCodigo: negocio?.pais_codigo ?? "CO",
          pruebaFin: null,
          graciaFin: null,
          activacionManual: false,
          manualTipo: null,
          manualHasta: null,
          diasPrueba: null,
          diasGracia: null,
          conTarjeta: false,
        },
      };
    }

    return {
      ok: true,
      data: {
        planCodigo: data.plan_codigo,
        estado: data.estado,
        fechaProximoCobro: data.fecha_proximo_cobro,
        planCodigoDestino: data.plan_codigo_destino,
        suspendidoCausa: data.suspendido_causa,
        ciclo: data.ciclo === "ANUAL" ? "ANUAL" : "MENSUAL",
        paisCodigo: data.pais_codigo,
        pruebaFin: data.prueba_fin,
        graciaFin: data.gracia_fin,
        activacionManual: data.activacion_manual,
        manualTipo: data.manual_tipo,
        manualHasta: data.manual_hasta,
        diasPrueba: data.estado === "TRIAL" ? diasHasta(data.prueba_fin) : null,
        diasGracia: data.estado === "EN_MORA" ? diasHasta(data.gracia_fin) : null,
        conTarjeta: Boolean(data.metodo_pago_proveedor),
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
  if (!user) return { ok: false, mensaje: "Inicia sesión de nuevo." };

  const { data: pago, error } = await supabase.rpc("solicitar_upgrade_plan", {
    p_negocio_id: negocioId,
    p_plan_codigo_nuevo: planCodigoNuevo,
  });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar el upgrade." };

  const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", negocioId).single();

  const sitio = urlSitio();

  try {
    // Monto, comisión y cuenta de cobro salen del `pago` en la base (lib/pagos/cobro.ts).
    const preferencia = await crearPreferenciaDePago({
      pagoId: pago.id,
      titulo: `Upgrade de Plan a ${planCodigoNuevo} · ${negocio?.nombre ?? "StylerNow"}`,
      emailPagador: user.email,
      urlRetorno: `${sitio}/panel/suscripcion?desde=pago`,
    });

    return { ok: true, url: preferencia.url, pagoId: pago.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intenta de nuevo." };
  }
}

/**
 * Pago (o renovación) del plan por Checkout Pro, en la cuenta de StylerNow (migración 133).
 * El monto lo calcula la base (`solicitar_pago_plan`); el estado lo confirma el webhook o la
 * conciliación, nunca el retorno del navegador. No se guarda ningún dato de tarjeta.
 */
export async function iniciarPagoPlan(
  negocioId: string,
  planCodigo?: PlanCodigo,
  ciclo?: "MENSUAL" | "ANUAL"
): Promise<ResultadoInicioUpgrade> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Inicia sesión de nuevo." };

  const { data, error } = await (supabase as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: { id: string; monto: number } | null; error: { message: string } | null }>;
  }).rpc("solicitar_pago_plan", {
    p_negocio_id: negocioId,
    p_plan_codigo: planCodigo ?? null,
    p_ciclo: ciclo ?? null,
  });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!data) return { ok: false, mensaje: "No se pudo iniciar el pago." };

  const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", negocioId).single();
  try {
    const preferencia = await crearPreferenciaDePago({
      pagoId: data.id,
      titulo: `Plan StylerNow${planCodigo ? ` ${planCodigo}` : ""} · ${negocio?.nombre ?? "tu negocio"}`,
      emailPagador: user.email,
      urlRetorno: `${urlSitio()}/panel/suscripcion?desde=pago`,
    });
    return { ok: true, url: preferencia.url, pagoId: data.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intenta de nuevo." };
  }
}

export interface PagoSuscripcion {
  id: string;
  fecha: string;
  monto: number;
  estado: string;
  concepto: "PLAN" | "UPGRADE";
  plan: string | null;
  ciclo: string | null;
}

/** Historial de pagos y renovaciones del plan (solo pagos a StylerNow, nunca los de reservas). */
export async function listarPagosSuscripcion(negocioId: string): Promise<Resultado<PagoSuscripcion[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pago")
      .select("id, created_at, monto, estado, metadata")
      .eq("negocio_id", negocioId)
      .eq("tipo", "SUSCRIPCION")
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) return { ok: false, error: "No pudimos leer tu historial de pagos." };
    return {
      ok: true,
      data: (data ?? []).map((p) => {
        const m = (p.metadata ?? {}) as Record<string, string | undefined>;
        return {
          id: p.id,
          fecha: p.created_at,
          monto: Number(p.monto),
          estado: p.estado,
          concepto: m.concepto === "PLAN" ? "PLAN" : "UPGRADE",
          plan: m.plan_codigo_nuevo ?? null,
          ciclo: m.ciclo ?? null,
        };
      }),
    };
  } catch {
    return { ok: false, error: "No pudimos leer tu historial de pagos." };
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
