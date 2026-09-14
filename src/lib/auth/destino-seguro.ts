/**
 * Valida que un destino post-login sea una ruta interna (05-API/02_Auth.md).
 *
 * Se usa tanto en /login (parámetro `next`) como en /auth/callback (magic link):
 * un valor absoluto o protocol-relative (`https://otro-sitio.com`, `//otro-sitio.com`)
 * sería una redirección abierta hacia un dominio de terceros justo después de
 * autenticarse — el punto de máxima confianza del usuario en la sesión.
 */
export function destinoSeguro(valor: string | string[] | null | undefined): string {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}
