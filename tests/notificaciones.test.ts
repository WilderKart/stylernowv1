import { createECDH, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adaptadorNoHabilitado, seleccionarAdaptador, type MensajeSaliente } from "@/lib/notificaciones/adaptadores";
import { ESTADOS_OUTBOX, TRANSICIONES_OUTBOX, transicionValida, type EstadoOutbox } from "@/lib/notificaciones/estados";
import { armarMensaje } from "@/lib/notificaciones/mensaje";
import { construirEnlace, escaparHtml, renderizarHtml, renderizarTexto, rutaSegura } from "@/lib/notificaciones/plantillas";
import {
  b64urlCodificar,
  b64urlDecodificar,
  cargarClavesVapid,
  cifrarMensajePush,
  crearJwtVapid,
  endpointPushValido,
} from "@/lib/notificaciones/web-push";

const MIGRACION = readFileSync(path.resolve(__dirname, "../supabase/migrations/124_notificaciones_outbox.sql"), "utf-8");

function clavesVapidDePrueba() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const priv = Buffer.alloc(32);
  const crudo = ecdh.getPrivateKey();
  crudo.copy(priv, 32 - crudo.length);
  return {
    VAPID_PUBLIC_KEY: b64urlCodificar(ecdh.getPublicKey()),
    VAPID_PRIVATE_KEY: b64urlCodificar(priv),
    VAPID_SUBJECT: "mailto:soporte@stylernow.com",
  };
}

function respuesta(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

const MENSAJE_EMAIL: MensajeSaliente = {
  id: "11111111-1111-1111-1111-111111111111",
  canal: "EMAIL",
  idioma: "es",
  asunto: "Cita confirmada",
  texto: "Tu cita quedó confirmada.",
  html: "<p>ok</p>",
  ruta: "/reserva/x",
  email: "ana@example.com",
};

describe("plantillas: renderizado y escape", () => {
  it("escapa HTML en los valores, no en la plantilla", () => {
    const html = renderizarHtml("<p><strong>{{negocio}}</strong> {{fecha}}</p>", {
      negocio: `<script>alert("x")</script>&'`,
      fecha: "01/12/2026 10:00",
    });
    expect(html).toBe("<p><strong>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;</strong> 01/12/2026 10:00</p>");
  });

  it("texto plano sin escape, variables ausentes → vacío, sin re-expansión", () => {
    expect(renderizarTexto("Hola {{cliente}}{{nada}}", { cliente: "Ana <b>" })).toBe("Hola Ana <b>");
    expect(renderizarTexto("{{a}}", { a: "{{b}}", b: "NO" })).toBe("{{b}}");
    expect(renderizarTexto("{{ a }}", { a: "x" })).toBe("{{ a }}");
    expect(renderizarTexto("{{obj}}{{n}}", { obj: { x: 1 }, n: 5 })).toBe("5");
    expect(escaparHtml(`"&'<>`)).toBe("&quot;&amp;&#39;&lt;&gt;");
  });

  it("solo enlaces internos", () => {
    expect(rutaSegura("/reserva/abc-1")).toBe("/reserva/abc-1");
    for (const mala of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/a?x=<", "", null, 5]) {
      expect(rutaSegura(mala)).toBe("/notificaciones");
    }
    expect(construirEnlace("/panel/agenda", "https://stylernow.com/")).toBe("https://stylernow.com/panel/agenda");
  });

  it("armarMensaje: el correo escapa el nombre del cliente y agrega enlace seguro", () => {
    const m = armarMensaje(
      {
        id: "x",
        evento: "NEGOCIO_RESERVA_NUEVA",
        canal: "EMAIL",
        idioma: "en",
        datos: { cliente: "Ana <b>Cliente</b>", negocio: "Barbería", ruta: "//evil.com" },
        email: "d@example.com",
        asunto: "New booking: {{cliente}}",
        cuerpo: "<p><strong>{{cliente}}</strong> at {{negocio}}</p>",
        push_suscripciones: null,
      },
      "https://stylernow.com",
    );
    expect(m?.asunto).toBe("New booking: Ana <b>Cliente</b>");
    expect(m?.html).toContain("<strong>Ana &lt;b&gt;Cliente&lt;/b&gt;</strong>");
    expect(m?.html).toContain("<title>New booking: Ana &lt;b&gt;Cliente&lt;/b&gt;</title>");
    expect(m?.html).not.toContain("evil.com");
    expect(m?.html).toContain('href="https://stylernow.com/notificaciones"');
    expect(m?.texto).toContain("Ana <b>Cliente</b> at Barbería");
  });

  it("sin plantilla no hay mensaje", () => {
    expect(
      armarMensaje(
        { id: "x", evento: "E", canal: "PUSH", idioma: "es", datos: {}, email: null, asunto: null, cuerpo: null, push_suscripciones: [] },
        "https://stylernow.com",
      ),
    ).toBeNull();
  });
});

describe("selección de adaptador", () => {
  it("sin credenciales: canal no habilitado, nunca simula envío", async () => {
    for (const canal of ["EMAIL", "PUSH", "PANEL"] as const) {
      const a = seleccionarAdaptador(canal, {});
      expect(a.habilitado).toBe(false);
      expect(await a.enviar(MENSAJE_EMAIL)).toEqual({ ok: false, codigo: "CANAL_NO_HABILITADO", reintentable: false });
    }
    expect(adaptadorNoHabilitado("EMAIL").nombre).toBe("NO_HABILITADO");
  });

  it("Resend: ENVIADO solo con id del proveedor; idempotency key; reintentos", async () => {
    const llamadas: RequestInit[] = [];
    const conId = seleccionarAdaptador("EMAIL", { RESEND_API_KEY: "re_test" }, async (_u, init) => {
      llamadas.push(init);
      return respuesta(200, { id: "abc" });
    });
    expect(conId.nombre).toBe("RESEND");
    expect(await conId.enviar(MENSAJE_EMAIL)).toEqual({ ok: true, idExterno: "resend:abc" });
    expect((llamadas[0].headers as Record<string, string>)["Idempotency-Key"]).toBe(`outbox-${MENSAJE_EMAIL.id}`);

    const sinId = seleccionarAdaptador("EMAIL", { RESEND_API_KEY: "re_test" }, async () => respuesta(200, {}));
    expect(await sinId.enviar(MENSAJE_EMAIL)).toEqual({ ok: false, codigo: "RESPUESTA_SIN_ID", reintentable: true });

    const caido = seleccionarAdaptador("EMAIL", { RESEND_API_KEY: "re_test" }, async () => respuesta(503));
    expect(await caido.enviar(MENSAJE_EMAIL)).toEqual({ ok: false, codigo: "HTTP_503", reintentable: true });

    const invalido = seleccionarAdaptador("EMAIL", { RESEND_API_KEY: "re_test" }, async () => respuesta(422));
    expect(await invalido.enviar(MENSAJE_EMAIL)).toEqual({ ok: false, codigo: "HTTP_422", reintentable: false });

    const red = seleccionarAdaptador("EMAIL", { RESEND_API_KEY: "re_test" }, async () => {
      throw new Error("ECONNRESET");
    });
    expect(await red.enviar(MENSAJE_EMAIL)).toEqual({ ok: false, codigo: "ERROR_RED", reintentable: true });

    expect(await conId.enviar({ ...MENSAJE_EMAIL, email: null })).toEqual({ ok: false, codigo: "SIN_DESTINO", reintentable: false });
  });

  it("Web push: solo con un par VAPID coherente", () => {
    const claves = clavesVapidDePrueba();
    expect(seleccionarAdaptador("PUSH", claves).habilitado).toBe(true);
    expect(seleccionarAdaptador("PUSH", { ...claves, VAPID_SUBJECT: "soporte" }).habilitado).toBe(false);
    const otro = clavesVapidDePrueba();
    expect(seleccionarAdaptador("PUSH", { ...claves, VAPID_PUBLIC_KEY: otro.VAPID_PUBLIC_KEY }).habilitado).toBe(false);
  });

  it("Web push: 201 con Location es evidencia; 410 expira la suscripción; endpoints ajenos no se llaman", async () => {
    const claves = clavesVapidDePrueba();
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123def456",
      p256dh: b64urlCodificar(ua.getPublicKey()),
      auth: b64urlCodificar(Buffer.alloc(16, 7)),
    };
    const urls: string[] = [];
    const ok = seleccionarAdaptador("PUSH", claves, async (u, init) => {
      urls.push(u);
      const h = init.headers as Record<string, string>;
      expect(h["Content-Encoding"]).toBe("aes128gcm");
      expect(h.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
      return respuesta(201, "", { Location: "https://fcm.googleapis.com/m/123" });
    });
    const msg: MensajeSaliente = { ...MENSAJE_EMAIL, canal: "PUSH", push: [sub, { ...sub, endpoint: "https://evil.example.com/x/abcdefghijk" }] };
    expect(await ok.enviar(msg)).toEqual({ ok: true, idExterno: "https://fcm.googleapis.com/m/123", expirados: ["https://evil.example.com/x/abcdefghijk"] });
    expect(urls).toEqual([sub.endpoint]);

    const expirada = seleccionarAdaptador("PUSH", claves, async () => respuesta(410));
    expect(await expirada.enviar({ ...msg, push: [sub] })).toEqual({
      ok: false,
      codigo: "SIN_SUSCRIPCION_PUSH",
      reintentable: false,
      expirados: [sub.endpoint],
    });
    const sinSubs = await ok.enviar({ ...msg, push: [] });
    expect(sinSubs).toEqual({ ok: false, codigo: "SIN_SUSCRIPCION_PUSH", reintentable: false });
  });
});

describe("web push: RFC 8291 y RFC 8292", () => {
  it("vector de prueba del Apéndice A de RFC 8291", () => {
    const cuerpo = cifrarMensajePush({
      payload: Buffer.from("When I grow up, I want to be a watermelon"),
      uaPublica: b64urlDecodificar("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
      authSecreto: b64urlDecodificar("BTBZMqHH6r4Tts7J_aSIgg"),
      asPrivada: b64urlDecodificar("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
      salt: b64urlDecodificar("DGv6ra1nlYgDCS1FRnbzlw"),
    });
    expect(b64urlCodificar(cuerpo)).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("JWT VAPID ES256 verificable con la clave pública, exp ≤ 24 h", () => {
    const env = clavesVapidDePrueba();
    const claves = cargarClavesVapid(env)!;
    const ahora = 1_800_000_000;
    const jwt = crearJwtVapid({ audiencia: "https://fcm.googleapis.com", claves, ahoraSeg: ahora, duracionSeg: 999_999 });
    const [cab, cuerpo, firma] = jwt.split(".");
    expect(JSON.parse(Buffer.from(cab, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: ahora + 24 * 3600, sub: "mailto:soporte@stylernow.com" });
    const pub = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: b64urlCodificar(claves.publica.subarray(1, 33)), y: b64urlCodificar(claves.publica.subarray(33)) },
      format: "jwk",
    });
    expect(verify("sha256", Buffer.from(`${cab}.${cuerpo}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(firma, "base64url"))).toBe(true);
  });

  it("endpoints: solo https de servicios de push conocidos", () => {
    expect(endpointPushValido("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(endpointPushValido("https://web.push.apple.com/QGx-abc123")).toBe(true);
    expect(endpointPushValido("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    for (const malo of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://fcm.googleapis.com.evil.com/x/abc",
      "https://evilpush.apple.com.example/x/abcdef",
      "https://169.254.169.254/latest/meta-data",
      "https://user:pw@fcm.googleapis.com/fcm/send/abc",
    ]) {
      expect(endpointPushValido(malo)).toBe(false);
    }
  });
});

describe("máquina de estados: espejo de la migración 124", () => {
  it("las transiciones de TS son exactamente las del trigger", () => {
    const bloque = MIGRACION.slice(MIGRACION.indexOf("TRANSICIONES:INICIO"), MIGRACION.indexOf("TRANSICIONES:FIN"));
    const enSql = [...bloque.matchAll(/\('([A-Z_]+)', '([A-Z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const enTs = Object.entries(TRANSICIONES_OUTBOX)
      .flatMap(([o, ds]) => ds.map((d) => `${o}>${d}`))
      .sort();
    expect(enSql.length).toBeGreaterThan(5);
    expect(enTs).toEqual(enSql);
  });

  it("los estados de TS son los del CHECK de la tabla", () => {
    const m = MIGRACION.match(/estado text not null default 'PENDIENTE' check \(estado in \(([^)]+)\)\)/);
    expect(m).not.toBeNull();
    const enSql = [...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]).sort();
    expect([...ESTADOS_OUTBOX].sort()).toEqual(enSql);
  });

  it("los finales no salen; ENVIADO solo desde PROCESANDO", () => {
    for (const final of ["ENVIADO", "FALLIDO", "OMITIDO_PREFERENCIA"] as EstadoOutbox[]) {
      for (const d of ESTADOS_OUTBOX) expect(transicionValida(final, d)).toBe(false);
    }
    const haciaEnviado = ESTADOS_OUTBOX.filter((o) => transicionValida(o, "ENVIADO"));
    expect(haciaEnviado).toEqual(["PROCESANDO"]);
  });
});
