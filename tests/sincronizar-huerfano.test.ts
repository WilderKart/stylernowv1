/**
 * Huérfanos de pago (decisión del propietario, 2026-11-22): TODO pago sin `pago` conocido va a REVISIÓN, sin reembolso automático,
 * incluidos los que tienen forma de UUID. Solo se mockea Supabase y la pasarela; no toca red ni base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const insertAuditoria = vi.fn(async () => ({ error: null }));
const reembolsarEspia = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => {
      if (tabla === "evento_auditoria") return { insert: insertAuditoria };
      // `pago`: ninguna fila (huérfano)
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  }),
}));
vi.mock("@/lib/pagos/mercadopago", () => ({
  buscarPagoPorReferencia: vi.fn(),
  obtenerPago: vi.fn(),
  reembolsar: reembolsarEspia,
}));
vi.mock("@/lib/pagos/conexiones", () => ({
  conexionesDeCuenta: vi.fn(),
  cuentaDePago: vi.fn(),
  cuentaVendedorDeConexion: vi.fn(),
  tokenDeConexion: vi.fn(async () => "token"),
}));
vi.mock("@/lib/pagos/entorno", () => ({ entornoPagos: () => "SANDBOX", liveModeCoincide: () => true }));
vi.mock("@/lib/pagos/reembolsos", () => ({ procesarReembolsosSinFallar: vi.fn() }));

import { obtenerPago } from "@/lib/pagos/mercadopago";
import { sincronizarDesdeTransaccion } from "@/lib/pagos/sincronizar";

function pasarela(ref: string | null, estado = "APROBADO") {
  return { id: "555", estado, estadoCrudo: estado === "APROBADO" ? "approved" : "pending", monto: 30000, referenciaExterna: ref, collectorId: "1", liveMode: false };
}

describe("huérfanos de pago: siempre a revisión, nunca reembolso automático", () => {
  beforeEach(() => {
    insertAuditoria.mockClear();
    reembolsarEspia.mockClear();
  });

  it("referencia con forma de UUID sin pago conocido → REQUIERE_REVISION y sin reembolso", async () => {
    vi.mocked(obtenerPago).mockResolvedValue(pasarela("3f2b8c1e-5d4a-4e7b-9a10-0c1d2e3f4a5b") as never);
    const r = await sincronizarDesdeTransaccion("555", null);
    expect(r).toEqual({ estado: "REQUIERE_REVISION", motivo: "HUERFANO_A_REVISION" });
    expect(reembolsarEspia).not.toHaveBeenCalled();
    expect(insertAuditoria).toHaveBeenCalledWith(expect.objectContaining({ accion: "WEBHOOK_HUERFANO" }));
  });

  it("referencia que no es UUID → REQUIERE_REVISION y sin reembolso", async () => {
    vi.mocked(obtenerPago).mockResolvedValue(pasarela("ADIC-123") as never);
    const r = await sincronizarDesdeTransaccion("555", null);
    expect(r).toEqual({ estado: "REQUIERE_REVISION", motivo: "REFERENCIA_NO_RECONOCIDA" });
    expect(reembolsarEspia).not.toHaveBeenCalled();
  });

  it("sin referencia → REQUIERE_REVISION y sin reembolso", async () => {
    vi.mocked(obtenerPago).mockResolvedValue(pasarela(null) as never);
    const r = await sincronizarDesdeTransaccion("555", null);
    expect(r.estado).toBe("REQUIERE_REVISION");
    expect(reembolsarEspia).not.toHaveBeenCalled();
  });
});
