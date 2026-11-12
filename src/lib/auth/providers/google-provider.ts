import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuthProvider } from "@/lib/auth/providers/tipos";

/**
 * Credenciales ya configuradas en Supabase Dashboard (Client ID/Secret,
 * callback y Redirect URLs) — este archivo no necesita ninguna variable de
 * entorno propia, Supabase resuelve el intercambio OAuth de su lado.
 */
export const googleProvider: AuthProvider = {
  id: "google",
  name: "Google",

  isEnabled() {
    return true;
  },

  async login(redirectTo: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { ok: false, error: error?.message ?? "No se pudo iniciar Google." };
    return { ok: true, url: data.url };
  },

  async callback() {
    // El intercambio real ocurre en /auth/callback (PKCE, compartido por
    // todos los proveedores de Supabase) — ver comentario en tipos.ts.
    return { ok: false, error: "GoogleProvider.callback() no se usa directo — ver /auth/callback." };
  },

  async link() {
    const supabase = await createClient();
    const { error } = await supabase.auth.linkIdentity({ provider: "google" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async unlink() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const identidad = user?.identities?.find((i) => i.provider === "google");
    if (!identidad) return { ok: false, error: "No tienes Google vinculado." };
    const { error } = await supabase.auth.unlinkIdentity(identidad);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },
};
