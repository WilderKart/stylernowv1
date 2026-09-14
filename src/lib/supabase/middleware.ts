import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** Refresca la sesión de Supabase en cada request (05-API/02_Auth.md: rotación de refresh token). */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
        "Configuralas en Vercel → Project Settings → Environment Variables y volvé a desplegar."
    );
    return supabaseResponse;
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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No eliminar: refresca el token si expiró (necesario para Server Components).
  await supabase.auth.getUser();

  return supabaseResponse;
}
