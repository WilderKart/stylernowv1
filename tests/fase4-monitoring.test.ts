import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ ok: true as boolean, retryAfter: 0 }));

vi.mock("@/lib/rate-limit", () => ({
  ipDelLlamador: vi.fn(async () => "203.0.113.7"),
  limitar: vi.fn(async () => ({ ok: estado.ok, retryAfter: estado.retryAfter })),
}));

vi.mock("@sentry/nextjs/tunnel", () => ({
  POST: vi.fn(async () => new Response("aceptado")),
}));

import { GET } from "@/app/api/monitoring/route";

describe("Fase 4 · healthcheck de /api/monitoring", () => {
  beforeEach(() => {
    estado.ok = true;
    estado.retryAfter = 0;
    process.env.NEXT_PUBLIC_APP_VERSION = "fase4-prueba";
    delete process.env.SUPABASE_SECRET_KEY;
  });

  it("devuelve estado, versión y timestamp sin exponer secretos", async () => {
    const respuesta = await GET();
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({ status: "ok", version: "fase4-prueba" });
    expect(typeof cuerpo.timestamp).toBe("string");
    expect(JSON.stringify(cuerpo)).not.toContain("SUPABASE_SECRET_KEY");
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("respeta el límite de tasa con Retry-After", async () => {
    estado.ok = false;
    estado.retryAfter = 17;

    const respuesta = await GET();

    expect(respuesta.status).toBe(429);
    expect(respuesta.headers.get("retry-after")).toBe("17");
  });
});
