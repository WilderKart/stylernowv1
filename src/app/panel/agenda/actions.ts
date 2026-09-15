"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tenés permiso sobre esa reserva.",
  NEGOCIO_NO_DISPONIBLE: "Este negocio no está activo en este momento.",
  CLIENTE_NO_ENCONTRADO: "No encontramos ningún cliente con ese dato.",
  SLOT_NO_DISPONIBLE: "Ese horario ya no está disponible — elegí otro.",
  STAFF_NO_DISPONIBLE: "Ese Staff no está disponible en ese horario.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa reserva.",
  RESERVA_NO_REPROGRAMABLE: "Solo se pueden reprogramar reservas confirmadas.",
  RESERVA_NO_REASIGNABLE: "Esa reserva ya no se puede reasignar.",
  RESERVA_NO_CANCELABLE: "Esa reserva ya no se puede cancelar.",
  FUERA_DE_VENTANA_REPROGRAMACION: "Ya pasó la ventana para reprogramar esta reserva vos mismo — contactá al negocio.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Lectura: citas de un rango + bloqueos ──────────────────────────────────

export interface CitaAgenda {
  id: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  staffId: string | null;
  montoTotal: number;
  servicios: string;
  servicioIds: string[];
}

export async function listarCitas(
  sedeId: string,
  desdeISO: string,
  hastaISO: string
): Promise<Resultado<CitaAgenda[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("reserva")
      .select(
        `id, estado, hora_inicio, hora_fin, staff_id, monto_total,
         cliente:cliente_id (id, nombre, telefono),
         reserva_servicio (servicio_id, servicio:servicio_id (nombre))`
      )
      .eq("sede_id", sedeId)
      .neq("estado", "CANCELADA")
      .gte("hora_inicio", desdeISO)
      .lt("hora_inicio", hastaISO)
      .order("hora_inicio", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const citas: CitaAgenda[] = (data ?? []).map((r) => {
      const cliente = r.cliente as unknown as { id: string; nombre: string; telefono: string | null } | null;
      return {
        id: r.id,
        horaInicio: r.hora_inicio,
        horaFin: r.hora_fin,
        estado: r.estado,
        clienteId: cliente?.id ?? "",
        clienteNombre: cliente?.nombre ?? "Cliente",
        clienteTelefono: cliente?.telefono ?? null,
        staffId: r.staff_id,
        montoTotal: r.monto_total,
        servicioIds: (r.reserva_servicio ?? []).map((rs) => rs.servicio_id),
        servicios: (r.reserva_servicio ?? [])
          .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
          .filter(Boolean)
          .join(" + "),
      };
    });
    return { ok: true, data: citas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export interface BloqueoAgenda {
  id: string;
  vinculoId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
}

export async function listarBloqueos(
  vinculoIds: string[],
  desdeISO: string,
  hastaISO: string
): Promise<Resultado<BloqueoAgenda[]>> {
  try {
    if (vinculoIds.length === 0) return { ok: true, data: [] };
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("bloqueo_ausencia")
      .select("id, vinculo_id, fecha_inicio, fecha_fin, motivo")
      .in("vinculo_id", vinculoIds)
      .lt("fecha_inicio", hastaISO)
      .gt("fecha_fin", desdeISO);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((b) => ({
        id: b.id,
        vinculoId: b.vinculo_id,
        fechaInicio: b.fecha_inicio,
        fechaFin: b.fecha_fin,
        motivo: b.motivo,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearBloqueo(datos: {
  vinculoId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("bloqueo_ausencia").insert({
      vinculo_id: datos.vinculoId,
      fecha_inicio: datos.fechaInicio,
      fecha_fin: datos.fechaFin,
      motivo: datos.motivo || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarBloqueo(id: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.from("bloqueo_ausencia").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Buscar cliente existente (para reserva manual) ─────────────────────────
// RLS (perfil_select_crm_negocio): solo clientes que ya tuvieron al menos
// una Reserva con este negocio son visibles acá — un cliente genuinamente
// nuevo todavía no puede buscarse por este camino (docs/PENDING_DECISIONS.md).

export interface ClienteEncontrado {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
}

export async function buscarClienteExistente(negocioId: string, busqueda: string): Promise<Resultado<ClienteEncontrado[]>> {
  try {
    const { supabase } = await usuarioActual();
    const b = busqueda.trim().replace(/[%_,()]/g, " ").trim();
    if (!b) return { ok: true, data: [] };

    const { data: reservas } = await supabase
      .from("reserva")
      .select("cliente_id")
      .eq("negocio_id", negocioId)
      .limit(500);
    const clienteIds = [...new Set((reservas ?? []).map((r) => r.cliente_id))];
    if (clienteIds.length === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("perfil")
      .select("id, nombre, telefono, email")
      .in("id", clienteIds)
      .or(`nombre.ilike.%${b}%,telefono.ilike.%${b}%,email.ilike.%${b}%`)
      .limit(10);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Servicios activos (para el formulario de cita manual) ─────────────────

export async function listarServiciosActivos(
  negocioId: string
): Promise<Resultado<{ id: string; nombre: string; duracionMinutos: number; precioBase: number }[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("servicio")
      .select("id, nombre, duracion_minutos, precio_base")
      .eq("negocio_id", negocioId)
      .eq("estado", "ACTIVO")
      .order("nombre");
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((s) => ({ id: s.id, nombre: s.nombre, duracionMinutos: s.duracion_minutos, precioBase: s.precio_base })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Slots disponibles (reutiliza el motor ya verificado) ───────────────────

export interface SlotAgenda {
  horaInicio: string;
  horaFin: string;
  staffId: string | null;
  disponible: boolean;
}

export async function obtenerSlotsAgenda(datos: {
  sedeId: string;
  servicioIds: string[];
  fechaISO: string;
  staffId?: string | null;
}): Promise<Resultado<SlotAgenda[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("slots_disponibles", {
      p_sede_id: datos.sedeId,
      p_servicio_ids: datos.servicioIds,
      p_fecha: datos.fechaISO,
      p_staff_id: datos.staffId ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? [])
        .filter((s) => s.disponible)
        .map((s) => ({ horaInicio: s.hora_inicio, horaFin: s.hora_fin, staffId: s.staff_id, disponible: s.disponible })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Crear cita manual, reprogramar, reasignar, cancelar ───────────────────

export async function crearCitaManual(datos: {
  sedeId: string;
  servicioIds: string[];
  horaInicio: string;
  clienteId: string;
  staffId?: string | null;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("crear_reserva_manual", {
      p_sede_id: datos.sedeId,
      p_servicio_ids: datos.servicioIds,
      p_hora_inicio: datos.horaInicio,
      p_cliente_id: datos.clienteId,
      p_staff_id: datos.staffId ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reprogramarCita(reservaId: string, nuevaHoraInicio: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("reprogramar_reserva", {
      p_reserva_id: reservaId,
      p_nueva_hora_inicio: nuevaHoraInicio,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reasignarStaff(reservaId: string, nuevoStaffId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("reasignar_staff_reserva", {
      p_reserva_id: reservaId,
      p_nuevo_staff_id: nuevoStaffId,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarCita(reservaId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cancelar_reserva", {
      p_reserva_id: reservaId,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/agenda");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
