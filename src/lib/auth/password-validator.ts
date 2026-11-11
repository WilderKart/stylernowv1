import "server-only";
import { validarPolitica } from "@/lib/auth/password-policy";
import { passwordFueUsadaAntes } from "@/lib/auth/password-history";
import { POLITICA_PASSWORD } from "@/lib/auth/password-policy";

/**
 * Único punto que valida una contraseña nueva (política + historial) — todo
 * Server Action que crea o cambia una contraseña llama SOLO a esta función,
 * nunca revalida las reglas por su cuenta (evita que la política se
 * desincronice entre "crear" y "cambiar").
 */
export async function validarContrasenaNueva(
  userId: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const politica = await validarPolitica(password);
  if (!politica.ok) return politica;

  if (await passwordFueUsadaAntes(userId, password)) {
    return { ok: false, error: `No podés reutilizar ninguna de tus últimas ${POLITICA_PASSWORD.noReutilizarUltimas} contraseñas.` };
  }
  return { ok: true };
}
