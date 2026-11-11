import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { esRutaPublica } from "@/lib/routing/route-registry";

/**
 * ADR-015 — middleware liviano y consciente del Route Registry: decide
 * público/protegido con un import estático (`route-registry.ts`, cero DB) y
 * redirige a `/login` si falta sesión en una ruta protegida. Nunca resuelve
 * rol, onboarding ni permisos acá — eso vive 100% en `requireRole()`
 * server-side (Edge Middleware no debe cargar con una consulta a DB).
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname, search } = request.nextUrl;
  // ADR-015 auditoría (2026-09-16, evidencia real con curl+sesión): las
  // rutas /api/** (Route Handlers) NUNCA pasan por el redirect a /login —
  // ya devuelven su propio 401/403 real (verificado: sin cookie → 401,
  // Guardian sin permiso → 403). Redirigirlas acá las rompía: un consumidor
  // de API recibía un 307 a una página HTML en vez del 401 esperado.
  if (pathname.startsWith("/api/")) return response;

  if (!user && !esRutaPublica(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
