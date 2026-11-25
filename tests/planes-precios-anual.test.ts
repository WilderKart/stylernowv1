import { describe, expect, it } from "vitest";
import { calcularPrecio } from "@/lib/planes/precios";

describe("calcularPrecio", () => {
  const base = { precioMensual: 69900, mesesPagadosAnual: 10 };
  it("mensual con fundador: 30 % sobre el mes", () => {
    expect(calcularPrecio({ ...base, ciclo: "MENSUAL", descuentoFundadorPct: 30 }).final).toBe(48930);
  });
  it("anual sin fundador: 10 meses", () => {
    expect(calcularPrecio({ ...base, ciclo: "ANUAL", descuentoFundadorPct: 0 }).final).toBe(699000);
  });
  it("anual con fundador: descuento de UN solo mes, no de 3 ni del total", () => {
    const p = calcularPrecio({ ...base, ciclo: "ANUAL", descuentoFundadorPct: 30 });
    expect(p.ahorro).toBe(20970);
    expect(p.final).toBe(678030);
  });
});
