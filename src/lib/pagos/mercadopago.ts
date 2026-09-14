import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Adaptador de la pasarela de pago (Mercado Pago · Checkout Pro).
 *
 * 05-API/04_Payments.md: iniciar un cobro NO cobra — crea una preferencia y devuelve
 * la URL a la que redirigir. El `pago` solo pasa a APROBADO cuando la pasarela lo
 * confirma, y siempre re-consultando su API, nunca creyéndole al cuerpo del webhook.
 */

const API = "https://api.mercadopago.com";

function accessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.");
  return token;
}

/** Las credenciales TEST- operan sobre el entorno de pruebas de Mercado Pago. */
export function esEntornoDePrueba() {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-");
}

async function mp<T>(ruta: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${API}${ruta}`, {
    ...rest,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...rest.headers,
    },
  });

  const cuerpo = (await res.json().catch(() => null)) as T & { message?: string };
  if (!res.ok) {
    throw new Error(
      `Mercado Pago ${res.status} en ${ruta}: ${cuerpo?.message ?? "error sin detalle"}`
    );
  }
  return cuerpo;
}

// ── Estados ────────────────────────────────────────────────────────────────

export type EstadoPasarela = "APROBADO" | "RECHAZADO" | "PENDIENTE";

/**
 * Traduce el estado de Mercado Pago a la máquina de estados de
 * 04-Data-Model/03_State_Machines.md. `in_process` / `authorized` siguen PENDIENTE:
 * el dinero aún no está capturado y la Reserva no debe confirmarse.
 */
export function traducirEstado(status: string): EstadoPasarela {
  switch (status) {
    case "approved":
      return "APROBADO";
    case "rejected":
    case "cancelled":
      return "RECHAZADO";
    default:
      return "PENDIENTE";
  }
}

// ── Preferencia de pago (Checkout Pro) ─────────────────────────────────────

export interface PreferenciaCreada {
  id: string;
  url: string;
}

export interface DatosPreferencia {
  pagoId: string;
  titulo: string;
  /** COP no admite decimales: se envía siempre como entero. */
  monto: number;
  emailPagador?: string | null;
  urlRetorno: string;
  urlWebhook?: string | null;
  /** Fin de la ventana de 10 minutos de la Reserva (03-Business-Rules/03_Payment_Rules.md). */
  expiraEn?: string | null;
}

export async function crearPreferencia(d: DatosPreferencia): Promise<PreferenciaCreada> {
  const cuerpo = {
    items: [
      {
        id: d.pagoId,
        title: d.titulo,
        quantity: 1,
        unit_price: Math.round(d.monto),
        currency_id: "COP",
      },
    ],
    // Clave de correlación pago ↔ transacción: es lo que lee el webhook.
    external_reference: d.pagoId,
    ...(d.emailPagador ? { payer: { email: d.emailPagador } } : {}),
    back_urls: { success: d.urlRetorno, failure: d.urlRetorno, pending: d.urlRetorno },
    auto_return: "approved",
    // Sin URL pública (desarrollo local) se omite: la confirmación llega por
    // `sincronizarPago`, que consulta la API de la pasarela directamente.
    ...(d.urlWebhook ? { notification_url: d.urlWebhook } : {}),
    ...(d.expiraEn ? { expires: true, expiration_date_to: d.expiraEn } : {}),
    statement_descriptor: "STYLERNOW",
  };

  const pref = await mp<{ id: string; init_point?: string; sandbox_init_point?: string }>(
    "/checkout/preferences",
    { method: "POST", body: JSON.stringify(cuerpo), idempotencyKey: d.pagoId }
  );

  const url = pref.init_point ?? pref.sandbox_init_point;
  if (!url) throw new Error("Mercado Pago no devolvió una URL de checkout.");

  return { id: pref.id, url };
}

// ── Consulta de pagos ──────────────────────────────────────────────────────

export interface PagoPasarela {
  id: string;
  estado: EstadoPasarela;
  estadoCrudo: string;
  detalle: string | null;
  monto: number;
  referenciaExterna: string | null;
  metodo: string | null;
}

function mapearPago(p: {
  id: number | string;
  status: string;
  status_detail?: string | null;
  transaction_amount?: number | null;
  external_reference?: string | null;
  payment_method_id?: string | null;
}): PagoPasarela {
  return {
    id: String(p.id),
    estado: traducirEstado(p.status),
    estadoCrudo: p.status,
    detalle: p.status_detail ?? null,
    monto: p.transaction_amount ?? 0,
    referenciaExterna: p.external_reference ?? null,
    metodo: p.payment_method_id ?? null,
  };
}

export async function obtenerPago(idPago: string): Promise<PagoPasarela> {
  const p = await mp<Parameters<typeof mapearPago>[0]>(`/v1/payments/${idPago}`);
  return mapearPago(p);
}

/**
 * Busca el pago asociado a un `pago.id` propio. Es el camino de reconciliación
 * cuando no hay webhook disponible (desarrollo local) o cuando el Cliente vuelve
 * del checkout antes de que la notificación llegue.
 */
export async function buscarPagoPorReferencia(pagoId: string): Promise<PagoPasarela | null> {
  const r = await mp<{ results?: Parameters<typeof mapearPago>[0][] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(pagoId)}&sort=date_created&criteria=desc`
  );
  const resultados = r.results ?? [];
  if (resultados.length === 0) return null;
  // Un pago aprobado manda sobre cualquier intento previo rechazado del mismo cobro.
  const aprobado = resultados.find((p) => traducirEstado(p.status) === "APROBADO");
  return mapearPago(aprobado ?? resultados[0]);
}

// ── Reembolsos (03-Business-Rules/03_Payment_Rules.md) ─────────────────────

export async function reembolsar(idPago: string, monto?: number) {
  return mp<{ id: number; status: string; amount: number }>(`/v1/payments/${idPago}/refunds`, {
    method: "POST",
    body: JSON.stringify(monto ? { amount: Math.round(monto) } : {}),
    idempotencyKey: `reembolso-${idPago}-${monto ?? "total"}`,
  });
}

// ── Autenticidad del webhook (05-API/06_Webhooks.md) ───────────────────────

/**
 * Verifica la firma HMAC del webhook. El manifiesto que firma Mercado Pago es
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 *
 * Devuelve `null` cuando no hay secreto configurado, para distinguir "no verificable"
 * de "firma inválida": sin secreto el endpoint igual no confía en el payload, porque
 * re-consulta el pago contra la API antes de aplicar cualquier efecto de negocio.
 */
export function verificarFirma(args: {
  firma: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean | null {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) return null;
  if (!args.firma || !args.dataId) return false;

  const partes = Object.fromEntries(
    args.firma.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifiesto = `id:${args.dataId.toLowerCase()};request-id:${args.requestId ?? ""};ts:${ts};`;
  const esperado = createHmac("sha256", secreto).update(manifiesto).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
