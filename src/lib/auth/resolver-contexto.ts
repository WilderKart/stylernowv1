import "server-only";
import { createClient } from "@/lib/supabase/server";

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

export type RolPanel = "BARBERIA" | "GUARDIAN" | "NINGUNO";

export interface PermisosPanel {
  verTodasLasSedes: boolean;
  crearSede: boolean;
  eliminarSede: boolean;
  cerrarReabrirSede: boolean;
  marcarSedePrincipal: boolean;
  trasladarStaff: boolean;
  editarSedePropia: boolean;
  verConfiguracionGlobal: boolean;
  verFacturacion: boolean;
}

export interface ContextoUsuario {
  userId: string | null;
  rol: RolPanel;
  negocioId: string | null;
  /** La propia sede si es Guardian; `null` en Barbería significa "todas". */
  sedeId: string | null;
  staffVinculoId: string | null;
  esGuardian: boolean;
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
};

const CONTEXTO_NINGUNO: ContextoUsuario = {
  userId: null,
  rol: "NINGUNO",
  negocioId: null,
  sedeId: null,
  staffVinculoId: null,
  esGuardian: false,
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
      permisos: {
        verTodasLasSedes: true,
        crearSede: true,
        eliminarSede: true,
        cerrarReabrirSede: true,
        marcarSedePrincipal: true,
        trasladarStaff: true,
        editarSedePropia: true,
        verConfiguracionGlobal: true,
        verFacturacion: true,
      },
    };
  }

  // 2 · ¿Es Staff con vínculo ACTIVO y perfil Guardian? Plain Staff (sin
  // Guardian) todavía no entra al Panel Negocio — su superficie es la App
  // Staff de Fase 4 (ADR-006: este ADR cubre específicamente Guardian).
  const { data: vinculo } = await supabase
    .from("vinculo_staff_negocio")
    .select("id, negocio_id, sede_activa_id, es_guardian")
    .eq("staff_id", user.id)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (vinculo?.es_guardian && vinculo.sede_activa_id) {
    return {
      userId: user.id,
      rol: "GUARDIAN",
      negocioId: vinculo.negocio_id,
      sedeId: vinculo.sede_activa_id,
      staffVinculoId: vinculo.id,
      esGuardian: true,
      permisos: {
        verTodasLasSedes: false,
        crearSede: false,
        eliminarSede: false,
        cerrarReabrirSede: false,
        marcarSedePrincipal: false,
        trasladarStaff: false,
        editarSedePropia: true,
        verConfiguracionGlobal: false,
        verFacturacion: false,
      },
    };
  }

  return { ...CONTEXTO_NINGUNO, userId: user.id };
}
