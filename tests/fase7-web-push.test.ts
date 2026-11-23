import { createECDH } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  b64urlCodificar,
  b64urlDecodificar,
  cargarClavesVapid,
  cifrarMensajePush,
  crearJwtVapid,
  endpointPushValido,
  enviarPushA,
  type SuscripcionPush,
} from "@/lib/notificaciones/web-push";

function clavesDePrueba() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const privada = Buffer.alloc(32);
  ecdh.getPrivateKey().copy(privada, 32 - ecdh.getPrivateKey().length);
  return cargarClavesVapid({
    VAPID_PUBLIC_KEY: b64urlCodificar(ecdh.getPublicKey()),
    VAPID_PRIVATE_KEY: b64urlCodificar(privada),
    VAPID_SUBJECT: "mailto:soporte@stylernow.com",
  })!;
}

function suscripcionDePrueba(): SuscripcionPush {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123def456",
    p256dh: b64urlCodificar(ua.getPublicKey()),
    auth: b64urlCodificar(Buffer.alloc(16, 7)),
  };
}

function respuesta(status: number, headers: Record<string, string> = {}) {
  return new Response("", { status, headers });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Fase 7 · codificación y validación Web Push", () => {
  it("codifica y decodifica bytes sin perder información", () => {
    const bytes = Buffer.from([0, 1, 251, 255, 254, 128]);
    expect(b64urlDecodificar(b64urlCodificar(bytes))).toEqual(bytes);
    expect(b64urlDecodificar("QQ==QQ==").toString()).toBe("A");
  });

  it("rechaza claves, auth, salt y payload inválidos con códigos exactos", () => {
    const sub = suscripcionDePrueba();
    const comun = { payload: Buffer.from("hola"), uaPublica: b64urlDecodificar(sub.p256dh), authSecreto: b64urlDecodificar(sub.auth) };
    expect(() => cifrarMensajePush({ ...comun, uaPublica: Buffer.alloc(64) })).toThrow("P256DH_INVALIDA");
    expect(() => cifrarMensajePush({ ...comun, uaPublica: Buffer.concat([Buffer.from([3]), Buffer.alloc(64)]) })).toThrow(
      "P256DH_INVALIDA"
    );
    expect(() => cifrarMensajePush({ ...comun, authSecreto: Buffer.alloc(15) })).toThrow("AUTH_INVALIDO");
    expect(() => cifrarMensajePush({ ...comun, salt: Buffer.alloc(15) })).toThrow("SALT_INVALIDO");
    expect(() => cifrarMensajePush({ ...comun, payload: Buffer.alloc(4080) })).toThrow("PAYLOAD_DEMASIADO_GRANDE");
  });

  it("acepta claves VAPID con espacios y rechaza pares incoherentes", () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const privada = Buffer.alloc(32);
    ecdh.getPrivateKey().copy(privada, 32 - ecdh.getPrivateKey().length);
    const env = {
      VAPID_PUBLIC_KEY: b64urlCodificar(ecdh.getPublicKey()),
      VAPID_PRIVATE_KEY: b64urlCodificar(privada),
      VAPID_SUBJECT: "mailto:soporte@stylernow.com",
    };
    expect(cargarClavesVapid({ ...env, VAPID_PUBLIC_KEY: `  ${env.VAPID_PUBLIC_KEY}  ` })?.publicaB64).toBe(env.VAPID_PUBLIC_KEY);
    expect(cargarClavesVapid({ ...env, VAPID_PRIVATE_KEY: `  ${env.VAPID_PRIVATE_KEY}  ` })?.privada).toEqual(privada);
    expect(cargarClavesVapid({ ...env, VAPID_SUBJECT: `  ${env.VAPID_SUBJECT}  ` })?.sujeto).toBe(env.VAPID_SUBJECT);
    expect(cargarClavesVapid({ ...env, VAPID_PUBLIC_KEY: undefined })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_PRIVATE_KEY: undefined })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_SUBJECT: undefined })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_SUBJECT: "mailto:sin-arroba" })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_SUBJECT: "https://con espacio" })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_PUBLIC_KEY: b64urlCodificar(Buffer.alloc(64)) })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_PRIVATE_KEY: b64urlCodificar(Buffer.alloc(31)) })).toBeNull();
    expect(cargarClavesVapid({ ...env, VAPID_PUBLIC_KEY: "!!!" })).toBeNull();
    const otro = createECDH("prime256v1");
    otro.generateKeys();
    expect(cargarClavesVapid({ ...env, VAPID_PUBLIC_KEY: b64urlCodificar(otro.getPublicKey()) })).toBeNull();
  });

  it("usa now y duración por defecto al firmar el JWT VAPID", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    try {
      const jwt = crearJwtVapid({ audiencia: "https://fcm.googleapis.com", claves: clavesDePrueba() });
      const cuerpo = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      expect(cuerpo).toEqual({
        aud: "https://fcm.googleapis.com",
        exp: 1_800_000_000 + 12 * 3600,
        sub: "mailto:soporte@stylernow.com",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("limita endpoints por longitud, esquema y hostname exacto", () => {
    for (const bueno of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://android.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://push.apple.com/x/abc",
      "https://web.push.apple.com/x/abc",
      "https://notify.windows.com/x/abc",
    ]) {
      expect(endpointPushValido(bueno)).toBe(true);
    }
    for (const malo of [
      "x".repeat(19),
      "x".repeat(1025),
      null,
      123,
      "https://evil-fcm.googleapis.com/fcm/send/abc",
      "https://evil-android.googleapis.com/fcm/send/abc",
      "https://evil-updates.push.services.mozilla.com/wpush/v2/abc",
      "https://evil_.push.apple.com/x/abc",
      "https://evil_.notify.windows.com/x/abc",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://user:pw@fcm.googleapis.com/fcm/send/abc",
    ]) {
      expect(endpointPushValido(malo)).toBe(false);
    }
  });
});

describe("Fase 7 · envío Web Push", () => {
  it("envía POST con cabeceras exactas y devuelve el Location como evidencia", async () => {
    const sub = suscripcionDePrueba();
    const fetchPush = vi.fn(async () => respuesta(201, { Location: "https://fcm.googleapis.com/m/123" }));
    const resultado = await enviarPushA(sub, Buffer.from("hola"), clavesDePrueba(), fetchPush);
    expect(resultado).toEqual({ ok: true, idExterno: "https://fcm.googleapis.com/m/123" });
    expect(fetchPush).toHaveBeenCalledTimes(1);
    const [url, init] = fetchPush.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(sub.endpoint);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.body).toBeInstanceOf(Uint8Array);
    const headers = init.headers as Record<string, string>;
    expect(headers.TTL).toBe("86400");
    expect(headers.Urgency).toBe("normal");
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  });

  it("acepta 202 sin Location con idefinición acotada y trunca Location largo", async () => {
    const sub = suscripcionDePrueba();
    const sinLocation = vi.fn(async () => respuesta(202));
    const resultado = await enviarPushA(sub, Buffer.from("hola"), clavesDePrueba(), sinLocation);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.idExterno).toMatch(/^fcm\.googleapis\.com:202:[0-9a-f]{12}:\d+$/);

    const location = "x".repeat(400);
    const conLocation = vi.fn(async () => respuesta(201, { Location: location }));
    const truncado = await enviarPushA(sub, Buffer.from("hola"), clavesDePrueba(), conLocation);
    expect(truncado.ok).toBe(true);
    if (truncado.ok) expect(truncado.idExterno).toBe(location.slice(0, 280));
  });

  it("clasifica respuestas HTTP y errores de red sin filtrar el payload", async () => {
    const sub = suscripcionDePrueba();
    const casos: Array<[number, { ok: false; codigo: string; reintentable: boolean; expirada: boolean }]> = [
      [404, { ok: false, codigo: "HTTP_404", reintentable: false, expirada: true }],
      [410, { ok: false, codigo: "HTTP_410", reintentable: false, expirada: true }],
      [429, { ok: false, codigo: "HTTP_429", reintentable: true, expirada: false }],
      [400, { ok: false, codigo: "HTTP_400", reintentable: false, expirada: false }],
      [503, { ok: false, codigo: "HTTP_503", reintentable: true, expirada: false }],
    ];
    for (const [status, esperado] of casos) {
      const fetchPush = vi.fn(async () => respuesta(status));
      await expect(enviarPushA(sub, Buffer.from("hola"), clavesDePrueba(), fetchPush)).resolves.toEqual(esperado);
    }
    const caido = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(enviarPushA(sub, Buffer.from("hola"), clavesDePrueba(), caido)).resolves.toEqual({
      ok: false,
      codigo: "ERROR_RED",
      reintentable: true,
      expirada: false,
    });
  });

  it("no llama a la red con endpoints o suscripciones inválidos", async () => {
    const sub = suscripcionDePrueba();
    const fetchPush = vi.fn(async () => respuesta(201));
    await expect(
      enviarPushA({ ...sub, endpoint: "https://evil.example.com/x/abcdefghijk" }, Buffer.from("hola"), clavesDePrueba(), fetchPush)
    ).resolves.toEqual({ ok: false, codigo: "ENDPOINT_NO_PERMITIDO", reintentable: false, expirada: true });
    await expect(
      enviarPushA({ ...sub, p256dh: b64urlCodificar(Buffer.alloc(4)) }, Buffer.from("hola"), clavesDePrueba(), fetchPush)
    ).resolves.toEqual({ ok: false, codigo: "SUSCRIPCION_INVALIDA", reintentable: false, expirada: true });
    expect(fetchPush).not.toHaveBeenCalled();
  });
});
