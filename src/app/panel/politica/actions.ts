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
