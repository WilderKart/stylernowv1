import "server-only";
import { createClient } from "@/lib/supabase/server";
import { derivarPermisosPanel } from "@/lib/auth/permission-registry";
import type { Permisos } from "@/lib/auth/tipos";

/**
 * Resolutor central de autorización del Panel Negocio — ADR-006 (Guardian
 * comparte el Panel Negocio con permisos dinámicos, StylerNow_Project_
 * Bible_V3/ADR_006_Guardian_Panel_Compartido.md).
 *
 * Ninguna pantalla del Panel calcula su propio alcance comparando columnas
 * a mano: todas llaman a `resolverContexto()` una vez y leen `rol`/`sedeId`/
 * `permisos` de acá. Esto es una capa de CONVENIENCIA sobre la autoridad
 * real, que sigue siendo RLS (006, 013) — si este resolutor tuviera un bug,
 * la base de datos igual rechaza la escritura no autorizada.
 *
 * No cachea nada entre requests (ni sesión, ni JWT custom claim): consulta
 * la base en cada llamada, así que un traslado de Staff entre sedes cambia
 * el alcance de Guardian en el siguiente request, sin logout.
 */

export type RolPanel = "BARBERIA" | "GUARDIAN" | "STAFF" | "NINGUNO";

/** Estado crudo del vínculo Staff–Negocio, cuando existe uno. */
export type EstadoVinculoPanel = "ACTIVO" | "SUSPENDIDO" | "INVITADO" | "RETIRADO" | null;

/**
 * ADR-015: alias del contrato único `Permisos` (`src/lib/auth/tipos.ts`),
 * ahora derivado de `permission-registry.ts` en vez de codificarse a mano acá
 * — se mantiene el nombre `PermisosPanel` para no tocar los 25+ call sites
 * existentes (`contexto.permisos.X`).
 */
export type PermisosPanel = Permisos;

export interface ContextoUsuario {
  userId: string | null;
  rol: RolPanel;
  negocioId: string | null;
  /** La propia sede si es Guardian/Staff; `null` en Barbería significa "todas". */
  sedeId: string | null;
  staffVinculoId: string | null;
  esGuardian: boolean;
  /** Estado del vínculo tal cual está en la base — permite distinguir un
   * Staff SUSPENDIDO (debe ver por qué está bloqueado) de uno sin ningún
   * vínculo todavía (NINGUNO real). */
  estadoVinculo: EstadoVinculoPanel;
  permisos: PermisosPanel;
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
};

export async function resolverContexto(): Promise<ContextoUsuario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return CONTEXTO_NINGUNO;

  // 1 · ¿Es Barbería (dueño de un negocio)? — 03-Business-Rules/01_Roles.md:
  // acceso total a su propio negocio, todas las sedes.
  const { data: negocio } = await supabase
    .from("negocio")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (negocio) {
    return {
      userId: user.id,
      rol: "BARBERIA",
      negocioId: negocio.id,
      sedeId: null,
      staffVinculoId: null,
      esGuardian: false,
      estadoVinculo: null,
      permisos: derivarPermisosPanel("barberia"),
    };
  }

  // 2 · ¿Tiene un vínculo Staff–Negocio? (cualquier estado salvo RETIRADO:
  // ADL-009 garantiza que hay como máximo uno). Guardian con sede asignada
  // comparte el Panel Negocio (ADR-006); un Staff plano o un Guardian sin
  // sede activa (edge case: recién promovido antes de tener sede) cae en
  // rol STAFF — su superficie completa es la App Staff de Fase 4, pero acá
  // necesita un destino real (nunca el wizard de "crear negocio").
  const { data: vinculo } = await supabase
    .from("vinculo_staff_negocio")
    .select("id, negocio_id, sede_activa_id, es_guardian, estado")
    .eq("staff_id", user.id)
    .neq("estado", "RETIRADO")
    .maybeSingle();

  if (vinculo) {
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
    };
  }

  return { ...CONTEXTO_NINGUNO, userId: user.id };
}
