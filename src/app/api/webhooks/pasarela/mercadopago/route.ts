import { procesarWebhookMercadoPago } from "@/lib/pagos/webhook-mercadopago";

/**
 * POST /api/webhooks/pasarela/mercadopago — `notification_url` de cada preferencia (con `?c=<conexión>`).
 * Mismo procesamiento que /api/webhooks/mercadopago (URL del panel): ver lib/pagos/webhook-mercadopago.ts.
 * Se mantiene esta ruta porque las preferencias ya creadas notifican aquí.
 */

export function POST(request: Request) {
  return procesarWebhookMercadoPago(request);
}

/** Mercado Pago valida la URL con un GET al configurarla en el panel. */
export function GET() {
  return Response.json({ ok: true });
}
