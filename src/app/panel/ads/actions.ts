"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre esta campaña.",
  FORMATO_NO_DISPONIBLE: "Ese formato no está disponible todavía.",
  UNIDAD_COBRO_INVALIDA: "Elegí una unidad de cobro válida.",
  DESTACADO_SOLO_CPC: "El formato Destacado solo se cobra por clic (CPC).",
  PRESUPUESTO_DIARIO_INVALIDO: "El presupuesto diario debe ser mayor a 0.",
  PRESUPUESTO_TOTAL_INVALIDO: "El presupuesto total es obligatorio y debe ser al menos el presupuesto diario.",
  PLAN_INSUFICIENTE: "Necesitás el Plan Jarl o superior para crear campañas publicitarias.",
  CAMPANA_NO_ENCONTRADA: "No encontramos esa campaña.",
  TRANSICION_INVALIDA: "Esa campaña no está en un estado que permita esta acción.",
  SALDO_INSUFICIENTE: "Tu Wallet no tiene saldo suficiente para cubrir al menos un día de presupuesto.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export interface CampanaAdmin {
  id: string;
  formato: string;
  unidadCobro: string;
  presupuestoDiario: number;
  presupuestoTotal: number | null;
  gastoTotal: number;
  estado: string;
  impresiones: number;
  clics: number;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export async function listarMisCampanas(negocioId: string): Promise<Resultado<CampanaAdmin[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("campana_publicitaria")
      .select("id, formato, unidad_cobro, presupuesto_diario, presupuesto_total, gasto_total, estado, impresiones, clics, fecha_inicio, fecha_fin")
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((c) => ({
        id: c.id,
        formato: c.formato,
        unidadCobro: c.unidad_cobro,
        presupuestoDiario: Number(c.presupuesto_diario),
        presupuestoTotal: c.presupuesto_total !== null ? Number(c.presupuesto_total) : null,
        gastoTotal: Number(c.gasto_total),
        estado: c.estado,
        impresiones: c.impresiones,
        clics: c.clics,
        fechaInicio: c.fecha_inicio,
        fechaFin: c.fecha_fin,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearCampana(datos: {
  negocioId: string;
  formato: "DESTACADO" | "PIN";
  unidadCobro: "CPC" | "CPM";
  presupuestoDiario: number;
  presupuestoTotal: number;
  fechaFin: string | null;
}): Promise<Resultado<{ id: string }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crear_campana_publicitaria", {
      p_negocio_id: datos.negocioId,
      p_formato: datos.formato,
      p_unidad_cobro: datos.unidadCobro,
      p_presupuesto_diario: datos.presupuestoDiario,
      p_presupuesto_total: datos.presupuestoTotal,
      p_fecha_fin: datos.fechaFin ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function activarCampana(campanaId: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("activar_campana", { p_campana_id: campanaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function pausarCampana(campanaId: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("pausar_campana", { p_campana_id: campanaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function finalizarCampana(campanaId: string): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("finalizar_campana", { p_campana_id: campanaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface MetricasCampana {
  impresiones: number;
  clics: number;
  ctr: number;
  reservasAtribuidas: number;
  costoPorReserva: number | null;
  gastoTotal: number;
  presupuestoRestante: number;
}

export async function obtenerMetricasCampana(campanaId: string): Promise<Resultado<MetricasCampana>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("metricas_campana", { p_campana_id: campanaId });
    if (error) return { ok: false, error: traducirError(error.message) };
    const m = data as {
      impresiones: number; clics: number; ctr: number; reservasAtribuidas: number;
      costoPorReserva: number | null; gastoTotal: number; presupuestoRestante: number;
    };
    return {
      ok: true,
      data: {
        impresiones: m.impresiones,
        clics: m.clics,
        ctr: Number(m.ctr),
        reservasAtribuidas: m.reservasAtribuidas,
        costoPorReserva: m.costoPorReserva !== null ? Number(m.costoPorReserva) : null,
        gastoTotal: Number(m.gastoTotal),
        presupuestoRestante: Number(m.presupuestoRestante),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
