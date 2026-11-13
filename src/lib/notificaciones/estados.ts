/**
 * Espejo en TS de la máquina de estados del outbox (migración 124, trigger `trg_notif_outbox_maquina`).
 * La base es la que manda: este mapa solo sirve para tipos y para la prueba que verifica que ambos
 * coinciden (tests/notificaciones.test.ts lee el bloque TRANSICIONES:INICIO/FIN de la migración).
 */
export const CANALES = ["EMAIL", "PUSH", "PANEL"] as const;
export type Canal = (typeof CANALES)[number];

export const CATEGORIAS = ["TRANSACCIONAL", "MARKETING"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ESTADOS_OUTBOX = [
  "PENDIENTE",
  "PROCESANDO",
  "ENVIADO",
  "FALLIDO",
  "REINTENTANDO",
  "CANAL_NO_HABILITADO",
  "OMITIDO_PREFERENCIA",
] as const;
export type EstadoOutbox = (typeof ESTADOS_OUTBOX)[number];

export const ESTADOS_FINALES: readonly EstadoOutbox[] = ["ENVIADO", "FALLIDO", "OMITIDO_PREFERENCIA"];

export const TRANSICIONES_OUTBOX: Readonly<Record<EstadoOutbox, readonly EstadoOutbox[]>> = {
  PENDIENTE: ["PROCESANDO", "OMITIDO_PREFERENCIA"],
  REINTENTANDO: ["PROCESANDO", "OMITIDO_PREFERENCIA"],
  PROCESANDO: ["ENVIADO", "REINTENTANDO", "FALLIDO", "CANAL_NO_HABILITADO", "OMITIDO_PREFERENCIA"],
  CANAL_NO_HABILITADO: ["PENDIENTE"],
  ENVIADO: [],
  FALLIDO: [],
  OMITIDO_PREFERENCIA: [],
};

export function transicionValida(origen: EstadoOutbox, destino: EstadoOutbox): boolean {
  return TRANSICIONES_OUTBOX[origen].includes(destino);
}

/** Códigos que el worker envía a `notif_outbox_registrar` con significado especial. */
export const CODIGO_CANAL_NO_HABILITADO = "CANAL_NO_HABILITADO";
export const CODIGO_SIN_SUSCRIPCION_PUSH = "SIN_SUSCRIPCION_PUSH";
