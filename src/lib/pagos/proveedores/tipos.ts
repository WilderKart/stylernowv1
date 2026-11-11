import "server-only";

/**
 * Contrato de pasarela de pago de SUSCRIPCIONES (cobro recurrente). Cada país apunta a una
 * pasarela (`pais.pasarela`). Añadir Stripe o Payoneer = completar su adaptador y activar
 * `pais.cobro_recurrente_habilitado`; ningún otro archivo del flujo de planes cambia.
 *
 * Los cobros de reservas (anticipo) siguen por `src/lib/pagos/mercadopago.ts`; esto es aparte.
 */
export type PasarelaId = "MERCADOPAGO" | "STRIPE" | "PAYONEER" | "MANUAL";

export type ResultadoPasarela<T = object> = ({ ok: true } & T) | { ok: false; error: string; codigo: string };

export interface ProveedorPago {
  id: PasarelaId;
  /** Hay credenciales y el adaptador está implementado. */
  habilitado(): boolean;
  /** Puede guardar un método de pago y cobrar solo, sin que el usuario intervenga. */
  soportaCobroRecurrente(): boolean;
  /** Convierte lo que devuelve el cliente de la pasarela (token) en una referencia guardable. */
  registrarMetodoPago(entrada: { token: string; negocioId: string; email: string }): Promise<ResultadoPasarela<{ ref: string }>>;
  /** Cobra un ciclo de suscripción contra el método guardado. Idempotente por `idempotencyKey`. */
  cobrarSuscripcion(entrada: {
    ref: string;
    monto: number;
    moneda: string;
    descripcion: string;
    idempotencyKey: string;
  }): Promise<ResultadoPasarela<{ idExterno: string }>>;
}

export const NO_CONFIGURADO = (id: PasarelaId): { ok: false; error: string; codigo: string } => ({
  ok: false,
  codigo: "PROVEEDOR_NO_CONFIGURADO",
  error: `La pasarela ${id} todavía no está habilitada para cobros recurrentes.`,
});
