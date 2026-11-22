/**
 * Parte PURA del espejo del estado operativo (sin servidor ni red): tipos, interpretación de la respuesta de la base y textos.
 * No calcula fechas ni reglas: solo da forma a lo que devuelve `negocio_estado_operativo` (migración 164).
 */

export type FaseOperativa = "PRUEBA" | "PAGADO" | "GRACIA" | "RESTRINGIDO" | "EN_CONFIGURACION" | "SIN_SUSCRIPCION" | "OPERATIVO";

export interface EstadoOperativo {
  operativo: boolean;
  estado: FaseOperativa;
  /** PRUEBA_VENCIDA | PERIODO_VENCIDO | REQUIERE_PLAN | SUSPENDIDA | CANCELADA | ACTIVACION_MANUAL_VENCIDA | NEGOCIO_NO_ACTIVO … */
  motivo: string | null;
  suscripcionEstado: string | null;
  planCodigo: string | null;
  activacionManual: boolean;
  /** Primer instante no cubierto por el periodo de prueba/pagado (ISO). */
  limiteServicio: string | null;
  /** Primer instante de bloqueo tras la gracia (ISO). */
  bloqueoDesde: string | null;
  diaCiclo: number | null;
  diasRestantes: number | null;
  puedePagar: boolean;
}

/** Sin información (error de lectura): se trata como restringido para no mostrar funciones que la base rechazaría. */
export const DESCONOCIDO: EstadoOperativo = {
  operativo: false,
  estado: "RESTRINGIDO",
  motivo: "DESCONOCIDO",
  suscripcionEstado: null,
  planCodigo: null,
  activacionManual: false,
  limiteServicio: null,
  bloqueoDesde: null,
  diaCiclo: null,
  diasRestantes: null,
  puedePagar: true,
};

export function interpretarEstadoOperativo(crudo: unknown): EstadoOperativo {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return DESCONOCIDO;
  const d = crudo as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v : null);
  const numero = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    operativo: d.operativo === true,
    estado: (texto(d.estado) ?? "RESTRINGIDO") as FaseOperativa,
    motivo: texto(d.motivo),
    suscripcionEstado: texto(d.suscripcion_estado),
    planCodigo: texto(d.plan_codigo),
    activacionManual: d.activacion_manual === true,
    limiteServicio: texto(d.limite_servicio),
    bloqueoDesde: texto(d.bloqueo_desde),
    diaCiclo: numero(d.dia_ciclo),
    diasRestantes: numero(d.dias_restantes),
    puedePagar: d.puede_pagar !== false,
  };
}

export const MENSAJE_RESTRINGIDA =
  "Tu suscripción está restringida. Puedes consultar el histórico, pagar para reactivarla y cumplir las citas ya confirmadas, pero no crear ni modificar operaciones nuevas.";

export const MENSAJE_PUBLICO_SIN_RESERVAS = "Este establecimiento no está aceptando nuevas reservas temporalmente.";

/** ¿El mensaje de error viene del bloqueo operativo? (RPC, disparadores o la guardia de reservas). */
export function esErrorRestriccion(mensaje: string | null | undefined): boolean {
  return !!mensaje && (mensaje.includes("SUSCRIPCION_RESTRINGIDA") || mensaje.includes("NEGOCIO_REQUIERE_PLAN"));
}

/** Para Server Actions: devuelve el texto amigable si el error es del bloqueo, o el original. */
export function traducirErrorRestriccion(mensaje: string): string {
  return esErrorRestriccion(mensaje) ? MENSAJE_RESTRINGIDA : mensaje;
}
