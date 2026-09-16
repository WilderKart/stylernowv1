"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface MetricasLealtad {
  saldoTotalWallets: number;
  membresiasActivas: number;
  giftCardsActivas: number;
  giftCardsSaldoTotal: number;
  referidosCompletados: number;
  sellosCampanasActivas: number;
  cashbackOtorgadoTotal: number;
  vipMiembrosTotal: number;
  familiasTotal: number;
  cuentasCorporativasActivas: number;
  eventosFraudeSinRevisar: number;
}

export async function obtenerMetricasLealtad(): Promise<Resultado<MetricasLealtad>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("metricas_lealtad_plataforma");
  if (error) return { ok: false, error: error.message };
  const m = data as Record<string, number>;
  return {
    ok: true,
    data: {
      saldoTotalWallets: Number(m.saldoTotalWallets),
      membresiasActivas: m.membresiasActivas,
      giftCardsActivas: m.giftCardsActivas,
      giftCardsSaldoTotal: Number(m.giftCardsSaldoTotal),
      referidosCompletados: m.referidosCompletados,
      sellosCampanasActivas: m.sellosCampanasActivas,
      cashbackOtorgadoTotal: Number(m.cashbackOtorgadoTotal),
      vipMiembrosTotal: m.vipMiembrosTotal,
      familiasTotal: m.familiasTotal,
      cuentasCorporativasActivas: m.cuentasCorporativasActivas,
      eventosFraudeSinRevisar: m.eventosFraudeSinRevisar,
    },
  };
}

export interface EventoFraude {
  id: string; tipo: string; clienteId: string | null; negocioId: string | null; severidad: string; payload: unknown; createdAt: string;
}

export async function listarEventosFraude(): Promise<Resultado<EventoFraude[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_eventos_fraude", { p_revisado: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((e) => ({ id: e.id, tipo: e.tipo, clienteId: e.cliente_id, negocioId: e.negocio_id, severidad: e.severidad, payload: e.payload, createdAt: e.created_at })) };
}

export async function marcarFraudeRevisado(eventoId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_fraude_revisado", { p_evento_id: eventoId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/lealtad");
  return { ok: true };
}
