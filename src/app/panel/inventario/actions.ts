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
  NO_AUTORIZADO: "No tenés permiso sobre esta sede.",
  CANTIDAD_INVALIDA: "La cantidad debe ser mayor a 0.",
  PRODUCTO_NO_ENCONTRADO: "No encontramos ese producto.",
  SEDE_NO_PERTENECE_AL_NEGOCIO: "Esa sede no pertenece a este negocio.",
  SOLICITUD_NO_PENDIENTE: "Esa solicitud ya fue atendida o cancelada.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Stock por sede ───────────────────────────────────────────────────────

export interface StockProducto {
  productoId: string;
  nombre: string;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  enAlerta: boolean;
}

export async function listarStock(negocioId: string, sedeId: string): Promise<Resultado<StockProducto[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data: productos, error } = await supabase
      .from("producto")
      .select("id, nombre, precio")
      .eq("negocio_id", negocioId)
      .eq("estado", "ACTIVO")
      .order("nombre");
    if (error) return { ok: false, error: error.message };

    const { data: stocks } = await supabase
      .from("producto_stock")
      .select("producto_id, stock_actual, stock_minimo")
      .eq("sede_id", sedeId)
      .in("producto_id", (productos ?? []).map((p) => p.id));
    const stockPorProducto = new Map((stocks ?? []).map((s) => [s.producto_id, s]));

    return {
      ok: true,
      data: (productos ?? []).map((p) => {
        const s = stockPorProducto.get(p.id);
        const stockActual = s?.stock_actual ?? 0;
        const stockMinimo = s?.stock_minimo ?? 0;
        return { productoId: p.id, nombre: p.nombre, precio: p.precio, stockActual, stockMinimo, enAlerta: stockActual <= stockMinimo };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function registrarMovimiento(datos: {
  productoId: string;
  sedeId: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  motivo?: string;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("registrar_movimiento_inventario", {
      p_producto_id: datos.productoId,
      p_sede_id: datos.sedeId,
      p_tipo: datos.tipo,
      p_cantidad: datos.cantidad,
      p_motivo: datos.motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function ajustarStock(productoId: string, sedeId: string, nuevoStockActual: number, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("ajustar_stock", {
      p_producto_id: productoId,
      p_sede_id: sedeId,
      p_nuevo_stock_actual: nuevoStockActual,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function configurarStockMinimo(productoId: string, sedeId: string, stockMinimo: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("configurar_stock_minimo", {
      p_producto_id: productoId,
      p_sede_id: sedeId,
      p_stock_minimo: stockMinimo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Solicitudes de reposición ────────────────────────────────────────────

export interface SolicitudReposicion {
  id: string;
  productoId: string;
  productoNombre: string;
  cantidadSolicitada: number;
  motivo: string | null;
  createdAt: string;
}

export async function listarSolicitudesPendientes(negocioId: string, sedeId?: string | null): Promise<Resultado<SolicitudReposicion[]>> {
  try {
    const { supabase } = await usuarioActual();
    let q = supabase
      .from("solicitud_reposicion")
      .select("id, producto_id, cantidad_solicitada, motivo, created_at, producto:producto_id (nombre)")
      .eq("negocio_id", negocioId)
      .eq("estado", "PENDIENTE")
      .order("created_at", { ascending: false });
    if (sedeId) q = q.eq("sede_id", sedeId);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((s) => ({
        id: s.id,
        productoId: s.producto_id,
        productoNombre: (s.producto as unknown as { nombre: string } | null)?.nombre ?? "Producto",
        cantidadSolicitada: s.cantidad_solicitada,
        motivo: s.motivo,
        createdAt: s.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearSolicitudReposicion(datos: {
  negocioId: string;
  sedeId: string;
  productoId: string;
  cantidadSolicitada: number;
  motivo?: string;
}): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    if (datos.cantidadSolicitada <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
    const { error } = await supabase.from("solicitud_reposicion").insert({
      negocio_id: datos.negocioId,
      sede_id: datos.sedeId,
      producto_id: datos.productoId,
      cantidad_solicitada: datos.cantidadSolicitada,
      motivo: datos.motivo || null,
      solicitado_por: userId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function atenderSolicitud(solicitudId: string, cantidadRecibida?: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("atender_solicitud_reposicion", {
      p_solicitud_id: solicitudId,
      p_cantidad_recibida: cantidadRecibida ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarSolicitud(solicitudId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("solicitud_reposicion").update({ estado: "CANCELADA" }).eq("id", solicitudId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/inventario");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Movimientos (historial) ──────────────────────────────────────────────

export interface MovimientoInventario {
  id: string;
  productoNombre: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  createdAt: string;
}

export async function listarMovimientos(negocioId: string, sedeId: string): Promise<Resultado<MovimientoInventario[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("movimiento_inventario")
      .select("id, tipo, cantidad, motivo, created_at, producto:producto_id (nombre)")
      .eq("negocio_id", negocioId)
      .eq("sede_id", sedeId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((m) => ({
        id: m.id,
        productoNombre: (m.producto as unknown as { nombre: string } | null)?.nombre ?? "Producto",
        tipo: m.tipo,
        cantidad: m.cantidad,
        motivo: m.motivo,
        createdAt: m.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Consumo automático por Servicio ──────────────────────────────────────

export interface ConsumoServicio {
  servicioId: string;
  servicioNombre: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
}

export async function listarConsumoPorServicio(negocioId: string): Promise<Resultado<ConsumoServicio[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data: servicios } = await supabase.from("servicio").select("id, nombre").eq("negocio_id", negocioId);
    const servicioIds = (servicios ?? []).map((s) => s.id);
    if (servicioIds.length === 0) return { ok: true, data: [] };
    const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));

    const { data, error } = await supabase
      .from("servicio_producto_consumo")
      .select("servicio_id, producto_id, cantidad, producto:producto_id (nombre)")
      .in("servicio_id", servicioIds);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((c) => ({
        servicioId: c.servicio_id,
        servicioNombre: nombrePorServicio.get(c.servicio_id) ?? "Servicio",
        productoId: c.producto_id,
        productoNombre: (c.producto as unknown as { nombre: string } | null)?.nombre ?? "Producto",
        cantidad: c.cantidad,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function configurarConsumo(servicioId: string, productoId: string, cantidad: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a 0." };
    const { error } = await supabase
      .from("servicio_producto_consumo")
      .upsert({ servicio_id: servicioId, producto_id: productoId, cantidad }, { onConflict: "servicio_id,producto_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/inventario/consumo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function quitarConsumo(servicioId: string, productoId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase
      .from("servicio_producto_consumo")
      .delete()
      .eq("servicio_id", servicioId)
      .eq("producto_id", productoId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/inventario/consumo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
