import { describe, expect, it } from "vitest";
import { calcularSenaEstimada, resumenPoliticaCancelacion } from "@/lib/pagos/sena";

const base = { pago_completo_en_app: false, sena_pct: 20, sena_monto_fijo: null, sena_minimo: 5000, sena_maximo: 50000 };

describe("calcularSenaEstimada (anticipo)", () => {
  it("20 % del total", () => expect(calcularSenaEstimada(base, 40000)).toBe(8000));
  it("respeta el mínimo", () => expect(calcularSenaEstimada(base, 10000)).toBe(5000));
  it("respeta el máximo", () => expect(calcularSenaEstimada(base, 1000000)).toBe(50000));
  it("nunca supera el total", () => expect(calcularSenaEstimada({ ...base, sena_minimo: 30000 }, 18000)).toBe(18000));
  it("monto fijo manda sobre el porcentaje", () => expect(calcularSenaEstimada({ ...base, sena_monto_fijo: 12000 }, 100000)).toBe(12000));
  it("pago completo en la app cobra el total", () => expect(calcularSenaEstimada({ ...base, pago_completo_en_app: true }, 33000)).toBe(33000));
});

describe("resumenPoliticaCancelacion", () => {
  it("usa 'anticipo' y nunca voseo", () => {
    const t = resumenPoliticaCancelacion({ ventana_reembolso_total_horas: 24, ventana_reembolso_parcial_horas: 6, reembolso_parcial_pct: 50 }).join(" ");
    expect(t).toMatch(/anticipo/);
    expect(t).not.toMatch(/seña|cancelás|podés/i);
    expect(t).toMatch(/24 h/);
  });
});
