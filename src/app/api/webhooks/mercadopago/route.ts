import { procesarWebhookMercadoPago } from "@/lib/pagos/webhook-mercadopago";

/**
 * POST /api/webhooks/mercadopago — URL de notificaciones configurada en el panel de la aplicación de
 * Mercado Pago (pagos, órdenes comerciales, contracargos, reclamos, mp-connect).
 * Mismo procesamiento que la `notification_url` de las preferencias: lib/pagos/webhook-mercadopago.ts.
 */

export function POST(request: Request) {
  return procesarWebhookMercadoPago(request);
}

/** Mercado Pago valida la URL con un GET al configurarla en el panel. */
export function GET() {
  return Response.json({ ok: true });
}
