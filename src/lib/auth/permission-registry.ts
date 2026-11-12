import type { Permisos, Rol } from "./tipos";

/**
 * Fuente única de permisos — ADR-015, Fase A/P. Transcribe completa la matriz
 * maestra de `StylerNow_Project_Bible_V3/03-Business-Rules/01_Roles.md` (14
 * módulos). `docs/PERMISSION_REGISTRY.md` se GENERA desde este archivo — no
 * se edita a mano. Un permiso nuevo se agrega primero en `01_Roles.md`, y
 * después aquí; nunca al revés.
 *
 * `alcance` refleja la leyenda del documento fuente:
 *   "ninguno" = ❌ · "propio" = 🔒 · "sede" = 🏢 · "negocio" = 🌐 · "total" = 👑
 *
 * Nota: 3 filas (marcadas [★]) no están en la matriz literal de 01_Roles.md
 * porque son específicas de la implementación (marcar sede principal,
 * combos, asignación Staff↔Servicio) — ya documentadas como "mismo criterio
 * que Cambiar precio: exclusivo Barbería" en comentarios existentes del
 * código (`panel/servicios/page.tsx`, tasklist). Se registran aquí con ese
 * mismo alcance para no perder la trazabilidad.
 */

export type Alcance = "ninguno" | "propio" | "sede" | "negocio" | "total";

export interface PermisoRegistro {
  modulo: string;
  accion: string;
  alcance: Record<Rol, Alcance>;
}

const A = (
  cliente: Alcance,
  staff: Alcance,
  guardian: Alcance,
  barberia: Alcance,
  supersu: Alcance = "total"
): Record<Rol, Alcance> => ({ cliente, staff, guardian, barberia, supersu });

export const PERMISOS_REGISTRO: PermisoRegistro[] = [
  // Marketplace
  { modulo: "marketplace", accion: "buscar_negocios", alcance: A("total", "total", "total", "total") },
  { modulo: "marketplace", accion: "ver_promociones", alcance: A("total", "total", "total", "total") },
  { modulo: "marketplace", accion: "ver_resenas", alcance: A("total", "total", "total", "total") },
  { modulo: "marketplace", accion: "compartir_negocio", alcance: A("total", "total", "total", "total") },
  { modulo: "marketplace", accion: "guardar_favoritos", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "marketplace", accion: "crear_anuncios", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "marketplace", accion: "moderar", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },

  // Perfil del usuario
  { modulo: "perfil", accion: "editar", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "perfil", accion: "cambiar_password", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "perfil", accion: "configurar_notificaciones", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "perfil", accion: "ver_actividad", alcance: A("propio", "propio", "propio", "negocio") },

  // Reservas
  { modulo: "reserva", accion: "crear", alcance: A("total", "propio", "sede", "negocio") },
  { modulo: "reserva", accion: "reprogramar", alcance: A("propio", "propio", "sede", "negocio") },
  { modulo: "reserva", accion: "cancelar", alcance: A("propio", "propio", "sede", "negocio") },
  { modulo: "reserva", accion: "check_in", alcance: A("propio", "propio", "sede", "negocio") },
  { modulo: "reserva", accion: "ver_detalle", alcance: A("propio", "propio", "sede", "negocio") },
  { modulo: "reserva", accion: "reasignar_profesional", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "reserva", accion: "crear_lista_espera", alcance: A("propio", "ninguno", "sede", "negocio") },

  // Agenda
  { modulo: "agenda", accion: "ver_propia", alcance: A("ninguno", "propio", "propio", "negocio") },
  { modulo: "agenda", accion: "ver_completa_sede", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "agenda", accion: "bloquear_horario_propio", alcance: A("ninguno", "propio", "sede", "negocio") },
  { modulo: "agenda", accion: "desbloquear_horario", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "agenda", accion: "configurar_vacaciones", alcance: A("ninguno", "propio", "sede", "negocio") },

  // Servicios
  { modulo: "servicio", accion: "ver", alcance: A("total", "total", "total", "negocio") },
  { modulo: "servicio", accion: "crear", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "servicio", accion: "editar_duracion", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "servicio", accion: "activar_desactivar", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "servicio", accion: "cambiar_precio", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "servicio", accion: "gestionar_combos", alcance: A("ninguno", "ninguno", "ninguno", "negocio") }, // [★]
  { modulo: "servicio", accion: "asignar_staff", alcance: A("ninguno", "ninguno", "ninguno", "negocio") }, // [★]

  // Gestión del Staff
  { modulo: "staff", accion: "ver_companeros", alcance: A("ninguno", "sede", "sede", "negocio") },
  { modulo: "staff", accion: "invitar", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "cancelar_invitacion", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "convertir_guardian", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "quitar_guardian", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "trasladar_sede", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "suspender", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "reactivar", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "eliminar_acceso", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "staff", accion: "cambiar_horario_otro", alcance: A("ninguno", "ninguno", "sede", "negocio") },

  // Gestión de Sedes
  { modulo: "sede", accion: "ver", alcance: A("propio", "sede", "sede", "negocio") },
  { modulo: "sede", accion: "crear", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "sede", accion: "editar", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  // Corregido por ADR-015 (2026-09-16): Guardian NO cierra/reabre sede —
  // impacta Reservas/pagos/Agenda/reputación/Marketplace, es decisión del
  // dueño. 01_Roles.md tenía el símbolo incorrecto (🏢); ya corregido ahí.
  { modulo: "sede", accion: "cerrar_temporalmente", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "sede", accion: "eliminar", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "sede", accion: "marcar_principal", alcance: A("ninguno", "ninguno", "ninguno", "negocio") }, // [★]

  // Clientes (CRM)
  { modulo: "cliente", accion: "ver_historial_propio", alcance: A("propio", "ninguno", "ninguno", "ninguno") },
  { modulo: "cliente", accion: "ver_historial_atendido", alcance: A("ninguno", "propio", "sede", "negocio") },
  { modulo: "cliente", accion: "agregar_notas", alcance: A("ninguno", "propio", "sede", "negocio") },
  { modulo: "cliente", accion: "etiquetar", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "cliente", accion: "exportar", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },

  // Finanzas
  { modulo: "finanzas", accion: "ver_wallet", alcance: A("propio", "propio", "propio", "negocio") },
  { modulo: "finanzas", accion: "ver_ingresos_personales", alcance: A("ninguno", "propio", "propio", "ninguno") },
  { modulo: "finanzas", accion: "ver_ingresos_sede", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "finanzas", accion: "ver_ingresos_globales", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "finanzas", accion: "configurar_comisiones", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "finanzas", accion: "solicitar_retiro", alcance: A("ninguno", "propio", "propio", "negocio") },
  { modulo: "finanzas", accion: "descargar_reportes", alcance: A("ninguno", "ninguno", "sede", "negocio") },

  // Punto de Venta (POS) — no estaba en la matriz original de 01_Roles.md,
  // agregado ahí junto con este registro (ADR-015, 2026-09-16).
  { modulo: "pos", accion: "ver_caja", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "pos", accion: "registrar_venta", alcance: A("ninguno", "ninguno", "sede", "negocio") },

  // Inventario
  { modulo: "inventario", accion: "ver", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "inventario", accion: "registrar_salida", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "inventario", accion: "registrar_entrada", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "inventario", accion: "solicitar_reposicion", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "inventario", accion: "configurar_reglas", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },

  // Publicidad y Marketing — corregido por ADR-015: Guardian queda
  // completamente fuera del módulo (decisión de inversión del negocio).
  { modulo: "publicidad", accion: "ver_campanas", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "publicidad", accion: "crear_campana", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "publicidad", accion: "activar_anuncios", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "publicidad", accion: "administrar_presupuesto", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },

  // Fidelización
  { modulo: "lealtad", accion: "ver_puntos_o_nivel", alcance: A("propio", "propio", "propio", "negocio") },
  { modulo: "lealtad", accion: "canjear_beneficios", alcance: A("propio", "ninguno", "ninguno", "negocio") },
  { modulo: "lealtad", accion: "configurar_recompensas", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "lealtad", accion: "ver_niveles_staff", alcance: A("ninguno", "ninguno", "sede", "negocio") },

  // Configuración del Negocio
  { modulo: "configuracion_negocio", accion: "editar_datos_generales", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "configuracion_negocio", accion: "cambiar_horarios_globales", alcance: A("ninguno", "ninguno", "sede", "negocio") },
  { modulo: "configuracion_negocio", accion: "configurar_politicas", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "configuracion_negocio", accion: "configurar_metodos_pago", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },
  { modulo: "configuracion_negocio", accion: "configurar_planes", alcance: A("ninguno", "ninguno", "ninguno", "negocio") },

  // Soporte
  { modulo: "soporte", accion: "crear_ticket", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "soporte", accion: "ver_ticket_propio", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "soporte", accion: "responder_ticket_propio", alcance: A("propio", "propio", "propio", "propio") },
  { modulo: "soporte", accion: "gestionar_todos_los_tickets", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },

  // Administración Global (exclusivo SuperSU)
  { modulo: "admin_global", accion: "cms", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
  { modulo: "admin_global", accion: "moderar_contenido", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
  { modulo: "admin_global", accion: "gestionar_planes_saas", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
  { modulo: "admin_global", accion: "feature_flags", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
  { modulo: "admin_global", accion: "auditoria_global", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
  { modulo: "admin_global", accion: "configuracion_sistema", alcance: A("ninguno", "ninguno", "ninguno", "ninguno") },
];

export function alcanceDe(rol: Rol, modulo: string, accion: string): Alcance {
  const fila = PERMISOS_REGISTRO.find((p) => p.modulo === modulo && p.accion === accion);
  return fila ? fila.alcance[rol] : "ninguno";
}

export function tienePermiso(rol: Rol, modulo: string, accion: string): boolean {
  return alcanceDe(rol, modulo, accion) !== "ninguno";
}

/**
 * Deriva los 24 booleanos ya existentes de `Permisos` (`resolver-contexto.ts`)
 * a partir del registro — mismo comportamiento de hoy, ahora con una sola
 * fuente. `rol` debe ser "guardian" o "barberia" (los únicos que usan este
 * shape hoy); para "staff"/"cliente"/"supersu" cada resolver arma el suyo
 * directamente (ver Fase A del plan).
 */
export function derivarPermisosPanel(rol: Extract<Rol, "guardian" | "barberia">): Permisos {
  const p = (modulo: string, accion: string) => tienePermiso(rol, modulo, accion);
  return {
    verTodasLasSedes: alcanceDe(rol, "sede", "ver") === "negocio",
    crearSede: p("sede", "crear"),
    eliminarSede: p("sede", "eliminar"),
    cerrarReabrirSede: p("sede", "cerrar_temporalmente"),
    marcarSedePrincipal: p("sede", "marcar_principal"),
    trasladarStaff: p("staff", "trasladar_sede"),
    editarSedePropia: p("sede", "editar"),
    verConfiguracionGlobal: p("configuracion_negocio", "editar_datos_generales"),
    verFacturacion: p("configuracion_negocio", "configurar_planes"),
    invitarStaff: p("staff", "invitar"),
    cancelarInvitacionStaff: p("staff", "cancelar_invitacion"),
    promoverGuardian: p("staff", "convertir_guardian"),
    revocarGuardian: p("staff", "quitar_guardian"),
    suspenderStaff: p("staff", "suspender"),
    reactivarStaff: p("staff", "reactivar"),
    retirarStaff: p("staff", "eliminar_acceso"),
    cambiarHorarioOtroStaff: p("staff", "cambiar_horario_otro"),
    crearServicio: p("servicio", "crear"),
    cambiarPrecioServicio: p("servicio", "cambiar_precio"),
    editarServicio: p("servicio", "editar_duracion"),
    activarDesactivarServicio: p("servicio", "activar_desactivar"),
    gestionarCombos: p("servicio", "gestionar_combos"),
    asignarStaffServicio: p("servicio", "asignar_staff"),
    exportarClientes: p("cliente", "exportar"),
  };
}
