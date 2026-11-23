import { afterEach, describe, expect, it, vi } from "vitest";

const capturar = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nextjs", () => ({ captureMessage: capturar }));

import { construirEventoAlerta, enviarAlertaOperativa, limpiarDetalleAlerta, limpiarTextoAlerta } from "@/lib/observabilidad/alertas";

describe("Fase 8 · alertas operativas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    capturar.mockClear();
    delete process.env.ALERTAS_WEBHOOK_URL;
    delete process.env.ALERTAS_WEBHOOK_TOKEN;
  });

  it("limpia correos, JWT, saltos de línea y claves sensibles", () => {
    expect(limpiarTextoAlerta("falló ana@x.com con eyJhbGciOiJI.eyJzdWIiOiIx.firmafirma123\nsegunda línea")).toBe(
      "falló [email] con [Filtrado] segunda línea",
    );
    expect(limpiarDetalleAlerta({ ruta: "/api/x", email: "ana@x.com", token: "secreto", intentos: 2 })).toEqual({
      ruta: "/api/x",
      intentos: 2,
    });
  });

  it("construye el evento sin exponer el destino ni secretos", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "1.2.3";
    const evento = construirEventoAlerta({
      tipo: "WEBHOOK_ERROR",
      titulo: "fallo con ana@x.com",
      detalle: { request_id: "req-1", password: "no-sale", data_id: "123" },
    });
    expect(evento).toMatchObject({ tipo: "WEBHOOK_ERROR", titulo: "fallo con [email]", version: "1.2.3" });
    expect(evento.detalle).toEqual({ request_id: "req-1", data_id: "123" });
    expect(JSON.stringify(evento)).not.toContain("no-sale");
  });

  it("envía al webhook configurado y reporta el resultado", async () => {
    process.env.ALERTAS_WEBHOOK_URL = "http://127.0.0.1:4319/alerta";
    process.env.ALERTAS_WEBHOOK_TOKEN = "token-de-prueba";
    const fetchFalso = vi.fn(async () => new Response("ok", { status: 202 }));
    vi.stubGlobal("fetch", fetchFalso);

    await expect(enviarAlertaOperativa({ tipo: "PRUEBA", titulo: "prueba", detalle: { ruta: "/admin" } })).resolves.toBe("enviada");
    expect(capturar).toHaveBeenCalledOnce();
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:4319/alerta");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-de-prueba");
    expect(JSON.parse(String(init.body))).toMatchObject({ tipo: "PRUEBA", titulo: "prueba", detalle: { ruta: "/admin" } });
  });

  it("no envía a destinos inseguros y no falla si no hay destino", async () => {
    await expect(enviarAlertaOperativa({ tipo: "SALUD", titulo: "sin destino" })).resolves.toBe("sin_destino");

    process.env.ALERTAS_WEBHOOK_URL = "http://example.com/alerta";
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    await expect(enviarAlertaOperativa({ tipo: "SALUD", titulo: "destino inseguro" })).resolves.toBe("fallida");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
