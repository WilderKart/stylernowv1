"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

export interface PuntoIngreso {
  periodo: string;
  ingresos: number;
  citasCompletadas: number;
}

export async function obtenerIngresosPeriodo(datos: {
  negocioId: string;
  sedeId?: string | null;
  desde?: string;
  hasta?: string;
  agrupacion: "semana" | "mes";
}): Promise<Resultado<PuntoIngreso[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("reportes_ingresos_periodo", {
      p_negocio_id: datos.negocioId,
      p_sede_id: datos.sedeId ?? undefined,
      p_desde: datos.desde ?? undefined,
      p_hasta: datos.hasta ?? undefined,
      p_agrupacion: datos.agrupacion,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((p) => ({ periodo: p.periodo!, ingresos: Number(p.ingresos), citasCompletadas: p.citas_completadas! })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface ServicioTop {
  servicioId: string;
  nombre: string;
  vecesVendido: number;
  ingresos: number;
}

export async function obtenerServiciosTop(negocioId: string, sedeId?: string | null): Promise<Resultado<ServicioTop[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("reportes_servicios_top", {
      p_negocio_id: negocioId,
      p_sede_id: sedeId ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((s) => ({
        servicioId: s.servicio_id!,
        nombre: s.nombre!,
        vecesVendido: s.veces_vendido!,
        ingresos: Number(s.ingresos),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface RankingStaffReporte {
  vinculoId: string;
  nombre: string;
  sedeNombre: string | null;
  comisionGenerada: number;
  reservasCompletadas: number;
}

export async function obtenerRankingStaffPeriodo(datos: {
  negocioId: string;
  sedeId?: string | null;
  desde?: string;
  hasta?: string;
}): Promise<Resultado<RankingStaffReporte[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("reportes_ranking_staff", {
      p_negocio_id: datos.negocioId,
      p_sede_id: datos.sedeId ?? undefined,
      p_desde: datos.desde ?? undefined,
      p_hasta: datos.hasta ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        vinculoId: r.vinculo_id!,
        nombre: r.nombre!,
        sedeNombre: r.sede_nombre,
        comisionGenerada: Number(r.comision_generada),
        reservasCompletadas: r.reservas_completadas!,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Posición en el Marketplace ──────────────────────────────────────────
// 08-Growth-Monetization/01_Marketplace_Algorithm.md, Permisos: "Ningún
// Barbería puede ver el Score exacto de un competidor, solo su propia
// posición relativa aproximada (rango, no número exacto)".

export async function obtenerMiPosicionMarketplace(negocioId: string): Promise<Resultado<string>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("marketplace_mi_posicion", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Reseñas ──────────────────────────────────────────────────────────────

export interface ResenaRecibida {
  id: string;
  calificacion: number;
  comentario: string | null;
  respuestaNegocio: string | null;
  clienteNombre: string;
  createdAt: string;
}

export async function listarResenas(negocioId: string): Promise<Resultado<ResenaRecibida[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("resena")
      .select("id, calificacion, comentario, respuesta_negocio, created_at, cliente:cliente_id (nombre)")
      .eq("negocio_id", negocioId)
      .eq("estado", "VISIBLE")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id,
        calificacion: r.calificacion,
        comentario: r.comentario,
        respuestaNegocio: r.respuesta_negocio,
        clienteNombre: (r.cliente as unknown as { nombre: string } | null)?.nombre ?? "Cliente",
        createdAt: r.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reportarResena(resenaId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!motivo.trim()) return { ok: false, error: "Contanos el motivo del reporte." };
    const { error } = await supabase.rpc("reportar_resena", { p_resena_id: resenaId, p_motivo: motivo.trim() });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/reportes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function responderResena(resenaId: string, respuesta: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!respuesta.trim()) return { ok: false, error: "La respuesta no puede estar vacía." };
    const { error } = await supabase.from("resena").update({ respuesta_negocio: respuesta.trim() }).eq("id", resenaId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/reportes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
