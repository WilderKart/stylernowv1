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
  NO_AUTORIZADO: "No tenés permiso para cobrar esta reserva.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa reserva.",
  RESERVA_NO_COMPLETABLE: "Esta reserva ya fue cobrada o no está confirmada.",
  PRODUCTO_NO_DISPONIBLE: "Uno de los productos elegidos ya no está disponible.",
  METODO_PAGO_INVALIDO: "Elegí un método de pago válido.",
  MONTO_INVALIDO: "Revisá los montos ingresados.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Productos ─────────────────────────────────────────────────────────────

export interface ProductoPOS {
  id: string;
  nombre: string;
  precio: number;
  estado: "ACTIVO" | "INACTIVO";
}

export async function listarProductos(negocioId: string): Promise<Resultado<ProductoPOS[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("producto")
      .select("id, nombre, precio, estado")
      .eq("negocio_id", negocioId)
      .order("estado")
      .order("nombre");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearProducto(negocioId: string, nombre: string, precio: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!nombre.trim()) return { ok: false, error: "El nombre no puede estar vacío." };
    if (precio < 0) return { ok: false, error: "El precio no puede ser negativo." };
    const { error } = await supabase.from("producto").insert({ negocio_id: negocioId, nombre: nombre.trim(), precio });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/pos/productos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarProducto(id: string, nombre: string, precio: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!nombre.trim()) return { ok: false, error: "El nombre no puede estar vacío." };
    if (precio < 0) return { ok: false, error: "El precio no puede ser negativo." };
    const { error } = await supabase.from("producto").update({ nombre: nombre.trim(), precio }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/pos/productos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cambiarEstadoProducto(id: string, activar: boolean): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("producto").update({ estado: activar ? "ACTIVO" : "INACTIVO" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/pos/productos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Reservas listas para cobrar ─────────────────────────────────────────

export interface ReservaParaCobrar {
  id: string;
  horaInicio: string;
  clienteId: string;
  clienteNombre: string;
  staffNombre: string | null;
  servicios: string;
  montoTotal: number;
  montoSena: number;
}

export async function listarReservasParaCobrar(negocioId: string, sedeId?: string | null): Promise<Resultado<ReservaParaCobrar[]>> {
  try {
    const { supabase } = await usuarioActual();
    const inicioDia = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}T00:00:00-05:00`).toISOString();

    let q = supabase
      .from("reserva")
      .select(
        `id, hora_inicio, monto_total, monto_sena,
         cliente:cliente_id (id, nombre),
         staff:staff_id (nombre),
         reserva_servicio (servicio:servicio_id (nombre))`
      )
      .eq("negocio_id", negocioId)
      .in("estado", ["CONFIRMADA", "EN_CURSO"])
      .lte("hora_inicio", new Date().toISOString())
      .gte("hora_inicio", inicioDia)
      .order("hora_inicio", { ascending: true });
    if (sedeId) q = q.eq("sede_id", sedeId);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id,
        horaInicio: r.hora_inicio,
        clienteId: (r.cliente as unknown as { id: string; nombre: string } | null)?.id ?? "",
        clienteNombre: (r.cliente as unknown as { id: string; nombre: string } | null)?.nombre ?? "Cliente",
        staffNombre: (r.staff as unknown as { nombre: string } | null)?.nombre ?? null,
        montoTotal: r.monto_total,
        montoSena: r.monto_sena,
        servicios: (r.reserva_servicio ?? [])
          .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
          .filter(Boolean)
          .join(" + "),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function obtenerPuntosDisponibles(negocioId: string, clienteId: string): Promise<Resultado<number>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("punto_fidelizacion")
      .select("cantidad_disponible")
      .eq("negocio_id", negocioId)
      .eq("cliente_id", clienteId)
      .gt("fecha_expiracion", new Date().toISOString());
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).reduce((acc, p) => acc + p.cantidad_disponible, 0) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Completar venta ───────────────────────────────────────────────────────

export interface ResultadoVenta {
  saldoCobrado: number;
  descuentoPuntos: number;
  propina: number;
  puntosCanjeados: number;
  puntosOtorgados: number;
}

export async function completarVenta(datos: {
  reservaId: string;
  productos: { productoId: string; cantidad: number }[];
  metodoPagoSaldo: "EFECTIVO" | "DATAFONO_PROPIO";
  propina?: number;
  metodoPagoPropina?: "EFECTIVO" | "DATAFONO_PROPIO";
  puntosACanjear?: number;
}): Promise<Resultado<ResultadoVenta>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("completar_venta_pos", {
      p_reserva_id: datos.reservaId,
      p_productos: datos.productos.map((p) => ({ producto_id: p.productoId, cantidad: p.cantidad })),
      p_metodo_pago_saldo: datos.metodoPagoSaldo,
      p_propina: datos.propina ?? 0,
      p_metodo_pago_propina: datos.metodoPagoPropina ?? "EFECTIVO",
      p_puntos_a_canjear: datos.puntosACanjear ?? 0,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    const r = data as {
      saldo_cobrado: number;
      descuento_puntos: number;
      propina: number;
      puntos_canjeados: number;
      puntos_otorgados: number;
    };

    // El ascenso VIP automático (Lealtad, ADR-011) ya no se llama desde
    // acá: es un handler del Pipeline de Eventos venta_completada
    // (migración 070-072), ejecutado dentro de la misma transacción de
    // completar_venta_pos() con aislamiento de fallos real.
    revalidatePath("/panel/pos");
    revalidatePath("/panel/agenda");
    return {
      ok: true,
      data: {
        saldoCobrado: r.saldo_cobrado,
        descuentoPuntos: r.descuento_puntos,
        propina: r.propina,
        puntosCanjeados: r.puntos_canjeados,
        puntosOtorgados: r.puntos_otorgados,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Cierre de caja ───────────────────────────────────────────────────────

export interface CierreCaja {
  fecha: string;
  efectivo: number;
  digital: number;
  total: number;
}

export async function obtenerCierreCaja(negocioId: string, sedeId?: string | null, fecha?: string): Promise<Resultado<CierreCaja>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("cierre_caja_dia", {
      p_negocio_id: negocioId,
      p_sede_id: sedeId ?? undefined,
      p_fecha: fecha ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    const r = data as { fecha: string; efectivo: number; digital: number; total: number };
    return { ok: true, data: { fecha: r.fecha, efectivo: r.efectivo, digital: r.digital, total: r.total } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
