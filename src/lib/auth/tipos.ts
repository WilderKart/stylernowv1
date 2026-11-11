/**
 * Contrato único de identidad — ADR-015. Los tres resolvers existentes
 * (`resolverContexto()`, `obtenerContextoStaff()`, `requireSuperSU()`) NO se
 * fusionan (ADL-011/015/019 ya ratificaron mantenerlos separados) — cada uno
 * mapea su resultado a este mismo `Contexto`, para que `requireRole()` y todo
 * el resto del sistema tengan una única forma de leer identidad/permisos.
 */

export type Rol = "cliente" | "staff" | "guardian" | "barberia" | "supersu";

export type EstadoCuenta = "activo" | "pendiente" | "suspendido" | "bloqueado";
export type EstadoNegocio = "activo" | "revision" | "suspendido";
export type EstadoStaff = "activo" | "invitado" | "trasladado" | "suspendido";

/**
 * Booleanos de UI/autorización estructural ya existentes (`resolver-contexto.ts`).
 * Se mantienen intactos a propósito — 25+ archivos ya los consumen — y ahora se
 * derivan de `permission-registry.ts` en vez de codificarse a mano por rol.
 */
export interface Permisos {
  verTodasLasSedes: boolean;
  crearSede: boolean;
  eliminarSede: boolean;
  cerrarReabrirSede: boolean;
  marcarSedePrincipal: boolean;
  trasladarStaff: boolean;
  editarSedePropia: boolean;
  verConfiguracionGlobal: boolean;
  verFacturacion: boolean;
  invitarStaff: boolean;
  cancelarInvitacionStaff: boolean;
  promoverGuardian: boolean;
  revocarGuardian: boolean;
  suspenderStaff: boolean;
  reactivarStaff: boolean;
  retirarStaff: boolean;
  cambiarHorarioOtroStaff: boolean;
  crearServicio: boolean;
  cambiarPrecioServicio: boolean;
  editarServicio: boolean;
  activarDesactivarServicio: boolean;
  gestionarCombos: boolean;
  asignarStaffServicio: boolean;
  exportarClientes: boolean;
}

/** Objeto neutro para roles (staff/cliente/supersu) cuya autorización real no
 * pasa por este shape de Panel — la aplican RLS/RPC o `requireSuperSU()` directamente. */
export const PERMISOS_NINGUNO_CONTEXTO: Permisos = {
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

export interface Contexto {
  userId: string;
  rol: Rol;
  negocioId?: string;
  sedeId?: string;
  onboardingCompleto: boolean;
  estadoCuenta: EstadoCuenta;
  estadoNegocio?: EstadoNegocio;
  estadoStaff?: EstadoStaff;
  permisos: Permisos;
  /** Se completa en Fase G/H (Session Version, Session Registry) — hasta
   * entonces, valores neutros que no alteran ninguna decisión de autorización. */
  sesion: { id: string; trusted: boolean; riskScore: number; aal: "aal1" | "aal2" };
}
