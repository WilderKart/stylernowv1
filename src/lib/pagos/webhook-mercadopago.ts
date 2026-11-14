import "server-only";

import { ConexionNoDisponible, conexionesDeCuenta, reportarFalloConexion, revisarConexionPorCuenta, tokenDeConexion } from "./conexiones";
import { diagnosticoFirma, ErrorMercadoPago, obtenerContracargo, obtenerMerchantOrder, verificarFirma } from "./mercadopago";
import { sincronizarNotificacion, type OrigenNotificacion, type TrazaSincronizacion } from "./sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook de Mercado Pago (Checkout Pro clásico, Preferences API + OAuth por barbería).
 *
 * Lo comparten dos rutas con el mismo código:
 *  - /api/webhooks/mercadopago            → URL configurada en el panel de la aplicación.
 *  - /api/webhooks/pasarela/mercadopago   → `notification_url` de cada preferencia (con `?c=<conexión>`).
 *
 * Orden obligatorio: (1) firma, (2) registro idempotente, (3) consulta a Mercado Pago con el token
 * de la cuenta que cobró, (4) efecto en la base. El cuerpo NUNCA es fuente de verdad: solo aporta
 * el id del recurso y, como pista, el vendedor (`user_id`), que después se verifica contra el pago.
 *
 * Códigos: 200 = recibido (procesado, ignorado o sin arreglo posible: reintentar no ayuda);
 * 401 = firma inválida; 503 = secreto no configurado en producción; 500 = fallo transitorio
 * (Supabase o Mercado Pago caídos): Mercado Pago reintenta y la idempotencia evita duplicados.
 */

type Tipo = "payment" | "merchant_order" | "chargebacks" | "claims" | "mp-connect" | "fraude" | "order" | "otro";

const PROVEEDOR = "MERCADOPAGO";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERICO = /^\d{1,20}$/;

/** Normaliza los nombres de tópico de Mercado Pago (webhooks e IPN heredado). */
export function normalizarTipo(crudo: string | null | undefined): Tipo {
  const t = (crudo ?? "").trim().toLowerCase();
  if (t === "payment" || t.startsWith("payment.")) return "payment";
  if (t === "merchant_order" || t === "topic_merchant_order_wh") return "merchant_order";
  if (t === "chargebacks" || t === "topic_chargebacks_wh") return "chargebacks";
  if (t === "claims" || t === "topic_claims_integration_wh") return "claims";
  if (t === "mp-connect") return "mp-connect";
  if (t === "stop_delivery_op_wh" || t === "delivery_cancellation") return "fraude";
  if (t === "order" || t.startsWith("order.")) return "order"; // Orders API: no la usa StylerNow
  return "otro";
}

interface Cuerpo {
  type?: string;
  topic?: string;
  action?: string;
  user_id?: string | number;
  live_mode?: boolean;
  data?: { id?: string | number };
}

type Rpc = { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };

export async function procesarWebhookMercadoPago(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cuerpo = (await request.json().catch(() => null)) as Cuerpo | null;

  const tipoCrudo = cuerpo?.type ?? cuerpo?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const tipo = normalizarTipo(tipoCrudo);
  // La firma se calcula con `data.id` de la URL (documentación oficial); el cuerpo es respaldo.
  const dataId =
    url.searchParams.get("data.id") ??
    (cuerpo?.data?.id != null ? String(cuerpo.data.id) : null) ??
    url.searchParams.get("id");
  const firma = request.headers.get("x-signature");
  const requestIdHeader = (request.headers.get("x-request-id") ?? "").slice(0, 200);

  // ── 1 · Autenticidad ────────────────────────────────────────────────────
  const firmaValida = verificarFirma({ firma, requestId: requestIdHeader || null, dataId });
  if (firmaValida === null && esProduccion()) {
    console.error("[webhook mercadopago] MERCADOPAGO_WEBHOOK_SECRET no configurado: notificación rechazada");
    return new Response("webhook no configurado", { status: 503 });
  }
  if (firmaValida === false) {
    // IPN heredado sin firma (p. ej. ?topic=merchant_order&id=…): se ignora sin procesar y con 200
    // para no generar reintentos infinitos. Lo firmado (webhooks) sí se procesa.
    if (!firma && url.searchParams.get("topic")) {
      console.warn("[webhook mercadopago] IPN sin firma ignorado", { tipo, requestId: requestIdHeader });
      return Response.json({ recibido: true, ignorado: "SIN_FIRMA" });
    }
    console.error("[webhook mercadopago] firma inválida", {
      tipo,
      dataId: dataId?.slice(0, 40),
      requestId: requestIdHeader,
      diagnostico: diagnosticoFirma({
        firma,
        requestId: requestIdHeader || null,
        dataIdUrl: url.searchParams.get("data.id") ?? url.searchParams.get("id"),
        dataIdCuerpo: cuerpo?.data?.id != null ? String(cuerpo.data.id) : null,
      }),
    });
    return new Response("firma inválida", { status: 401 });
  }
  const etiquetaFirma = firmaValida === true ? "VALIDA" : "SIN_SECRETO_LOCAL";

  // Origen: conexión que pusimos en la notification_url, o vendedor que informa la notificación.
  const c = url.searchParams.get("c");
  const conexionId = c && UUID.test(c) ? c : null;
  const userId = cuerpo?.user_id != null ? String(cuerpo.user_id) : null;
  const origen: OrigenNotificacion = { conexionId, cuentaVendedor: !conexionId && userId && NUMERICO.test(userId) ? userId : null };

  // Sin x-request-id (no debería ocurrir con webhooks firmados) se usa una clave sintética por ts.
  const ts = /(?:^|,)\s*ts=(\d{1,16})/.exec(firma ?? "")?.[1] ?? String(Date.now());
  const requestId = requestIdHeader || `sin-request-id:${tipo}:${(dataId ?? "").slice(0, 40)}:${ts}`;

  const admin = createAdminClient() as unknown as Rpc;

  // ── 2 · Registro idempotente ─────────────────────────────────────────────
  const reg = await admin.rpc("webhook_registrar", {
    p_proveedor: PROVEEDOR,
    p_request_id: requestId,
    p_data_id: dataId,
    p_topico: (tipoCrudo ?? tipo).slice(0, 60),
    p_conexion_id: conexionId,
  });
  if (reg.error) {
    console.error("[webhook mercadopago] no se pudo registrar la notificación", reg.error.message);
    return new Response("registro no disponible", { status: 500 }); // Mercado Pago reintenta
  }
  if (reg.data === false) return Response.json({ recibido: true, duplicado: true });

  const resultado = async (procesado: boolean, res: string, traza?: Partial<TrazaSincronizacion>, error?: string) => {
    const { error: e } = await admin.rpc("webhook_registrar_resultado", {
      p_proveedor: PROVEEDOR,
      p_request_id: requestId,
      p_procesado: procesado,
      p_resultado: res,
      p_firma: etiquetaFirma,
      p_negocio_id: traza?.negocioId ?? null,
      p_pago_id: traza?.pagoId ?? null,
      p_estado_proveedor: traza?.estadoProveedor ?? null,
      p_live_mode: traza?.liveMode ?? null,
      p_error: error ?? null,
    });
    if (e) console.error("[webhook mercadopago] no se pudo guardar el resultado", e.message);
  };

  // ── 3 y 4 · Consulta al proveedor y efecto ───────────────────────────────
  try {
    switch (tipo) {
      case "mp-connect": {
        const r = userId && NUMERICO.test(userId) ? await revisarConexionPorCuenta(userId) : "SIN_CONEXION";
        await resultado(true, `CONEXION_${r}`);
        return Response.json({ recibido: true, conexion: r });
      }

      case "payment": {
        if (!dataId || !NUMERICO.test(dataId)) {
          await resultado(true, "DATA_ID_INVALIDO");
          return Response.json({ recibido: true, ignorado: "data-id-invalido" });
        }
        const { resultado: r, traza } = await sincronizarNotificacion(dataId, origen);
        const etiqueta = "motivo" in r ? `${r.estado}:${r.motivo}` : r.estado;
        await resultado(true, etiqueta, traza);
        return Response.json({ recibido: true, resultado: r.estado });
      }

      // Orden comercial de Checkout Pro: se usan sus pagos, cada uno consultado y verificado aparte.
      case "merchant_order":
      case "chargebacks": {
        if (!dataId || !NUMERICO.test(dataId)) {
          await resultado(true, "DATA_ID_INVALIDO");
          return Response.json({ recibido: true, ignorado: "data-id-invalido" });
        }
        const token = await tokenDeOrigen(origen);
        const recurso = tipo === "merchant_order" ? await obtenerMerchantOrder(dataId, token) : await obtenerContracargo(dataId, token);
        if (recurso.pagos.length === 0) {
          await resultado(true, tipo === "merchant_order" ? "ORDEN_SIN_PAGOS" : "CONTRACARGO_SIN_PAGOS");
          return Response.json({ recibido: true, resultado: "SIN_PAGOS" });
        }
        const etiquetas: string[] = [];
        let ultimaTraza: TrazaSincronizacion | undefined;
        for (const idPago of recurso.pagos.slice(0, 20)) {
          const { resultado: r, traza } = await sincronizarNotificacion(idPago, origen);
          etiquetas.push(r.estado);
          ultimaTraza = traza;
        }
        await resultado(true, `${tipo === "merchant_order" ? "ORDEN" : "CONTRACARGO"}:${[...new Set(etiquetas)].join(",")}`, ultimaTraza);
        return Response.json({ recibido: true, resultado: etiquetas });
      }

      // Reclamos y alertas de fraude: no hay acción automática segura; quedan para revisión.
      case "claims":
      case "fraude": {
        await resultado(true, tipo === "claims" ? "RECLAMO_REQUIERE_REVISION" : "ALERTA_FRAUDE_REQUIERE_REVISION");
        return Response.json({ recibido: true, resultado: "REQUIERE_REVISION" });
      }

      case "order": {
        await resultado(true, "IGNORADO_ORDERS_API_NO_USADA");
        return Response.json({ recibido: true, ignorado: "order" });
      }

      default: {
        await resultado(true, `IGNORADO:${(tipoCrudo ?? "sin-tipo").slice(0, 40)}`);
        return Response.json({ recibido: true, ignorado: tipoCrudo ?? "sin-tipo" });
      }
    }
  } catch (e) {
    const { reintentar, codigo } = clasificarError(e);
    if (e instanceof ErrorMercadoPago && (e.status === 401 || e.status === 403)) {
      await reportarFalloConexion(conexionId, e.status, "WEBHOOK_TOKEN_RECHAZADO").catch(() => undefined);
    }
    await resultado(!reintentar, codigo, undefined, e instanceof Error ? e.message : String(e));
    console.error("[webhook mercadopago] fallo procesando", { tipo, dataId: dataId?.slice(0, 40), codigo });
    // Transitorio → 500 (Mercado Pago reintenta). Permanente → 200 con el error registrado.
    return reintentar ? new Response("error procesando", { status: 500 }) : Response.json({ recibido: true, resultado: codigo });
  }
}

async function tokenDeOrigen(o: OrigenNotificacion): Promise<string | undefined> {
  if (o.conexionId) return tokenDeConexion(o.conexionId);
  if (o.cuentaVendedor) {
    const ids = await conexionesDeCuenta(o.cuentaVendedor);
    if (ids.length === 0) throw new ConexionNoDisponible("VENDEDOR_SIN_CONEXION");
    return tokenDeConexion(ids[0]);
  }
  return undefined; // cuenta de StylerNow
}

/** ¿Vale la pena que Mercado Pago reintente? Solo ante fallos transitorios. */
export function clasificarError(e: unknown): { reintentar: boolean; codigo: string } {
  if (e instanceof ConexionNoDisponible) return { reintentar: false, codigo: e.message || "CONEXION_NO_DISPONIBLE" };
  if (e instanceof ErrorMercadoPago) {
    if (e.status === 404) return { reintentar: false, codigo: "RECURSO_NO_ENCONTRADO_EN_PROVEEDOR" };
    if (e.status === 401 || e.status === 403) return { reintentar: false, codigo: "TOKEN_RECHAZADO" };
    if (e.status === 400) return { reintentar: false, codigo: "SOLICITUD_INVALIDA" };
    return { reintentar: true, codigo: `PROVEEDOR_${e.status}` };
  }
  if (e instanceof Error && /^ID_[A-Z_]+_INVALIDO$|^ID_TRANSACCION_INVALIDO$/.test(e.message)) {
    return { reintentar: false, codigo: e.message };
  }
  return { reintentar: true, codigo: "ERROR_INTERNO" }; // Supabase caído, red, etc.
}

function esProduccion() {
  return process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
}
