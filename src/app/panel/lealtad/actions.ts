"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre este negocio.",
  PRECIO_INVALIDO: "El precio debe ser mayor a 0.",
  DURACION_INVALIDA: "Elegí una duración válida.",
  CONGELACION_INVALIDA: "El máximo de congelación debe ser 0, 7, 15 o 30 días.",
  SELLOS_REQUERIDOS_INVALIDO: "La cantidad de sellos requeridos debe ser mayor a 0.",
  PORCENTAJE_INVALIDO: "El porcentaje debe estar entre 0 y 100.",
  RECOMPENSA_REQUERIDA: "Definí un monto o un porcentaje de recompensa.",
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

async function cliente() {
  return createClient();
}

// ── Membresías ──────────────────────────────────────────────────────────

export interface PlanMembresia {
  id: string; nombre: string; precio: number; duracionMeses: number; activo: boolean;
  limiteUsosMes: number | null; descuentoPct: number; congelacionMaxDias: number;
}

export async function listarPlanesMembresia(negocioId: string): Promise<Resultado<PlanMembresia[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("membresia_plan").select("id, nombre, precio, duracion_meses, activo, limite_usos_mes, descuento_pct, congelacion_max_dias").eq("negocio_id", negocioId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio), duracionMeses: p.duracion_meses, activo: p.activo, limiteUsosMes: p.limite_usos_mes, descuentoPct: Number(p.descuento_pct), congelacionMaxDias: p.congelacion_max_dias })) };
}

export async function crearPlanMembresia(datos: { negocioId: string; nombre: string; precio: number; duracionMeses: 1 | 3 | 6 | 12; congelacionMaxDias: 0 | 7 | 15 | 30 }): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("crear_plan_membresia", { p_negocio_id: datos.negocioId, p_nombre: datos.nombre, p_precio: datos.precio, p_duracion_meses: datos.duracionMeses, p_congelacion_max_dias: datos.congelacionMaxDias });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export async function alternarPlanMembresia(planId: string, activo: boolean): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("alternar_plan_membresia", { p_plan_id: planId, p_activo: activo });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Gift Cards ──────────────────────────────────────────────────────────

export interface GiftCardAdmin {
  id: string; codigo: string; montoOriginal: number; saldoActual: number; estado: string; createdAt: string;
}

export async function listarGiftCards(negocioId: string): Promise<Resultado<GiftCardAdmin[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("gift_card").select("id, codigo, monto_original, saldo_actual, estado, created_at").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((g) => ({ id: g.id, codigo: g.codigo, montoOriginal: Number(g.monto_original), saldoActual: Number(g.saldo_actual), estado: g.estado, createdAt: g.created_at })) };
}

export async function bloquearGiftCardAdmin(giftCardId: string, motivo: string): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("bloquear_gift_card", { p_gift_card_id: giftCardId, p_motivo: motivo });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Referidos ───────────────────────────────────────────────────────────

export interface ReferidoConfig {
  monto: number | null; porcentaje: number | null; limiteMensual: number | null; vigenciaDias: number; activo: boolean;
}

export async function obtenerConfigReferidos(negocioId: string): Promise<Resultado<ReferidoConfig | null>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("referido_config").select("monto, porcentaje, limite_mensual, vigencia_dias, activo").eq("negocio_id", negocioId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ? { monto: data.monto !== null ? Number(data.monto) : null, porcentaje: data.porcentaje !== null ? Number(data.porcentaje) : null, limiteMensual: data.limite_mensual, vigenciaDias: data.vigencia_dias, activo: data.activo } : null };
}

export async function configurarReferidosAction(datos: { negocioId: string; monto: number | null; porcentaje: number | null; limiteMensual: number | null; vigenciaDias: number; activo: boolean }): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("configurar_referidos", { p_negocio_id: datos.negocioId, p_monto: datos.monto, p_porcentaje: datos.porcentaje, p_limite_mensual: datos.limiteMensual, p_vigencia_dias: datos.vigenciaDias, p_activo: datos.activo } as never);
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Sellos ──────────────────────────────────────────────────────────────

export interface CampanaSellos {
  id: string; nombre: string; sellosRequeridos: number; recompensaDescripcion: string; estado: string;
}

export async function listarCampanasSellos(negocioId: string): Promise<Resultado<CampanaSellos[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("sello_campana").select("id, nombre, sellos_requeridos, recompensa_descripcion, estado").eq("negocio_id", negocioId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, sellosRequeridos: c.sellos_requeridos, recompensaDescripcion: c.recompensa_descripcion, estado: c.estado })) };
}

export async function crearCampanaSellosAction(datos: { negocioId: string; nombre: string; sellosRequeridos: number; recompensaDescripcion: string }): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("crear_campana_sellos", { p_negocio_id: datos.negocioId, p_nombre: datos.nombre, p_sellos_requeridos: datos.sellosRequeridos, p_recompensa_descripcion: datos.recompensaDescripcion });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export async function alternarCampanaSellosAction(campanaId: string, estado: "ACTIVA" | "PAUSADA" | "FINALIZADA"): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("alternar_campana_sellos", { p_campana_id: campanaId, p_estado: estado });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Cashback ────────────────────────────────────────────────────────────

export interface ReglaCashback {
  id: string; porcentaje: number; activo: boolean; limiteMensual: number | null;
}

export async function listarReglasCashback(negocioId: string): Promise<Resultado<ReglaCashback[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("cashback_regla").select("id, porcentaje, activo, limite_mensual").eq("negocio_id", negocioId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, porcentaje: Number(r.porcentaje), activo: r.activo, limiteMensual: r.limite_mensual !== null ? Number(r.limite_mensual) : null })) };
}

export async function crearReglaCashbackAction(datos: { negocioId: string; porcentaje: number; limiteMensual: number | null }): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("crear_regla_cashback", { p_negocio_id: datos.negocioId, p_porcentaje: datos.porcentaje, p_limite_mensual: datos.limiteMensual ?? undefined });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export async function alternarReglaCashbackAction(reglaId: string, activo: boolean): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("alternar_regla_cashback", { p_regla_id: reglaId, p_activo: activo });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Club VIP ────────────────────────────────────────────────────────────

export interface NivelVip {
  id: string; nombre: string; orden: number; beneficios: string | null;
}

export async function listarNivelesVip(negocioId: string): Promise<Resultado<NivelVip[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("vip_nivel").select("id, nombre, orden, beneficios").eq("negocio_id", negocioId).order("orden", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((n) => ({ id: n.id, nombre: n.nombre, orden: n.orden, beneficios: n.beneficios })) };
}

export async function sembrarNivelesVipAction(negocioId: string): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("sembrar_niveles_vip_default", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export interface MiembroVip {
  clienteId: string; clienteNombre: string; nivelNombre: string; origen: string;
}

export async function listarMiembrosVip(negocioId: string): Promise<Resultado<MiembroVip[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("vip_miembro").select("cliente_id, origen, perfil:cliente_id (nombre), vip_nivel:nivel_id (nombre)").eq("negocio_id", negocioId);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((m) => ({
      clienteId: m.cliente_id,
      clienteNombre: (m.perfil as unknown as { nombre: string } | null)?.nombre ?? "—",
      nivelNombre: (m.vip_nivel as unknown as { nombre: string } | null)?.nombre ?? "—",
      origen: m.origen,
    })),
  };
}

// ── Familias (solo lectura para la Barbería) ───────────────────────────

export interface FamiliaAdmin {
  id: string; nombre: string; titularNombre: string; miembros: number;
}

export async function listarFamiliasNegocio(negocioId: string): Promise<Resultado<FamiliaAdmin[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("familia_grupo").select("id, nombre, perfil:titular_cliente_id (nombre), familia_miembro (cliente_id)").eq("negocio_id", negocioId);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((f) => ({
      id: f.id, nombre: f.nombre,
      titularNombre: (f.perfil as unknown as { nombre: string } | null)?.nombre ?? "—",
      miembros: (f.familia_miembro as unknown[] | null)?.length ?? 0,
    })),
  };
}

// ── Corporativo ─────────────────────────────────────────────────────────

export interface CuentaCorporativa {
  id: string; nombreEmpresa: string; cuposTotales: number; vigenciaFin: string; activo: boolean;
}

export async function listarCuentasCorporativas(negocioId: string): Promise<Resultado<CuentaCorporativa[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("corporativo_cuenta").select("id, nombre_empresa, cupos_totales, vigencia_fin, activo").eq("negocio_id", negocioId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, nombreEmpresa: c.nombre_empresa, cuposTotales: c.cupos_totales, vigenciaFin: c.vigencia_fin, activo: c.activo })) };
}

export async function crearCuentaCorporativaAction(datos: { negocioId: string; nombreEmpresa: string; contactoEmail: string; cuposTotales: number; vigenciaFin: string }): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("crear_cuenta_corporativa", { p_nombre_empresa: datos.nombreEmpresa, p_contacto_email: datos.contactoEmail, p_cupos_totales: datos.cuposTotales, p_vigencia_fin: datos.vigenciaFin, p_negocio_id: datos.negocioId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

// ── Motor de recompensas ────────────────────────────────────────────────

export interface ReglaRecompensa {
  id: string; disparador: string; nivelIa: number; activo: boolean;
}

export async function listarReglasRecompensa(negocioId: string): Promise<Resultado<ReglaRecompensa[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.from("recompensa_regla").select("id, disparador, nivel_ia, activo").eq("negocio_id", negocioId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, disparador: r.disparador, nivelIa: r.nivel_ia, activo: r.activo })) };
}

export async function crearReglaRecompensaAction(datos: { negocioId: string; disparador: string; nivelIa: 0 | 1 | 2; montoCredito: number | null }): Promise<Resultado> {
  const supabase = await cliente();
  const accion = datos.montoCredito ? { tipo: "CREDITO_WALLET", monto: datos.montoCredito } : {};
  const { error } = await supabase.rpc("crear_regla_recompensa", { p_negocio_id: datos.negocioId, p_disparador: datos.disparador as never, p_nivel_ia: datos.nivelIa, p_condicion: {}, p_accion: accion as never });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export interface SugerenciaRecompensa {
  id: string; descripcion: string; justificacion: string | null; estado: string; clienteId: string | null; createdAt: string;
}

export async function listarSugerenciasAction(negocioId: string): Promise<Resultado<SugerenciaRecompensa[]>> {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("listar_sugerencias_recompensa", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true, data: (data ?? []).map((s) => ({ id: s.id, descripcion: s.descripcion, justificacion: s.justificacion, estado: s.estado, clienteId: s.cliente_id, createdAt: s.created_at })) };
}

export async function generarSugerenciasAction(negocioId: string): Promise<Resultado<{ generadas: number }>> {
  const supabase = await cliente();
  const { data: reglas, error: eReglas } = await supabase.from("recompensa_regla").select("id, disparador, nivel_ia").eq("negocio_id", negocioId).eq("activo", true);
  if (eReglas) return { ok: false, error: eReglas.message };

  let generadas = 0;
  for (const regla of reglas ?? []) {
    const { data: candidatos, error: eCand } = await supabase.rpc("evaluar_candidatos_recompensa", { p_regla_id: regla.id });
    if (eCand || !candidatos) continue;

    for (const cand of candidatos.slice(0, 20)) {
      let descripcion = "";
      switch (regla.disparador) {
        case "CLIENTE_INACTIVO":
        case "RIESGO_ABANDONO":
          descripcion = `Cliente sin visitar hace ${(cand.contexto as { dias_desde_ultima_visita?: number })?.dias_desde_ultima_visita ?? "varios"} días — considerá una promoción de reactivación.`;
          break;
        case "CUMPLEANOS":
          descripcion = `Hoy es el cumpleaños de ${(cand.contexto as { nombre?: string })?.nombre ?? "este Cliente"} — considerá un regalo o descuento especial.`;
          break;
        case "OBJETIVO_LOGRADO":
          descripcion = `Este Cliente alcanzó el objetivo de sellos de "${(cand.contexto as { campana?: string })?.campana ?? "una campaña"}".`;
          break;
        case "MEJOR_HORARIO":
          descripcion = `Franja con baja ocupación detectada — considerá una promoción en ese horario.`;
          break;
        default:
          descripcion = "Oportunidad detectada por el motor de recompensas.";
      }
      const { error: eCrear } = await supabase.rpc("crear_sugerencia_recompensa", { p_regla_id: regla.id, p_cliente_id: cand.cliente_id ?? undefined, p_descripcion: descripcion });
      if (!eCrear) generadas++;
    }
  }

  revalidatePath("/panel/lealtad");
  return { ok: true, data: { generadas } };
}

export async function confirmarSugerenciaAction(sugerenciaId: string): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("confirmar_sugerencia_recompensa", { p_sugerencia_id: sugerenciaId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}

export async function descartarSugerenciaAction(sugerenciaId: string): Promise<Resultado> {
  const supabase = await cliente();
  const { error } = await supabase.rpc("descartar_sugerencia_recompensa", { p_sugerencia_id: sugerenciaId });
  if (error) return { ok: false, error: traducirError(error.message) };
  revalidatePath("/panel/lealtad");
  return { ok: true };
}
