"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Reglas operativas centralizadas (Directiva §6): límites de la política de cancelación,
 * prueba gratuita, comisión de reservas y reembolsos que requieren revisión.
 *
 * Cada acción verifica la sesión aquí y la RPC vuelve a exigir `is_supersu()` y un motivo,
 * y deja auditoría con valor anterior y nuevo. Nada de lo que llega del navegador se usa
 * sin validar con zod.
 */

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  MOTIVO_REQUERIDO: "Escribe el motivo del cambio (queda en la auditoría).",
  COMISION_FUERA_DE_RANGO: "La comisión debe estar entre 0 % y 15 %.",
  VIGENCIA_RETROACTIVA_NO_PERMITIDA: "La fecha de vigencia no puede estar en el pasado.",
  CAMBIO_NO_ANULABLE: "Ese cambio ya se aplicó o ya estaba anulado.",
  REEMBOLSO_NO_REINTENTABLE: "Ese reembolso no está en revisión ni fallido.",
  politica_limites_coherentes: "Los límites no son coherentes (mínimo ≤ máximo, 0–100 %).",
  prueba_config_valida: "Configuración de prueba inválida (1–90 días, gracia 0–30, avisos coherentes).",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos guardar el cambio.";
}

async function sesionSuperSU() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) throw new Error("NO_AUTORIZADO");
  return supabase;
}

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: traducir(e instanceof Error ? e.message : String(e)) };
}

export interface DatosReglas {
  limites: { totalMin: number; totalMax: number; parcialMin: number; pctMin: number; pctMax: number; maxIntentos: number };
  prueba: { dias: number; modalidad: "SIN_TARJETA" | "CON_TARJETA" | "AMBAS"; graciaDias: number; aviso1: number; aviso2: number };
  comisionDefault: number;
  cambiosComision: {
    id: string;
    negocioId: string | null;
    pctNuevo: number;
    efectivoDesde: string;
    motivo: string;
    aplicadoAt: string | null;
    anuladoAt: string | null;
  }[];
  reembolsosRevision: {
    id: string;
    monto: number;
    estado: string;
    intentos: number;
    ultimoError: string | null;
    negocioId: string | null;
    createdAt: string;
  }[];
}

export async function obtenerReglas(): Promise<Resultado<DatosReglas>> {
  try {
    const supabase = await sesionSuperSU();
    // Tabla de la migración 117, aún sin tipos generados.
    const sinTipos = supabase as unknown as {
      from: (t: "comision_cambio_programado") => {
        select: (c: string) => {
          order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
        };
      };
    };
    const [{ data: c, error: ec }, { data: cambios }, { data: reembolsos }] = await Promise.all([
      supabase.from("configuracion_plataforma").select("*").eq("id", true).single(),
      sinTipos
        .from("comision_cambio_programado")
        .select("id, negocio_id, pct_nuevo, efectivo_desde, motivo, aplicado_at, anulado_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reembolso")
        .select("id, monto, estado, intentos, ultimo_error, negocio_id, created_at")
        .in("estado", ["REQUIERE_REVISION", "FALLIDO"])
        .order("created_at", { ascending: true })
        .limit(50),
    ]);
    if (ec || !c) return fallo(ec?.message ?? "SIN_DATOS");
    const cfg = c as unknown as Record<string, number | string>;
    return {
      ok: true,
      data: {
        limites: {
          totalMin: Number(cfg.politica_total_min_horas ?? 6),
          totalMax: Number(cfg.politica_total_max_horas ?? 72),
          parcialMin: Number(cfg.politica_parcial_min_horas ?? 0),
          pctMin: Number(cfg.politica_pct_parcial_min ?? 0),
          pctMax: Number(cfg.politica_pct_parcial_max ?? 100),
          maxIntentos: Number(cfg.reembolso_max_intentos ?? 5),
        },
        prueba: {
          dias: Number(cfg.prueba_dias ?? 14),
          modalidad: (cfg.prueba_modalidad as DatosReglas["prueba"]["modalidad"]) ?? "SIN_TARJETA",
          graciaDias: Number(cfg.suscripcion_gracia_dias ?? 3),
          aviso1: Number(cfg.prueba_aviso_dias_1 ?? 3),
          aviso2: Number(cfg.prueba_aviso_dias_2 ?? 1),
        },
        comisionDefault: Number(cfg.comision_plataforma_pct_default ?? 0),
        cambiosComision: ((cambios ?? []) as unknown as Record<string, string | number | null>[]).map((x) => ({
          id: String(x.id),
          negocioId: (x.negocio_id as string | null) ?? null,
          pctNuevo: Number(x.pct_nuevo),
          efectivoDesde: String(x.efectivo_desde),
          motivo: String(x.motivo),
          aplicadoAt: (x.aplicado_at as string | null) ?? null,
          anuladoAt: (x.anulado_at as string | null) ?? null,
        })),
        reembolsosRevision: (reembolsos ?? []).map((r) => ({
          id: r.id,
          monto: Number(r.monto),
          estado: r.estado,
          intentos: r.intentos,
          ultimoError: r.ultimo_error,
          negocioId: r.negocio_id,
          createdAt: r.created_at,
        })),
      },
    };
  } catch (e) {
    return fallo(e);
  }
}

const motivo = z.string().trim().min(3).max(500);

const esquemaLimites = z
  .object({
    totalMin: z.number().int().min(1).max(720),
    totalMax: z.number().int().min(1).max(720),
    parcialMin: z.number().int().min(0).max(720),
    pctMin: z.number().min(0).max(100),
    pctMax: z.number().min(0).max(100),
    maxIntentos: z.number().int().min(1).max(20),
    motivo,
  })
  .strict();

export async function guardarLimites(entrada: z.input<typeof esquemaLimites>): Promise<Resultado> {
  try {
    const d = esquemaLimites.parse(entrada);
    const supabase = await sesionSuperSU();
    const { error } = await supabase.rpc("admin_set_limites_politica", {
      p_total_min: d.totalMin,
      p_total_max: d.totalMax,
      p_parcial_min: d.parcialMin,
      p_pct_min: d.pctMin,
      p_pct_max: d.pctMax,
      p_max_intentos: d.maxIntentos,
      p_motivo: d.motivo,
    });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "MOTIVO_REQUERIDO" : e);
  }
}

const esquemaPrueba = z
  .object({
    dias: z.number().int().min(1).max(90),
    modalidad: z.enum(["SIN_TARJETA", "CON_TARJETA", "AMBAS"]),
    graciaDias: z.number().int().min(0).max(30),
    aviso1: z.number().int().min(1).max(30),
    aviso2: z.number().int().min(0).max(30),
    motivo,
  })
  .strict();

export async function guardarConfigPrueba(entrada: z.input<typeof esquemaPrueba>): Promise<Resultado> {
  try {
    const d = esquemaPrueba.parse(entrada);
    const supabase = await sesionSuperSU();
    const { error } = await (supabase as unknown as RpcSinTipos).rpc("admin_set_config_prueba", {
      p_dias: d.dias,
      p_modalidad: d.modalidad,
      p_gracia_dias: d.graciaDias,
      p_aviso_1: d.aviso1,
      p_aviso_2: d.aviso2,
      p_motivo: d.motivo,
    });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "prueba_config_valida" : e);
  }
}

const esquemaComision = z
  .object({
    negocioId: z.uuid().nullable(),
    pct: z.number().min(0).max(15),
    efectivoDesde: z.iso.datetime({ offset: true }),
    motivo,
  })
  .strict();

/** Programa un cambio de comisión con vigencia (nunca retroactivo; los pagos históricos no cambian). */
export async function programarComision(entrada: z.input<typeof esquemaComision>): Promise<Resultado> {
  try {
    const d = esquemaComision.parse(entrada);
    const supabase = await sesionSuperSU();
    const { error } = await (supabase as unknown as RpcSinTipos).rpc("admin_programar_comision", {
      p_negocio_id: d.negocioId,
      p_pct: d.pct,
      p_efectivo_desde: d.efectivoDesde,
      p_motivo: d.motivo,
    });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "MOTIVO_REQUERIDO" : e);
  }
}

export async function anularComisionProgramada(id: string, motivoTexto: string): Promise<Resultado> {
  try {
    const d = z.object({ id: z.uuid(), motivo }).parse({ id, motivo: motivoTexto });
    const supabase = await sesionSuperSU();
    const { error } = await (supabase as unknown as RpcSinTipos).rpc("admin_anular_comision_programada", {
      p_id: d.id,
      p_motivo: d.motivo,
    });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "MOTIVO_REQUERIDO" : e);
  }
}

/** Default para negocios NUEVOS; los existentes cambian solo con un cambio programado. */
export async function guardarComisionDefault(pct: number): Promise<Resultado> {
  try {
    const p = z.number().min(0).max(15).parse(pct);
    const supabase = await sesionSuperSU();
    const { error } = await supabase.rpc("actualizar_comision_plataforma_global", { p_pct: p });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "COMISION_FUERA_DE_RANGO" : e);
  }
}

export async function reintentarReembolso(id: string, motivoTexto: string): Promise<Resultado> {
  try {
    const d = z.object({ id: z.uuid(), motivo }).parse({ id, motivo: motivoTexto });
    const supabase = await sesionSuperSU();
    const { error } = await supabase.rpc("admin_reintentar_reembolso", { p_reembolso_id: d.id, p_motivo: d.motivo });
    if (error) return fallo(error.message);
    revalidatePath("/admin/reglas");
    return { ok: true };
  } catch (e) {
    return fallo(e instanceof z.ZodError ? "MOTIVO_REQUERIDO" : e);
  }
}
