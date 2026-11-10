import "server-only";
import { NO_CONFIGURADO, type PasarelaId, type ProveedorPago } from "./tipos";

/**
 * Mercado Pago: Checkout Pro (único en uso hoy) NO guarda tarjetas. El cobro recurrente exige
 * activar Preapproval en la cuenta comercial (ver docs/PENDING_DECISIONS.md). Hasta entonces
 * este adaptador declara que no soporta cobro recurrente y la prueba de 14 días no se puede iniciar.
 */
const mercadoPago: ProveedorPago = {
  id: "MERCADOPAGO",
  habilitado: () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
  soportaCobroRecurrente: () => false,
  registrarMetodoPago: async () => NO_CONFIGURADO("MERCADOPAGO"),
  cobrarSuscripcion: async () => NO_CONFIGURADO("MERCADOPAGO"),
};

/** Stripe: pendiente de credenciales (STRIPE_SECRET_KEY) y de la decisión del fundador. */
const stripe: ProveedorPago = {
  id: "STRIPE",
  habilitado: () => false,
  soportaCobroRecurrente: () => false,
  registrarMetodoPago: async () => NO_CONFIGURADO("STRIPE"),
  cobrarSuscripcion: async () => NO_CONFIGURADO("STRIPE"),
};

/** Payoneer: pendiente de credenciales y de la decisión del fundador. */
const payoneer: ProveedorPago = {
  id: "PAYONEER",
  habilitado: () => false,
  soportaCobroRecurrente: () => false,
  registrarMetodoPago: async () => NO_CONFIGURADO("PAYONEER"),
  cobrarSuscripcion: async () => NO_CONFIGURADO("PAYONEER"),
};

/** Sin pasarela: el cobro lo gestiona SuperSU a mano. */
const manual: ProveedorPago = {
  id: "MANUAL",
  habilitado: () => false,
  soportaCobroRecurrente: () => false,
  registrarMetodoPago: async () => NO_CONFIGURADO("MANUAL"),
  cobrarSuscripcion: async () => NO_CONFIGURADO("MANUAL"),
};

const PROVEEDORES: Record<PasarelaId, ProveedorPago> = {
  MERCADOPAGO: mercadoPago,
  STRIPE: stripe,
  PAYONEER: payoneer,
  MANUAL: manual,
};

export function proveedorDe(pasarela: string): ProveedorPago {
  return PROVEEDORES[pasarela as PasarelaId] ?? manual;
}
