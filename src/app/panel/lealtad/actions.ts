"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { exigirOperativo, MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { chatJSON } from "@/lib/ia/ai-provider";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Disparador de Lealtad -> acción de la matriz del AI Pricing Engine (ADR-013). */
const ACCION_IA_POR_DISPARADOR: Record<string, string> = {
  CLIENTE_INACTIVO: "prediccion_abandono",
  RIESGO_ABANDONO: "prediccion_abandono",
  CUMPLEANOS: "recomendacion",
  OBJETIVO_LOGRADO: "recomendacion",
};

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  SUSCRIPCION_RESTRINGIDA: MENSAJE_RESTRINGIDA,
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  FUNCION_NO_INCLUIDA: "Esta función no está incluida en tu plan. Mejora tu plan desde Mi Plan para usarla.",
  PRECIO_INVALIDO: "El precio debe ser mayor a 0.",
  DURACION_INVALIDA: "Elige una duración válida.",
  CONGELACION_INVALIDA: "El máximo de congelación debe ser 0, 7, 15 o 30 días.",
  SELLOS_REQUERIDOS_INVALIDO: "La cantidad de sellos requeridos debe ser mayor a 0.",
  PORCENTAJE_INVALIDO: "El porcentaje debe estar entre 0 y 100.",
  RECOMPENSA_REQUERIDA: "Define un monto o un porcentaje de recompensa.",
  MONTO_INVALIDO: "Monto inválido.",
  CANTIDAD_INVALIDA: "Cantidad inválida (máximo 500 por lote).",
  ORDEN_INVALIDO: "El orden debe ser mayor a 0.",
  NIVELES_YA_EXISTEN: "Este negocio ya tiene niveles VIP configurados.",
  NIVEL_NO_ENCONTRADO: "Nivel VIP no encontrado.",
  CUPOS_INVALIDOS: "La cantidad de cupos debe ser mayor a 0.",
  VIGENCIA_INVALIDA: "La fecha de vigencia debe ser futura.",
  DISPARADOR_INVALIDO: "Disparador inválido.",
  NIVEL_IA_INVALIDO: "Nivel de IA inválido.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducirError(e instanceof Error ? e.message : String(e)) };
}

async function cliente() {
  return createClient();
}

const uuid = z.string().uuid("Identificador inválido.");

async function sesionDuenoLealtad(
  negocioId: string,
  opciones?: { requerirOperativo?: boolean; funcion?: "membresias" | "fidelizacion" }
) {
  const id = uuid.parse(negocioId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id || contexto.negocioId !== id) {
    throw new Error("NO_AUTORIZADO");
  }
  if (opciones?.requerirOperativo) {
    const operativo = await exigirOperativo(id);
    if (!operativo.ok) throw new Error("SUSCRIPCION_RESTRINGIDA");
  }
  if (opciones?.funcion) {
    const { data: incluida } = await supabase.rpc("negocio_tiene_funcion", {
      p_negocio_id: id,
      p_clave: opciones.funcion,
    });
    if (incluida !== true) throw new Error("FUNCION_NO_INCLUIDA");
  }
  return { supabase, negocioId: id, userId: user.id };
}

async function exigirNegocioDeRecurso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabla: "membresia_plan" | "sello_campana" | "cashback_regla" | "gift_card" | "recompensa_regla" | "recompensa_sugerencia",
  recursoId: string
) {
  const id = uuid.parse(recursoId);
  const { data } = await supabase.from(tabla).select("negocio_id").eq("id", id).maybeSingle();
  const negocioId = (data as { negocio_id?: string | null } | null)?.negocio_id;
  if (!negocioId) throw new Error("NO_AUTORIZADO");
  return negocioId;
}



// ── Membresías ──────────────────────────────────────────────────────────

export interface PlanMembresia {
  id: string; nombre: string; precio: number; duracionMeses: number; activo: boolean;
  limiteUsosMes: number | null; descuentoPct: number; congelacionMaxDias: number;
}

export async function listarPlanesMembresia(negocioId: string): Promise<Resultado<PlanMembresia[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("membresia_plan").select("id, nombre, precio, duracion_meses, activo, limite_usos_mes, descuento_pct, congelacion_max_dias").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio), duracionMeses: p.duracion_meses, activo: p.activo, limiteUsosMes: p.limite_usos_mes, descuentoPct: Number(p.descuento_pct), congelacionMaxDias: p.congelacion_max_dias })) };
  } catch (e) { return fallo(e); }
}

const esquemaPlanMembresia = z.object({ negocioId: uuid, nombre: z.string().trim().min(2).max(80), precio: z.number().finite().nonnegative(), duracionMeses: z.union([z.literal(1),z.literal(3),z.literal(6),z.literal(12)]), congelacionMaxDias: z.union([z.literal(0),z.literal(7),z.literal(15),z.literal(30)]) });
export async function crearPlanMembresia(datos: z.input<typeof esquemaPlanMembresia>): Promise<Resultado> {
  const p = esquemaPlanMembresia.safeParse(datos); if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try { const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("crear_plan_membresia", { p_negocio_id: negocioId, p_nombre: p.data.nombre, p_precio: p.data.precio, p_duracion_meses: p.data.duracionMeses, p_congelacion_max_dias: p.data.congelacionMaxDias });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function alternarPlanMembresia(planId: string, activo: boolean): Promise<Resultado> {
  const id = uuid.safeParse(planId); if (!id.success || typeof activo !== "boolean") return { ok: false, error: "Datos inv?lidos." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "membresia_plan", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("alternar_plan_membresia", { p_plan_id: id.data, p_activo: activo });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

// ── Gift Cards ──────────────────────────────────────────────────────────

export interface GiftCardAdmin {
  id: string; codigo: string; montoOriginal: number; saldoActual: number; estado: string; createdAt: string;
}

export async function listarGiftCards(negocioId: string): Promise<Resultado<GiftCardAdmin[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("gift_card").select("id, codigo, monto_original, saldo_actual, estado, created_at").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((g) => ({ id: g.id, codigo: g.codigo, montoOriginal: Number(g.monto_original), saldoActual: Number(g.saldo_actual), estado: g.estado, createdAt: g.created_at })) };
  } catch (e) { return fallo(e); }
}

export async function bloquearGiftCardAdmin(giftCardId: string, motivo: string): Promise<Resultado> {
  const id = uuid.safeParse(giftCardId); const m = z.string().trim().min(3).max(300).safeParse(motivo);
  if (!id.success || !m.success) return { ok: false, error: "Motivo inv?lido." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "gift_card", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("bloquear_gift_card", { p_gift_card_id: id.data, p_motivo: m.data });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

// Referidos

export interface ReferidoConfig {
  monto: number | null; porcentaje: number | null; limiteMensual: number | null; vigenciaDias: number; activo: boolean;
}

const esquemaReferidos = z.object({
  negocioId: uuid,
  monto: z.number().finite().positive().nullable(),
  porcentaje: z.number().finite().min(0.01).max(100).nullable(),
  limiteMensual: z.number().int().min(1).max(10_000).nullable(),
  vigenciaDias: z.number().int().min(1).max(365),
  activo: z.boolean(),
}).superRefine((v, ctx) => {
  const tieneMonto = v.monto != null;
  const tienePorcentaje = v.porcentaje != null;
  if (tieneMonto === tienePorcentaje) ctx.addIssue({ code: "custom", message: "Define solo monto o porcentaje de recompensa." });
});

export async function obtenerConfigReferidos(negocioId: string): Promise<Resultado<ReferidoConfig | null>> {
  try {
    const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase
      .from("referido_config")
      .select("monto, porcentaje, limite_mensual, vigencia_dias, activo")
      .eq("negocio_id", id)
      .maybeSingle();
    if (error) return { ok: false, error: traducirError(error.message) };
    return {
      ok: true,
      data: data ? {
        monto: data.monto !== null ? Number(data.monto) : null,
        porcentaje: data.porcentaje !== null ? Number(data.porcentaje) : null,
        limiteMensual: data.limite_mensual,
        vigenciaDias: data.vigencia_dias,
        activo: data.activo,
      } : null,
    };
  } catch (e) {
    return fallo(e);
  }
}

export async function configurarReferidosAction(datos: z.input<typeof esquemaReferidos>): Promise<Resultado> {
  const p = esquemaReferidos.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try {
    const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("configurar_referidos", {
      p_negocio_id: negocioId,
      p_monto: p.data.monto,
      p_porcentaje: p.data.porcentaje,
      p_limite_mensual: p.data.limiteMensual,
      p_vigencia_dias: p.data.vigenciaDias,
      p_activo: p.data.activo,
    } as never);
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/lealtad");
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

// ── Sellos ──────────────────────────────────────────────────────────────

export interface CampanaSellos {
  id: string; nombre: string; sellosRequeridos: number; recompensaDescripcion: string; estado: string;
}
const esquemaSellos = z.object({ negocioId: uuid, nombre: z.string().trim().min(2).max(80), sellosRequeridos: z.number().int().min(1).max(10_000), recompensaDescripcion: z.string().trim().min(2).max(300) });
export async function listarCampanasSellos(negocioId: string): Promise<Resultado<CampanaSellos[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("sello_campana").select("id, nombre, sellos_requeridos, recompensa_descripcion, estado").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, sellosRequeridos: c.sellos_requeridos, recompensaDescripcion: c.recompensa_descripcion, estado: c.estado })) };
  } catch (e) { return fallo(e); }
}
export async function crearCampanaSellosAction(datos: z.input<typeof esquemaSellos>): Promise<Resultado> {
  const p = esquemaSellos.safeParse(datos); if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try { const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("crear_campana_sellos", { p_negocio_id: negocioId, p_nombre: p.data.nombre, p_sellos_requeridos: p.data.sellosRequeridos, p_recompensa_descripcion: p.data.recompensaDescripcion });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}
export async function alternarCampanaSellosAction(campanaId: string, estado: "ACTIVA" | "PAUSADA" | "FINALIZADA"): Promise<Resultado> {
  const id = uuid.safeParse(campanaId); const est = z.enum(["ACTIVA","PAUSADA","FINALIZADA"]).safeParse(estado);
  if (!id.success || !est.success) return { ok: false, error: "Datos inv?lidos." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "sello_campana", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("alternar_campana_sellos", { p_campana_id: id.data, p_estado: est.data });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

// Cashback
export interface ReglaCashback { id: string; porcentaje: number; activo: boolean; limiteMensual: number | null; }
const esquemaCashback = z.object({ negocioId: uuid, porcentaje: z.number().finite().min(0.01).max(100), limiteMensual: z.number().finite().positive().nullable() });
export async function listarReglasCashback(negocioId: string): Promise<Resultado<ReglaCashback[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("cashback_regla").select("id, porcentaje, activo, limite_mensual").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, porcentaje: Number(r.porcentaje), activo: r.activo, limiteMensual: r.limite_mensual !== null ? Number(r.limite_mensual) : null })) };
  } catch (e) { return fallo(e); }
}
export async function crearReglaCashbackAction(datos: z.input<typeof esquemaCashback>): Promise<Resultado> {
  const p = esquemaCashback.safeParse(datos); if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try { const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("crear_regla_cashback", { p_negocio_id: negocioId, p_porcentaje: p.data.porcentaje, p_limite_mensual: p.data.limiteMensual ?? undefined });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}
export async function alternarReglaCashbackAction(reglaId: string, activo: boolean): Promise<Resultado> {
  const id = uuid.safeParse(reglaId); if (!id.success || typeof activo !== "boolean") return { ok: false, error: "Datos inv?lidos." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "cashback_regla", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("alternar_regla_cashback", { p_regla_id: id.data, p_activo: activo });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

// ── Club VIP ────────────────────────────────────────────────────────────

export interface NivelVip {
  id: string; nombre: string; orden: number; beneficios: string | null;
}

export async function listarNivelesVip(negocioId: string): Promise<Resultado<NivelVip[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("vip_nivel").select("id, nombre, orden, beneficios").eq("negocio_id", id).order("orden", { ascending: true }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((n) => ({ id: n.id, nombre: n.nombre, orden: n.orden, beneficios: n.beneficios })) };
  } catch (e) { return fallo(e); }
}

export async function sembrarNivelesVipAction(negocioId: string): Promise<Resultado> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("sembrar_niveles_vip_default", { p_negocio_id: id });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

export interface MiembroVip {
  clienteId: string; clienteNombre: string; nivelNombre: string; origen: string;
}

export async function listarMiembrosVip(negocioId: string): Promise<Resultado<MiembroVip[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("vip_miembro").select("cliente_id, origen, perfil:cliente_id (nombre), vip_nivel:nivel_id (nombre)").eq("negocio_id", id).limit(200);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((m) => ({ clienteId: m.cliente_id, clienteNombre: (m.perfil as unknown as { nombre: string } | null)?.nombre ?? "?", nivelNombre: (m.vip_nivel as unknown as { nombre: string } | null)?.nombre ?? "?", origen: m.origen })) };
  } catch (e) { return fallo(e); }
}

// ── Familias (solo lectura para la Barbería) ───────────────────────────

export interface FamiliaAdmin {
  id: string; nombre: string; titularNombre: string; miembros: number;
}

export async function listarFamiliasNegocio(negocioId: string): Promise<Resultado<FamiliaAdmin[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("familia_grupo").select("id, nombre, perfil:titular_cliente_id (nombre), familia_miembro (cliente_id)").eq("negocio_id", id).limit(200);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((f) => ({ id: f.id, nombre: f.nombre, titularNombre: (f.perfil as unknown as { nombre: string } | null)?.nombre ?? "?", miembros: (f.familia_miembro as unknown[] | null)?.length ?? 0 })) };
  } catch (e) { return fallo(e); }
}

// ── Corporativo ─────────────────────────────────────────────────────────

export interface CuentaCorporativa {
  id: string; nombreEmpresa: string; cuposTotales: number; vigenciaFin: string; activo: boolean;
}

export async function listarCuentasCorporativas(negocioId: string): Promise<Resultado<CuentaCorporativa[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("corporativo_cuenta").select("id, nombre_empresa, cupos_totales, vigencia_fin, activo").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, nombreEmpresa: c.nombre_empresa, cuposTotales: c.cupos_totales, vigenciaFin: c.vigencia_fin, activo: c.activo })) };
  } catch (e) { return fallo(e); }
}

const esquemaCorporativo = z.object({ negocioId: uuid, nombreEmpresa: z.string().trim().min(2).max(120), contactoEmail: z.string().trim().email().max(120), cuposTotales: z.number().int().min(1).max(10_000), vigenciaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export async function crearCuentaCorporativaAction(datos: z.input<typeof esquemaCorporativo>): Promise<Resultado> {
  const p = esquemaCorporativo.safeParse(datos); if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try { const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("crear_cuenta_corporativa", { p_nombre_empresa: p.data.nombreEmpresa, p_contacto_email: p.data.contactoEmail, p_cupos_totales: p.data.cuposTotales, p_vigencia_fin: p.data.vigenciaFin, p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

// ── Motor de recompensas ────────────────────────────────────────────────

export interface ReglaRecompensa {
  id: string; disparador: string; nivelIa: number; activo: boolean;
}

export async function listarReglasRecompensa(negocioId: string): Promise<Resultado<ReglaRecompensa[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.from("recompensa_regla").select("id, disparador, nivel_ia, activo").eq("negocio_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, disparador: r.disparador, nivelIa: r.nivel_ia, activo: r.activo })) };
  } catch (e) { return fallo(e); }
}

const esquemaReglaRecompensa = z.object({ negocioId: uuid, disparador: z.enum(["CLIENTE_INACTIVO","CUMPLEANOS","OBJETIVO_LOGRADO","RIESGO_ABANDONO","MEJOR_HORARIO"]), nivelIa: z.union([z.literal(0),z.literal(1),z.literal(2)]), montoCredito: z.number().finite().positive().nullable() });
export async function crearReglaRecompensaAction(datos: z.input<typeof esquemaReglaRecompensa>): Promise<Resultado> {
  const p = esquemaReglaRecompensa.safeParse(datos); if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inv?lidos." };
  try { const { supabase, negocioId } = await sesionDuenoLealtad(p.data.negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const accion = p.data.montoCredito ? { tipo: "CREDITO_WALLET", monto: p.data.montoCredito } : {};
    const { error } = await supabase.rpc("crear_regla_recompensa", { p_negocio_id: negocioId, p_disparador: p.data.disparador as never, p_nivel_ia: p.data.nivelIa, p_condicion: {}, p_accion: accion as never });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

export interface SugerenciaRecompensa { id: string; descripcion: string; justificacion: string | null; estado: string; clienteId: string | null; createdAt: string; }

export async function listarSugerenciasAction(negocioId: string): Promise<Resultado<SugerenciaRecompensa[]>> {
  try { const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { funcion: "fidelizacion" });
    const { data, error } = await supabase.rpc("listar_sugerencias_recompensa", { p_negocio_id: id });
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map((s) => ({ id: s.id, descripcion: s.descripcion, justificacion: s.justificacion, estado: s.estado, clienteId: s.cliente_id, createdAt: s.created_at })) };
  } catch (e) { return fallo(e); }
}

function descripcionPlantilla(disparador: string, contexto: Record<string, unknown>): string {
  switch (disparador) {
    case "CLIENTE_INACTIVO":
    case "RIESGO_ABANDONO":
      return `Cliente sin visitar hace ${(contexto.dias_desde_ultima_visita as number | undefined) ?? "varios"} días — considera una promoción de reactivación.`;
    case "CUMPLEANOS":
      return `Hoy es el cumpleaños de ${(contexto.nombre as string | undefined) ?? "este Cliente"} — considera un regalo o descuento especial.`;
    case "OBJETIVO_LOGRADO":
      return `Este Cliente alcanzó el objetivo de sellos de "${(contexto.campana as string | undefined) ?? "una campaña"}".`;
    case "MEJOR_HORARIO":
      return "Franja con baja ocupación detectada — considera una promoción en ese horario.";
    default:
      return "Oportunidad detectada por el motor de recompensas.";
  }
}

/**
 * Módulo 12 (ADR-011) + AI Reward Engine (ADR-013): Nivel 0 usa una
 * plantilla fija (gratis, sin IA real). Nivel 1/2 llama al AIProvider
 * real (OpenRouter/Nemotron, con failover) para redactar una sugerencia
 * más elaborada, informada por la AI Memory del propio Negocio (tono de
 * comunicación) — y consume créditos IA del Negocio vía el Credit Meter
 * ANTES de llamar al proveedor (el costo del proveedor se incurre igual
 * si la respuesta después no sirve; "StylerNow nunca subsidia IA").
 */
async function redactarSugerenciaConIA(negocioId: string, disparador: string, contexto: Record<string, unknown>, nivel: 0 | 1 | 2, admin: ReturnType<typeof createAdminClient>): Promise<{ descripcion: string; justificacion: string | null; costoCreditos: number } | null> {
  const accion = ACCION_IA_POR_DISPARADOR[disparador];
  if (!accion) return null;

  const { data: consumo, error: eConsumo } = await admin.rpc("consumir_creditos_ia", { p_negocio_id: negocioId, p_accion: accion, p_referencia_tipo: "recompensa_regla" });
  if (eConsumo) return null; // sin créditos o función no incluida en el Plan — cae a la plantilla Nivel 0, nunca rompe el flujo.

  const { data: memoriaTono } = await admin.from("ai_memoria_negocio").select("contenido").eq("negocio_id", negocioId).eq("categoria", "TONO").eq("vigente", true).maybeSingle();
  const tono = (memoriaTono?.contenido as { descripcion?: string } | undefined)?.descripcion;

  try {
    const resultado = await chatJSON<{ descripcion: string; justificacion: string }>(
      [
        {
          role: "system",
          content: `Eres el asistente de marketing de una barbería/salón en Colombia usando StylerNow.${tono ? ` Tono de comunicación de este negocio: ${tono}.` : ""} Responde SOLO con JSON: {"descripcion": "sugerencia breve y accionable en español, máximo 140 caracteres", "justificacion": "por qué, citando el dato concreto, máximo 100 caracteres"}.`,
        },
        { role: "user", content: `Disparador: ${disparador}. Contexto: ${JSON.stringify(contexto)}.` },
      ],
      { nivel: 2, maxTokens: 200, supabase: admin }
    );
    return { descripcion: resultado.descripcion, justificacion: resultado.justificacion, costoCreditos: (consumo as { creditosConsumidos: number })?.creditosConsumidos ?? 0 };
  } catch {
    // El proveedor falló tras agotar el failover — la plantilla Nivel 0 sigue disponible como respaldo honesto.
    return null;
  }
}

export async function generarSugerenciasAction(negocioId: string): Promise<Resultado<{ generadas: number; conIaReal: number }>> {
  try {
    const { supabase, negocioId: id } = await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const admin = createAdminClient();
    const { data: reglas, error: eReglas } = await supabase.from("recompensa_regla").select("id, disparador, nivel_ia").eq("negocio_id", id).eq("activo", true);
    if (eReglas) return { ok: false, error: traducirError(eReglas.message) };

    let generadas = 0;
    let conIaReal = 0;
    for (const regla of reglas ?? []) {
      const { data: candidatos, error: eCand } = await supabase.rpc("evaluar_candidatos_recompensa", { p_regla_id: regla.id });
      if (eCand || !candidatos) continue;

      for (const cand of candidatos.slice(0, 20)) {
        const contexto = (cand.contexto ?? {}) as Record<string, unknown>;
        let descripcion = "";
        let justificacion: string | undefined;
        let costoCreditos = 0;

        const nivel = regla.nivel_ia as 0 | 1 | 2;
        if (nivel >= 1) {
          const ia = await redactarSugerenciaConIA(id, regla.disparador, contexto, nivel, admin);
          if (ia) {
            descripcion = ia.descripcion;
            justificacion = ia.justificacion ?? undefined;
            costoCreditos = ia.costoCreditos;
            conIaReal++;
          } else {
            descripcion = descripcionPlantilla(regla.disparador, contexto);
          }
        } else {
          descripcion = descripcionPlantilla(regla.disparador, contexto);
        }

        const { error: eCrear } = await supabase.rpc("crear_sugerencia_recompensa", {
          p_regla_id: regla.id, p_cliente_id: cand.cliente_id ?? undefined, p_descripcion: descripcion,
          p_justificacion: justificacion ?? undefined, p_costo_credito_ia: costoCreditos,
        });
        if (!eCrear) generadas++;
      }
    }

    revalidatePath("/panel/lealtad");
    return { ok: true, data: { generadas, conIaReal } };
  } catch (e) { return fallo(e); }
}

export async function confirmarSugerenciaAction(sugerenciaId: string): Promise<Resultado> {
  const id = uuid.safeParse(sugerenciaId); if (!id.success) return { ok: false, error: "Datos inv?lidos." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "recompensa_sugerencia", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("confirmar_sugerencia_recompensa", { p_sugerencia_id: id.data });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function descartarSugerenciaAction(sugerenciaId: string): Promise<Resultado> {
  const id = uuid.safeParse(sugerenciaId); if (!id.success) return { ok: false, error: "Datos inv?lidos." };
  try { const supabase = await createClient(); const negocioId = await exigirNegocioDeRecurso(supabase, "recompensa_sugerencia", id.data);
    await sesionDuenoLealtad(negocioId, { requerirOperativo: true, funcion: "fidelizacion" });
    const { error } = await supabase.rpc("descartar_sugerencia_recompensa", { p_sugerencia_id: id.data });
    if (error) return { ok: false, error: traducirError(error.message) }; revalidatePath("/panel/lealtad"); return { ok: true };
  } catch (e) { return fallo(e); }
}
