import "server-only";
import type { AuthProvider } from "@/lib/auth/providers/tipos";

/**
 * ADR-015, Fase D — preparado, NO implementado. El día que existan
 * credenciales de Sign in with Apple, esto pasa a `isEnabled() { return
 * true; }` y se completan `login()`/`callback()`/`link()`/`unlink()` con el
 * mismo patrón que `google-provider.ts` — ningún otro archivo del núcleo de
 * auth debería necesitar cambios (mismo contrato `AuthProvider`, mismo
 * `/auth/callback` compartido).
 */
export const appleProvider: AuthProvider = {
  id: "apple",
  name: "Apple",

  isEnabled() {
    return false;
  },

  async login() {
    return { ok: false, error: "Apple todavía no está habilitado." };
  },

  async callback() {
    return { ok: false, error: "Apple todavía no está habilitado." };
  },

  async link() {
    return { ok: false, error: "Apple todavía no está habilitado." };
  },

  async unlink() {
    return { ok: false, error: "Apple todavía no está habilitado." };
  },
};
