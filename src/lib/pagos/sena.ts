/**
 * Cálculo de la Seña (03-Business-Rules/03_Payment_Rules.md).
 *
 * Espejo exacto de la función `calcular_sena` de la migración 008. Existe solo para
 * MOSTRAR el monto antes de confirmar: el valor que se cobra es siempre el que calcula
 * la base de datos (05-API/04_Payments.md, `MONTO_SENA_INVALIDO`).
 */

export interface ConfigSena {
  pago_completo_en_app: boolean;
  sena_pct: number | null;
  sena_monto_fijo: number | null;
  sena_minimo: number;
  sena_maximo: number;
}

export function calcularSenaEstimada(config: ConfigSena, montoTotal: number) {
  if (config.pago_completo_en_app) return montoTotal;

  const base = config.sena_monto_fijo ?? Math.round((montoTotal * (config.sena_pct ?? 20)) / 100);
  const conMinimo = Math.max(base, config.sena_minimo);
  const conMaximo = Math.min(conMinimo, config.sena_maximo);

  // La Seña nunca supera el total, ni siquiera cuando el mínimo del Negocio lo excede.
  return Math.min(conMaximo, montoTotal);
}

/** Texto resumido de la política de cancelación, obligatorio antes de pagar. */
export function resumenPoliticaCancelacion(negocio: {
  ventana_reembolso_total_horas: number;
  ventana_reembolso_parcial_horas: number;
  reembolso_parcial_pct: number;
}) {
  return [
    `Cancelás con más de ${negocio.ventana_reembolso_total_horas} h de anticipación: te devolvemos el 100% de la seña.`,
    `Entre ${negocio.ventana_reembolso_total_horas} h y ${negocio.ventana_reembolso_parcial_horas} h antes: ${negocio.reembolso_parcial_pct}%.`,
    `Con menos de ${negocio.ventana_reembolso_parcial_horas} h: la seña queda para el negocio por el espacio reservado.`,
    "Si el negocio cancela, te devolvemos el 100% siempre, sin importar cuándo.",
  ];
}
