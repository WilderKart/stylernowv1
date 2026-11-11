import { googleProvider } from "@/lib/auth/providers/google-provider";
import { appleProvider } from "@/lib/auth/providers/apple-provider";
import type { AuthProvider } from "@/lib/auth/providers/tipos";

/** Proveedores OAuth reales (comparten `/auth/callback`) — agregar uno nuevo es agregarlo acá. */
export const PROVEEDORES_OAUTH: AuthProvider[] = [googleProvider, appleProvider];

export function obtenerProveedor(id: string): AuthProvider | undefined {
  return PROVEEDORES_OAUTH.find((p) => p.id === id);
}

/**
 * Todos los MÉTODOS de autenticación de StylerNow, incluyendo Password (que
 * no es un `AuthProvider` — no tiene un intercambio OAuth con callback, usa
 * `login/actions.ts` directo). Esta tabla es la fuente para la UI de login,
 * `Identity_Provider_Platform.md` y `13_Auth_State_Machine.md` — nunca se
 * mantiene una segunda lista a mano en otro lado.
 */
export const METODOS_AUTH = [
  { id: "password", nombre: "Contraseña", tipo: "credentials" as const, habilitado: true },
  ...PROVEEDORES_OAUTH.map((p) => ({ id: p.id, nombre: p.name, tipo: "oauth" as const, habilitado: p.isEnabled() })),
];
