import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { entornoPagos } from "./entorno";

/**
 * OAuth de vendedor de Mercado Pago (split de pagos 1:1, Colombia). Fuentes oficiales:
 *  - https://www.mercadopago.com.co/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration
 *  - https://www.mercadopago.com.co/developers/es/docs/security/oauth/creation (PKCE)
 *  - https://www.mercadopago.com.co/developers/es/docs/split-payments/split-1-1/additional-content/security/oauth/renewal
 *
 * Variables de entorno (servidor):
 *  - MERCADOPAGO_CLIENT_ID / MERCADOPAGO_CLIENT_SECRET: app de StylerNow con modelo "Marketplace".
 *  - MERCADOPAGO_OAUTH_PKCE = "0" para desactivar PKCE (por defecto activo: actívalo también en
 *    "Detalles de aplicación"; una vez activo, Mercado Pago lo exige).
 *  - El modo prueba (test_token) lo decide MERCADOPAGO_ENTORNO (entorno.ts): sandbox por defecto.
 * La redirect URI es `${NEXT_PUBLIC_SITE_URL}/api/pagos/mercadopago/callback` y debe estar
 * registrada igual en la app.
 */

const URL_AUTORIZACION = "https://auth.mercadopago.com.co/authorization";
const URL_TOKEN = "https://api.mercadopago.com/oauth/token";

export function oauthConfigurado() {
  return Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET && urlSitio().startsWith("https://"));
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

export function redirectUri() {
  return `${urlSitio()}/api/pagos/mercadopago/callback`;
}

const usaPkce = () => process.env.MERCADOPAGO_OAUTH_PKCE !== "0";
/** Sandbox lo decide el entorno de pagos del servidor (entorno.ts), no una variable aparte. */
export const esSandbox = () => entornoPagos() === "SANDBOX";

/** state (anti-CSRF) y verificador PKCE, ambos aleatorios de 32 bytes. Solo el hash del state va a la base. */
export function nuevoEstadoOAuth() {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url"); // 64 caracteres (43–128 permitidos)
  return { state, stateHash: hashEstado(state), verifier };
}

export function hashEstado(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function urlAutorizacion(state: string, verifier: string) {
  const p = new URLSearchParams({
    client_id: process.env.MERCADOPAGO_CLIENT_ID ?? "",
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri(),
    state,
  });
  if (usaPkce()) {
    p.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    p.set("code_challenge_method", "S256");
  }
  return `${URL_AUTORIZACION}?${p.toString()}`;
}

export interface TokensVendedor {
  accessToken: string;
  refreshToken: string | null;
  expiraAt: string;
  cuentaExternaId: string;
  scopes: string | null;
}

async function pedirToken(cuerpo: Record<string, string | boolean>): Promise<TokensVendedor> {
  const res = await fetch(URL_TOKEN, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      ...cuerpo,
    }),
  });
  const r = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number | string;
    scope?: string;
    message?: string;
    error?: string;
  } | null;
  // Nunca se registra el cuerpo: puede traer tokens.
  if (!res.ok || !r?.access_token || r.user_id == null) {
    throw new Error(`OAUTH_TOKEN_RECHAZADO_${res.status}`);
  }
  const segundos = Number(r.expires_in) > 0 ? Number(r.expires_in) : 15_552_000; // 180 días documentados
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? null,
    expiraAt: new Date(Date.now() + segundos * 1000).toISOString(),
    cuentaExternaId: String(r.user_id),
    scopes: r.scope ?? null,
  };
}

export function canjearCodigo(code: string, verifier: string) {
  if (!/^[A-Za-z0-9._\-]{8,512}$/.test(code)) throw new Error("OAUTH_CODIGO_INVALIDO");
  return pedirToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    ...(usaPkce() ? { code_verifier: verifier } : {}),
    ...(esSandbox() ? { test_token: true } : {}),
  });
}

/** El refresh token rota: cada renovación devuelve uno nuevo que hay que guardar. */
export function renovarToken(refreshToken: string) {
  return pedirToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}
