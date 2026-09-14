import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con la Secret Key — bypassa RLS. Solo para Server Actions / Route
 * Handlers que implementan explícitamente reglas de "solo por proceso de
 * sistema" (06-Security/02_RLS.md): eventos de auditoría, puntaje de Staff,
 * pagos/webhooks, consumo de créditos IA, notificaciones.
 *
 * Nunca importar este archivo desde un Client Component — `server-only`
 * rompe el build si ocurre por error.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
