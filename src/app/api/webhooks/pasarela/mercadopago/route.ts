import { verificarFirma } from "@/lib/pagos/mercadopago";
import { sincronizarDesdeTransaccion } from "@/lib/pagos/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

/**
 * POST /api/webhooks/pasarela/mercadopago — 05-API/06_Webhooks.md
 *
 * Orden obligatorio: (1) validar firma, (2) resolver idempotencia, (3) aplicar efecto.
 * El cuerpo del webhook NO es fuente de verdad: solo trae el id de la transacción,
 * que se vuelve a consultar contra la API de la pasarela antes de tocar nada.
 *
 * Responde 200 en todos los casos procesables para no inducir reintentos innecesarios;
 * la idempotencia hace que cualquier número de reintentos produzca un solo efecto.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const cuerpo = (await request.json().catch(() => null)) as {
    type?: string;
    topic?: string;
    action?: string;
    data?: { id?: string | number };
  } | null;

  const tipo = cuerpo?.type ?? cuerpo?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const idTransaccion =
    (cuerpo?.data?.id != null ? String(cuerpo.data.id) : null) ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  // 1 · Autenticidad. Cero confianza: en producción, sin secreto configurado no se procesa
  // nada (503, Mercado Pago reintenta cuando se configure). Solo en desarrollo local se
  // tolera la ausencia de secreto, porque el paso 3 igual re-consulta la API.
  const firmaValida = verificarFirma({
    firma: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: idTransaccion,
  });

  if (firmaValida === null && esProduccion()) {
    console.error("[webhook mercadopago] MERCADOPAGO_WEBHOOK_SECRET no configurado: notificación rechazada");
    return new Response("webhook no configurado", { status: 503 });
  }

  if (firmaValida === false) {
    console.error("[webhook mercadopago] firma HMAC inválida", {
      idTransaccion,
      requestId: request.headers.get("x-request-id"),
    });
    return new Response("firma inválida", { status: 401 });
  }

  // Mercado Pago también notifica merchant_orders y otros tópicos: se acusan y se ignoran.
  if (tipo !== "payment" && tipo !== "payment.updated") {
    return Response.json({ recibido: true, ignorado: tipo ?? "sin-tipo" });
  }

  if (!idTransaccion || !/^\d{1,20}$/.test(idTransaccion)) {
    return Response.json({ recibido: true, ignorado: "data-id-invalido" });
  }

  // Cuenta del negocio que cobró (la pusimos en notification_url). Solo un UUID válido.
  const c = url.searchParams.get("c");
  const conexionId = c && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? c : null;
  const requestId = (request.headers.get("x-request-id") ?? "").slice(0, 200);
  const admin = createAdminClient() as unknown as {
    rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  try {
    // 2 · Idempotencia de transporte: un request ya procesado se acusa sin repetir trabajo.
    const { data: nuevo } = await admin.rpc("webhook_registrar", {
      p_proveedor: "MERCADOPAGO",
      p_request_id: requestId,
      p_data_id: idTransaccion,
      p_topico: tipo,
      p_conexion_id: conexionId,
    });
    if (nuevo === false) return Response.json({ recibido: true, duplicado: true });

    const resultado = await sincronizarDesdeTransaccion(idTransaccion, conexionId);
    if (requestId) {
      await admin.rpc("webhook_marcar_procesado", {
        p_proveedor: "MERCADOPAGO",
        p_request_id: requestId,
        p_resultado: resultado.estado,
      });
    }
    return Response.json({ recibido: true, resultado: resultado.estado });
  } catch (e) {
    // Error propio o pasarela caída: 500 para que Mercado Pago reintente. Es seguro porque
    // el procesamiento es idempotente (`aplicar_evento_pago`, reembolsos por clave única):
    // reintentar nunca duplica efectos, y responder 200 aquí perdería el evento.
    console.error("[webhook mercadopago] fallo procesando", idTransaccion, e);
    return new Response("error procesando", { status: 500 });
  }
}

function esProduccion() {
  return process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
}

/** Mercado Pago valida la URL con un GET al configurarla en el panel. */
export function GET() {
  return Response.json({ ok: true });
}
