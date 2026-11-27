export interface Capacidades {
  propietario: boolean;
  ver: boolean;
  ver_sede: boolean;
  configurar: boolean;
  liquidar: boolean;
  pagar: boolean;
  exportar: boolean;
  novedades: boolean;
}

export interface FilaGanancia {
  id: string;
  fecha: string;
  prestado_at: string;
  reserva_id: string;
  servicio: string;
  categoria: string | null;
  cliente: string | null;
  staff_id: string;
  profesional: string | null;
  sede_id: string | null;
  sede: string | null;
  precio_original: number;
  descuento: number;
  base_tipo: string | null;
  base_comision: number;
  pct: number | null;
  comision: number;
  participacion_negocio: number;
  valor_neto: number;
  origen_regla: string | null;
  regla_version: number | null;
  estado_comision: string;
  estado_cobro: string;
  liquidacion_id: string | null;
}

export interface ListaGanancias {
  total: number;
  limite: number;
  desplazamiento: number;
  modo: string;
  filas: FilaGanancia[];
}

export interface ResumenGanancias {
  servicios: number;
  produccion_bruta: number;
  produccion_neta: number;
  descuentos: number;
  comisiones_generadas: number;
  comisiones_pendientes: number;
  comisiones_liquidadas: number;
  en_revision: number;
  sin_regla: number;
  participacion_negocio: number | null;
  ticket_promedio: number;
  ajustes: number;
  pagado: number;
  saldo_por_pagar: number;
  servicios_cancelados: number;
  modo: string;
}

export interface Liquidacion {
  id: string;
  numero: number;
  staff_id: string;
  staff_nombre: string | null;
  sede_id: string | null;
  periodo_tipo: string;
  desde: string;
  hasta: string;
  estado: string;
  total_comisiones: number;
  total_ajustes: number;
  total_neto: number;
  pagado: number;
  saldo: number;
  servicios: number;
  produccion: number;
  cerrada_at: string;
}

export const ETIQUETA_ESTADO_COMISION: Record<string, string> = {
  SIN_REGLA: "Sin regla",
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  LIQUIDADA: "Liquidada",
  REVERTIDA: "Revertida",
};

export const ETIQUETA_COBRO: Record<string, string> = {
  SIN_COBRO: "Sin cobro",
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADO: "Pagado",
  CUBIERTO_MEMBRESIA: "Cubierto por membresía",
  REEMBOLSO_PARCIAL: "Reembolso parcial",
  REEMBOLSO_TOTAL: "Reembolsado",
};

export const ETIQUETA_LIQUIDACION: Record<string, string> = {
  CERRADA: "Por pagar",
  PAGADA_PARCIAL: "Pago parcial",
  PAGADA: "Pagada",
  REVERTIDA: "Revertida",
};
