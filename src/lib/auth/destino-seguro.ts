/**
 * Valida que un destino post-login sea una ruta interna (05-API/02_Auth.md).
 *
 * Se usa tanto en /login (parámetro `next`) como en /auth/callback (magic link):
 * un valor absoluto o protocol-relative (`https://otro-sitio.com`, `//otro-sitio.com`)
 * sería una redirección abierta hacia un dominio de terceros justo después de
 * autenticarse — el punto de máxima confianza del usuario en la sesión.
 *
 * Los navegadores normalizan `\` a `/` y descartan tabuladores y saltos de línea dentro de la URL, por lo que
 * `/\otro-sitio.com` o `/\t/otro-sitio.com` también terminan siendo `//otro-sitio.com`. Por eso, además del
 * prefijo, se rechazan esos caracteres y se confirma que, resuelto contra un origen ficticio, el destino
 * se queda en ese mismo origen.
 */
const ORIGEN_FICTICIO = "https://destino-seguro.invalid";

export function destinoSeguro(valor: string | string[] | null | undefined): string {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return "/";
  try {
    const url = new URL(v, ORIGEN_FICTICIO);
    if (url.origin !== ORIGEN_FICTICIO) return "/";
  } catch {
    return "/";
  }
  return v;
}
