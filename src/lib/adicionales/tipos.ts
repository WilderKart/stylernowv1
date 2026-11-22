/**
 * Barberos adicionales (FASE 2A). Tipos de lo que devuelven las RPC de las migraciones 169-177.
 * Ningún precio, plazo ni fecha se calcula aquí: todo llega de la base (precio por plan, función de fechas en America/Bogota,
 * máquina de estados). Este módulo solo describe y da formato.
 */

export type EstadoLote =
  | "PENDIENTE_CONTRATACION"
  | "CHECKOUT_INICIADO"
  | "PAGO_PENDIENTE"
  | "PAGO_CONFIRMADO"
  | "ACTIVO"
  | "PROXIMO_A_RENOVAR"
  | "EN_GRACIA"
  | "SUSPENDIDO"
  | "CANCELADO"
  | "EXPIRADO_SIN_PAGO"
  | "REEMBOLSADO";

/** Mismo vocabulario que `adicional_estado_def` (la base manda; esto solo evita ir a leerla para pintar una etiqueta). */
export const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  PENDIENTE_CONTRATACION: "Pendiente de contratación",
  CHECKOUT_INICIADO: "Checkout iniciado",
  PAGO_PENDIENTE: "Pago pendiente",
  PAGO_CONFIRMADO: "Pago confirmado",
  ACTIVO: "Activo",
  PROXIMO_A_RENOVAR: "Próximo a renovar",
  EN_GRACIA: "En gracia",
  SUSPENDIDO: "Suspendido",
  CANCELADO: "Cancelado (sin renovación)",
  EXPIRADO_SIN_PAGO: "Expirado sin pago",
  REEMBOLSADO: "Reembolsado",
};

export interface Cotizacion {
  negocio_id: string;
  pais_codigo: string;
  plan_codigo: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  moneda: string;
  periodo_dias: number;
  vence_si_paga_hoy: string;
  gracia_dias: number;
  gracia_hasta: string;
  avisos_dias_antes: number[];
  max_por_lote: number;
  max_por_negocio: number;
  contratados: number;
  puede_contratar_hasta: number;
  reembolso_automatico: boolean;
  cancelacion_efecto: "FIN_PERIODO";
}

export interface CobroLote {
  id: string;
  periodo_n: number;
  monto: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "REEMBOLSADO" | "ANULADO";
  creado_at: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  mp_payment_id: string | null;
}

export interface LoteAdicional {
  id: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  moneda: string;
  estado: EstadoLote;
  estado_etiqueta: string;
  origen: "CHECKOUT_PRO" | "MANUAL_SUPERADMIN";
  contratado_at: string;
  inicio_periodo_at: string | null;
  vigente_hasta: string | null;
  gracia_fin: string | null;
  dias_para_vencer: number | null;
  periodo_n: number;
  cancelar_renovacion: boolean;
  aporta_cupo: boolean;
  puede_renovar: boolean;
  puede_cancelar: boolean;
  pago_pendiente_id: string | null;
  cobros: CobroLote[];
}

export interface CapacidadAdicionales {
  plan_codigo: string;
  plan_nombre: string;
  incluidos: number | null;
  tope_plan: number | null;
  limite: number | null;
  adicionales_contratados: number;
  adicionales_activos: number;
  adicionales_en_gracia: number;
  adicionales_suspendidos: number;
  adicionales_en_proceso: number;
  adicionales_vencen_at: string | null;
  ocupados: number;
  activos: number;
  suspendidos: number;
  disponibles: number | null;
  exceso: number;
  a_regularizar: number;
}

export interface PanelAdicionales {
  capacidad: CapacidadAdicionales | null;
  precio_actual: Cotizacion | { error: string };
  lotes: LoteAdicional[];
  config: { gracia_dias: number; periodo_dias: number; avisos_dias_antes: number[]; max_por_lote: number; max_por_negocio: number; habilitado: boolean };
}

/** Mensajes para los errores de las RPC (los códigos los pone la base). */
export const MENSAJES_ADICIONALES: Record<string, string> = {
  NO_AUTORIZADO: "Solo el propietario del negocio puede contratar barberos adicionales.",
  ADICIONALES_DESHABILITADOS: "Los barberos adicionales no están disponibles por ahora.",
  NEGOCIO_NO_ACTIVO: "Tu negocio debe estar activo para contratar barberos adicionales.",
  SUSCRIPCION_NO_VIGENTE: "Tu plan principal debe estar vigente para contratar adicionales. Regulariza tu plan primero.",
  CANTIDAD_INVALIDA: "Elige al menos 1 barbero adicional.",
  MAXIMO_POR_LOTE_EXCEDIDO: "Superaste el máximo de barberos que se pueden contratar en una sola compra.",
  MAXIMO_POR_NEGOCIO_EXCEDIDO: "Superaste el máximo de barberos adicionales permitido para tu establecimiento.",
  ADICIONAL_SIN_PRECIO: "Todavía no hay precio publicado para tu plan y país. Escríbele a soporte.",
  PRECIO_CAMBIO: "El precio cambió mientras decidías. Revisa el nuevo total y confirma de nuevo.",
  LOTE_NO_RENOVABLE: "Este grupo ya no se puede renovar. Contrata uno nuevo.",
  LOTE_MANUAL_NO_RENOVABLE: "Este cupo lo activó el equipo de StylerNow y no se renueva aquí. Contrata uno nuevo.",
  AUN_NO_TOCA_RENOVAR: "Todavía no toca renovar. Podrás hacerlo dentro de los días previos al vencimiento.",
  PAGO_EN_PROCESO: "Hay un pago en proceso. Espera a que Mercado Pago lo confirme.",
  LOTE_NO_CANCELABLE: "Este grupo ya no se puede cancelar.",
};

export function traducirErrorAdicional(mensaje: string): string {
  const clave = Object.keys(MENSAJES_ADICIONALES).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ADICIONALES[clave] : "No pudimos completar la operación. Intenta de nuevo.";
}

/** Solo presentación: la fecha ya viene calculada por la base; aquí se muestra en la zona del negocio. */
export function fechaAdicional(iso: string | null, locale = "es-CO"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
