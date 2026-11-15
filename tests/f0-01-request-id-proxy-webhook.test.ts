/**
 * F0-01 — el proxy sobrescribe `x-request-id` y el webhook de Mercado Pago firma con el id ORIGINAL.
 * Prueba sintética de extremo a extremo (sin red, sin base, sin Mercado Pago real):
 *   petición firmada como la firma Mercado Pago → proxy real (src/proxy.ts) → encabezados que recibe la ruta
 *   → procesarWebhookMercadoPago real. La base se simula: si la firma pasa, el registro idempotente
 *   responde «duplicado» (200); si no pasa, el handler devuelve 401 antes de tocar la base.
 * Clave y firmas son ficticias.
 */
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const llamadasRpc: string[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (nombre: string) => {
      llamadasRpc.push(nombre);
      return { data: false, error: null }; // webhook_registrar → «ya existía»: corta el flujo tras la firma
    },
  }),
}));

const SECRETO = "secreto-ficticio-f0-01";
const URL_WEBHOOK = "http://localhost:3000/api/webhooks/mercadopago?data.id=123456789&type=payment";

function firmar(dataId: string, requestId: string, ts: string, clave = SECRETO) {
  const v1 = createHmac("sha256", clave).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

/** Encabezados que la ruta recibe de verdad tras pasar por el proxy (Next los publica como x-middleware-request-*). */
function encabezadosAguasAbajo(respuesta: Response): Headers {
  const salida = new Headers();
  const prefijo = "x-middleware-request-";
  respuesta.headers.forEach((valor, nombre) => {
    if (nombre.startsWith(prefijo)) salida.set(nombre.slice(prefijo.length), valor);
  });
  return salida;
}

let proxy: (r: NextRequest) => Promise<Response>;
let procesar: (r: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRETO;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; // el proxy degrada sin sesión: no se llama a Supabase
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  ({ proxy } = (await import("@/proxy")) as unknown as { proxy: typeof proxy });
  ({ procesarWebhookMercadoPago: procesar } = await import("@/lib/pagos/webhook-mercadopago"));
});

/** Envía la notificación por el camino real: proxy → handler. */
async function enviar(cabecerasEntrantes: Record<string, string>) {
  llamadasRpc.length = 0;
  const peticion = new NextRequest(URL_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecerasEntrantes },
    body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
  });
  const respuestaProxy = await proxy(peticion);
  const abajo = encabezadosAguasAbajo(respuestaProxy);
  const alRuta = new Request(URL_WEBHOOK, {
    method: "POST",
    headers: abajo,
    body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
  });
  const res = await procesar(alRuta);
  return { status: res.status, abajo, llegoALaBase: llamadasRpc.length > 0 };
}

describe("F0-01 · x-request-id entre el proxy y el webhook de Mercado Pago", () => {
  it("el proxy cambia x-request-id: el que ve la ruta NO es el que firmó Mercado Pago", async () => {
    const idMp = "mp-req-0001";
    const { abajo } = await enviar({ "x-request-id": idMp, "x-signature": firmar("123456789", idMp, String(Date.now())) });
    console.info("[F0-01] id que envía Mercado Pago:", idMp, "| id que recibe la ruta:", abajo.get("x-request-id"), "| x-request-id-origen:", abajo.get("x-request-id-origen") ?? "(ausente)");
    expect(abajo.get("x-request-id")).not.toBe(idMp);
  });

  it("una firma VÁLIDA (hecha con el id original de Mercado Pago) se acepta", async () => {
    const idMp = "mp-req-0002";
    const r = await enviar({ "x-request-id": idMp, "x-signature": firmar("123456789", idMp, String(Date.now())) });
    expect(r.status).toBe(200);
    expect(r.llegoALaBase).toBe(true);
  });

  it("una firma MANIPULADA (v1 alterado) se rechaza con 401 y no toca la base", async () => {
    const idMp = "mp-req-0003";
    const firma = firmar("123456789", idMp, String(Date.now()));
    const alterada = firma.replace(/v1=(.)/, (_, c) => `v1=${c === "a" ? "b" : "a"}`);
    const r = await enviar({ "x-request-id": idMp, "x-signature": alterada });
    expect(r.status).toBe(401);
    expect(r.llegoALaBase).toBe(false);
  });

  it("firma hecha con otra clave, o de otro data.id, o sin x-signature: 401", async () => {
    const idMp = "mp-req-0004";
    const ts = String(Date.now());
    expect((await enviar({ "x-request-id": idMp, "x-signature": firmar("123456789", idMp, ts, "otra-clave") })).status).toBe(401);
    expect((await enviar({ "x-request-id": idMp, "x-signature": firmar("999", idMp, ts) })).status).toBe(401);
    expect((await enviar({ "x-request-id": idMp })).llegoALaBase).toBe(false);
  });

  it("un cliente NO puede falsificar x-request-id-origen: el proxy lo descarta y escribe el suyo", async () => {
    // Atacante: la firma es válida para el id «A», pero la petición real trae x-request-id «B» y finge origen «A».
    const ts = String(Date.now());
    const r = await enviar({
      "x-request-id": "id-real-B",
      "x-request-id-origen": "id-falso-A",
      "x-signature": firmar("123456789", "id-falso-A", ts),
    });
    expect(r.abajo.get("x-request-id-origen")).not.toBe("id-falso-A");
    expect(r.status).toBe(401);
    expect(r.llegoALaBase).toBe(false);
  });

  it("sin x-request-id de entrada tampoco se acepta un x-request-id-origen inventado por el cliente", async () => {
    const ts = String(Date.now());
    const r = await enviar({ "x-request-id-origen": "inventado", "x-signature": firmar("123456789", "inventado", ts) });
    expect(r.abajo.get("x-request-id-origen")).toBeNull();
    expect(r.status).toBe(401);
  });

  it("llamada directa al handler (sin proxy) con origen falsificado y firma con clave ajena: 401", async () => {
    llamadasRpc.length = 0;
    const ts = String(Date.now());
    const res = await procesar(
      new Request(URL_WEBHOOK, {
        method: "POST",
        headers: { "x-request-id-origen": "x", "x-request-id": "y", "x-signature": firmar("123456789", "x", ts, "clave-del-atacante") },
        body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
      }),
    );
    expect(res.status).toBe(401);
    expect(llamadasRpc.length).toBe(0);
  });
});
