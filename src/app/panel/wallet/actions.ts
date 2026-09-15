"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface WalletResumen {
  saldoDisponible: number;
  saldoRetenido: number;
}

export async function obtenerMiWallet(negocioId: string): Promise<Resultado<WalletResumen>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("wallet").select("saldo_disponible, saldo_retenido").eq("negocio_id", negocioId).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { saldoDisponible: Number(data.saldo_disponible), saldoRetenido: Number(data.saldo_retenido) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface MovimientoWallet {
  id: string;
  tipo: string;
  monto: number;
  createdAt: string;
}

export async function listarMovimientosWallet(negocioId: string): Promise<Resultado<MovimientoWallet[]>> {
  try {
    const supabase = await createClient();
    const { data: wallet } = await supabase.from("wallet").select("id").eq("negocio_id", negocioId).single();
    if (!wallet) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("wallet_movimiento")
      .select("id, tipo, monto, created_at")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map((m) => ({ id: m.id, tipo: m.tipo, monto: Number(m.monto), createdAt: m.created_at })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
