/**
 * Cálculo del Anticipo (03-Business-Rules/03_Payment_Rules.md).
 *
 * Espejo exacto de la función `calcular_sena` de la migración 008. Existe solo para
 * MOSTRAR el monto antes de confirmar: el valor que se cobra es siempre el que calcula
 * la base de datos (05-API/04_Payments.md, `MONTO_SENA_INVALIDO`).
 */

export interface ConfigSena {
  /** false si el negocio no tiene su cuenta de Mercado Pago conectada (migración 119): anticipo 0. */
  cobra_en_linea?: boolean;
  /** Migración 129: OBLIGATORIO (por defecto), OPCIONAL o NINGUNO. */
  anticipo_modo?: "OBLIGATORIO" | "OPCIONAL" | "NINGUNO" | string;
  pago_completo_en_app: boolean;
  sena_pct: number | null;
  sena_monto_fijo: number | null;
  sena_minimo: number;
  sena_maximo: number;
}

export function calcularSenaEstimada(config: ConfigSena, montoTotal: number) {
  if (config.cobra_en_linea === false) return 0;
  if (config.anticipo_modo === "NINGUNO") return 0;
  if (config.pago_completo_en_app) return montoTotal;

  const base = config.sena_monto_fijo ?? Math.round((montoTotal * (config.sena_pct ?? 20)) / 100);
  const conMinimo = Math.max(base, config.sena_minimo);
  const conMaximo = Math.min(conMinimo, config.sena_maximo);

  // El Anticipo nunca supera el total, ni siquiera cuando el mínimo del Negocio lo excede.
  return Math.min(conMaximo, montoTotal);
}

/** Texto resumido de la política de cancelación, obligatorio antes de pagar. */
export function resumenPoliticaCancelacion(negocio: {
  ventana_reembolso_total_horas: number;
  ventana_reembolso_parcial_horas: number;
  reembolso_parcial_pct: number;
}) {
  // Mismos límites que `cancelar_reserva` (migración 116): ≥ total → 100 %;
  // parcial ≤ horas < total → pct; < parcial o no presentarse → 0 %.
  const total = negocio.ventana_reembolso_total_horas;
  const parcial = negocio.ventana_reembolso_parcial_horas;
  return [
    `Cancelas con ${total} h o más de anticipación: te devolvemos el 100% del anticipo.`,
    `Cancelas entre ${parcial} h y menos de ${total} h antes: te devolvemos el ${Number(negocio.reembolso_parcial_pct)}%.`,
    `Con menos de ${parcial} h, o si no te presentas: el anticipo queda para el negocio por el espacio reservado.`,
    "Si el negocio cancela, te devolvemos el 100% siempre, sin importar cuándo.",
  ];
}

export interface ServicioSena {
  precio_base: number;
  anticipo_pct?: number | null;
  anticipo_monto_fijo?: number | null;
}

/**
 * Espejo de `calcular_sena_servicios` (migración 129): reglas por servicio. Solo para MOSTRAR; el valor
 * que se cobra lo calcula la base de datos.
 */
export function calcularSenaServiciosEstimada(config: ConfigSena, servicios: ServicioSena[]) {
  const total = servicios.reduce((a, s) => a + s.precio_base, 0);
  if (config.cobra_en_linea === false || config.anticipo_modo === "NINGUNO") return 0;
  if (config.pago_completo_en_app) return total;
  const conRegla = servicios.filter((s) => s.anticipo_monto_fijo != null || s.anticipo_pct != null);
  if (conRegla.length === 0) return calcularSenaEstimada(config, total);

  let v = conRegla.reduce(
    (a, s) => a + (s.anticipo_monto_fijo != null ? Math.min(s.anticipo_monto_fijo, s.precio_base) : Math.round((s.precio_base * (s.anticipo_pct ?? 0)) / 100)),
    0
  );
  const sinRegla = servicios.filter((s) => s.anticipo_monto_fijo == null && s.anticipo_pct == null).reduce((a, s) => a + s.precio_base, 0);
  if (sinRegla > 0) v += config.sena_monto_fijo ?? Math.round((sinRegla * (config.sena_pct ?? 20)) / 100);
  v = Math.max(v, config.sena_minimo);
  v = Math.min(v, config.sena_maximo);
  return Math.min(v, total);
}
