"use server";

import { crearPreferencia } from "@/lib/pagos/mercadopago";
import { sincronizarPago } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre este negocio.",
  ACCION_IA_NO_CONFIGURADA: "Esa función de IA no está configurada.",
  FUNCION_NO_INCLUIDA_EN_PLAN: "Esa función no está incluida en tu Plan actual.",
  CREDITOS_INSUFICIENTES: "No tenés créditos suficientes — comprá un paquete de recarga.",
  PAQUETE_NO_DISPONIBLE_AUTOSERVICIO: "Ese paquete requiere cotización manual con el equipo de StylerNow.",
  TIPO_NO_PERMITIDO_DESDE_NEGOCIO: "Ese tipo de prompt no se puede crear desde acá.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ── Créditos ────────────────────────────────────────────────────────────────
export async function obtenerSaldoCreditosIa(negocioId: string): Promise<Resultado<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("saldo_creditos_ia", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? 0 };
}

export interface ConsumoIa {
  id: string;
  funcion: string;
  nivel: number;
  creditosConsumidos: number;
  saldoRestante: number;
  createdAt: string;
}

export async function listarConsumoIa(negocioId: string): Promise<Resultado<ConsumoIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credito_ia_consumo")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((c) => ({
      id: c.id,
      funcion: c.funcion,
      nivel: c.nivel,
      creditosConsumidos: c.creditos_consumidos,
      saldoRestante: c.saldo_restante,
      createdAt: c.created_at,
    })),
  };
}

export interface PaqueteDisponibleIa {
  id: string;
  nombre: string;
  creditos: number;
  precioCop: number;
}

export async function listarPaquetesDisponiblesIa(): Promise<Resultado<PaqueteDisponibleIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_paquete_creditos")
    .select("*")
    .eq("activo", true)
    .not("precio_cop", "is", null)
    .order("creditos");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((p) => ({ id: p.id, nombre: p.nombre, creditos: p.creditos!, precioCop: Number(p.precio_cop) })),
  };
}

export type ResultadoInicioCompra = { ok: true; url: string; pagoId: string } | { ok: false; mensaje: string };

export async function comprarPaqueteIa(negocioId: string, paqueteId: string): Promise<ResultadoInicioCompra> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Iniciá sesión de nuevo." };

  const { data: pago, error } = await supabase.rpc("comprar_paquete_creditos_ia", {
    p_negocio_id: negocioId,
    p_paquete_id: paqueteId,
  });
  if (error) return { ok: false, mensaje: traducirError(error.message) };
  if (!pago) return { ok: false, mensaje: "No se pudo iniciar la compra." };

  const { data: negocio } = await supabase.from("negocio").select("nombre").eq("id", negocioId).single();
  const { data: paquete } = await supabase.from("ai_paquete_creditos").select("nombre").eq("id", paqueteId).single();

  const sitio = urlSitio();
  const esPublico = sitio.startsWith("https://");

  try {
    const preferencia = await crearPreferencia({
      pagoId: pago.id,
      titulo: `Paquete de créditos IA: ${paquete?.nombre ?? ""} · ${negocio?.nombre ?? "StylerNow"}`,
      monto: Number(pago.monto),
      emailPagador: user.email,
      urlRetorno: `${sitio}/panel/ia?desde=pago`,
      urlWebhook: esPublico ? `${sitio}/api/webhooks/pasarela/mercadopago` : null,
    });

    await createAdminClient().from("pago").update({ id_preferencia_pasarela: preferencia.id }).eq("id", pago.id);

    return { ok: true, url: preferencia.url, pagoId: pago.id };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "La pasarela no respondió. Intentá de nuevo." };
  }
}

export type EstadoCompraIa = { pago: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "SIN_PAGO" };

export async function consultarEstadoCompraIa(pagoId: string): Promise<EstadoCompraIa> {
  const supabase = await createClient();
  const { data: pago } = await supabase.from("pago").select("estado").eq("id", pagoId).maybeSingle();

  if (pago && pago.estado === "PENDIENTE") {
    try {
      await sincronizarPago(pagoId);
      const { data: actualizado } = await supabase.from("pago").select("estado").eq("id", pagoId).maybeSingle();
      return { pago: (actualizado?.estado as "APROBADO" | "RECHAZADO" | undefined) ?? "PENDIENTE" };
    } catch (e) {
      console.error("[panel/ia] no se pudo reconciliar el pago del paquete de créditos", e);
    }
  }

  return { pago: pago ? (pago.estado === "APROBADO" || pago.estado === "RECHAZADO" ? pago.estado : "PENDIENTE") : "SIN_PAGO" };
}

export async function listarFuncionesHabilitadasNegocio(negocioId: string): Promise<Resultado<string[]>> {
  const supabase = await createClient();
  const { data: negocio, error: errNegocio } = await supabase.from("negocio").select("plan_codigo").eq("id", negocioId).single();
  if (errNegocio) return { ok: false, error: errNegocio.message };
  const { data, error } = await supabase.from("plan_funcion_ia").select("funcion").eq("plan_codigo", negocio.plan_codigo).eq("habilitado", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data.map((f) => f.funcion) };
}

// ── AI Memory ────────────────────────────────────────────────────────────
export interface MemoriaIa {
  id: string;
  categoria: string;
  contenido: Record<string, unknown>;
  version: number;
  aprobado: boolean;
  createdAt: string;
}

export async function listarMemoriaIa(negocioId: string): Promise<Resultado<MemoriaIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_memoria_ia", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((m) => ({ id: m.id, categoria: m.categoria, contenido: m.contenido as Record<string, unknown>, version: m.version, aprobado: m.aprobado, createdAt: m.created_at })),
  };
}

export async function guardarMemoriaIa(negocioId: string, categoria: string, contenido: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_memoria_ia", { p_negocio_id: negocioId, p_categoria: categoria, p_contenido: contenido as Json });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/ia");
  return { ok: true };
}

export async function aprobarMemoriaIa(memoriaId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("aprobar_memoria_ia", { p_memoria_id: memoriaId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/ia");
  return { ok: true };
}

export async function olvidarMemoriaIa(memoriaId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("olvidar_memoria_ia", { p_memoria_id: memoriaId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/ia");
  return { ok: true };
}

export async function historialMemoriaIa(negocioId: string, categoria: string): Promise<Resultado<MemoriaIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("historial_memoria_ia", { p_negocio_id: negocioId, p_categoria: categoria });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((m) => ({ id: m.id, categoria: m.categoria, contenido: m.contenido as Record<string, unknown>, version: m.version, aprobado: m.aprobado, createdAt: m.created_at })),
  };
}

export async function restaurarVersionMemoriaIa(memoriaIdHistorica: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_version_memoria_ia", { p_memoria_id_historica: memoriaIdHistorica });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/ia");
  return { ok: true };
}

// ── Prompt Library ──────────────────────────────────────────────────────────
export interface PromptIa {
  id: string;
  tipo: string;
  categoria: string;
  nombre: string;
  contenido: string;
  variables: string[];
}

export async function listarPromptsIa(negocioId: string): Promise<Resultado<PromptIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_prompts_ia", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((p) => ({ id: p.id, tipo: p.tipo, categoria: p.categoria, nombre: p.nombre, contenido: p.contenido, variables: (p.variables as string[]) ?? [] })),
  };
}

export async function crearPromptIa(
  negocioId: string,
  tipo: "PROPIO" | "COMPARTIDO",
  categoria: string,
  nombre: string,
  contenido: string
): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_prompt_ia", { p_negocio_id: negocioId, p_tipo: tipo, p_categoria: categoria, p_nombre: nombre, p_contenido: contenido });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/ia");
  return { ok: true };
}

// ── ROI Dashboard IA — solo métricas reales, medibles hoy ───────────────────
// Las métricas de atribución (clientes recuperados, reservas generadas por
// IA, ventas atribuidas, tiempo ahorrado) NO se incluyen acá: no existe
// todavía ningún mecanismo de trazabilidad que vincule una sugerencia/acción
// de IA con un resultado de negocio posterior (ver TECH_DEBT_REGISTER.md).
// Se reportan honestamente como "no medible todavía" en la UI en vez de
// inventar un número.
export interface RoiIa {
  creditosConsumidosTotal: number;
  costoProveedorEstimadoUsdTotal: number;
  consumoPorCategoria: { categoria: string; creditos: number }[];
  consumoPorMes: { mes: string; creditos: number }[];
  campanasEjecutadasIa: number;
  // ADR-014, Fase C: atribución REAL (nunca estimada) — reservas cuyo
  // Cliente había confirmado una sugerencia de IA en los 30 días previos.
  // Ver ai_conversion (migración 079) y el handler del pipeline
  // _pipeline_ai_atribuir_conversion.
  conversionesTotal: number;
  montoAtribuidoTotal: number;
}

export async function obtenerRoiIa(negocioId: string): Promise<Resultado<RoiIa>> {
  const supabase = await createClient();
  const { data: consumos, error } = await supabase
    .from("credito_ia_consumo")
    .select("funcion, creditos_consumidos, created_at")
    .eq("negocio_id", negocioId);
  if (error) return { ok: false, error: error.message };

  const { data: acciones } = await supabase.from("ai_accion_costo").select("accion, categoria, costo_proveedor_estimado");
  const categoriaPorAccion = new Map((acciones ?? []).map((a) => [a.accion, a.categoria]));
  const costoUsdPorAccion = new Map((acciones ?? []).map((a) => [a.accion, Number(a.costo_proveedor_estimado)]));

  let creditosTotal = 0;
  let costoUsdTotal = 0;
  let campanasEjecutadas = 0;
  const porCategoria = new Map<string, number>();
  const porMes = new Map<string, number>();

  for (const c of consumos ?? []) {
    creditosTotal += c.creditos_consumidos;
    costoUsdTotal += costoUsdPorAccion.get(c.funcion) ?? 0;
    const categoria = categoriaPorAccion.get(c.funcion) ?? "OTRO";
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + c.creditos_consumidos);
    if (categoria === "CAMPANAS") campanasEjecutadas += 1;
    const mes = c.created_at.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + c.creditos_consumidos);
  }

  const { data: conversiones } = await supabase.from("ai_conversion").select("monto_atribuido").eq("negocio_id", negocioId);
  const montoAtribuidoTotal = (conversiones ?? []).reduce((acc, c) => acc + Number(c.monto_atribuido), 0);

  return {
    ok: true,
    data: {
      creditosConsumidosTotal: creditosTotal,
      costoProveedorEstimadoUsdTotal: Number(costoUsdTotal.toFixed(4)),
      consumoPorCategoria: Array.from(porCategoria.entries()).map(([categoria, creditos]) => ({ categoria, creditos })).sort((a, b) => b.creditos - a.creditos),
      consumoPorMes: Array.from(porMes.entries()).map(([mes, creditos]) => ({ mes, creditos })).sort((a, b) => a.mes.localeCompare(b.mes)),
      campanasEjecutadasIa: campanasEjecutadas,
      conversionesTotal: (conversiones ?? []).length,
      montoAtribuidoTotal,
    },
  };
}
