import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/database";

const REQUEST_ID_VALIDO = /^[A-Za-z0-9._:-]{1,100}$/;

/** Cliente Supabase para Server Components / Server Actions / Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  // `x-request-id` lo pone proxy.ts en cada petición (sobrescribe el del navegador). Se reenvía a
  // PostgREST para que la auditoría (migración 123) ligue cada cambio con la petición que lo hizo.
  const requestId = (await headers()).get("x-request-id");

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: requestId && REQUEST_ID_VALIDO.test(requestId) ? { headers: { "x-request-id": requestId } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura de cookies.
            // El middleware ya se encarga de refrescar la sesión — se ignora aquí.
          }
        },
      },
    }
  );
}
