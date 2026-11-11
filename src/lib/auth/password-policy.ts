import "server-only";
import { createHash } from "node:crypto";
import { validarFormatoPassword } from "@/lib/auth/password";

/** Valores mostrados en la UI (requisitos visibles al usuario) — una sola fuente. */
export const POLITICA_PASSWORD = {
  minimo: 12,
  requiereMayuscula: true,
  requiereMinuscula: true,
  requiereNumero: true,
  requiereSimbolo: true,
  noReutilizarUltimas: 5,
} as const;

/**
 * Pwned Passwords (k-anonimato, HaveIBeenPwned): se envían solo los primeros
 * 5 caracteres del hash SHA-1 — la contraseña real nunca sale del servidor.
 * **Fail-open**: si el servicio externo no responde, no bloquea el registro
 * (única dependencia de red nueva de todo ADR-015; nunca debe ser un punto
 * único de falla para algo tan crítico como poder crear una cuenta).
 */
async function estaComprometida(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefijo = sha1.slice(0, 5);
    const sufijo = sha1.slice(5);

    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 2500);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      signal: controlador.signal,
      headers: { "Add-Padding": "true" },
    });
    clearTimeout(timeout);
    if (!res.ok) return false; // fail-open

    const texto = await res.text();
    return texto.split("\n").some((linea) => linea.split(":")[0]?.trim() === sufijo);
  } catch {
    return false; // fail-open: timeout, sin red, DNS caído, etc.
  }
}

export async function validarPolitica(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const formato = validarFormatoPassword(password);
  if (!formato.ok) return formato;

  if (await estaComprometida(password)) {
    return { ok: false, error: "Esta contraseña apareció en filtraciones públicas — elegí otra." };
  }
  return { ok: true };
}
