/**
 * ADR-015, Fase D — contrato oficial de proveedor de identidad OAuth. Google
 * y (en el futuro) Apple/Microsoft/GitHub implementan exactamente esta
 * interfaz — agregar uno nuevo nunca debe requerir tocar `login/actions.ts`,
 * `/auth/callback`, ni ningún guard (`requireRole`/`resolverContexto`/etc.).
 * El rol de la persona NUNCA sale de aquí — un proveedor solo autentica,
 * el rol siempre se deriva después de `negocio`/`vinculo_staff_negocio`/
 * `perfil.es_supersu`, igual que con OTP o password.
 */
export interface AuthProvider {
  readonly id: string;
  readonly name: string;

  /** Inicia el flujo del proveedor. Devuelve la URL a la que redirigir al navegador. */
  login(redirectTo: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>;

  /**
   * Documenta el contrato de intercambio código→sesión de este proveedor.
   * En la práctica, todos los proveedores OAuth de Supabase comparten el
   * mismo callback físico (`/auth/callback`, PKCE) — este método existe para
   * que un proveedor futuro con un intercambio distinto pueda implementar
   * el suyo sin tocar el callback genérico.
   */
  callback(code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;

  /** Vincula este proveedor a la cuenta ya autenticada por otro medio. */
  link(): Promise<{ ok: true } | { ok: false; error: string }>;

  /** Desvincula este proveedor, sin eliminar la cuenta. */
  unlink(): Promise<{ ok: true } | { ok: false; error: string }>;

  /** Si el proveedor está listo para usarse hoy (credenciales configuradas). */
  isEnabled(): boolean;
}
