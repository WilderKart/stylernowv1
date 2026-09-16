"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  GIFT_CARD_NO_ENCONTRADA: "No encontramos ninguna Gift Card con ese código.",
  PIN_INCORRECTO: "El PIN no es correcto.",
  YA_CANJEADA: "Esa Gift Card ya fue canjeada.",
  GIFT_CARD_NO_DISPONIBLE: "Esa Gift Card no está disponible para canjear.",
  GIFT_CARD_VENCIDA: "Esa Gift Card ya venció.",
  CODIGO_INVALIDO: "Ese código de referido no existe.",
  NO_PUEDES_REFERIRTE_A_TI_MISMO: "No podés usar tu propio código de referido.",
  YA_FUE_REFERIDO: "Tu cuenta ya fue registrada como referida antes.",
  YA_PERTENECE_A_UNA_FAMILIA: "Ya pertenecés a un grupo familiar.",
  CLIENTE_YA_EN_UNA_FAMILIA: "Esa persona ya pertenece a otra familia.",
  LIMITE_MIEMBROS_ALCANZADO: "Tu grupo familiar ya llegó al límite de miembros.",
  SALDO_INSUFICIENTE: "No tenés saldo suficiente en tu StylerWallet.",
  MONTO_INVALIDO: "Monto inválido.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

export interface ResumenLealtad {
  walletSaldo: number;
  movimientos: { id: string; tipo: string; monto: number; motivo: string | null; createdAt: string }[];
  codigoReferido: string | null;
  referidos: { id: string; estado: string; montoRecompensa: number | null; createdAt: string }[];
  sellos: { campanaId: string; campanaNombre: string; negocioNombre: string; sellosActuales: number; sellosRequeridos: number; recompensaDescripcion: string }[];
  cashback: { id: string; negocioNombre: string; monto: number; estado: string; createdAt: string }[];
  familia: { id: string; nombre: string; limiteMiembros: number } | null;
  membresias: { id: string; planNombre: string; negocioNombre: string; estado: string }[];
}

export async function obtenerResumenLealtad(): Promise<Resultado<ResumenLealtad>> {
  try {
    const { supabase, userId } = await usuarioActual();

    const [walletRes, codigoRes, referidosRes, sellosRes, cashbackRes, familiaRes, membresiasRes] = await Promise.all([
      supabase.from("lealtad_wallet").select("saldo_disponible, id").eq("cliente_id", userId).maybeSingle(),
      supabase.rpc("obtener_mi_codigo_referido"),
      supabase.rpc("mis_referidos"),
      supabase.rpc("mis_sellos"),
      supabase.rpc("mi_cashback"),
      supabase.rpc("mi_familia"),
      supabase
        .from("cliente_membresia")
        .select("id, estado, plan:plan_id (nombre), negocio:negocio_id (nombre)")
        .eq("cliente_id", userId)
        .in("estado", ["ACTIVA", "PROXIMA_A_VENCER", "SUSPENDIDA"])
        .order("created_at", { ascending: false }),
    ]);

    let movimientos: ResumenLealtad["movimientos"] = [];
    if (walletRes.data?.id) {
      const { data } = await supabase
        .from("lealtad_movimiento")
        .select("id, tipo, monto, motivo, created_at")
        .eq("wallet_id", walletRes.data.id)
        .order("created_at", { ascending: false })
        .limit(30);
      movimientos = (data ?? []).map((m) => ({ id: m.id, tipo: m.tipo, monto: Number(m.monto), motivo: m.motivo, createdAt: m.created_at }));
    }

    return {
      ok: true,
      data: {
        walletSaldo: Number(walletRes.data?.saldo_disponible ?? 0),
        movimientos,
        codigoReferido: codigoRes.data?.codigo ?? null,
        referidos: (referidosRes.data ?? []).map((r) => ({ id: r.id, estado: r.estado, montoRecompensa: r.monto_recompensa !== null ? Number(r.monto_recompensa) : null, createdAt: r.created_at })),
        sellos: (sellosRes.data ?? []).map((s) => ({
          campanaId: s.campana_id, campanaNombre: s.campana_nombre, negocioNombre: s.negocio_nombre,
          sellosActuales: s.sellos_actuales, sellosRequeridos: s.sellos_requeridos, recompensaDescripcion: s.recompensa_descripcion,
        })),
        cashback: (cashbackRes.data ?? []).map((c) => ({ id: c.id, negocioNombre: c.negocio_nombre, monto: Number(c.monto), estado: c.estado, createdAt: c.created_at })),
        familia: familiaRes.data ? { id: familiaRes.data.id, nombre: familiaRes.data.nombre, limiteMiembros: familiaRes.data.limite_miembros } : null,
        membresias: (membresiasRes.data ?? []).map((m) => ({
          id: m.id,
          estado: m.estado,
          planNombre: (m.plan as unknown as { nombre: string } | null)?.nombre ?? "Membresía",
          negocioNombre: (m.negocio as unknown as { nombre: string } | null)?.nombre ?? "",
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function registrarEventoFraude(tipo: "CANJE_DUPLICADO" | "ABUSO_REFERIDO", negocioId: string | null, payload: Record<string, unknown>) {
  try {
    const { supabase } = await usuarioActual();
    await supabase.rpc("registrar_evento_fraude", { p_tipo: tipo, p_negocio_id: negocioId ?? undefined, p_payload: payload as never });
  } catch {
    // El registro de fraude es best-effort — nunca debe romper la experiencia del Cliente.
  }
}

export async function registrarReferido(codigo: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("registrar_referido", { p_codigo: codigo.trim() });
    if (error) {
      if (error.message.includes("NO_PUEDES_REFERIRTE_A_TI_MISMO")) {
        await registrarEventoFraude("ABUSO_REFERIDO", null, { motivo: "AUTO_REFERIDO" });
      }
      return { ok: false, error: traducirError(error.message) };
    }
    revalidatePath("/lealtad");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearGrupoFamiliar(nombre: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("crear_grupo_familiar", { p_nombre: nombre });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/lealtad");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function canjearWallet(monto: number): Promise<Resultado<{ saldoDisponible: number }>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("canjear_lealtad_wallet", { p_monto: monto });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/lealtad");
    return { ok: true, data: { saldoDisponible: Number(data) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
