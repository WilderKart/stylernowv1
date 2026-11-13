import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de credenciales de pago (tokens OAuth de cada negocio) — AES-256-GCM.
 *
 * Los tokens se cifran en la aplicación, no en la base: un volcado o una consulta indebida
 * a la base solo expone texto cifrado. La clave vive en `PAGOS_CIFRADO_CLAVE` (32 bytes en
 * base64, generar con `openssl rand -base64 32`) y nunca se registra ni se devuelve.
 *
 * Formato: `v1.<iv>.<tag>.<cifrado>` (base64url). El prefijo de versión permite rotar la
 * clave más adelante sin romper los tokens ya guardados.
 */

const VERSION = "v1";

function clave(): Buffer {
  const b64 = process.env.PAGOS_CIFRADO_CLAVE;
  if (!b64) throw new Error("PAGOS_CIFRADO_NO_CONFIGURADO");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("PAGOS_CIFRADO_CLAVE_INVALIDA");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64url"), c.getAuthTag().toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(paquete: string): string {
  const [v, iv, tag, datos] = paquete.split(".");
  if (v !== VERSION || !iv || !tag || !datos) throw new Error("PAGOS_CIFRADO_FORMATO_INVALIDO");
  const d = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  // Si el texto o el tag fueron alterados, `final()` lanza: nunca se devuelve un token manipulado.
  return Buffer.concat([d.update(Buffer.from(datos, "base64url")), d.final()]).toString("utf8");
}
