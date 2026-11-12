"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

type PlanCodigo = Database["public"]["Enums"]["plan_codigo"];
const PLANES: PlanCodigo[] = ["ESSENTIAL", "STUDIO", "PRESTIGE", "SIGNATURE"];
const PASARELAS = ["MERCADOPAGO", "STRIPE", "PAYONEER", "MANUAL"] as const;
const PAISES_VALIDOS = ["CO", "US", "MX", "ES"];

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  PAIS_NO_ENCONTRADO: "No encontramos ese país.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

function mensajeDe(e: unknown) {
  return traducirError(e instanceof Error ? e.message : "Error inesperado.");
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

// ── Lectura ──────────────────────────────────────────────────────────────

export interface PaisPlanes {
  codigo: string;
  nombre: string;
  moneda: string;
  locale: string;
  activo: boolean;
  pasarela: string;
  cobroRecurrente: boolean;
  precioMasImpuesto: boolean;
  impuestoPct: number | null;
  fundadorDescuentoPct: number;
  fundadorCupos: number;
  fundadorMeses: number;
  anualMesesPagados: number;
  cuposRestantes: number | null;
}
export interface PlanBase {
  codigo: PlanCodigo;
  nombre: string;
}
export interface PrecioPlan {
  plan: PlanCodigo;
  pais: string;
  precioMensual: number | null;
  esDesde: boolean;
  precioStaffExtra: number | null;
  precioSedeExtra: number | null;
  activo: boolean;
}
export interface PrecioAddon {
  pais: string;
  precioMensual: number | null;
}
export interface Caracteristica {
  plan: PlanCodigo;
  clave: string;
  habilitado: boolean;
  valor: string | null;
}
export interface DatosPlanes {
  paises: PaisPlanes[];
  planes: PlanBase[];
  precios: PrecioPlan[];
  addons: PrecioAddon[];
  caracteristicas: Caracteristica[];
}

export async function obtenerDatosPlanes(): Promise<Resultado<DatosPlanes>> {
  try {
    const { supabase } = await usuarioActual();
    const [paisRes, planRes, precioRes, addonRes, carRes] = await Promise.all([
      supabase.from("pais").select("*").order("codigo"),
      supabase.from("plan").select("codigo, nombre"),
      supabase.from("plan_precio").select("*"),
      supabase.from("addon_precio").select("pais_codigo, precio_mensual").eq("addon_codigo", "MI_MARCA"),
      supabase.from("plan_caracteristica").select("plan_codigo, clave, habilitado, valor").order("clave"),
    ]);
    const fallo = paisRes.error ?? planRes.error ?? precioRes.error ?? addonRes.error ?? carRes.error;
    if (fallo) return { ok: false, error: traducirError(fallo.message) };

    const paises = (paisRes.data ?? []).filter((p) => PAISES_VALIDOS.includes(p.codigo));
    const cupos = await Promise.all(
      paises.map(async (p) => {
        const { data } = await supabase.rpc("fundador_cupos_restantes", { p_pais: p.codigo });
        return typeof data === "number" ? data : null;
      })
    );

    return {
      ok: true,
      data: {
        paises: paises.map((p, i) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          moneda: p.moneda,
          locale: p.locale,
          activo: p.activo,
          pasarela: p.pasarela,
          cobroRecurrente: p.cobro_recurrente_habilitado,
          precioMasImpuesto: p.precio_mas_impuesto,
          impuestoPct: num(p.impuesto_pct),
          fundadorDescuentoPct: Number(p.fundador_descuento_pct),
          fundadorCupos: p.fundador_cupos,
          fundadorMeses: p.fundador_meses,
          anualMesesPagados: p.anual_meses_pagados,
          cuposRestantes: cupos[i],
        })),
        planes: PLANES.map((c) => ({ codigo: c, nombre: (planRes.data ?? []).find((x) => x.codigo === c)?.nombre ?? c })),
        precios: (precioRes.data ?? []).map((r) => ({
          plan: r.plan_codigo,
          pais: r.pais_codigo,
          precioMensual: num(r.precio_mensual),
          esDesde: r.es_desde,
          precioStaffExtra: num(r.precio_staff_extra),
          precioSedeExtra: num(r.precio_sede_extra),
          activo: r.activo,
        })),
        addons: (addonRes.data ?? []).map((r) => ({ pais: r.pais_codigo, precioMensual: num(r.precio_mensual) })),
        caracteristicas: (carRes.data ?? []).map((r) => ({
          plan: r.plan_codigo,
          clave: r.clave,
          habilitado: r.habilitado,
          valor: r.valor,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: mensajeDe(e) };
  }
}

// ── Escritura (todas vía RPC; SECURITY DEFINER valida is_supersu) ────────

export interface AjustesPais {
  codigo: string;
  activo: boolean;
  pasarela: string;
  cobroRecurrente: boolean;
  fundadorDescuentoPct: number;
  fundadorCupos: number;
  fundadorMeses: number;
  impuestoPct: number | null;
  precioMasImpuesto: boolean;
}

export async function guardarAjustesPais(a: AjustesPais): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!PAISES_VALIDOS.includes(a.codigo)) return { ok: false, error: "País inválido." };
    if (!(PASARELAS as readonly string[]).includes(a.pasarela)) return { ok: false, error: "Pasarela inválida." };
    if (!(a.fundadorDescuentoPct >= 0 && a.fundadorDescuentoPct <= 100)) return { ok: false, error: "El descuento fundador debe estar entre 0 y 100." };
    if (!Number.isInteger(a.fundadorCupos) || a.fundadorCupos < 0) return { ok: false, error: "Los cupos deben ser un entero de 0 o más." };
    if (!Number.isInteger(a.fundadorMeses) || a.fundadorMeses < 1) return { ok: false, error: "Los meses fundador deben ser al menos 1." };
    if (a.impuestoPct !== null && !(a.impuestoPct >= 0 && a.impuestoPct <= 100)) return { ok: false, error: "El impuesto debe estar entre 0 y 100." };
    const { error } = await supabase.rpc("admin_set_pais", {
      p_codigo: a.codigo,
      p_activo: a.activo,
      p_pasarela: a.pasarela,
      p_cobro_recurrente: a.cobroRecurrente,
      p_fundador_descuento_pct: a.fundadorDescuentoPct,
      p_fundador_cupos: a.fundadorCupos,
      p_fundador_meses: a.fundadorMeses,
      p_impuesto_pct: a.impuestoPct as number,
      p_precio_mas_impuesto: a.precioMasImpuesto,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/planes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDe(e) };
  }
}

export async function guardarPrecioPlan(p: PrecioPlan): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!PAISES_VALIDOS.includes(p.pais) || !PLANES.includes(p.plan)) return { ok: false, error: "Plan o país inválido." };
    for (const v of [p.precioMensual, p.precioStaffExtra, p.precioSedeExtra]) {
      if (v !== null && !(Number.isFinite(v) && v >= 0)) return { ok: false, error: "Los precios deben ser números de 0 o más." };
    }
    const { error } = await supabase.rpc("admin_set_plan_precio", {
      p_plan: p.plan,
      p_pais: p.pais,
      p_precio_mensual: p.precioMensual as number,
      p_es_desde: p.esDesde,
      p_precio_staff_extra: p.precioStaffExtra as number,
      p_precio_sede_extra: p.precioSedeExtra as number,
      p_activo: p.activo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/planes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDe(e) };
  }
}

export async function guardarPrecioAddon(pais: string, precio: number | null): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!PAISES_VALIDOS.includes(pais)) return { ok: false, error: "País inválido." };
    if (precio !== null && !(Number.isFinite(precio) && precio >= 0)) return { ok: false, error: "El precio debe ser un número de 0 o más." };
    const { error } = await supabase.rpc("admin_set_addon_precio", { p_addon: "MI_MARCA", p_pais: pais, p_precio: precio as number });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/planes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDe(e) };
  }
}

export async function guardarCaracteristica(c: Caracteristica): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    if (!PLANES.includes(c.plan)) return { ok: false, error: "Plan inválido." };
    if (!/^[a-z0-9_]{1,60}$/.test(c.clave)) return { ok: false, error: "Clave inválida." };
    const valor = c.valor && c.valor.trim() ? c.valor.trim().slice(0, 120) : null;
    const { error } = await supabase.rpc("admin_set_plan_caracteristica", {
      p_plan: c.plan,
      p_clave: c.clave,
      p_habilitado: c.habilitado,
      p_valor: valor as string,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/planes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDe(e) };
  }
}
