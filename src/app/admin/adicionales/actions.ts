"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * SuperAdmin · Barberos adicionales (FASE 2A, migraciones 177 y 178).
 * Patrón de /admin/planes y /admin/reglas: cada acción verifica la sesión aquí y la RPC vuelve a exigir `is_supersu()`, un motivo
 * (≥5 caracteres) y deja auditoría con valor anterior y nuevo. Nada del navegador se usa sin validar con zod. Cambiar un precio
 * nunca altera lotes vigentes. No hay reembolsos automáticos: aquí solo se REGISTRA la solicitud, la decisión y la ejecución manual.
 */

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  MOTIVO_REQUERIDO: "Escribe el motivo (mínimo 5 caracteres; queda en la auditoría).",
  PRECIO_INVALIDO: "El precio debe ser mayor que 0.",
  PAIS_INVALIDO: "País inválido.",
  CONFIG_INVALIDA: "La configuración no es coherente (el máximo por lote no puede superar el máximo por establecimiento).",
  VIGENCIA_INVALIDA: "La vigencia debe estar entre 1 día y el máximo configurado.",
  REFERENCIA_REQUERIDA: "Indica la referencia (transferencia o id del reembolso en Mercado Pago).",
  TRANSICION_NO_PERMITIDA: "Ese cambio de estado no está permitido desde el estado actual.",
  ADICIONAL_TRANSICION_NO_PERMITIDA: "Ese cambio de estado no está permitido desde el estado actual.",
  TRANSICION_REEMBOLSO_NO_PERMITIDA: "Ese paso del reembolso no está permitido desde su estado actual.",
  REEMBOLSO_YA_ABIERTO: "Ese pago ya tiene un reembolso abierto.",
  MAXIMO_POR_NEGOCIO_EXCEDIDO: "Se superaría el máximo de adicionales por establecimiento.",
  CANTIDAD_INVALIDA: "Cantidad inválida.",
  ACCION_INVALIDA: "Acción inválida.",
  NEGOCIO_NO_ACTIVO: "El negocio no está activo.",
  PAGO_NO_ES_ADICIONAL: "Ese pago no es de barberos adicionales.",
  adicional_config: "Algún valor de la configuración está fuera de rango.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos completar la acción.";
}

async function sesionSuperSU() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) throw new Error("NO_AUTORIZADO");
  return (supabase as unknown as RpcSinTipos).rpc.bind(supabase) as RpcSinTipos["rpc"];
}

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducir(e instanceof Error ? e.message : String(e)) };
}

async function llamar<T>(nombre: string, args: object): Promise<Resultado<T>> {
  try {
    const rpc = await sesionSuperSU();
    const { data, error } = await rpc(nombre, args);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/adicionales");
    return { ok: true, data: data as T } as Resultado<T>;
  } catch (e) {
    return fallo(e);
  }
}

const motivo = z.string().trim().min(5).max(500);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export interface ConfigAdicionales {
  habilitado: boolean;
  max_por_negocio: number;
  max_por_lote: number;
  periodo_dias: number;
  gracia_dias: number;
  avisos_dias_antes: number[];
  checkout_expira_horas: number;
  pago_pendiente_expira_dias: number;
  activacion_manual_max_dias: number;
}
export interface PrecioAdicional {
  pais_codigo: string;
  plan_codigo: string;
  precio_mensual: number;
  moneda: string;
  activo: boolean;
}
export interface DatosConfigAdicionales {
  config: ConfigAdicionales;
  precios: PrecioAdicional[];
  planes: { codigo: string; nombre: string }[];
  paises: string[];
  estados: { codigo: string; etiqueta_es: string; terminal: boolean; orden: number }[];
  transiciones: { desde: string; hacia: string; actores: string[] }[];
}
export interface FilaLote {
  id: string;
  negocio_id: string;
  negocio: string;
  plan_codigo: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  moneda: string;
  estado: string;
  origen: string;
  contratado_at: string;
  inicio_periodo_at: string | null;
  vigente_hasta: string | null;
  gracia_fin: string | null;
  dias_para_vencer: number | null;
  periodo_n: number;
  cancelar_renovacion: boolean;
  manual_tipo: string | null;
  cobros: number;
  cobros_fallidos: number;
  ultimo_mp_payment_id: string | null;
  revisiones_abiertas: number;
}
export interface Reembolso {
  id: string;
  lote_id: string | null;
  pago_id: string | null;
  negocio_id: string;
  negocio: string;
  monto: number;
  causa: string;
  estado: string;
  detalle: string | null;
  decision_motivo: string | null;
  referencia_ejecucion: string | null;
  mp_payment_id: string | null;
  created_at: string;
}
export interface Revision {
  id: string;
  pago_id: string;
  lote_id: string | null;
  negocio: string | null;
  motivo: string;
  estado: string;
  detalle: Record<string, unknown>;
  pago_estado: string;
  pago_monto: number;
  created_at: string;
}
export interface DetalleLote {
  lote: FilaLote & Record<string, unknown>;
  negocio: string;
  cobros: { id: string; periodo_n: number; monto: number; estado: string; mp_payment_id: string | null; pago_id: string; created_at: string }[];
  historial: { id: string; evento: string; estado_antes: string | null; estado_despues: string | null; actor_tipo: string; motivo: string | null; created_at: string }[];
  revisiones: Revision[];
  reembolsos: Reembolso[];
}

export async function obtenerAdicionalesAdmin(filtros: { estado?: string; negocioId?: string; texto?: string; venceAntes?: string } = {}) {
  try {
    const rpc = await sesionSuperSU();
    const f = {
      estado: filtros.estado || undefined,
      negocio_id: filtros.negocioId || undefined,
      texto: filtros.texto || undefined,
      vence_antes: filtros.venceAntes || undefined,
      limite: 100,
    };
    const [c, l, r, v] = await Promise.all([
      rpc("admin_adicional_config_obtener"),
      rpc("admin_adicional_listar", { p_filtros: f }),
      rpc("admin_adicional_reembolso_listar", { p_estado: null }),
      rpc("admin_adicional_revision_listar", { p_estado: "PENDIENTE" }),
    ]);
    for (const x of [c, l, r, v]) if (x.error) throw new Error(x.error.message);
    return {
      ok: true as const,
      data: {
        config: c.data as DatosConfigAdicionales,
        lotes: l.data as { total: number; filas: FilaLote[] },
        reembolsos: (r.data ?? []) as Reembolso[],
        revisiones: (v.data ?? []) as Revision[],
      },
    };
  } catch (e) {
    return fallo(e);
  }
}

export async function detalleLoteAdmin(loteId: string): Promise<Resultado<DetalleLote>> {
  if (!uuid.safeParse(loteId).success) return { ok: false, error: "Lote inválido." };
  return llamar<DetalleLote>("admin_adicional_detalle", { p_lote_id: loteId });
}

export async function guardarConfigAdicionales(d: Partial<ConfigAdicionales> & { motivo: string }): Promise<Resultado> {
  const p = z
    .object({
      habilitado: z.boolean().optional(),
      max_por_negocio: z.number().int().min(1).max(1000).optional(),
      max_por_lote: z.number().int().min(1).max(1000).optional(),
      periodo_dias: z.number().int().min(1).max(366).optional(),
      gracia_dias: z.number().int().min(0).max(60).optional(),
      avisos_dias_antes: z.array(z.number().int().min(1).max(30)).max(6).optional(),
      checkout_expira_horas: z.number().int().min(1).max(720).optional(),
      pago_pendiente_expira_dias: z.number().int().min(1).max(30).optional(),
      activacion_manual_max_dias: z.number().int().min(1).max(3660).optional(),
      motivo,
    })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa los valores (y escribe el motivo, mínimo 5 caracteres)." };
  const { motivo: m, ...config } = p.data;
  const r = await llamar("admin_adicional_config_guardar", { p_config: config, p_motivo: m });
  return r.ok ? { ok: true } : r;
}

export async function guardarPrecioAdicional(d: { pais: string; plan: string; precio: number; motivo: string; activo?: boolean }): Promise<Resultado> {
  const p = z
    .object({ pais: z.string().length(2), plan: z.enum(["ESSENTIAL", "STUDIO", "PRESTIGE", "SIGNATURE"]), precio: z.number().positive().max(100_000_000), motivo, activo: z.boolean().optional() })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa el precio y el motivo (mínimo 5 caracteres)." };
  const r = await llamar("admin_adicional_precio_guardar", { p_pais: p.data.pais, p_plan: p.data.plan, p_precio: p.data.precio, p_motivo: p.data.motivo, p_activo: p.data.activo ?? true });
  return r.ok ? { ok: true } : r;
}

export async function accionLoteAdmin(d: { loteId: string; accion: "SUSPENDER" | "REACTIVAR" | "CANCELAR" | "AJUSTAR"; motivo: string; dias?: number; cantidad?: number }): Promise<Resultado> {
  const p = z
    .object({ loteId: uuid, accion: z.enum(["SUSPENDER", "REACTIVAR", "CANCELAR", "AJUSTAR"]), motivo, dias: z.number().int().min(1).max(3660).optional(), cantidad: z.number().int().min(1).max(1000).optional() })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa los datos y el motivo (mínimo 5 caracteres)." };
  const datos = { ...(p.data.dias ? { dias: p.data.dias } : {}), ...(p.data.cantidad ? { cantidad: p.data.cantidad } : {}) };
  const r = await llamar("admin_adicional_accion", { p_lote_id: p.data.loteId, p_accion: p.data.accion, p_motivo: p.data.motivo, p_datos: datos });
  return r.ok ? { ok: true } : r;
}

export async function activarManualAdmin(d: { negocioId: string; cantidad: number; dias: number; tipo: "CORTESIA" | "TRANSFERENCIA" | "CONTINGENCIA_PASARELA"; motivo: string; referencia?: string }): Promise<Resultado> {
  const p = z
    .object({ negocioId: uuid, cantidad: z.number().int().min(1).max(1000), dias: z.number().int().min(1).max(3660), tipo: z.enum(["CORTESIA", "TRANSFERENCIA", "CONTINGENCIA_PASARELA"]), motivo, referencia: z.string().trim().max(200).optional() })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa los datos y el motivo (mínimo 5 caracteres)." };
  const r = await llamar("admin_adicional_activar_manual", { p_negocio_id: p.data.negocioId, p_cantidad: p.data.cantidad, p_dias: p.data.dias, p_tipo: p.data.tipo, p_motivo: p.data.motivo, p_referencia: p.data.referencia ?? null });
  return r.ok ? { ok: true } : r;
}

export async function solicitarReembolsoAdmin(d: { pagoId: string; causa: string; detalle: string; motivo: string; monto?: number }): Promise<Resultado> {
  const p = z
    .object({ pagoId: uuid, causa: z.enum(["COBRO_DUPLICADO", "COBRO_INCORRECTO", "ERROR_TECNICO", "PAGO_NO_RECONOCIDO", "OBLIGACION_LEGAL", "OTRO"]), detalle: z.string().trim().max(1000), motivo, monto: z.number().positive().optional() })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa los datos y el motivo (mínimo 5 caracteres)." };
  const r = await llamar("admin_adicional_reembolso_solicitar", { p_pago_id: p.data.pagoId, p_causa: p.data.causa, p_detalle: p.data.detalle, p_motivo: p.data.motivo, p_monto: p.data.monto ?? null });
  return r.ok ? { ok: true } : r;
}

export async function decidirReembolsoAdmin(d: { id: string; decision: "EN_REVISION" | "APROBADO" | "RECHAZADO" | "EJECUTADO_MANUAL"; motivo: string; referencia?: string; cerrarLote?: boolean }): Promise<Resultado> {
  const p = z
    .object({ id: uuid, decision: z.enum(["EN_REVISION", "APROBADO", "RECHAZADO", "EJECUTADO_MANUAL"]), motivo, referencia: z.string().trim().max(200).optional(), cerrarLote: z.boolean().optional() })
    .safeParse(d);
  if (!p.success) return { ok: false, error: "Revisa los datos y el motivo (mínimo 5 caracteres)." };
  const r = await llamar("admin_adicional_reembolso_decidir", { p_id: p.data.id, p_decision: p.data.decision, p_motivo: p.data.motivo, p_referencia: p.data.referencia ?? null, p_cerrar_lote: p.data.cerrarLote ?? false });
  return r.ok ? { ok: true } : r;
}

export async function resolverRevisionAdmin(d: { id: string; resolucion: string; motivo: string }): Promise<Resultado> {
  const p = z.object({ id: uuid, resolucion: z.string().trim().min(3).max(1000), motivo }).safeParse(d);
  if (!p.success) return { ok: false, error: "Escribe la resolución y el motivo (mínimo 5 caracteres)." };
  const r = await llamar("admin_adicional_revision_resolver", { p_id: p.data.id, p_resolucion: p.data.resolucion, p_motivo: p.data.motivo });
  return r.ok ? { ok: true } : r;
}
