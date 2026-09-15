"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface MiNivel {
  nivelActual: string;
  puntajeTemporadaActual: number;
  desglosePorCategoria: Record<string, number>;
  eventosRecientes: { evento: string; puntosDelta: number; motivo: string | null; createdAt: string }[];
  historialTemporadas: { temporadaId: string; puntajeFinal: number; nivel: string }[];
}

const UMBRALES: Record<string, number> = { PRO: 0, EXPERT: 1000, MASTER: 3000 };
const SIGUIENTE: Record<string, string | null> = { PRO: "EXPERT", EXPERT: "MASTER", MASTER: null };

export async function obtenerMiNivel(): Promise<Resultado<MiNivel & { proximoNivel: string | null; puntosParaSiguiente: number | null }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("NO_AUTENTICADO");

    const { data, error } = await supabase.rpc("staff_mi_nivel_actual");
    if (error) return { ok: false, error: error.message === "SIN_VINCULO_ACTIVO" ? "No tenés un vínculo activo." : error.message };

    const d = data as unknown as MiNivel;
    const proximoNivel = SIGUIENTE[d.nivelActual];
    const puntosParaSiguiente = proximoNivel ? UMBRALES[proximoNivel] - d.puntajeTemporadaActual : null;

    return { ok: true, data: { ...d, proximoNivel, puntosParaSiguiente } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
