/** Respuesta de admin_reporte (migración 137). */
export type Reporte = {
  reservas: {
    total: number;
    completadas: number;
    canceladas: number;
    no_show: number;
    confirmadas: number;
    pendientes_pago: number;
    valor_completadas: number;
    ticket_promedio: number;
  };
  serie: { dia: string; reservas: number; completadas: number; canceladas: number; usuarios: number }[];
  usuarios_nuevos: number;
  negocios_nuevos: number;
  pagos: {
    aprobados: number;
    monto_aprobado: number;
    monto_reservas: number;
    monto_suscripciones: number;
    reembolsado: number;
    comision_plataforma: number;
    rechazados: number;
  };
  top_negocios: { id: string; nombre: string; ciudad: string | null; reservas: number; completadas: number; valor: number }[];
  ciudades: { ciudad: string; reservas: number }[];
  suscripciones: Record<string, number>;
  planes: Record<string, number>;
};
