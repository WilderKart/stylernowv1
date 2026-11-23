import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * Refresca la sesión de Supabase en cada request (05-API/02_Auth.md: rotación
 * de refresh token). Devuelve también el `user` ya resuelto (ADR-015) para
 * que `proxy.ts` decida público/protegido sin una segunda consulta — nunca
 * resuelve rol/onboarding/permisos aquí, eso sigue siendo 100% server-side
 * en `requireRole()`.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
  opciones?: { rutaProtegida?: boolean }
): Promise<{ response: NextResponse; user: User | null; sesionRevocada: boolean }> {
  const reenviar = requestHeaders ? { headers: requestHeaders } : request;
  let supabaseResponse = NextResponse.next({ request: reenviar });

  // El proxy corre en el Edge Runtime, antes de que exista cualquier página o
  // error.tsx que capture una excepción: si faltan estas variables, @supabase/ssr
  // lanza de forma síncrona y el visitante ve un crash crudo del Edge Function en
  // TODA ruta, sin ningún detalle. Se degrada en su lugar: la request sigue sin
  // sesión (como si no hubiera usuario autenticado) y el problema real queda en
  // los logs de Vercel, no en la pantalla del usuario. Faltan casi siempre porque
  // .env.local nunca se sube (está en .gitignore) y Vercel necesita su propia
  // copia en Project Settings → Environment Variables.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error(
      "[proxy] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en este entorno. " +
        "Configuralas en Vercel → Project Settings → Environment Variables y vuelve a desplegar."
    );
    return { response: supabaseResponse, user: null, sesionRevocada: false };
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: reenviar });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No eliminar: refresca el token si expiró (necesario para Server Components).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Session Version (migración 181, SEC-9/CR-4): si el Custom Access Token Hook de
  // Supabase está habilitado, `session_version` viaja como claim del JWT. Se compara
  // con el valor actual en `perfil`: si difieren, la sesión fue revocada (cambio de
  // contraseña, recuperación, suspensión, traslado o revocación de Guardian) y se
  // cierra de inmediato en vez de esperar a que el token expire (~1 h). Si el hook
  // aún no está activo, no hay claim → fail-safe (no bloquea nada).
  if (user && opciones?.rutaProtegida && (await sesionRevocada(supabase, user))) {
    await supabase.auth.signOut();
    return { response: supabaseResponse, user: null, sesionRevocada: true };
  }

  return { response: supabaseResponse, user, sesionRevocada: false };
}

/** true si el `session_version` del token quedó obsoleto frente a la base. */
async function sesionRevocada(
  supabase: ReturnType<typeof createServerClient<Database>>,
  user: User
): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claim = (data?.claims as Record<string, unknown> | undefined)?.session_version;
    if (typeof claim !== "number") return false; // hook no habilitado → fail-safe
    const { data: perfil } = await supabase
      .from("perfil")
      .select("session_version")
      .eq("id", user.id)
      .maybeSingle();
    const actual = perfil?.session_version;
    if (typeof actual !== "number") return false;
    return actual !== claim;
  } catch {
    return false; // ante cualquier fallo del control, no bloquear al usuario
  }
}
