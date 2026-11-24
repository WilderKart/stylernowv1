"use server";
import { patronSinTildes } from "@/lib/busqueda/sin-tildes";

import { MENSAJE_RESTRINGIDA } from "@/lib/suscripcion/estado-operativo";
import { enviarInvitacionStaff } from "@/lib/correo/invitacion-staff";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { derivarRolEquipo, type RolAsignable, type RolEquipo, ROLES_ASIGNABLES } from "@/lib/auth/roles-equipo";

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
  SUSCRIPCION_RESTRINGIDA: MENSAJE_RESTRINGIDA,
  NO_AUTORIZADO: "No tienes permiso sobre este Staff.",
  PLAN_LIMIT_EXCEEDED:
    "Tu plan ya tiene completo el cupo de profesionales. Actualiza tu plan desde Suscripción para invitar más.",
  PLAN_NO_INCLUYE_COMISIONES:
    "Las comisiones por profesional no están incluidas en tu plan. Actualiza tu plan para usarlas.",
  PLAN_NO_INCLUYE_GUARDIAN:
    "El perfil Guardián no está incluido en tu plan. Actualiza tu plan desde Suscripción para usarlo.",
  SEDE_NO_PERTENECE_AL_NEGOCIO: "Esa sede no pertenece a este negocio.",
  YA_TIENE_VINCULO_ACTIVO: "Ese correo ya pertenece a un Staff activo en otro negocio.",
  INVITACION_NO_PENDIENTE: "Esa invitación ya no está pendiente.",
  INVITACION_EXPIRADA: "Esa invitación ya expiró.",
  INVITACION_NO_ENCONTRADA: "No encontramos esa invitación.",
  STAFF_NO_ACTIVO: "Ese Staff no está activo.",
  STAFF_NO_SUSPENDIDO: "Ese Staff no está suspendido.",
  STAFF_YA_RETIRADO: "Ese Staff ya no pertenece al negocio.",
  ROL_INVALIDO: "Ese rol no existe.",
  FALTA_SEDE: "Necesitas una sede operativa antes de activar tu perfil profesional.",
  PERFIL_NO_PERMITIDO_POR_PLAN: "Tu plan no permite activar el perfil profesional del propietario.",
  DESACTIVAR_NO_PERMITIDO_POR_PLAN: "Tu plan no permite desactivar el perfil profesional del propietario.",
  COMISION_NO_APLICA_A_ADMINISTRADOR: "Un administrador que no atiende clientes no tiene comisión.",
  TIENE_RESERVAS_FUTURAS:
    "Tiene reservas futuras asignadas. Reasígnalas o cancélalas antes de quitarle el perfil profesional.",
  ROL_PROPIETARIO_NO_CAMBIA: "El rol del propietario no se cambia aquí. Activa o desactiva tu perfil profesional desde el Resumen.",
  STAFF_NO_PRESTA_SERVICIOS: "Esa persona es administradora y no atiende clientes, así que no se le asignan servicios ni citas.",
  FALTA_SEDE_ACTIVA: "Este Staff todavía no tiene una sede asignada — trasládalo a una sede antes de promoverlo.",
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
  esAdmin: boolean;
  prestaServicios: boolean;
  /** Rol derivado de capacidades (el propietario se reconoce por ser el dueño del negocio). */
  rol: RolEquipo;
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
      if (b) q = q.or(`nombre.ilike.%${patronSinTildes(b)}%,especialidad.ilike.%${patronSinTildes(b)}%,email.ilike.%${b}%`);
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

    const [{ data, error, count }, { data: negocioDueno }] = await Promise.all([
      q,
      // El propietario no se guarda en el vínculo: se reconoce por ser el dueño del negocio (migración 158).
      supabase.from("negocio").select("owner_user_id").eq("id", filtro.negocioId).maybeSingle(),
    ]);
    if (error) return { ok: false, error: error.message };
    const propietarioId = negocioDueno?.owner_user_id ?? null;

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
      esAdmin: r.es_admin ?? false,
      prestaServicios: r.presta_servicios ?? true,
      rol: derivarRolEquipo({
        esPropietario: propietarioId !== null && r.staff_id === propietarioId,
        esAdmin: r.es_admin ?? false,
        prestaServicios: r.presta_servicios ?? true,
      }),
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
  /** Rol con el que se invita. El servidor decide quién puede invitar cada rol (un administrador delegado solo invita BARBER). */
  rol?: RolAsignable;
}): Promise<Resultado<{ correoEnviado: boolean; enlace: string }>> {
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
      p_rol: datos.rol ?? "BARBER",
    });
    if (error) return { ok: false, error: traducirError(error.message) };

    const { data: negocio } = await supabase
      .from("negocio")
      .select("nombre")
      .eq("id", datos.negocioId)
      .single();
    const envio = await enviarInvitacionStaff(correo, negocio?.nombre ?? "un negocio en StylerNow", invitacion.id, datos.rol ?? "BARBER");

    revalidatePath("/panel/staff");
    return { ok: true, data: { correoEnviado: envio.enviado, enlace: envio.enlace } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function reenviarInvitacion(invitacionId: string): Promise<Resultado<{ correoEnviado: boolean; enlace: string }>> {
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
    const envio = await enviarInvitacionStaff(invitacion.email, negocio?.nombre ?? "un negocio en StylerNow", invitacion.id, (invitacion.rol_invitado as RolAsignable) ?? "BARBER");

    revalidatePath("/panel/staff");
    return { ok: true, data: { correoEnviado: envio.enviado, enlace: envio.enlace } };
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
): Promise<Resultado<{ id: string; email: string; sedeId: string | null; expiraAt: string; reenviosCount: number; rol: RolAsignable; vigente: boolean }[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase
      .from("invitacion_staff")
      .select("id, email, sede_id, expira_at, reenvios_count, rol_invitado")
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
        rol: (ROLES_ASIGNABLES as readonly string[]).includes(i.rol_invitado) ? (i.rol_invitado as RolAsignable) : "BARBER",
        vigente: new Date(i.expira_at).getTime() > Date.now(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}


// ── Ciclo de vida del vínculo ────────────────────────────────────────────

// ── Roles del equipo y perfil profesional del propietario (migraciones 159 y 160) ─────────

/** Cambia el rol de un integrante. Solo el propietario; el servidor valida el cupo (un rol que presta servicios lo consume). */
export async function cambiarRolEquipo(vinculoId: string, rol: RolAsignable): Promise<Resultado> {
  try {
    if (!(ROLES_ASIGNABLES as readonly string[]).includes(rol)) return { ok: false, error: MENSAJES_ERROR.ROL_INVALIDO };
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("cambiar_rol_equipo", { p_vinculo_id: vinculoId, p_rol: rol });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/staff");
    revalidatePath(`/panel/staff/${vinculoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** El propietario activa su propio perfil profesional (consume un cupo). Idempotente. */
export async function activarPerfilProfesional(negocioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("activar_perfil_profesional_propietario", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel");
    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** El propietario deja de atender (libera su cupo). El servidor lo bloquea si tiene reservas futuras asignadas. */
export async function desactivarPerfilProfesional(negocioId: string): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("desactivar_perfil_profesional_propietario", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel");
    revalidatePath("/panel/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

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
 * (Fase 6, ADL-009) — es un hueco real del roadmap, no un bug aquí.
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
