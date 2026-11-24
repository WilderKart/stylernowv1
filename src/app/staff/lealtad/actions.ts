"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface ReferidoStaff {
  id: string; estado: string; recompensaTipo: string; recompensaMonto: number | null; createdAt: string; completadoAt: string | null;
}

export async function obtenerMisReferidosStaff(negocioId: string): Promise<Resultado<ReferidoStaff[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mis_referidos_staff", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, estado: r.estado, recompensaTipo: r.recompensa_tipo, recompensaMonto: r.recompensa_monto !== null ? Number(r.recompensa_monto) : null, createdAt: r.created_at, completadoAt: r.completado_at })) };
}

export interface SelloOtorgado {
  campanaNombre: string; sellosActuales: number; sellosRequeridos: number; clienteNombre: string;
}

export async function obtenerSellosOtorgadosPorMi(negocioId: string): Promise<Resultado<SelloOtorgado[]>> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "NO_AUTENTICADO" };

  // Vista informativa: sellos de eventos ligados a Reservas atendidas por este Staff, en este Negocio.
  const { data, error } = await supabase
    .from("sello_evento")
    .select("sello_cliente:sello_cliente_id (sellos_actuales, campana:campana_id (nombre, sellos_requeridos, negocio_id), cliente:cliente_id (nombre)), reserva:reserva_id (staff_id)")
    .eq("tipo", "OTORGADO");
  if (error) return { ok: false, error: error.message };

  const filtrados = (data ?? []).filter((e) => (e.reserva as unknown as { staff_id: string } | null)?.staff_id === user.user!.id);
  const vistos = new Set<string>();
  const resultado: SelloOtorgado[] = [];
  for (const e of filtrados) {
    const sc = e.sello_cliente as unknown as { sellos_actuales: number; campana: { nombre: string; sellos_requeridos: number; negocio_id: string } | null; cliente: { nombre: string } | null } | null;
    if (!sc?.campana || sc.campana.negocio_id !== negocioId) continue;
    const clave = `${sc.campana.nombre}-${sc.cliente?.nombre}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push({ campanaNombre: sc.campana.nombre, sellosActuales: sc.sellos_actuales, sellosRequeridos: sc.campana.sellos_requeridos, clienteNombre: sc.cliente?.nombre ?? "—" });
  }
  return { ok: true, data: resultado.slice(0, 20) };
}
