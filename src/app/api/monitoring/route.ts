import { limitar, ipDelLlamador } from "@/lib/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { POST as tunnel } from "@sentry/nextjs/tunnel";

/**
 * Túnel de Sentry: el navegador envía aquí sus eventos (misma origen) y el servidor los reenvía a Sentry.
 * Está bajo /api/ a propósito: src/proxy.ts deja pasar /api/** sin exigir sesión, así los errores de
 * páginas públicas (login, landing) también llegan. Solo reenvía al DSN configurado en el servidor.
 *
 * SEC-20: al ser público, se limita por IP (fail-open: perder un evento de Sentry no debe romper la
 * página) para que nadie lo use como proxy abierto hacia el DSN ni para saturarlo.
 */
function tokenInternoValido(request: Request): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  const recibido = request.headers.get("authorization");
  if (!secreto || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const cupo = await limitar("monitoring-health", await ipDelLlamador(), 30, 60);
  if (!cupo.ok) {
    return new Response("demasiadas peticiones", { status: 429, headers: { "Retry-After": String(cupo.retryAfter) } });
  }
  // Público: solo "ok". El detalle de configuración exige el token interno (CRON_SECRET) para no dar huella.
  if (!tokenInternoValido(request)) {
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  }
  const configurado = (nombre: string) => (process.env[nombre]?.trim() ? "configurado" : "sin_configurar");
  const chequeos = {
    sentry: configurado("NEXT_PUBLIC_SENTRY_DSN"),
    cron: configurado("CRON_SECRET"),
    alertas: configurado("ALERTAS_WEBHOOK_URL"),
  };
  return Response.json(
    {
      status: "ok",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "desconocida",
      region: process.env.VERCEL_REGION ?? "local",
      timestamp: new Date().toISOString(),
      chequeos,
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
