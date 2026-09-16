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

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso de SuperSU.",
  NEGOCIO_NO_ENCONTRADO: "No encontramos ese negocio.",
  TRANSICION_INVALIDA: "Ese negocio no está en un estado que permita esta acción.",
  MOTIVO_REQUERIDO: "Tenés que indicar un motivo.",
  CAUSA_INVALIDA: "Causa de suspensión inválida.",
  SUSPENSION_POR_INFRACCION_REQUIERE_REACTIVACION_EXPLICITA: "Esta suspensión fue por infracción — usá 'Reactivar', no 'Forzar reactivación por pago externo'.",
  RESENA_NO_REPORTABLE: "Esa reseña ya fue reportada o eliminada.",
  RESENA_NO_EN_COLA: "Esa reseña ya no está pendiente de moderación.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Dashboard global ─────────────────────────────────────────────────────

export interface ResumenAdmin {
  negociosActivos: number;
  negociosPendientes: number;
  ciudadesActivas: number;
  mrr: number;
  citasCompletadasMes: number;
}

export async function obtenerResumenAdmin(): Promise<Resultado<ResumenAdmin>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("admin_dashboard_resumen");
    if (error) return { ok: false, error: traducirError(error.message) };
    const r = data as {
      negocios_activos: number;
      negocios_pendientes: number;
      ciudades_activas: number;
      mrr: number;
      citas_completadas_mes: number;
    };
    return {
      ok: true,
      data: {
        negociosActivos: r.negocios_activos,
        negociosPendientes: r.negocios_pendientes,
        ciudadesActivas: r.ciudades_activas,
        mrr: Number(r.mrr),
        citasCompletadasMes: r.citas_completadas_mes,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Gestión de Negocios ─────────────────────────────────────────────────

export interface NegocioAdmin {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string;
  estado: string;
  planCodigo: string;
  createdAt: string;
  suscripcionEstado: string | null;
  suscripcionCausa: string | null;
}

type NegocioEstado = "PENDIENTE_APROBACION" | "ACTIVO" | "SUSPENDIDO" | "RECHAZADO" | "CANCELADO";

export async function listarNegocios(estado?: NegocioEstado | string): Promise<Resultado<NegocioAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    let q = supabase
      .from("negocio")
      .select("id, nombre, slug, ciudad, estado, plan_codigo, created_at, suscripcion:suscripcion (estado, suspendido_causa)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (estado) q = q.eq("estado", estado as NegocioEstado);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((n) => {
        const suscripcion = n.suscripcion as { estado: string; suspendido_causa: string | null } | { estado: string; suspendido_causa: string | null }[] | null;
        const s = Array.isArray(suscripcion) ? suscripcion[0] : suscripcion;
        return {
          id: n.id,
          nombre: n.nombre,
          slug: n.slug,
          ciudad: n.ciudad,
          estado: n.estado,
          planCodigo: n.plan_codigo,
          createdAt: n.created_at,
          suscripcionEstado: s?.estado ?? null,
          suscripcionCausa: s?.suspendido_causa ?? null,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function aprobarNegocio(negocioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("aprobar_negocio", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function rechazarNegocio(negocioId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("rechazar_negocio", { p_negocio_id: negocioId, p_motivo: motivo });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function suspenderNegocio(negocioId: string, motivo: string, causa: "IMPAGO" | "INFRACCION" = "INFRACCION"): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("suspender_negocio", { p_negocio_id: negocioId, p_motivo: motivo, p_causa: causa });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function marcarNegocioEnMora(negocioId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("marcar_negocio_en_mora", { p_negocio_id: negocioId, p_motivo: motivo });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function forzarReactivacionPagoExterno(negocioId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("forzar_reactivacion_pago_externo", { p_negocio_id: negocioId, p_motivo: motivo });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reactivarNegocio(negocioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("reactivar_negocio_supersu", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarNegocio(negocioId: string, motivo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cancelar_negocio_supersu", { p_negocio_id: negocioId, p_motivo: motivo });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Moderación de reseñas ────────────────────────────────────────────────

export interface ResenaModeracion {
  id: string;
  negocioNombre: string;
  clienteNombre: string;
  calificacion: number;
  comentario: string | null;
  createdAt: string;
}

export async function listarResenasReportadas(): Promise<Resultado<ResenaModeracion[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("resena")
      .select("id, calificacion, comentario, created_at, negocio:negocio_id (nombre), cliente:cliente_id (nombre)")
      .eq("estado", "REPORTADA")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id,
        negocioNombre: (r.negocio as unknown as { nombre: string } | null)?.nombre ?? "Negocio",
        clienteNombre: (r.cliente as unknown as { nombre: string } | null)?.nombre ?? "Cliente",
        calificacion: r.calificacion,
        comentario: r.comentario,
        createdAt: r.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function moderarResena(resenaId: string, accion: "MANTENER" | "ELIMINAR", motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("moderar_resena", { p_resena_id: resenaId, p_accion: accion, p_motivo: motivo || undefined });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/moderacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
