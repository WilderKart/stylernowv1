import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sincronizarPago = vi.fn();
const cuentaDePago = vi.fn();
const buscarPagoPorReferencia = vi.fn();
let usuario: { id: string } | null = { id: "u1" };
let estadosPago: (string | null)[] = [];

vi.mock("@/lib/pagos/sincronizar", () => ({ sincronizarPago: (...a: unknown[]) => sincronizarPago(...a) }));
vi.mock("@/lib/pagos/conexiones", () => ({ cuentaDePago: (...a: unknown[]) => cuentaDePago(...a) }));
vi.mock("@/lib/pagos/mercadopago", async (orig) => ({
  ...(await orig<typeof import("@/lib/pagos/mercadopago")>()),
  buscarPagoPorReferencia: (...a: unknown[]) => buscarPagoPorReferencia(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            const estado = estadosPago.length > 1 ? estadosPago.shift() : estadosPago[0];
            return { data: estado ? { estado } : null };
          },
        }),
      }),
    }),
  }),
}));

import { consultarEstadoPagoModal } from "@/app/pagos/modal-actions";
import { crearPreferencia } from "@/lib/pagos/mercadopago";

const ID = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("consultarEstadoPagoModal (estado real del cobro para el modal)", () => {
  beforeEach(() => {
    sincronizarPago.mockReset();
    cuentaDePago.mockReset().mockResolvedValue({ token: undefined, conexionId: null });
    buscarPagoPorReferencia.mockReset().mockResolvedValue(null);
    usuario = { id: "u1" };
    estadosPago = [];
  });

  it("rechaza ids que no son uuid sin tocar la base ni la pasarela", async () => {
    expect(await consultarEstadoPagoModal("../../x")).toEqual({ estado: "SIN_PAGO", enProceso: false, medio: null });
    expect(sincronizarPago).not.toHaveBeenCalled();
  });

  it("sin sesión no revela nada", async () => {
    usuario = null;
    estadosPago = ["APROBADO"];
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("SIN_PAGO");
  });

  it("un cobro que la persona no ve (RLS) se trata como inexistente", async () => {
    estadosPago = [];
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("SIN_PAGO");
  });

  it("aprobado en la base no vuelve a consultar a la pasarela", async () => {
    estadosPago = ["APROBADO"];
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("APROBADO");
    expect(sincronizarPago).not.toHaveBeenCalled();
  });

  it("pendiente: reconcilia con Mercado Pago y devuelve lo que quedó en la base", async () => {
    estadosPago = ["PENDIENTE", "APROBADO"];
    sincronizarPago.mockResolvedValue({ estado: "APROBADO", reservaId: null });
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("APROBADO");
    expect(sincronizarPago).toHaveBeenCalledWith(ID);
  });

  it("rechazado se informa como rechazado", async () => {
    estadosPago = ["PENDIENTE", "RECHAZADO"];
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("RECHAZADO");
  });

  it("pendiente con un intento en curso (PSE) marca «en proceso» y el medio", async () => {
    estadosPago = ["PENDIENTE"];
    buscarPagoPorReferencia.mockResolvedValue({ estado: "PENDIENTE", metodo: "pse", tipoMetodo: "bank_transfer" });
    expect(await consultarEstadoPagoModal(ID)).toEqual({ estado: "PENDIENTE", enProceso: true, medio: "pse" });
  });

  it("pendiente sin intento todavía: «esperando»", async () => {
    estadosPago = ["PENDIENTE"];
    expect(await consultarEstadoPagoModal(ID)).toEqual({ estado: "PENDIENTE", enProceso: false, medio: null });
  });

  it("un fallo de la pasarela no rompe el modal ni cambia el estado", async () => {
    estadosPago = ["PENDIENTE"];
    sincronizarPago.mockRejectedValue(new Error("MP caído"));
    cuentaDePago.mockRejectedValue(new Error("MP caído"));
    expect((await consultarEstadoPagoModal(ID)).estado).toBe("PENDIENTE");
  });
});

describe("cobro directo 1 a 1 de la plataforma (sin split)", () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });

  it("un cobro de la plataforma nunca envía marketplace_fee, aunque se le pase una comisión", async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-ficticio-para-prueba";
    let cuerpo: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/pay" }), { status: 201 });
    }) as typeof fetch;
    const r = await crearPreferencia({ pagoId: ID, titulo: "Plan", monto: 100000, urlRetorno: "https://x", marketplaceFee: 5000 });
    expect(r).toEqual({ id: "pref-1", url: "https://mp/pay" });
    expect(cuerpo).not.toHaveProperty("marketplace_fee");
    expect(cuerpo.external_reference).toBe(ID);
  });
});

describe("auto_return solo con https (Mercado Pago responde 400 con localhost)", () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });
  async function cuerpoPara(urlRetorno: string) {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-ficticio-para-prueba";
    let cuerpo: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "p", init_point: "https://mp/pay" }), { status: 201 });
    }) as typeof fetch;
    await crearPreferencia({ pagoId: ID, titulo: "Plan", monto: 1000, urlRetorno });
    return cuerpo;
  }
  it("con https envía auto_return; con http local no", async () => {
    expect(await cuerpoPara("https://stylernowv1.vercel.app/panel/suscripcion")).toHaveProperty("auto_return", "approved");
    expect(await cuerpoPara("http://localhost:3000/panel/suscripcion")).not.toHaveProperty("auto_return");
  });
});

describe("sin credenciales en archivos versionados", () => {
  const RAIZ = process.cwd();
  const IGNORAR = new Set(["node_modules", ".next", ".git", "backups", "capturas"]);
  function archivos(dir: string, salida: string[] = []) {
    for (const n of readdirSync(dir)) {
      if (IGNORAR.has(n)) continue;
      const p = join(dir, n);
      const s = statSync(p);
      if (s.isDirectory()) archivos(p, salida);
      else if (/\.(ts|tsx|md|json|css|sql|example)$/.test(n) || n === ".env.example") salida.push(p);
    }
    return salida;
  }

  it("no hay tokens de Mercado Pago (APP_USR-…/TEST-…) en src, tests, docs ni .env.example", () => {
    const patron = /(APP_USR|TEST)-\d{10,}-\d{4,}-[0-9a-f]{16,}/;
    const encontrados = [...archivos(join(RAIZ, "src")), ...archivos(join(RAIZ, "tests")), ...archivos(join(RAIZ, "docs")), join(RAIZ, ".env.example")]
      .filter((f) => !f.endsWith("checkout-modal-planes.test.ts"))
      .filter((f) => patron.test(readFileSync(f, "utf8")));
    expect(encontrados).toEqual([]);
  });
});
