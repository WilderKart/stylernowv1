import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { entornoPagos, validarTokenParaEntorno } from "./entorno";

/**
 * Adaptador de la pasarela de pago (Mercado Pago · Checkout Pro).
 *
 * 05-API/04_Payments.md: iniciar un cobro NO cobra — crea una preferencia y devuelve
 * la URL a la que redirigir. El `pago` solo pasa a APROBADO cuando la pasarela lo
 * confirma, y siempre re-consultando su API, nunca creyéndole al cuerpo del webhook.
 */

const API = "https://api.mercadopago.com";

/**
 * Token de la cuenta de StylerNow. Solo para cobros cuyo beneficiario es la plataforma
 * (planes, IA, recargas de WhatsApp) y para pagos históricos cobrados en custodia. Los
 * cobros de un negocio usan el token de SU conexión (`conexiones.ts`), nunca este.
 */
function tokenPlataforma() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.");
  return token;
}

/** Entorno de pagos decidido en el servidor (ver entorno.ts). */
export function esEntornoDePrueba() {
  return entornoPagos() === "SANDBOX";
}

/** `token` ausente = cuenta de StylerNow. */
export type TokenPasarela = string | undefined;

/** Error de la API con su código HTTP, para distinguir credencial revocada (401/403) de fallas temporales. */
export class ErrorMercadoPago extends Error {
  constructor(
    mensaje: string,
    readonly status: number
  ) {
    super(mensaje);
  }
}

async function mp<T>(ruta: string, init: RequestInit & { idempotencyKey?: string; token?: TokenPasarela } = {}) {
  const { idempotencyKey, token, ...rest } = init;
  const bearer = token ?? tokenPlataforma();
  // Separación de entornos en el servidor: un token de prueba nunca opera en producción.
  validarTokenParaEntorno(bearer);
  const res = await fetch(`${API}${ruta}`, {
    ...rest,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...rest.headers,
    },
  });

  const cuerpo = (await res.json().catch(() => null)) as T & { message?: string };
  if (!res.ok) {
    throw new ErrorMercadoPago(
      `Mercado Pago ${res.status} en ${ruta.split("?")[0]}: ${cuerpo?.message ?? "error sin detalle"}`,
      res.status
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
  /** Token del vendedor (cobro directo al negocio). Ausente = cuenta de StylerNow. */
  token?: TokenPasarela;
  /** Comisión de StylerNow que retiene Mercado Pago (split 1:1). La fija la base de datos. */
  marketplaceFee?: number;
  /** Tipos de medio excluidos (p. ej. PSE y Efecty en el split 1:1, no verificados). */
  excluirTiposPago?: readonly string[];
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
    ...(d.excluirTiposPago && d.excluirTiposPago.length > 0
      ? { payment_methods: { excluded_payment_types: d.excluirTiposPago.map((id) => ({ id })) } }
      : {}),
    // Por defecto 0 (Mercado Pago lo trata igual que omitirlo); solo se envía si es > 0.
    ...(d.token && d.marketplaceFee && d.marketplaceFee > 0 ? { marketplace_fee: Math.round(d.marketplaceFee) } : {}),
  };

  const pref = await mp<{ id: string; init_point?: string; sandbox_init_point?: string }>(
    "/checkout/preferences",
    { method: "POST", body: JSON.stringify(cuerpo), idempotencyKey: d.pagoId, token: d.token }
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
  /** Evidencia del proveedor: entorno real, vendedor que recibió el dinero y valores (sin datos del pagador). */
  liveMode: boolean | null;
  collectorId: string | null;
  tipoMetodo: string | null;
  netoRecibido: number | null;
  comisiones: { type: string; amount: number }[];
}

export function mapearPago(p: {
  id: number | string;
  status: string;
  status_detail?: string | null;
  transaction_amount?: number | null;
  external_reference?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  live_mode?: boolean | null;
  collector_id?: number | string | null;
  transaction_details?: { net_received_amount?: number | null } | null;
  fee_details?: { type?: string; amount?: number }[] | null;
}): PagoPasarela {
  return {
    id: String(p.id),
    estado: traducirEstado(p.status),
    estadoCrudo: p.status,
    detalle: p.status_detail ?? null,
    monto: p.transaction_amount ?? 0,
    referenciaExterna: p.external_reference ?? null,
    metodo: p.payment_method_id ?? null,
    liveMode: typeof p.live_mode === "boolean" ? p.live_mode : null,
    collectorId: p.collector_id != null ? String(p.collector_id) : null,
    tipoMetodo: p.payment_type_id ?? null,
    netoRecibido: p.transaction_details?.net_received_amount ?? null,
    comisiones: (p.fee_details ?? []).map((f) => ({ type: String(f.type ?? ""), amount: Number(f.amount ?? 0) })),
  };
}

export async function obtenerPago(idPago: string, token?: TokenPasarela): Promise<PagoPasarela> {
  // El id llega del webhook (dato externo): solo dígitos, para que no pueda alterar la ruta de la API.
  if (!/^\d{1,20}$/.test(idPago)) throw new Error("ID_TRANSACCION_INVALIDO");
  const p = await mp<Parameters<typeof mapearPago>[0]>(`/v1/payments/${idPago}`, { token });
  return mapearPago(p);
}

/**
 * Orden comercial (`merchant_order`, Checkout Pro clásico). NO es la Orders API (`/v1/orders`).
 * Solo se usa para descubrir los pagos que contiene; el estado de cada pago se vuelve a consultar.
 */
export async function obtenerMerchantOrder(id: string, token?: TokenPasarela) {
  if (!/^\d{1,20}$/.test(id)) throw new Error("ID_MERCHANT_ORDER_INVALIDO");
  const o = await mp<{ id: number; external_reference?: string | null; payments?: { id: number | string }[] | null }>(
    `/merchant_orders/${id}`,
    { token }
  );
  return {
    id: String(o.id),
    referenciaExterna: o.external_reference ?? null,
    pagos: (o.payments ?? []).map((p) => String(p.id)).filter((x) => /^\d{1,20}$/.test(x)),
  };
}

/** Contracargo: solo interesa a qué pagos afecta (su estado se consulta en /v1/payments). */
export async function obtenerContracargo(id: string, token?: TokenPasarela) {
  if (!/^\d{1,20}$/.test(id)) throw new Error("ID_CONTRACARGO_INVALIDO");
  const c = await mp<{ id: number | string; payments?: (number | string)[] | null }>(`/v1/chargebacks/${id}`, { token });
  return { id: String(c.id), pagos: (c.payments ?? []).map(String).filter((x) => /^\d{1,20}$/.test(x)) };
}

/**
 * Busca el pago asociado a un `pago.id` propio. Es el camino de reconciliación
 * cuando no hay webhook disponible (desarrollo local) o cuando el Cliente vuelve
 * del checkout antes de que la notificación llegue.
 */
export async function buscarPagoPorReferencia(pagoId: string, token?: TokenPasarela): Promise<PagoPasarela | null> {
  const r = await mp<{ results?: Parameters<typeof mapearPago>[0][] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(pagoId)}&sort=date_created&criteria=desc`,
    { token }
  );
  const resultados = r.results ?? [];
  if (resultados.length === 0) return null;
  // Un pago aprobado manda sobre cualquier intento previo rechazado del mismo cobro.
  const aprobado = resultados.find((p) => traducirEstado(p.status) === "APROBADO");
  return mapearPago(aprobado ?? resultados[0]);
}

// ── Reembolsos (03-Business-Rules/03_Payment_Rules.md) ─────────────────────

/**
 * `claveIdempotencia` debe ser estable entre reintentos del MISMO reembolso (el id de la
 * fila `reembolso`): si la primera llamada llegó a la pasarela pero su respuesta se perdió,
 * el reintento devuelve el mismo reembolso en lugar de crear otro.
 */
export async function reembolsar(idPago: string, monto?: number, claveIdempotencia?: string, token?: TokenPasarela) {
  if (!/^\d+$/.test(idPago)) throw new Error("ID_TRANSACCION_INVALIDO");
  return mp<{ id: number; status: string; amount: number }>(`/v1/payments/${idPago}/refunds`, {
    method: "POST",
    body: JSON.stringify(monto ? { amount: Math.round(monto) } : {}),
    idempotencyKey: claveIdempotencia ?? `reembolso-${idPago}-${monto ?? "total"}`,
    token,
  });
}

export async function consultarReembolso(idPago: string, idReembolso: string, token?: TokenPasarela) {
  if (!/^\d+$/.test(idPago) || !/^\d+$/.test(idReembolso)) throw new Error("ID_TRANSACCION_INVALIDO");
  return mp<{ id: number; status: string; amount: number }>(`/v1/payments/${idPago}/refunds/${idReembolso}`, { token });
}

// ── Autenticidad del webhook (05-API/06_Webhooks.md) ───────────────────────

/** Antigüedad máxima aceptada para la marca de tiempo firmada de una notificación. */
const VENTANA_FIRMA_MS = 15 * 60_000;

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
  // Se recortan espacios/saltos de línea que suelen colarse al pegar la clave en el panel de Vercel.
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secreto) return null;
  if (!args.firma || !args.dataId) return false;

  const { ts, v1 } = partesFirma(args.firma);
  if (!ts || !v1 || !/^\d{1,16}$/.test(ts)) return false;

  // Anti-replay: una notificación firmada pero vieja (capturada y reenviada) se rechaza.
  if (!tsDentroDeVentana(ts)) return false;

  return hmacCoincide(secreto, manifiestoFirma(args.dataId, args.requestId, ts), v1);
}

function partesFirma(firma: string): { ts?: string; v1?: string } {
  return Object.fromEntries(
    firma.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );
}

/** `ts` puede venir en segundos o milisegundos según la versión de la notificación. */
function tsEnMs(ts: string): number {
  return ts.length > 11 ? Number(ts) : Number(ts) * 1000;
}

function tsDentroDeVentana(ts: string): boolean {
  const ms = tsEnMs(ts);
  return Number.isFinite(ms) && Math.abs(Date.now() - ms) <= VENTANA_FIRMA_MS;
}

function manifiestoFirma(dataId: string, requestId: string | null, ts: string): string {
  return `id:${dataId.toLowerCase()};request-id:${requestId ?? ""};ts:${ts};`;
}

function hmacCoincide(secreto: string, manifiesto: string, v1: string): boolean {
  const a = Buffer.from(createHmac("sha256", secreto).update(manifiesto).digest("hex"), "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Diagnóstico de una firma rechazada, para los logs. NUNCA incluye la clave: solo su longitud,
 * si traía espacios y una huella corta (8 hex de su SHA-256), que permite comparar contra la clave
 * del panel sin revelarla. Indica además qué variante del manifiesto habría coincidido, si alguna.
 */
export function diagnosticoFirma(args: {
  firma: string | null;
  requestId: string | null;
  dataIdUrl: string | null;
  dataIdCuerpo: string | null;
}) {
  const crudo = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
  const secreto = crudo.trim();
  const { ts, v1 } = partesFirma(args.firma ?? "");
  const tsValido = !!ts && /^\d{1,16}$/.test(ts);

  let coincide: string | null = null;
  if (secreto && tsValido && v1) {
    const ids = [
      ["url", args.dataIdUrl],
      ["cuerpo", args.dataIdCuerpo],
    ] as const;
    for (const [origenId, id] of ids) {
      if (!id) continue;
      if (hmacCoincide(secreto, manifiestoFirma(id, args.requestId, ts!), v1)) { coincide = `id_${origenId}`; break; }
      if (hmacCoincide(secreto, `id:${id};request-id:${args.requestId ?? ""};ts:${ts};`, v1)) { coincide = `id_${origenId}_sin_minusculas`; break; }
      if (hmacCoincide(secreto, `id:${id.toLowerCase()};ts:${ts};`, v1)) { coincide = `id_${origenId}_sin_request_id`; break; }
    }
  }

  return {
    secretoLongitud: secreto.length,
    secretoTeniaEspacios: crudo.length !== secreto.length,
    huellaSecreto: secreto ? createHash("sha256").update(secreto).digest("hex").slice(0, 8) : null,
    firmaPresente: !!args.firma,
    tsPresente: tsValido,
    v1Longitud: v1?.length ?? 0,
    tsEdadSegundos: tsValido ? Math.round((Date.now() - tsEnMs(ts!)) / 1000) : null,
    tsDentroDeVentana: tsValido ? tsDentroDeVentana(ts!) : false,
    requestIdPresente: !!args.requestId,
    dataIdUrlPresente: !!args.dataIdUrl,
    dataIdCuerpoPresente: !!args.dataIdCuerpo,
    coincideConVariante: coincide,
  };
}

/** ¿El token sigue autorizado? 401/403 = revocado por el vendedor. Nunca registra el token. */
export async function estadoToken(token: string): Promise<"VIGENTE" | "REVOCADO" | "DESCONOCIDO"> {
  try {
    await mp<{ id: number }>("/users/me", { token });
    return "VIGENTE";
  } catch (e) {
    if (e instanceof ErrorMercadoPago && (e.status === 401 || e.status === 403)) return "REVOCADO";
    return "DESCONOCIDO";
  }
}
