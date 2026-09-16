"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso para esta acción.",
  COSTO_INVALIDO: "El costo en créditos no puede ser negativo.",
  ACCION_NO_ENCONTRADA: "Esa acción de IA no existe.",
  MODELO_NO_ENCONTRADO: "Ese modelo no existe en la configuración.",
  PAQUETE_NO_ENCONTRADO: "Ese paquete no existe.",
};
function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── AI Pricing Engine ──────────────────────────────────────────────────────
export interface AccionCostoIa {
  accion: string;
  categoria: string;
  nivelIa: number;
  costoProveedorEstimado: number;
  margenPct: number;
  costoCreditos: number;
  activo: boolean;
}

export async function listarAccionesCostoIa(): Promise<Resultado<AccionCostoIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_accion_costo").select("*").order("categoria").order("accion");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((a) => ({
      accion: a.accion,
      categoria: a.categoria,
      nivelIa: a.nivel_ia,
      costoProveedorEstimado: Number(a.costo_proveedor_estimado),
      margenPct: Number(a.margen_pct),
      costoCreditos: a.costo_creditos,
      activo: a.activo,
    })),
  };
}

export async function actualizarCostoAccionIa(
  accion: string,
  costoCreditos: number,
  activo: boolean
): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_accion_costo_ia", {
    p_accion: accion,
    p_costo_creditos: costoCreditos,
    p_activo: activo,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ── Cost Optimizer ──────────────────────────────────────────────────────────
export interface ModeloIa {
  nombre: string;
  proveedor: string;
  modeloId: string;
  ordenPreferencia: number;
  requiereCredencial: string | null;
  activo: boolean;
}

export async function listarModelosIa(): Promise<Resultado<ModeloIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_modelo_config").select("*").order("orden_preferencia");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((m) => ({
      nombre: m.nombre,
      proveedor: m.proveedor,
      modeloId: m.modelo_id,
      ordenPreferencia: m.orden_preferencia,
      requiereCredencial: m.requiere_credencial,
      activo: m.activo,
    })),
  };
}

export async function actualizarModeloIa(nombre: string, ordenPreferencia: number, activo: boolean): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_modelo_config_ia", {
    p_nombre: nombre,
    p_orden_preferencia: ordenPreferencia,
    p_activo: activo,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ── Paquetes de créditos ──────────────────────────────────────────────────
export interface PaqueteIa {
  id: string;
  nombre: string;
  creditos: number | null;
  precioCop: number | null;
  activo: boolean;
}

export async function listarPaquetesIa(): Promise<Resultado<PaqueteIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_paquete_creditos").select("*").order("creditos", { nullsFirst: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: data.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      creditos: p.creditos,
      precioCop: p.precio_cop !== null ? Number(p.precio_cop) : null,
      activo: p.activo,
    })),
  };
}

export async function actualizarPaqueteIa(id: string, precioCop: number | null, activo: boolean): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_paquete_creditos_ia", {
    p_paquete_id: id,
    // El parámetro SQL acepta NULL (paquete "Enterprise", sin autoservicio) —
    // el tipo generado lo marca `number` porque no tiene `default`, no
    // porque la columna sea NOT NULL. Cast seguro, PostgREST serializa
    // `null` igual sin importar el tipo TS declarado.
    p_precio_cop: precioCop as number,
    p_activo: activo,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ── Funciones por Plan ──────────────────────────────────────────────────────
export interface FuncionPlanIa {
  planCodigo: string;
  funcion: string;
  habilitado: boolean;
}

export async function listarFuncionesPlanIa(): Promise<Resultado<FuncionPlanIa[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_funcion_ia").select("*").order("funcion");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data.map((f) => ({ planCodigo: f.plan_codigo, funcion: f.funcion, habilitado: f.habilitado })) };
}

export async function configurarFuncionPlanIa(planCodigo: string, funcion: string, habilitado: boolean): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("configurar_funcion_plan_ia", {
    p_plan_codigo: planCodigo as "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER",
    p_funcion: funcion,
    p_habilitado: habilitado,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ── AI Cost Simulator ────────────────────────────────────────────────────────
export interface SimulacionIa {
  plan: string;
  creditosIncluidosPlan: number | null;
  creditosEstimadosConsumo: number;
  excedeCreditosIncluidos: boolean;
  costoProveedorEstimadoUsd: number;
  margenPctPromedio: number;
  precioPorCreditoPromedioCop: number;
}

export async function simularConsumoIa(planCodigo: string, numStaff: number, numClientes: number): Promise<Resultado<SimulacionIa>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simular_consumo_ia", {
    p_plan_codigo: planCodigo as "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER",
    p_num_staff: numStaff,
    p_num_clientes: numClientes,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  const s = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      plan: s.plan as string,
      creditosIncluidosPlan: s.creditosIncluidosPlan as number | null,
      creditosEstimadosConsumo: s.creditosEstimadosConsumo as number,
      excedeCreditosIncluidos: s.excedeCreditosIncluidos as boolean,
      costoProveedorEstimadoUsd: Number(s.costoProveedorEstimadoUsd),
      margenPctPromedio: Number(s.margenPctPromedio),
      precioPorCreditoPromedioCop: Number(s.precioPorCreditoPromedioCop),
    },
  };
}

// ── Resumen global de consumo (para el AI Center) ──────────────────────────
export interface ResumenConsumoIa {
  creditosConsumidosTotal: number;
  negociosActivosConsumiendo: number;
  costoProveedorEstimadoUsdTotal: number;
  consumoPorCategoria: { categoria: string; creditos: number }[];
}

export async function obtenerResumenConsumoIa(): Promise<Resultado<ResumenConsumoIa>> {
  const supabase = await createClient();
  const { data: consumos, error } = await supabase
    .from("credito_ia_consumo")
    .select("negocio_id, funcion, creditos_consumidos");
  if (error) return { ok: false, error: error.message };

  const { data: acciones } = await supabase.from("ai_accion_costo").select("accion, categoria, costo_proveedor_estimado, costo_creditos");
  const categoriaPorAccion = new Map((acciones ?? []).map((a) => [a.accion, a.categoria]));
  const costoUsdPorAccion = new Map((acciones ?? []).map((a) => [a.accion, Number(a.costo_proveedor_estimado)]));

  const negociosUnicos = new Set<string>();
  let creditosTotal = 0;
  let costoUsdTotal = 0;
  const porCategoria = new Map<string, number>();

  for (const c of consumos ?? []) {
    negociosUnicos.add(c.negocio_id);
    creditosTotal += c.creditos_consumidos;
    costoUsdTotal += costoUsdPorAccion.get(c.funcion) ?? 0;
    const categoria = categoriaPorAccion.get(c.funcion) ?? "OTRO";
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + c.creditos_consumidos);
  }

  return {
    ok: true,
    data: {
      creditosConsumidosTotal: creditosTotal,
      negociosActivosConsumiendo: negociosUnicos.size,
      costoProveedorEstimadoUsdTotal: Number(costoUsdTotal.toFixed(4)),
      consumoPorCategoria: Array.from(porCategoria.entries())
        .map(([categoria, creditos]) => ({ categoria, creditos }))
        .sort((a, b) => b.creditos - a.creditos),
    },
  };
}
