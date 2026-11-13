/**
 * Celular del registro («Crea tu cuenta»). Espejo de `telefono_valido_registro` (migración 128):
 * la base vuelve a validar, esto sirve para dar el error a tiempo y armar el número E.164.
 * El formato no prueba que el número sea del usuario: se guarda como NO verificado.
 */

export type PaisRegistro = "CO" | "US" | "MX" | "ES";

export const INDICATIVO: Record<PaisRegistro, string> = { CO: "+57", US: "+1", MX: "+52", ES: "+34" };

const PATRON_NACIONAL: Record<PaisRegistro, RegExp> = {
  CO: /^3\d{9}$/, // celular: 3XX XXX XXXX
  US: /^[2-9]\d{2}[2-9]\d{6}$/,
  MX: /^\d{10}$/,
  ES: /^[67]\d{8}$/, // móvil: 6XX / 7XX
};

export const EJEMPLO_NACIONAL: Record<PaisRegistro, string> = {
  CO: "300 123 4567",
  US: "201 555 0123",
  MX: "55 1234 5678",
  ES: "612 345 678",
};

/** Deja solo dígitos y quita el indicativo si el usuario lo escribió. */
export function soloNacional(pais: PaisRegistro, entrada: string): string {
  let d = (entrada ?? "").replace(/\D/g, "");
  const ind = INDICATIVO[pais].slice(1);
  if (d.length > PATRON_NACIONAL_LONGITUD[pais] && d.startsWith(ind)) d = d.slice(ind.length);
  return d;
}

const PATRON_NACIONAL_LONGITUD: Record<PaisRegistro, number> = { CO: 10, US: 10, MX: 10, ES: 9 };

/** Número en formato E.164 (+57300…) o null si no es un celular válido para ese país. */
export function telefonoE164(pais: PaisRegistro, entrada: string): string | null {
  const nacional = soloNacional(pais, entrada);
  return PATRON_NACIONAL[pais].test(nacional) ? `${INDICATIVO[pais]}${nacional}` : null;
}
