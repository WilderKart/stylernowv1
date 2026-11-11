import type { NextConfig } from "next";

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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
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

export default nextConfig;
