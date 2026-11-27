import { calcularDevolucion, negocioPuedeCancelar } from "@/lib/pagos/devolucion";
import { resumenPoliticaCancelacion } from "@/lib/pagos/sena";
import { describe, expect, it } from "vitest";

describe("calcularDevolucion (migración 207)", () => {
  // Servicio de 30.000 pagado completo, anticipo de 10.000.
  it("cancela a tiempo (100 %): devuelve todo lo pagado", () => {
    expect(calcularDevolucion({ pagado: 30000, anticipoBase: 10000, pct: 100 }).monto).toBe(30000);
  });
  it("ventana parcial (50 %): resto del servicio más la mitad del anticipo", () => {
    const d = calcularDevolucion({ pagado: 30000, anticipoBase: 10000, pct: 50 });
    expect(d.monto).toBe(25000);
    expect(d.exceso).toBe(20000);
    expect(d.anticipoDevuelto).toBe(5000);
    expect(d.anticipoRetenido).toBe(5000);
  });
  it("sin derecho a reembolso (0 %): el negocio se queda el anticipo y se devuelve el resto", () => {
    const d = calcularDevolucion({ pagado: 30000, anticipoBase: 10000, pct: 0 });
    expect(d.monto).toBe(20000);
    expect(d.anticipoRetenido).toBe(10000);
  });
  it("solo pagó el anticipo (comportamiento de siempre)", () => {
    expect(calcularDevolucion({ pagado: 10000, anticipoBase: null, pct: 50 }).monto).toBe(5000);
    expect(calcularDevolucion({ pagado: 10000, anticipoBase: 10000, pct: 0 }).monto).toBe(0);
    expect(calcularDevolucion({ pagado: 10000, anticipoBase: undefined, pct: 100 }).monto).toBe(10000);
  });
  it("un anticipo base mayor a lo pagado se recorta a lo pagado", () => {
    expect(calcularDevolucion({ pagado: 8000, anticipoBase: 10000, pct: 50 }).monto).toBe(4000);
  });
});

describe("negocioPuedeCancelar", () => {
  const ahora = Date.parse("2026-11-27T12:00:00Z");
  it("con 2 h o más puede", () => {
    expect(negocioPuedeCancelar("2026-11-27T14:00:00Z", ahora)).toBe(true);
    expect(negocioPuedeCancelar("2026-11-28T09:00:00Z", ahora)).toBe(true);
  });
  it("con menos de 2 h, o ya pasada, no", () => {
    expect(negocioPuedeCancelar("2026-11-27T13:59:00Z", ahora)).toBe(false);
    expect(negocioPuedeCancelar("2026-11-27T11:00:00Z", ahora)).toBe(false);
  });
});

describe("resumen de política con pago completo", () => {
  const base = { ventana_reembolso_total_horas: 24, ventana_reembolso_parcial_horas: 6, reembolso_parcial_pct: 50 };
  it("solo agrega la aclaración cuando se cobra el servicio completo", () => {
    expect(resumenPoliticaCancelacion(base)).toHaveLength(4);
    expect(resumenPoliticaCancelacion({ ...base, pago_completo_en_app: true }).join(" ")).toContain("solo aplican al anticipo");
  });
});
