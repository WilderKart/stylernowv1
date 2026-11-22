import { createHash, randomBytes } from "node:crypto";

/**
 * Seguimiento seguro de un caso radicado SIN cuenta. El solicitante recibe un token aleatorio de 256 bits; en la base solo se
 * guarda su SHA-256 (migración 152). Conocer el número de radicación (SN-AAAA-NNNNNN, consecutivo y por tanto adivinable) NO
 * basta para ver un caso: hace falta el token. Un token filtrado de la base no sirve (es un hash de una cadena de alta entropía).
 */
export const NUMERO_RADICACION_RE = /^SN-\d{4}-\d{6}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function normalizarNumero(n: unknown): string | null {
  if (typeof n !== "string") return null;
  const v = n.trim().toUpperCase();
  return NUMERO_RADICACION_RE.test(v) ? v : null;
}
