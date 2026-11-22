/**
 * Roles del equipo de un negocio (FASE 1, migración 158). Puro (sin servidor): lo comparten el resolver, las pantallas y las pruebas.
 *
 * El rol NO se guarda: se DERIVA de capacidades, igual que la función SQL `_rol_equipo`:
 *   propietario (negocio.owner_user_id)                 -> BUSINESS_OWNER   (puede además tener perfil profesional)
 *   es_admin y presta_servicios                          -> ADMIN_BARBER     (administra y atiende; ocupa cupo)
 *   es_admin sin presta_servicios                        -> BUSINESS_ADMIN   (solo administra; NO ocupa cupo)
 *   presta_servicios sin es_admin                        -> BARBER           (profesional operativo; ocupa cupo)
 * SUPER_ADMIN es de la plataforma (perfil.es_supersu) y no pertenece al equipo de un negocio. No existe «OWNER».
 * Guardian (es_guardian) es un alcance por SEDE ortogonal: un Guardian sigue siendo BARBER (o ADMIN_BARBER) con permisos de sede.
 */
export type RolEquipo = "BUSINESS_OWNER" | "BUSINESS_ADMIN" | "ADMIN_BARBER" | "BARBER";

/** Roles que se pueden elegir al invitar o al cambiar el rol de un integrante (el propietario no se invita ni se cambia). */
export type RolAsignable = Exclude<RolEquipo, "BUSINESS_OWNER">;

export const ROLES_ASIGNABLES: readonly RolAsignable[] = ["BARBER", "BUSINESS_ADMIN", "ADMIN_BARBER"] as const;

export function derivarRolEquipo(c: { esPropietario: boolean; esAdmin: boolean; prestaServicios: boolean }): RolEquipo {
  if (c.esPropietario) return "BUSINESS_OWNER";
  if (c.esAdmin && c.prestaServicios) return "ADMIN_BARBER";
  if (c.esAdmin) return "BUSINESS_ADMIN";
  return "BARBER";
}

/** Capacidades que implica cada rol asignable (espejo de `cambiar_rol_equipo` en SQL). */
export function capacidadesDeRol(rol: RolAsignable): { esAdmin: boolean; prestaServicios: boolean } {
  return { esAdmin: rol === "BUSINESS_ADMIN" || rol === "ADMIN_BARBER", prestaServicios: rol === "BARBER" || rol === "ADMIN_BARBER" };
}

/** ¿El rol ocupa un cupo de profesional del plan? Un administrador puro y un propietario sin perfil profesional NO. */
export function rolConsumeCupo(rol: RolAsignable): boolean {
  return capacidadesDeRol(rol).prestaServicios;
}

export const ETIQUETA_ROL: Record<RolEquipo, string> = {
  BUSINESS_OWNER: "Propietario",
  BUSINESS_ADMIN: "Administrador",
  ADMIN_BARBER: "Administrador y profesional",
  BARBER: "Profesional",
};

export const DESCRIPCION_ROL: Record<RolAsignable, string> = {
  BARBER: "Atiende clientes y tiene agenda. Ocupa un cupo de profesional.",
  BUSINESS_ADMIN: "Administra el equipo pero no atiende ni aparece en la agenda pública. No ocupa cupo.",
  ADMIN_BARBER: "Administra el equipo y además atiende clientes. Ocupa un cupo de profesional.",
};

/** Lo que consume `capacidad_profesional_negocio` / `cupo_plan_negocio.capacidad` (migración 159), ya con nombres de la aplicación. */
export interface CapacidadProfesional {
  planCodigo: string;
  incluidos: number | null;
  adicionalesContratados: number;
  limite: number | null;
  activos: number;
  suspendidos: number;
  pendientesActivacion: number;
  invitacionesPendientes: number;
  operativos: number;
  ocupados: number;
  disponibles: number | null;
  exceso: number;
}

type CapacidadFila = {
  plan_codigo: string;
  incluidos: number | null;
  adicionales_contratados: number;
  limite: number | null;
  activos: number;
  suspendidos: number;
  pendientes_activacion: number;
  invitaciones_pendientes: number;
  operativos: number;
  ocupados: number;
  disponibles: number | null;
  exceso: number;
};

export function mapearCapacidad(f: CapacidadFila): CapacidadProfesional {
  return {
    planCodigo: f.plan_codigo,
    incluidos: f.incluidos,
    adicionalesContratados: f.adicionales_contratados,
    limite: f.limite,
    activos: f.activos,
    suspendidos: f.suspendidos,
    pendientesActivacion: f.pendientes_activacion,
    invitacionesPendientes: f.invitaciones_pendientes,
    operativos: f.operativos,
    ocupados: f.ocupados,
    disponibles: f.disponibles,
    exceso: f.exceso,
  };
}

export type { CapacidadFila };
