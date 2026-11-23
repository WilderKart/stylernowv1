"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { exigirOperativo, MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  NO_AUTORIZADO: "No tienes permiso sobre esta campaña.",
  SUSCRIPCION_RESTRINGIDA: MENSAJE_RESTRINGIDA,
  FORMATO_NO_DISPONIBLE: "Ese formato no está disponible todavía.",
  UNIDAD_COBRO_INVALIDA: "Elige una unidad de cobro válida.",
  DESTACADO_SOLO_CPC: "El formato Destacado solo se cobra por clic (CPC).",
  PRESUPUESTO_DIARIO_INVALIDO: "El presupuesto diario debe ser mayor a 0.",
  PRESUPUESTO_TOTAL_INVALIDO: "El presupuesto total es obligatorio y debe ser al menos el presupuesto diario.",
  PLAN_INSUFICIENTE: "Tu plan actual no incluye campañas publicitarias. Actualiza tu plan para continuar.",
  CAMPANA_NO_ENCONTRADA: "No encontramos esa campaña.",
  TRANSICION_INVALIDA: "Esa campaña no está en un estado que permita esta acción.",
  SALDO_INSUFICIENTE: "Tu Wallet no tiene saldo suficiente para cubrir al menos un día de presupuesto.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

const ESQUEMA_CREAR_CAMPANA = z.object({
  negocioId: z.string().uuid("Negocio inválido."),
  formato: z.enum(["DESTACADO", "PIN"]),
  unidadCobro: z.enum(["CPC", "CPM"]),
  presupuestoDiario: z.number().positive("El presupuesto diario debe ser mayor a 0."),
  presupuestoTotal: z.number().positive("El presupuesto total debe ser mayor a 0."),
  fechaFin: z.string().date().nullable(),
}).refine((d) => d.presupuestoTotal >= d.presupuestoDiario, {
  message: "El presupuesto total debe ser al menos el presupuesto diario.",
  path: ["presupuestoTotal"],
}).refine((d) => !(d.formato === "DESTACADO" && d.unidadCobro !== "CPC"), {
  message: "El formato Destacado solo se cobra por clic (CPC).",
  path: ["unidadCobro"],
});

async function sesionAds(negocioId: string, opciones?: { requerirOperativo?: boolean }) {
  const parseNegocio = z.string().uuid().safeParse(negocioId);
  if (!parseNegocio.success) throw new Error("NO_AUTORIZADO");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  const autorizado = (contexto.rol === "BARBERIA" || contexto.rol === "GUARDIAN") && contexto.negocioId === negocioId;
  if (!autorizado) throw new Error("NO_AUTORIZADO");
  if (opciones?.requerirOperativo) {
    const operativo = await exigirOperativo(negocioId);
    if (!operativo.ok) throw new Error("SUSCRIPCION_RESTRINGIDA");
  }
  return { supabase };
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
    const { supabase } = await sesionAds(negocioId);
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
    const parse = ESQUEMA_CREAR_CAMPANA.safeParse(datos);
    if (!parse.success) return { ok: false, error: parse.error.issues[0]?.message ?? "Datos inválidos." };
    const { supabase } = await sesionAds(parse.data.negocioId, { requerirOperativo: true });
    const { data, error } = await supabase.rpc("crear_campana_publicitaria", {
      p_negocio_id: parse.data.negocioId,
      p_formato: parse.data.formato,
      p_unidad_cobro: parse.data.unidadCobro,
      p_presupuesto_diario: parse.data.presupuestoDiario,
      p_presupuesto_total: parse.data.presupuestoTotal,
      p_fecha_fin: parse.data.fechaFin ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducirError(e.message) : "Error inesperado." };
  }
}

async function mutarCampana(campanaId: string, rpc: "activar_campana" | "pausar_campana" | "finalizar_campana"): Promise<Resultado> {
  try {
    const id = z.string().uuid("Campaña inválida.").parse(campanaId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: MENSAJES_ERROR.NO_AUTENTICADO };
    const { data: campana } = await supabase.from("campana_publicitaria").select("negocio_id").eq("id", id).maybeSingle();
    if (!campana?.negocio_id) return { ok: false, error: MENSAJES_ERROR.CAMPANA_NO_ENCONTRADA };
    await sesionAds(campana.negocio_id, { requerirOperativo: true });
    const { error } = await supabase.rpc(rpc, { p_campana_id: id });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducirError(e.message) : "Error inesperado." };
  }
}

export async function activarCampana(campanaId: string): Promise<Resultado> {
  return mutarCampana(campanaId, "activar_campana");
}

export async function pausarCampana(campanaId: string): Promise<Resultado> {
  return mutarCampana(campanaId, "pausar_campana");
}

export async function finalizarCampana(campanaId: string): Promise<Resultado> {
  return mutarCampana(campanaId, "finalizar_campana");
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
    const id = z.string().uuid("Campaña inválida.").parse(campanaId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: MENSAJES_ERROR.NO_AUTENTICADO };
    const { data: campana } = await supabase.from("campana_publicitaria").select("negocio_id").eq("id", id).maybeSingle();
    if (!campana?.negocio_id) return { ok: false, error: MENSAJES_ERROR.CAMPANA_NO_ENCONTRADA };
    await sesionAds(campana.negocio_id);
    const { data, error } = await supabase.rpc("metricas_campana", { p_campana_id: id });
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
