import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type TipoIntentoAuth = "otp_envio" | "otp_verificacion" | "password_login" | "password_recovery";

/**
 * ADR-015, Fase 10 — rate limiting de intentos de auth sin Redis (Supabase
 * puro, migración 081). Se llama con `createAdminClient()` porque estas RPC
 * están revocadas de `public/anon/authenticated` (ADL-022/028) y porque el
 * chequeo debe correr ANTES de que exista sesión — OTP/login/recovery son
 * justamente los caminos pre-sesión.
 */
export async function verificarRateLimitAuth(email: string, tipo: TipoIntentoAuth): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("verificar_rate_limit_auth", { p_email: email, p_tipo: tipo });
  if (error?.message.includes("RATE_LIMIT_EXCEDIDO")) {
    return { ok: false, error: "Demasiados intentos. Esperá unos minutos antes de volver a intentar." };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function registrarIntentoAuth(email: string, tipo: TipoIntentoAuth, exitoso: boolean): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("registrar_intento_auth", { p_email: email, p_tipo: tipo, p_exitoso: exitoso });
}
