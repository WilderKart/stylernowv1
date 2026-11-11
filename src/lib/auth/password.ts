import { z } from "zod";

/**
 * ADR-015, Fase C — esquema único de contraseña. Cliente y servidor validan
 * exactamente contra este mismo schema (el servidor siempre es quien decide
 * de verdad; el cliente solo da feedback inmediato).
 */
export const PASSWORD_SCHEMA = z
  .string()
  .min(12, "Mínimo 12 caracteres")
  .regex(/[A-Z]/, "Necesita al menos una mayúscula")
  .regex(/[a-z]/, "Necesita al menos una minúscula")
  .regex(/[0-9]/, "Necesita al menos un número")
  .regex(/[^A-Za-z0-9]/, "Necesita al menos un símbolo");

export type PasswordValidationResult = { ok: true } | { ok: false; error: string };

export function validarFormatoPassword(password: string): PasswordValidationResult {
  const res = PASSWORD_SCHEMA.safeParse(password);
  if (res.success) return { ok: true };
  return { ok: false, error: res.error.issues[0]?.message ?? "Contraseña inválida" };
}
