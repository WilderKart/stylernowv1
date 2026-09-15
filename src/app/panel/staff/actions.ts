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
  NO_AUTORIZADO: "No tenés permiso sobre este Staff.",
  PLAN_LIMIT_EXCEEDED:
    "Tu plan no permite más Staff. Hacé un upgrade para sumar otro cupo (01-PRD/03_Monetization.md).",
  SEDE_NO_PERTENECE_AL_NEGOCIO: "Esa sede no pertenece a este negocio.",
  YA_TIENE_VINCULO_ACTIVO: "Ese correo ya pertenece a un Staff activo en otro negocio.",
  INVITACION_NO_PENDIENTE: "Esa invitación ya no está pendiente.",
  INVITACION_EXPIRADA: "Esa invitación ya expiró.",
  INVITACION_NO_ENCONTRADA: "No encontramos esa invitación.",
  STAFF_NO_ACTIVO: "Ese Staff no está activo.",
  STAFF_NO_SUSPENDIDO: "Ese Staff no está suspendido.",
  STAFF_YA_RETIRADO: "Ese Staff ya no pertenece al negocio.",
  FALTA_SEDE_ACTIVA: "Este Staff todavía no tiene una sede asignada — trasladalo a una sede antes de promoverlo.",
  YA_ES_GUARDIAN: "Ese Staff ya tiene el perfil Guardian.",
  NO_ES_GUARDIAN: "Ese Staff no tiene el perfil Guardian.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

// ── Listado (búsqueda, filtros, orden, paginación) ──────────────────────────

export interface StaffItem {
  vinculoId: string;
  staffId: string;
  nombre: string;
  fotoUrl: string | null;
  especialidad: string | null;
  telefono: string | null;
  email: string | null;
  esGuardian: boolean;
  estado: "ACTIVO" | "SUSPENDIDO" | "INVITADO" | "RETIRADO";
  sedeId: string | null;
  sedeNombre: string | null;
  comisionPct: number | null;
  fechaIngreso: string | null;
  nivel: "PRO" | "EXPERT" | "MASTER" | null;
}

export interface FiltroStaff {
  negocioId: string;
  busqueda?: string;
  estado?: "ACTIVO" | "SUSPENDIDO" | "INVITADO" | "RETIRADO" | "TODOS";
  esGuardian?: boolean;
  sedeId?: string;
  orden?: "nombre_asc" | "nombre_desc" | "reciente" | "antiguo";
  offset?: number;
  limite?: number;
}

export async function listarStaff(
  filtro: FiltroStaff
): Promise<Resultado<{ items: StaffItem[]; total: number }>> {
  try {
    const { supabase } = await usuarioActual();

    let q = supabase
      .from("vista_staff_negocio")
      .select("*", { count: "exact" })
      .eq("negocio_id", filtro.negocioId);

    if (filtro.estado && filtro.estado !== "TODOS") {
      q = q.eq("estado", filtro.estado);
    } else {
      // Por defecto la lista operativa no muestra Staff retirado — sigue
      // disponible eligiendo el filtro "Retirado" explícitamente.
      q = q.neq("estado", "RETIRADO");
    }
    if (filtro.esGuardian !== undefined) q = q.eq("es_guardian", filtro.esGuardian);
    if (filtro.sedeId) q = q.eq("sede_id", filtro.sedeId);
    if (filtro.busqueda?.trim()) {
      const b = filtro.busqueda.trim().replace(/[%_,()]/g, " ").trim();
      if (b) q = q.or(`nombre.ilike.%${b}%,especialidad.ilike.%${b}%,email.ilike.%${b}%`);
    }

    switch (filtro.orden ?? "nombre_asc") {
      case "nombre_desc":
        q = q.order("nombre", { ascending: false });
        break;
      case "reciente":
        q = q.order("created_at", { ascending: false });
        break;
      case "antiguo":
        q = q.order("created_at", { ascending: true });
        break;
      default:
        q = q.order("nombre", { ascending: true });
    }

    const offset = filtro.offset ?? 0;
    const limite = filtro.limite ?? 20;
    q = q.range(offset, offset + limite - 1);

    const { data, error, count } = await q;
    if (error) return { ok: false, error: error.message };

    // La vista hace join/left join sobre columnas que en la práctica nunca
    // son null (vinculo_id, staff_id, nombre, es_guardian, estado vienen de
    // un `join` interno, no de un `left join`) — Postgres igual las tipa
    // nullable porque no puede probarlo estáticamente sobre una vista.
    const items: StaffItem[] = (data ?? []).map((r) => ({
      vinculoId: r.vinculo_id!,
      staffId: r.staff_id!,
      nombre: r.nombre!,
      fotoUrl: r.foto_url,
      especialidad: r.especialidad,
      telefono: r.telefono,
      email: r.email,
      esGuardian: r.es_guardian!,
      estado: r.estado!,
      sedeId: r.sede_id,
      sedeNombre: r.sede_nombre,
      comisionPct: r.comision_pct,
      fechaIngreso: r.fecha_ingreso,
      nivel: r.nivel,
    }));

    return { ok: true, data: { items, total: count ?? 0 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Invitaciones ─────────────────────────────────────────────────────────

export async function crearInvitacionStaff(datos: {
  negocioId: string;
  email: string;
  sedeId: string;
  comisionPct?: number;
}): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const correo = datos.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { ok: false, error: "Ese correo no parece válido." };
    }
    const { data: invitacion, error } = await supabase.rpc("crear_invitacion_staff", {
      p_negocio_id: datos.negocioId,
      p_email: correo,
      p_sede_id: datos.sedeId,
      p_comision_pct: datos.comisionPct ?? undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };

    const { data: negocio } = await supabase
      .from("negocio")
      .select("nombre")
      .eq("id", datos.negocioId)
      .single();
    await notificarInvitacion(correo, negocio?.nombre ?? "un negocio en StylerNow", invitacion.id);

    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reenviarInvitacion(invitacionId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { data: invitacion, error } = await supabase.rpc("reenviar_invitacion", {
      p_invitacion_id: invitacionId,
    });
    if (error) return { ok: false, error: traducirError(error.message) };

    const { data: negocio } = await supabase
      .from("negocio")
      .select("nombre")
      .eq("id", invitacion.negocio_id)
      .single();
    await notificarInvitacion(invitacion.email, negocio?.nombre ?? "un negocio en StylerNow", invitacion.id);

    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cancelarInvitacion(invitacionId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cancelar_invitacion", { p_invitacion_id: invitacionId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function listarInvitacionesPendientes(
  negocioId: string
): Promise<Resultado<{ id: string; email: string; sedeId: string | null; expiraAt: string; reenviosCount: number }[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("invitacion_staff")
      .select("id, email, sede_id, expira_at, reenvios_count")
      .eq("negocio_id", negocioId)
      .eq("estado", "PENDIENTE")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        sedeId: i.sede_id,
        expiraAt: i.expira_at,
        reenviosCount: i.reenvios_count,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

async function notificarInvitacion(email: string, nombreNegocio: string, invitacionId: string) {
  const token = process.env.RESEND_API_KEY;
  if (!token) return; // No bloquea la acción si falta la key en este entorno.
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://stylernow.com"}/invitacion/${invitacionId}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "StylerNow <notificaciones@mail.stylernow.com>",
        to: email,
        subject: `Te invitaron a unirte a ${nombreNegocio} en StylerNow`,
        html: `<h2>Te invitaron a StylerNow</h2><p>${nombreNegocio} te invitó a unirte como Staff. Ingresá con este mismo correo (${email}) y <a href="${url}">aceptá o rechazá la invitación acá</a>.</p>`,
      }),
    });
  } catch {
    // El registro ya quedó guardado; el correo es un mejor-esfuerzo.
  }
}

// ── Ciclo de vida del vínculo ────────────────────────────────────────────

export async function promoverGuardian(vinculoId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("promover_guardian", { p_vinculo_id: vinculoId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function revocarGuardian(vinculoId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("revocar_guardian", { p_vinculo_id: vinculoId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function suspenderStaff(vinculoId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("suspender_staff", {
      p_vinculo_id: vinculoId,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reactivarStaff(vinculoId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("reactivar_staff", { p_vinculo_id: vinculoId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function retirarStaff(vinculoId: string, motivo?: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("retirar_staff", {
      p_vinculo_id: vinculoId,
      p_motivo: motivo || undefined,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Historial (auditoría) ───────────────────────────────────────────────

export interface EventoHistorial {
  id: string;
  accion: string;
  createdAt: string;
  motivo: string | null;
  payloadAntes: unknown;
  payloadDespues: unknown;
}

/**
 * Timeline Laboral del Staff (ADR-007): combina `evento_auditoria`
 * (ingreso/traslado/Guardian/suspensión/reactivación/retiro) con
 * `nivel_staff_consolidado` (cambios de Nivel PRO/EXPERT/MASTER por
 * temporada cerrada). Un único punto de lectura — ninguna otra pantalla
 * vuelve a consultar estas tablas a mano para mostrar historial de Staff.
 * La parte de Nivel llega vacía hasta que exista el cierre de temporada
 * (Fase 6, ADL-009) — es un hueco real del roadmap, no un bug acá.
 */
export async function obtenerHistorialStaff(vinculoId: string): Promise<Resultado<EventoHistorial[]>> {
  try {
    const { supabase } = await usuarioActual();
    // auditoria_select_negocio (RLS) solo deja ver esto a la Barbería dueña
    // del negocio — Guardian recibe una lista vacía, no un error.
    const [{ data: eventos, error: eEventos }, { data: niveles, error: eNiveles }] = await Promise.all([
      supabase
        .from("evento_auditoria")
        .select("id, accion, created_at, motivo, payload_antes, payload_despues")
        .eq("entidad_tipo", "vinculo_staff_negocio")
        .eq("entidad_id", vinculoId),
      supabase
        .from("nivel_staff_consolidado")
        .select("nivel, puntaje_final, temporada:temporada_id (fecha_fin)")
        .eq("vinculo_id", vinculoId),
    ]);
    if (eEventos) return { ok: false, error: eEventos.message };
    if (eNiveles) return { ok: false, error: eNiveles.message };

    const deAuditoria: EventoHistorial[] = (eventos ?? []).map((e) => ({
      id: e.id,
      accion: e.accion,
      createdAt: e.created_at,
      motivo: e.motivo,
      payloadAntes: e.payload_antes,
      payloadDespues: e.payload_despues,
    }));

    const deNivel: EventoHistorial[] = (niveles ?? []).map((n, i) => ({
      id: `nivel-${vinculoId}-${i}`,
      accion: "STAFF_NIVEL_CONSOLIDADO",
      createdAt: (n.temporada as unknown as { fecha_fin: string } | null)?.fecha_fin ?? new Date(0).toISOString(),
      motivo: null,
      payloadAntes: null,
      payloadDespues: { nivel: n.nivel, puntaje_final: n.puntaje_final },
    }));

    const historial = [...deAuditoria, ...deNivel].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { ok: true, data: historial };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
