/**
 * Integración de los pagos de BARBEROS ADICIONALES (FASE 2A) contra la base LOCAL (Docker) — nunca producción.
 *
 * Real: firma HMAC, manejador completo del webhook, sincronizar.ts, RPC/triggers/RLS de Supabase local, crearPreferenciaDePago.
 * Simulado: SOLO la API de Mercado Pago (no hay credenciales de sandbox con comprador de prueba en este entorno). Es un SIMULADOR,
 * no un pago de sandbox real: así consta en el informe.
 *
 * Ejecutar (con Supabase local arriba):
 *   ADICIONALES_INT=1 npx vitest run tests/integracion/adicionales-pagos.test.ts
 * Sin ADICIONALES_INT=1 se omite (CI no tiene Docker).
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ACTIVO = process.env.ADICIONALES_INT === "1";
const SECRETO = "secreto-webhook-adicionales-local";
const TOKEN_PLATAFORMA = "TEST-plataforma-adicionales-ficticio";
const CUENTA_PLATAFORMA = "333000333";

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

const id = () => randomUUID();
const F = { dueno: id(), neg: id(), sede: id() };

// ── Simulador de Mercado Pago ───────────────────────────────────────────────
type PagoMp = { id: number; status: string; status_detail: string; transaction_amount: number; external_reference: string; collector_id: number; live_mode: boolean; payment_type_id: string; payment_method_id: string };
const pagosMp = new Map<string, PagoMp>();
const reembolsosSolicitados: string[] = [];
const preferenciasCreadas: { cuerpo: Record<string, unknown> }[] = [];
function pagoMp(idMp: number, ref: string, status: string, monto: number): PagoMp {
  return { id: idMp, status, status_detail: status, transaction_amount: monto, external_reference: ref, collector_id: Number(CUENTA_PLATAFORMA), live_mode: false, payment_type_id: "credit_card", payment_method_id: "visa" };
}
function simuladorMp(fetchReal: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://api.mercadopago.com")) return fetchReal(input, init);
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
    if (auth.replace(/^Bearer\s+/i, "") !== TOKEN_PLATAFORMA) return json(401, { message: "invalid token" });
    const ruta = new URL(url).pathname;
    if (ruta === "/checkout/preferences" && init?.method === "POST") {
      preferenciasCreadas.push({ cuerpo: JSON.parse(String(init.body)) });
      return json(201, { id: "pref-adicional-1", init_point: "https://sandbox.mercadopago.test/checkout?pref=pref-adicional-1" });
    }
    if (ruta === "/v1/payments/search") {
      const ref = new URL(url).searchParams.get("external_reference");
      return json(200, { results: [...pagosMp.values()].filter((p) => p.external_reference === ref) });
    }
    let m = /^\/v1\/payments\/(\d+)$/.exec(ruta);
    if (m) {
      const p = pagosMp.get(m[1]);
      return p ? json(200, p) : json(404, { message: "Payment not found" });
    }
    m = /^\/v1\/payments\/(\d+)\/refunds$/.exec(ruta);
    if (m) {
      reembolsosSolicitados.push(m[1]);
      return json(201, { id: 1, status: "approved", amount: 1 });
    }
    return json(404, { message: "ruta no simulada" });
  }) as typeof fetch;
}

function notificacion(o: { dataId: string; ts?: number; requestId?: string }) {
  const requestId = o.requestId ?? randomUUID();
  const ts = String(o.ts ?? Date.now());
  const v1 = createHmac("sha256", SECRETO).update(`id:${o.dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  const qs = new URLSearchParams({ "data.id": o.dataId, type: "payment" });
  return new Request(`https://app.local/api/webhooks/mercadopago?${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId, "x-signature": `ts=${ts},v1=${v1}` },
    body: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: o.dataId }, live_mode: false }),
  });
}

// ── Helpers de base (sesión del propietario con JWT simulado, como PostgREST) ──────────────
function comoDueno(sql: string): string {
  return psql(`begin; set local role authenticated;
    select set_config('request.jwt.claims', json_build_object('sub', '${F.dueno}', 'role', 'authenticated')::text, true);
    ${sql}
    commit;`).split("\n").filter((l) => l && l !== "BEGIN" && l !== "SET" && l !== "COMMIT").slice(-1)[0];
}
function iniciar(cantidad: number, total: number): { lote_id: string; pago_id: string } {
  const linea = comoDueno(`select public.adicional_iniciar('${F.neg}', ${cantidad}, ${total});`);
  return JSON.parse(linea);
}
const estadoLote = (l: string) => psql(`select estado from public.adicional_lote where id = '${l}';`);
const tope = () => Number(psql(`select (public._capacidad_profesional('${F.neg}') ->> 'limite');`));
const estadoPago = (p: string) => psql(`select estado from public.pago where id = '${p}';`);
const revisiones = () => Number(psql(`select count(*) from public.adicional_pago_revision where negocio_id = '${F.neg}';`));

describe.skipIf(!ACTIVO)("barberos adicionales · pagos por Checkout Pro (webhook real + Mercado Pago simulado)", () => {
  let procesar: (r: Request) => Promise<Response>;
  const fetchReal = globalThis.fetch;

  beforeAll(async () => {
    const sb = supabaseLocal();
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: sb.url,
      SUPABASE_SECRET_KEY: sb.secret,
      MERCADOPAGO_WEBHOOK_SECRET: SECRETO,
      MERCADOPAGO_ACCESS_TOKEN: TOKEN_PLATAFORMA,
      PAGOS_CIFRADO_CLAVE: randomBytes(32).toString("base64"),
      MERCADOPAGO_ENTORNO: "sandbox",
    });
    delete process.env.VERCEL_ENV;
    vi.stubGlobal("fetch", simuladorMp(fetchReal));
    // Paridad con producción: el CLI local no otorga privilegios por defecto a service_role (las RPC *_srv sí tienen EXECUTE explícito).
    psql(`grant select, insert, update, delete on all tables in schema public to service_role;
          grant usage, select on all sequences in schema public to service_role;`);
    psql(`
      insert into auth.users (id, email, aud, role) values ('${F.dueno}', 'adic-${F.dueno}@t.l', 'authenticated', 'authenticated');
      insert into public.perfil (id, nombre) values ('${F.dueno}', 'Dueño adicionales') on conflict (id) do nothing;
      insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values ('${F.neg}', '${F.dueno}', 'Adicionales prueba', 'adic-${F.neg.slice(0, 8)}', 'Cali', 'CO', 'ACTIVO');
      update public.negocio set plan_codigo = 'ESSENTIAL' where id = '${F.neg}';
      delete from public.suscripcion where negocio_id = '${F.neg}';
      insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values ('${F.neg}', 'ESSENTIAL', 'ACTIVA', now() + interval '3 days', 'CO');
      insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values ('${F.sede}', '${F.neg}', 'Sede', 'Cra 1', 'Cali', true);
    `);
    procesar = (await import("@/lib/pagos/webhook-mercadopago")).procesarWebhookMercadoPago;
  }, 120_000);

  afterAll(() => {
    vi.unstubAllGlobals();
    if (!ACTIVO) return;
    // Limpia SOLO los datos creados por esta prueba (triggers de inmutabilidad desactivados solo en esta sesión local).
    psql(`set session_replication_role = replica;
      delete from public.notificacion_outbox where negocio_id = '${F.neg}';
      delete from public.adicional_pago_revision where negocio_id = '${F.neg}';
      delete from public.adicional_historial where negocio_id = '${F.neg}';
      delete from public.adicional_cobro where negocio_id = '${F.neg}';
      delete from public.adicional_lote where negocio_id = '${F.neg}';
      delete from public.libro_movimiento where negocio_id = '${F.neg}';
      delete from public.webhook_evento where negocio_id = '${F.neg}';
      delete from public.evento_auditoria where negocio_id = '${F.neg}';
      delete from public.pago where negocio_id = '${F.neg}';
      delete from public.suscripcion where negocio_id = '${F.neg}';
      delete from public.sede where negocio_id = '${F.neg}';
      delete from public.negocio where id = '${F.neg}';
      delete from public.perfil where id = '${F.dueno}';
      delete from auth.users where id = '${F.dueno}';`);
  });

  it("1 · la preferencia de Checkout Pro sale del pago de la base: external_reference = pago.id y el importe es el total (3 × 51.900)", async () => {
    const r = iniciar(3, 155700);
    const { crearPreferenciaDePago } = await import("@/lib/pagos/cobro");
    const pref = await crearPreferenciaDePago({ pagoId: r.pago_id, titulo: "Barberos adicionales ×3", urlRetorno: "https://app.local/panel/staff/adicionales?desde=pago" });
    expect(pref.url).toContain("sandbox.mercadopago.test");
    const cuerpo = preferenciasCreadas.at(-1)!.cuerpo as { external_reference: string; items: { unit_price: number }[] };
    expect(cuerpo.external_reference).toBe(r.pago_id);
    expect(cuerpo.items[0].unit_price).toBe(155700);
    expect(psql(`select id_preferencia_pasarela || '/' || entorno from public.pago where id = '${r.pago_id}';`)).toBe("pref-adicional-1/SANDBOX");
    expect(estadoLote(r.lote_id)).toBe("CHECKOUT_INICIADO");
    expect(tope()).toBe(1);   // iniciar el checkout NO sube el tope
    (globalThis as { __lote1?: typeof r }).__lote1 = r;
  });

  it("2 · pago aprobado por webhook firmado: activa SOLO los 3 cupos del lote", async () => {
    const r = (globalThis as { __lote1?: { lote_id: string; pago_id: string } }).__lote1!;
    pagosMp.set("91001", pagoMp(91001, r.pago_id, "approved", 155700));
    const resp = await procesar(notificacion({ dataId: "91001" }));
    expect(resp.status).toBe(200);
    expect((await resp.json()).resultado).toBe("APROBADO");
    expect(estadoLote(r.lote_id)).toBe("ACTIVO");
    expect(tope()).toBe(4);
    expect(estadoPago(r.pago_id)).toBe("APROBADO");
    expect(psql(`select plan_codigo from public.negocio where id = '${F.neg}';`)).toBe("ESSENTIAL");
    expect(psql(`select count(*) from public.notificacion_outbox where evento = 'ADICIONAL_ACTIVADO' and negocio_id = '${F.neg}';`)).not.toBe("0");
  });

  it("3 · el mismo pago notificado otra vez no duplica (webhook duplicado)", async () => {
    const r = (globalThis as { __lote1?: { lote_id: string; pago_id: string } }).__lote1!;
    const resp = await procesar(notificacion({ dataId: "91001" }));
    expect((await resp.json()).resultado).toBe("SIN_CAMBIOS");
    expect(tope()).toBe(4);
    expect(psql(`select periodo_n from public.adicional_lote where id = '${r.lote_id}';`)).toBe("1");
    expect(psql(`select count(*) from public.adicional_historial where lote_id = '${r.lote_id}' and evento = 'ACTIVADO';`)).toBe("1");
  });

  it("4 · pago pendiente → PAGO_PENDIENTE y NO activa; rechazado NO activa; reintento aprobado sobre la misma preferencia SÍ activa", async () => {
    const r = iniciar(2, 103800);
    pagosMp.set("91002", pagoMp(91002, r.pago_id, "in_process", 103800));
    expect((await (await procesar(notificacion({ dataId: "91002" }))).json()).resultado).toBe("PENDIENTE");
    expect(estadoLote(r.lote_id)).toBe("PAGO_PENDIENTE");
    expect(tope()).toBe(4);
    pagosMp.set("91003", pagoMp(91003, r.pago_id, "rejected", 103800));
    await procesar(notificacion({ dataId: "91003" }));
    expect(estadoLote(r.lote_id)).toBe("PAGO_PENDIENTE");   // un rechazo no cierra el cobro
    expect(tope()).toBe(4);
    pagosMp.set("91004", pagoMp(91004, r.pago_id, "approved", 103800));
    expect((await (await procesar(notificacion({ dataId: "91004" }))).json()).resultado).toBe("APROBADO");
    expect(estadoLote(r.lote_id)).toBe("ACTIVO");
    expect(tope()).toBe(6);
    // Fuera de orden: llega ahora la notificación atrasada del pago "pendiente" (91002): no retrocede nada.
    const tarde = await procesar(notificacion({ dataId: "91002" }));
    expect(tarde.status).toBe(200);
    expect(estadoLote(r.lote_id)).toBe("ACTIVO");
    expect(tope()).toBe(6);
  });

  it("5 · importe distinto en Mercado Pago → no activa nada", async () => {
    const r = iniciar(1, 51900);
    pagosMp.set("91005", pagoMp(91005, r.pago_id, "approved", 100));
    const resp = await procesar(notificacion({ dataId: "91005" }));
    expect((await resp.json()).resultado).toBe("SIN_CAMBIOS");
    expect(estadoLote(r.lote_id)).toBe("CHECKOUT_INICIADO");
    expect(estadoPago(r.pago_id)).toBe("PENDIENTE");
    expect(tope()).toBe(6);
  });

  it("6 · referencia desconocida «ADIC-…»: se registra, NO activa y NO se reembolsa automáticamente", async () => {
    const antes = reembolsosSolicitados.length;
    pagosMp.set("91006", pagoMp(91006, `ADIC-${id()}`, "approved", 51900));
    const resp = await procesar(notificacion({ dataId: "91006" }));
    expect((await resp.json()).resultado).toBe("REQUIERE_REVISION");
    expect(reembolsosSolicitados.length).toBe(antes);   // ningún reembolso hacia Mercado Pago
    expect(Number(psql(`select count(*) from public.evento_auditoria where accion = 'WEBHOOK_HUERFANO' and payload_despues ->> 'id_transaccion' = '91006';`))).toBeGreaterThanOrEqual(1);
    expect(tope()).toBe(6);
  });

  it("7 · pago de otro negocio/lote o con lote inexistente → cola de revisión, sin activar ni reembolsar", async () => {
    const antes = reembolsosSolicitados.length;
    const p = id();
    psql(`insert into public.pago (id, negocio_id, tipo, monto, estado, pasarela, metadata)
          values ('${p}', '${F.neg}', 'SUSCRIPCION', 51900, 'PENDIENTE', 'MERCADOPAGO', '{"concepto":"STAFF_EXTRA","lote_id":"${id()}","periodo_n":1}');`);
    pagosMp.set("91007", pagoMp(91007, p, "approved", 51900));
    const resp = await procesar(notificacion({ dataId: "91007" }));
    expect((await resp.json()).resultado).toBe("REQUIERE_REVISION");
    expect(estadoPago(p)).toBe("PENDIENTE");
    expect(revisiones()).toBeGreaterThanOrEqual(1);
    expect(reembolsosSolicitados.length).toBe(antes);
    expect(tope()).toBe(6);
  });

  it("8 · webhook tardío (fuera de la ventana de firma) → 401; la conciliación lo aplica después con el estado real", async () => {
    // Lote nuevo de otro tamaño: iniciar cierra el checkout abierto del caso 5 (reemplazado) y abre este.
    const r = iniciar(4, 207600);
    pagosMp.set("91008", pagoMp(91008, r.pago_id, "approved", 207600));
    const viejo = await procesar(notificacion({ dataId: "91008", ts: Date.now() - 60 * 60_000 }));
    expect(viejo.status).toBe(401);
    expect(estadoLote(r.lote_id)).not.toBe("ACTIVO");
    const { sincronizarPago } = await import("@/lib/pagos/sincronizar");
    const res = await sincronizarPago(r.pago_id);
    expect(res.estado).toBe("APROBADO");
    expect(estadoLote(r.lote_id)).toBe("ACTIVO");
    expect(tope()).toBe(10);
  });

  it("9 · pago de PLAN y de ADICIONAL conviven: el adicional pendiente no bloquea el plan y pagar el plan no activa cupos", async () => {
    const pendiente = iniciar(1, 51900);   // un adicional pendiente nuevo (el del caso 5 se cerró al abrir el del caso 8)
    const linea = comoDueno(`select to_json(x) from public.solicitar_pago_plan('${F.neg}', null, null) x;`);
    const pagoPlan = (JSON.parse(linea) as { id: string; monto: number });
    pagosMp.set("91009", pagoMp(91009, pagoPlan.id, "approved", Number(pagoPlan.monto)));
    expect((await (await procesar(notificacion({ dataId: "91009" }))).json()).resultado).toBe("APROBADO");
    expect(psql(`select fecha_proximo_cobro > now() + interval '25 days' from public.suscripcion where negocio_id = '${F.neg}';`)).toBe("t");
    expect(psql(`select plan_codigo from public.negocio where id = '${F.neg}';`)).toBe("ESSENTIAL");
    expect(estadoLote(pendiente.lote_id)).toBe("CHECKOUT_INICIADO");   // el pago del plan no activó cupos
    expect(tope()).toBe(10);
  });
});
