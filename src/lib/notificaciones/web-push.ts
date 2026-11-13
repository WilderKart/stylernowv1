import { createECDH, createCipheriv, createHash, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

/**
 * Web Push sin dependencias (solo node:crypto):
 *  - RFC 8291: cifrado del mensaje (ECDH P-256 + HKDF-SHA256 + AES-128-GCM, codificación aes128gcm de RFC 8188).
 *  - RFC 8292: identificación del servidor (VAPID, JWT ES256).
 * Verificado con el vector de prueba del Apéndice A de RFC 8291 (tests/notificaciones.test.ts).
 */

export function b64urlDecodificar(s: string): Buffer {
  return Buffer.from(s.replace(/=+$/, ""), "base64url");
}

export function b64urlCodificar(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}

const TAMANO_REGISTRO = 4096;

export function cifrarMensajePush(opts: {
  payload: Uint8Array;
  /** Clave pública del navegador (p256dh), 65 bytes sin comprimir. */
  uaPublica: Uint8Array;
  /** Secreto de autenticación del navegador (auth), 16 bytes. */
  authSecreto: Uint8Array;
  /** Solo para pruebas deterministas: clave privada efímera del servidor y salt. */
  asPrivada?: Uint8Array;
  salt?: Uint8Array;
}): Buffer {
  const uaPublica = Buffer.from(opts.uaPublica);
  const auth = Buffer.from(opts.authSecreto);
  if (uaPublica.length !== 65 || uaPublica[0] !== 0x04) throw new Error("P256DH_INVALIDA");
  if (auth.length !== 16) throw new Error("AUTH_INVALIDO");

  const ecdh = createECDH("prime256v1");
  if (opts.asPrivada) ecdh.setPrivateKey(Buffer.from(opts.asPrivada));
  else ecdh.generateKeys();
  const asPublica = ecdh.getPublicKey();
  const secretoEcdh = ecdh.computeSecret(uaPublica);

  // PRK_key = HMAC(auth, ecdh); IKM = HKDF-Expand(PRK_key, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const infoClave = Buffer.concat([Buffer.from("WebPush: info\0", "latin1"), uaPublica, asPublica]);
  const ikm = Buffer.from(hkdfSync("sha256", secretoEcdh, auth, infoClave, 32));

  const salt = Buffer.from(opts.salt ?? randomBytes(16));
  if (salt.length !== 16) throw new Error("SALT_INVALIDO");
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0", "latin1"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0", "latin1"), 12));

  // Un solo registro: datos || 0x02 (delimitador de último registro), sin relleno adicional.
  const claro = Buffer.concat([Buffer.from(opts.payload), Buffer.from([0x02])]);
  if (claro.length + 16 > TAMANO_REGISTRO) throw new Error("PAYLOAD_DEMASIADO_GRANDE");
  const cifrador = createCipheriv("aes-128-gcm", cek, nonce);
  const cifrado = Buffer.concat([cifrador.update(claro), cifrador.final(), cifrador.getAuthTag()]);

  // Encabezado RFC 8188: salt(16) || rs(uint32) || idlen(1) || keyid(as_public)
  const encabezado = Buffer.alloc(21);
  salt.copy(encabezado, 0);
  encabezado.writeUInt32BE(TAMANO_REGISTRO, 16);
  encabezado[20] = asPublica.length;
  return Buffer.concat([encabezado, asPublica, cifrado]);
}

export interface ClavesVapid {
  publica: Buffer;
  privada: Buffer;
  publicaB64: string;
  sujeto: string;
}

/**
 * Lee las claves VAPID del entorno del servidor. Devuelve null si faltan o no son coherentes
 * (la pública debe derivarse de la privada). Formato: base64url, como las genera `web-push generate-vapid-keys`.
 */
export function cargarClavesVapid(env: Record<string, string | undefined>): ClavesVapid | null {
  const pub = env.VAPID_PUBLIC_KEY?.trim();
  const priv = env.VAPID_PRIVATE_KEY?.trim();
  const sujeto = env.VAPID_SUBJECT?.trim();
  if (!pub || !priv || !sujeto) return null;
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(sujeto)) return null;
  try {
    const publica = b64urlDecodificar(pub);
    const privada = b64urlDecodificar(priv);
    if (publica.length !== 65 || privada.length !== 32) return null;
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privada);
    if (!ecdh.getPublicKey().equals(publica)) return null;
    return { publica, privada, publicaB64: b64urlCodificar(publica), sujeto };
  } catch {
    return null;
  }
}

export function crearJwtVapid(opts: { audiencia: string; claves: ClavesVapid; ahoraSeg?: number; duracionSeg?: number }): string {
  const ahora = opts.ahoraSeg ?? Math.floor(Date.now() / 1000);
  // RFC 8292 §2: exp no más de 24 h en el futuro.
  const exp = ahora + Math.min(opts.duracionSeg ?? 12 * 3600, 24 * 3600);
  const cab = b64urlCodificar(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64urlCodificar(Buffer.from(JSON.stringify({ aud: opts.audiencia, exp, sub: opts.claves.sujeto })));
  const clave = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64urlCodificar(opts.claves.privada),
      x: b64urlCodificar(opts.claves.publica.subarray(1, 33)),
      y: b64urlCodificar(opts.claves.publica.subarray(33, 65)),
    },
    format: "jwk",
  });
  const firma = sign("sha256", Buffer.from(`${cab}.${cuerpo}`), { key: clave, dsaEncoding: "ieee-p1363" });
  return `${cab}.${cuerpo}.${b64urlCodificar(firma)}`;
}

/** Mismos servicios que acepta `_notif_endpoint_valido` en la base. Evita SSRF con endpoints inventados. */
const HOSTS_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function endpointPushValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && u.port === "" && !u.username && !u.password && HOSTS_PUSH.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

export interface SuscripcionPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type ResultadoPush =
  | { ok: true; idExterno: string }
  | { ok: false; codigo: string; reintentable: boolean; expirada: boolean };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function enviarPushA(
  sub: SuscripcionPush,
  payload: Uint8Array,
  claves: ClavesVapid,
  fetchImpl: FetchLike = fetch,
): Promise<ResultadoPush> {
  if (!endpointPushValido(sub.endpoint)) return { ok: false, codigo: "ENDPOINT_NO_PERMITIDO", reintentable: false, expirada: true };
  let cuerpo: Buffer;
  try {
    cuerpo = cifrarMensajePush({ payload, uaPublica: b64urlDecodificar(sub.p256dh), authSecreto: b64urlDecodificar(sub.auth) });
  } catch {
    return { ok: false, codigo: "SUSCRIPCION_INVALIDA", reintentable: false, expirada: true };
  }
  const url = new URL(sub.endpoint);
  const jwt = crearJwtVapid({ audiencia: url.origin, claves });
  let res: Response;
  try {
    res = await fetchImpl(sub.endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        TTL: "86400",
        Urgency: "normal",
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${claves.publicaB64}`,
      },
      body: new Uint8Array(cuerpo),
    });
  } catch {
    return { ok: false, codigo: "ERROR_RED", reintentable: true, expirada: false };
  }
  if (res.status === 201 || res.status === 202) {
    // RFC 8030 §5: el push service devuelve en Location la URL del mensaje creado.
    const ubicacion = res.headers.get("location");
    const huella = createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 12);
    return { ok: true, idExterno: ubicacion ? ubicacion.slice(0, 280) : `${url.hostname}:${res.status}:${huella}:${Date.now()}` };
  }
  if (res.status === 404 || res.status === 410) return { ok: false, codigo: `HTTP_${res.status}`, reintentable: false, expirada: true };
  const reintentable = res.status === 429 || res.status >= 500;
  return { ok: false, codigo: `HTTP_${res.status}`, reintentable, expirada: false };
}
