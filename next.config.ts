import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Las imágenes de Negocio y avatares viven en Storage de Supabase (migración 007).
// Solo se habilita ese host y solo la ruta pública de objetos.
const hostSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // ADR-015: habilita forbidden()/unauthorized() de next/navigation — un
  // 403/401 real (no un notFound() disfrazado) cuando requireRole() detecta
  // una superficie ajena, en vez de redirigir silenciosamente a otra parte.
  experimental: {
    authInterrupts: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // El CSP (frame-ancestors, base-uri, object-src y el de scripts con nonce) lo fija src/proxy.ts: un CSP
          // estático aquí hace que Next lea ese en vez del de la petición y no aplique el nonce a sus scripts.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Geolocalización la usa la app (Cerca de mí / aviso de distancia); cámara, micrófono y pagos del navegador no.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: hostSupabase
      ? [
          {
            protocol: "https",
            hostname: hostSupabase,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

// Sentry: monitoreo de errores. Sin SENTRY_AUTH_TOKEN el build funciona igual (solo omite subir los source maps).
export default withSentryConfig(nextConfig, {
  org: "stylernow",
  project: "stylernow-app",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Los eventos del navegador pasan por src/app/api/monitoring/route.ts (misma origen, sin tocar el CSP).
  tunnelRoute: "/api/monitoring",
  // Source maps: se suben a Sentry para ver el código real en los errores y NO se publican con la app.
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Sin telemetría del propio SDK ni monitores de cron de Vercel (no se usan).
  telemetry: false,
});
