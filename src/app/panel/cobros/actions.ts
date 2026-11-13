"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { oauthConfigurado } from "@/lib/pagos/oauth-mercadopago";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoConexion = "NO_CONFIGURADO" | "PENDIENTE" | "CONECTADA" | "EXPIRADA" | "REVOCADA" | "ERROR";

export interface ConexionCobros {
  estado: EstadoConexion;
  entorno: "SANDBOX" | "PRODUCCION" | null;
  cuenta: string | null;
  conectadaAt: string | null;
  tokenExpiraAt: string | null;
  ultimoError: string | null;
  /** La app de StylerNow tiene credenciales OAuth configuradas (si no, no se puede conectar todavía). */
  integracionDisponible: boolean;
}

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

async function sesionDueno() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) throw new Error("NO_AUTORIZADO");
  return { supabase: supabase as unknown as RpcSinTipos, negocioId: contexto.negocioId };
}

export async function obtenerConexionCobros(): Promise<{ ok: true; data: ConexionCobros } | { ok: false; error: string }> {
  try {
    const { supabase, negocioId } = await sesionDueno();
    const { data, error } = await supabase.rpc("conexion_pago_estado", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: "No pudimos leer el estado de tu cuenta de cobro." };
    const d = (data ?? {}) as Record<string, string | null>;
    return {
      ok: true,
      data: {
        estado: (d.estado as EstadoConexion) ?? "NO_CONFIGURADO",
        entorno: (d.entorno as ConexionCobros["entorno"]) ?? null,
        cuenta: d.cuenta ?? null,
        conectadaAt: d.conectada_at ?? null,
        tokenExpiraAt: d.token_expira_at ?? null,
        ultimoError: d.ultimo_error ?? null,
        integracionDisponible: oauthConfigurado(),
      },
    };
  } catch {
    return { ok: false, error: "Solo el dueño del negocio gestiona la cuenta de cobro." };
  }
}

export async function desconectarCuentaCobro(motivo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, negocioId } = await sesionDueno();
    const { error } = await supabase.rpc("conexion_desconectar", {
      p_negocio_id: negocioId,
      p_motivo: motivo.trim().slice(0, 300) || null,
    });
    if (error) return { ok: false, error: "No pudimos desconectar la cuenta." };
    revalidatePath("/panel/cobros");
    return { ok: true };
  } catch {
    return { ok: false, error: "Solo el dueño del negocio gestiona la cuenta de cobro." };
  }
}
