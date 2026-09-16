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
  COMISION_FUERA_DE_RANGO: "La comisión debe estar entre 3% y 15%.",
  CIUDAD_REQUERIDA: "Indicá una ciudad.",
  IMAGEN_REQUERIDA: "El banner necesita una imagen.",
  BANNER_NO_ENCONTRADO: "No encontramos ese banner.",
  PLAN_NO_ENCONTRADO: "No encontramos ese Plan.",
  TIPO_INVALIDO: "Tipo de texto legal inválido.",
  CONTENIDO_REQUERIDO: "El texto no puede estar vacío.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Comisión de plataforma ───────────────────────────────────────────────

export async function obtenerComisionGlobal(): Promise<Resultado<number>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("configuracion_plataforma")
      .select("comision_plataforma_pct_default")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: Number(data.comision_plataforma_pct_default) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Tarifas de referencia de Marketplace Ads ────────────────────────────

export interface TarifasAds {
  cpcDestacado: number;
  cpcPin: number;
  cpmPin: number;
}

export async function obtenerTarifasAds(): Promise<Resultado<TarifasAds>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.from("configuracion_plataforma").select("cpc_destacado_cop, cpc_pin_cop, cpm_pin_cop").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { cpcDestacado: Number(data.cpc_destacado_cop), cpcPin: Number(data.cpc_pin_cop), cpmPin: Number(data.cpm_pin_cop) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarTarifasAds(tarifas: TarifasAds): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_tarifas_ads", {
      p_cpc_destacado: tarifas.cpcDestacado,
      p_cpc_pin: tarifas.cpcPin,
      p_cpm_pin: tarifas.cpmPin,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface MetricasAdsPlataforma {
  gastoTotalPlataforma: number;
  campanasActivas: number;
}

export async function obtenerMetricasAdsPlataforma(): Promise<Resultado<MetricasAdsPlataforma>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("metricas_ads_plataforma");
    if (error) return { ok: false, error: traducirError(error.message) };
    const m = data as { gastoTotalPlataforma: number; campanasActivas: number };
    return { ok: true, data: { gastoTotalPlataforma: Number(m.gastoTotalPlataforma), campanasActivas: m.campanasActivas } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarComisionGlobal(pct: number): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_comision_plataforma_global", { p_pct: pct });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Ciudades habilitadas ─────────────────────────────────────────────────

export interface CiudadAdmin {
  ciudad: string;
  habilitada: boolean;
  negociosActivos: number;
}

export async function listarCiudades(): Promise<Resultado<CiudadAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    const [{ data: ciudades, error }, { data: negocios }] = await Promise.all([
      supabase.from("ciudad_habilitada").select("ciudad, habilitada").order("ciudad"),
      supabase.from("negocio").select("ciudad").eq("estado", "ACTIVO"),
    ]);
    if (error) return { ok: false, error: error.message };
    const conteo = new Map<string, number>();
    for (const n of negocios ?? []) conteo.set(n.ciudad, (conteo.get(n.ciudad) ?? 0) + 1);
    return {
      ok: true,
      data: (ciudades ?? []).map((c) => ({
        ciudad: c.ciudad,
        habilitada: c.habilitada,
        negociosActivos: conteo.get(c.ciudad) ?? 0,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarCiudad(ciudad: string, habilitada: boolean): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_ciudad_habilitada", { p_ciudad: ciudad, p_habilitada: habilitada });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Banners del Home ─────────────────────────────────────────────────────

export interface BannerAdmin {
  id: string;
  imagenUrl: string;
  texto: string | null;
  urlDestino: string | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  activo: boolean;
  orden: number;
}

export async function listarBanners(): Promise<Resultado<BannerAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("banner_home")
      .select("id, imagen_url, texto, url_destino, vigencia_desde, vigencia_hasta, activo, orden")
      .order("orden");
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((b) => ({
        id: b.id,
        imagenUrl: b.imagen_url,
        texto: b.texto,
        urlDestino: b.url_destino,
        vigenciaDesde: b.vigencia_desde,
        vigenciaHasta: b.vigencia_hasta,
        activo: b.activo,
        orden: b.orden,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearBanner(datos: {
  imagenUrl: string;
  texto: string;
  urlDestino: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  orden: number;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("crear_banner_home", {
      p_imagen_url: datos.imagenUrl,
      p_texto: datos.texto || undefined,
      p_url_destino: datos.urlDestino || undefined,
      p_vigencia_desde: datos.vigenciaDesde || undefined,
      p_vigencia_hasta: datos.vigenciaHasta || undefined,
      p_orden: datos.orden,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarBanner(
  id: string,
  datos: { activo: boolean }
): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_banner_home", {
      p_id: id,
      p_activo: datos.activo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarBanner(id: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("eliminar_banner_home", { p_id: id });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Planes SaaS ───────────────────────────────────────────────────────────

export interface PlanAdmin {
  codigo: string;
  nombre: string;
  precioMensual: number | null;
  limiteSedes: number | null;
  staffIncluido: number | null;
  staffAddonPrecio: number | null;
  sedeAddonPrecio: number | null;
  guardianDisponible: boolean;
  marketplaceAdsDisponible: boolean;
  creditosIaMes: number | null;
  conversacionesWhatsappMes: number | null;
}

export async function listarPlanes(): Promise<Resultado<PlanAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("plan")
      .select(
        "codigo, nombre, precio_mensual, limite_sedes, staff_incluido, staff_addon_precio, sede_addon_precio, guardian_disponible, marketplace_ads_disponible, creditos_ia_mes, conversaciones_whatsapp_mes"
      )
      .order("precio_mensual", { ascending: true, nullsFirst: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        precioMensual: p.precio_mensual,
        limiteSedes: p.limite_sedes,
        staffIncluido: p.staff_incluido,
        staffAddonPrecio: p.staff_addon_precio,
        sedeAddonPrecio: p.sede_addon_precio,
        guardianDisponible: p.guardian_disponible,
        marketplaceAdsDisponible: p.marketplace_ads_disponible,
        creditosIaMes: p.creditos_ia_mes,
        conversacionesWhatsappMes: p.conversaciones_whatsapp_mes,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarPlan(datos: {
  codigo: string;
  precioMensual: number | null;
  limiteSedes: number | null;
  staffIncluido: number | null;
  staffAddonPrecio: number | null;
  sedeAddonPrecio: number | null;
  guardianDisponible: boolean;
  marketplaceAdsDisponible: boolean;
  creditosIaMes: number | null;
  conversacionesWhatsappMes: number | null;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("actualizar_plan", {
      p_codigo: datos.codigo as "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER",
      p_precio_mensual: datos.precioMensual ?? undefined,
      p_limite_sedes: datos.limiteSedes ?? undefined,
      p_staff_incluido: datos.staffIncluido ?? undefined,
      p_staff_addon_precio: datos.staffAddonPrecio ?? undefined,
      p_sede_addon_precio: datos.sedeAddonPrecio ?? undefined,
      p_guardian_disponible: datos.guardianDisponible,
      p_marketplace_ads_disponible: datos.marketplaceAdsDisponible,
      p_creditos_ia_mes: datos.creditosIaMes ?? undefined,
      p_conversaciones_whatsapp_mes: datos.conversacionesWhatsappMes ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Textos legales ───────────────────────────────────────────────────────

export interface TextoLegalAdmin {
  id: string;
  tipo: string;
  version: number;
  contenido: string;
  cambioMaterial: boolean;
  publicadoAt: string;
}

export async function listarTextosLegales(): Promise<Resultado<TextoLegalAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("texto_legal")
      .select("id, tipo, version, contenido, cambio_material, publicado_at")
      .order("tipo")
      .order("version", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((t) => ({
        id: t.id,
        tipo: t.tipo,
        version: t.version,
        contenido: t.contenido,
        cambioMaterial: t.cambio_material,
        publicadoAt: t.publicado_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function publicarTextoLegal(tipo: string, contenido: string, cambioMaterial: boolean): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("publicar_texto_legal", {
      p_tipo: tipo,
      p_contenido: contenido,
      p_cambio_material: cambioMaterial,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
