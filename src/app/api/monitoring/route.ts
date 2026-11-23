import { limitar, ipDelLlamador } from "@/lib/rate-limit";
import { POST as tunnel } from "@sentry/nextjs/tunnel";

/**
 * Túnel de Sentry: el navegador envía aquí sus eventos (misma origen) y el servidor los reenvía a Sentry.
 * Está bajo /api/ a propósito: src/proxy.ts deja pasar /api/** sin exigir sesión, así los errores de
 * páginas públicas (login, landing) también llegan. Solo reenvía al DSN configurado en el servidor.
 *
 * SEC-20: al ser público, se limita por IP (fail-open: perder un evento de Sentry no debe romper la
 * página) para que nadie lo use como proxy abierto hacia el DSN ni para saturarlo.
 */
export async function GET() {
  const cupo = await limitar("monitoring-health", await ipDelLlamador(), 30, 60);
  if (!cupo.ok) {
    return new Response("demasiadas peticiones", { status: 429, headers: { "Retry-After": String(cupo.retryAfter) } });
  }
  return Response.json(
    {
      status: "ok",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "desconocida",
      region: process.env.VERCEL_REGION ?? "local",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const cupo = await limitar("sentry-tunnel", await ipDelLlamador(), 30, 60);
  if (!cupo.ok) {
    return new Response("demasiadas peticiones", { status: 429, headers: { "Retry-After": String(cupo.retryAfter) } });
  }
  return tunnel(request);
}
