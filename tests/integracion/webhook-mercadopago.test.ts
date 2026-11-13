/**
 * Integración del webhook de Mercado Pago contra la base LOCAL (Docker) — nunca producción.
 *
 * Real: firma HMAC, manejador completo, RPCs/triggers/RLS de Supabase local, cifrado de tokens.
 * Simulado: SOLO la API de Mercado Pago (no hay pagos de sandbox sin comprador de prueba). El simulador
 * respeta la regla del proveedor que importa aquí: cada token solo ve los pagos de SU cuenta.
 *
 * Ejecutar (con `npx supabase start` arriba):
 *   WEBHOOK_INT=1 npx vitest run tests/integracion/webhook-mercadopago.test.ts
 * Sin WEBHOOK_INT=1 se omite (CI no tiene Docker).
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ACTIVO = process.env.WEBHOOK_INT === "1";
const SECRETO = "secreto-webhook-de-prueba-local";

function psql(sql: string): string {
  return execFileSync("docker", ["exec", "-i", "supabase_db_stylernow", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

function supabaseLocal() {
  const out = execFileSync("npx", ["--no-install", "supabase", "status", "-o", "env"], { encoding: "utf8", shell: true });
  const v = (k: string) => new RegExp(`^${k}="?([^"\\r\\n]+)"?`, "m").exec(out)?.[1];
  return { url: v("API_URL")!, secret: v("SERVICE_ROLE_KEY")! };
}

// ── Identificadores únicos por ejecución ────────────────────────────────────
const id = () => randomUUID();
const F = {
  dueno: id(), negA: id(), negB: id(), conA: id(), conB: id(),
  pA1: id(), pA2: id(), pA3: id(), pA4: id(), pA5: id(),
};
const CUENTA_A = "111000111";
const CUENTA_B = "222000222";
const TOKEN_A = "TEST-vendedor-a-ficticio";
const TOKEN_B = "TEST-vendedor-b-ficticio";

// ── Simulador de la API de Mercado Pago ────────────────────────────────────
type PagoMp = { id: number; status: string; status_detail: string; transaction_amount: number; external_reference: string; collector_id: number; live_mode: boolean; payment_type_id: string; payment_method_id: string };
const pagosMp = new Map<string, PagoMp>();
const ordenesMp = new Map<string, { id: number; collector: string; payments: { id: number }[] }>();
const contracargosMp = new Map<string, { id: number; collector: string; payments: number[] }>();
let falla500 = new Set<string>();
const cuentaDeToken: Record<string, string> = { [TOKEN_A]: CUENTA_A, [TOKEN_B]: CUENTA_B };

function pagoMp(idMp: number, ref: string, status: string, cuenta: string, monto = 30000): PagoMp {
  return { id: idMp, status, status_detail: status, transaction_amount: monto, external_reference: ref, collector_id: Number(cuenta), live_mode: false, payment_type_id: "credit_card", payment_method_id: "visa" };
}

function simuladorMp(fetchReal: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://api.mercadopago.com")) return fetchReal(input, init);
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    const cuenta = cuentaDeToken[auth.replace(/^Bearer\s+/i, "")];
    const ruta = new URL(url).pathname;
    const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
    if (!cuenta) return json(401, { message: "invalid token" });
    let m = /^\/v1\/payments\/(\d+)$/.exec(ruta);
    if (m) {
      if (falla500.has(m[1])) return json(500, { message: "internal" });
      const p = pagosMp.get(m[1]);
      return p && String(p.collector_id) === cuenta ? json(200, p) : json(404, { message: "Payment not found" });
    }
    m = /^\/merchant_orders\/(\d+)$/.exec(ruta);
    if (m) {
      const o = ordenesMp.get(m[1]);
      return o && o.collector === cuenta ? json(200, { id: o.id, payments: o.payments }) : json(404, { message: "not found" });
    }
    m = /^\/v1\/chargebacks\/(\d+)$/.exec(ruta);
    if (m) {
      const c = contracargosMp.get(m[1]);
      return c && c.collector === cuenta ? json(200, { id: c.id, payments: c.payments }) : json(404, { message: "not found" });
    }
    if (ruta === "/users/me") return json(200, { id: Number(cuenta) });
    return json(404, { message: "ruta no simulada" });
  }) as typeof fetch;
}

// ── Notificaciones firmadas como las envía Mercado Pago ───────────────────
function notificacion(o: {
  ruta?: "panel" | "preferencia"; tipo: string; dataId: string; c?: string; userId?: string;
  requestId?: string; secreto?: string; ts?: number; sinFirma?: boolean;
}) {
  const requestId = o.requestId ?? randomUUID();
  const ts = String(o.ts ?? Date.now());
  const v1 = createHmac("sha256", o.secreto ?? SECRETO).update(`id:${o.dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  const base = o.ruta === "preferencia" ? "https://app.local/api/webhooks/pasarela/mercadopago" : "https://app.local/api/webhooks/mercadopago";
  const qs = new URLSearchParams({ "data.id": o.dataId, type: o.tipo, ...(o.c ? { c: o.c } : {}) });
  return {
    requestId,
    request: new Request(`${base}?${qs}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId, ...(o.sinFirma ? {} : { "x-signature": `ts=${ts},v1=${v1}` }) },
      body: JSON.stringify({ type: o.tipo, action: `${o.tipo}.updated`, data: { id: o.dataId }, live_mode: false, ...(o.userId ? { user_id: Number(o.userId) } : {}) }),
    }),
  };
}

const evento = (requestId: string) =>
  JSON.parse(psql(`select coalesce(row_to_json(w)::text, 'null') from (select firma, resultado, negocio_id, pago_id, estado_proveedor, live_mode, error, intentos, procesado_at is not null as procesado from public.webhook_evento where request_id = '${requestId}') w;`) || "null");
const estadoPago = (p: string) => psql(`select estado from public.pago where id = '${p}';`);

describe.skipIf(!ACTIVO)("webhook Mercado Pago · integración con Supabase local", () => {
  let procesar: (r: Request) => Promise<Response>;
  const fetchReal = globalThis.fetch;

  beforeAll(async () => {
    const sb = supabaseLocal();
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: sb.url,
      SUPABASE_SECRET_KEY: sb.secret,
      MERCADOPAGO_WEBHOOK_SECRET: SECRETO,
      MERCADOPAGO_ACCESS_TOKEN: "TEST-plataforma-ficticio",
      PAGOS_CIFRADO_CLAVE: randomBytes(32).toString("base64"),
      MERCADOPAGO_ENTORNO: "sandbox",
    });
    delete process.env.VERCEL_ENV;
    vi.stubGlobal("fetch", simuladorMp(fetchReal));

    const { cifrar } = await import("@/lib/pagos/cifrado");
    // Paridad con producción: el CLI local no otorga privilegios por defecto a service_role.
    psql(`grant select, insert, update, delete on all tables in schema public to service_role;
          grant usage, select on all sequences in schema public to service_role;`);
    psql(`
      insert into auth.users (id, email, aud, role) values ('${F.dueno}', 'dueno-${F.dueno}@t.l', 'authenticated', 'authenticated');
      insert into public.perfil (id, nombre) values ('${F.dueno}', 'Dueño prueba') on conflict (id) do nothing;
      insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, sena_pct) values
        ('${F.negA}', '${F.dueno}', 'Barbería A (prueba)', 'wh-a-${F.negA.slice(0, 8)}', 'Cali', 'CO', 20),
        ('${F.negB}', '${F.dueno}', 'Barbería B (prueba)', 'wh-b-${F.negB.slice(0, 8)}', 'Cali', 'CO', 20);
      update public.suscripcion set estado = 'ACTIVA' where negocio_id in ('${F.negA}', '${F.negB}');
      insert into public.conexion_pago_negocio (id, negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at) values
        ('${F.conA}', '${F.negA}', 'CONECTADA', 'SANDBOX', '${CUENTA_A}', '${cifrar(TOKEN_A)}', now() + interval '170 days', now()),
        ('${F.conB}', '${F.negB}', 'CONECTADA', 'SANDBOX', '${CUENTA_B}', '${cifrar(TOKEN_B)}', now() + interval '170 days', now());
      insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela) values
        ('${F.pA1}', '${F.negA}', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO'),
        ('${F.pA2}', '${F.negA}', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO'),
        ('${F.pA3}', '${F.negA}', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO'),
        ('${F.pA4}', '${F.negA}', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO'),
        ('${F.pA5}', '${F.negA}', 'GIFT_CARD', 30000, 'PENDIENTE', 'MERCADOPAGO');
      update public.pago set estado = 'APROBADO', id_transaccion_pasarela = '90005' where id = '${F.pA4}';
    `);

    pagosMp.set("90001", pagoMp(90001, F.pA1, "approved", CUENTA_A));
    pagosMp.set("90002", pagoMp(90002, F.pA2, "rejected", CUENTA_A));
    pagosMp.set("90003", pagoMp(90003, F.pA3, "in_process", CUENTA_A));
    pagosMp.set("90004", pagoMp(90004, F.pA1, "approved", CUENTA_B)); // B intenta confirmar un pago de A
    pagosMp.set("90005", pagoMp(90005, F.pA4, "charged_back", CUENTA_A));
    pagosMp.set("90006", pagoMp(90006, F.pA5, "approved", CUENTA_A));
    ordenesMp.set("70001", { id: 70001, collector: CUENTA_A, payments: [{ id: 90003 }] });
    contracargosMp.set("80001", { id: 80001, collector: CUENTA_A, payments: [90005] });

    procesar = (await import("@/lib/pagos/webhook-mercadopago")).procesarWebhookMercadoPago;
  }, 120_000);

  afterAll(() => {
    vi.unstubAllGlobals();
    if (!ACTIVO) return;
    // Limpieza SOLO de los datos creados por esta prueba en la base local (los triggers de inmutabilidad
    // del libro y la auditoría se desactivan solo en esta sesión de limpieza local).
    const negs = `('${F.negA}', '${F.negB}')`;
    psql(`set session_replication_role = replica;
      delete from public.libro_movimiento where negocio_id in ${negs};
      delete from public.evento_auditoria where negocio_id in ${negs} or entidad_id in ('${F.pA1}','${F.pA2}','${F.pA3}','${F.pA4}','${F.pA5}');
      delete from public.webhook_evento where conexion_id in ('${F.conA}','${F.conB}') or negocio_id in ${negs} or data_id in ('90001','90002','90003','90004','90005','90006','90500','99999','70001','80001','123');
      delete from public.pago where negocio_id in ${negs};
      delete from public.conexion_pago_evento where conexion_id in ('${F.conA}','${F.conB}');
      delete from public.conexion_pago_negocio where id in ('${F.conA}','${F.conB}');
      delete from public.suscripcion where negocio_id in ${negs};
      delete from public.sede where negocio_id in ${negs};
      delete from public.negocio where id in ${negs};
      delete from public.perfil where id = '${F.dueno}';
      delete from auth.users where id = '${F.dueno}';`);
  });

  it("1 · pago aprobado (notification_url con ?c=) confirma el pago y deja traza completa", async () => {
    const n = notificacion({ ruta: "preferencia", tipo: "payment", dataId: "90001", c: F.conA });
    const r = await procesar(n.request);
    expect(r.status).toBe(200);
    expect((await r.json()).resultado).toBe("APROBADO");
    expect(estadoPago(F.pA1)).toBe("APROBADO");
    expect(evento(n.requestId)).toMatchObject({ firma: "VALIDA", resultado: "APROBADO", negocio_id: F.negA, pago_id: F.pA1, estado_proveedor: "approved", live_mode: false, procesado: true });
  });

  it("2 · la misma notificación repetida no se reprocesa (idempotencia de transporte)", async () => {
    const n = notificacion({ ruta: "preferencia", tipo: "payment", dataId: "90001", c: F.conA });
    await procesar(n.request);
    const again = notificacion({ ruta: "preferencia", tipo: "payment", dataId: "90001", c: F.conA, requestId: n.requestId });
    const r = await procesar(again.request);
    expect(await r.json()).toMatchObject({ duplicado: true });
    expect(evento(n.requestId).intentos).toBe(2);
  });

  it("3 · otra notificación del mismo pago no duplica el efecto (idempotencia de negocio)", async () => {
    const r = await procesar(notificacion({ tipo: "payment", dataId: "90001", userId: CUENTA_A }).request);
    expect(r.status).toBe(200);
    expect((await r.json()).resultado).toBe("SIN_CAMBIOS");
    expect(psql(`select count(*) from public.libro_movimiento where pago_id = '${F.pA1}' and evento = 'PAGO_CONFIRMADO';`)).toBe("1");
  });

  it("4 · firma inválida, de otra clave o vencida → 401 y sin registro", async () => {
    for (const n of [
      notificacion({ tipo: "payment", dataId: "90001", c: F.conA, secreto: "otra-clave" }),
      notificacion({ tipo: "payment", dataId: "90001", c: F.conA, ts: Date.now() - 60 * 60_000 }),
      notificacion({ tipo: "payment", dataId: "90001", c: F.conA, sinFirma: true }),
    ]) {
      expect((await procesar(n.request)).status).toBe(401);
      expect(evento(n.requestId)).toBeNull();
    }
  });

  it("5 · URL del panel sin ?c=: identifica la barbería por el user_id y aplica el rechazo", async () => {
    const n = notificacion({ tipo: "payment", dataId: "90002", userId: CUENTA_A });
    const r = await procesar(n.request);
    expect((await r.json()).resultado).toBe("RECHAZADO");
    expect(estadoPago(F.pA2)).toBe("RECHAZADO");
    expect(evento(n.requestId)).toMatchObject({ negocio_id: F.negA, estado_proveedor: "rejected" });
  });

  it("6 · in_process queda pendiente (no se confirma por recibir un aviso)", async () => {
    const r = await procesar(notificacion({ tipo: "payment", dataId: "90003", userId: CUENTA_A }).request);
    expect((await r.json()).resultado).toBe("PENDIENTE");
    expect(estadoPago(F.pA3)).toBe("PENDIENTE");
  });

  it("7 · merchant_order: consulta la orden y cada pago por separado", async () => {
    const n = notificacion({ tipo: "topic_merchant_order_wh", dataId: "70001", userId: CUENTA_A });
    const r = await procesar(n.request);
    expect(r.status).toBe(200);
    expect(evento(n.requestId).resultado).toBe("ORDEN:PENDIENTE");
  });

  it("8 · sin cruces entre barberías: B no puede confirmar un pago de A", async () => {
    // (a) pago real de B que apunta al pago de A
    const n = notificacion({ tipo: "payment", dataId: "90004", userId: CUENTA_B });
    await procesar(n.request);
    // (b) ?c= de B para un pago de A: el token de B no ve ese pago
    const m = notificacion({ ruta: "preferencia", tipo: "payment", dataId: "90006", c: F.conB });
    const r = await procesar(m.request);
    expect(r.status).toBe(200);
    expect(evento(m.requestId).resultado).toBe("RECURSO_NO_ENCONTRADO_EN_PROVEEDOR");
    expect(estadoPago(F.pA5)).toBe("PENDIENTE");
    expect(psql(`select count(*) from public.evento_auditoria where entidad_id = '${F.pA1}' and accion = 'WEBHOOK_CUENTA_NO_COINCIDE';`)).toBe("1");
  });

  it("9 · contracargo (chargebacks) → EN_DISPUTA y el libro lo marca para revisión", async () => {
    const r = await procesar(notificacion({ tipo: "topic_chargebacks_wh", dataId: "80001", userId: CUENTA_A }).request);
    expect(r.status).toBe(200);
    expect(estadoPago(F.pA4)).toBe("EN_DISPUTA");
    expect(psql(`select estado from public.libro_movimiento where pago_id = '${F.pA4}' and evento = 'PAGO_EN_DISPUTA';`)).toBe("REQUIERE_REVISION");
    // repetido: no cambia nada
    const r2 = await procesar(notificacion({ tipo: "payment", dataId: "90005", userId: CUENTA_A }).request);
    expect((await r2.json()).resultado).toBe("SIN_CAMBIOS");
  });

  it("10 · reembolso hecho fuera de StylerNow → queda para revisión, sin mover dinero", async () => {
    pagosMp.set("90001", { ...pagosMp.get("90001")!, status: "refunded" });
    const n = notificacion({ tipo: "payment", dataId: "90001", userId: CUENTA_A });
    const r = await procesar(n.request);
    expect((await r.json()).resultado).toBe("REQUIERE_REVISION");
    expect(estadoPago(F.pA1)).toBe("APROBADO");
    expect(psql(`select count(*) from public.evento_auditoria where entidad_id = '${F.pA1}' and accion = 'PAGO_REEMBOLSO_EXTERNO';`)).toBe("1");
  });

  it("11 · Mercado Pago caído → 500 (reintenta) y el reintento procesa", async () => {
    pagosMp.set("90500", pagoMp(90500, F.pA5, "approved", CUENTA_A));
    falla500 = new Set(["90500"]);
    const n = notificacion({ tipo: "payment", dataId: "90500", userId: CUENTA_A });
    expect((await procesar(n.request)).status).toBe(500);
    expect(evento(n.requestId)).toMatchObject({ procesado: false, resultado: "PROVEEDOR_500" });
    falla500 = new Set();
    const again = notificacion({ tipo: "payment", dataId: "90500", userId: CUENTA_A, requestId: n.requestId });
    expect((await (await procesar(again.request)).json()).resultado).toBe("APROBADO");
    expect(evento(n.requestId)).toMatchObject({ procesado: true, intentos: 2 });
  });

  it("12 · pago inexistente, mp-connect desconocido y topic order: 200 sin efectos", async () => {
    expect((await procesar(notificacion({ tipo: "payment", dataId: "99999", userId: CUENTA_A }).request)).status).toBe(200);
    const mc = await procesar(notificacion({ tipo: "mp-connect", dataId: "123", userId: "999999" }).request);
    expect((await mc.json()).conexion).toBe("SIN_CONEXION");
    const o = await procesar(notificacion({ tipo: "order", dataId: "123" }).request);
    expect((await o.json()).ignorado).toBe("order");
  });

  it("13 · en producción sin secreto configurado → 503 (no se procesa nada)", async () => {
    const antes = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.VERCEL_ENV = "production";
    try {
      expect((await procesar(notificacion({ tipo: "payment", dataId: "90001", c: F.conA }).request)).status).toBe(503);
    } finally {
      process.env.MERCADOPAGO_WEBHOOK_SECRET = antes;
      delete process.env.VERCEL_ENV;
    }
  });
});
