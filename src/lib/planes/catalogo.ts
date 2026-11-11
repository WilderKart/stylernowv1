import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MonedaCodigo } from "./moneda";

export type PlanCodigo = "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER";

export interface PaisPlanes {
  codigo: string;
  nombre: string;
  moneda: MonedaCodigo;
  locale: string;
  precioMasImpuesto: boolean;
  fundadorDescuentoPct: number;
  fundadorMeses: number;
  mesesPagadosAnual: number;
  cuposFundadorRestantes: number;
  cobroRecurrenteHabilitado: boolean;
}

export interface PlanPais {
  codigo: PlanCodigo;
  nombre: string;
  /** null = a cotizar. */
  precioMensual: number | null;
  esDesde: boolean;
  limiteSedes: number | null;
  staffIncluido: number | null;
  precioStaffExtra: number | null;
  precioSedeExtra: number | null;
  /** clave → { habilitado, valor } según plan_caracteristica. */
  caracteristicas: Record<string, { habilitado: boolean; valor: string | null }>;
}

export interface CatalogoPais {
  pais: PaisPlanes;
  planes: PlanPais[];
  precioMiMarca: number | null;
}

export const PAISES_ACTIVOS_DEFECTO = "CO";

/** Países activos (para selectores de país en registro y Super Admin). */
export async function listarPaisesActivos() {
  const supabase = await createClient();
  const { data } = await supabase.from("pais").select("codigo, nombre, moneda, locale").eq("activo", true).order("nombre");
  return data ?? [];
}

/** Planes y precios de un país, leídos de la BD (plan × plan_precio × plan_caracteristica). */
export async function obtenerCatalogoPais(paisCodigo: string): Promise<CatalogoPais | null> {
  const supabase = await createClient();

  const [{ data: pais }, { data: planes }, { data: precios }, { data: carac }, { data: addon }, { data: cupos }] = await Promise.all([
    supabase.from("pais").select("*").eq("codigo", paisCodigo).eq("activo", true).maybeSingle(),
    supabase.from("plan").select("codigo, nombre, limite_sedes, staff_incluido"),
    supabase.from("plan_precio").select("*").eq("pais_codigo", paisCodigo).eq("activo", true),
    supabase.from("plan_caracteristica").select("plan_codigo, clave, habilitado, valor"),
    supabase.from("addon_precio").select("precio_mensual").eq("addon_codigo", "MI_MARCA").eq("pais_codigo", paisCodigo).maybeSingle(),
    supabase.rpc("fundador_cupos_restantes", { p_pais: paisCodigo }),
  ]);
  if (!pais) return null;

  const precioPorPlan = new Map((precios ?? []).map((p) => [p.plan_codigo, p]));
  const ORDEN: PlanCodigo[] = ["RAVEN", "JARL", "VALHALLA", "ALLFATHER"];

  const lista: PlanPais[] = ORDEN.flatMap((codigo) => {
    const base = (planes ?? []).find((p) => p.codigo === codigo);
    const precio = precioPorPlan.get(codigo);
    if (!base || !precio) return []; // un plan sin precio activo en este país no se ofrece
    const caracteristicas: PlanPais["caracteristicas"] = {};
    for (const c of carac ?? []) {
      if (c.plan_codigo === codigo) caracteristicas[c.clave] = { habilitado: c.habilitado, valor: c.valor };
    }
    return [
      {
        codigo,
        nombre: base.nombre,
        precioMensual: precio.precio_mensual !== null ? Number(precio.precio_mensual) : null,
        esDesde: precio.es_desde,
        limiteSedes: base.limite_sedes,
        staffIncluido: base.staff_incluido,
        precioStaffExtra: precio.precio_staff_extra !== null ? Number(precio.precio_staff_extra) : null,
        precioSedeExtra: precio.precio_sede_extra !== null ? Number(precio.precio_sede_extra) : null,
        caracteristicas,
      },
    ];
  });

  return {
    pais: {
      codigo: pais.codigo,
      nombre: pais.nombre,
      moneda: pais.moneda as MonedaCodigo,
      locale: pais.locale,
      precioMasImpuesto: pais.precio_mas_impuesto,
      fundadorDescuentoPct: Number(pais.fundador_descuento_pct),
      fundadorMeses: pais.fundador_meses,
      mesesPagadosAnual: pais.anual_meses_pagados,
      cuposFundadorRestantes: typeof cupos === "number" ? cupos : 0,
      cobroRecurrenteHabilitado: pais.cobro_recurrente_habilitado,
    },
    planes: lista,
    precioMiMarca: addon?.precio_mensual != null ? Number(addon.precio_mensual) : null,
  };
}
