import "server-only";
import { createClient } from "@/lib/supabase/server";
import { derivarPermisosPanel } from "@/lib/auth/permission-registry";
import type { Permisos } from "@/lib/auth/tipos";
import { derivarRolEquipo, type RolEquipo } from "@/lib/auth/roles-equipo";

/**
 * Resolutor central de autorización del Panel Negocio — ADR-006 (Guardian
 * comparte el Panel Negocio con permisos dinámicos, StylerNow_Project_
 * Bible_V3/ADR_006_Guardian_Panel_Compartido.md).
 *
 * Ninguna pantalla del Panel calcula su propio alcance comparando columnas
 * a mano: todas llaman a `resolverContexto()` una vez y leen `rol`/`sedeId`/
 * `permisos` de aquí. Esto es una capa de CONVENIENCIA sobre la autoridad
 * real, que sigue siendo RLS (006, 013) — si este resolutor tuviera un bug,
 * la base de datos igual rechaza la escritura no autorizada.
 *
 * No cachea nada entre requests (ni sesión, ni JWT custom claim): consulta
 * la base en cada llamada, así que un traslado de Staff entre sedes cambia
 * el alcance de Guardian en el siguiente request, sin logout.
 */

/**
 * BARBERIA = propietario (BUSINESS_OWNER). ADMIN = administrador delegado (BUSINESS_ADMIN o ADMIN_BARBER, migración 158/161) con el
 * conjunto MÍNIMO de permisos delegados; las páginas que no lo admitan expresamente lo rechazan (forbidden). El rol detallado del equipo
 * está en `rolEquipo`; el rol del Panel solo decide a qué superficie entra.
 */
export type RolPanel = "BARBERIA" | "ADMIN" | "GUARDIAN" | "STAFF" | "NINGUNO";

/** Estado crudo del vínculo Staff–Negocio, cuando existe uno. */
export type EstadoVinculoPanel = "ACTIVO" | "SUSPENDIDO" | "INVITADO" | "RETIRADO" | null;

/**
 * ADR-015: alias del contrato único `Permisos` (`src/lib/auth/tipos.ts`),
 * ahora derivado de `permission-registry.ts` en vez de codificarse a mano aquí
 * — se mantiene el nombre `PermisosPanel` para no tocar los 25+ call sites
 * existentes (`contexto.permisos.X`).
 */
export type PermisosPanel = Permisos;

export interface ContextoUsuario {
  userId: string | null;
  rol: RolPanel;
  negocioId: string | null;
  /** La propia sede si es Guardian/Staff; `null` en Barbería/Administrador significa "todas". */
  sedeId: string | null;
  /**
   * Vínculo profesional del usuario en su negocio, si lo tiene (ACTIVO, SUSPENDIDO o INVITADO). Un propietario o un administrador SIN
   * perfil profesional tienen `null`; un propietario que atiende conserva rol BARBERIA Y recibe aquí su vínculo, así conserva su agenda.
   */
  staffVinculoId: string | null;
  esGuardian: boolean;
  /** Estado del vínculo tal cual está en la base — permite distinguir un
   * Staff SUSPENDIDO (debe ver por qué está bloqueado) de uno sin ningún
   * vínculo todavía (NINGUNO real). */
  estadoVinculo: EstadoVinculoPanel;
  permisos: PermisosPanel;
  /** Rol del equipo derivado de capacidades (migración 158). `null` solo si no hay negocio. */
  rolEquipo: RolEquipo | null;
  /** Administra el negocio (propietario o administrador delegado ACTIVO). */
  esAdmin: boolean;
  /** Tiene perfil profesional ACTIVO: debe poder usar /staff (agenda) además de /panel. Un administrador puro no. */
  prestaServicios: boolean;
}

const PERMISOS_NINGUNO: PermisosPanel = {
  verTodasLasSedes: false,
  crearSede: false,
  eliminarSede: false,
  cerrarReabrirSede: false,
  marcarSedePrincipal: false,
  trasladarStaff: false,
  editarSedePropia: false,
  verConfiguracionGlobal: false,
  verFacturacion: false,
  invitarStaff: false,
  cancelarInvitacionStaff: false,
  promoverGuardian: false,
  revocarGuardian: false,
  suspenderStaff: false,
  reactivarStaff: false,
  retirarStaff: false,
  cambiarHorarioOtroStaff: false,
  crearServicio: false,
  cambiarPrecioServicio: false,
  editarServicio: false,
  activarDesactivarServicio: false,
  gestionarCombos: false,
  asignarStaffServicio: false,
  exportarClientes: false,
};

const CONTEXTO_NINGUNO: ContextoUsuario = {
  userId: null,
  rol: "NINGUNO",
  negocioId: null,
  sedeId: null,
  staffVinculoId: null,
  esGuardian: false,
  estadoVinculo: null,
  permisos: PERMISOS_NINGUNO,
  rolEquipo: null,
  esAdmin: false,
  prestaServicios: false,
};

export async function resolverContexto(): Promise<ContextoUsuario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return CONTEXTO_NINGUNO;

  // 1 · ¿Es Barbería (dueño de un negocio)? — 03-Business-Rules/01_Roles.md:
  // acceso total a su propio negocio, todas las sedes.
  // No maybeSingle(): si un dueño quedó con más de un negocio (duplicados de un alta reintentada),
  // maybeSingle fallaba, el rol caía a NINGUNO y el panel lo mandaba de vuelta al asistente.
  // Se toma el más avanzado (alta completa primero) y, a igualdad, el más antiguo.
  const { data: negocios } = await supabase
    .from("negocio")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("onboarding_completo", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);
  const negocio = negocios?.[0] ?? null;

  if (negocio) {
    // El propietario puede además tener perfil profesional (migración 160): una misma cuenta administra y atiende. Antes este
    // resolver devolvía staffVinculoId=null y no miraba el vínculo, así que quien atendía perdía su agenda.
    const { data: propio } = await supabase
      .from("vinculo_staff_negocio")
      .select("id, sede_activa_id, es_guardian, estado, presta_servicios")
      .eq("staff_id", user.id)
      .eq("negocio_id", negocio.id)
      .neq("estado", "RETIRADO")
      .maybeSingle();
    return {
      userId: user.id,
      rol: "BARBERIA",
      negocioId: negocio.id,
      sedeId: null,
      staffVinculoId: propio?.id ?? null,
      esGuardian: false,
      estadoVinculo: (propio?.estado as EstadoVinculoPanel) ?? null,
      permisos: derivarPermisosPanel("barberia"),
      rolEquipo: "BUSINESS_OWNER",
      esAdmin: true,
      prestaServicios: Boolean(propio && propio.estado === "ACTIVO" && propio.presta_servicios),
    };
  }

  // 2 · ¿Tiene un vínculo Staff–Negocio? (cualquier estado salvo RETIRADO:
  // ADL-009 garantiza que hay como máximo uno). Guardian con sede asignada
  // comparte el Panel Negocio (ADR-006); un Staff plano o un Guardian sin
  // sede activa (edge case: recién promovido antes de tener sede) cae en
  // rol STAFF — su superficie completa es la App Staff de Fase 4, pero aquí
  // necesita un destino real (nunca el wizard de "crear negocio").
  const { data: vinculo } = await supabase
    .from("vinculo_staff_negocio")
    .select("id, negocio_id, sede_activa_id, es_guardian, estado, es_admin, presta_servicios")
    .eq("staff_id", user.id)
    .neq("estado", "RETIRADO")
    .maybeSingle();

  if (vinculo) {
    const rolEquipo = derivarRolEquipo({ esPropietario: false, esAdmin: vinculo.es_admin, prestaServicios: vinculo.presta_servicios });
    const presta = vinculo.estado === "ACTIVO" && vinculo.presta_servicios;

    // Administrador delegado ACTIVO (BUSINESS_ADMIN / ADMIN_BARBER): permisos mínimos delegados a nivel de negocio. Si además es
    // Guardian conserva esGuardian, pero el alcance administrativo (negocio) prima sobre el de sede.
    if (vinculo.estado === "ACTIVO" && vinculo.es_admin) {
      return {
        userId: user.id,
        rol: "ADMIN",
        negocioId: vinculo.negocio_id,
        sedeId: null,
        staffVinculoId: vinculo.id,
        esGuardian: vinculo.es_guardian,
        estadoVinculo: "ACTIVO",
        permisos: derivarPermisosPanel("admin"),
        rolEquipo,
        esAdmin: true,
        prestaServicios: presta,
      };
    }

    if (vinculo.estado === "ACTIVO" && vinculo.es_guardian && vinculo.sede_activa_id) {
      return {
        userId: user.id,
        rol: "GUARDIAN",
        negocioId: vinculo.negocio_id,
        sedeId: vinculo.sede_activa_id,
        staffVinculoId: vinculo.id,
        esGuardian: true,
        estadoVinculo: "ACTIVO",
        permisos: derivarPermisosPanel("guardian"),
        rolEquipo,
        esAdmin: false,
        prestaServicios: presta,
      };
    }

    return {
      userId: user.id,
      rol: "STAFF",
      negocioId: vinculo.negocio_id,
      sedeId: vinculo.sede_activa_id,
      staffVinculoId: vinculo.id,
      esGuardian: vinculo.es_guardian,
      estadoVinculo: vinculo.estado as EstadoVinculoPanel,
      permisos: PERMISOS_NINGUNO,
      rolEquipo,
      esAdmin: false,
      prestaServicios: presta,
    };
  }

  return { ...CONTEXTO_NINGUNO, userId: user.id };
}
