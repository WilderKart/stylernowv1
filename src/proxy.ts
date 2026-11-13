import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { esRutaPublica } from "@/lib/routing/route-registry";

/**
 * ADR-015 — middleware liviano y consciente del Route Registry: decide
 * público/protegido con un import estático (`route-registry.ts`, cero DB) y
 * redirige a `/login` si falta sesión en una ruta protegida. Nunca resuelve
 * rol, onboarding ni permisos aquí — eso vive 100% en `requireRole()`
 * server-side (Edge Middleware no debe cargar con una consulta a DB).
 */
/**
 * CSP con nonce por petición (6.5). Por defecto en modo SOLO REPORTE (no bloquea nada, el navegador anota las
 * violaciones en la consola): se activa de verdad con CSP_ENFORCE=1 cuando se confirme que no hay violaciones en
 * mapa, login con Google y checkout. Next lee el nonce del encabezado de la petición y lo aplica a sus scripts.
 */
function construirCsp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = construirCsp(nonce);
  const cabeceraCsp = process.env.CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Id de petición para la auditoría (migración 123): lo genera SIEMPRE el servidor, nunca se acepta
  // el que mande el navegador. createClient() lo reenvía a PostgREST y la base lo guarda en evento_auditoria.
  requestHeaders.set("x-request-id", crypto.randomUUID());
  requestHeaders.set(cabeceraCsp, csp);

  const { response, user } = await updateSession(request, requestHeaders);
  response.headers.set(cabeceraCsp, csp);
  // En modo solo-reporte el navegador ignora frame-ancestors; estas tres sí se aplican siempre (solo en la respuesta,
  // nunca en la petición: si estuvieran en la petición Next tomaría este CSP sin script-src y no pondría el nonce).
  if (cabeceraCsp !== "Content-Security-Policy") {
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  }

  const { pathname, search } = request.nextUrl;
  // ADR-015 auditoría (2026-09-16, evidencia real con curl+sesión): las
  // rutas /api/** (Route Handlers) NUNCA pasan por el redirect a /login —
  // ya devuelven su propio 401/403 real (verificado: sin cookie → 401,
  // Guardian sin permiso → 403). Redirigirlas aquí las rompía: un consumidor
  // de API recibía un 307 a una página HTML en vez del 401 esperado.
  if (pathname.startsWith("/api/")) return response;

  // Registro sin completar (migración 127): la sesión existe desde que se valida el código, pero la
  // cuenta no está creada hasta «Crear cuenta». Ninguna página abre hasta entonces: todo vuelve al
  // paso de registro. La marca vive en app_metadata, que el usuario no puede editar, y `user` viene
  // de getUser() (servidor de Auth), no de una cookie que el navegador pueda alterar.
  if (user?.app_metadata?.registro_pendiente === true && !rutaPermitidaConRegistroPendiente(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (!user && !esRutaPublica(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // Páginas de una sesión iniciada o de una ruta protegida: nunca al caché del navegador ni al bfcache.
  // Así, tras cerrar sesión, el botón "atrás" no muestra desde memoria datos privados de la pantalla anterior.
  if (user || !esRutaPublica(pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  }

  return response;
}

/** Con el registro pendiente solo se puede completar el registro, cerrar sesión o leer los textos legales. */
function rutaPermitidaConRegistroPendiente(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/auth/") || pathname.startsWith("/legal/");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
