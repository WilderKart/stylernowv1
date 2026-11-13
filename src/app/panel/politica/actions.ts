"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface PoliticaNegocio {
  totalHoras: number;
  parcialHoras: number;
  parcialPct: number;
}

export interface LimitesPolitica {
  totalMin: number;
  totalMax: number;
  parcialMin: number;
  pctMin: number;
  pctMax: number;
}

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const MENSAJES: Record<string, string> = {
  POLITICA_FUERA_DE_LIMITES: "Esos valores están fuera de los límites que define StylerNow.",
  NO_AUTORIZADO: "Solo el dueño del negocio puede cambiar la política.",
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  negocio_ventanas_coherentes: "La ventana parcial no puede ser mayor que la ventana total.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos guardar la política. Intenta de nuevo.";
}

/** Negocio del dueño, derivado de la sesión en el servidor (nunca del navegador). */
async function sesionDueno() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) throw new Error("NO_AUTORIZADO");
  return { supabase, negocioId: contexto.negocioId };
}

export async function obtenerPolitica(): Promise<Resultado<{ politica: PoliticaNegocio; limites: LimitesPolitica }>> {
  try {
    const { supabase, negocioId } = await sesionDueno();
    const [{ data: n }, { data: c }] = await Promise.all([
      supabase
        .from("negocio")
        .select("ventana_reembolso_total_horas, ventana_reembolso_parcial_horas, reembolso_parcial_pct")
        .eq("id", negocioId)
        .single(),
      (supabase as unknown as { rpc: (n: string) => Promise<{ data: unknown }> }).rpc("limites_politica_cancelacion"),
    ]);
    if (!n) return { ok: false, error: "No encontramos tu negocio." };
    const l = (c ?? {}) as Partial<Record<"total_min" | "total_max" | "parcial_min" | "pct_min" | "pct_max", number>>;
    return {
      ok: true,
      data: {
        politica: {
          totalHoras: n.ventana_reembolso_total_horas,
          parcialHoras: n.ventana_reembolso_parcial_horas,
          parcialPct: Number(n.reembolso_parcial_pct),
        },
        limites: {
          totalMin: l.total_min ?? 6,
          totalMax: l.total_max ?? 72,
          parcialMin: l.parcial_min ?? 0,
          pctMin: Number(l.pct_min ?? 0),
          pctMax: Number(l.pct_max ?? 100),
        },
      },
    };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

const esquema = z
  .object({
    totalHoras: z.number().int().min(1).max(720),
    parcialHoras: z.number().int().min(0).max(720),
    parcialPct: z.number().min(0).max(100),
  })
  .strict()
  .refine((p) => p.parcialHoras <= p.totalHoras, { message: "negocio_ventanas_coherentes" });

/**
 * Guarda la política. La base de datos vuelve a validar contra los límites de Super Admin
 * (trigger) y deja auditoría con antes/después. Aplica solo a reservas que se paguen desde
 * ahora: las ya pagadas conservan la política que el cliente aceptó.
 */
export async function guardarPolitica(entrada: PoliticaNegocio): Promise<Resultado> {
  try {
    const parsed = esquema.safeParse(entrada);
    if (!parsed.success) return { ok: false, error: traducir(parsed.error.issues[0]?.message ?? "") };
    const { supabase, negocioId } = await sesionDueno();
    const { error } = await supabase.rpc("configurar_politica_cancelacion", {
      p_negocio_id: negocioId,
      p_total_horas: parsed.data.totalHoras,
      p_parcial_horas: parsed.data.parcialHoras,
      p_parcial_pct: parsed.data.parcialPct,
    });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel/politica");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

// ── Anticipo (migración 129) ────────────────────────────────────────────────

export interface ConfigAnticipo {
  modo: "OBLIGATORIO" | "OPCIONAL" | "NINGUNO";
  pct: number | null;
  montoFijo: number | null;
  minimo: number;
  maximo: number;
  pagoCompleto: boolean;
  cobraEnLinea: boolean;
}

export async function obtenerAnticipo(): Promise<Resultado<{ anticipo: ConfigAnticipo }>> {
  try {
    const { supabase, negocioId } = await sesionDueno();
    const sinTipos = supabase as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: unknown }> } } };
      rpc: (n: string, a: object) => Promise<{ data: unknown }>;
    };
    const [{ data }, { data: enLinea }] = await Promise.all([
      sinTipos.from("negocio").select("anticipo_modo, sena_pct, sena_monto_fijo, sena_minimo, sena_maximo, pago_completo_en_app").eq("id", negocioId).single(),
      sinTipos.rpc("negocio_cobra_en_linea", { p_negocio_id: negocioId }),
    ]);
    const n = data as Record<string, unknown> | null;
    if (!n) return { ok: false, error: "No encontramos tu negocio." };
    return {
      ok: true,
      data: {
        anticipo: {
          modo: (n.anticipo_modo as ConfigAnticipo["modo"]) ?? "OBLIGATORIO",
          pct: n.sena_pct == null ? null : Number(n.sena_pct),
          montoFijo: n.sena_monto_fijo == null ? null : Number(n.sena_monto_fijo),
          minimo: Number(n.sena_minimo ?? 0),
          maximo: Number(n.sena_maximo ?? 0),
          pagoCompleto: Boolean(n.pago_completo_en_app),
          cobraEnLinea: enLinea === true,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}

const esquemaAnticipo = z
  .object({
    modo: z.enum(["OBLIGATORIO", "OPCIONAL", "NINGUNO"]),
    tipo: z.enum(["PORCENTAJE", "FIJO"]),
    valor: z.number().min(0),
    minimo: z.number().min(0).max(100_000_000),
    maximo: z.number().min(0).max(100_000_000),
    pagoCompleto: z.boolean(),
  })
  .strict()
  .refine((a) => a.maximo >= a.minimo, { message: "ANTICIPO_VALORES_INVALIDOS" })
  .refine((a) => a.tipo === "FIJO" || a.valor <= 100, { message: "ANTICIPO_VALORES_INVALIDOS" });

/** Guarda el anticipo. La base vuelve a validar y audita antes/después; aplica a reservas nuevas. */
export async function guardarAnticipo(entrada: z.input<typeof esquemaAnticipo>): Promise<Resultado> {
  try {
    const parsed = esquemaAnticipo.safeParse(entrada);
    if (!parsed.success) return { ok: false, error: "Revisa los valores del anticipo (porcentaje 0–100 y máximo mayor o igual al mínimo)." };
    const d = parsed.data;
    const { supabase, negocioId } = await sesionDueno();
    const { error } = await (supabase as unknown as {
      rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }>;
    }).rpc("configurar_anticipo", {
      p_negocio_id: negocioId,
      p_modo: d.modo,
      p_pct: d.tipo === "PORCENTAJE" ? d.valor : null,
      p_monto_fijo: d.tipo === "FIJO" ? Math.round(d.valor) : null,
      p_minimo: Math.round(d.minimo),
      p_maximo: Math.round(d.maximo),
      p_pago_completo: d.pagoCompleto,
    });
    if (error) return { ok: false, error: "No pudimos guardar el anticipo. Revisa los valores." };
    revalidatePath("/panel/politica");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducir(e instanceof Error ? e.message : "") };
  }
}
