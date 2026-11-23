import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  user: { id: "usuario-1" } as { id: string } | null,
  supersu: true,
  cupo: { ok: true as boolean, retryAfter: 0 },
  resultado: "enviada" as "enviada" | "sin_destino" | "fallida",
  alertas: 0,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: estado.user } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { es_supersu: estado.supersu } })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  limitar: vi.fn(async () => estado.cupo),
}));

vi.mock("@/lib/observabilidad/alertas", () => ({
  enviarAlertaOperativa: vi.fn(async () => {
    estado.alertas += 1;
    return estado.resultado;
  }),
}));

import { POST } from "@/app/api/monitoring/alerta-prueba/route";

describe("Fase 8 · POST /api/monitoring/alerta-prueba", () => {
  beforeEach(() => {
    estado.user = { id: "usuario-1" };
    estado.supersu = true;
    estado.cupo = { ok: true, retryAfter: 0 };
    estado.resultado = "enviada";
    estado.alertas = 0;
  });

  it("exige sesión y perfil SuperSU", async () => {
    estado.user = null;
    expect((await POST()).status).toBe(401);

    estado.user = { id: "usuario-1" };
    estado.supersu = false;
    expect((await POST()).status).toBe(403);
    expect(estado.alertas).toBe(0);
  });

  it("respeta el límite de tasa", async () => {
    estado.cupo = { ok: false, retryAfter: 42 };
    const respuesta = await POST();
    expect(respuesta.status).toBe(429);
    expect(respuesta.headers.get("retry-after")).toBe("42");
    expect(estado.alertas).toBe(0);
  });

  it("dispara la alerta de prueba y devuelve el resultado sin datos internos", async () => {
    const respuesta = await POST();
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({ ok: true, resultado: "enviada" });
    expect(estado.alertas).toBe(1);
  });

  it("marca ok=false cuando el canal falla", async () => {
    estado.resultado = "fallida";
    const respuesta = await POST();
    expect(await respuesta.json()).toEqual({ ok: false, resultado: "fallida" });
  });
});
