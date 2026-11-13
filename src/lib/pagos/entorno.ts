/**
 * Entorno de pagos: SANDBOX (pruebas) o PRODUCCION. Se decide SOLO en el servidor.
 *
 * Reglas (directiva Sandbox, etapa 2):
 *  - Por defecto, SANDBOX. PRODUCCION exige `MERCADOPAGO_ENTORNO=produccion` Y que el despliegue sea el
 *    de producción de Vercel (`VERCEL_ENV=production`). Una variable mal copiada en Preview o en local
 *    nunca activa cobros reales.
 *  - En PRODUCCION se rechaza cualquier token `TEST-` (la referencia oficial: "TEST, only valid in sandbox").
 *  - En SANDBOX no basta el prefijo: la documentación de Mercado Pago es contradictoria sobre si los tokens
 *    de prueba empiezan por TEST- o APP_USR-. Lo que manda es `live_mode` del pago (verificado en cada
 *    pago contra el entorno) y el entorno guardado en cada conexión y en cada pago.
 */

export type EntornoPagos = "SANDBOX" | "PRODUCCION";

export class EntornoPagosInvalido extends Error {}

export function entornoPagos(env: Record<string, string | undefined> = process.env): EntornoPagos {
  const pedido = (env.MERCADOPAGO_ENTORNO ?? "").trim().toLowerCase();
  if (pedido === "produccion") {
    if (env.VERCEL_ENV !== "production") {
      throw new EntornoPagosInvalido("MERCADOPAGO_ENTORNO=produccion solo se permite en el despliegue de producción de Vercel.");
    }
    return "PRODUCCION";
  }
  return "SANDBOX";
}

/** Falla si el token no puede usarse en el entorno actual. Nunca registra el token. */
export function validarTokenParaEntorno(token: string, entorno: EntornoPagos = entornoPagos()) {
  if (!token) throw new EntornoPagosInvalido("TOKEN_VACIO");
  if (entorno === "PRODUCCION" && token.startsWith("TEST-")) {
    throw new EntornoPagosInvalido("TOKEN_DE_PRUEBA_EN_PRODUCCION");
  }
}

/** ¿El `live_mode` que informó el proveedor corresponde al entorno actual? */
export function liveModeCoincide(liveMode: boolean | null | undefined, entorno: EntornoPagos = entornoPagos()) {
  if (liveMode === null || liveMode === undefined) return false;
  return entorno === "PRODUCCION" ? liveMode === true : liveMode === false;
}

/**
 * Medios excluidos en los cobros cuyo beneficiario es el negocio (Split 1:1). Según la documentación
 * oficial, el split "sólo permite realizar pagos con dinero en cuenta entre cuentas de Mercado Pago. No se
 * permiten transferencias de instituciones financieras externas": PSE (bank_transfer) y Efecty (ticket)
 * quedan fuera hasta que Mercado Pago confirme por escrito su compatibilidad. "Dinero en cuenta" no se
 * puede excluir (lo dice la documentación).
 */
export const TIPOS_EXCLUIDOS_SPLIT = ["bank_transfer", "ticket"] as const;

/**
 * Medios excluidos en los cobros de un negocio (token OAuth del vendedor, sin comisión).
 *
 * Por defecto se excluyen PSE y Efecty (comportamiento vigente). Para VALIDAR en sandbox el modelo
 * "OAuth + Checkout Pro sin split" se puede habilitar PSE con `MERCADOPAGO_PSE_NEGOCIOS=probar`, y SOLO
 * tiene efecto en SANDBOX: en producción no cambia nada hasta que Mercado Pago confirme por escrito que
 * PSE es compatible con este modelo (y entonces se cambia este código, con revisión).
 */
export function tiposExcluidosCobroNegocio(
  env: Record<string, string | undefined> = process.env,
  entorno: EntornoPagos = entornoPagos(env)
): readonly string[] {
  if (entorno === "SANDBOX" && (env.MERCADOPAGO_PSE_NEGOCIOS ?? "").trim().toLowerCase() === "probar") {
    return ["ticket"]; // PSE habilitado solo para la prueba; Efecty sigue fuera (pago diferido)
  }
  return TIPOS_EXCLUIDOS_SPLIT;
}

/** Capacidades declaradas por proveedor y medio (no se habilita lo no verificado). */
export const CAPACIDADES_MERCADOPAGO_CO = {
  split_1_1: true,
  marketplace_fee_cero: true,
  reembolso_total: true,
  reembolso_parcial: true,
  medios_anticipo_negocio: {
    credit_card: "VERIFICADO",
    debit_card: "VERIFICADO",
    account_money: "VERIFICADO",
    bank_transfer_pse: "NO_VERIFICADO_EXCLUIDO",
    ticket_efecty: "NO_VERIFICADO_EXCLUIDO",
    nequi: "NO_DISPONIBLE_EN_CHECKOUT_PRO",
    bre_b: "NO_DISPONIBLE_EN_CHECKOUT_PRO",
  },
  reembolso_sin_saldo_vendedor: "EL_PROVEEDOR_LO_RECHAZA_SIN_FONDOS_DE_STYLERNOW",
} as const;
