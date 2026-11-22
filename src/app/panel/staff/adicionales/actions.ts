"use server";

import { crearPreferenciaDePago } from "@/lib/pagos/cobro";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { traducirErrorAdicional, type Cotizacion, type PanelAdicionales } from "@/lib/adicionales/tipos";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Barberos adicionales — acciones del PROPIETARIO (FASE 2A, pago manual por Checkout Pro).
 *
 * Cada acción exige sesión aquí y la base vuelve a exigir que sea el propietario (`is_barberia_de`): un administrador delegado o
 * cualquier otro rol recibe NO_AUTORIZADO. El navegador solo envía cantidad y el total que vio; el precio y el estado salen
 * siempre de la base, y NUNCA se activa nada por lo que diga esta capa: el cupo se activa cuando el webhook o la conciliación
 * confirman el pago con Mercado Pago (aplicar_evento_pago → _adicional_aplicar_pago).
 */

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const cantidadSchema = z.number().int().min(1).max(1000);

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, user, rpc: (supabase as unknown as RpcSinTipos).rpc.bind(supabase) as RpcSinTipos["rpc"] };
}

function falla(e: unknown): { ok: false; error: string } {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "NO_AUTENTICADO") return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  return { ok: false, error: traducirErrorAdicional(m) };
}

export async function obtenerPanelAdicionales(negocioId: string): Promise<Resultado<PanelAdicionales>> {
  try {
    if (!idSchema.safeParse(negocioId).success) return { ok: false, error: "Negocio inválido." };
    const { rpc } = await sesion();
    const { data, error } = await rpc("adicional_mis_lotes", { p_negocio_id: negocioId });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as PanelAdicionales };
  } catch (e) {
    return falla(e);
  }
}

export async function cotizarAdicionales(negocioId: string, cantidad: number): Promise<Resultado<Cotizacion>> {
  try {
    if (!idSchema.safeParse(negocioId).success || !cantidadSchema.safeParse(cantidad).success) return { ok: false, error: "Datos inválidos." };
    const { rpc } = await sesion();
    const { data, error } = await rpc("adicional_cotizar", { p_negocio_id: negocioId, p_cantidad: cantidad });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as Cotizacion };
  } catch (e) {
    return falla(e);
  }
}

/** Cierra en la base un cobro cuya preferencia no se pudo crear (para que el propietario pueda reintentar limpio). */
async function cerrarCobroFallido(loteId: string, usuarioId: string, motivo: string) {
  try {
    await (createAdminClient() as unknown as RpcSinTipos).rpc("adicional_checkout_fallido_srv", { p_lote_id: loteId, p_actor: usuarioId, p_motivo: motivo });
  } catch (e) {
    console.error("[adicionales] no se pudo cerrar el cobro fallido", loteId, e instanceof Error ? e.message : e);
  }
}

async function crearCheckout(pagoId: string, loteId: string, usuarioId: string, email: string | null | undefined, titulo: string) {
  try {
    const preferencia = await crearPreferenciaDePago({
      pagoId,
      titulo,
      emailPagador: email,
      urlRetorno: `${urlSitio()}/panel/staff/adicionales?desde=pago`,
    });
    return preferencia.url;
  } catch (e) {
    await cerrarCobroFallido(loteId, usuarioId, "PREFERENCIA_NO_CREADA");
    throw e;
  }
}

/**
 * Pasos 4-6 del flujo: el propietario confirmó el detalle → la base crea el lote (CHECKOUT_INICIADO) y el pago pendiente por el
 * total que ELLA calcula → aquí se crea la preferencia de Checkout Pro reutilizando el flujo de pago del plan.
 */
export async function contratarAdicionales(datos: { negocioId: string; cantidad: number; totalEsperado: number }): Promise<Resultado<{ url: string; pagoId: string; loteId: string }>> {
  try {
    const p = z.object({ negocioId: idSchema, cantidad: cantidadSchema, totalEsperado: z.number().positive() }).safeParse(datos);
    if (!p.success) return { ok: false, error: "Datos inválidos." };
    const { rpc, user } = await sesion();
    const { data, error } = await rpc("adicional_iniciar", { p_negocio_id: p.data.negocioId, p_cantidad: p.data.cantidad, p_total_esperado: p.data.totalEsperado });
    if (error) throw new Error(error.message);
    const r = data as { lote_id: string; pago_id: string };
    const url = await crearCheckout(r.pago_id, r.lote_id, user.id, user.email, `Barberos adicionales ×${p.data.cantidad} · StylerNow`);
    revalidatePath("/panel/staff/adicionales");
    return { ok: true, data: { url, pagoId: r.pago_id, loteId: r.lote_id } };
  } catch (e) {
    return falla(e);
  }
}

/** Renovar un grupo (vencido, en gracia, suspendido o dentro de la ventana de renovación): nuevo periodo al precio congelado del lote. */
export async function renovarAdicional(loteId: string): Promise<Resultado<{ url: string }>> {
  try {
    if (!idSchema.safeParse(loteId).success) return { ok: false, error: "Datos inválidos." };
    const { rpc, user } = await sesion();
    const { data, error } = await rpc("adicional_renovar", { p_lote_id: loteId });
    if (error) throw new Error(error.message);
    const r = data as { pago_id: string; lote_id: string; periodo_n: number };
    const url = await crearCheckout(r.pago_id, r.lote_id, user.id, user.email, `Renovación de barberos adicionales · StylerNow`);
    revalidatePath("/panel/staff/adicionales");
    return { ok: true, data: { url } };
  } catch (e) {
    return falla(e);
  }
}

export async function cancelarRenovacionAdicional(loteId: string, motivo?: string): Promise<Resultado> {
  try {
    if (!idSchema.safeParse(loteId).success) return { ok: false, error: "Datos inválidos." };
    const { rpc } = await sesion();
    const { error } = await rpc("adicional_cancelar_renovacion", { p_lote_id: loteId, p_motivo: motivo?.slice(0, 300) ?? null });
    if (error) throw new Error(error.message);
    revalidatePath("/panel/staff/adicionales");
    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

/**
 * Al volver de Mercado Pago (o desde el botón «Actualizar»): se reconsulta el estado REAL de cada pago pendiente de los lotes del
 * propietario (los ids salen de adicional_mis_lotes, ya autorizado) y se devuelve el panel actualizado. El retorno del navegador
 * por sí solo no activa nada.
 */
export async function actualizarEstadoAdicionales(negocioId: string): Promise<Resultado<PanelAdicionales>> {
  try {
    if (!idSchema.safeParse(negocioId).success) return { ok: false, error: "Negocio inválido." };
    const { rpc } = await sesion();
    const primero = await rpc("adicional_mis_lotes", { p_negocio_id: negocioId });
    if (primero.error) throw new Error(primero.error.message);
    const pendientes = ((primero.data as PanelAdicionales).lotes ?? []).map((l) => l.pago_pendiente_id).filter((x): x is string => !!x);
    for (const pagoId of pendientes) {
      try {
        await sincronizarPago(pagoId);
      } catch (e) {
        console.error("[adicionales] no se pudo reconciliar el pago", pagoId, e instanceof Error ? e.message : e);
      }
    }
    const { data, error } = await rpc("adicional_mis_lotes", { p_negocio_id: negocioId });
    if (error) throw new Error(error.message);
    revalidatePath("/panel/staff");
    return { ok: true, data: data as PanelAdicionales };
  } catch (e) {
    return falla(e);
  }
}
