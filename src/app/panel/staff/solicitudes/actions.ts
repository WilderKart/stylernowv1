"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Solicitudes de ausencia y de horario de los barberos (migración 187). La barbería (o el Guardian de la sede) decide;
 * la base vuelve a comprobar quién es y deja la decisión en auditoría y le avisa al barbero.
 */

type Rpc = { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };
type Desde = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SolicitudAusenciaFila {
  id: string;
  staffNombre: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
}
export interface SolicitudHorarioFila {
  id: string;
  staffNombre: string;
  propuesta: { dia_semana: number; hora_inicio: string; hora_fin: string }[];
}

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso para decidir esta solicitud.",
  SOLICITUD_YA_DECIDIDA: "Esa solicitud ya fue decidida.",
  MOTIVO_REQUERIDO: "Escribe un motivo para rechazar (lo verá el barbero).",
  SOLICITUD_NO_ENCONTRADA: "No encontramos la solicitud.",
};
const traducir = (m: string) => MENSAJES[Object.keys(MENSAJES).find((k) => m.includes(k)) ?? ""] ?? "No pudimos completar la acción. Intenta de nuevo.";

export async function listarSolicitudesPendientes(negocioId: string | null | undefined): Promise<{ ausencias: SolicitudAusenciaFila[]; horarios: SolicitudHorarioFila[]; disponible: boolean }> {
  const vacio = { ausencias: [], horarios: [], disponible: true };
  if (!negocioId) return vacio;
  const supabase = (await createClient()) as unknown as Desde;
  // Las solicitudes cuelgan del vínculo: se acota al negocio activo (un usuario con varios negocios no mezcla los de otro).
  const { data: v, error: errV } = await supabase.from("vinculo_staff_negocio").select("id, staff_id").eq("negocio_id", negocioId).limit(500);
  if (errV) return { ausencias: [], horarios: [], disponible: false };
  const vinculosNegocio = (v ?? []).map((x: { id: string }) => x.id);
  if (vinculosNegocio.length === 0) return vacio;
  const [a, h] = await Promise.all([
    supabase.from("solicitud_ausencia").select("id, vinculo_id, tipo, fecha_inicio, fecha_fin, motivo").eq("estado", "PENDIENTE").in("vinculo_id", vinculosNegocio).order("created_at").order("id").limit(100),
    supabase.from("solicitud_horario").select("id, vinculo_id, propuesta").eq("estado", "PENDIENTE").in("vinculo_id", vinculosNegocio).order("created_at").order("id").limit(100),
  ]);
  if (a.error || h.error) return { ausencias: [], horarios: [], disponible: false }; // migración 187 aún no aplicada
  const nombres = new Map<string, string>();
  const staffIds = [...new Set((v ?? []).map((x: { staff_id: string }) => x.staff_id))];
  const { data: st } = staffIds.length ? await supabase.from("staff").select("usuario_id, nombre").in("usuario_id", staffIds) : { data: [] };
  const porStaff = new Map<string, string>((st ?? []).map((x: { usuario_id: string; nombre: string }) => [x.usuario_id, x.nombre]));
  for (const x of v ?? []) nombres.set(x.id, porStaff.get(x.staff_id) ?? "Barbero");
  return {
    disponible: true,
    ausencias: (a.data ?? []).map((x: { id: string; vinculo_id: string; tipo: string; fecha_inicio: string; fecha_fin: string; motivo: string | null }) => ({
      id: x.id, staffNombre: nombres.get(x.vinculo_id) ?? "Barbero", tipo: x.tipo, fechaInicio: x.fecha_inicio, fechaFin: x.fecha_fin, motivo: x.motivo,
    })),
    horarios: (h.data ?? []).map((x: { id: string; vinculo_id: string; propuesta: SolicitudHorarioFila["propuesta"] }) => ({
      id: x.id, staffNombre: nombres.get(x.vinculo_id) ?? "Barbero", propuesta: x.propuesta,
    })),
  };
}

export async function decidirAusencia(
  id: string,
  aprobar: boolean,
  motivo: string,
  confirmarConCitas = false
): Promise<{ ok: true; requiereConfirmacion?: number } | { ok: false; error: string }> {
  const supabase = (await createClient()) as unknown as Rpc;
  const { data, error } = await supabase.rpc("decidir_solicitud_ausencia", {
    p_solicitud_id: id, p_aprobar: aprobar, p_motivo: motivo || null, p_confirmar_con_citas: confirmarConCitas,
  });
  if (error) return { ok: false, error: traducir(error.message) };
  const r = data as { estado?: string; citas_en_rango?: number } | null;
  if (r?.estado === "REQUIERE_CONFIRMACION") return { ok: true, requiereConfirmacion: r.citas_en_rango ?? 0 };
  revalidatePath("/panel/staff/solicitudes");
  return { ok: true };
}

export async function decidirHorario(id: string, aprobar: boolean, motivo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = (await createClient()) as unknown as Rpc;
  const { error } = await supabase.rpc("decidir_solicitud_horario", { p_solicitud_id: id, p_aprobar: aprobar, p_motivo: motivo || null });
  if (error) return { ok: false, error: traducir(error.message) };
  revalidatePath("/panel/staff/solicitudes");
  return { ok: true };
}
