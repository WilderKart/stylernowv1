import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { entornoPagos, liveModeCoincide, tiposExcluidosCobroNegocio, validarTokenParaEntorno, EntornoPagosInvalido } from "@/lib/pagos/entorno";
import { calcularSenaServiciosEstimada } from "@/lib/pagos/sena";

vi.mock("server-only", () => ({}));

describe("separación de entornos (sandbox / producción)", () => {
  it("sandbox por defecto; producción solo en el despliegue de producción de Vercel", () => {
    expect(entornoPagos({})).toBe("SANDBOX");
    expect(entornoPagos({ MERCADOPAGO_ENTORNO: "sandbox", VERCEL_ENV: "production" })).toBe("SANDBOX");
    expect(entornoPagos({ MERCADOPAGO_ENTORNO: "produccion", VERCEL_ENV: "production" })).toBe("PRODUCCION");
    expect(() => entornoPagos({ MERCADOPAGO_ENTORNO: "produccion", VERCEL_ENV: "preview" })).toThrow(EntornoPagosInvalido);
    expect(() => entornoPagos({ MERCADOPAGO_ENTORNO: "produccion" })).toThrow(EntornoPagosInvalido);
  });

  it("un token de prueba nunca opera en producción", () => {
    expect(() => validarTokenParaEntorno("TEST-123", "PRODUCCION")).toThrow("TOKEN_DE_PRUEBA_EN_PRODUCCION");
    expect(() => validarTokenParaEntorno("APP_USR-123", "PRODUCCION")).not.toThrow();
    expect(() => validarTokenParaEntorno("TEST-123", "SANDBOX")).not.toThrow();
    expect(() => validarTokenParaEntorno("", "SANDBOX")).toThrow();
  });

  it("live_mode del pago debe coincidir con el entorno (y faltar = no coincide)", () => {
    expect(liveModeCoincide(false, "SANDBOX")).toBe(true);
    expect(liveModeCoincide(true, "SANDBOX")).toBe(false);
    expect(liveModeCoincide(true, "PRODUCCION")).toBe(true);
    expect(liveModeCoincide(false, "PRODUCCION")).toBe(false);
    expect(liveModeCoincide(null, "SANDBOX")).toBe(false);
  });
});

describe("firma del webhook de Mercado Pago", () => {
  const secreto = "secreto-de-prueba-ficticio";
  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });
  function firmar(dataId: string, requestId: string, ts: string, clave = secreto) {
    const v1 = createHmac("sha256", clave).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    return `ts=${ts},v1=${v1}`;
  }

  it("acepta una firma válida y reciente", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secreto;
    const { verificarFirma } = await import("@/lib/pagos/mercadopago");
    const ts = String(Date.now());
    expect(verificarFirma({ firma: firmar("123", "req-1", ts), requestId: "req-1", dataId: "123" })).toBe(true);
  });

  it("rechaza firma con otra clave, manipulada o de otro pago", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secreto;
    const { verificarFirma } = await import("@/lib/pagos/mercadopago");
    const ts = String(Date.now());
    expect(verificarFirma({ firma: firmar("123", "req-1", ts, "otra"), requestId: "req-1", dataId: "123" })).toBe(false);
    expect(verificarFirma({ firma: firmar("123", "req-1", ts), requestId: "req-1", dataId: "999" })).toBe(false);
    expect(verificarFirma({ firma: "ts=1,v1=abc", requestId: "req-1", dataId: "123" })).toBe(false);
    expect(verificarFirma({ firma: null, requestId: "req-1", dataId: "123" })).toBe(false);
  });

  it("rechaza una notificación antigua aunque esté bien firmada (anti-replay)", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secreto;
    const { verificarFirma } = await import("@/lib/pagos/mercadopago");
    const viejo = String(Date.now() - 60 * 60_000);
    expect(verificarFirma({ firma: firmar("123", "req-1", viejo), requestId: "req-1", dataId: "123" })).toBe(false);
  });

  it("sin secreto configurado devuelve null (el webhook responde 503 en producción)", async () => {
    const { verificarFirma } = await import("@/lib/pagos/mercadopago");
    expect(verificarFirma({ firma: "x", requestId: "r", dataId: "1" })).toBeNull();
  });

  it("tolera espacios o salto de línea alrededor de la clave pegada en el panel", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = `  ${secreto}\n`;
    const { verificarFirma } = await import("@/lib/pagos/mercadopago");
    const ts = String(Date.now());
    expect(verificarFirma({ firma: firmar("123", "req-1", ts), requestId: "req-1", dataId: "123" })).toBe(true);
  });

  it("el diagnóstico de una firma rechazada nunca contiene la clave", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = `${secreto} `;
    const { diagnosticoFirma } = await import("@/lib/pagos/mercadopago");
    const ts = String(Date.now());
    const d = diagnosticoFirma({ firma: firmar("123", "", ts, "otra"), requestId: "req-1", dataIdUrl: "123", dataIdCuerpo: "123" });
    expect(JSON.stringify(d)).not.toContain(secreto);
    expect(d).toMatchObject({ secretoLongitud: secreto.length, secretoTeniaEspacios: true, tsDentroDeVentana: true, coincideConVariante: null });
    expect(d.huellaSecreto).toMatch(/^[0-9a-f]{8}$/);
    // Con la clave correcta pero sin request-id en el manifiesto, el diagnóstico lo señala.
    const sinReq = `ts=${ts},v1=${createHmac("sha256", secreto).update(`id:123;ts:${ts};`).digest("hex")}`;
    expect(diagnosticoFirma({ firma: sinReq, requestId: "req-1", dataIdUrl: "123", dataIdCuerpo: null }).coincideConVariante).toBe("id_url_sin_request_id");
  });
});

describe("evidencia del proveedor en el pago", () => {
  it("lee entorno, vendedor, neto y comisiones sin datos del pagador", async () => {
    const { mapearPago } = await import("@/lib/pagos/mercadopago");
    const p = mapearPago({
      id: 1,
      status: "approved",
      transaction_amount: 30000,
      external_reference: "pago-1",
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      live_mode: false,
      collector_id: 111,
      transaction_details: { net_received_amount: 28650 },
      fee_details: [{ type: "mercadopago_fee", amount: 1350 }],
    });
    expect(p).toMatchObject({ estado: "APROBADO", liveMode: false, collectorId: "111", netoRecibido: 28650, tipoMetodo: "credit_card" });
    expect(p.comisiones).toEqual([{ type: "mercadopago_fee", amount: 1350 }]);
    expect(Object.keys(p)).not.toContain("payer");
  });

  it("live_mode ausente queda null (y entonces no coincide con ningún entorno)", async () => {
    const { mapearPago } = await import("@/lib/pagos/mercadopago");
    expect(mapearPago({ id: 2, status: "approved" }).liveMode).toBeNull();
  });
});

describe("anticipo por servicio (espejo de calcular_sena_servicios)", () => {
  const negocio = { pago_completo_en_app: false, sena_pct: 20, sena_monto_fijo: null, sena_minimo: 5000, sena_maximo: 100000 };
  it("sin reglas por servicio usa la regla del negocio", () => {
    expect(calcularSenaServiciosEstimada(negocio, [{ precio_base: 40000 }, { precio_base: 100000 }])).toBe(28000);
  });
  it("con regla por servicio coincide con la base (58.000) y respeta el máximo", () => {
    const s = [{ precio_base: 40000 }, { precio_base: 100000, anticipo_monto_fijo: 50000 }];
    expect(calcularSenaServiciosEstimada(negocio, s)).toBe(58000);
    expect(calcularSenaServiciosEstimada({ ...negocio, sena_maximo: 30000 }, s)).toBe(30000);
  });
  it("sin cuenta conectada o modo NINGUNO no hay anticipo", () => {
    expect(calcularSenaServiciosEstimada({ ...negocio, cobra_en_linea: false }, [{ precio_base: 40000 }])).toBe(0);
    expect(calcularSenaServiciosEstimada({ ...negocio, anticipo_modo: "NINGUNO" }, [{ precio_base: 40000 }])).toBe(0);
  });
});

describe("PSE en cobros de negocios (prueba aislada)", () => {
  it("por defecto PSE y Efecty excluidos en cualquier entorno", () => {
    expect(tiposExcluidosCobroNegocio({}, "SANDBOX")).toEqual(["bank_transfer", "ticket"]);
    expect(tiposExcluidosCobroNegocio({}, "PRODUCCION")).toEqual(["bank_transfer", "ticket"]);
  });
  it("la bandera de prueba solo habilita PSE en sandbox, nunca en producción", () => {
    expect(tiposExcluidosCobroNegocio({ MERCADOPAGO_PSE_NEGOCIOS: "probar" }, "SANDBOX")).toEqual(["ticket"]);
    expect(tiposExcluidosCobroNegocio({ MERCADOPAGO_PSE_NEGOCIOS: "probar" }, "PRODUCCION")).toEqual(["bank_transfer", "ticket"]);
  });
});
