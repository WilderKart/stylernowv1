import { verificarFirma } from "@/lib/pagos/mercadopago";
import { sincronizarDesdeTransaccion } from "@/lib/pagos/sincronizar";
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

  // 1 · Autenticidad. `null` = sin secreto configurado: no se puede verificar, pero el
  // paso 3 igual re-consulta la API, así que no se acepta nada solo por el payload.
  const firmaValida = verificarFirma({
    firma: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: idTransaccion,
  });

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

  if (!idTransaccion) {
    return Response.json({ recibido: true, ignorado: "sin-data-id" });
  }

  try {
    const resultado = await sincronizarDesdeTransaccion(idTransaccion);
    return Response.json({ recibido: true, resultado: resultado.estado });
  } catch (e) {
    // Error propio (esquema inesperado, pasarela caída): se registra como crítico y se
    // responde 200 para no encadenar reintentos de algo que el reintento no arregla.
    console.error("[webhook mercadopago] fallo procesando", idTransaccion, e);
    return Response.json({ recibido: true, error: true });
  }
}

/** Mercado Pago valida la URL con un GET al configurarla en el panel. */
export function GET() {
  return Response.json({ ok: true });
}
